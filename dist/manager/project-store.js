import {BASE,PROJECT_ROOT,validId,targetData} from './config.js';
import {validateGLB,validateMetadata} from './validation.mjs';
import {stadiumLinks} from './stadium-links.mjs';
import {base64,publishFiles} from './github-publish.js';

const urls=new Map();
let database,publisher;
const defaults=()=>({tasks:[],mappings:{},alignment:{width:.7,x:0,y:0,rotation:0},description:''});
export function configurePublisher(fn){publisher=fn;}
function db(){return database||=(new Promise((resolve,reject)=>{const r=indexedDB.open('construction-ar-github-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('projects',{keyPath:'id'});r.result.createObjectStore('assets',{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Browser storage is unavailable. Use a regular browser window.'));}));}
async function transaction(store,mode,operation){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(store,mode);const request=operation(tx.objectStore(store));tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(new Error(tx.error?.name==='QuotaExceededError'?'Browser storage is full. Export your drafts before clearing storage.':'The browser could not save this draft.'));tx.onabort=tx.onerror;});}
const local=id=>transaction('projects','readonly',s=>s.get(id));
const put=p=>transaction('projects','readwrite',s=>s.put(p));
async function json(url){const r=await fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(r.status===404?'This project is not published yet. Open its draft in the dashboard, or wait for the GitHub Pages deployment.':'Project download failed. Retry when connected.');return r.json();}
export async function catalog(){return json(new URL('projects/index.json',BASE));}
function urlForAsset(id,a){return new URL(a.href||('projects/'+id+'/'+a.filename),BASE).href;}
async function prepare(p,draft){for(const a of p.assets||[]){const key=p.id+'/'+a.kind;const saved=draft&&await transaction('assets','readonly',s=>s.get(key));const previous=urls.get(key);if(previous?.startsWith('blob:'))URL.revokeObjectURL(previous);urls.set(key,saved?URL.createObjectURL(saved.blob):urlForAsset(p.id,a));}return p;}
export function asset(id,kind){return urls.get(id+'/'+kind)||new URL('missing-asset',BASE).href;}
export async function getProject(id,{draft=false}={}){validId(id);let p=draft&&await local(id);if(!p)p=await json(new URL('projects/'+id+'/project.json',BASE));p.metadata=validateMetadata(p.metadata);return prepare(p,draft);}
export async function listProjects(){const drafts=await transaction('projects','readonly',s=>s.getAll());let published;try{published=await catalog();}catch(e){if(!drafts.length)throw e;published=[];document.dispatchEvent(new CustomEvent('manager-status',{detail:'Offline: showing drafts saved in this browser.'}));}const rows=new Map(published.map(p=>[p.id,p]));for(const p of drafts)rows.set(p.id,p);for(const p of rows.values()){const a=p.assets?.find(a=>a.kind==='thumbnail');if(a){const saved=await transaction('assets','readonly',s=>s.get(p.id+'/thumbnail'));const key=p.id+'/thumbnail';if(urls.get(key)?.startsWith('blob:'))URL.revokeObjectURL(urls.get(key));urls.set(key,saved?URL.createObjectURL(saved.blob):urlForAsset(p.id,a));}}return [...rows.values()];}
export async function createProject(input){const now=new Date().toISOString();const p={id:crypto.randomUUID(),name:String(input.name||'New project').trim().slice(0,120),folder:String(input.folder||'').slice(0,80),status:'draft',metadata:defaults(),assets:[],created:now,updated:now};if(!p.name)throw new Error('Enter a project name.');await put(p);return p;}
export async function saveProject(id,input){let p=await getProject(id,{draft:true});if(input.status==='published')return publishProject(p);p={...p,...input,id,metadata:validateMetadata(input.metadata||p.metadata),updated:new Date().toISOString()};p.name=String(p.name||'').trim().slice(0,120);p.folder=String(p.folder||'').slice(0,80);if(!p.name)throw new Error('Enter a project name.');if(p.status==='published')p.status='draft';p.baseRevision=p.baseRevision||p.revision;p.hasPublished=Boolean(p.hasPublished||p.revision);await put(p);return p;}
export async function putAsset(id,kind,blob){
  const limits={model:30,plan:5,schedule:1,thumbnail:5,sheet:5,target:5};
  if(!(kind in limits)||!blob?.size||blob.size>limits[kind]*1048576)throw new Error('This '+kind+' file is empty or exceeds '+limits[kind]+' MB.');
  let p=await getProject(id,{draft:true});
  if(p.status==='published')throw new Error('Choose Edit published project before replacing files.');
  if(kind==='model')validateGLB(new Uint8Array(await blob.arrayBuffer()));
  if(['plan','thumbnail','sheet','target'].includes(kind)){
    if(!['image/png','image/jpeg'].includes(blob.type))throw new Error('Use a PNG or JPEG image.');
    const image=await createImageBitmap(blob);const good=kind!=='target'||(image.width===480&&image.height===640);image.close();if(!good)throw new Error('Generate a 480 × 640 tracking image.');
  }
  const invalidated=kind==='plan'?['sheet','target']:kind==='model'?['thumbnail']:[];
  for(const k of invalidated)await transaction('assets','readwrite',s=>s.delete(id+'/'+k));
  p.assets=p.assets.filter(a=>a.kind!==kind&&!invalidated.includes(a.kind));
  if(kind==='model')p.metadata={...p.metadata,mappings:{},stadiumScheduleLinked:false};
  if(kind==='plan')p.sheetURL=null;
  await transaction('assets','readwrite',s=>s.put({key:id+'/'+kind,blob}));
  p.assets.push({kind,filename:blob.name||kind+(blob.type==='image/jpeg'?'.jpg':'.png'),size:blob.size,type:blob.type||'application/octet-stream'});
  p.updated=new Date().toISOString();await put(p);return prepare(p,true);
}
export async function autoLink(id){const p=await getProject(id,{draft:true});if(p.metadata.stadiumScheduleLinked||!p.assets.some(a=>a.kind==='model'))return p;const r=await fetch(asset(id,'model'));if(!r.ok)throw new Error('The model could not load.');const mappings=await stadiumLinks(new Uint8Array(await r.arrayBuffer()),p.metadata);if(mappings){p.metadata={...p.metadata,mappings,stadiumScheduleLinked:true};await put(p);}return p;}
export function targetURL(p){const data=targetData(p.id,asset(p.id,'target'));return URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));}
export async function projectFiles(p){
  validId(p.id);p={...p,metadata:validateMetadata(p.metadata)};
  for(const required of ['model','plan','sheet','target'])if(!p.assets.some(a=>a.kind===required))throw new Error(required==='model'?'Upload a GLB model first.':'Generate a tracking sheet from your plan before publishing.');
  if(p.metadata.tasks.length&&!Object.keys(p.metadata.mappings).length)throw new Error('Link the model components to the schedule before publishing.');
  await prepare(p,true);
  const files=[],assets=[];
  for(const a of p.assets){const r=await fetch(asset(p.id,a.kind));if(!r.ok)throw new Error('The '+a.kind+' file could not load.');const bytes=new Uint8Array(await r.arrayBuffer());const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');const ext=a.kind==='model'?'glb':a.kind==='schedule'?'csv':a.type==='image/jpeg'?'jpg':'png';const filename=a.kind+'-'+hash.slice(0,16)+'.'+ext;const href='projects/'+p.id+'/'+filename;assets.push({...a,filename,href});files.push({path:PROJECT_ROOT+p.id+'/'+filename,content:base64(bytes),encoding:'base64'});}
  const {hasPublished,baseRevision,...rest}=p;
  const published={...rest,status:'published',assets,revision:crypto.randomUUID(),updated:new Date().toISOString()};
  files.push({path:PROJECT_ROOT+p.id+'/project.json',content:JSON.stringify(published,null,2)+'\n'});
  const summary={id:p.id,name:p.name,folder:p.folder,status:'published',metadata:{tasks:p.metadata.tasks},assets:assets.filter(a=>a.kind==='thumbnail'),created:p.created,updated:published.updated,revision:published.revision,baseRevision:baseRevision||p.revision};
  return {files,published,summary};
}
async function publishProject(p){if(!publisher)throw new Error('Open the dashboard to publish this project.');const bundle=await projectFiles(p);const result=await publisher(async (token,onProgress)=>publishFiles({id:p.id,files:bundle.files,summary:bundle.summary,token,onProgress}));p={...bundle.published,publishCommit:result.sha,hasPublished:true};await put(p);return p;}
export async function exportProject(id){const p=await getProject(id,{draft:true});const assets=[];for(const a of p.assets){const r=await fetch(asset(id,a.kind));if(!r.ok)throw new Error('Could not download '+a.kind+'.');assets.push({...a,data:base64(new Uint8Array(await r.arrayBuffer()))});}return new Blob([JSON.stringify({format:'construction-ar-backup-v1',project:p,assets})],{type:'application/json'});}
