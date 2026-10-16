import {pilotUploadGuard} from './pilot-write-guard';
import {pilotAudience} from './pilot-audience';
import {env,waitUntil} from 'cloudflare:workers';
import {recordContactView} from './contact-access';
import {CITIES,districtsFor} from './cities';
import {PILOT_HOUSING_STATES,type PilotHousing} from './pilot-housing';

type Row=Record<string,any>;
type DB={batch:(statements:{sql:string;args:any[]}[])=>Promise<any[]>;all:(sql:string,...args:any[])=>Promise<Row[]>;first:(sql:string,...args:any[])=>Promise<Row|null>;run:(sql:string,...args:any[])=>Promise<unknown>;throttle:(key:string,limit:number,seconds:number)=>Promise<void>;sha:(s:string)=>Promise<string>;publish:(sql:string,args:any[],id:string,userId:string,guard?:{sql:string;args:any[]})=>Promise<boolean>};
class PilotError extends Error{constructor(public status:number,message:string){super(message)}}
const ensure=(ok:unknown,message:string,status=400)=>{if(!ok)throw new PilotError(status,message)};
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const tokenOK=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{32,64}$/.test(v);
const SOURCES=['direct','wechat_group','friend','colleague','xiaohongshu','douyin','test'];
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
  const cleanup=async()=>{const cutoff=new Date(Date.now()-30*86400000).toISOString(),orphanCutoff=new Date(Date.now()-86400000).toISOString();await removeUploads(await db.all('SELECT id,object_key FROM pilot_uploads WHERE created_at<? OR (created_at<? AND NOT EXISTS (SELECT 1 FROM pilot_leads WHERE pilot_leads.receipt_hash=pilot_uploads.receipt_hash))',cutoff,orphanCutoff));await db.run('DELETE FROM pilot_leads WHERE created_at<?',cutoff);await db.run('DELETE FROM pilot_events WHERE created_at<?',cutoff);await db.run('DELETE FROM contact_views WHERE created_at<?',cutoff)};
  const operator=()=>{const owner=(env as unknown as {PILOT_OWNER_EMAIL?:string}).PILOT_OWNER_EMAIL;ensure(user?.role==='admin'||(owner&&request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===owner.toLowerCase()),'运营看板仅项目负责人可访问，请使用负责人账号登录',403)};
  if(path==='uploads'&&method==='POST'){
   await db.throttle(user?'pilot-upload-user:'+user.id:'pilot-upload:'+request.headers.get('cf-connecting-ip'),user?400:40,3600);const form=await request.formData();const receiptToken=form.get('receiptToken');ensure(tokenOK(receiptToken)&&tokenOK(form.get('sessionId')),'上传凭证无效');ensure(form.get('adult')==='true'&&form.get('consent')==='true','请确认年龄及照片使用范围');const receiptHash=await db.sha(String(receiptToken));ensure(!await db.first('SELECT id FROM pilot_leads WHERE receipt_hash=?',receiptHash),'本次登记已提交，请勿重复上传');
   const file=form.get('file');ensure(file instanceof File,'请选择照片');const photo=file as File;ensure(photo.size>0&&photo.size<=5*1024*1024,'每张照片需小于5MB');ensure(['image/jpeg','image/png','image/webp'].includes(photo.type),'只支持JPEG、PNG或WebP照片');const data=await photo.arrayBuffer(),h=new Uint8Array(data);ensure((photo.type==='image/jpeg'&&h[0]===255&&h[1]===216&&h[2]===255)||(photo.type==='image/png'&&h[0]===137&&h[1]===80&&h[2]===78&&h[3]===71)||(photo.type==='image/webp'&&String.fromCharCode(...h.slice(0,4))==='RIFF'&&String.fromCharCode(...h.slice(8,12))==='WEBP'),'照片格式与内容不符');ensure(bucket,'照片存储暂不可用',503);const id=crypto.randomUUID(),key=`pilot/${receiptHash}/${id}`;await bucket.put(key,data,{httpMetadata:{contentType:photo.type}});try{await db.run('INSERT INTO pilot_uploads (id,receipt_hash,object_key,content_type,created_at) VALUES (?,?,?,?,?)',id,receiptHash,key,photo.type,timestamp())}catch(e){await bucket.delete(key);throw e}return response({id},201);
  }
  const publicPhotoRoute=path.match(/^photos\/public\/([a-zA-Z0-9-]+)$/);
  if(publicPhotoRoute&&method==='GET'){
   const visibility=pilotAudience(user?.id,'l');const row=await db.first("SELECT u.* FROM pilot_uploads u JOIN pilot_leads l ON l.receipt_hash=u.receipt_hash WHERE u.id=? AND (EXISTS (SELECT 1 FROM json_each(l.photo_ids) WHERE value=u.id) OR l.avatar='/api/v1/pilot/photos/public/'||u.id) AND l.source<>'test' AND json_extract(l.housing,'$.public')=1 AND l.status NOT IN ('invalid','matched') AND l.created_at>=?"+visibility.clause,publicPhotoRoute[1],new Date(Date.now()-30*86400000).toISOString(),...visibility.args);ensure(row,'照片不存在',404);ensure(bucket,'照片存储暂不可用',503);const object=await bucket.get(row!.object_key);ensure(object,'照片不存在',404);return new Response(object!.body,{headers:{'Content-Type':row!.content_type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
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
  const editRoute=path.match(/^leads\/([a-zA-Z0-9-]+)\/content$/);
  let editingLead:Row|null=null;
  if(editRoute){ensure(user,'请先登录后管理帖子',401);editingLead=await db.first("SELECT * FROM pilot_leads WHERE id=? AND user_id=? AND source<>'test' AND json_extract(housing,'$.public')=1 AND status NOT IN ('invalid','matched') AND created_at>=?",editRoute[1],user!.id,new Date(Date.now()-30*86400000).toISOString());ensure(editingLead,'帖子不存在或不能修改',404);
   if(method==='GET'){const row=editingLead!,h=JSON.parse(row.housing);return response({id:row.id,updatedAt:row.updated_at,data:{city:row.city,district:row.district,kind:row.kind,title:row.title,gender:row.gender,budget:String(row.budget),moveIn:row.move_in,minLeaseMonths:row.min_lease_months===null?'':String(row.min_lease_months),preferredGender:row.preferred_gender,note:row.note,coRentalRules:row.co_rental_rules,roommateExpectations:row.roommate_expectations,nickname:row.nickname,occupation:row.occupation,contactType:row.contact_type,contact:row.contact_value,contactVisibility:row.contact_visibility},housing:{...h,bedrooms:String(h.bedrooms||2),bathrooms:String(h.bathrooms||1),area:String(h.area||''),roomsAvailable:String(h.roomsAvailable||1)},photoIds:JSON.parse(row.photo_ids),avatar:row.avatar});}
   if(method==='DELETE'){await removeUploads(await db.all('SELECT id,object_key FROM pilot_uploads WHERE receipt_hash=?',editingLead!.receipt_hash));await db.run('DELETE FROM pilot_leads WHERE id=? AND user_id=?',editingLead!.id,user!.id);return response({ok:true});}
   ensure(method==='PUT','操作不支持',405);
  }
  if(path==='leads'&&method==='POST'||editRoute&&method==='PUT'){
   ensure(user,'请先登录后发布，每个账号共用每日发帖额度',401);const b=await body();if(editingLead){ensure(b.kind===editingLead.kind,'不能修改帖子类型');ensure(b.updatedAt===editingLead.updated_at,'帖子已被修改，请重新打开后再编辑',409);}ensure(tokenOK(b.receiptToken)&&tokenOK(b.sessionId),'登记标识无效');ensure(CITIES.includes(b.city),'请选择已开放城市');ensure(districtsFor(b.city).slice(1).includes(b.district),'请选择该城市的区域');ensure(['room','seeker'].includes(b.kind),'请选择有房或求租');ensure(Number.isInteger(b.budget)&&b.budget>=1&&b.budget<=50000,'请填写1至50000元的月租或预算');
   const minLeaseMonths=b.minLeaseMonths===undefined?null:b.minLeaseMonths;ensure(minLeaseMonths===null&&b.minLeaseMonths===undefined||Number.isInteger(minLeaseMonths)&&minLeaseMonths>=1&&minLeaseMonths<=60,'起租月数须为1到60的整数');const preferredGender=b.preferredGender===undefined?'不限':b.preferredGender;ensure(['男','女','不限'].includes(preferredGender),'请选择有效的性别要求');
   const moveIn=text(b.moveIn,40),title=text(b.title,80);ensure(moveIn.length>0,'请填写大致入住时间');ensure(title.length>=2,'帖子标题至少2个字');ensure(['男','女','其他','不透露'].includes(b.gender),'请选择你的性别');
   ensure(b.adult===true,'试点仅面向年满18岁的用户');ensure(b.consent===true,'请确认联系方式的使用范围');ensure(b.publicConsent===true,'请确认公开展示范围');ensure(['operator','members'].includes(b.contactVisibility),'请选择联系方式展示范围');const occupation=b.kind==='room'?text(b.occupation,40):'';ensure(b.kind!=='room'||occupation.length>0,'请填写你的职业');const nickname=text(b.nickname,30);ensure(nickname.length>=1,'请填写怎么称呼你');ensure(['wechat','phone'].includes(b.contactType),'请选择一种联系方式');const contact=text(b.contact,40);ensure(b.contactType==='phone'?/^1[3-9]\d{9}$/.test(contact):/^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/.test(contact),'请填写有效的手机号或微信号');
   // Omitted post-content fields keep already-open legacy forms working; introductions now live in the account.
   const contentFields=(b.kind==='room'?['coRentalRules','roommateExpectations']:['roommateExpectations']);for(const key of contentFields)ensure(b[key]===undefined||typeof b[key]==='string'&&b[key].trim().length>=4&&b[key].trim().length<=500,'合租要求和室友期待须分别填写4至500个字');const personalIntro='',coRentalRules=b.kind==='room'?text(b.coRentalRules,500):'',roommateExpectations=text(b.roommateExpectations,500);
   const note=text(b.note,500);ensure(note.length>=4,'请简单说明住房或室友需求');ensure(!text(b.website,100),'提交未通过');const receiptHash=await db.sha(b.receiptToken);const existing=editingLead?null:await db.first('SELECT id,source FROM pilot_leads WHERE receipt_hash=?',receiptHash);if(existing)return response({id:existing.id,duplicate:true,published:existing.source!=='test'});
   let housing:Partial<PilotHousing>={};if(b.kind==='room'){const h=b.housing;ensure(h&&typeof h==='object','请填写房子基本信息');ensure(text(h.community,80).length>=2,'请填写小区或公寓名称');ensure(Object.hasOwn(PILOT_HOUSING_STATES,h.housingState),'请选择房源状态');ensure([2,3].includes(h.bedrooms),'仅支持原始两居或三居');ensure(Number.isInteger(h.bathrooms)&&h.bathrooms>=1&&h.bathrooms<=3,'请选择卫生间数量');ensure(Number.isFinite(h.area)&&h.area>=1&&h.area<=1000,'请填写有效的整套面积');ensure(Number.isInteger(h.roomsAvailable)&&h.roomsAvailable>=1&&h.roomsAvailable<=h.bedrooms,'请选择可合租卧室数量');ensure(h.originalLayout===true,'仅支持无新增隔断的原始户型');const amenities:string[]=Array.isArray(h.amenities)?[...new Set<string>(h.amenities.map((v:unknown)=>text(v,20)).filter((v:string)=>Boolean(v)))].slice(0,30):[];ensure(amenities.length>=1,'请至少选择或添加一项房屋设施');housing={community:text(h.community,80),housingState:h.housingState,bedrooms:h.bedrooms,bathrooms:h.bathrooms,area:h.area,roomsAvailable:h.roomsAvailable,originalLayout:true,amenities};}

   const publicHousing={...housing,public:true};const photoIds=Array.isArray(b.photoIds)?[...new Set(b.photoIds)]:[];ensure(b.kind!=='room'||photoIds.length>=1,'请至少上传一张房子照片');ensure(photoIds.length<=12,'最多上传12张展示照片');for(const id of photoIds)ensure(typeof id==='string'&&tokenOK(id),'照片标识无效');
   if(editingLead){const bound=await db.first('SELECT id FROM pilot_leads WHERE receipt_hash=?',receiptHash);ensure(!bound||bound.id===editingLead.id,'不能使用其他帖子的图片凭证，请重新打开编辑',409);}
   const owned=await db.all('SELECT id FROM pilot_uploads WHERE receipt_hash IN (?,?)',receiptHash,editingLead?.receipt_hash||receiptHash);const ownedIds=new Set(owned.map(row=>row.id));ensure(photoIds.every(id=>ownedIds.has(id)),'照片未上传或不属于本次登记');const avatarId=text(b.avatarId,64);ensure(!avatarId||ownedIds.has(avatarId),'头像未上传或不属于本次登记');const avatar=avatarId?`/api/v1/pilot/photos/public/${avatarId}`:editingLead&&!b.resetAvatar?editingLead.avatar:`/avatars/${b.gender==='男'?'male':b.gender==='女'?'female':Math.random()<.5?'male':'female'}-${Math.random()<.5?1:2}.svg`;
   const uploadGuard=pilotUploadGuard(photoIds as string[],avatarId,receiptHash,editingLead?.receipt_hash||receiptHash,editingLead?.id||'');
   if(editingLead){await db.throttle('pilot-edit:'+user!.id,120,3600);const now=new Date(Math.max(Date.now(),Date.parse(editingLead.updated_at)+1)).toISOString();const changes={city:b.city,district:b.district,budget:b.budget,move_in:moveIn,min_lease_months:minLeaseMonths,preferred_gender:preferredGender,note,co_rental_rules:coRentalRules,roommate_expectations:roommateExpectations,housing:JSON.stringify(publicHousing),photo_ids:JSON.stringify(photoIds),nickname,occupation,title,gender:b.gender,avatar,contact_type:b.contactType,contact_value:contact,contact_visibility:b.contactVisibility,updated_at:now};const results=await db.batch([{sql:'UPDATE pilot_leads SET '+Object.keys(changes).map(k=>k+'=?').join(',')+" WHERE id=? AND user_id=? AND updated_at=? AND status NOT IN ('invalid','matched') AND NOT EXISTS (SELECT 1 FROM pilot_leads other WHERE other.receipt_hash=? AND other.id<>?) AND ("+uploadGuard.sql+")",args:[...Object.values(changes),editingLead.id,user!.id,b.updatedAt,receiptHash,editingLead.id,...uploadGuard.args]},{sql:"UPDATE pilot_uploads SET receipt_hash=? WHERE receipt_hash=? AND EXISTS (SELECT 1 FROM pilot_leads l WHERE l.id=? AND l.user_id=? AND l.updated_at=? AND (EXISTS (SELECT 1 FROM json_each(l.photo_ids) WHERE value=pilot_uploads.id) OR l.avatar='/api/v1/pilot/photos/public/'||pilot_uploads.id))",args:[editingLead.receipt_hash,receiptHash,editingLead.id,user!.id,now]}]);ensure(results[0]?.meta?.changes,'帖子已被修改或撤回，请重新打开后再编辑',409);return response({id:editingLead.id,updatedAt:now,published:true});}
   await db.throttle('pilot-lead-user:'+user!.id,60,3600);const id=crypto.randomUUID(),now=timestamp();
   const published=await db.publish('INSERT INTO pilot_leads (id,receipt_hash,session_id,kind,city,district,budget,move_in,min_lease_months,preferred_gender,note,personal_intro,co_rental_rules,roommate_expectations,housing,photo_ids,nickname,occupation,title,gender,avatar,user_id,contact_type,contact_value,contact_visibility,source,status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM publication_events WHERE id=?)',[id,receiptHash,b.sessionId,b.kind,b.city,b.district,b.budget,moveIn,minLeaseMonths,preferredGender,note,personalIntro,coRentalRules,roommateExpectations,JSON.stringify(publicHousing),JSON.stringify(photoIds),nickname,occupation,title,b.gender,avatar,user!.id,b.contactType,contact,b.contactVisibility,source(b.source),'new',now,now,id],id,user!.id,uploadGuard);if(!published){ensure(await db.first('SELECT 1 WHERE '+uploadGuard.sql,...uploadGuard.args),'图片已被其他帖子使用，请重新选择图片后发布',409);ensure(false,'今日发帖额度已用完；普通账号3帖，会员30帖，请明天再试或查看会员',429);}waitUntil((async()=>{const unused=await db.all('SELECT id,object_key FROM pilot_uploads WHERE receipt_hash=?',receiptHash);await removeUploads(unused.filter(row=>!photoIds.includes(row.id)&&row.id!==avatarId));await cleanup()})().catch(()=>console.error('Pilot deferred cleanup failed')));return response({id,published:source(b.source)!=='test'},201);
  }
  const claim=path.match(/^leads\/([a-zA-Z0-9-]+)\/claim$/);
  if(claim&&method==='POST'){ensure(user,'请先登录后绑定帖子',401);const b=await body();ensure(tokenOK(b.receiptToken),'管理凭证无效');await db.throttle('pilot-claim:'+user!.id,90,3600);const hash=await db.sha(b.receiptToken),row=await db.first('SELECT id,user_id FROM pilot_leads WHERE id=? AND receipt_hash=?',claim[1],hash);ensure(row,'帖子不存在或管理凭证无效',404);ensure(!row!.user_id||row!.user_id===user!.id,'这条帖子已绑定其他账号，不能转移',409);const result=await db.run('UPDATE pilot_leads SET user_id=?,updated_at=? WHERE id=? AND receipt_hash=? AND (user_id IS NULL OR user_id=?)',user!.id,timestamp(),row!.id,hash,user!.id) as any;ensure(result?.meta?.changes,'帖子已绑定其他账号，请刷新',409);return response({ok:true});}
  const contactRoute=path.match(/^leads\/([a-zA-Z0-9-]+)\/contact$/);
  if(contactRoute&&method==='POST'){
   ensure(user,'请先登录后查看联系方式',401);
   const cutoff=new Date(Date.now()-30*86400000).toISOString(),visibility=pilotAudience(user!.id);
   const row=await db.first("SELECT * FROM pilot_leads WHERE id=? AND source<>'test' AND json_extract(housing,'$.public')=1 AND created_at>=? AND status NOT IN ('invalid','matched')"+visibility.clause,contactRoute[1],cutoff,...visibility.args);
   ensure(row,'帖子不存在或已撤回',404);ensure(row!.contact_visibility==='members','发布者未开放直接联系，联系方式仅运营可见',403);
   ensure(await recordContactView(request,user!.id,row!.contact_type+':'+row!.contact_value,db),'今日查看额度已用完（普通账号5人，会员50人）；已查看的可重复查看，可前往会员页了解',429);
   return response({phone:row!.contact_type==='phone'?row!.contact_value:'',wechat:row!.contact_type==='wechat'?row!.contact_value:''});
  }
  const settingsRoute=path.match(/^leads\/([a-zA-Z0-9-]+)\/contact-settings$/);
  if(settingsRoute&&(method==='POST'||method==='PUT')){
   const b=await body();ensure(tokenOK(b.receiptToken),'管理凭证无效');
   await db.throttle('pilot-settings:'+request.headers.get('cf-connecting-ip'),30,60);
   const row=await db.first('SELECT id,contact_visibility FROM pilot_leads WHERE id=? AND receipt_hash=?',settingsRoute[1],await db.sha(b.receiptToken));
   ensure(row,'登记不存在或管理凭证无效',404);
   if(method==='PUT'){
    ensure(['operator','members'].includes(b.contactVisibility),'请选择联系方式展示范围');
    await db.run('UPDATE pilot_leads SET contact_visibility=?,updated_at=? WHERE id=?',b.contactVisibility,timestamp(),row!.id);
   }
   return response({contactVisibility:method==='PUT'?b.contactVisibility:row!.contact_visibility});
  }
  const lead=path.match(/^leads\/([a-zA-Z0-9-]+)$/);
  if(lead&&method==='DELETE'){
   const b=await body();ensure(tokenOK(b.receiptToken),'撤回凭证无效');const receiptHash=await db.sha(b.receiptToken),row=await db.first('SELECT id FROM pilot_leads WHERE id=? AND receipt_hash=?',lead[1],receiptHash);ensure(row,'登记不存在或撤回凭证无效',404);await removeUploads(await db.all('SELECT id,object_key FROM pilot_uploads WHERE receipt_hash=?',receiptHash));await db.run('DELETE FROM pilot_leads WHERE id=?',lead[1]);return response({ok:true});
  }
  if(path==='admin'&&method==='GET'){
   operator();await cleanup();const since=new Date(Date.now()-7*86400000).toISOString();const events=await db.all('SELECT event,COUNT(DISTINCT session_id) AS sessions FROM pilot_events WHERE created_at>=? AND source<>? GROUP BY event',since,'test');const sources=await db.all('SELECT source,COUNT(*) AS leads FROM pilot_leads WHERE created_at>=? AND source<>? GROUP BY source',since,'test');const stages=await db.all('SELECT status,COUNT(*) AS leads FROM pilot_leads WHERE created_at>=? AND source<>? GROUP BY status',since,'test');const leads=await db.all('SELECT id,kind,city,district,budget,move_in,note,housing,photo_ids,nickname,occupation,contact_type,contact_value,contact_visibility,source,status,created_at FROM pilot_leads ORDER BY created_at DESC LIMIT 200');return response({events,sources,stages,leads});
  }
  if(lead&&method==='PUT'){
   const b=await body();operator();ensure(STAGES.includes(b.status),'跟进状态无效');ensure(await db.first('SELECT id FROM pilot_leads WHERE id=?',lead[1]),'登记不存在',404);await db.run('UPDATE pilot_leads SET status=?,updated_at=? WHERE id=?',b.status,timestamp(),lead[1]);return response({ok:true});
  }
  return response({error:{message:'接口不存在'}},404);
 }catch(e){if(e instanceof PilotError)return response({error:{message:e.message}},e.status);throw e}
}
