// Match only the exact concept GLB supplied with this app. Other models keep
// their manual links; filenames and file sizes alone are not a model identity.
const MODEL_SHA256 = 'c5f0ed3d3e089209b4965fa5b0614bc1532c07eb5838b58d3f8e4e66fb068d28';
const taskNames = ['Site base', 'Long-side seating terraces', 'End seating terraces', 'Roof support columns', 'Roof panels', 'Seating installation', 'Playing field and turf', 'Goals and field markings'];
const normalized = name => String(name).trim().toLowerCase();

export async function stadiumLinks(bytes, metadata) {
  if (metadata.stadiumScheduleLinked || Object.keys(metadata.mappings || {}).length || metadata.tasks?.length !== 8) return null;
  const tasks = taskNames.map(name => metadata.tasks.filter(t => normalized(t.name) === normalized(name)));
  if (tasks.some(matches => matches.length !== 1)) return null;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== MODEL_SHA256) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))));
  const mappings = {};
  for (const [index, nodeIndex] of gltf.scenes[gltf.scene || 0].nodes.entries()) {
    const name = gltf.nodes[nodeIndex].name;
    const group = name === 'Site_base' ? 0 : name.startsWith('Stand_long_') ? 1 : name.startsWith('Stand_end_') ? 2 : name.startsWith('Column_') ? 3 : name.startsWith('Roof_') ? 4 : name.startsWith('Seating_') ? 5 : name === 'Pitch' || name.startsWith('Turf_stripe_') ? 6 : /^(Goalpost_|Crossbar_|Touchline_|Goalline_|Halfway$|Area_|Circle_)/.test(name) ? 7 : -1;
    if (group < 0) return null;
    mappings['mesh_' + index] = tasks[group][0].id;
  }
  return Object.keys(mappings).length === 339 ? mappings : null;
}
