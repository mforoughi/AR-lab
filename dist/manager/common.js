import {listProjects,createProject,getProject,saveProject} from './project-store.js';
export {asset,getProject,putAsset,autoLink,targetURL} from './project-store.js';
export async function api(path,options={}) {
 const method=options.method||'GET',input=options.body?JSON.parse(options.body):{};
 if(path==='projects')return method==='POST'?createProject(input):listProjects();
 const match=/^projects\/([a-f0-9-]+)$/.exec(path);
 if(!match)throw new Error('Unsupported dashboard action.');
 return method==='PATCH'?saveProject(match[1],input):getProject(match[1],{draft:true});
}
export function parseCSV(text){const rows=[];let row=[],value='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value='';}else value+=c;}if(quoted)throw new Error('CSV has an unclosed quote.');row.push(value);if(row.some(x=>x.trim()))rows.push(row);const headers=rows.shift()?.map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase())||[];for(const k of ['id','name','start','duration'])if(!headers.includes(k))throw new Error('CSV needs id, name, start, duration columns.');return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,h==='start'||h==='duration'?Number(r[i]):(r[i]||'').trim()])));}
export function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
