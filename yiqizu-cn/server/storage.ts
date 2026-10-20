import {PIXEL_BASE64,type StorageReport,type UploadGrant} from '../shared/contracts';
type Result<T>={data:T|null;error:unknown};
export type ProbeStorageBucket={
 createSignedUploadUrl:(path:string,options:{upsert:boolean})=>Promise<Result<{path:string;token:string;fullSignedURL:string}>>;
 info:(path:string)=>Promise<Result<{size?:number|null;contentType?:string|null}>>;
 download:(path:string)=>PromiseLike<Result<Blob>>;
 createSignedUrl:(path:string,seconds:number)=>Promise<Result<{fullSignedURL:string}>>;
 remove:(paths:string[])=>Promise<Result<unknown>>;
 exists:(path:string)=>Promise<Result<boolean>>;
};
const fixture=Buffer.from(PIXEL_BASE64,'base64');
const pathFor=(id:string)=>{
 if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('INVALID_RUN_ID');
 return `cn-probe/${id}/pixel.png`;
};
export async function prepareProbeUpload(bucket:ProbeStorageBucket,runId:string):Promise<UploadGrant>{
 const path=pathFor(runId);
 const r=await bucket.createSignedUploadUrl(path,{upsert:false});
 if(r.error||!r.data||r.data.path!==path||!r.data.token||!r.data.fullSignedURL.startsWith('https://'))throw new Error('SIGNING_UNAVAILABLE');
 return {path,token:r.data.token,url:r.data.fullSignedURL};
}
async function readSmallResponse(response:Response){
 if(!response.ok||!response.body)throw new Error('SIGNED_READ_FAILED');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>1024)throw new Error('FIXTURE_MISMATCH');chunks.push(r.value)}}
 finally{await reader.cancel()}
 return Buffer.concat(chunks);
}
export async function verifyProbeStorage(bucket:ProbeStorageBucket,runId:string,readUrl:typeof fetch=fetch):Promise<StorageReport>{
 const path=pathFor(runId),info=await bucket.info(path);
 if(info.error||!info.data||info.data.size!==fixture.length||info.data.contentType!=='image/png')throw new Error('FIXTURE_MISMATCH');
 const download=await bucket.download(path);
 if(download.error||!download.data||download.data.size!==fixture.length||!Buffer.from(await download.data.arrayBuffer()).equals(fixture))throw new Error('FIXTURE_MISMATCH');
 const signed=await bucket.createSignedUrl(path,300);
 if(signed.error||!signed.data||!signed.data.fullSignedURL.startsWith('https://'))throw new Error('SIGNING_UNAVAILABLE');
 const raw=await readUrl(signed.data.fullSignedURL,{redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!(await readSmallResponse(raw)).equals(fixture))throw new Error('SIGNED_READ_MISMATCH');
 const removed=await bucket.remove([path]);
 if(removed.error)throw new Error('DELETE_FAILED');
 const remains=await bucket.exists(path);
 return {uploaded:true,readable:true,deleted:!remains.error&&remains.data===false};
}
