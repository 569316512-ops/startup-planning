import type {RpcClient} from './db';
import {domainError} from './errors';
export interface Database{call<T>(name:string,params:Record<string,unknown>):Promise<T>}
export function unwrapRpc<T>(data:unknown):T{
 if(!data||typeof data!=='object')domainError('INVALID_RPC_RESULT');
 if('error'in data&&typeof data.error==='string')domainError(data.error);
 return data as T;
}
export function database(client:RpcClient):Database{return {async call<T>(name:string,params:Record<string,unknown>){
 // No dynamic SQL endpoint: only internal code supplies explicit function names.
 if(!/^cn_[a-z_0-9]+$/.test(name))domainError('INVALID_RPC');
 const result=await client.rpc(name,params);if(result.error)domainError('DATABASE_UNAVAILABLE');return unwrapRpc<T>(result.data);
}}}
