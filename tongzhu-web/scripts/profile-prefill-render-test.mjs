// React server rendering only; this does not replace browser/device verification.
import {build} from 'esbuild';import {mkdir,rm} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const file='outputs/profile-prefill-render.mjs';await mkdir('outputs',{recursive:true});
try{await build({stdin:{contents:`
import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {QuickIntake} from './components/quick-intake';
const profile={id:'prefill-user',firstName:'资料里的昵称',age:28,gender:'女',occupation:'设计师',city:'贵阳',district:'观山湖区',budgetMax:1680,moveIn:'2026-11-15',leaseMonths:6,housingPreferences:'希望住处靠近地铁，采光好。',roommateExpectations:'希望室友爱干净，有事愿意沟通。',avatar:'/api/v1/uploads/prefill-user/avatar',contact:{phone:'13800000000',wechat:'prefilltest01',visible:true}};
const props={city:'贵阳',kind:'seeker',authenticated:true,profile,onLogin:()=>{},onBrowse:()=>{}};
const html=renderToStaticMarkup(React.createElement(QuickIntake,props));assert(html.includes('value="资料里的昵称"'),'saved nickname should fill a new publish form');assert(html.includes('value="1680"'));assert(html.includes('prefilltest01'));assert(html.includes(profile.housingPreferences));assert(html.includes('src="'+profile.avatar+'"'));
assert(!html.includes(' checked='),'saved contact visibility must not check this publication consent');
const edited=renderToStaticMarkup(React.createElement(QuickIntake,{...props,editing:{id:'edit-post',updatedAt:'now',data:{kind:'seeker',city:'贵阳',nickname:'原帖称呼',budget:'990',note:'',roommateExpectations:'',contact:'',gender:'不透露'},housing:{},photoIds:[],avatar:'/avatars/male-1.svg'}}));assert(edited.includes('value="原帖称呼"'));assert(edited.includes('value="990"'));assert(!edited.includes('prefilltest01'));assert(!edited.includes(profile.housingPreferences));assert(!edited.includes('src="'+profile.avatar+'"'));
const room=renderToStaticMarkup(React.createElement(QuickIntake,{...props,kind:'room'}));assert(!room.includes(profile.housingPreferences),'seeker housing preference is not a room description');
console.log('PASS saved profile is rendered in a fresh publish form including nickname/budget/contact/housing preference/avatar');
`,resolveDir:process.cwd(),sourcefile:'profile-prefill-render-entry.tsx',loader:'tsx'},outfile:file,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',logLevel:'silent'});await import(pathToFileURL(process.cwd()+'/'+file));}finally{await rm(file,{force:true})}
