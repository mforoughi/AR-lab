export function applySchedule(parts, metadata, day, selected = new Set()) {
  const tasks = metadata.tasks || [], byId = new Map(tasks.map(t => [t.id, t]));
  let linked = 0;
  for (const part of parts) {
    const task = byId.get(metadata.mappings?.[part.id]);
    if (task) linked++;
    part.mesh.visible = !task || day >= task.start;
    const active = task && day >= task.start && day < task.start + task.duration;
    for (const [index, material] of part.materials.entries()) {
      material.color.copy(part.colors[index]);
      if (selected.has(part.id)) material.color.set('#36c9d0');
      else if (active) material.color.set('#d6ad49');
    }
  }
  return {linked, unlinked: parts.length - linked, canPlay: tasks.length > 0 && linked > 0};
}
