// Rebuild only the manager's sample project; never touch the original AR app.
import sharp from 'sharp';
import QRCode from 'qrcode';
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {stadiumLinks} from '../../dist/manager/stadium-links.mjs';
import {parseCSV} from '../../dist/manager/common.js';
import {projectLink} from '../../dist/manager/config.js';
const id='a87eadcc-b708-4949-885e-d0aede2916a5',dir='dist/manager/projects/'+id;
// Refuse to overwrite any catalog that has been edited or expanded since this seed.
try {
 const existing=JSON.parse(await readFile('dist/manager/projects/index.json','utf8'));
 if(existing.length!==1||existing[0].id!==id||existing[0].revision!=='471dc342-61f5-40c4-b34d-23e2dd75b911')throw new Error('The manager catalog contains later work. Sample regeneration was stopped.');
} catch(error) {if(error.code!=='ENOENT')throw error;}
await mkdir(dir,{recursive:true});
const base='dist/manager/examples/';
const tasks=parseCSV(await readFile(base+'stadium-schedule.csv','utf8'));
const metadata={tasks,mappings:await stadiumLinks(await readFile(base+'stadium.glb'),{tasks,mappings:{}}),stadiumScheduleLinked:true,alignment:{width:.7,x:0,y:0,rotation:0},description:'Soccer stadium concept · eight construction tasks, 70 workdays. Educational demonstration schedule.'};
const plan=await readFile(base+'stadium-plan.png'),image=await sharp(plan).metadata();
const fit=Math.min(840/image.width,820/image.height),w=image.width*fit,h=image.height*fit;
const qr=await QRCode.toString(projectLink(id),{type:'svg',width:170,margin:3,errorCorrectionLevel:'M'});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1280"><rect width="960" height="1280" fill="white"/><rect width="960" height="166" fill="#183c35"/><g font-family="DejaVu Sans,sans-serif"><text x="42" y="45" fill="#d6b56c" font-size="20" font-weight="bold">CONSTRUCTION AR LAB</text><text x="42" y="105" fill="white" font-size="38" font-weight="bold">stadium_1</text><text x="42" y="143" fill="white" font-size="17">MODEL / DRAWING / TIME</text><image href="data:image/png;base64,${plan.toString('base64')}" x="${(960-w)/2}" y="${200+(820-h)/2}" width="${w}" height="${h}"/><rect x="40" y="190" width="880" height="840" fill="none" stroke="#183c35" stroke-width="4"/><rect y="1080" width="960" height="200" fill="#183c35"/><image href="data:image/svg+xml;base64,${Buffer.from(qr).toString('base64')}" x="750" y="1095" width="170" height="170"/><g fill="white"><text x="42" y="1130" font-size="23" font-weight="bold">SCAN TO EXPLORE</text><text x="42" y="1170" font-size="18">Allow camera access. Keep the whole sheet in view.</text><text x="42" y="1210" font-size="18">Dr. Mohsen Foroughi</text><text x="42" y="1240" font-size="14">School of Construction and Design · USM</text></g></g></svg>`;
await sharp(Buffer.from(svg)).png().toFile(dir+'/sheet.png');
await sharp(dir+'/sheet.png').resize(480,640).grayscale().png().toFile(dir+'/target.png');
await QRCode.toFile(dir+'/qr.png',projectLink(id),{width:640,margin:4});
const assets=[];
for(const [kind,source,name,type]of [['model','stadium.glb','model.glb','model/gltf-binary'],['plan','stadium-plan.png','plan.png','image/png'],['thumbnail','stadium-preview.png','thumbnail.png','image/png'],['schedule','stadium-schedule.csv','schedule.csv','text/csv'],['sheet',null,'sheet.png','image/png'],['target',null,'target.png','image/png']]){
 if(source)await copyFile(base+source,dir+'/'+name);
 assets.push({kind,filename:name,type,size:(await stat(dir+'/'+name)).size,href:'projects/'+id+'/'+name});
}
const p={id,name:'stadium_1',folder:'Stadiums',status:'published',metadata,assets,created:'2026-11-02T16:30:26.327Z',updated:'2026-11-02T19:00:00.000Z',revision:'471dc342-61f5-40c4-b34d-23e2dd75b911'};
await writeFile(dir+'/project.json',JSON.stringify(p,null,2)+'\n');
await writeFile('dist/manager/projects/index.json',JSON.stringify([{...p,assets:assets.filter(a=>a.kind==='thumbnail'),metadata:{tasks}}],null,2)+'\n');
console.log('Prepared stadium sample with '+Object.keys(metadata.mappings).length+' linked components.');
