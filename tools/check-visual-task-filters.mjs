import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const visual=readFileSync('package/web/visual-selects.js','utf8');
const css=readFileSync('package/web/visual-selects.css','utf8');
const app=readFileSync('package/web/app.js','utf8');
const ids=['task-priority-filter','task-order-filter','task-lines-filter','task-status-filter','task-project-filter','task-actor-filter'];
for(const id of ids)assert.ok(app.includes(id),'Missing Studio filter: '+id);
for(const fragment of ["select.id === 'task-lines-filter'","select.id === 'task-project-filter'","type === 'lines'","type === 'project'",
 'taskSortDetails','taskLineDetails','taskStatusDetails','fv-workload-art','fv-project-art',
 "type === 'lines' || type === 'project'","type==='actor'"]){
 assert.ok(visual.includes(fragment),'Visual select missing: '+fragment);
}
for(const id of ['small','medium','large'])assert.ok(css.includes('data-workload='+id),'Missing workload icon '+id);
for(const color of ['open','overdue','noDue'])assert.ok(css.includes('data-status='+color),'Missing status icon '+color);
assert.ok(visual.includes('actorAvatar(detail.actor)'), 'Actors must retain real avatars');
assert.ok(visual.includes('select.dispatchEvent(new Event(\'change\',{bubbles:true}))'),'Selection must update task filters');
console.log('PASS: all six personal assignment dropdowns display illustrated choices with helpful captions');
