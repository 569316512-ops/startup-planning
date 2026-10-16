import {DatabaseSync} from 'node:sqlite';
import {globSync} from 'node:fs';
import assert from 'node:assert/strict';
export function localSQL(sql,args=[]){const paths=globSync('.wrangler/member-tests/v3/d1/miniflare-D1DatabaseObject/*.sqlite').filter(x=>!x.endsWith('/metadata.sqlite'));assert.equal(paths.length,1,'Dedicated local member fixture DB only');const db=new DatabaseSync(paths[0]);try{db.exec('PRAGMA busy_timeout=15000');return db.prepare(sql).run(...args)}finally{db.close()}}
export const resetRates=()=>localSQL('DELETE FROM rate_limits');
export const grantFixtureMember=id=>localSQL('UPDATE users SET member_until=? WHERE id=?',[new Date(Date.now()+86400000).toISOString(),id]);
