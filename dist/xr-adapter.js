// 8th Wall 0.1.0, MIT image tracking engine. No SLAM or hosted account required.
let loading;
export function loadEngine(THREE){
 window.THREE={...THREE};
 if(window.XR8?.XrController)return Promise.resolve(window.XR8);
 if(!loading)loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='./vendor/8thwall/xr.js';script.dataset.preloadChunks='slam';
  const timeout=setTimeout(()=>reject(new Error('8th Wall loading timed out. Reload and retry.')),45000);
  window.addEventListener('xrloaded',()=>{clearTimeout(timeout);resolve(window.XR8)},{once:true});
  script.onerror=()=>{clearTimeout(timeout);reject(new Error('8th Wall could not load.'));};document.head.append(script);
 });
 return loading;
}
export async function startTracking({THREE,container,model,info,onReady,onFound,onLost,onFrame}){
 const XR8=await loadEngine(THREE);
 const response=await fetch('./image-targets/law-office.json');if(!response.ok)throw new Error('Tracking plan could not load');
 const target=await response.json();target.imagePath=new URL(target.imagePath,location.href).href;
 XR8.XrController.configure({disableWorldTracking:true,imageTargetData:[target]});
 const canvas=document.createElement('canvas');canvas.style.cssText='width:100%;height:100%;display:block';container.append(canvas);
 let anchor;
 const pose=({detail:d})=>{
  if(d.name!=='law-office'||!anchor)return;
  anchor.position.copy(d.position);anchor.quaternion.copy(d.rotation);
  anchor.scale.setScalar(d.scale*d.scaledWidth);anchor.visible=true;onFound();
 };
 XR8.addCameraPipelineModules([
  XR8.GlTextureRenderer.pipelineModule(),XR8.Threejs.pipelineModule(),XR8.XrController.pipelineModule(),{
   name:'construction-lab',
   onStart:()=>{
    const {scene,camera,renderer}=XR8.Threejs.xrScene();
    camera.near=.01;camera.far=1000;camera.updateProjectionMatrix();
    anchor=new THREE.Group();anchor.visible=false;scene.add(anchor);anchor.add(model);
    model.rotation.set(Math.PI/2,0,0);model.scale.setScalar(info.pixelsPerMetre/774);
    model.position.set(1/774,-5.5/774,.001);
    onReady({scene,camera,renderer});
   },
   onUpdate:()=>onFrame(performance.now()),
   listeners:[{event:'reality.imagefound',process:pose},{event:'reality.imageupdated',process:pose},{event:'reality.imagelost',process:()=>{if(anchor)anchor.visible=false;onLost();}}]
  }
 ]);
 await XR8.run({canvas,allowedDevices:XR8.XrConfig.device().ANY,canvasWidth:container.clientWidth,canvasHeight:container.clientHeight});
 return {stop:()=>{XR8.stop();XR8.clearCameraPipelineModules();canvas.remove();}};
}
