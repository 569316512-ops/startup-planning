// Adapted from RoomDate src/api/early.ts. Preserve response handoff and URL contract.
const early=new Map<string,{response:Promise<Response>;at:number}>();
export function takeEarly(path:string){const entry=early.get(path);if(!entry)return undefined;early.delete(path);return Date.now()-entry.at<10000?entry.response:undefined;}
export function listingsPath(filters:Record<string,string>={}){const p=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>{if(v)p.set(k,v)});return '/api/v1/listings'+(p.size?'?'+p:'');}
