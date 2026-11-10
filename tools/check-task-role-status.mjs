// An assignment can modify a production role only if the linked role and actor still match.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {taskRoleStatusTarget,taskAssignment,ROLE_STAGES,seedState,normalizeState,newProject} from '../package/web/core.js';

const workspace=seedState();
workspace.actors=[
  {id:'a',name:'AZURE'},
  {id:'b',name:'Лиса'}
];
const project=newProject({title:'Ателье колдовских колпаков'});
const ep=project.episodes[0];
const role={id:'r',character:'Покупательница 1',actorId:'a',actor:'AZURE',status:'processing',lineCount:6};
ep.roles=[role,{id:'unassigned',character:'Массовка',actorId:'',actor:'',status:'waiting'}];
ep.tasks=[
  {id:'assigned',roleId:'r',actorId:'a',title:'Обработать',done:false},
  {id:'linked-only',roleId:'r',actorId:'',title:'Обработать роль',done:false},
  {id:'actor-only',roleId:'',actorId:'a',title:'Примечание актёру',done:false},
  {id:'no-actor',roleId:'unassigned',actorId:'',title:'Общее примечание',done:false},
  {id:'stale',roleId:'r',actorId:'b',title:'Старое назначение',done:false},
  {id:'missing-role',roleId:'gone',actorId:'a',title:'Удалённая роль',done:false}
];
workspace.projects=[project];
assert.equal(taskRoleStatusTarget(workspace,ep,ep.tasks[0]),role);
assert.equal(taskRoleStatusTarget(workspace,ep,ep.tasks[1]),role,'Role assignment alone supplies actor');
for(const id of ['actor-only','no-actor','stale','missing-role']){
  assert.equal(taskRoleStatusTarget(workspace,ep,ep.tasks.find(t=>t.id===id)),null,id);
}
assert.equal(taskAssignment(workspace,ep,ep.tasks[2]).actorId,'a','Actor-only note stays selectable elsewhere');
assert.deepEqual(ROLE_STAGES.map(s=>s[1]),
  ['Жду запись','В записи','Получено','Обрабатываю','На перезапись','Дописать','Принято']);
const old=role.status;
role.status='done';assert.equal(taskRoleStatusTarget(workspace,ep,ep.tasks[0]).status,'done');
assert.equal(ep.tasks[0].done,false,'Changing a role stage does not complete a task');
role.status=old;
role.actorId='b';
assert.equal(taskRoleStatusTarget(workspace,ep,ep.tasks[0]),null,'Reassigned role does not accept stale actor task');
assert.equal(taskRoleStatusTarget(workspace,ep,ep.tasks[1]),role,'Role-only task follows current assignee');
role.actorId='a';
workspace.actors=[];
assert.equal(taskRoleStatusTarget(workspace,ep,ep.tasks[0]),null,'Deleted actor profile disables status changes');
workspace.actors=[{id:'a',name:'AZURE'},{id:'b',name:'Лиса'}];
const restored=normalizeState(workspace);
assert.equal(taskRoleStatusTarget(restored,restored.projects[0].episodes[0],restored.projects[0].episodes[0].tasks[0]).status,'processing');

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=readFileSync(resolve(root,'package/web/app.js'),'utf8');
const css=readFileSync(resolve(root,'package/web/task-priorities.css'),'utf8');
const table=app.slice(app.indexOf('function tasksTable('),app.indexOf('function actorAvatar(',app.indexOf('function tasksTable(')));
const onChange=app.slice(app.indexOf("if(el.classList.contains('task-linked-role-status'))"),app.indexOf("if(el.classList.contains('task-priority-select'))"));
assert.ok(table.includes('statusRole=global?taskRoleStatusTarget(state,ep,t):null'),'Only personal task table adds the stage editor');
assert.ok(table.includes("global?'<th>Статус роли</th>':''"),'Status column header follows global table');
assert.ok(table.includes('class="row-select role-status task-linked-role-status status-'),'Existing stage rendering and visual picker reused');
assert.ok(table.includes('options(ROLE_STAGES,statusRole.status)'),'All production stages are available');
assert.ok(table.includes('task-role-stage-unlinked'),'Unlinked tasks cannot edit a role');
assert.ok(onChange.includes('taskRoleStatusTarget(state,ep,t)'),'Every change revalidates role and actor');
assert.ok(onChange.includes("ROLE_STAGES.some(([stage])=>stage===el.value)"),'Unknown stages must be rejected');
assert.ok(onChange.includes('role.status=el.value'),'Change actual role, not task note');
assert.ok(onChange.includes('role.reviewSeen=reviewVersion(review)'),'Manual director changes override old reviews');
assert.ok(onChange.includes('touch(p)'),'Status update persists/syncs existing state');
assert.ok(onChange.includes('render();return;'),'Do not run normal role-status handler afterwards');
for(const key of ['.task-role-stage-cell','.task-role-stage-unlinked'])
  assert.ok(css.includes(key),'Stage selector style missing: '+key);
console.log('PASS: per-actor task role status guard, legacy notes, role reassignment and UI');
