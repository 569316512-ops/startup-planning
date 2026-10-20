import {mkdir,mkdtemp,copyFile,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage=await mkdtemp(path.join(tmpdir(),'yiqizu-probe-package-'));
const copies=[
 ['dist/static/index.html','static/index.html'],['dist/static/probe.js','static/probe.js'],['dist/static/probe.css','static/probe.css'],
 ['dist/functions/yiqizu-capability-probe/index.js','functions/yiqizu-capability-probe/index.js'],
 ['dist/functions/yiqizu-capability-probe/package.json','functions/yiqizu-capability-probe/package.json'],
 ['dist/functions/yiqizu-capability-probe/package-lock.json','functions/yiqizu-capability-probe/package-lock.json'],
 ['probe/schema.sql','sql/schema.sql'],['probe/DEPLOY.md','DEPLOY.md'],['scripts/verify-package.mjs','VERIFY.mjs'],
];
for(const [src,dst] of copies){await mkdir(path.dirname(path.join(stage,dst)),{recursive:true});await copyFile(path.join(root,src),path.join(stage,dst))}
try{await copyFile(path.join(root,'dist/static/probe.js.LEGAL.txt'),path.join(stage,'static/probe.js.LEGAL.txt'))}catch(e){if(e.code!=='ENOENT')throw e}
let commit='unavailable';try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()}catch{}
await writeFile(path.join(stage,'BUILD.json'),JSON.stringify({purpose:'isolated-capability-probe',environmentId:'yiqizu-mvp-test-d4fa3kk6dc43ea64',sourceCommit:commit,contract:1,webSdk:'3.10.3',nodeSdk:'3.18.7',productionReady:false,realCloudVerified:false},null,2)+'\n');
async function list(dir,base=''){const names=[];for(const e of await readdir(dir,{withFileTypes:true})){const name=path.posix.join(base,e.name);if(e.isDirectory())names.push(...await list(path.join(dir,e.name),name));else names.push(name)}return names.sort()}
const sums=[];
for(const name of await list(stage)){
 if(/(^|\/)(node_modules|\.env|\.git|\.superpowers)(\/|$)|\.(pem|sqlite|key)$/.test(name))throw new Error('Forbidden artifact');
 const data=await readFile(path.join(stage,name));
 if(data.length>10*1024*1024)throw new Error('Oversized artifact');
 sums.push(createHash('sha256').update(data).digest('hex')+'  '+name);
}
await writeFile(path.join(stage,'SHA256SUMS'),sums.join('\n')+'\n');
const out=path.join(root,'release');await mkdir(out,{recursive:true});
const archive=path.join(out,'yiqizu-cloudbase-probe.tar.gz');
execFileSync('tar',['-czf',archive,'-C',stage,'.']);
const hash=createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(archive+'.sha256',hash+'  yiqizu-cloudbase-probe.tar.gz\n');
console.log('Capability probe archive created:',archive);console.log('SHA256:',hash);
