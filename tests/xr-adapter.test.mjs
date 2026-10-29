import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setImmediate} from 'node:timers/promises';
import * as THREE from 'three';
import {startTracking} from '../dist/xr-adapter.js';
const target = JSON.parse(await readFile(new URL('../dist/image-targets/law-office.json', import.meta.url)));

function setup() {
  const h = {status: [], errors: [], stopped: 0, cleared: 0, disposed: 0, found: 0, lost: 0, frames: 0, recovered: 0};
  globalThis.window = new EventTarget();
  window.devicePixelRatio = 3;
  globalThis.location = {href: 'https://mforoughi.github.io/AR-lab/'};
  globalThis.fetch = async () => ({ok: true, json: async () => structuredClone(target)});
  globalThis.Image = class { async decode() {} };
  globalThis.document = {createElement: () => {
    h.canvas = new EventTarget();
    Object.assign(h.canvas, {width: 300, height: 150, style: {setProperty(key, value) {this[key] = value;}}, remove() {h.removed = true;}});
    return h.canvas;
  }};
  globalThis.ResizeObserver = class {
    constructor(fn) {h.resize = fn;}
    observe() {}
    disconnect() {h.disconnected = true;}
  };
  h.container = {clientWidth: 390, clientHeight: 340, append() {}};
  h.scene = new THREE.Scene();
  h.model = new THREE.Group();
  window.XR8 = {
    XrController: {configure(config) {h.config = config;}, pipelineModule: () => ({name: 'reality'})},
    GlTextureRenderer: {pipelineModule: () => ({name: 'gl'})},
    Threejs: {
      pipelineModule: () => ({name: 'three'}),
      xrScene: () => ({scene: h.scene, camera: new THREE.PerspectiveCamera(), renderer: {dispose() {h.disposed++;}}}),
    },
    XrConfig: {device: () => ({ANY: 'any'})},
    addCameraPipelineModules(modules) {h.modules = modules; h.pipeline = modules.at(-1);},
    run(config) {h.run = config;}, // Actual XR8.run also returns undefined.
    stop() {h.stopped++;},
    clearCameraPipelineModules() {h.cleared++;},
  };
  h.event = (name, detail) => h.pipeline.listeners.find(l => l.event === 'reality.' + name).process({detail});
  h.start = () => startTracking({THREE, container: h.container, model: h.model, info: {pixelsPerMetre: 21.71925164845},
    onReady() {h.sceneReady = true;}, onStatus: s => h.status.push(s), onError: e => h.errors.push(e),
    onRecover() {h.recovered++;}, onFound() {h.found++;}, onLost() {h.lost++;}, onFrame() {h.frames++;},
  });
  h.complete = () => {h.pipeline.onStart(); h.event('imagescanning', {imageTargets: [target]});};
  return h;
}

test('sizes the drawing buffer before XR8.run and waits for the registered plan', async () => {
  const h = setup(); let ready = false;
  const pending = h.start().then(handle => {ready = true; return handle;});
  await setImmediate();
  assert.deepEqual([h.canvas.width, h.canvas.height], [780, 680]);
  assert.equal(h.run.canvasWidth, undefined);
  assert.equal(ready, false);
  assert.equal(h.config.imageTargetData[0].imagePath, 'https://mforoughi.github.io/AR-lab/image-targets/law-office_luminance.png');
  h.pipeline.onStart();
  await setImmediate();
  assert.equal(ready, false, 'camera alone must not be reported as tracking-ready');
  h.event('imagescanning', {imageTargets: [target]});
  const handle = await pending;
  assert.equal(h.status.at(-1), 'scanning');
  h.container.clientWidth = 844; h.container.clientHeight = 390;
  h.resize();
  assert.deepEqual([h.canvas.width, h.canvas.height], [1688, 780]);
  h.container.clientHeight = 620; h.resize();
  assert.equal(h.canvas.height, 1240, 'chart collapse resizes AR');
  handle.stop(); handle.stop();
  assert.equal(h.stopped, 1); assert.equal(h.disposed, 1);
  assert.ok(h.disconnected && h.removed);
});

test('image poses show, move, and hide the building with the existing plan calibration', async () => {
  const h = setup(); const pending = h.start(); await setImmediate(); h.complete();
  const handle = await pending;
  const pose = {name: target.name, position: {x: 1, y: 2, z: 3}, rotation: {x: 0, y: 0, z: 0, w: 1}, scale: 2, scaledWidth: .75};
  h.event('imagefound', pose);
  assert.equal(h.model.parent.visible, true);
  assert.equal(h.model.parent.scale.x, 1.5);
  assert.deepEqual(h.model.parent.position.toArray(), [1, 2, 3]);
  assert.equal(h.model.rotation.x, Math.PI / 2);
  assert.ok(Math.abs(h.model.scale.x - 21.71925164845 / 774) < 1e-10);
  h.event('imageupdated', {...pose, position: {x: 4, y: 5, z: 6}});
  assert.equal(h.model.parent.position.x, 4);
  h.event('imagelost', {name: 'another-plan'});
  assert.equal(h.model.parent.visible, true);
  h.event('imagelost', {name: target.name});
  assert.equal(h.model.parent.visible, false); assert.equal(h.lost, 1);
  handle.stop();
});

test('camera denial rejects startup and cleans up, allowing a fresh attempt', async () => {
  const h = setup(); const pending = h.start();
  const rejected = assert.rejects(pending, /Camera access failed/);
  await setImmediate(); h.pipeline.onCameraStatusChange({status: 'failed'}); await rejected;
  assert.equal(h.stopped, 1); assert.ok(h.disconnected && h.removed);
  const retry = h.start(); await setImmediate(); h.complete(); (await retry).stop();
  assert.equal(h.stopped, 2);
});

test('missing target image fails before requesting the camera', async () => {
  const h = setup(); globalThis.Image = class {async decode() {throw new Error('404');}};
  await assert.rejects(h.start(), /tracking image could not load/);
  assert.equal(h.run, undefined);
});

test('a session without the expected target is an error, not a false scanning state', async () => {
  const h = setup(); const pending = h.start();
  const rejected = assert.rejects(pending, /not registered/);
  await setImmediate(); h.pipeline.onStart(); h.event('imagescanning', {imageTargets: []});
  await rejected; assert.equal(h.status.includes('scanning'), false); assert.ok(h.removed);
});

test('runtime graphics failure stops once and reports an actionable error', async () => {
  const h = setup(); const pending = h.start(); await setImmediate(); h.complete(); await pending;
  h.canvas.dispatchEvent(new Event('webglcontextlost', {cancelable: true}));
  await setImmediate();
  assert.equal(h.errors.length, 1); assert.match(h.errors[0].message, /start AR again/);
  assert.equal(h.stopped, 1); assert.ok(h.disconnected && h.removed);
  h.pipeline.onUpdate(); assert.equal(h.frames, 0);
});


test('adapter requests recovery after a real loss, but cancels it when tracking returns', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const h=setup();const pending=h.start();await setImmediate();h.complete();const handle=await pending;
  const pose={name:target.name,position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1},scale:1,scaledWidth:.75};
  h.event('imagefound',pose);h.event('imagelost',{name:target.name});
  t.mock.timers.tick(3000);h.event('imageupdated',pose);t.mock.timers.tick(6000);assert.equal(h.recovered,0);
  h.event('imagelost',{name:target.name});t.mock.timers.tick(7000);assert.equal(h.recovered,1);
  handle.stop();t.mock.timers.tick(60000);assert.equal(h.recovered,1);
});
