import {spawnSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
if(!process.env.TEST_DATABASE_URL||!process.env.CN_PROBE_PG_CONTAINER)throw new Error('Release requires explicit local PostgreSQL fixtures; skipped PG tests cannot release');
const u=new URL(process.env.TEST_DATABASE_URL);
if(u.protocol!=='docker:'||!/^yiqizu-probe-pg-\d+$/.test(u.hostname)||!/^\/yiqizu_test_[a-z_]+$/.test(u.pathname))throw new Error('Refuse non-test database');
await mkdir('release',{recursive:true});
for(const args of [['node_modules/typescript/bin/tsc','--noEmit'],['node_modules/vite/bin/vite.js','build'],['scripts/build-api.mjs'],['node_modules/vitest/vitest.mjs','run'],['scripts/package-release.mjs']]){
 const r=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});if(r.status!==0)process.exit(r.status??1);
}
console.log('Local verification passed. Candidate still requires WorkBuddy cloud and phone acceptance.');
