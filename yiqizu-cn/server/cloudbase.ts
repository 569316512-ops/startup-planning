import nodeSdk from '@cloudbase/node-sdk';
import storageSdk from '@cloudbase/js-sdk';
import {ENV_ID,PROBE_BUCKET} from '../shared/contracts';
import {takeProbeSlot} from './db';
import {prepareProbeUpload,verifyProbeStorage} from './storage';
import type {ProbeDeps} from '../probe/main';
import {createAuthorizer} from '../probe/main';
import {readyPort} from './ready-port';

export function cloudProbeDeps():ProbeDeps{
 // Initialization is deliberately lazy: health/unauthorized requests touch no cloud resource.
 async function connect(){
  const key=process.env.CLOUDBASE_APIKEY;
  if(!key||process.env.CLOUDBASE_ENV_ID!==ENV_ID)throw new Error('SERVER_NOT_CONFIGURED');
  const db=nodeSdk.init({env:ENV_ID,accessKey:key,timeout:10000}).rdb();
  const app=storageSdk.init({env:ENV_ID,accessKey:key,persistence:'none',debug:false,timeout:2000});
  // Creating storage alone does not initialize the OAuth instance used by request.fetch.
  // Explicitly initialize auth and await its credential readiness before any object operation.
  const credentials=await app.auth({persistence:'none'}).getAccessToken();
  if(!credentials.accessToken)throw new Error('CREDENTIALS_UNAVAILABLE');
  const storage=app.storage.from(PROBE_BUCKET);
  return {db,storage};
 }
 const get=readyPort(connect);
 return {
  authorize:createAuthorizer(process.env.PROBE_TOKEN),
  takeSlot:async runId=>takeProbeSlot((await get()).db,runId),
  prepareUpload:async runId=>prepareProbeUpload((await get()).storage,runId),
  probeStorage:async runId=>verifyProbeStorage((await get()).storage,runId),
 };
}
