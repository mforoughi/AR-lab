import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTrackingRecovery, advanceDay, targetAlignment} from '../dist/ar-state.js';
function clock() {
 let now=0,id=0;const pending=new Map();
 return {setTimer(fn,delay){pending.set(++id,{fn,at:now+delay});return id;},clearTimer(id){pending.delete(id);},advance(ms){now+=ms;for(const [id,item] of [...pending])if(item.at<=now){pending.delete(id);item.fn();}},count:()=>pending.size};
}
test('brief loss is cancelled by reacquisition; sustained loss requests exactly one restart',()=>{
 const c=clock();let restarts=0;const r=createTrackingRecovery({...c,onRecover:()=>restarts++});
 r.lost();c.advance(8000);assert.equal(restarts,0,'initial scan must not cause a restart loop');
 r.found();r.lost();c.advance(4000);r.found();c.advance(4000);assert.equal(restarts,0);
 r.lost();r.lost();assert.equal(c.count(),1);c.advance(7000);assert.equal(restarts,1);
 c.advance(70000);r.lost();assert.equal(restarts,1);assert.equal(c.count(),0);
});
test('stopping a session cancels recovery and ignores late engine events',()=>{
 const c=clock();let restarts=0;const r=createTrackingRecovery({...c,onRecover:()=>restarts++});
 r.found();r.lost();r.stop();r.found();r.lost();c.advance(20000);assert.equal(restarts,0);assert.equal(c.count(),0);
});
test('normal playback spans 90 workdays in 25 tracked seconds and pauses during tracking loss',()=>{
 let day=0;for(let i=0;i<250;i++)day=advanceDay(day,.1,3.6,90,true);
 assert.ok(Math.abs(day-90)<1e-9);
 assert.equal(advanceDay(30,.1,3.6,90,false),30);
 assert.equal(advanceDay(90,.1,14.4,90,true),90);
 assert.equal(advanceDay(30,60,3.6,90,true),30.36,'returning from background must not skip the schedule');
});
test('poster calibration maps the same physical footprint to its printed plan',async()=>{
 const info=JSON.parse(await readFile(new URL('../dist/assets/model-info.json',import.meta.url)));
 const poster=JSON.parse(await readFile(new URL('../dist/image-targets/law-office-poster.json',import.meta.url)));
 const a=targetAlignment(poster,info),p=poster.metadata.plan;
 const W=poster.properties.width,H=poster.properties.height;
 const centreX=info.plan.left+(info.plan.right-info.plan.left)/2;
 const centreY=info.plan.top+(info.plan.bottom-info.plan.top)/2;
 const originX=(a.x+.5)*W,originY=H/2-a.y*W;
 assert.ok(Math.abs(originX-(p.x+centreX*p.width/info.plan.width))<1e-7);
 assert.ok(Math.abs(originY-(p.y+centreY*p.width/info.plan.width))<1e-7);
 assert.ok(Math.abs(a.scale*W*info.width-(info.plan.right-info.plan.left)*p.width/info.plan.width)<1e-6);
 const legacy=targetAlignment({},info);assert.equal(legacy.scale,info.pixelsPerMetre/774);
});
