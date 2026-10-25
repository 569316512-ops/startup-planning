import {randomUUID} from 'node:crypto';
import type {ApiResult} from '../shared/contracts';
import {InputError} from '../shared/rules';
import {ApiError,unauthorized} from './errors';
import type {AuthService} from './auth';
import type {ProfileService} from './profile';
const actions=new Set(['auth.register','auth.login','auth.session','auth.logout','auth.changePassword','profile.get','profile.update']);
export function createRouter(auth:AuthService,profiles:ProfileService){return async(input:unknown,transportIdentity:string):Promise<ApiResult<unknown>>=>{
 let requestId:string=randomUUID();
 try{
  if(!input||typeof input!=='object'||!('version'in input)||input.version!==1||!('action'in input)||typeof input.action!=='string'||!actions.has(input.action))throw new ApiError(400,'INVALID_REQUEST','请求不受支持');
  const raw=input as Record<string,unknown>;if(typeof raw.requestId==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(raw.requestId))requestId=raw.requestId;
  const action=input.action;let data:unknown;
  if(action==='auth.register'||action==='auth.login')data=action==='auth.register'?await auth.register(raw.payload,transportIdentity):await auth.login(raw.payload,transportIdentity);
  else{
   const token=typeof raw.sessionToken==='string'?raw.sessionToken:undefined,actor=await auth.resolveActor(token);if(!actor)throw unauthorized();
   switch(action){
    case 'auth.session':case 'profile.get':data=await profiles.get(actor);break;
    case 'profile.update':data=await profiles.update(actor,raw.payload);break;
    case 'auth.logout':await auth.logout(token!);data={loggedOut:true};break;
    case 'auth.changePassword':await auth.changePassword(actor,raw.payload);data={changed:true};break;
   }
  }
  return {ok:true,data,requestId};
 }catch(error){
  if(error instanceof ApiError)return {ok:false,error:{status:error.status,code:error.code,message:error.message},requestId};
  if(error instanceof InputError)return {ok:false,error:{status:400,code:'INVALID_INPUT',message:error.message},requestId};
  return {ok:false,error:{status:503,code:'UNAVAILABLE',message:'服务暂时不可用，请稍后再试'},requestId};
 }
}}
