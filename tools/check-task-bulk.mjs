import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seedState,newProject} from '../package/web/core.js';
import {bulkTaskKey,retainVisibleTasks,deleteBulkTasks} from '../package/web/task-bulk.js';
import {buildTaskSnapshot,mergeTaskSnapshots} from '../package/web/task-cloud-sync.js';

const state=seedState(),first=newProject({title:'Первый'}),second=newProject({title:'Второй'});
const ep1=first.episodes[0],ep2=second.episodes[0];
ep1.tasks=[{id:'t1',title:'Монтаж',priority:'high'},{id:'t2',title:'Звук',priority:'low',done:true},{id:'t3',title:'Сведение',priority:'normal'}];
ep2.tasks=[{id:'t1',title:'Повторяющийся ID в другом проекте',priority:'normal'},{id:'t4',title:'Загрузка',priority:'urgent'}];
ep1.roles=[{id:'r1',character:'Главный',status:'waiting'}];
state.projects=[first,second];
const baseline=buildTaskSnapshot(state);
const key=(p,ep,t)=>bulkTaskKey(p.id,ep.id,t);
const selected=new Set([key(first,ep1,'t1'),key(first,ep1,'t3'),key(second,ep2,'t4')]);
retainVisibleTasks(selected,[{p:first,ep:ep1,t:ep1.tasks[0]},{p:first,ep:ep1,t:ep1.tasks[2]},{p:second,ep:ep2,t:ep2.tasks[1]}]);
assert.equal(selected.size,3);
const hidden=new Set(selected);
retainVisibleTasks(hidden,[{p:first,ep:ep1,t:ep1.tasks[0]}]);
assert.equal(hidden.size,1,'Filter must drop hidden selections before deletion');
assert.equal(hidden.has(key(first,ep1,'t1')),true);
const result=deleteBulkTasks(state,selected);
assert.equal(result.removed,3);
assert.deepEqual(result.touchedProjects,[first.id,second.id]);
assert.deepEqual(ep1.tasks.map(x=>x.id),['t2']);
assert.deepEqual(ep2.tasks.map(x=>x.id),['t1'],'A same-named task in another project is untouched');
assert.equal(ep1.roles[0].id,'r1','Role data is never altered');
assert.equal(ep1.tasks[0].done,true,'Completed tasks remain unchanged when not selected');
const merged=mergeTaskSnapshots(buildTaskSnapshot(state),baseline,baseline);
assert.deepEqual(merged.conflicts,[]);
assert.deepEqual(merged.tasks.map(x=>x.title).sort(),['Звук','Повторяющийся ID в другом проекте'].sort(),
  'Batch deletion syncs to Cloud without resurrecting removed assignments');
assert.equal(deleteBulkTasks(state,selected).removed,0,'Repeated operation cannot delete additional tasks');
const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../package/web/task-priorities.css',import.meta.url),'utf8');
const host=readFileSync(new URL('../package/LocalServer.cs',import.meta.url),'utf8');
for(const term of ['task-bulk-checkbox','bulk-task-select-all','delete-selected-tasks','clear-task-selection',
  'retainVisibleTasks(selectedTasks,tasks)','deleteBulkTasks(state,keys)',"case 'delete-selected-tasks'"])
  assert.ok(app.includes(term),'Bulk task UI missing '+term);
assert.ok(app.includes("selectedTasks.size?'':'disabled'"),'Delete control must be disabled when no rows are selected');
assert.ok(css.includes('.my-task-bulk-bar'));
assert.ok(css.includes('.task-bulk-selected'));
assert.ok(host.includes('"/task-bulk.js"'),'Desktop server must serve imported JS module');
console.log('PASS: bulk cleanup across episodes, visible-only selection, confirmation wiring and Cloud propagation');
