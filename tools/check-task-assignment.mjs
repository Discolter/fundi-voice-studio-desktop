// Regression checks: task links are optional, durable and show live role workload.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {normalizeState,seedState,newProject,taskRows,taskAssignment,groupTaskRows,episodeAssignedActorIds,escapeHTML}
  from '../package/web/core.js';
import {taskRoleIds,archiveTask,restoreTask} from '../package/web/task-history.js';
import {buildTaskSnapshot,applyTaskSnapshot,mergeTaskSnapshots,verifySharedTaskLinks} from '../package/web/task-cloud-sync.js';

const workspace=seedState();
workspace.actors=[{id:'actor1',name:'Тестовый актёр',telegram:'actor_test'}];
const p=newProject({title:'Тестовый сериал'});
const episode=p.episodes[0];
episode.roles=[{id:'role1',character:'Главный герой',actorId:'actor1',actor:'Тестовый актёр',lineCount:48},
 {id:'role2',character:'Статист',actorId:'',actor:'',lineCount:0}];
episode.tasks=[
 {id:'task1',title:'Обработать запись',actorId:'actor1',roleId:'role1',priority:'high'},
 {id:'task2',title:'Старая задача',priority:'normal'},
 {id:'task3',title:'Проверить роль',roleId:'role2',priority:'low'},
 {id:'task4',title:'Связь без роли',actorId:'actor1',priority:'low'}
];
workspace.projects=[p];
const n=normalizeState(workspace);
const ep=n.projects[0].episodes[0], actor=n.actors[0];
assert.equal(ep.tasks[0].actorId,actor.id,'Actor link persists on save/load');
assert.equal(ep.tasks[0].roleId,ep.roles[0].id,'Role link persists on save/load');
assert.equal(ep.tasks[1].actorId,'','Legacy tasks remain unassigned');
assert.equal(ep.tasks[1].roleId,'','Legacy tasks remain unassigned');
assert.equal(taskAssignment(n,ep,ep.tasks[0]).actorName,'Тестовый актёр');
assert.equal(taskAssignment(n,ep,ep.tasks[0]).character,'Главный герой');
assert.equal(taskAssignment(n,ep,ep.tasks[0]).lineCount,48);
assert.equal(taskAssignment(n,ep,ep.tasks[2]).lineCount,0,'Zero lines is a real value');
assert.equal(taskAssignment(n,ep,ep.tasks[1]).lineCount,null,'Absent role has unknown workload');
assert.equal(taskAssignment(n,ep,ep.tasks[3]).actorName,'Тестовый актёр','Actor-only task works');
ep.roles[0].lineCount=102;
assert.equal(taskAssignment(n,ep,ep.tasks[0]).lineCount,102,'Task workload follows edited role');
ep.roles[0].actorId='';
assert.equal(taskAssignment(n,ep,ep.tasks[0]).actorName,'Тестовый актёр','Actor fallback survives removed role assignment');
assert.equal(taskRows(n,{query:'главный герой'})[0].t.id,'task1','Search includes linked character');
assert.equal(taskRows(n,{query:'actor_test'}).length,2,'Search includes actor username');
const archived=normalizeState(n);
assert.equal(archived.projects[0].episodes[0].tasks[0].roleId,ep.roles[0].id,'Link survives a second normalization');
ep.roles[0].actorId=actor.id;
ep.roles[1].actorId=actor.id;
ep.roles[0].lineCount=47;
ep.roles[1].lineCount=1;
const shared={...ep.tasks[0],id:'shared',title:'Один файл',roleIds:['role1','role2','role2']};
ep.tasks.push(shared);
assert.equal(taskAssignment(n,ep,shared).lineCount,48);
assert.deepEqual(taskRoleIds(shared),['role1','role2']);
assert.ok(taskRows(n,{query:'статист'}).some(({t})=>t===shared));
const sharedGroup=groupTaskRows(n,taskRows(n)).find(group=>group.rows.some(({t})=>t===shared));
assert.equal(sharedGroup.total,48,'Count each character once across the shared and individual tasks');
const snapshot=buildTaskSnapshot(n);
const cloudTask=snapshot.tasks.find(t=>t.id===shared.id);
assert.deepEqual(cloudTask.roleIds,['role1','role2']);
const applyTo=normalizeState(n);
applyTaskSnapshot(applyTo,snapshot.tasks);
assert.deepEqual(applyTo.projects[0].episodes[0].tasks.find(t=>t.id===shared.id).roleIds,['role1','role2']);
const shortened={...cloudTask,roleIds:['role1']};
const base={tasks:[cloudTask]};
const merged=mergeTaskSnapshots({tasks:[shortened]},base,{tasks:[{...cloudTask,title:'Обработать общий файл'}]});
assert.deepEqual(merged.tasks[0],{...shortened,title:'Обработать общий файл'});
assert.deepEqual(mergeTaskSnapshots({tasks:[shortened]},base,{tasks:[{...cloudTask,actorId:'other'}]}).conflicts,['shared']);
const {roleIds:discarded,...legacy}=cloudTask;
assert.deepEqual(mergeTaskSnapshots(base,{tasks:[]},{tasks:[legacy]}).tasks,[cloudTask]);
assert.throws(()=>verifySharedTaskLinks(base,{tasks:[legacy]}),/не подтвердило все роли/);
assert.doesNotThrow(()=>verifySharedTaskLinks(base,base));
archiveTask(n,n.projects[0],ep,shared);
ep.tasks=ep.tasks.filter(t=>t!==shared);
assert.deepEqual(restoreTask(n,n.taskHistory[0].id).task.roleIds,['role1','role2']);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=readFileSync(resolve(root,'package/web/app.js'),'utf8');
const css=readFileSync(resolve(root,'package/web/task-priorities.css'),'utf8');
for(const term of ['taskAssignmentFields(ep,t)','taskActorPicker','taskRolePicker','updateTaskAssignmentPickers',
  'type="checkbox" name="taskShowAllActors"',
  'name="actorId"','type="checkbox" name="roleIds"',"formData.getAll('roleIds')",'Один файл','<th>Актёр</th><th>Персонаж</th><th>Реплики</th>'])
  assert.ok(app.includes(term),'Task assignment UI missing: '+term);
