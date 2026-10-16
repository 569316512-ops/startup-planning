// Real integration checks. Only runs against a local preview; never creates hosted test accounts.
import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:5173';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Smoke tests are local-only');
function client(){let cookie='';const call=async(path,method='GET',body,expected=200)=>{const response=await fetch(origin+'/api/v1/'+path,{method,headers:{...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=await response.json();assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);return data;};call.upload=async(file)=>{const form=new FormData();form.append('file',file);const response=await fetch(origin+'/api/v1/uploads',{method:'POST',headers:{cookie},body:form});const data=await response.json();assert.equal(response.status,201,`POST uploads: ${JSON.stringify(data)}`);return data.url;};return call;}
const a=client(),b=client(),stranger=client(),stamp=Date.now();
const base={firstName:'测试室友',age:26,gender:'不透露',occupation:'产品设计师',district:'观山湖区',budgetMax:1200,moveIn:'2026-11-01',lifestyleTags:['不吸烟','爱干净'],bio:'这是本地自动检查的测试账户，不会发布到线上。',workSchedule:'朝九晚六',sleepSchedule:'晚上十一点前休息',cookingFrequency:'偶尔做饭',cleaningFrequency:'每周轮值',petSituation:'无宠物，可接受猫',guestPreference:'访客提前沟通',housingPreferences:'希望交通方便、采光良好',roommateExpectations:'希望共同维护卫生并按时分摊费用',isPublic:true,userType:'tenant',contact:{phone:'',wechat:'',visible:false},password:'Local-check-strong-password'};
const p=await a('auth/register','POST',{...base,email:`a-${stamp}@tongzhu.test`});
const q=await b('auth/register','POST',{...base,firstName:'另一位测试室友',email:`b-${stamp}@tongzhu.test`});
const imageBuffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const photoA=await a.upload(new File([imageBuffer],'room.png',{type:'image/png'})),photoB=await b.upload(new File([imageBuffer],'daily.png',{type:'image/png'}));
const room={kind:'room',title:'贵阳原户型两居测试帖子',district:'观山湖区',price:1200,totalRent:2400,bedrooms:2,bathrooms:1,area:80,location:'测试小区',nearestTransit:'测试公交站约500米',nearbyFacilities:['超市','公园'],housingState:'teamup',availableFrom:'2026-11-01',leaseMonths:12,description:'本地测试：先认识彼此，讨论作息和清洁安排后再一起租下房子。',amenities:['独立卧室','可做饭'],lifestyleTags:['不吸烟'],coRentalRules:'公共区域每周轮值，费用按月分摊。',images:[photoA],originalLayout:true};
// Eight-city persistence, city/area validation and cross-city isolation.
const cities=[['上海','浦东新区'],['北京','朝阳区'],['深圳','南山区'],['杭州','西湖区'],['广州','天河区'],['成都','武侯区'],['重庆','两江新区'],['贵阳','观山湖区']];
for(const [city,district] of cities){
 const published=await a('listings','POST',{...room,city,district,title:`${city}多城发布回归测试`},201);
 try {
  assert.equal(published.city,city);assert.equal(published.district,district);
  const feed=await stranger(`listings?demo=0&city=${encodeURIComponent(city)}`);
  assert(feed.items.some(x=>x.id===published.id));assert(feed.items.every(x=>x.city===city));
  const other=city==='贵阳'?'上海':'贵阳';
  const excluded=await stranger(`listings?demo=0&city=${encodeURIComponent(other)}`);
  assert(!excluded.items.some(x=>x.id===published.id));
 } finally {await a(`listings/${published.id}`,'DELETE');}
}
const edited=await a('listings','POST',{...room,city:'上海',district:'浦东新区'},201);
try{const moved=await a(`listings/${edited.id}`,'PUT',{...room,city:'重庆',district:'两江新区'});assert.equal(moved.city,'重庆');assert.equal((await stranger('listings?city=重庆&demo=0')).items.some(x=>x.id===edited.id),true);}finally{await a(`listings/${edited.id}`,'DELETE');}
const profile=await a('me','PUT',{...base,city:'重庆',district:'两江新区',avatar:photoA,contact:{phone:'13800000000',wechat:'local_check_only',visible:true}});assert.equal(profile.city,'重庆');
assert((await stranger('listings?city=重庆')).items.every(x=>x.city==='重庆'));
await a('listings','POST',{...room,city:'南京'},400);
console.log('PASS: 8 cities, isolation, city edit persistence, profile city, demo isolation, unsupported city rejection.');
