import assert from 'node:assert/strict';
import {pilotSource} from '../lib/pilot-client.ts';
for(const source of ['wechat_group','xiaohongshu','douyin']){
 globalThis.window={location:{search:'?src='+source}};
 assert.equal(pilotSource(),source,`Preserve ${source} channel on arrival`);
}
globalThis.window={location:{search:'?src=unknown'}};
assert.equal(pilotSource(),'direct');
console.log('PASS all three distribution channels and unknown-source fallback');
