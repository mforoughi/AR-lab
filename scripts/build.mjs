import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const assets=JSON.parse(await readFile('encoded-assets/manifest.json','utf8'));
for(const asset of assets){
 const data=Buffer.from(await readFile(asset.source,'utf8'),'base64');
 if(createHash('sha256').update(data).digest('hex')!==asset.sha256)throw new Error('Asset integrity check failed: '+asset.destination);
 await mkdir(dirname(asset.destination),{recursive:true});await writeFile(asset.destination,data);
}
await import('./prepare-poster.mjs');
await mkdir('dist/vendor/8thwall',{recursive:true});
await cp('node_modules/@8thwall/engine/dist','dist/vendor/8thwall',{recursive:true});
await cp('node_modules/@8thwall/engine/LICENSE','dist/vendor/8thwall/LICENSE');
console.log('Built AR Lab: verified assets and copied 8th Wall engine.');
