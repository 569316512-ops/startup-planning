'use client';
import {useState,useEffect} from 'react';
import {Check,ArrowRight,MapPin} from 'lucide-react';
import {CITIES,districtsFor} from '@/lib/cities';
import {request} from '@/lib/roomdate/client';
import {pilotSession,pilotSource} from '@/lib/pilot-client';
import {Field} from './shared';

export function QuickIntake({city,kind,onBrowse}:{city:string;kind:'room'|'seeker';onBrowse:()=>void}){
 const [data,setData]=useState({city,district:'',kind,budget:'',moveIn:'',note:'',nickname:'',contactType:'wechat',contact:'',adult:false,consent:false,website:''});
 const [receiptToken,setReceiptToken]=useState(()=>crypto.randomUUID());const [receipt,setReceipt]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('yiqizu-pilot-receipt')||'null');if(saved&&Date.now()-saved.savedAt<30*86400000){setReceipt(saved.id);setReceiptToken(saved.token)}else localStorage.removeItem('yiqizu-pilot-receipt')}catch{}},[]);
 const change=(key:string,value:unknown)=>setData(d=>({...d,[key]:value}));const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
 if(receipt)return <div className="quick-success stack"><span className="quick-check"><Check size={30}/></span><h3>需求已登记</h3><p>联系方式仅运营可见，不会公开到帖子中。有合适的人选后，运营可通过你留下的方式联系你。</p><p className="muted">这是人工撮合试点，不保证匹配或找到房子。不要向陌生人提前支付押金。</p><button className="btn primary full" onClick={onBrowse}>继续看房源与室友 <ArrowRight size={16}/></button><button className="text-btn" disabled={busy} onClick={async()=>{setBusy(true);try{await request(`/api/v1/pilot/leads/${receipt}`,{method:'DELETE',body:{receiptToken}});setReceipt('');setReceiptToken(crypto.randomUUID());try{localStorage.removeItem('yiqizu-pilot-receipt')}catch{};setData(d=>({...d,contact:'',consent:false}));setError('登记已撤回，联系方式已删除。')}catch(e){setError(e instanceof Error?e.message:'撤回失败')}finally{setBusy(false)}}}>撤回本次登记并删除联系方式</button><small>本机保留登记回执，下次打开“快速登记”仍可撤回。请勿向他人转交回执；清除浏览器数据后可通过原招募渠道联系运营。</small>{error&&<p role="alert" className="error">{error}</p>}</div>;
 return <form className="stack quick-intake" onSubmit={async e=>{e.preventDefault();setError('');setBusy(true);try{const r=await request<{id:string}>('/api/v1/pilot/leads',{method:'POST',body:{...data,budget:Number(data.budget),receiptToken,sessionId:pilotSession(),source:pilotSource()}});setReceipt(r.id);try{localStorage.setItem('yiqizu-pilot-receipt',JSON.stringify({id:r.id,token:receiptToken,savedAt:Date.now()}))}catch{}}catch(e){setError(e instanceof Error?e.message:'未提交成功，请重试；已填内容会保留。')}finally{setBusy(false)}}}>
  <p className="quick-intro">不用注册，不用上传照片。先说清核心需求，其他信息有匹配机会再补。</p>
  <div className="segmented quick-kind">{[['room','有房 · 招室友'],['seeker','无房 · 找住处']].map(([value,label])=><button key={value} type="button" className={data.kind===value?'selected':''} aria-pressed={data.kind===value} onClick={()=>change('kind',value)}>{label}</button>)}</div>
  <div className="form-grid"><Field label="城市"><select value={data.city} onChange={e=>setData(d=>({...d,city:e.target.value,district:''}))}>{CITIES.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="片区"><select required value={data.district} onChange={e=>change('district',e.target.value)}><option value="">请选择片区</option>{districtsFor(data.city).slice(1).map(d=><option key={d}>{d}</option>)}</select></Field></div>
  <Field label={data.kind==='room'?'每人月租（元）':'每月个人预算（元）'}><input required type="number" inputMode="numeric" min={1} max={50000} placeholder="例如 1200" value={data.budget} onChange={e=>change('budget',e.target.value)}/></Field>
  <Field label="计划入住日期"><input required type="date" min={today} value={data.moveIn} onChange={e=>change('moveIn',e.target.value)}/></Field>
  <Field label="一句话说说需求" help="先写片区、通勤或室友期待即可，请勿填写具体门牌号。"><textarea required minLength={4} maxLength={500} rows={3} placeholder={data.kind==='room'?'如：观山湖原户型两居，想找爱干净的上班族':'如：预算1200，希望近地铁、不吸烟，月底入住'} value={data.note} onChange={e=>change('note',e.target.value)}/></Field>
  <Field label="怎么称呼你（选填）"><input maxLength={30} autoComplete="nickname" value={data.nickname} onChange={e=>change('nickname',e.target.value)}/></Field>
  <div className="form-grid"><Field label="留一种联系方式"><select value={data.contactType} onChange={e=>setData(d=>({...d,contactType:e.target.value,contact:''}))}><option value="wechat">微信号</option><option value="phone">手机号</option></select></Field><Field label={data.contactType==='wechat'?'微信号':'手机号'}><input required type={data.contactType==='phone'?'tel':'text'} inputMode={data.contactType==='phone'?'tel':'text'} maxLength={data.contactType==='phone'?11:20} autoCapitalize="none" autoComplete={data.contactType==='phone'?'tel':'off'} value={data.contact} onChange={e=>change('contact',e.target.value)} placeholder={data.contactType==='wechat'?'填写微信号，非昵称':'11位手机号'}/></Field></div>
  <div className="pilot-honeypot" aria-hidden="true"><label>网站<input tabIndex={-1} autoComplete="off" value={data.website} onChange={e=>change('website',e.target.value)}/></label></div>
  <label className="check-line"><input type="checkbox" required checked={data.adult} onChange={e=>change('adult',e.target.checked)}/>我已年满18岁，提交的是真实近期租房需求</label>
  <label className="check-line"><input type="checkbox" required checked={data.consent} onChange={e=>change('consent',e.target.checked)}/>同意仅由一起租运营使用上述信息进行本次合租撮合，不向其他用户公开联系方式。</label>
  <small className="muted"><MapPin size={12}/> 首轮重点验证贵阳市，八城均可登记。超过30天的信息不进入运营列表，并在后续登记或运营访问时清理；提交后可撤回。本站仅记录站内访问会话与入口事件用于试点统计。</small>
  {error&&<p role="alert" className="error">{error}</p>}<button className="btn primary full quick-submit" disabled={busy}>{busy?'正在提交…':'免费登记，让合适的人找到我'}</button><small>登记不会自动变成公开房源，也不会产生费用。</small>
 </form>;
}
