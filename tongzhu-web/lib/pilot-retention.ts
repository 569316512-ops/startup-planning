/** Six calendar months in Asia/Shanghai; keep the time and clamp short months. */
export function pilotRetentionCutoff(now:Date=new Date()):string{
 const local=new Date(now.getTime()+8*60*60*1000);
 const day=local.getUTCDate();
 local.setUTCDate(1);
 local.setUTCMonth(local.getUTCMonth()-6);
 const lastDay=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,0)).getUTCDate();
 local.setUTCDate(Math.min(day,lastDay));
 return new Date(local.getTime()-8*60*60*1000).toISOString();
}
