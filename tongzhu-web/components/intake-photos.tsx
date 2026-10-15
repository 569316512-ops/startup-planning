'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,X} from 'lucide-react';
export type IntakePhoto={file:File;url:string};
export function IntakePhotos({room,value,onChange,disabled}:{room:boolean;value:IntakePhoto[];onChange:(photos:IntakePhoto[])=>void;disabled:boolean}){
 const input=useRef<HTMLInputElement>(null),previous=useRef<IntakePhoto[]>([]),[error,setError]=useState('');const canAdd=true;
 useEffect(()=>{for(const photo of previous.current)if(!value.includes(photo))URL.revokeObjectURL(photo.url);previous.current=value},[value]);
 useEffect(()=>()=>{for(const photo of previous.current)URL.revokeObjectURL(photo.url)},[]);
 return <section className="intake-photos"><h3>{room?'房子照片':'个人照片'}<span className="required-mark" aria-hidden="true">*</span></h3><p>{room?'上传卧室、客厅等真实房屋照片，请勿包含门牌号或他人隐私。':'上传能介绍自己的照片，方便大家认识你。请勿上传身份证件。'}</p><div className="intake-photo-grid">{value.map((photo,i)=><div key={photo.url}><img src={photo.url} alt={`${room?'房子':'个人'}照片预览${i+1}`}/><button type="button" disabled={disabled} aria-label={`移除第${i+1}张照片`} onClick={()=>onChange(value.filter((_,n)=>n!==i))}><X size={16}/></button></div>)}{canAdd&&<button className="intake-photo-add" type="button" disabled={disabled} onClick={()=>input.current?.click()}><Camera size={24}/><span>{value.length?'继续添加':room?'上传房子照片':'上传个人照片'}</span></button>}</div><input ref={input} className="sr-only" aria-label={room?'选择房子照片':'选择个人照片'} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={e=>{setError('');const files=Array.from(e.target.files||[]);if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024)){setError('请选择 JPEG、PNG 或 WebP 照片，每张不超过5MB。');e.target.value='';return;}onChange([...value,...files.map(file=>({file,url:URL.createObjectURL(file)}))]);e.target.value='';}}/><small>照片仅用于本次运营撮合，不会自动公开。提交时上传，每张不超过5MB。</small>{error&&<p className="error" role="alert">{error}</p>}</section>;
}
