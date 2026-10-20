import nodeSdk from '@cloudbase/node-sdk';
import storageSdk from '@cloudbase/js-sdk';
import {ENV_ID,PROBE_BUCKET} from '../shared/contracts';
import {takeProbeSlot} from './db';
import {prepareProbeUpload,verifyProbeStorage} from './storage';
import type {ProbeDeps} from '../probe/main';
import {createAuthorizer} from '../probe/main';

export function cloudProbeDeps():ProbeDeps{
 // Initialization is deliberately lazy: health/unauthorized requests touch no cloud resource.
 let ports:ReturnType<typeof connect>|undefined;
 function connect(){
  const key=process.env.CLOUDBASE_APIKEY;
  if(!key||process.env.CLOUDBASE_ENV_ID!==ENV_ID)throw new Error('SERVER_NOT_CONFIGURED');
  const db=nodeSdk.init({env:ENV_ID,accessKey:key,timeout:10000}).rdb();
  const storage=storageSdk.init({env:ENV_ID,accessKey:key,persistence:'none',debug:false,timeout:10000}).storage.from(PROBE_BUCKET);
  return {db,storage};
 }
 const get=()=>ports??=(connect());
 return {
  authorize:createAuthorizer(process.env.PROBE_TOKEN),
  takeSlot:runId=>takeProbeSlot(get().db,runId),
  prepareUpload:runId=>prepareProbeUpload(get().storage,runId),
  probeStorage:runId=>verifyProbeStorage(get().storage,runId),
 };
}
