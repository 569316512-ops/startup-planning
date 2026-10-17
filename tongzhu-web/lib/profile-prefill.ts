type Data=Record<string,any>;
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const blank=(value:unknown)=>value===undefined||value===null||value===''||Array.isArray(value)&&value.length===0;
export function profileDraftKey(base:string,profile?:Data|null){return profile?.id?base+':'+profile.id:base;}
export function profileAvatar(profile?:Data|null){const avatar=text(profile?.avatar),id=text(profile?.id);return id&&avatar.startsWith('/api/v1/uploads/'+id+'/')&&!avatar.includes('..')?avatar:'';}
export function quickProfileDefaults(profile:Data|null|undefined,kind:string,city:string){
 if(!profile)return {} as Data;
 const nickname=text(profile.firstName);const data:Data={};
 if(nickname&&nickname!=='新用户')data.nickname=nickname.slice(0,30);
 if(text(profile.occupation))data.occupation=text(profile.occupation);
 if(['男','女','其他','不透露'].includes(profile.gender))data.gender=profile.gender;
 if(Number(profile.budgetMax)>0&&Number(profile.budgetMax)<=50000)data.budget=String(profile.budgetMax);
 if(text(profile.moveIn))data.moveIn=text(profile.moveIn);
 if(city===profile.city&&text(profile.district)&&profile.district!=='全部区域')data.district=profile.district;
 if(text(profile.roommateExpectations))data.roommateExpectations=text(profile.roommateExpectations);
 if(kind==='seeker'){
  if(text(profile.housingPreferences))data.note=text(profile.housingPreferences);
  if(profile.age>=18&&Number.isInteger(profile.leaseMonths)&&profile.leaseMonths>=1&&profile.leaseMonths<=60)data.minLeaseMonths=String(profile.leaseMonths);
 }
 return data;
}
export function fillQuickProfile<T extends Data>(current:T,profile:Data|null|undefined,touched:ReadonlySet<string>=new Set()):T{
 const result={...current};
 for(const [key,value] of Object.entries(quickProfileDefaults(profile,current.kind,current.city)))if(!touched.has(key)&&blank(current[key]))(result as Data)[key]=value;
 if(profile&&!touched.has('contact')&&blank(current.contact)){
  const phone=text(profile.contact?.phone),wechat=text(profile.contact?.wechat);
  if(touched.has('contactType')){const value=current.contactType==='phone'?phone:wechat;if(value)(result as Data).contact=value;}
  else if(wechat){(result as Data).contactType='wechat';(result as Data).contact=wechat;}
  else if(phone){(result as Data).contactType='phone';(result as Data).contact=phone;}
 }
 // Visibility/consent/authority never come from the account's defaults.
 return result;
}
export function fullProfileDefaults(profile:Data,kind:string){return {
 city:profile.city,...(profile.district&&profile.district!=='全部区域'?{district:profile.district}:{}),
 ...(profile.budgetMax>0?{price:profile.budgetMax}:{}),
 ...(text(profile.moveIn)?{availableFrom:profile.moveIn}:{}),
 ...(kind==='seeker'&&profile.age>=18&&Number.isInteger(profile.leaseMonths)&&profile.leaseMonths>=1&&profile.leaseMonths<=60?{leaseMonths:profile.leaseMonths}:{}),
 ...(kind==='seeker'&&text(profile.housingPreferences)?{description:text(profile.housingPreferences)}:{}),
 roommateExpectations:text(profile.roommateExpectations),lifestyleTags:Array.isArray(profile.lifestyleTags)?[...profile.lifestyleTags]:[],
};}
