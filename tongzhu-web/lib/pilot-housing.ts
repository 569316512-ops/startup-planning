export const PILOT_AMENITIES=['家具齐全','可做饭','电梯','空调','洗衣机','阳台','近地铁','冰箱','热水器','燃气','宽带','衣柜','书桌','沙发','电视','暖气','独立卫生间','停车位','门禁','可养宠物'];
export const PILOT_HOUSING_STATES:Record<string,string>={rented:'已租好，招室友',teamup:'看好房，一起租',landlord:'房东直租',agent:'中介房源'};
export type PilotHousing={community:string;housingState:string;bedrooms:number;bathrooms:number;area:number;roomsAvailable:number;originalLayout:boolean;amenities:string[]};
