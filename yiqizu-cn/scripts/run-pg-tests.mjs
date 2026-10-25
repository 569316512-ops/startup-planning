import {spawnSync} from 'node:child_process';
// Never silently connect to a real environment or skip integration checks.
const raw=process.env.TEST_DATABASE_URL;
if(!raw)throw new Error('Set explicit isolated TEST_DATABASE_URL');
const u=new URL(raw);
if(u.protocol!=='docker:'||!/^yiqizu-probe-pg-\d+$/.test(u.hostname)||!/^\/yiqizu_test_[a-z_]+$/.test(u.pathname))throw new Error('Only the dedicated local test container/database is permitted');
const args=process.argv.slice(2);
const r=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...(args.length?args:['tests/schema.pg.test.ts'])],{stdio:'inherit',env:process.env});
process.exit(r.status??1);
