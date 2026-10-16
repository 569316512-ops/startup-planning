'use client';
import {useRef,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';

export function PostGallery({images,title,portrait=false}:{images:string[];title:string;portrait?:boolean}){
 const track=useRef<HTMLDivElement>(null),[active,setActive]=useState(0);
 const move=(step:number)=>{const el=track.current;if(!el)return;const next=Math.max(0,Math.min(images.length-1,Math.round(el.scrollLeft/el.clientWidth)+step));el.scrollTo({left:next*el.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
 return <section className={`gallery swipe-gallery ${portrait?'portrait-gallery':''}`} role="region" aria-roledescription="轮播图" aria-label="帖子照片" tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1)}}}>
  <div className="gallery-track" ref={track} onScroll={e=>{const el=e.currentTarget;if(el.clientWidth)setActive(Math.max(0,Math.min(images.length-1,Math.round(el.scrollLeft/el.clientWidth))))}}>{images.map((src,i)=><div className="gallery-slide" key={`${src}-${i}`} role="group" aria-roledescription="幻灯片" aria-label={`第${i+1}张，共${images.length}张`}><img className="gallery-main" src={src} alt={`${title}图片${i+1}`} draggable={false} loading={i?'lazy':'eager'}/></div>)}</div>
  <span className="gallery-count" aria-live="polite" aria-atomic="true">{active+1} / {images.length}</span>
  {images.length>1&&<><button type="button" className="gallery-arrow previous" aria-label="上一张照片" disabled={active===0} onClick={()=>move(-1)}><ChevronLeft size={22}/></button><button type="button" className="gallery-arrow next" aria-label="下一张照片" disabled={active===images.length-1} onClick={()=>move(1)}><ChevronRight size={22}/></button></>}
 </section>
}
