import {randomUUID,timingSafeEqual} from 'node:crypto';
import type {ApiResult,ProbeReport,StorageReport,UploadGrant} from '../shared/contracts';

export type ProbeDeps={
 authorize:(token:string)=>boolean;
 takeSlot:(runId:string)=>Promise<boolean>;
 prepareUpload:(runId:string)=>Promise<UploadGrant>;
 probeStorage:(runId:string)=>Promise<StorageReport>;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function createAuthorizer(expected:string|undefined){
 return (candidate:string)=>Boolean(
  expected&&/^[0-9a-f]{64}$/.test(expected)&&typeof candidate==='string'&&candidate.length===64&&
  Buffer.byteLength(candidate)===64&&timingSafeEqual(Buffer.from(expected),Buffer.from(candidate)),
 );
}
export async function handleProbe(input:unknown,deps:ProbeDeps):Promise<ApiResult<ProbeReport>>{
 const requestId=randomUUID();
 const fail=(status:number,code:string,message:string):ApiResult<ProbeReport>=>({ok:false,error:{status,code,message},requestId});
 const pass=(data:ProbeReport):ApiResult<ProbeReport>=>({ok:true,data,requestId});
 if(!input||typeof input!=='object'||Array.isArray(input))return fail(400,'INVALID_REQUEST','请求格式错误');
 const r=input as Record<string,unknown>;
 if(r.action==='health')return pass({status:'available',contract:1});
 if(typeof r.token!=='string'||!deps.authorize(r.token))return fail(401,'PROBE_UNAUTHORIZED','探针令牌缺失、未配置或无效');
 if(!['prepare','verify'].includes(String(r.action)))return fail(400,'INVALID_ACTION','不支持此探针操作');
 if(typeof r.runId!=='string'||!uuid.test(r.runId))return fail(400,'INVALID_RUN_ID','请生成新的 UUID v4 测试编号');
 const runId=r.runId;
 try{
  if(r.action==='prepare'){
   const slots=await Promise.all([deps.takeSlot(runId),deps.takeSlot(runId)]);
   if(slots.filter(Boolean).length!==1)return fail(409,'RPC_ATOMICITY_FAILED','事务结果不符合预期；重试请生成新的测试编号');
   const grant=await deps.prepareUpload(runId);
   if(grant.path!==`cn-probe/${runId}/pixel.png`||!grant.token||!grant.url.startsWith('https://'))
    return fail(503,'INVALID_UPLOAD_GRANT','平台未返回限定路径的上传权限');
   return pass({runId,rpc:'passed',grant:{path:grant.path,token:grant.token,url:grant.url}});
  }
  const s=await deps.probeStorage(runId);
  const storage={uploaded:s.uploaded===true,readable:s.readable===true,deleted:s.deleted===true};
  if(!storage.uploaded||!storage.readable||!storage.deleted)return fail(503,'STORAGE_CHECK_FAILED','照片核验、短期读取或删除未全部通过，请查看本机脱敏记录');
  return pass({runId,storage,status:'passed'});
 }catch{
  // SDK errors may contain signed URLs, provider credentials or request payloads.
  return fail(503,'CAPABILITY_UNAVAILABLE','平台能力未通过；请在本机核对数据库迁移、函数配置及私有存储，不要分享原始密钥或签名链接');
 }
}
