/**
 * Construction AR Lab — EXPERIMENTAL virtual-surface occlusion (WebAR).
 * This is NOT real-world depth/person occlusion: it only ensures visible
 * structural surfaces are drawn opaquely over the camera feed. In empty
 * model spaces, or when a person's limb is in front of a virtual surface,
 * genuine depth-aware masking is not possible without a depth source.
 *
 * Install this AFTER the viewer has enumerated its original GLB meshes for
 * 4D mapping. The added child meshes MUST NOT be included in mapping lists.
 */

export function isOcclusionSurface(name = '') {
  return /(?:slab|\bfloor\b|\bdeck\b|\bwall\b|masonry|roof|foundation)/i.test(String(name));
}

export function hasOpaqueCameraSurface(material) {
  if (!material) return false;
  const mats = Array.isArray(material) ? material : [material];
  return mats.length > 0 && mats.every(m =>
    m && m.visible !== false && !m.transparent && (m.opacity ?? 1) >= 1 && m.depthWrite !== false
  );
}

const asList = m => Array.isArray(m) ? m : [m];
function syncMaterial(src, dest) {
  if (!src || !dest) return;
  if (src.color && dest.color?.copy) dest.color.copy(src.color);
  if (src.emissive && dest.emissive?.copy) dest.emissive.copy(src.emissive);
  if (typeof src.emissiveIntensity === 'number') dest.emissiveIntensity = src.emissiveIntensity;
  dest.opacity = 1;
  dest.transparent = false;
  dest.depthWrite = true;
  dest.depthTest = true;
  dest.colorWrite = true;
}

export function attachVirtualSurfaceOcclusion({THREE, modelRoot, enabled = false, maxProxies = 128} = {}) {
  if (!THREE || THREE.DoubleSide === undefined || !THREE.Mesh || !modelRoot?.traverse) {
    throw new TypeError('THREE and a loaded Three.js modelRoot are required.');
  }
  const originals = [];
  modelRoot.traverse(node => {
    if (node.isMesh && !node.userData?.constructionOcclusionProxy &&
        !node.isInstancedMesh && !node.isSkinnedMesh &&
        node.geometry && node.material &&
        isOcclusionSurface(node.name || node.parent?.name || '') &&
        !(node.children || []).some(c => c.userData?.constructionOcclusionProxy)) {
      originals.push(node);
    }
  });
  if (originals.length > maxProxies) {
    throw new Error(`Occlusion needs ${originals.length} draw calls; maximum is ${maxProxies}. Refine selection before enabling on a phone.`);
  }
  const entries = [];
  let active = Boolean(enabled);
  for (const source of originals) {
    const inputMaterials = asList(source.material);
    if (!inputMaterials.every(m => typeof m?.clone === 'function')) continue;
    const outputMaterials = inputMaterials.map(m => {
      const copy = m.clone();
      syncMaterial(m, copy);
      copy.side = THREE.DoubleSide;
      copy.polygonOffset = true;
      copy.polygonOffsetFactor = -1;
      copy.polygonOffsetUnits = -1;
      copy.name = `Construction AR occlusion: ${source.name}`;
      return copy;
    });
    const proxy = new THREE.Mesh(source.geometry, Array.isArray(source.material) ? outputMaterials : outputMaterials[0]);
    proxy.userData.constructionOcclusionProxy = true;
    proxy.name = `__occlusion_proxy__${source.name}`;
    proxy.frustumCulled = source.frustumCulled;
    proxy.renderOrder = (source.renderOrder || 0) + 1;
    proxy.raycast = () => {}; // never intercept selecting Revit elements
    proxy.visible = active;
    proxy.onBeforeRender = () => {
      const current = asList(source.material);
      for (let i = 0; i < outputMaterials.length; i++) syncMaterial(current[i], outputMaterials[i]);
    };
    source.add(proxy); // inherits source visibility from the 4D schedule
    entries.push({source, proxy, outputMaterials});
  }
  const isSourcePainted = source => asList(source.material).some(m => m && m.visible !== false && (m.opacity ?? 1) > .02);
  const sync = () => {
    for (const {source, proxy} of entries) proxy.visible = active && isSourcePainted(source);
  };
  sync();
  return {
    mode: 'virtual-surfaces-only',
    limitation: 'Cannot know whether a real shoe or leg is nearer or farther than a virtual surface.',
    count: entries.length,
    get enabled() { return active; },
    setEnabled(value) { active = Boolean(value); sync(); },
    sync, // call after 4D visibility/opacity updates (and after model reload)
    dispose() {
      for (const {source, proxy, outputMaterials} of entries) {
        source.remove(proxy);
        for (const m of outputMaterials) m.dispose?.();
      }
      entries.length = 0;
    },
  };
}