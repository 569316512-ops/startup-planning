import cloudbase from '@cloudbase/js-sdk';
import {ENV_ID,PROBE_BUCKET,PROBE_FUNCTION,PIXEL_BASE64,type ApiResult,type ProbeReport} from '../shared/contracts';
import {permissionDenied,signedUploadDenied,publicReport,type CheckState} from './report';

const form=document.querySelector<HTMLFormElement>('#probe')!;
const input=document.querySelector<HTMLInputElement>('#token')!;
const button=document.querySelector<HTMLButtonElement>('#run')!;
const output=document.querySelector<HTMLElement>('#result')!;
const status=document.querySelector<HTMLElement>('#status')!;
const copy=document.querySelector<HTMLButtonElement>('#copy')!;
let exportText='';
copy.addEventListener('click',()=>void navigator.clipboard.writeText(exportText).then(()=>{status.textContent='已复制脱敏报告。'}).catch(()=>{status.textContent='请手动选中下方报告复制。'}));

form.addEventListener('submit',async e=>{
 e.preventDefault();
 let token=input.value.trim();input.value='';
 if(!/^[0-9a-f]{64}$/.test(token)){status.textContent='请填写本机生成的64位小写十六进制探针令牌。';return}
 button.disabled=true;copy.disabled=true;output.textContent='';
 const runId=crypto.randomUUID(),requestIds:string[]=[];
 const checks:Record<string,CheckState>={sdk:'not-run',rpcConcurrency:'not-run',anonymousTableDenied:'not-run',anonymousRpcDenied:'not-run',signedUpload:'not-run',wrongPathDenied:'not-run',replayDenied:'not-run',anonymousStorageDenied:'not-run',publicStorageDenied:'not-run',storageReadAndDelete:'not-run',ordinaryAccountIsolation:'not-run',resourceUsage:'not-run'};
 const display=()=>{exportText=JSON.stringify(publicReport({runId,checks,requestIds}),null,2);output.textContent=exportText};
 // No token is stored in storage, URLs, telemetry, the DOM result or the exported report.
 try{
  status.textContent='正在连接SDK访客会话…';
  const app=cloudbase.init({env:ENV_ID,persistence:'none'});
  const auth=await app.auth({persistence:'none'}).signInAnonymously();
  if(auth.error)throw new Error('SDK访客登录失败，请在本机检查登录方式和安全域名配置。');
  const call=async(action:string)=>{
   const r=await app.callFunction({name:PROBE_FUNCTION,data:{action,runId,...(action==='health'?{}:{token})}});
   const v=r.result as ApiResult<ProbeReport>;
   if(!v||typeof v!=='object'||typeof v.ok!=='boolean'||typeof v.requestId!=='string')throw new Error('函数未返回探针JSON，不能作为通过证据。');
   requestIds.push(v.requestId);
   if(!v.ok)throw new Error(v.error.message);
   return v.data;
  };
  await call('health');checks.sdk='passed';display();
  status.textContent='正在验证PG事务和限定上传权限…';
  const prepared=await call('prepare');
  if(!('grant'in prepared)||prepared.grant.path!==`cn-probe/${runId}/pixel.png`)throw new Error('没有返回正确的单对象上传权限。');
  checks.rpcConcurrency='passed';
  // Published Web SDK 3.10.3 declares rdb as MySqlClient, without rpc().
  // Use documented PostgREST HTTP for the explicit negative-access tests instead of unsafe casts.
  const {accessToken}=await app.auth().getAccessToken();
  const gateway=`https://${ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`;
  const table=await fetch(`${gateway}/cn_probe_slots?select=run_id&limit=1`,{headers:{Authorization:`Bearer ${accessToken}`}});
  checks.anonymousTableDenied=permissionDenied({status:table.status})?'passed':'failed';
  const rpc=await fetch(`${gateway}/rpc/cn_probe_take_slot`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({p_run_id:runId})});
  checks.anonymousRpcDenied=permissionDenied({status:rpc.status})?'passed':'failed';
  const bucket=app.storage.from(PROBE_BUCKET);
  const bytes=Uint8Array.from(atob(PIXEL_BASE64),c=>c.charCodeAt(0));
  const file=new Blob([bytes],{type:'image/png'});
  const upload=await bucket.uploadToSignedUrl(prepared.grant.path,prepared.grant.token,file,{contentType:'image/png',upsert:false});
  if(upload.error)throw new Error('浏览器签名上传失败，请在本机检查私有桶及签名接口。');
  checks.signedUpload='passed';display();
  // A valid token must not authorize a different object or overwriting the verified object.
  const wrong=await bucket.uploadToSignedUrl(`cn-probe/${runId}/other.png`,prepared.grant.token,file,{contentType:'image/png',upsert:false});
  checks.wrongPathDenied=signedUploadDenied(wrong.error)?'passed':'failed';
  const replay=await bucket.uploadToSignedUrl(prepared.grant.path,prepared.grant.token,file,{contentType:'image/png',upsert:true});
  checks.replayDenied=signedUploadDenied(replay.error)?'passed':'failed';
  const anon=await bucket.download(prepared.grant.path);
  checks.anonymousStorageDenied=permissionDenied(anon.error)?'passed':'failed';
  const publicUrl=bucket.getPublicUrl(prepared.grant.path).data.publicUrl;
  const publicRead=await fetch(publicUrl,{credentials:'omit',cache:'no-store',redirect:'error'});
  checks.publicStorageDenied=[403,404].includes(publicRead.status)?'passed':'failed';
  status.textContent='正在由服务端核验1px测试图片、短期读取并删除…';
  await call('verify');checks.storageReadAndDelete='passed';
  status.textContent=Object.values(checks).includes('failed')?'存在失败项目，请交回报告；不要放开公共权限。':'自动探针已运行。普通账号权限、真实额度和平台限制仍需WorkBuddy核查。';
 }catch(error){
  // Never print raw SDK errors: they can contain the request body and probe token.
  const known=error instanceof Error&&/^(SDK访客|函数未|没有返回|浏览器签名|探针令牌|平台能力|事务结果|照片核验)/.test(error.message);
  status.textContent=known?(error as Error).message:'探针未通过或网络失败，请在本机核查SDK/函数/存储配置，并只分享下方脱敏报告。';
 }finally{
  token='';display();button.disabled=false;copy.disabled=false;
 }
});
