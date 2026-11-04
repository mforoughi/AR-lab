/**
 * Isolated, static floor-AR occlusion A/B page. No uploads, no network writes,
 * no database and no ChatGPT Sites dependencies. The user's ZIP never leaves
 * their browser. Reuses the deployed AR-lab Three.js and loads the separately licensed 8th Wall SLAM binary.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/OrbitControls.js';
import {attachVirtualSurfaceOcclusion} from './virtual-occlusion.js';

const $ = id => document.getElementById(id);
let model, content, building, modelWidth=1, parts=[], metadata={tasks:[],mappings:{}}, maxDay=1, day=0;
let occlusion, scene, camera, renderer, orbit, anchor, ring, previewAnimation=0, sdk, active=false;
let placed=false, tracking=false, playing=false, lastFrame=0, running=false, stopped=false, currentGeneration=0;
const mouse = new THREE.Vector2(0,0), ray=new THREE.Raycaster(), floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0), hit=new THREE.Vector3();
const status = text => { $('status').textContent=text; };
const taskLabel = () => {
  const t=(metadata.tasks||[]).find(t=>day>=t.start && day<t.start+t.duration);
  $('task').textContent=day>=maxDay?'Complete':t?.name||'Between tasks';
};
function materialState(p,task,activeTask){
  p.mesh.visible = !task || day>=task.start;
  if(!p.colors)return;
  for(let k=0;k<p.materials.length;k++) {
    const m=p.materials[k];
    if(m.color) m.color.copy(p.colors[k]);
    if(activeTask && m.color) m.color.set('#d6ad49');
  }
}
function updateSchedule(){
  const byId=new Map((metadata.tasks||[]).map(t=>[t.id,t]));
  for(const p of parts){const task=byId.get(metadata.mappings?.[p.id]);materialState(p,task,!!task&&day>=task.start&&day<task.start+task.duration);}
  occlusion?.sync();
  $('timeline').value=Math.min(maxDay,day);
  $('play').textContent=playing?'Ⅱ Pause':'▶ Play';
  taskLabel();
}
function advance(time){
  if(lastFrame && playing && (!active||tracking)){
    const dt=Math.min(Math.max((time-lastFrame)/1000,0),0.1);
    day=Math.min(maxDay,day+dt*maxDay/25);
    if(day>=maxDay)playing=false;
    updateSchedule();
  }
  lastFrame=time;
}
function disposePreview(){
  cancelAnimationFrame(previewAnimation);previewAnimation=0;
  orbit?.dispose();orbit=null;
  if(renderer && !active)renderer.dispose();
  if(!active)renderer=null;
  $('stage').querySelector('canvas')?.remove();
}
function lighting(s){s.add(new THREE.HemisphereLight(0xffffff,0x6b7d65,2));const l=new THREE.DirectionalLight(0xffffff,2);l.position.set(3,8,5);s.add(l);}
function preview(){
  active=false;lastFrame=0;
  document.body.classList.remove('immersed');$('exit').hidden=true;
  occlusion?.setEnabled(false);
  if(!model)return;
  disposePreview();
  scene=new THREE.Scene();scene.background=new THREE.Color('#ecf2ed');lighting(scene);
  content.scale.setScalar(1/modelWidth);content.position.set(0,0,0);
  model.position.set(0,0,0);model.scale.setScalar(1);model.rotation.set(0,0,0);scene.add(model);
  const stage=$('stage');renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(stage.clientWidth,stage.clientHeight);
  stage.append(renderer.domElement);
  camera=new THREE.PerspectiveCamera(45,stage.clientWidth/stage.clientHeight,.01,100);
  camera.position.set(1.35,.9,1.35);
  orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.35,0);orbit.update();
  $('placeholder').hidden=true;
  function draw(time){if(active)return;advance(time);orbit?.update();renderer.render(scene,camera);previewAnimation=requestAnimationFrame(draw);}
  previewAnimation=requestAnimationFrame(draw);
  status('Model loaded. Preview with one finger; then tap Start floor AR.');
}
async function importBackup(file){
  if(running){status('Exit the AR camera before importing another file.');return;}
  if(file.size>90*1048576)throw Error('Choose a Structure ZIP/GLB smaller than 90 MB.');
  stopped=false;currentGeneration++;
  const gen=currentGeneration;
  $('start').disabled=true;$('play').disabled=true;$('timeline').disabled=true;
  status('Reading your file locally…');
  let data,info;
  if(file.name.toLowerCase().endsWith('.glb')){
    data=await file.arrayBuffer();info={project:{name:file.name,metadata:{tasks:[],mappings:{}}}};
  } else {
    if(!window.JSZip)throw Error('ZIP reader was blocked by your network. Try Safari again or choose the extracted GLB file instead.');
    const zip=await window.JSZip.loadAsync(file);
    const projectFile=zip.file('project.json');
    if(!projectFile)throw Error('The ZIP is missing project.json. Choose a Construction AR Lab project backup.');
    info=JSON.parse(await projectFile.async('string'));
    if(info.format!=='construction-ar-project-backup'||info.version!==1)throw Error('This is not the supported Construction AR Lab backup format.');
    const assets=Object.values(zip.files).filter(f=>!f.dir&&/^assets\/model-.*\.glb$/i.test(f.name));
    if(assets.length!==1)throw Error('The backup must contain one GLB model.');
    data=await assets[0].async('arraybuffer');
  }
  if(gen!==currentGeneration)return;
  status('Preparing 3D geometry on your iPhone…');
  const loader=new GLTFLoader();
  const gltf=await loader.parseAsync(data,'');
  if(gen!==currentGeneration)return;
  building=gltf.scene;
  building.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(building);
  const size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw Error('The model has invalid 3D dimensions.');
  modelWidth=size.x;
  building.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
  disposePreview();occlusion?.dispose();occlusion=null;
  metadata=info.project?.metadata||{tasks:[],mappings:{}};
  parts=[];
  building.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const mats=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.clone());
    mesh.material=Array.isArray(mesh.material)?mats:mats[0];
    const id='mesh_'+parts.length;
    parts.push({id,mesh,materials:mats,colors:mats.map(m=>m.color?.clone()||null)});
  });
  try {occlusion=attachVirtualSurfaceOcclusion({THREE,modelRoot:building,enabled:false,maxProxies:128});}
  catch(error){console.warn('Occlusion layer unavailable',error);}
  content=new THREE.Group();content.add(building);content.scale.setScalar(1/modelWidth);
  model=new THREE.Group();model.add(content);
  maxDay=Math.max(1,...(metadata.tasks||[]).map(t=>t.start+t.duration));
  day=maxDay;playing=false;lastFrame=0;
  $('timeline').max=maxDay;$('timeline').disabled=!(metadata.tasks||[]).length;
  $('play').disabled=!(metadata.tasks||[]).length;
  $('start').disabled=false;
  $('projectName').textContent=`${info.project?.name||file.name} • ${parts.length.toLocaleString()} mesh components • ${occlusion?.count||0} experimental surfaces`;
  updateSchedule();preview();
}
function configureRig(){
  if(!model)return;
  const scale=Number($('scale').value),rotation=Number($('rotation').value),height=Number($('elevation').value);
  model.scale.setScalar(scale);
  model.rotation.y=THREE.MathUtils.degToRad(rotation);
  model.position.y=height;
  $('scaleout').textContent=scale.toFixed(1)+'×';
  $('rotationout').textContent=rotation+'°';
  $('elevationout').textContent=height.toFixed(2);
}
function setMode(experimental){
  const on=Boolean(experimental);
  occlusion?.setEnabled(on && active);
  $('experiment').textContent=on
    ? `Experimental surfaces ON (${occlusion?.count||0} surfaces). This does not detect people or their distance.`
    : 'Original rendering ON. Compare both modes while looking at the same wall or floor.';
}
async function loadXR(){
  if(window.XR8?.XrController)return window.XR8;
  window.THREE={...THREE};
  const script=document.createElement('script');
  // Full SLAM engine is separate from the MIT image-target framework.
  script.src='https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js';
  script.dataset.preloadChunks='slam';
  const loaded=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('AR engine timed out. Verify mobile connection and retry.')),45000);
    const yes=()=>{clearTimeout(timer);window.removeEventListener('xrloaded',yes);window.XR8?.XrController?resolve(window.XR8):reject(new Error('AR engine is not available.'));};
    window.addEventListener('xrloaded',yes);
    script.onerror=()=>{clearTimeout(timer);window.removeEventListener('xrloaded',yes);reject(new Error('AR engine failed to download.'));};
  });
  document.head.append(script);
  return loaded;
}
function resetARObjects(){
  if(sdk){try{sdk.stop();sdk.clearCameraPipelineModules();}catch(error){console.warn(error);}sdk=null;}
  $('stage').querySelector('canvas')?.remove();
  ring?.geometry.dispose();ring?.material.dispose();ring=null;
  anchor=null;placed=false;tracking=false;active=false;
}
async function exitAR(){
  stopped=true;playing=false;running=false;lastFrame=0;
  startAR.cleanup?.();startAR.cleanup=null;
  resetARObjects();
  $('reposition').disabled=true;
  $('start').disabled=!model;
  if(model)preview();
}
async function startAR(){
  if(!model||running)return;
  running=true;stopped=false;
  $('start').disabled=true;
  status('Opening the phone camera…');
  try {
    disposePreview();occlusion?.setEnabled(false);
    sdk=await loadXR();
    if(stopped)throw Error('AR was cancelled.');
    sdk.XrController.configure({disableWorldTracking:false,imageTargetData:[],scale:'responsive'});
    const canvas=document.createElement('canvas');
    canvas.style.width='100%';canvas.style.height='100%';
    $('stage').append(canvas);
    const observer=new ResizeObserver(()=>{
      if(!active)return;
      const ratio=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.max(1,Math.round($('stage').clientWidth*ratio));
      canvas.height=Math.max(1,Math.round($('stage').clientHeight*ratio));
    });
    observer.observe($('stage'));
    const dispose=()=>{observer.disconnect();canvas.removeEventListener('click',place);canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',visibility);};
    const lost=e=>{e.preventDefault();status('Graphics interrupted. Exit camera and retry.');};
    const visibility=()=>{if(document.hidden){tracking=false;}};
    function place(){if(!tracking||placed||!ring?.visible)return;anchor.position.copy(ring.position);placed=true;anchor.visible=true;ring.visible=false;status('Placed. Move your shoe near a virtual wall or floor and compare both modes.');}
    canvas.addEventListener('click',place);
    canvas.addEventListener('webglcontextlost',lost);
    document.addEventListener('visibilitychange',visibility);
    let timer,resolveReady,rejectReady;
    const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const clean=()=>{clearTimeout(timer);dispose();};
    sdk.addCameraPipelineModules([
      sdk.GlTextureRenderer.pipelineModule(),sdk.XrController.pipelineModule(),sdk.Threejs.pipelineModule(),{
        name:'construction-occlusion-sandbox',
        onStart:()=>{
          if(stopped)return;
          const x=sdk.Threejs.xrScene();
          renderer=x.renderer;camera=x.camera;
          camera.position.set(0,3,0);
          sdk.XrController.updateCameraProjectionMatrix({origin:camera.position,facing:camera.quaternion});
          anchor=new THREE.Group();anchor.visible=false;x.scene.add(anchor);anchor.add(model);
          content.scale.setScalar(1/modelWidth);
          // Building is already centered/grounded; model sliders control its size.
          ring=new THREE.Mesh(new THREE.RingGeometry(.12,.17,32),new THREE.MeshBasicMaterial({color:0xe2b85a,side:THREE.DoubleSide}));
          ring.rotation.x=-Math.PI/2;ring.visible=false;x.scene.add(ring);
          lighting(x.scene);
          active=true;
          configureRig();
          setMode(document.querySelector('input[name=surface]:checked').value==='experimental');
          $('placeholder').hidden=true;
          document.body.classList.add('immersed');$('exit').hidden=false;$('reposition').disabled=false;
          status('Move slowly over a textured floor, then point down to place the model.');
          clearTimeout(timer);resolveReady();
        },
        onUpdate:({processCpuResult})=>{
          if(!active||stopped)return;
          const normal=!document.hidden&&processCpuResult?.reality?.trackingStatus==='NORMAL';
          tracking=normal;
          if(anchor)anchor.visible=placed&&normal;
          if(ring)ring.visible=false;
          if(!normal)status('Tracking paused. Move slowly; keep one phone orientation.');
          else if(!placed){
            camera.updateMatrixWorld(true);ray.setFromCamera(mouse,camera);
            const r=ray.ray.intersectPlane(floorPlane,hit);
            if(r&&ray.ray.direction.y<-.08&&hit.distanceTo(camera.position)<30){ring.position.copy(hit);ring.visible=true;status('Tap the camera view to place the model at the gold ring.');}
            else status('Aim at a visible, textured floor.');
          }
          advance(performance.now());
        },
        onCameraStatusChange:({status:s})=>{if(s==='failed'){clearTimeout(timer);rejectReady(new Error('Camera permission denied. Enable Camera in Safari settings.'));}},
        onException:e=>{clearTimeout(timer);rejectReady(e instanceof Error?e:new Error(String(e?.message||'AR camera error')));}
      }
    ]);
    timer=setTimeout(()=>rejectReady(new Error('Camera start timed out. Retry with Safari and camera permission.')),60000);
    sdk.run({canvas,allowedDevices:sdk.XrConfig.device().ANY});
    await ready;
    // Handler is retained during the camera session; dispose when exiting.
    startAR.cleanup=clean;
  }catch(error){
    console.error(error);
    await exitAR();
    status(error.message||'Floor AR could not start.');
  }
}
$('backup').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try {await importBackup(file);}catch(error){console.error(error);status('Import error: '+error.message);$('projectName').textContent='';}
});
$('start').addEventListener('click',startAR);
$('exit').addEventListener('click',async()=>{startAR.cleanup?.();await exitAR();});
$('reposition').addEventListener('click',()=>{if(!anchor)return;placed=false;anchor.visible=false;playing=false;lastFrame=0;updateSchedule();status('Point down and tap the camera view at the new position.');});
for(const id of ['scale','rotation','elevation'])$(id).addEventListener('input',configureRig);
for(const el of document.querySelectorAll('input[name=surface]'))el.addEventListener('change',()=>setMode(el.value==='experimental'));
$('play').addEventListener('click',()=>{if(!model)return;if(day>=maxDay)day=0;playing=!playing;lastFrame=0;updateSchedule();});
$('timeline').addEventListener('input',e=>{playing=false;day=Number(e.target.value);updateSchedule();});
window.addEventListener('resize',()=>{if(!renderer||active)return;const stage=$('stage');renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();});
window.addEventListener('pagehide',()=>{startAR.cleanup?.();resetARObjects();});