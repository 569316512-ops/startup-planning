import {ApiError,request} from './roomdate/client';
// Registering with existing credentials may resume the same account, never reset it.
export async function authenticate(mode:'login'|'register',data:{email:string;password:string}){
 try{return await request<any>('/api/v1/auth/'+mode,{method:'POST',body:data})}catch(error){if(mode==='register'&&error instanceof ApiError&&error.code==='email_registered'){try{return await request<any>('/api/v1/auth/login',{method:'POST',body:data})}catch(loginError){if(loginError instanceof ApiError&&loginError.status===401)throw error;throw loginError}}throw error}
}
export async function bindLocalPosts(){
 let receipts:any[]=[];try{const saved=JSON.parse(localStorage.getItem('yiqizu-pilot-receipts-v2')||'[]');if(Array.isArray(saved))receipts=saved.filter(r=>r?.id&&r?.token&&r.savedAt>Date.now()-30*86400000).slice(0,30)}catch{return}
 for(const receipt of receipts){try{await request('/api/v1/pilot/leads/'+encodeURIComponent(receipt.id)+'/claim',{method:'POST',body:{receiptToken:receipt.token}})}catch{/* A stale receipt or a different bound account cannot transfer ownership. */}}
}
