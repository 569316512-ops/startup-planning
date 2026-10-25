import {build} from 'esbuild';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
const pkg=JSON.parse(await readFile('package.json','utf8')),out='dist/functions/yiqizu-api';
await mkdir(out,{recursive:true});
await build({entryPoints:['server/entry.ts'],outfile:`${out}/index.js`,bundle:true,platform:'node',format:'cjs',target:'node20',packages:'external',sourcemap:false});
await writeFile(`${out}/package.json`,JSON.stringify({...pkg,type:'commonjs',main:'index.js',engines:{node:'>=20'},scripts:{}},null,2)+'\n');
await copyFile('package-lock.json',`${out}/package-lock.json`);
console.log('Built yiqizu-api index.main; no deployment.');
