import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const manifest=await readFile(path.join(root,'SHA256SUMS'),'utf8');let count=0;
for(const line of manifest.trim().split('\n')){
 const m=/^([0-9a-f]{64})  ([A-Za-z0-9._/-]+)$/.exec(line);
 if(!m||m[2].startsWith('/')||m[2].split('/').includes('..'))throw new Error('Invalid checksum entry');
 const actual=createHash('sha256').update(await readFile(path.join(root,m[2]))).digest('hex');
 if(actual!==m[1])throw new Error('Checksum mismatch: '+m[2]);count++;
}
console.log(`Verified ${count} packaged files. This verifies integrity, not CloudBase functionality.`);
