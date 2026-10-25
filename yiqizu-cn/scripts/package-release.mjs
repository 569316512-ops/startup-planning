import {mkdir,mkdtemp,copyFile,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
const stage=await mkdtemp(path.join(tmpdir(),'yiqizu-cn-stage-'));
async function copyTree(from,to){await mkdir(to,{recursive:true});for(const e of await readdir(from,{withFileTypes:true})){if(e.isSymbolicLink())throw new Error('No symlink artifacts');if(e.isDirectory())await copyTree(path.join(from,e.name),path.join(to,e.name));else await copyFile(path.join(from,e.name),path.join(to,e.name))}}
await copyTree('dist/h5',path.join(stage,'static'));
await copyTree('dist/functions/yiqizu-api',path.join(stage,'functions/yiqizu-api'));
await copyTree('migrations',path.join(stage,'migrations'));
await copyFile('docs/deploy-workbuddy.md',path.join(stage,'DEPLOY.md'));
await copyFile('scripts/verify-package.mjs',path.join(stage,'VERIFY.mjs'));
const evidence=JSON.parse(await readFile('../validation/cloudbase-platform-evidence.json','utf8'));
if(evidence.environmentId!=='yiqizu-mvp-test-d4fa3kk6dc43ea64'||evidence.capabilityGate!=='passed-equivalent-real-calls')throw new Error('Platform capability report missing/failed');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await writeFile(path.join(stage,'BUILD.json'),JSON.stringify({purpose:'controlled-preview-candidate',sourceCommit:source,environmentId:evidence.environmentId,contract:1,previewBase:'/cn-preview/',platformEvidenceSource:evidence.source,productionReady:false,businessCloudVerified:false,realPhoneVerified:false},null,2)+'\n');
async function list(dir,base=''){const names=[];for(const e of await readdir(dir,{withFileTypes:true})){const name=path.posix.join(base,e.name);if(e.isDirectory())names.push(...await list(path.join(dir,e.name),name));else names.push(name)}return names.sort()}
const sums=[];
for(const name of await list(stage)){
 if(!/^(static\/|functions\/yiqizu-api\/|migrations\/|DEPLOY.md$|VERIFY.mjs$|BUILD.json$)/.test(name)||/(^|\/)(node_modules|\.env|\.git)(\/|$)|\.(pem|key|sqlite)$/.test(name))throw new Error('Forbidden artifact');
 const data=await readFile(path.join(stage,name));
 // SDK's own environment detector mentions Cloudflare; reject actual legacy endpoints, not that inert string.
 if(name.startsWith('static/')&&/CLOUDBASE_APIKEY|PROBE_TOKEN|password_hash|password_salt|workers\.dev|coppershark1\.chatgpt\.site|\/api\/v1\//.test(data.toString()))throw new Error('Server-only data or legacy endpoints in static bundle');
 sums.push(createHash('sha256').update(data).digest('hex')+'  '+name);
}
await writeFile(path.join(stage,'SHA256SUMS'),sums.join('\n')+'\n');await mkdir('release',{recursive:true});
execFileSync('tar',['-czf','release/yiqizu-cn-preview.tar.gz','-C',stage,'.']);
const hash=createHash('sha256').update(await readFile('release/yiqizu-cn-preview.tar.gz')).digest('hex');await writeFile('release/yiqizu-cn-preview.tar.gz.sha256',hash+'  yiqizu-cn-preview.tar.gz\n');
console.log('Preview candidate packaged. NOT cloud/phone accepted. SHA256 '+hash);
