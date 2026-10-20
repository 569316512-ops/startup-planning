import {build} from 'esbuild';
import {readFile,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const staticDir=path.join(root,'dist/static');
const functionDir=path.join(root,'dist/functions/yiqizu-capability-probe');
await mkdir(staticDir,{recursive:true});await mkdir(functionDir,{recursive:true});
await build({entryPoints:[path.join(root,'probe/client.ts')],outfile:path.join(staticDir,'probe.js'),bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,legalComments:'external',sourcemap:false});
await build({entryPoints:[path.join(root,'probe/entry.ts')],outfile:path.join(functionDir,'index.cjs'),bundle:true,platform:'node',format:'cjs',target:'node20',packages:'external',sourcemap:false});
await copyFile(path.join(root,'probe/index.html'),path.join(staticDir,'index.html'));
await copyFile(path.join(root,'probe/probe.css'),path.join(staticDir,'probe.css'));
// The function has a real lockfile. Install only runtime deps in WorkBuddy, never dev/test deps.
await writeFile(path.join(functionDir,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,private:true,type:'commonjs',main:'index.cjs',engines:{node:'>=20'},dependencies:pkg.dependencies,devDependencies:pkg.devDependencies},null,2)+'\n');
await copyFile(path.join(root,'package-lock.json'),path.join(functionDir,'package-lock.json'));
console.log('Probe browser assets and CommonJS function built; no CloudBase deployment performed.');
