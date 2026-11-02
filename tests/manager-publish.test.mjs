import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertProjectPaths,publishFiles} from '../dist/manager/github-publish.js';
import {PROJECT_ROOT,targetData,projectLink} from '../dist/manager/config.js';
import {validateGLB,validateMetadata} from '../dist/manager/validation.mjs';
import {stadiumLinks} from '../dist/manager/stadium-links.mjs';
import {applySchedule} from '../dist/manager/schedule-playback.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const id='a87eadcc-b708-4949-885e-d0aede2916a5';
const project=JSON.parse(await readFile('dist/manager/projects/'+id+'/project.json','utf8'));
const files=[{path:PROJECT_ROOT+id+'/project.json',content:JSON.stringify(project)}];
const summary={id,name:'Stadium',revision:'next',baseRevision:'original'};
function github({race=false,stale=false,unauthorized=false}={}) {
 let head='head0',sequence=0,attempts=0;
 const blobs=new Map(),trees=new Map([['tree-head0',{'dist/index.html':'OLD APP','dist/assets/law-office.glb':'OLD MODEL',[PROJECT_ROOT+'other/project.json']:'OTHER PROJECT',[PROJECT_ROOT+'index.json']:'catalog'}]]),commits=new Map();
 blobs.set('catalog',JSON.stringify([{id,revision:stale?'newer':'original',name:'Old'},{id:'other',name:'Other'}]));
 const calls=[];
 const fetcher=async(url,opts)=>{
  const path=url.replace('https://api.github.com/repos/mforoughi/AR-lab','');const body=opts.body?JSON.parse(opts.body):null;calls.push({path,body,method:opts.method});
  const ok=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  if(unauthorized)return ok({},401);
  if(path==='')return ok({permissions:{push:true}});
  if(path==='/git/blobs'){const sha='blob'+sequence++;blobs.set(sha,body.content);return ok({sha});}
  if(path==='/git/ref/heads/main')return ok({object:{sha:head}});
  if(path==='/git/commits/'+head)return ok({tree:{sha:'tree-'+head}});
  if(path.startsWith('/git/trees/')&&opts.method==='GET'){const tree=trees.get(path.split('/')[3].split('?')[0]);return ok({truncated:false,tree:Object.entries(tree).map(([path,sha])=>({path,sha,type:'blob'}))});}
  if(path.startsWith('/git/blobs/'))return ok({content:Buffer.from(blobs.get(path.split('/')[3])).toString('base64')});
  if(path==='/git/trees'){assert.ok(trees.has(body.base_tree));const sha='tree'+sequence++;const tree={...trees.get(body.base_tree)};for(const e of body.tree)tree[e.path]=e.sha;trees.set(sha,tree);return ok({sha});}
  if(path==='/git/commits'){const sha='commit'+sequence++;commits.set(sha,body);return ok({sha});}
  if(path==='/git/refs/heads/main'){
   assert.equal(body.force,false);
   if(race&&attempts++===0){head='head1';trees.set('tree-head1',{...trees.get('tree-head0'),'dist/concurrent.txt':'SOMEONE ELSES WORK'});return ok({},422);}
   const commit=commits.get(body.sha);assert.deepEqual(commit.parents,[head]);head=body.sha;trees.set('tree-'+head,trees.get(commit.tree));return ok({object:{sha:head}});
  }
  throw new Error('Unexpected API request '+path);
 };
 return {fetcher,calls,result:()=>trees.get('tree-'+head),blobs};
}
test('publishing preserves existing apps and unrelated projects in the base tree',async()=>{
 const g=github();await publishFiles({id,files,summary,token:'test-only',fetcher:g.fetcher});
 assert.equal(g.result()['dist/index.html'],'OLD APP');assert.equal(g.result()['dist/assets/law-office.glb'],'OLD MODEL');assert.equal(g.result()[PROJECT_ROOT+'other/project.json'],'OTHER PROJECT');
 const catalog=JSON.parse(g.blobs.get(g.result()[PROJECT_ROOT+'index.json']));assert.equal(catalog.length,2);assert.equal(catalog.find(p=>p.id===id).revision,'next');
});
test('concurrent GitHub updates are preserved on retry without force',async()=>{const g=github({race:true});await publishFiles({id,files,summary,token:'test-only',fetcher:g.fetcher});assert.equal(g.result()['dist/concurrent.txt'],'SOMEONE ELSES WORK');});
test('a stale browser cannot replace another edit to the same project',async()=>{const g=github({stale:true});await assert.rejects(publishFiles({id,files,summary,token:'test-only',fetcher:g.fetcher}),/another browser/);assert.ok(!g.calls.some(c=>c.method==='PATCH'));});
test('invalid authorization does not write any files',async()=>{const g=github({unauthorized:true});await assert.rejects(publishFiles({id,files,summary,token:'test-only',fetcher:g.fetcher}),/authorization/);assert.equal(g.calls.length,1);});
test('path guard refuses traversal, existing-app files and other project IDs',()=>{for(const path of ['dist/index.html',PROJECT_ROOT+id+'/../index.html',PROJECT_ROOT+'other/model.glb','.github/workflows/pages.yml'])assert.throws(()=>assertProjectPaths(id,[...files,{path,content:'bad'}]),/destination/);});
test('sample has 339 separate components and the construction schedule changes visibility',async()=>{
 const bytes=await readFile('dist/manager/projects/'+id+'/model.glb');validateGLB(bytes);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const parts=[];gltf.scene.traverse(mesh=>{if(mesh.isMesh)parts.push({id:'mesh_'+parts.length,mesh,materials:[mesh.material],colors:[mesh.material.color.clone()]});});
 assert.equal(parts.length,339);
 for(const [day,count] of [[0,1],[5,49],[20,97],[30,121],[40,145],[50,241],[60,252],[68,339],[70,339]]){applySchedule(parts,project.metadata,day);assert.equal(parts.filter(p=>p.mesh.visible).length,count);}
 assert.equal(await stadiumLinks(bytes,project.metadata),null,'manual/unlinked edits cannot be relinked automatically');
});
test('bad schedule numbers, duplicate IDs, unknown task links and invalid GLBs fail clearly',()=>{assert.throws(()=>validateMetadata({tasks:[{id:'1',start:0,duration:0}]}));assert.throws(()=>validateMetadata({tasks:[],mappings:{mesh_0:'missing'}}));assert.throws(()=>validateGLB(new Uint8Array(2)));});
test('QR and image target are independent of the old app and ChatGPT',()=>{const url=new URL(projectLink(id));assert.equal(url.origin,'https://mforoughi.github.io');assert.equal(url.pathname,'/AR-lab/manager/viewer.html');assert.equal(url.searchParams.get('ar'),'1');const t=targetData(id,'image.png');assert.deepEqual([t.properties.width,t.properties.height],[480,640]);});
