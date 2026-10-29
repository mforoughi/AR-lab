import {createTrackingRecovery, targetAlignment} from './ar-state.js?v=8thwall-4';
// 8th Wall 0.1.0, MIT image tracking engine. No hosted account required.
let loading;
export function loadEngine(THREE) {
  window.THREE = {...THREE};
  if (window.XR8?.XrController) return Promise.resolve(window.XR8);
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/8thwall/xr.js';
    script.dataset.preloadChunks = 'slam';
    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener('xrloaded', ready);
    };
    const fail = message => {
      cleanup();
      script.remove();
      reject(new Error(message));
    };
    const ready = () => {
      if (!window.XR8?.XrController) return fail('8th Wall image tracking could not load. Reload and retry.');
      cleanup();
      resolve(window.XR8);
    };
    const timeout = setTimeout(() => fail('8th Wall loading timed out. Reload and retry.'), 45000);
    window.addEventListener('xrloaded', ready);
    script.onerror = () => fail('8th Wall could not load. Check your connection and retry.');
    document.head.append(script);
  }).catch(error => { loading = null; throw error; });
  return loading;
}

export async function startTracking({THREE, container, model, info, onReady, onFound, onLost, onFrame, onStatus = () => {}, onError = () => {}, onRecover = () => {}, targetPath = './image-targets/law-office.json'}) {
  const XR8 = await loadEngine(THREE);
  const response = await fetch(targetPath);
  if (!response.ok) throw new Error('Tracking plan could not load. Check your connection and retry.');
  const target = await response.json();
  target.imagePath = new URL(target.imagePath, location.href).href;
  // The SDK's image loader does not report failed downloads through onException.
  const targetImage = new Image();
  targetImage.src = target.imagePath;
  try { await targetImage.decode(); }
  catch { throw new Error('The tracking image could not load. Reload the page and retry.'); }

  XR8.XrController.configure({disableWorldTracking: true, imageTargetData: [target]});
  const canvas = document.createElement('canvas');
  canvas.className = 'ar-canvas';
  // Threejs.pipelineModule writes inline pixel sizes. Keep CSS size tied to the
  // viewer while the drawing buffer uses device pixels.
  canvas.style.setProperty('width', '100%', 'important');
  canvas.style.setProperty('height', '100%', 'important');
  canvas.style.display = 'block';
  container.append(canvas);
  let stopped = false, started = false, scanning = false, settled = false, failed = false;
  let anchor, sceneRenderer, timer, resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const resize = () => {
    if (stopped) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(container.clientWidth * ratio));
    const height = Math.max(1, Math.round(container.clientHeight * ratio));
    // XR8.run has no canvasWidth/canvasHeight options. The SDK reads these
    // attributes each frame and updates its camera projection and GL viewport.
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  window.addEventListener('resize', resize);
  const recovery = createTrackingRecovery({onRecover});
  const stop = () => {
    if (stopped) return;
    stopped = true;
    recovery.stop();
    clearTimeout(timer);
    observer.disconnect();
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('webglcontextlost', contextLost);
    XR8.stop();
    XR8.clearCameraPipelineModules();
    sceneRenderer?.dispose();
    canvas.remove();
  };
  const fail = error => {
    if (stopped || failed) return;
    failed = true;
    clearTimeout(timer);
    const reason = error instanceof Error ? error : new Error(error?.message || 'The AR camera stopped. Please retry.');
    if (!settled) rejectReady(reason);
    else queueMicrotask(() => { stop(); onError(reason); });
  };
  const contextLost = event => {
    event.preventDefault();
    fail(new Error('The graphics connection was interrupted. Please start AR again.'));
  };
  canvas.addEventListener('webglcontextlost', contextLost);
  const checkReady = () => {
    if (!started || !scanning || failed || stopped || settled) return;
    clearTimeout(timer);
    settled = true;
    onStatus('scanning');
    resolveReady();
  };
  const pose = ({detail: d}) => {
    if (d.name !== target.name || !anchor || failed || stopped) return;
    const newlyFound = !anchor.visible;
    anchor.position.copy(d.position);
    anchor.quaternion.copy(d.rotation);
    anchor.scale.setScalar(d.scale * d.scaledWidth);
    anchor.visible = true;
    recovery.found();
    if (newlyFound) onFound();
  };
  try {
    XR8.addCameraPipelineModules([
      XR8.GlTextureRenderer.pipelineModule(),
      XR8.XrController.pipelineModule(),
      XR8.Threejs.pipelineModule(),
      {
        name: 'construction-lab',
        onStart: () => {
          if (stopped || failed) return;
          const {scene, camera, renderer} = XR8.Threejs.xrScene();
          sceneRenderer = renderer;
          anchor = new THREE.Group();
          anchor.visible = false;
          scene.add(anchor);
          anchor.add(model);
          model.rotation.set(Math.PI / 2, 0, 0);
          const alignment = targetAlignment(target, info);
          model.scale.setScalar(alignment.scale);
          model.position.set(alignment.x, alignment.y, .001);
          onReady({scene, camera, renderer});
          started = true;
          onStatus('loading');
          clearTimeout(timer);
          timer = setTimeout(() => fail(new Error('The camera opened, but the tracking plan did not finish loading. Please retry.')), 30000);
          checkReady();
        },
        onCameraStatusChange: ({status}) => {
          if (status === 'requesting') onStatus('camera');
          if (status === 'failed') fail(new Error('Camera access failed. Allow camera access in Safari or Chrome and retry.'));
        },
        onException: fail,
        onUpdate: () => { if (started && !stopped && !failed) onFrame(performance.now()); },
        listeners: [
          {event: 'reality.imageloading', process: () => onStatus('loading')},
          {event: 'reality.imagescanning', process: ({detail}) => {
            if (!detail.imageTargets?.some(image => image.name === target.name)) {
              fail(new Error('The law office tracking plan was not registered. Please reload.'));
              return;
            }
            scanning = true;
            checkReady();
          }},
          {event: 'reality.imagefound', process: pose},
          {event: 'reality.imageupdated', process: pose},
          {event: 'reality.imagelost', process: ({detail}) => {
            if (detail.name !== target.name || stopped || failed) return;
            if (anchor) anchor.visible = false;
            onLost();
            recovery.lost();
          }},
        ],
      },
    ]);
    onStatus('camera');
    timer = setTimeout(() => fail(new Error('Camera startup timed out. Allow camera access, then retry.')), 60000);
    // run() returns immediately; readiness comes from the pipeline callbacks.
    XR8.run({canvas, allowedDevices: XR8.XrConfig.device().ANY});
    await ready;
    return {stop};
  } catch (error) {
    stop();
    throw error;
  }
}
