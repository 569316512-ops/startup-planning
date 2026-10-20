function status(error:Record<string,unknown>){return Number(error.status??error.statusCode)}
function codes(error:Record<string,unknown>){
 return [error.code,error.error,error.statusCode].filter((x):x is string=>typeof x==='string'&&x.length<=80).map(x=>x.replace(/[^A-Za-z0-9]/g,'').toUpperCase());
}
export function permissionDenied(error:unknown):boolean{
 if(!error||typeof error!=='object')return false;
 const e=error as Record<string,unknown>,c=codes(e);
 return c.includes('42501')||status(e)===403&&c.some(x=>['FORBIDDEN','ACCESSDENIED','PERMISSIONDENIED'].includes(x));
}
export function signedUploadDenied(error:unknown):boolean{
 if(!error||typeof error!=='object')return false;
 const e=error as Record<string,unknown>,c=codes(e),s=status(e);
 const scope=[400,401,403].includes(s)&&c.some(x=>['SIGNATUREDOESNOTMATCH','SIGNATUREMISMATCH','INVALIDSIGNATURE','FORBIDDEN','ACCESSDENIED','PERMISSIONDENIED'].includes(x));
 const conflict=s===409&&c.some(x=>['DUPLICATE','ALREADYEXISTS','OBJECTALREADYEXISTS','RESOURCEALREADYEXISTS','KEYALREADYEXISTS'].includes(x));
 return scope||conflict;
}
export function objectNotFound(error:unknown):boolean{
 if(!error||typeof error!=='object')return false;
 const e=error as Record<string,unknown>;
 return [400,404].includes(status(e))&&codes(e).some(x=>['NOSUCHKEY','NOTFOUND','OBJECTNOTFOUND','STORAGEOBJECTNOTFOUND'].includes(x));
}
async function responseError(response:Response):Promise<Record<string,unknown>|null>{
 if(!response.headers.get('Content-Type')?.includes('application/json')||!response.body)return null;
 const reader=response.body.getReader();let text='';const decoder=new TextDecoder();let bytes=0;
 try{
  while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>4096)return null;text+=decoder.decode(r.value,{stream:true})}
  text+=decoder.decode();const body:unknown=JSON.parse(text);
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const b=body as Record<string,unknown>;
  return {status:response.status,code:b.code,error:b.error,statusCode:b.statusCode};
 }catch{return null}finally{await reader.cancel()}
}
export async function postgresDeniedResponse(response:Response):Promise<boolean>{
 if(![401,403].includes(response.status))return false;
 const e=await responseError(response);return e!==null&&e.code==='42501';
}
export async function privateObjectDeniedResponse(response:Response):Promise<boolean>{
 const e=await responseError(response);return e!==null&&(permissionDenied(e)||objectNotFound(e));
}
