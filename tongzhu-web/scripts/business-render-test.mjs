// Actual React server render of cards and the full-publish role selector, not browser/device QA.
import {build} from 'esbuild';
import {mkdir,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const output='outputs/business-render-check.mjs';await mkdir('outputs',{recursive:true});
try{await build({stdin:{contents:`
import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {PostCard} from './components/catalog-feedback';import {PublishForm,blankProfile} from './components/forms-feedback';
const r=await fetch('http://127.0.0.1:5188/api/v1/listings?demo=0');assert(r.ok);const {items}=await r.json();
for(const [role,label] of [['landlord','房东'],['agent','中介 / 经纪人']]){
 const post=items.find(p=>p.housingState===role);assert(post,'run landlord-agent-test first');
 const html=renderToStaticMarkup(React.createElement(PostCard,{post,onOpen:()=>{},onFavorite:()=>{}}));assert(html.includes(label));assert(html.includes('发布者自述'));assert(!html.includes('人工身份核验通过'));
 const form=renderToStaticMarkup(React.createElement(PublishForm,{user:{...blankProfile,id:'render-user'},initial:{kind:'room',housingState:role},onSubmit:async()=>{},onError:()=>{}}));const option=form.match(new RegExp('<option[^>]*value="'+role+'"[^>]*>'))?.[0];assert(option);assert(!option.includes('disabled'));assert(form.includes('无需先完善个人资料'));
}console.log('PASS business card labels, no verified badge, full-publish role choices for incomplete profiles');
`,resolveDir:process.cwd(),loader:'tsx',sourcefile:'business-render-entry.tsx'},outfile:output,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',logLevel:'silent'});await import(pathToFileURL(process.cwd()+'/'+output))}finally{await rm(output,{force:true})}
