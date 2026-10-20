type SignedUploader={uploadToSignedUrl:(path:string,token:string,file:Blob,options:{contentType:string;upsert:boolean;headers:Record<string,string>})=>Promise<{error:unknown}>};
export function attemptProbeOverwrite(bucket:SignedUploader,path:string,token:string,file:Blob){
 // SDK 3.10.3 ignores `upsert` in signed uploads: the explicit header is essential.
 return bucket.uploadToSignedUrl(path,token,file,{contentType:'image/png',upsert:true,headers:{'x-upsert':'true'}});
}
