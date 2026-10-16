type Row=Record<string,any>;
type Store={first:(sql:string,...args:any[])=>Promise<Row|null>;all:(sql:string,...args:any[])=>Promise<Row[]>;run:(sql:string,...args:any[])=>Promise<any>;batch:(queries:{sql:string;args:any[]}[])=>Promise<any[]>;throttle:(key:string,limit:number,seconds:number)=>Promise<void>;sha:(value:string)=>Promise<string>};
export type SafetyConfig={OPERATOR_NAME?:string;SUPPORT_EMAIL?:string;RESEND_API_KEY?:string;MAIL_FROM?:string;RESET_PUBLIC_ORIGIN?:string};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const mailReady=(config:SafetyConfig)=>Boolean(config.RESEND_API_KEY&&config.MAIL_FROM);
const emailOK=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const passwordOK=(value:unknown):value is string=>typeof value==='string'&&value.length>=8&&value.length<=128&&/[A-Za-z]/.test(value)&&/[0-9]/.test(value);
// Dependencies keep storage transactions and outbound email testable without production bypasses.
export async function handleAccountSafety(request:Request,path:string,user:Row|null,store:Store,config:SafetyConfig,hashPassword:(password:string,salt:string)=>Promise<string>,operator=false,send:typeof fetch=fetch):Promise<Response|null>{
 const method=request.method;
 const fail=(message:string,status=400)=>reply({error:{message,code:status===401?'session_invalid':'request_error'}},status);
 const read=async():Promise<Row|null>=>{const raw=await request.text();if(raw.length>12000)return null;try{const value=JSON.parse(raw);return value&&typeof value==='object'&&!Array.isArray(value)?value:null}catch{return null}};
 if(path==='service-info'&&method==='GET')return reply({operatorName:config.OPERATOR_NAME||'',supportEmail:emailOK(config.SUPPORT_EMAIL||'')?config.SUPPORT_EMAIL:'',passwordResetAvailable:mailReady(config)});
 if(path==='auth/forgot-password'&&method==='POST'){
  if(!mailReady(config))return fail('邮箱找回暂未开放，请通过帮助与反馈联系运营。',503);
  const b=await read();if(!b)return fail('请求格式不正确或内容过长');const email=String(b.email||'').trim().toLowerCase();
  if(!emailOK(email)||email.length>254)return fail('请填写有效邮箱');
  await store.throttle('reset-ip:'+request.headers.get('cf-connecting-ip'),10,3600);
  await store.throttle('reset-email:'+email,3,900);
  const account=await store.first('SELECT id,password_hash FROM users WHERE email=? AND suspended=0',email);
  // Same response for absent accounts and delivery failures. Never expose account existence or the reset token.
  if(account){
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join(''),tokenHash=await store.sha(token),created=new Date().toISOString();
   const origin=new URL(config.RESET_PUBLIC_ORIGIN||'https://yiqizu-guiyang.coppershark1.chatgpt.site');
   if(origin.protocol!=='https:'||origin.username||origin.password)return fail('邮箱找回配置尚未完成',503);
   await store.run('DELETE FROM password_resets WHERE expires_at<?',created);
   await store.run('INSERT INTO password_resets (token_hash,user_id,password_snapshot,expires_at,created_at) VALUES (?,?,?,?,?)',tokenHash,account.id,account.password_hash,new Date(Date.now()+15*60000).toISOString(),created);
   const link=origin.origin+'/#reset='+token;
   try{
    const result=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:config.MAIL_FROM,to:[email],subject:'一起租：重置密码',text:`你申请了重置一起租账户密码。请在15分钟内打开下方链接，链接只能使用一次：\n${link}\n\n若非本人操作，请忽略本邮件。请勿转发链接或向任何人提供它。`})});
    if(!result.ok)throw new Error('Email delivery failed');
   }catch{await store.run('DELETE FROM password_resets WHERE token_hash=?',tokenHash);console.error('Password reset email delivery failed');}
  }
  return reply({message:'如果该邮箱已注册且可接收邮件，你将收到有效期15分钟的重置链接。未收到时请检查垃圾箱，稍后重试或联系运营。'});
 }
 if(path==='auth/reset-password'&&method==='POST'){
  await store.throttle('reset-confirm:'+request.headers.get('cf-connecting-ip'),20,900);
  const b=await read();if(!b)return fail('请求格式不正确或内容过长');if(!passwordOK(b.password))return fail('新密码至少8个字符，须包含字母和数字');
  if(typeof b.token!=='string'||b.token.length<32||b.token.length>128)return fail('重置链接无效或已过期，请重新申请');
  const hash=await store.sha(b.token),at=new Date().toISOString();
  const token=await store.first('SELECT r.* FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.token_hash=? AND r.used_at IS NULL AND r.expires_at>? AND u.suspended=0 AND u.password_hash=r.password_snapshot',hash,at);
  if(!token)return fail('重置链接无效或已过期，请重新申请');
  const salt=crypto.randomUUID(),password=await hashPassword(b.password,salt),claim=crypto.randomUUID();
  // D1 batch is atomic. Only one concurrent request may claim a token, including across different tokens for the same old password.
  const results=await store.batch([
   {sql:'UPDATE password_resets SET used_at=?,claim=? WHERE token_hash=? AND used_at IS NULL AND expires_at>? AND EXISTS (SELECT 1 FROM users u WHERE u.id=password_resets.user_id AND u.suspended=0 AND u.password_hash=password_resets.password_snapshot)',args:[at,claim,hash,at]},
   {sql:'UPDATE users SET password_hash=?,salt=? WHERE id=? AND EXISTS (SELECT 1 FROM password_resets WHERE token_hash=? AND claim=?)',args:[password,salt,token.user_id,hash,claim]},
   {sql:'DELETE FROM sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM password_resets WHERE token_hash=? AND claim=?)',args:[token.user_id,hash,claim]},
  ]);
  if(!results[0]?.meta?.changes)return fail('重置链接无效或已过期，请重新申请');
  return reply({ok:true,message:'密码已重置，所有设备已退出，请重新登录。'});
 }
 if(path==='feedback'&&method==='POST'){
  await store.throttle('feedback:'+request.headers.get('cf-connecting-ip'),5,3600);
  const b=await read();if(!b)return fail('请求格式不正确或内容过长');const category=String(b.category||''),content=String(b.content||'').trim(),contact=String(b.contact||'').trim();
  if(!['bug','content','privacy','account','other'].includes(category)||content.length<5||content.length>2000||contact.length<3||contact.length>200)return fail('请选择问题类型，填写5至2000字说明和有效的回复联系方式');
  const id=crypto.randomUUID();await store.run('INSERT INTO support_requests (id,user_id,category,content,contact,status,created_at) VALUES (?,?,?,?,?,\'open\',?)',id,user?.id||null,category,content,contact,new Date().toISOString());
  return reply({id,message:'反馈已提交。请保留编号，运营核实后将通过你填写的联系方式回复。'},201);
 }
 if(path==='admin/feedback'&&(method==='GET'||method==='PUT')){
  if(!operator&&user?.role!=='admin')return fail(user?'需要运营权限':'请先登录后继续',user?403:401);
  if(method==='GET')return reply({items:await store.all('SELECT id,user_id,category,content,contact,status,created_at FROM support_requests ORDER BY created_at DESC LIMIT 200')});
  const b=await read();if(!b)return fail('请求格式不正确或内容过长');if(typeof b.id!=='string'||!['open','resolved'].includes(b.status))return fail('处理结果无效');
  const result=await store.run('UPDATE support_requests SET status=? WHERE id=?',b.status,b.id);if(!result.meta?.changes)return fail('反馈不存在',404);return reply({ok:true});
 }
 return null;
}
