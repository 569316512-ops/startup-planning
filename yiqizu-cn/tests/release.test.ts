import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,symlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
it('packages_a_preview_candidate_with_verified_checksums_and_no_false_cloud_claim',async()=>{
 execFileSync(process.execPath,['scripts/build-api.mjs'],{stdio:'pipe'});
 execFileSync(process.execPath,['scripts/package-release.mjs'],{stdio:'pipe'});
 const dest=mkdtempSync(path.join(tmpdir(),'yiqizu-preview-'));
 execFileSync('tar',['-xzf','release/yiqizu-cn-preview.tar.gz','-C',dest]);
 expect(execFileSync(process.execPath,[path.join(dest,'VERIFY.mjs')],{encoding:'utf8'})).toContain('Verified');
 const build=JSON.parse(readFileSync(path.join(dest,'BUILD.json'),'utf8'));expect(build.productionReady).toBe(false);expect(build.businessCloudVerified).toBe(false);
 const html=readFileSync(path.join(dest,'static/index.html'),'utf8');expect(html).toContain('/cn-preview/assets/');expect(html).not.toContain('cloudflare');
 const names=execFileSync('tar',['-tzf','release/yiqizu-cn-preview.tar.gz'],{encoding:'utf8'});expect(names).toContain('migrations/0005_operations_cleanup.sql');expect(names).not.toMatch(/node_modules|\.env$|\.pem|\.sqlite|\.git\//);
 symlinkSync(path.resolve('node_modules'),path.join(dest,'functions/yiqizu-api/node_modules'),'junction');
 const handler=createRequire(import.meta.url)(path.join(dest,'functions/yiqizu-api/index'));
 expect((await handler.main({version:1,action:'auth.register',payload:{role:'admin'}})).ok).toBe(false);
},60000);
