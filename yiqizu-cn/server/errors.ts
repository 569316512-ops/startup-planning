export class ApiError extends Error{constructor(public status:number,public code:string,message:string){super(message)}}
export const unauthorized=()=>new ApiError(401,'UNAUTHORIZED','请先登录或检查账号密码');
export function domainError(code:string):never{
 const codes:Record<string,[number,string]>={EMAIL_EXISTS:[409,'该邮箱已注册'],RATE_LIMITED:[429,'操作太频繁，请稍后重试'],CONFLICT:[409,'内容已更新，请重新打开后操作'],NOT_FOUND:[404,'内容不存在或已不可用'],FORBIDDEN:[403,'没有访问权限'],QUOTA_EXCEEDED:[429,'今日额度已用完，请明天再试'],INVALID_UPLOAD:[409,'照片不可用，请重新选择']};
 const known=codes[code];if(known)throw new ApiError(known[0],code,known[1]);throw new ApiError(503,'UNAVAILABLE','服务暂时不可用，请稍后再试');
}
