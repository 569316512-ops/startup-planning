'use client';
import {useState,useId} from 'react';
import {request} from '@/lib/roomdate/client';

export function ContactVisibility({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 const groupName=useId();
 return <fieldset className="stack" disabled={disabled}><legend>联系方式展示范围 <span className="required-mark">*</span></legend><label className="check-line"><input type="radio" name={groupName} required value="members" checked={value==='members'} onChange={()=>onChange('members')}/>允许登录用户查看我填写的微信号或手机号</label><label className="check-line"><input type="radio" name={groupName} required value="operator" checked={value==='operator'} onChange={()=>onChange('operator')}/>仅一起租运营可见，其他用户无法直接联系我</label><small>开放后他人可复制微信号或拨打电话，可能收到陌生人联系。可随时关闭，但已被复制的联系方式无法收回。登录不代表身份已验证。</small></fieldset>;
}

export function ReceiptContactSettings({id,token,onChanged}:{id:string;token:string;onChanged?:()=>void}){
 const [value,setValue]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const path=`/api/v1/pilot/leads/${id}/contact-settings`;
 const load=async()=>{setBusy(true);setMessage('');try{const result=await request<{contactVisibility:string}>(path,{method:'POST',body:{receiptToken:token}});setValue(result.contactVisibility)}catch(e){setMessage(e instanceof Error?e.message:'读取失败')}finally{setBusy(false)}};
 return <div className="stack">{value===null?<button type="button" className="text-btn" disabled={busy} onClick={()=>void load()}>管理联系方式展示</button>:<><ContactVisibility value={value} onChange={setValue} disabled={busy}/><button type="button" className="btn secondary" disabled={busy} onClick={async()=>{setBusy(true);setMessage('');try{await request(path,{method:'PUT',body:{receiptToken:token,contactVisibility:value}});setMessage(value==='members'?'已允许登录用户查看联系方式':'已关闭直接联系，联系方式仅运营可见');onChanged?.()}catch(e){setMessage(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}}}>保存展示范围</button><button type="button" className="text-btn" disabled={busy} onClick={()=>setValue(null)}>收起</button></>}{message&&<p role="status">{message}</p>}</div>;
}