const roster={actors:[
  {id:'cast',name:'Артур'},
  {id:'legacy',name:'Борис'},
  {id:'other',name:'Вера'},
  {id:'removed',name:'Глеб',retiredAt:'2026-10-01'},
  {id:'duplicate-1',name:'Даша'},
  {id:'duplicate-2',name:'Даша'}
]};
const firstEpisode={roles:[
  {actorId:'cast',status:'done'},{actorId:'cast',status:'waiting'},
  {actor:' борис '},{actor:'Даша'},{actorId:'removed'},{}
]};
const secondEpisode={roles:[{actorId:'other'}]};
const range=app.slice(app.indexOf('function taskActorPicker('),app.indexOf('function taskAssignmentFields('));
const picker=new Function('state','episodeAssignedActorIds','e','vacationOptionSuffix','field',
  range+';return taskActorPicker;')(roster,episodeAssignedActorIds,escapeHTML,()=>'',(_label,html,hint)=>html+hint);
const values=markup=>[...markup.matchAll(/<option value="([^"]*)"/g)].map(match=>match[1]);
assert.deepEqual(values(picker(firstEpisode)),['','cast','legacy'],'Show one option per eligible performer from this episode');
assert.deepEqual(values(picker(secondEpisode)),['','other'],'Actors from another episode never carry over');
assert.deepEqual(values(picker(firstEpisode,'',true)),['','cast','legacy','other','duplicate-1','duplicate-2'],
  'Explicitly showing all opens the active studio roster');
assert.deepEqual(values(picker({roles:[]})),['']);
assert.match(picker({roles:[]}),/В серии пока нет назначенных актёров/);
assert.match(picker(null),/Сначала выбери серию/);
assert.match(picker(firstEpisode,'other'),/<optgroup label="Текущий исполнитель" data-task-current-assignee><option value="other" selected>/,
  'Keep an existing task assignee through filtering');
assert.match(picker(firstEpisode,'removed'),/<option value="removed" selected>/,
  'Keep a retired assignee while editing an existing assignment');
assert.ok(css.includes('.task-line-count'),'Workload column needs styling');
assert.ok(css.includes('.task-character-cell'),'Character column needs styling');
console.log('PASS: episode cast picker, full roster override, retained assignees, task links and live workload');
