import type { Metadata,Viewport } from 'next';
import './globals.css';
import './mobile.css';
import './intake.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',interactiveWidget:'resizes-content'};
export const metadata: Metadata={title:'一起租 · 租房找室友',description:'原户型两居、三居合租，在上海、北京、深圳、杭州、广州、成都、重庆、贵阳找到合拍的室友。免费发布、找房、找人、一起租。',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>;}
