const SOURCES=['direct','wechat_group','friend','colleague','xiaohongshu','douyin','test'];
export function pilotSource(){const src=new URLSearchParams(window.location.search).get('src')||'direct';return SOURCES.includes(src)?src:'direct'}
export function pilotSession(){try{const key='yiqizu-pilot-session';let id=sessionStorage.getItem(key);if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id)}return id}catch{return crypto.randomUUID()}}
export function pilotTrack(event:'visit'|'quick_open'|'detail_open'|'contact_click',city:string){
 if(new URLSearchParams(window.location.search).get('qa')==='1'||pilotSource()==='test')return;
 void fetch('/api/v1/pilot/events',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,city,source:pilotSource(),sessionId:pilotSession(),eventId:crypto.randomUUID()}),keepalive:true}).catch(()=>{});
}
