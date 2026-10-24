// Regression: interactive Studio task filters, ordering and missing line-count behavior.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {seedState,newProject,normalizeState,taskRows,taskAssignment,TASK_ORDERS,TASK_LINE_FILTERS,TASK_STATUS_FILTERS} from '../package/web/core.js';

const workspace=seedState();
workspace.actors=[{id:'actor-a',name:'Алина',telegram:'alina'},{id:'actor-b',name:'Борис',telegram:'boris'}];
const beta=newProject({title:'Бета'}),alpha=newProject({title:'Альфа',archived:true});
const ep=beta.episodes[0],other=alpha.episodes[0];
ep.roles=[
 {id:'r0',character:'Ноль',actorId:'actor-b',actor:'Борис',lineCount:0},
 {id:'r12',character:'Двенадцать',actorId:'actor-a',actor:'Алина',lineCount:12},
 {id:'r90',character:'Девяносто',actorId:'actor-b',actor:'Борис',lineCount:90},
 {id:'r150',character:'Сто пятьдесят',actorId:'actor-a',actor:'Алина',lineCount:150},
 {id:'runknown',character:'Нет количества',actorId:'',actor:'',lineCount:null}
];
ep.tasks=[
 {id:'unknown',title:'Без числа',roleId:'runknown',priority:'urgent'},
 {id:'ninety',title:'Девяносто',roleId:'r90',priority:'high',due:'2026-11-06'},
 {id:'zero',title:'Ноль реплик',roleId:'r0',priority:'normal',due:'2026-11-03'},
 {id:'twelve',title:'Мало реплик',roleId:'r12',priority:'urgent',due:'2026-11-02'},
 {id:'done',title:'Готово',roleId:'r150',done:true,priority:'high',due:'2026-10-23'},
 {id:'hundred-fifty',title:'Просрочено',roleId:'r150',priority:'low',due:'2026-10-19'},
 {id:'actor-only',title:'Без персонажа',actorId:'actor-b',priority:'normal'}
];
other.roles=[{id:'r60',character:'Шестьдесят',actorId:'actor-a',actor:'Алина',lineCount:60}];
other.tasks=[{id:'sixty',title:'Архивное поручение',roleId:'r60',priority:'normal',due:'2026-11-05'}];
workspace.projects=[beta,alpha];
const n=normalizeState(workspace);
const rows=(opts={})=>taskRows(n,{includeArchived:true,...opts});
const ids=opts=>rows(opts).map(({t})=>t.id);
const counts=opts=>rows(opts).map(({ep,t})=>taskAssignment(n,ep,t).lineCount);
assert.deepEqual(counts({order:'linesAsc'}),[0,12,60,90,150,null,null,150],'Ascending: numeric 0 first, missing last, done at bottom');
assert.deepEqual(counts({order:'linesDesc'}),[150,90,60,12,0,null,null,150],'Descending: missing last among active, completed at bottom');
assert.deepEqual(ids({lines:'small',order:'linesAsc'}),['zero','twelve']);
assert.deepEqual(ids({lines:'medium'}).sort(),['ninety','sixty']);
assert.deepEqual(ids({lines:'large'}),['hundred-fifty','done']);
assert.deepEqual(ids({lines:'unknown'}).sort(),['actor-only','unknown']);
assert.deepEqual(ids({actorId:'actor-b'}).sort(),['actor-only','ninety','zero']);
assert.deepEqual(ids({actorId:'unassigned'}),['unknown']);
assert.deepEqual(ids({projectId:alpha.id}),['sixty']);
assert.deepEqual(ids({projectId:alpha.id,priority:'urgent'}),[]);
assert.deepEqual(ids({status:'done'}),['done']);
assert.deepEqual(ids({status:'overdue'}),['hundred-fifty']);
assert.deepEqual(ids({status:'noDue'}).sort(),['actor-only','unknown']);
assert.equal(ids({status:'open'}).includes('done'),false);
assert.deepEqual(ids({actorId:'actor-a',lines:'small',status:'open'}),['twelve']);
assert.deepEqual(ids({order:'dueAsc'}).slice(0,2),['hundred-fifty','twelve']);
assert.deepEqual(ids({order:'dueDesc'}).slice(0,2),['ninety','sixty']);
assert.equal(ids({order:'linesAsc'}).at(-1),'done');
assert.equal(rows({includeArchived:false}).length,7);
assert.equal(TASK_ORDERS.some(([key])=>key==='linesAsc'),true);
assert.equal(TASK_ORDERS.some(([key])=>key==='linesDesc'),true);
assert.equal(TASK_LINE_FILTERS.length,5);
assert.equal(TASK_STATUS_FILTERS.length,5);
// Workload is deliberately derived live from the role, never duplicated on task.
const target=n.projects[0].episodes[0].roles.find(r=>r.character==='Ноль');
target.lineCount=200;
assert.equal(counts({lines:'large'}).includes(200),true);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=readFileSync(resolve(root,'package/web/app.js'),'utf8');
const style=readFileSync(resolve(root,'package/web/task-priorities.css'),'utf8');
const picker=readFileSync(resolve(root,'package/web/visual-selects.js'),'utf8');
for(const part of ['task-order-filter','task-lines-filter','task-status-filter','task-project-filter','task-actor-filter',
  'reset-task-filters','order:ui.taskOrder','lines:ui.taskLines','status:ui.taskStatus','actorId:ui.taskActor',
  'projectId:ui.taskProject','taskOrder:ui.taskOrder','validTaskOrder(el.value)'])
  assert.ok(app.includes(part),'Missing task filter wiring: '+part);
assert.ok(style.includes('.my-task-filters'));
assert.ok(style.includes('grid-template-columns'));
assert.ok(picker.includes("select.id === 'task-order-filter'"));
assert.ok(picker.includes("select.id === 'task-actor-filter'"));
console.log('PASS: 6 Studio filters, all sorts, live workload, zero-vs-unknown, archived and completed behavior');

assert.ok(app.includes('task-workload-low'),'Desktop uses green for 0–20 lines');
assert.ok(app.includes('task-workload-medium'),'Desktop uses yellow for 21–100 lines');
assert.ok(app.includes('task-workload-high'),'Desktop uses red for 101+ lines');
assert.ok(css.includes('body[data-theme=light] .tasks-priority-table .task-line-count.task-workload-high'),'Light mode contrast maintained');
