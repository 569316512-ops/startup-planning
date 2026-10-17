// A listing's source is a self-declaration, independent of the account's personal profile.
export function isBusinessHousing(state:unknown){return state==='landlord'||state==='agent';}
export function publisherType(kind:string,state:unknown){return kind==='seeker'?'seeker':isBusinessHousing(state)?String(state):'tenant';}
export function publisherLabel(state:unknown){return state==='landlord'?'房东':state==='agent'?'中介 / 经纪人':'租客';}
export function publisherForPost<T extends {userType:string;verified:boolean;occupation:string}>(owner:T,kind:string,state:unknown):T{const business=kind==='room'&&isBusinessHousing(state);return {...owner,userType:publisherType(kind,state),...(business?{verified:false,occupation:owner.occupation||publisherLabel(state)}:{})};}
