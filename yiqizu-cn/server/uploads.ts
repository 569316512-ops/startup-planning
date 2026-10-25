import {randomUUID} from 'node:crypto';
import type {Actor,UploadGrant} from '../shared/contracts';
import type {Database} from './database';
import {object,ensure,choice,integer,UUID} from '../shared/rules';
export type StoragePort={issueUpload(key:string,input:{type:string;maxBytes:number}):Promise<UploadGrant>;inspect(key:string):Promise<{size:number;type:string;header:Uint8Array}>;readUrl(key:string,seconds:number):Promise<string>;remove(key:string):Promise<void>};
type Upload={id:string;object_key:string;mime_type:string;size_bytes:number;state:string};
export function photoType(header:Uint8Array){
 if(header.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>header[i]===v))return 'image/png';
 if(header.length>=3&&header[0]===255&&header[1]===216&&header[2]===255)return 'image/jpeg';
 if(header.length>=12&&Buffer.from(header.slice(0,4)).toString()==='RIFF'&&Buffer.from(header.slice(8,12)).toString()==='WEBP')return 'image/webp';
 return null;
}
export class UploadService{
 constructor(private db:Database,private storage:StoragePort){}
 async begin(actor:Actor,input:unknown){
  const p=object(input),type=choice(p.type,['image/png','image/jpeg','image/webp'],'照片格式'),size=integer(p.size,'照片大小',1,5242880),uploadId=randomUUID(),key=`cn-photos/${actor.userId}/${uploadId}`;
  await this.db.call('cn_upload_begin',{p_user_id:actor.userId,p_id:uploadId,p_key:key,p_type:type,p_size:size});
  const grant=await this.storage.issueUpload(key,{type,maxBytes:5242880});ensure(grant.path===key,'上传权限');return {uploadId,grant};
 }
 async finalize(actor:Actor,uploadId:string){
  ensure(UUID.test(uploadId),'照片标识');const row=await this.db.call<Upload>('cn_upload_get',{p_user_id:actor.userId,p_id:uploadId});
  if(row.state==='ready'||row.state==='bound')return {uploadId};
  const actual=await this.storage.inspect(row.object_key);
  ensure(actual.size===row.size_bytes&&actual.size<=5242880&&actual.type===row.mime_type&&photoType(actual.header)===row.mime_type,'照片格式或大小不符');
  await this.db.call('cn_upload_ready',{p_user_id:actor.userId,p_id:uploadId});return {uploadId};
 }
 async urls(ids:string[],actor:Actor|null):Promise<Record<string,string>>{
  ensure(Array.isArray(ids)&&ids.length<=24&&ids.every(x=>typeof x==='string'&&UUID.test(x)),'照片标识');
  const result=await this.db.call<{items:Upload[]}>('cn_upload_reads',{p_user_id:actor?.userId??null,p_ids:[...new Set(ids)]});
  const out:Record<string,string>={};
  // Bounded concurrency: do not fan out a whole gallery at once.
  for(let i=0;i<result.items.length;i+=2)await Promise.all(result.items.slice(i,i+2).map(async row=>{out[row.id]=await this.storage.readUrl(row.object_key,300)}));
  return out;
 }
}
