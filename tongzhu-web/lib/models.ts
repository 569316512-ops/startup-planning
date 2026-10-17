import {districtsFor,DEFAULT_CITY} from './cities';
import type { Compatibility } from './roomdate/types';
export type Kind = 'room' | 'seeker';
export type HousingState = 'rented' | 'teamup' | 'landlord' | 'agent';
export const DISTRICTS = districtsFor(DEFAULT_CITY);
export const TAGS = ['不吸烟','早睡早起','爱干净','安静独处','喜欢做饭','周末户外','有猫','接受宠物','在家办公','规律上班','乐于交流','不带异性过夜'];
export const AMENITIES = ['独立卧室','独立卫浴','家具齐全','电梯','空调','洗衣机','可做饭','阳台','Wi-Fi','近地铁','停车位','接受宠物'];
export const STATES: Record<HousingState,string> = { rented:'已租好 · 招室友',teamup:'看好房 · 一起租',landlord:'房东直租',agent:'中介房源' };
export interface Profile {
 id:string;firstName:string;age:number;gender:string;occupation:string;city:string;district:string;budgetMax:number;bio:string;lifestyleTags:string[];avatar:string;moveIn:string;leaseMonths:number;isPublic:boolean;userType:string;verified:boolean;demo:boolean;
 workSchedule?:string;sleepSchedule?:string;cookingFrequency?:string;cleaningFrequency?:string;petSituation?:string;guestPreference?:string;roommateExpectations?:string;housingPreferences?:string;
}
export interface Post {
 id:string;ownerId:string;kind:Kind;status:string;title:string;city:string;district:string;price:number;totalRent:number;bedrooms:number;bathrooms:number;area:number;location:string;roomType:string;housingState:HousingState;availableFrom:string;leaseMonths:number;description:string;amenities:string[];lifestyleTags:string[];images:string[];originalLayout:boolean;billsIncluded:boolean;preferredGender:string;roommatesNeeded:number;lat:number;lng:number;contactPublic:boolean;createdAt:string;owner:Profile;saved:boolean;interested:boolean;interestCount:number;compatibility:Compatibility|null;promoted:boolean;demo:boolean;
 authorityConfirmed?:boolean;personalIntro?:string;roommateExpectations?:string;minLeaseMonths?:number|null;nearestTransit?:string;nearbyFacilities?:string[];coRentalRules?:string;pilot?:boolean;chatAvailable?:boolean;isOwner?:boolean;
}
export interface Filters {city:string;kind:string;district:string;maxPrice:string;bedrooms:string;housingState:string;tag:string;q:string;sort:string;}
export const EMPTY_FILTERS: Filters={city:DEFAULT_CITY,kind:'all',district:'全部区域',maxPrice:'',bedrooms:'',housingState:'',tag:'',q:'',sort:'recent'};
export function money(n:number){return new Intl.NumberFormat('zh-CN').format(n);}
export function dateLabel(d:string){if(!d)return '入住时间可协商';if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return d;const now=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});return d<=now?'随时入住':`${Number(d.slice(5,7))}月${Number(d.slice(8,10))}日入住`;}
export function locationLabel(post:Pick<Post,'city'|'district'|'location'>){const city=post.city||DEFAULT_CITY;let location=(post.location||'').trim();for(const prefix of [city+'市',city,post.district])if(location.startsWith(prefix))location=location.slice(prefix.length).replace(/^[·\s-]+/,'');return `${city}·${post.district}·${location||'大致位置待沟通'}`;}
export function amapSearchUrl(post:Pick<Post,'city'|'district'|'location'>){const city=post.city||DEFAULT_CITY;return `https://uri.amap.com/search?keyword=${encodeURIComponent(`${city}市${post.district}${post.location||''}`)}&city=${encodeURIComponent(city)}&src=yiqizu&callnative=1`;}

export function leaseLabel(post:Pick<Post,'kind'|'pilot'|'minLeaseMonths'|'leaseMonths'>){const months=post.pilot?post.minLeaseMonths:post.leaseMonths;return months?(post.kind==='seeker'?`预计租${months}个月`:`${months}个月起`):'租期待沟通';}
