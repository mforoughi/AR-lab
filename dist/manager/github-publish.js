import {REPOSITORY,BRANCH,PROJECT_ROOT,validId} from './config.js';

// Only project data can be written. Existing app code, workflows and model files
// outside the manager are never accepted as destinations.
export function assertProjectPaths(id, files) {
  validId(id);
  const prefix = PROJECT_ROOT + id + '/';
  for (const file of files) {
    if (!file.path.startsWith(prefix) || !/^[a-zA-Z0-9.-]+$/.test(file.path.slice(prefix.length)) || file.path.includes('..') || typeof file.content !== 'string') throw new Error('Unsafe project destination.');
  }
  if (!files.some(f => f.path === prefix + 'project.json')) throw new Error('Project manifest missing.');
}
export function base64(bytes) {
  let text='';
  for(let i=0;i<bytes.length;i+=32768) text+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(text);
}
export async function publishFiles({id,files,summary,token,onProgress=()=>{},fetcher=fetch}) {
  assertProjectPaths(id,files);
  if (!token?.trim()) throw new Error('Enter a GitHub token to publish.');
  const root='https://api.github.com/repos/'+REPOSITORY;
  async function request(path,body,method=body?'POST':'GET') {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),120000);
    try {
      const r=await fetcher(root+path,{method,signal:controller.signal,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
      if(!r.ok) {
        const e=new Error(r.status===401?'GitHub authorization expired or the token is incorrect.':r.status===403?'GitHub refused this action. Check Contents: Read and write permission, token expiry, and API limits.':r.status===404?'GitHub could not find this repository or the token cannot access it.':r.status===422?'GitHub changed while publishing. Retry; existing files have not been overwritten.':'GitHub request failed ('+r.status+'). Your browser draft is safe.');
        e.status=r.status;throw e;
      }
      return await r.json();
    } catch(e) { if(e.name==='AbortError')throw new Error('GitHub did not respond in time. Retry publishing; your draft is saved.');throw e; }
    finally {clearTimeout(timer);}
  }
  onProgress('Checking GitHub access…');
  const repo=await request('');
  if(!repo.permissions?.push)throw new Error('This GitHub account does not have write access to '+REPOSITORY+'.');
  const entries=[];
  for(const [i,file] of files.entries()) {
    onProgress('Sending file '+(i+1)+' of '+files.length+' to GitHub…');
    const blob=await request('/git/blobs',{content:file.content,encoding:file.encoding||'utf-8'});
    entries.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha});
  }
  // Each attempt uses the latest whole repository tree, preserving every path
  // absent from our additions. A non-fast-forward branch update is rejected.
  for(let attempt=0;attempt<3;attempt++) {
    onProgress('Publishing project…');
    const ref=await request('/git/ref/heads/'+BRANCH);
    const head=ref.object.sha;
    const commit=await request('/git/commits/'+head);
    const tree=await request('/git/trees/'+commit.tree.sha+'?recursive=1');
    if(tree.truncated)throw new Error('The repository catalog is too large to update safely. Contact the project maintainer.');
    const catalogEntry=tree.tree.find(e=>e.path===PROJECT_ROOT+'index.json');
    let catalog=[];
    if(catalogEntry) {
      const blob=await request('/git/blobs/'+catalogEntry.sha);
      catalog=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));
      if(!Array.isArray(catalog))throw new Error('Invalid project catalog. No files were changed.');
    }
    const previous=catalog.find(p=>p.id===id);
    if(previous?.revision && summary.baseRevision!==previous.revision)throw new Error('This project was updated from another browser. Export your draft, then reload the published version before replacing it. Other projects are unchanged.');
    const {baseRevision,...publicSummary}=summary;
    const updated=[...catalog.filter(p=>p.id!==id),publicSummary];
    const catalogBlob=await request('/git/blobs',{content:JSON.stringify(updated,null,2)+'\n',encoding:'utf-8'});
    const newTree=await request('/git/trees',{base_tree:commit.tree.sha,tree:[...entries,{path:PROJECT_ROOT+'index.json',mode:'100644',type:'blob',sha:catalogBlob.sha}]});
    const next=await request('/git/commits',{message:'Publish AR project: '+summary.name.slice(0,120),tree:newTree.sha,parents:[head]});
    try {
      await request('/git/refs/heads/'+BRANCH,{sha:next.sha,force:false},'PATCH');
      return {sha:next.sha,url:'https://github.com/'+REPOSITORY+'/commit/'+next.sha};
    } catch(e) { if(![409,422].includes(e.status)||attempt===2)throw e; }
  }
}
