import {randomBytes,createHash,pbkdf2,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import type {Actor} from '../shared/contracts';
import type {Profile} from '../shared/business-contracts';
import type {Database} from './database';
import {profileOf,type UserRecord} from './profile';
import {ApiError,unauthorized} from './errors';
import {object,ensure} from '../shared/rules';
const derive=promisify(pbkdf2),iterations=100000;
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
function credentials(input:unknown){const b=object(input);ensure(typeof b.email==='string'&&b.email.length<=254,'邮箱');const email=b.email.trim().toLowerCase();ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'邮箱');ensure(typeof b.password==='string'&&b.password.length>=8&&b.password.length<=128&&/[a-zA-Z]/.test(b.password)&&/\d/.test(b.password),'密码需8–128位且含字母和数字');return {email,password:b.password}}
export type AuthSession={token:string;profile:Profile};
export class AuthService{
 constructor(private db:Database,private admins:readonly string[]){}
 private async limit(email:string,identity:string){
  if(!identity||identity.length>512)throw new ApiError(503,'TRANSPORT_IDENTITY_UNAVAILABLE','登录服务尚未就绪，请稍后再试');
  await this.db.call('cn_auth_limit',{p_source_hash:hashToken('source:'+identity),p_account_hash:hashToken('email:'+email)});
 }
 async register(input:unknown,identity:string):Promise<AuthSession>{
  const {email,password}=credentials(input);await this.limit(email,identity);
  const salt=randomBytes(16).toString('hex'),passwordHash=(await derive(password,salt,iterations,32,'sha256')).toString('hex'),token=randomBytes(32).toString('hex');
  const row=await this.db.call<UserRecord>('cn_auth_register',{p_email:email,p_hash:passwordHash,p_salt:salt,p_token_hash:hashToken(token),p_expires:new Date(Date.now()+7*86400000).toISOString(),p_admin:this.admins.includes(email)});
  return {token,profile:profileOf(row)};
 }
 async login(input:unknown,identity:string):Promise<AuthSession>{
  const {email,password}=credentials(input);await this.limit(email,identity);
  const row=await this.db.call<Partial<UserRecord>>('cn_auth_user',{p_email:email});
  // Missing accounts still pay the same PBKDF2 baseline; never return hash/salt.
  const actual=await derive(password,row.password_salt??'0'.repeat(32),row.password_iterations??iterations,32,'sha256');
  if(!row.id||row.disabled||!row.password_hash||!timingSafeEqual(actual,Buffer.from(row.password_hash,'hex')))throw unauthorized();
  const token=randomBytes(32).toString('hex');
  const user=await this.db.call<UserRecord>('cn_auth_session_create',{p_user_id:row.id,p_expected_hash:row.password_hash,p_token_hash:hashToken(token),p_expires:new Date(Date.now()+7*86400000).toISOString()});
  if(!user.id)throw unauthorized();return {token,profile:profileOf(user)};
 }
 async resolveActor(token?:string):Promise<Actor|null>{
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const a=await this.db.call<{userId?:string;role?:'user'|'admin'}>('cn_auth_resolve',{p_token_hash:hashToken(token)});return a.userId&&a.role?{userId:a.userId,role:a.role}:null;
 }
 async logout(token:string){if(/^[a-f0-9]{64}$/.test(token))await this.db.call('cn_auth_logout',{p_token_hash:hashToken(token)})}
 async changePassword(actor:Actor,input:unknown){
  const b=object(input);ensure(typeof b.oldPassword==='string'&&b.oldPassword.length<=128,'原密码');
  const row=await this.db.call<UserRecord>('cn_profile_get',{p_user_id:actor.userId});
  await this.limit(row.email,'password-change:'+actor.userId);
  const {password}=credentials({email:row.email,password:b.password});
  // Fetch server-only password material through an explicit internal RPC.
  const secret=await this.db.call<UserRecord>('cn_auth_user',{p_email:row.email});
  const old=await derive(b.oldPassword,secret.password_salt!,secret.password_iterations!,32,'sha256');
  if(!timingSafeEqual(old,Buffer.from(secret.password_hash!,'hex')))throw unauthorized();
  const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt,iterations,32,'sha256')).toString('hex');
  const result=await this.db.call<{changed:boolean}>('cn_auth_change_password',{p_user_id:actor.userId,p_expected_hash:secret.password_hash,p_hash:hash,p_salt:salt});if(!result.changed)throw unauthorized();
 }
}
