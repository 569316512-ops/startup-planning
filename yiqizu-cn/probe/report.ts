import {ENV_ID} from '../shared/contracts';
export type CheckState='passed'|'failed'|'not-run';
export function permissionDenied(error:unknown):boolean{
 if(!error||typeof error!=='object')return false;
 const e=error as Record<string,unknown>;
 return e.code==='42501'||e.status===403||e.statusCode===403;
}
export function signedUploadDenied(error:unknown):boolean{
 if(!error||typeof error!=='object')return false;
 const e=error as Record<string,unknown>;
 return permissionDenied(e)||[400,401,409].includes(Number(e.status??e.statusCode));
}
export function publicReport(input:{runId:string;checks:Record<string,CheckState>;requestIds:string[];[key:string]:unknown}){
 const checks=Object.fromEntries(Object.entries(input.checks).filter(([key,value])=>/^[A-Za-z]+$/.test(key)&&['passed','failed','not-run'].includes(value)));
 return {
  environmentId:ENV_ID,
  sdk:{web:'3.10.3',node:'3.18.7'},
  runId:input.runId,
  checks,
  requestIds:input.requestIds.filter(x=>/^[A-Za-z0-9_-]{1,80}$/.test(x)),
  generatedAt:new Date().toISOString(),
  overall:'manual-verification-required',
 };
}
