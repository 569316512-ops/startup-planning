// Local API integration runtime for the already-built Worker; no production bindings.
import {Miniflare} from 'miniflare';
import path from 'node:path';
import {globSync} from 'node:fs';
const root=process.cwd();
const mf=new Miniflare({
 name:'contact-integration',modules:['index.js',...globSync('**/*.{js,mjs}',{cwd:path.join(root,'dist/server')}).filter(p=>p!=='index.js')].map(file=>({type:'ESModule',path:path.join(root,'dist/server',file)})),modulesRoot:path.join(root,'dist/server'),
 compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],host:'127.0.0.1',port:5188,
 d1Databases:{DB:'00000000-0000-4000-8000-000000000000'},d1Persist:path.join(root,'.wrangler/contact-tests/v3/d1'),
 r2Buckets:{BUCKET:'site-creator-r2'},r2Persist:path.join(root,'.wrangler/contact-tests/v3/r2'),
 bindings:{PILOT_OWNER_EMAIL:'pilot-owner@test.local'},
 ...(process.env.CONTACT_BROWSER_QA==='1'?{assets:{directory:path.join(root,'dist/client'),routerConfig:{has_user_worker:true}}}:{}),
});
console.log('Local integration runtime:',String(await mf.ready));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await mf.dispose();process.exit(0)});
