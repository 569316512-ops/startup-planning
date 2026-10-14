import type { Compatibility } from './roomdate/types';
export type Kind = 'room' | 'seeker';
export type HousingState = 'rented' | 'teamup' | 'landlord' | 'agent';
export const DISTRICTS = ['全部区域','观山湖区','云岩区','南明区','花溪区','白云区','乌当区'];
export const TAGS = ['不吸烟','早睡早起','爱干净','安静独处','喜欢做饭','周末户外','有猫','接受宠物','在家办公','规律上班','乐于交流','不带异性过夜'];
export const AMENITIES = ['独立卧室','独立卫浴','家具齐全','电梯','空调','洗衣机','可做饭','阳台','Wi-Fi','近地铁','停车位','接受宠物'];
export const STATES: Record<HousingState,string> = { rented:'已租好 · 招室友',teamup:'看好房 · 一起租',landlord:'房东直租',agent:'中介房源' };
export interface Profile {
 id:string;firstName:string;age:number;gender:string;occupation:string;city:string;district:string;budgetMax:number;bio:string;lifestyleTags:string[];avatar:string;moveIn:string;leaseMonths:number;isPublic:boolean;userType:string;verified:boolean;demo:boolean;
}
export interface Post {
 id:string;ownerId:string;kind:Kind;status:string;title:string;city:string;district:string;price:number;totalRent:number;bedrooms:number;bathrooms:number;area:number;location:string;roomType:string;housingState:HousingState;availableFrom:string;leaseMonths:number;description:string;amenities:string[];lifestyleTags:string[];images:string[];originalLayout:boolean;billsIncluded:boolean;preferredGender:string;roommatesNeeded:number;lat:number;lng:number;contactPublic:boolean;createdAt:string;owner:Profile;saved:boolean;interested:boolean;interestCount:number;compatibility:Compatibility|null;promoted:boolean;demo:boolean;
}
export interface Filters {kind:string;district:string;maxPrice:string;bedrooms:string;housingState:string;tag:string;q:string;sort:string;}
export const EMPTY_FILTERS: Filters={kind:'all',district:'全部区域',maxPrice:'',bedrooms:'',housingState:'',tag:'',q:'',sort:'recent'};
export function money(n:number){return new Intl.NumberFormat('zh-CN').format(n);}
export function dateLabel(d:string){if(!d)return '入住时间可协商';const now=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});return d<=now?'随时入住':`${Number(d.slice(5,7))}月${Number(d.slice(8,10))}日入住`;}
