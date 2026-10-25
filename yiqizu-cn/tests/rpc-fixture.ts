import {sqlAsync,literal} from './pg-fixture';
import type {Database} from '../server/database';
import {unwrapRpc} from '../server/database';
export const testDb:Database={async call<T>(name:string,params:Record<string,unknown>):Promise<T>{
 if(!/^cn_[a-z_0-9]+$/.test(name)||Object.keys(params).some(k=>!/^p_[a-z_]+$/.test(k)))throw new Error('Invalid test RPC');
 const args=Object.entries(params).map(([k,v])=>`${k} => ${v===null?'NULL':Array.isArray(v)?`ARRAY[${v.map(x=>literal(String(x))).join(',')}]::uuid[]`:typeof v==='number'||typeof v==='boolean'?String(v):literal(typeof v==='string'?v:JSON.stringify(v))}`);
 const out=await sqlAsync(`SET ROLE service_role; SELECT public.${name}(${args.join(',')});`);
 return unwrapRpc<T>(JSON.parse(out.split('\n').at(-1)!));
}};
