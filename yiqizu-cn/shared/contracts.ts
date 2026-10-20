export const ENV_ID='yiqizu-mvp-test-d4fa3kk6dc43ea64';
export const PROBE_FUNCTION='yiqizu-capability-probe';
export const PROBE_BUCKET='cn-probe-private';
export const CONTRACT_VERSION=1;
export type Kind='room'|'seeker';
export type Actor={userId:string;role:'user'|'admin'};
export type ApiRequest={version:1;action:string;sessionToken?:string;requestId:string;payload:unknown};
export type ApiResult<T>=
 | {ok:true;data:T;requestId:string}
 | {ok:false;error:{status:number;code:string;message:string};requestId:string};
export type UploadGrant={path:string;token:string;url:string};
export type StorageReport={uploaded:boolean;readable:boolean;deleted:boolean};
export type ProbeReport=
 | {status:'available';contract:1}
 | {runId:string;rpc:'passed';grant:UploadGrant}
 | {runId:string;storage:StorageReport;status:'passed'};
export const PIXEL_BASE64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
