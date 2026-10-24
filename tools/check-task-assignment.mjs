// Regression checks: task links are optional, durable and show live role workload.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {normalizeState,seedState,newProject,taskRows,taskAssignment} from '../package/web/core.js';

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
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=readFileSync(resolve(root,'package/web/app.js'),'utf8');
const css=readFileSync(resolve(root,'package/web/task-priorities.css'),'utf8');
for(const term of ['taskAssignmentFields(ep,t)','taskActorChoices','taskRoleChoices','updateTaskAssignmentPickers',
  'name="actorId"','name="roleId"','role?.actorId||data.actorId','<th>Актёр</th><th>Персонаж</th><th>Реплики</th>'])
  assert.ok(app.includes(term),'Task assignment UI missing: '+term);
assert.ok(css.includes('.task-line-count'),'Workload column needs styling');
assert.ok(css.includes('.task-character-cell'),'Character column needs styling');
console.log('PASS: task actor and character links, live workload, old data and UI checks');
