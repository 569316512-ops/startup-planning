import {ENV_ID} from '../shared/contracts';
export type CheckState='passed'|'failed'|'not-run';
export {permissionDenied,signedUploadDenied,postgresDeniedResponse,privateObjectDeniedResponse} from '../shared/provider-errors';
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
