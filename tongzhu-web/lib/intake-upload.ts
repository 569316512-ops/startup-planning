// Keep originals for local previews; only the upload copy is resized/compressed.
export async function prepareIntakePhoto(file:File):Promise<File>{
 if(file.size<=512*1024)return file;
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('照片读取失败'))});
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)return file;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
  if(!blob||blob.size>=file.size)return file;
  return new File([blob],file.name.replace(/\.[^.]*$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified});
 }catch{return file}finally{URL.revokeObjectURL(url)}
}

export async function uploadIntakePhotos(files:File[],options:{receiptToken:string;sessionId:string;uploaded:Map<File,string>;onProgress:(message:string)=>void}):Promise<string[]>{
 const ids=new Array<string>(files.length);let cursor=0,completed=0,failed=false;
 const worker=async()=>{
  while(cursor<files.length&&!failed){
   const index=cursor++,original=files[index];
   try{
    let id=options.uploaded.get(original);
    if(!id){
     options.onProgress(`正在处理照片（${completed}/${files.length}）…`);
     const photo=await prepareIntakePhoto(original);
     const form=new FormData();form.append('file',photo);form.append('receiptToken',options.receiptToken);form.append('sessionId',options.sessionId);form.append('adult','true');form.append('consent','true');
     options.onProgress(`正在上传照片（${completed}/${files.length}）…`);
     const response=await fetch('/api/v1/pilot/uploads',{method:'POST',body:form,credentials:'include'});
     const payload=await response.json() as {id?:string;error?:{message?:string}};
     if(!response.ok||!payload.id)throw new Error(payload.error?.message||'照片上传失败，请重试');
     id=payload.id;options.uploaded.set(original,id);
    }
    ids[index]=id;completed++;options.onProgress(`照片已上传（${completed}/${files.length}）`);
   }catch(error){failed=true;throw error}
  }
 };
 // Wait for both workers before a retry can start; retain successful uploads.
 const results=await Promise.allSettled(Array.from({length:Math.min(2,files.length)},()=>worker()));
 const rejection=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');
 if(rejection)throw rejection.reason;
 return ids;
}
