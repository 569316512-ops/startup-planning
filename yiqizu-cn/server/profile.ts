import type {Database} from './database';
import type {Actor} from '../shared/contracts';
import type {Profile,Gender} from '../shared/business-contracts';
import {object,text,choice,integer,ensure,UUID} from '../shared/rules';
import {CITY_CONFIG} from '../shared/cities';
import {domainError} from './errors';
export type UserRecord={id:string;email:string;role:'user'|'admin';disabled:boolean;profile:Partial<Profile>;avatar_upload_id:string|null;password_hash?:string;password_salt?:string;password_iterations?:number};
export function profileOf(row:UserRecord):Profile{
 const p=row.profile;
 return {id:row.id,email:row.email,isAdmin:row.role==='admin',nickname:p.nickname??'新用户',occupation:p.occupation??'',gender:p.gender??'不透露',city:p.city??'贵阳',district:p.district??'',budget:p.budget??null,moveIn:p.moveIn??'',leaseMonths:p.leaseMonths??null,bio:p.bio??'',roommateExpectations:p.roommateExpectations??'',housingPreferences:p.housingPreferences??'',avatarUploadId:row.avatar_upload_id,contact:{wechat:p.contact?.wechat??'',phone:p.contact?.phone??''}};
}
export class ProfileService{
 constructor(private db:Database){}
 async get(actor:Actor):Promise<Profile>{const row=await this.db.call<UserRecord>('cn_profile_get',{p_user_id:actor.userId});if(!row.id)domainError('NOT_FOUND');return profileOf(row)}
 async update(actor:Actor,input:unknown):Promise<Profile>{
  const raw=object(input),patch:Record<string,unknown>={};
  for(const [key,max] of Object.entries({nickname:30,occupation:40,city:10,district:20,moveIn:40,bio:500,roommateExpectations:500,housingPreferences:500}))if(Object.hasOwn(raw,key))patch[key]=text(raw[key],key,0,max);
  if(Object.hasOwn(raw,'gender'))patch.gender=choice<Gender>(raw.gender,['男','女','其他','不透露'],'性别');
  for(const [key,max] of [['budget',50000],['leaseMonths',60]] as const)if(Object.hasOwn(raw,key))patch[key]=raw[key]===null?null:integer(raw[key],key,1,max);
  if(Object.hasOwn(raw,'city'))ensure(typeof patch.city==='string'&&Object.hasOwn(CITY_CONFIG,patch.city),'城市');
  if(Object.hasOwn(raw,'avatarUploadId')){ensure(raw.avatarUploadId===null||typeof raw.avatarUploadId==='string'&&UUID.test(raw.avatarUploadId),'头像');patch.avatarUploadId=raw.avatarUploadId}
  if(Object.hasOwn(raw,'contact')){
   const c=object(raw.contact),contact:Record<string,string>={};
   for(const key of ['phone','wechat'])if(Object.hasOwn(c,key)){const v=text(c[key],key,0,40);ensure(v===''||(key==='phone'?/^1[3-9]\d{9}$/.test(v):/^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/.test(v)),'联系方式');contact[key]=v}
   patch.contact=contact;
  }
  const row=await this.db.call<UserRecord>('cn_profile_update',{p_user_id:actor.userId,p_patch:patch});return profileOf(row);
 }
}
