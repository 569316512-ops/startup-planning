import {TAGS,type Post} from './models';
export const LIFESTYLE_FILTERS=TAGS;
export const AMENITY_FILTERS=['独立卧室','独立卫浴','家具齐全','电梯','空调','洗衣机','冰箱','热水器','可做饭','燃气','阳台','Wi-Fi','衣柜','书桌','沙发','电视','暖气','近地铁','停车位','门禁'];
export const SEEKER_AMENITIES=[...AMENITY_FILTERS,'接受宠物'];
const aliases:Record<string,string[]>={'Wi-Fi':['Wi-Fi','宽带'],'宽带':['宽带','Wi-Fi'],'独立卫浴':['独立卫浴','独立卫生间'],'独立卫生间':['独立卫生间','独立卫浴'],'接受宠物':['接受宠物','可养宠物'],'可养宠物':['可养宠物','接受宠物']};
export function matchesListingTag(post:Pick<Post,'lifestyleTags'|'amenities'>,tag:string){return (aliases[tag]||[tag]).some(t=>post.lifestyleTags.includes(t)||post.amenities.includes(t))}
