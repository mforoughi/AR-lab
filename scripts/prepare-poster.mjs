import sharp from 'sharp';
import QRCode from 'qrcode';
import {readFile,writeFile} from 'node:fs/promises';
import {applyCrop} from '../node_modules/@8thwall/image-target-cli/src/apply.js';
import {tasks,totalDays} from '../dist/schedule-data.js';
const width=1800,height=2400;
const info=JSON.parse(await readFile('dist/assets/model-info.json','utf8'));
const plan={x:120,y:345,width:1560,height:660*1560/773};
const planURI='data:image/png;base64,'+(await readFile('dist/assets/law-office-plan.png')).toString('base64');
const modelURI='data:image/jpeg;base64,'+(await readFile('dist/assets/poster-model.jpg')).toString('base64');
const url='https://mforoughi.github.io/AR-lab/?sheet=poster';
const qr=await QRCode.toString(url,{type:'svg',errorCorrectionLevel:'M',margin:4});
const qrURI='data:image/svg+xml;base64,'+Buffer.from(qr).toString('base64');
const bars=tasks.filter(t=>t.hasGeometry).map((t,i)=>{
 const y=1870+i*44;
 return `<text x="805" y="${y+21}" font-size="20">${t.id.toString().padStart(2,'0')}</text><rect x="${855+t.start/totalDays*360}" y="${y}" width="${t.duration/totalDays*360}" height="25" rx="3" fill="${i%2?'#c79326':'#234f46'}"/>`;
}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="1800" height="2400" fill="#fff"/>
<g font-family="DejaVu Sans, sans-serif" fill="#193a33">
<rect width="1800" height="285" fill="#193a33"/><path d="M1470 0H1800V285H1670Z" fill="#d6a442"/>
<text x="90" y="68" fill="#e8d2a0" font-size="26" letter-spacing="4">CONSTRUCTION AR LAB / 01</text>
<text x="85" y="166" fill="white" font-size="82" font-weight="bold">LAW OFFICE</text>
<text x="90" y="226" fill="#fff" font-size="30">Your drawing. Your building. Through time.</text>
<text x="1600" y="105" font-size="42" font-weight="bold">4D</text><text x="1624" y="171" font-size="30">AR</text>
<text x="120" y="322" font-size="23" letter-spacing="3">GROUND FLOOR / MODEL ALIGNMENT PLAN</text>
<image href="${planURI}" x="${plan.x}" y="${plan.y}" width="${plan.width}" height="${plan.height}"/>
<path d="M100 420V340H180M1620 340H1700V420M100 1590V1670H180M1620 1670H1700V1590" fill="none" stroke="#193a33" stroke-width="9"/>
<text x="120" y="1722" font-size="24">Dr. Mohsen Foroughi · School of Construction and Design</text>
<text x="120" y="1762" font-size="23">The University of Southern Mississippi</text>
<rect x="90" y="1810" width="660" height="450" rx="12" fill="#f1f2ea"/>
<image href="${modelURI}" x="105" y="1820" width="630" height="385" preserveAspectRatio="xMidYMid meet"/>
<text x="120" y="2231" font-size="21" font-weight="bold">YOUR MODEL / COMPLETE BUILDING</text>
<text x="800" y="1845" font-size="24" font-weight="bold">BUILD SEQUENCE</text>
<path d="M855 1865V2185M1035 1865V2185M1215 1865V2185" stroke="#cbd5c9" stroke-width="2"/>
${bars}
<text x="805" y="2225" font-size="21">90 workdays · draft schedule</text>
<rect x="1280" y="1810" width="430" height="450" rx="12" fill="#193a33"/>
<image href="${qrURI}" x="1310" y="1840" width="370" height="370"/>
<text x="1330" y="2240" font-size="22" font-weight="bold" fill="white">SCAN TO OPEN AR</text>
<rect x="0" y="2300" width="1800" height="100" fill="#d6a442"/>
<text x="90" y="2343" font-size="23" font-weight="bold">Scan → allow camera → view the whole sheet → press Play</text>
<text x="90" y="2378" font-size="20">Keep flat and well lit. Print the full poster without cropping. Powered by 8th Wall.</text>
</g></svg>`;
await sharp(Buffer.from(svg)).png().toFile('dist/assets/tracking-poster.png');
const geometry={left:0,top:0,width,height,isRotated:false,originalWidth:width,originalHeight:height};
const {dataPath}=await applyCrop(sharp('dist/assets/tracking-poster.png'),{type:'PLANAR',geometry},'dist/image-targets','law-office-poster',true);
const target=JSON.parse(await readFile(dataPath,'utf8'));
const ratio=plan.width/info.plan.width;
const originX=plan.x+(info.plan.left+info.plan.right)/2*ratio;
const originY=plan.y+(info.plan.top+info.plan.bottom)/2*ratio;
target.metadata={plan,alignment:{scale:info.pixelsPerMetre*ratio/width,x:(originX-width/2)/width,y:(height/2-originY)/width}};
target.created=0;target.updated=0;
await writeFile(dataPath,JSON.stringify(target,null,2)+'\n');
console.log('Prepared full-poster target with calibrated model placement.');
