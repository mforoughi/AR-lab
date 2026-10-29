// Same assumptions and finish-to-start links as the draft Excel schedule.
const rows = [
 [1,'Mobilization and layout',2,[], 'Site setup and layout. No matching geometry in the supplied model.'],
 [2,'Earthwork and excavation',5,[1], 'Excavation is schedule-only; no earthwork geometry was supplied.'],
 [3,'Foundations',5,[2], 'Foundation forming, rebar and concrete. Footing level markers in the FBX are not footing geometry.'],
 [4,'Curing and backfill',5,[3], 'Teaching allowance for foundation curing and backfill. Actual release depends on project requirements.'],
 [5,'Below-slab services',4,[4], 'Below-slab services and preparation. No corresponding MEP objects were supplied.'],
 [6,'Ground floor slab',7,[5], 'Ground slab placement and curing allowance. Linked to the 4-inch concrete slab.'],
 [7,'Structural frame',8,[6], 'Primary structural frame. No identifiable beams or columns were supplied.'],
 [8,'Elevated floor slab',5,[7], 'Lightweight concrete on metal deck, about 13 ft 4 in above Level 1. Supporting frame is absent from the export.'],
 [9,'Roof and waterproofing',7,[8], 'The roof is shown as one complete assembly. Individual roof layers are not separated.'],
 [10,'Exterior walls',10,[7], 'Exterior split-face and CMU wall assemblies. All exported levels are grouped in this teaching sequence.'],
 [11,'Windows and curtain wall',6,[9,10], 'Fixed windows, glazed panels and mullions are installed together in this simplified sequence.'],
 [12,'Partition framing',5,[11], 'Framing is not separate from the complete wall mesh. Interior walls appear during activity 15.'],
 [13,'MEP rough-in',7,[12], 'Mechanical, electrical and plumbing rough-in. Schedule-only; these systems are not in the export.'],
 [14,'Rough-in inspections',2,[13], 'Teaching allowance for inspections before wall closure. No geometry is added.'],
 [15,'Interior wall finishing',7,[14], 'Complete interior-wall assemblies appear at this stage. Framing and wallboard cannot be animated separately.'],
 [16,'Ceilings, paint and floors',6,[15], 'Finish work is schedule-only; these finish layers were not supplied separately.'],
 [17,'Doors and hardware',3,[16], 'All door families are grouped here. External doors may need an earlier task in a detailed schedule.'],
 [18,'MEP testing and fixtures',5,[16], 'Fixtures, testing and commissioning. No MEP geometry is added.'],
 [19,'Punch list and cleaning',3,[17,18], 'Final checks and cleaning. No geometry is added.'],
 [20,'Handover',1,[19], 'Complete the teaching sequence and review the finished model.'],
];
const geometryTasks=new Set([6,8,9,10,11,15,17]);
export const tasks=[];
for(const [id,name,duration,predecessors,description] of rows){
 const start=Math.max(0,...predecessors.map(id=>tasks.find(t=>t.id===id).finish));
 tasks.push({id,name,duration,predecessors,description,start,finish:start+duration,hasGeometry:geometryTasks.has(id)});
}
export const totalDays=Math.max(...tasks.map(t=>t.finish));
export function taskProgress(task,time){return Math.max(0,Math.min(1,(time-task.start)/task.duration));}
export function taskState(task,time){return time<task.start?'future':time>=task.finish?'complete':'active';}
