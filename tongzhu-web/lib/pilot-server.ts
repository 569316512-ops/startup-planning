import {env} from 'cloudflare:workers';
import {CITIES,districtsFor} from './cities';
import {PILOT_HOUSING_STATES,type PilotHousing} from './pilot-housing';

type Row=Record<string,any>;
type DB={all:(sql:string,...args:any[])=>Promise<Row[]>;first:(sql:string,...args:any[])=>Promise<Row|null>;run:(sql:string,...args:any[])=>Promise<unknown>;throttle:(key:string,limit:number,seconds:number)=>Promise<void>;sha:(s:string)=>Promise<string>};
class PilotError extends Error{constructor(public status:number,message:string){super(message)}}
const ensure=(ok:unknown,message:string,status=400)=>{if(!ok)throw new PilotError(status,message)};
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const tokenOK=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{32,64}$/.test(v);
const SOURCES=['direct','wechat_group','friend','colleague','xiaohongshu','test'];
const STAGES=['new','qualified','contacted','viewing','matched','invalid'];
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export async function handlePilot(request:Request,user:Row|null,db:DB):Promise<Response>{
 try{
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/v1\/pilot\/?/,''),method=request.method;
  const body=async()=>{const raw=await request.text();ensure(raw.length<6000,'提交内容过长',413);try{const parsed=JSON.parse(raw);ensure(parsed&&typeof parsed==='object'&&!Array.isArray(parsed),'提交格式不正确');return parsed as Row}catch{throw new PilotError(400,'提交格式不正确')}};
  const source=(v:unknown)=>SOURCES.includes(String(v))?String(v):'direct';
  const timestamp=()=>new Date().toISOString();
  const bucket=(env as unknown as {BUCKET:R2Bucket}).BUCKET;
  const removeUploads=async(rows:Row[])=>{for(const row of rows){ensure(bucket,'照片存储暂不可用',503);await bucket.delete(row.object_key);await db.run('DELETE FROM pilot_uploads WHERE id=?',row.id)}};
  const cleanup=async()=>{const cutoff=new Date(Date.now()-30*86400000).toISOString(),orphanCutoff=new Date(Date.now()-86400000).toISOString();await removeUploads(await db.all('SELECT id,object_key FROM pilot_uploads WHERE created_at<? OR (created_at<? AND NOT EXISTS (SELECT 1 FROM pilot_leads WHERE pilot_leads.receipt_hash=pilot_uploads.receipt_hash))',cutoff,orphanCutoff));await db.run('DELETE FROM pilot_leads WHERE created_at<?',cutoff);await db.run('DELETE FROM pilot_events WHERE created_at<?',cutoff)};
  const operator=()=>{const owner=(env as unknown as {PILOT_OWNER_EMAIL?:string}).PILOT_OWNER_EMAIL;ensure(user?.role==='admin'||(owner&&request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===owner.toLowerCase()),'运营看板仅项目负责人可访问，请使用负责人账号登录',403)};
  if(path==='uploads'&&method==='POST'){
   await db.throttle('pilot-upload:'+request.headers.get('cf-connecting-ip'),40,3600);const form=await request.formData();const receiptToken=form.get('receiptToken');ensure(tokenOK(receiptToken)&&tokenOK(form.get('sessionId')),'上传凭证无效');ensure(form.get('adult')==='true'&&form.get('consent')==='true','请确认年龄及照片使用范围');const receiptHash=await db.sha(String(receiptToken));ensure(!await db.first('SELECT id FROM pilot_leads WHERE receipt_hash=?',receiptHash),'本次登记已提交，请勿重复上传');
   const file=form.get('file');ensure(file instanceof File,'请选择照片');const photo=file as File;ensure(photo.size>0&&photo.size<=5*1024*1024,'每张照片需小于5MB');ensure(['image/jpeg','image/png','image/webp'].includes(photo.type),'只支持JPEG、PNG或WebP照片');const data=await photo.arrayBuffer(),h=new Uint8Array(data);ensure((photo.type==='image/jpeg'&&h[0]===255&&h[1]===216&&h[2]===255)||(photo.type==='image/png'&&h[0]===137&&h[1]===80&&h[2]===78&&h[3]===71)||(photo.type==='image/webp'&&String.fromCharCode(...h.slice(0,4))==='RIFF'&&String.fromCharCode(...h.slice(8,12))==='WEBP'),'照片格式与内容不符');ensure(bucket,'照片存储暂不可用',503);const id=crypto.randomUUID(),key=`pilot/${receiptHash}/${id}`;await bucket.put(key,data,{httpMetadata:{contentType:photo.type}});try{await db.run('INSERT INTO pilot_uploads (id,receipt_hash,object_key,content_type,created_at) VALUES (?,?,?,?,?)',id,receiptHash,key,photo.type,timestamp())}catch(e){await bucket.delete(key);throw e}return response({id},201);
  }
  const photoRoute=path.match(/^photos\/([a-zA-Z0-9-]+)$/);
  if(photoRoute&&method==='GET'){
   const receipt=request.headers.get('x-pilot-receipt');if(!receipt)operator();else ensure(tokenOK(receipt),'照片访问凭证无效',403);
   const row=await db.first('SELECT * FROM pilot_uploads WHERE id=?',photoRoute[1]);ensure(row,'照片不存在',404);if(receipt)ensure(row!.receipt_hash===await db.sha(receipt),'照片不存在',404);ensure(bucket,'照片存储暂不可用',503);const object=await bucket.get(row!.object_key);ensure(object,'照片不存在',404);return new Response(object!.body,{headers:{'Content-Type':row!.content_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  if(path==='events'&&method==='POST'){
   const b=await body();ensure(['visit','quick_open','detail_open','contact_click'].includes(b.event),'不支持的统计事件');ensure(tokenOK(b.sessionId)&&tokenOK(b.eventId),'统计标识无效');ensure(CITIES.includes(b.city),'城市无效');
   await db.throttle('pilot-event:'+request.headers.get('cf-connecting-ip'),180,60);
   await db.run('INSERT OR IGNORE INTO pilot_events (id,session_id,event,city,source,created_at) VALUES (?,?,?,?,?,?)',b.eventId,b.sessionId,b.event,b.city,source(b.source),timestamp());return response({ok:true});
  }
  if(path==='leads'&&method==='POST'){
   const b=await body();ensure(tokenOK(b.receiptToken)&&tokenOK(b.sessionId),'登记标识无效');ensure(CITIES.includes(b.city),'请选择已开放城市');ensure(districtsFor(b.city).slice(1).includes(b.district),'请选择该城市的区域');ensure(['room','seeker'].includes(b.kind),'请选择有房或求租');ensure(Number.isInteger(b.budget)&&b.budget>=1&&b.budget<=50000,'请填写1至50000元的月租或预算');
   const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});ensure(/^\d{4}-\d{2}-\d{2}$/.test(b.moveIn)&&Number.isFinite(Date.parse(b.moveIn))&&new Date(b.moveIn).toISOString().slice(0,10)===b.moveIn&&b.moveIn>=today,'请选择有效的计划入住日期');
   ensure(b.adult===true,'试点仅面向年满18岁的用户');ensure(b.consent===true,'请确认联系方式的使用范围');const nickname=text(b.nickname,30);ensure(nickname.length>=1,'请填写怎么称呼你');ensure(['wechat','phone'].includes(b.contactType),'请选择一种联系方式');const contact=text(b.contact,40);ensure(b.contactType==='phone'?/^1[3-9]\d{9}$/.test(contact):/^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/.test(contact),'请填写有效的手机号或微信号');
   const note=text(b.note,500);ensure(note.length>=4,'请简单说明住房或室友需求');ensure(!text(b.website,100),'提交未通过');const receiptHash=await db.sha(b.receiptToken);const existing=await db.first('SELECT id FROM pilot_leads WHERE receipt_hash=?',receiptHash);if(existing)return response({id:existing.id,duplicate:true});
   let housing:Partial<PilotHousing>={};if(b.kind==='room'){const h=b.housing;ensure(h&&typeof h==='object','请填写房子基本信息');ensure(text(h.community,80).length>=2,'请填写小区或公寓名称');ensure(Object.hasOwn(PILOT_HOUSING_STATES,h.housingState),'请选择房源状态');ensure([2,3].includes(h.bedrooms),'仅支持原始两居或三居');ensure(Number.isInteger(h.bathrooms)&&h.bathrooms>=1&&h.bathrooms<=3,'请选择卫生间数量');ensure(Number.isFinite(h.area)&&h.area>=1&&h.area<=1000,'请填写有效的整套面积');ensure(Number.isInteger(h.roomsAvailable)&&h.roomsAvailable>=1&&h.roomsAvailable<=h.bedrooms,'请选择可合租卧室数量');ensure(h.originalLayout===true,'仅支持无新增隔断的原始户型');const amenities:string[]=Array.isArray(h.amenities)?[...new Set<string>(h.amenities.map((v:unknown)=>text(v,20)).filter((v:string)=>Boolean(v)))].slice(0,30):[];ensure(amenities.length>=1,'请至少选择或添加一项房屋设施');housing={community:text(h.community,80),housingState:h.housingState,bedrooms:h.bedrooms,bathrooms:h.bathrooms,area:h.area,roomsAvailable:h.roomsAvailable,originalLayout:true,amenities};}
   const photoIds=Array.isArray(b.photoIds)?[...new Set(b.photoIds)]:[];ensure(b.kind==='room'?photoIds.length>=1:photoIds.length===1,b.kind==='room'?'请至少上传一张房子照片':'请上传一张个人照片');for(const id of photoIds){ensure(typeof id==='string'&&tokenOK(id),'照片标识无效');ensure(await db.first('SELECT id FROM pilot_uploads WHERE id=? AND receipt_hash=?',id,receiptHash),'照片未上传或不属于本次登记');}
   await db.throttle('pilot-lead:'+request.headers.get('cf-connecting-ip'),12,3600);await cleanup();const id=crypto.randomUUID(),now=timestamp();
   await db.run('INSERT INTO pilot_leads (id,receipt_hash,session_id,kind,city,district,budget,move_in,note,housing,photo_ids,nickname,contact_type,contact_value,source,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,receiptHash,b.sessionId,b.kind,b.city,b.district,b.budget,b.moveIn,note,JSON.stringify(housing),JSON.stringify(photoIds),nickname,b.contactType,contact,source(b.source),'new',now,now);await removeUploads(await db.all('SELECT id,object_key FROM pilot_uploads WHERE receipt_hash=? AND id NOT IN ('+photoIds.map(()=>'?').join(',')+')',receiptHash,...photoIds));return response({id},201);
  }
  const lead=path.match(/^leads\/([a-zA-Z0-9-]+)$/);
  if(lead&&method==='DELETE'){
   const b=await body();ensure(tokenOK(b.receiptToken),'撤回凭证无效');const receiptHash=await db.sha(b.receiptToken),row=await db.first('SELECT id FROM pilot_leads WHERE id=? AND receipt_hash=?',lead[1],receiptHash);ensure(row,'登记不存在或撤回凭证无效',404);await removeUploads(await db.all('SELECT id,object_key FROM pilot_uploads WHERE receipt_hash=?',receiptHash));await db.run('DELETE FROM pilot_leads WHERE id=?',lead[1]);return response({ok:true});
  }
  if(path==='admin'&&method==='GET'){
   operator();await cleanup();const since=new Date(Date.now()-7*86400000).toISOString();const events=await db.all('SELECT event,COUNT(DISTINCT session_id) AS sessions FROM pilot_events WHERE created_at>=? AND source<>? GROUP BY event',since,'test');const sources=await db.all('SELECT source,COUNT(*) AS leads FROM pilot_leads WHERE created_at>=? AND source<>? GROUP BY source',since,'test');const stages=await db.all('SELECT status,COUNT(*) AS leads FROM pilot_leads WHERE created_at>=? AND source<>? GROUP BY status',since,'test');const leads=await db.all('SELECT id,kind,city,district,budget,move_in,note,housing,photo_ids,nickname,contact_type,contact_value,source,status,created_at FROM pilot_leads ORDER BY created_at DESC LIMIT 200');return response({events,sources,stages,leads});
  }
  if(lead&&method==='PUT'){
   const b=await body();operator();ensure(STAGES.includes(b.status),'跟进状态无效');ensure(await db.first('SELECT id FROM pilot_leads WHERE id=?',lead[1]),'登记不存在',404);await db.run('UPDATE pilot_leads SET status=?,updated_at=? WHERE id=?',b.status,timestamp(),lead[1]);return response({ok:true});
  }
  return response({error:{message:'接口不存在'}},404);
 }catch(e){if(e instanceof PilotError)return response({error:{message:e.message}},e.status);throw e}
}
