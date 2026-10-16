import type { Post, Profile, HousingState } from './models';
const pic=(id:string)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=85`;
export const ROOM_IMAGES=[pic('photo-1616486338812-3dadae4b4ace'),pic('photo-1600210492486-724fe5c67fb0'),pic('photo-1615874959474-d609969a20ed'),pic('photo-1600607687920-4e2a09cf159d'),pic('photo-1560448204-e02f11c3d0e2'),pic('photo-1616594039964-ae9021a400a0')];
const people=[
 ['小林','女','产品设计师','观山湖区',1200,['不吸烟','爱干净','喜欢做饭'],'希望找到一个相处自然、尊重彼此空间的室友。工作日规律上班，周末喜欢做饭和逛公园。','photo-1534528741775-53994a69daeb'],
 ['阿哲','男','软件工程师','云岩区',1000,['不吸烟','安静独处','规律上班'],'已经看好一套两居室，想找一位作息规律的伙伴一起租下。公共区域一起维护，费用透明分摊。','photo-1506794778202-cad84cf45f1d'],
 ['沐沐','女','品牌策划','南明区',900,['爱干净','周末户外','早睡早起'],'刚来贵阳工作，想找原户型两居或三居合租。希望靠近地铁，晚上保持安静。','photo-1524504388940-b1c1722653e1'],
 ['周先生','男','房东','观山湖区',1300,['不吸烟'],'提供原户型房源，欢迎组好队的室友联系看房。','photo-1472099645785-5658abf4ff4e'],
 ['阿宁','女','摄影师','花溪区',800,['接受宠物','喜欢做饭','乐于交流'],'喜欢自然光和温暖的家，养了一只安静的小猫。愿意一起做饭，也尊重独处时间。','photo-1524250502761-1ac6f2e30d43'],
 ['何女士','女','房产经纪人','云岩区',1100,['爱干净'],'仅发布原户型合租房源。中介服务费须线下确认，可先组队再联系。','photo-1580489944761-15a19d654956'],
 ['小杨','男','教师','白云区',700,['不吸烟','早睡早起','周末户外'],'希望室友爱干净、不在屋内吸烟，互相尊重生活节奏。','photo-1500648767791-00dcc994a43e'],
 ['一一','女','应届毕业生','观山湖区',1000,['不吸烟','爱干净','规律上班'],'开始第一份工作，预算每月一千左右。想住正常两居室，接受先认识室友再一起找房。','photo-1544005313-94ddf0286df2'],
];
export const DEMO_PROFILES:Profile[]=people.map((p,i)=>({id:`demo-u${i}`,firstName:p[0] as string,age:[26,28,25,42,27,35,29,23][i],gender:p[1] as string,occupation:p[2] as string,city:'贵阳',district:p[3] as string,budgetMax:p[4] as number,bio:p[6] as string,lifestyleTags:p[5] as string[],avatar:pic(p[7] as string),moveIn:'2026-11-01',leaseMonths:12,isPublic:true,userType:i===3?'landlord':i===5?'agent':'seeker',verified:false,demo:true,workSchedule:'工作日规律上班，偶尔居家办公',sleepSchedule:'通常23:30前休息，早上7:30左右起床',cookingFrequency:i%2?'偶尔做饭':'经常做饭',cleaningFrequency:'公共区域每周轮值',petSituation:i===4?'有一只猫':'无宠物，可协商',guestPreference:'访客提前沟通，不过夜',housingPreferences:'通勤方便、采光好、保留公共客厅的原户型两居或三居',roommateExpectations:'尊重彼此作息，费用透明，公共空间用完及时整理。'}));
const specifications:[number,string,string,number,number,number,HousingState,string][]=[
 [0,'观山湖 · 阳光两居，留一间给合拍的你','世纪城 · 北京西路附近',1200,2,89,'rented','2026-11-01'],
 [1,'喷水池附近的两居室，想找人一起租','云岩区 · 喷水池生活圈',1000,2,78,'teamup','2026-10-25'],
 [3,'金融城原户型三居，可以两人组队入住','观山湖区 · 金融城',1300,3,118,'landlord','2026-10-20'],
 [4,'花溪公园旁，和小猫一起住的明亮两居','花溪区 · 花溪公园附近',800,2,82,'rented','2026-11-05'],
 [5,'黔灵山附近三居，原户型可组队整租','云岩区 · 黔灵山生活圈',1100,3,110,'agent','2026-10-28'],
 [6,'白云区两居次卧，规律生活的安静小家','白云区 · 泉湖公园附近',700,2,76,'rented','2026-11-01'],
];
const transit=['北京西路地铁站 · 约900米','喷水池地铁站 · 约500米','国际生态会议中心地铁站 · 约1.1公里','花溪公园公交站 · 约350米','北京路地铁站 · 约1.2公里','泉湖公园地铁站 · 约700米'];
const facilities=[['永辉超市','社区医院','世纪城小学'],['南国花锦','贵州医科大学附属医院','喷水池商业街'],['盒马鲜生','观山湖公园','会展城商圈'],['花溪十字街','花溪区人民医院','花溪公园'],['黔灵山公园','北京路商圈','社区菜市场'],['泉湖公园','白云区医院','大型超市']];
export const DEMO_POSTS:Post[]=[...specifications.map((s,i)=>({id:`demo-r${i}`,ownerId:DEMO_PROFILES[s[0]].id,owner:DEMO_PROFILES[s[0]],kind:'room' as const,status:'active',title:s[1],city:'贵阳',district:DEMO_PROFILES[s[0]].district,price:s[3],totalRent:s[3]*s[4],bedrooms:s[4],bathrooms:i===2?2:1,area:s[5],location:s[2],nearestTransit:transit[i],nearbyFacilities:facilities[i],coRentalRules:'公共区域每周轮值清洁；水电网按实际账单平摊；访客提前沟通，晚上十一点后保持安静。',roomType:'独立卧室',housingState:s[6],availableFrom:s[7],leaseMonths:12,description:DEMO_PROFILES[s[0]].bio+'\n\n房屋为原始户型，客厅和厨房均为公共区域。租金、水电和押金会在入住前一起确认，欢迎先聊聊我们的生活习惯。',amenities:['独立卧室','家具齐全','可做饭',...(i%2?['近地铁','洗衣机']:['电梯','阳台'])],lifestyleTags:DEMO_PROFILES[s[0]].lifestyleTags,images:[ROOM_IMAGES[i],ROOM_IMAGES[(i+2)%6],ROOM_IMAGES[(i+3)%6]],originalLayout:true,billsIncluded:false,preferredGender:i===0?'女':'不限',roommatesNeeded:s[6]==='landlord'?2:1,lat:[26.611,26.585,26.657,26.413,26.608,26.676][i],lng:[106.625,106.708,106.64,106.675,106.695,106.62][i],contactPublic:false,createdAt:`2026-10-${String(14-i).padStart(2,'0')}T04:00:00Z`,saved:false,interested:false,interestCount:0,compatibility:null,promoted:false,demo:true})),...[2,7].map((i,j)=>({id:`demo-s${j}`,ownerId:DEMO_PROFILES[i].id,owner:DEMO_PROFILES[i],kind:'seeker' as const,status:'active',title:j?'刚到贵阳，找一起认真生活的室友':'规律作息，想找地铁附近的温暖小家',city:'贵阳',district:DEMO_PROFILES[i].district,price:DEMO_PROFILES[i].budgetMax,totalRent:0,bedrooms:2,bathrooms:1,area:0,location:DEMO_PROFILES[i].district,roomType:'独立卧室',housingState:'teamup' as const,availableFrom:'2026-11-01',leaseMonths:12,description:DEMO_PROFILES[i].bio,amenities:['近地铁','家具齐全'],lifestyleTags:DEMO_PROFILES[i].lifestyleTags,images:[DEMO_PROFILES[i].avatar],originalLayout:true,billsIncluded:false,preferredGender:'女',roommatesNeeded:1,lat:26.59,lng:106.66,contactPublic:false,createdAt:'2026-10-13T07:00:00Z',saved:false,interested:false,interestCount:0,compatibility:null,promoted:false,demo:true}))];
