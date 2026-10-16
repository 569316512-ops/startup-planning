'use client';
import {useEffect,useState,useRef} from 'react';
import {Field} from './shared';
export function IntakeAvatar({file,onChange,gender,disabled,initialSrc=''}:{initialSrc?:string;file:File|null;onChange:(file:File|null)=>void;gender:string;disabled:boolean}){
 const [preview,setPreview]=useState(''),[error,setError]=useState(''),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!file){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 return <section className="intake-avatar stack"><h3>你的头像 <small className="muted">选填</small></h3><div className="avatar-options"><img width="64" height="64" className="avatar" src={preview||initialSrc||`/avatars/${gender==='女'?'female':'male'}-1.svg`} alt="头像预览"/><button className="btn secondary" type="button" disabled={disabled} onClick={()=>input.current?.click()}>上传头像</button>{(file||initialSrc)&&<button className="text-btn" type="button" disabled={disabled} onClick={()=>onChange(null)}>使用默认头像</button>}</div><input ref={input} aria-label="选择头像" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(f.type)){setError('头像请使用5MB以内的JPEG、PNG或WebP图片');return}setError('');onChange(f)}}/><small>不上传时，系统按性别分配卡通头像；头像与帖子展示照片分别保存。</small>{error&&<p role="alert" className="error">{error}</p>}</section>
}
