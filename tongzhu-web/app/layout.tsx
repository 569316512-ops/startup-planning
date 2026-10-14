import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'一起租 · 贵阳租房找室友',description:'原户型两居、三居合租，在贵阳找到合拍的室友。免费发布、找房、找人、一起租。',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>;}
