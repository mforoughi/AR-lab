import {tasks,totalDays,taskProgress,taskState} from './schedule-data.js';
const $=s=>document.querySelector(s);
let THREE,OrbitControls,SVGRenderer,GLTFLoader,software=false,renderer,scene,camera,orbit,model,building,planPlane,modelInfo,arEngine;
let day=totalDays,playing=false,last=0,arMode=false,busy=false,cutaway=false,selectedId=null;
const parts=[];
let followedTask=null;
const geometryLabel=t=>t.hasGeometry?'Model linked':[14,19,20].includes(t.id)?'No geometry required':'Not modeled';
$('#rows').innerHTML=tasks.map(t=>`<button class="row ${t.hasGeometry?'':'schedule-only'}" data-task="${t.id}" aria-label="View activity ${t.id}: ${t.name}"><span class="label"><span class="num">${String(t.id).padStart(2,'0')}</span><span>${t.name}<small>${geometryLabel(t)}</small></span></span><span class="track"><span class="bar" style="left:${t.start/totalDays*100}%;width:${t.duration/totalDays*100}%"><span class="fill"></span></span><span class="cursor"></span></span></button>`).join('');
const rowElements=[...document.querySelectorAll('.row')];
function update(){
 $('#timeline').value=day;
 $('#day').textContent=`${Math.floor(day)} / ${totalDays} workdays`;
 $('#date').textContent=day>=totalDays?'Sequence complete':`Week ${Math.floor(day/5)+1} · workday ${Math.min(totalDays,Math.floor(day)+1)}`;
 $('#percent').textContent=Math.round(day/totalDays*100)+'%';
 const active=tasks.filter(t=>taskState(t,day)==='active');
 if(playing&&active.length){const id=active.at(-1).id;if(id!==followedTask){followedTask=id;const row=rowElements.find(r=>+r.dataset.task===id),chart=$('#gantt');if(row){const header=chart.querySelector('.chartheader').offsetHeight;chart.scrollTop+=row.getBoundingClientRect().top-chart.getBoundingClientRect().top-header;}}}
 const selected=tasks.find(t=>t.id===selectedId);
 const focus=selected||active.at(-1);
 $('#phase').textContent=day>=totalDays?'Law office complete':active.map(t=>t.name).join(' + ')||'Ready to build';
 $('#geometryNote').textContent=day>=totalDays?'Press Play to build from the beginning':active.some(t=>t.hasGeometry)?'Gold components are being installed':active.every(t=>[14,19,20].includes(t.id))?'No geometry required':'Not modeled · schedule advances';
 if(focus){$('#tasklabel').textContent=`${String(focus.id).padStart(2,'0')} · ${focus.name}`;$('#taskdesc').textContent=`Workdays ${focus.start+1}–${focus.finish}. ${focus.description}`;}
 else{$('#tasklabel').textContent='YOUR MODEL · DRAFT TEACHING SCHEDULE';$('#taskdesc').textContent='Press Play to start the 90-workday sequence. Tap any activity to jump to its installation stage.';}
 rowElements.forEach((row,i)=>{
  const task=tasks[i],state=taskState(task,day),f=taskProgress(task,day);
  row.querySelector('.fill').style.width=f*100+'%';
  row.querySelector('.fill').style.background=state==='active'?'#dca83e':task.hasGeometry?'#365a4b':'#9ba5a5';
  row.querySelector('.cursor').style.left=day/totalDays*100+'%';
  row.classList.toggle('active',state==='active');row.setAttribute('aria-pressed',String(task.id===selectedId));
 });
 parts.forEach(({mesh,task,baseColor,baseOpacity})=>{
  const state=taskState(task,day);
  mesh.visible=state!=='future'&&!(cutaway&&[8,9].includes(task.id));
  mesh.material.color.set(state==='active'?'#dca83e':baseColor);
  mesh.material.opacity=state==='active'?Math.max(.45,baseOpacity*.65):baseOpacity;
  mesh.material.transparent=mesh.material.opacity<1;mesh.material.depthWrite=mesh.material.opacity===1;
 });
}
function setPlaying(value){playing=value;if(value)followedTask=null;last=0;$('#play').textContent=playing?'Ⅱ':'▶';$('#play').setAttribute('aria-label',playing?'Pause construction sequence':'Play construction sequence');}
function togglePlay(){setPlaying(!playing);}
$('#play').onclick=()=>{selectedId=null;if(day>=totalDays)day=0;togglePlay();update();};
$('#timeline').oninput=e=>{setPlaying(false);selectedId=null;day=+e.target.value;update();};
$('#restart').onclick=()=>{day=0;selectedId=null;setPlaying(false);update();};
$('#complete').onclick=()=>{day=totalDays;selectedId=null;setPlaying(false);update();};
$('#cutaway').onchange=e=>{cutaway=e.target.checked;update();};
rowElements.forEach(el=>el.onclick=()=>{selectedId=+el.dataset.task;const t=tasks.find(t=>t.id===selectedId);day=t.start+Math.min(.5,t.duration/2);setPlaying(false);update();});
$('#guide').onclick=()=>$('#help').showModal();$('#closeHelp').onclick=()=>$('#help').close();
$('#collapse').onclick=()=>{const collapsed=$('.schedule').classList.toggle('collapsed');document.body.classList.toggle('chart-collapsed',collapsed);$('#collapse').setAttribute('aria-expanded',String(!collapsed));$('#collapse').textContent=collapsed?'Show chart':'Hide chart';};
function lights(s){s.add(new THREE.HemisphereLight(0xffffff,0x687d66,1.7));const l=new THREE.DirectionalLight(0xffffff,1.6);l.position.set(5,10,8);s.add(l);}
function resize(){if(!renderer||arMode)return;const c=$('#scene');renderer.setSize(c.clientWidth,c.clientHeight);camera.aspect=c.clientWidth/c.clientHeight;camera.updateProjectionMatrix();}
async function createModel(){
 const response=await fetch('./assets/model-info.json');if(!response.ok)throw new Error('Model metadata could not load');modelInfo=await response.json();
 const gltf=await new GLTFLoader().loadAsync('./assets/law-office.glb');building=gltf.scene;
 const byId=new Map(tasks.map(t=>[t.id,t]));
 building.traverse(mesh=>{if(!mesh.isMesh)return;const task=byId.get(mesh.userData.taskId);if(!task)throw new Error('A model component has no schedule task');
  const baseColor=mesh.userData.color,baseOpacity=mesh.userData.opacity;
  mesh.material.dispose();mesh.material=new THREE.MeshLambertMaterial({color:baseColor,opacity:baseOpacity,transparent:baseOpacity<1,side:THREE.DoubleSide,depthWrite:baseOpacity===1});
  parts.push({mesh,task,baseColor,baseOpacity});
 });
 if(parts.length!==modelInfo.meshCount)throw new Error('Model component count does not match the prepared model');
 model=new THREE.Group();model.add(building);
 const p=modelInfo.plan,ppm=modelInfo.pixelsPerMetre;
 const texture=await new THREE.TextureLoader().loadAsync('./assets/law-office-plan.png');texture.colorSpace=THREE.SRGBColorSpace;
 planPlane=new THREE.Mesh(new THREE.PlaneGeometry(p.width/ppm,p.height/ppm),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
 planPlane.rotation.x=-Math.PI/2;planPlane.position.set((p.width/2-(p.left+p.right)/2)/ppm,-.13,(p.height/2-(p.top+p.bottom)/2)/ppm);model.add(planPlane);
}
function preview(){
 const container=$('#scene');software=false;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));}
 catch(e){software=true;renderer=new SVGRenderer();let loop;renderer.setAnimationLoop=fn=>{cancelAnimationFrame(loop);if(fn){const run=t=>{fn(t);loop=requestAnimationFrame(run);};loop=requestAnimationFrame(run);}};renderer.dispose=()=>{};$('#ar').disabled=true;}
 if(software){for(const part of parts){const old=part.mesh.material;part.mesh.material=new THREE.MeshBasicMaterial({color:part.baseColor,opacity:part.baseOpacity,transparent:part.baseOpacity<1,side:THREE.DoubleSide});old.dispose();}}
 container.append(renderer.domElement);scene=new THREE.Scene();scene.background=new THREE.Color('#e9eee7');
 camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(12,10,13);
 orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,1.2,0);orbit.enableDamping=true;orbit.minDistance=6;orbit.maxDistance=30;orbit.maxPolarAngle=Math.PI/2.05;
 scene.add(model);model.position.set(0,0,0);model.rotation.set(0,0,0);model.scale.setScalar(10/modelInfo.width);planPlane.visible=!software;
 lights(scene);resize();renderer.setAnimationLoop(tick);
 $('#mode').textContent=software?'3D compatibility preview':'Drag to orbit · Pinch to zoom';
}
function tick(t,render=true){const dt=last?Math.min((t-last)/1000,.1):0;last=t;if(playing){day=Math.min(totalDays,day+dt*+$('#speed').value);if(day>=totalDays)setPlaying(false);update();}orbit?.update();if(render)renderer.render(scene,camera);}
async function startAR(){
 if(busy||arMode)return;busy=true;$('#ar').disabled=true;
 try{
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Open this HTTPS page directly in Safari or Chrome.');
  $('#message').textContent='Loading 8th Wall. Allow camera access when asked.';
  const {loadEngine,startTracking}=await import('./xr-adapter.js?v=8thwall-2');await loadEngine(THREE);
  renderer.setAnimationLoop(null);orbit?.dispose();orbit=null;renderer.dispose();$('#scene').replaceChildren();
  arMode=true;document.body.classList.add('ar-active');planPlane.visible=false;
  arEngine=await startTracking({THREE,container:$('#scene'),model,info:modelInfo,
   onReady:r=>{({scene,camera,renderer}=r);lights(scene);},
   onStatus:status=>{
    const messages={camera:['Opening camera','Allow camera access when asked.'],loading:['Loading plan','Camera ready. Preparing the tracking plan…'],scanning:['Plan ready · Scanning','Keep the whole printed plan in view, including the upper rooms. Hold still until “Plan tracked” appears.']};
    const [label,message]=messages[status];$('#mode').textContent='8th Wall · '+label;$('#message').textContent=message;
   },
   onError:e=>{console.error(e);stopAR();$('#message').textContent='AR stopped: '+e.message;},
   onFound:()=>{$('#message').textContent='';$('#mode').textContent='8th Wall · Plan tracked';},
   onLost:()=>{$('#message').textContent='Point at the full tracking plan';$('#mode').textContent='Looking for plan';},
   onFrame:t=>tick(t,false)});
  $('#preview').classList.remove('selected');$('#ar').classList.add('selected');
 }catch(e){console.error(e);await stopAR();$('#message').textContent='AR could not start: '+e.message;}
 finally{busy=false;$('#ar').disabled=software;}
}
async function stopAR(){
 arEngine?.stop();arEngine=null;
 if(!arMode)return;
 arMode=false;document.body.classList.remove('ar-active');$('#scene').replaceChildren();preview();
 $('#preview').classList.add('selected');$('#ar').classList.remove('selected');$('#message').textContent='';
}
window.addEventListener('pagehide',()=>{arEngine?.stop();});

$('#ar').onclick=startAR;$('#preview').onclick=()=>{if(!busy)stopAR();};
$('#resetView').onclick=()=>{if(orbit){camera.position.set(12,10,13);orbit.target.set(0,1.2,0);}};
window.addEventListener('resize',resize);update();
try{
 THREE=await import('three');({OrbitControls}=await import('three/addons/OrbitControls.js'));({SVGRenderer}=await import('three/addons/SVGRenderer.js'));({GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'));
 await createModel();preview();update();$('#ar').disabled=software;
 $('#message').textContent=software?'WebGL is disabled in this browser. Use Safari or Chrome on your phone for AR.':'';
 document.body.dataset.modelReady='true';
}catch(e){$('#message').textContent='The building could not load: '+(e?.message||'Unknown error')+'. Reload the page to retry.';$('#ar').disabled=true;console.error(e);}
