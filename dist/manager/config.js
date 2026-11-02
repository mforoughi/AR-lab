export const REPOSITORY = 'mforoughi/AR-lab';
export const BRANCH = 'main';
export const PROJECT_ROOT = 'dist/manager/projects/';
export const BASE = new URL('./', import.meta.url);
export const PUBLIC_BASE = 'https://mforoughi.github.io/AR-lab/manager/';
export const projectLink = id => PUBLIC_BASE + 'viewer.html?id=' + encodeURIComponent(id) + '&ar=1';
export function validId(id) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) throw new Error('Invalid project ID.');
  return id;
}
export function targetData(id, imagePath) {
  return {name:validId(id),type:'PLANAR',imagePath,properties:{left:0,top:0,width:480,height:640,originalWidth:480,originalHeight:640,isRotated:false},metadata:{alignment:{scale:1,x:0,y:0}}};
}
