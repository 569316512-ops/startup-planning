import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {recordContactView} from '../lib/contact-access.ts';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec("CREATE TABLE users (id TEXT PRIMARY KEY,member_until TEXT); INSERT INTO users (id) VALUES ('viewer');");
sqlite.exec('CREATE TABLE contact_views (viewer_id TEXT,day TEXT,target_hash TEXT,created_at TEXT,PRIMARY KEY(viewer_id,day,target_hash))');
const db={
 first:async(sql,...args)=>sqlite.prepare(sql).get(...args)||null,
 run:async(sql,...args)=>sqlite.prepare(sql).run(...args),
 sha:async s=>createHash('sha256').update(s).digest('hex'),
 // Request pacing is exercised by HTTP integration; this test isolates the calendar quota.
 throttle:async()=>{},
};
const NativeDate=Date;
let clock='2026-10-16T15:59:59.000Z';
globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return new NativeDate(clock).getTime();}};
try{
 const request=new Request('http://localhost/contact');
 for(let i=0;i<5;i++)assert.equal(await recordContactView(request,'viewer','wechat:'+i,db),true);
 assert.equal(await recordContactView(request,'viewer','wechat:6',db),false);
 assert.equal(sqlite.prepare('SELECT DISTINCT day FROM contact_views').get().day,'2026-10-16');
 clock='2026-10-16T16:00:00.000Z';
 assert.equal(await recordContactView(request,'viewer','wechat:6',db),true);
 assert.deepEqual(sqlite.prepare('SELECT DISTINCT day FROM contact_views ORDER BY day').all().map(row=>row.day),['2026-10-16','2026-10-17']);
 console.log('PASS: five-person quota resets at Shanghai midnight, not UTC midnight');
}finally{globalThis.Date=NativeDate;sqlite.close();}
