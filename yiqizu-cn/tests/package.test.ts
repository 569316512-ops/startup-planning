import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {describe,it,expect,beforeAll} from 'vitest';
const require=createRequire(import.meta.url);
describe('deployable probe artifact',()=>{
 beforeAll(()=>{
  execFileSync(process.execPath,['scripts/build-functions.mjs'],{stdio:'pipe'});
  execFileSync(process.execPath,['scripts/package-probe.mjs'],{stdio:'pipe'});
 },60000);
 it('builds_a_real_callable_commonjs_function_without_cloud_credentials',async()=>{
  const {main}=require('../dist/functions/yiqizu-capability-probe/index.cjs');
  expect((await main({action:'health'})).ok).toBe(true);
  const r=await main({action:'prepare'});expect(r.ok).toBe(false);expect(r.error.status).toBe(401);
 });
 it('packages_only_allowlisted_artifacts_and_checksum_manifest',()=>{
  const archive='release/yiqizu-cloudbase-probe.tar.gz';expect(existsSync(archive)).toBe(true);
  const names=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).split('\n');
  expect(names).toContain('./SHA256SUMS');expect(names).toContain('./static/index.html');
  expect(names).toContain('./functions/yiqizu-capability-probe/index.cjs');
  expect(names).toContain('./sql/schema.sql');expect(names).toContain('./DEPLOY.md');
  expect(names.join('\n')).not.toMatch(/node_modules|\.env$|\.sqlite|\.superpowers|tongzhu-web|\.pem/);
 });
 it('browser_bundle_does_not_contain_server_credentials_or_node_sdk',()=>{
  const s=readFileSync('dist/static/probe.js','utf8');
  expect(s).not.toContain('CLOUDBASE_APIKEY');expect(s).not.toContain('process.env.PROBE_TOKEN');
  expect(s).not.toContain('@cloudbase/node-sdk');
  const page=readFileSync('dist/static/index.html','utf8');
  expect(page).toContain('./probe.js');expect(page).not.toMatch(/https:.*<script/);
 });
});
