// Studio 1.8.6 regression checks: task data, sorting and visual wiring.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {normalizeState,seedState,newProject,filterEpisodeRoles,episodeRoleCharacterKey,episodeRoleCharacterOptions,taskRows,TASK_PRIORITIES,taskPriority,taskPriorityName} from '../package/web/core.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const src=p=>readFileSync(resolve(root,p),'utf8');
const raw=seedState(),project=newProject({title:'Тестовый проект'}),ep=project.episodes[0];
project.archived=false;
ep.tasks=[
  {id:'one',title:'Срочная задача',mine:false,done:false,due:'2026-10-26',priority:'urgent'},
  {id:'two',title:'Приоритетная задача',mine:false,done:false,due:'2026-10-23',priority:'high'},
  {id:'three',title:'Задача из старого архива',mine:false,done:false,due:'',priority:undefined},
  {id:'four',title:'Можно позже',mine:false,done:false,due:'',priority:'low'},
  {id:'five',title:'Сделано',mine:false,done:true,due:'',priority:'urgent'}
];
ep.roles=[
  {id:'r1',character:'Бета',status:'waiting',actorId:'',actor:'',inProject:false},
  {id:'r2',character:'Альфа',status:'waiting',actorId:'',actor:'',inProject:false},
  {id:'r3',character:'Вега',status:'waiting',actorId:'',actor:'',inProject:false}
];
raw.projects=[project];
const normalized=normalizeState(raw);
const rows=taskRows(normalized,{includeArchived:true,order:'priority'});
assert.deepEqual(rows.map(x=>x.t.id),['one','two','three','four','five'],'Urgent > high > normal > low, completed at end');
assert.equal(normalized.projects[0].episodes[0].tasks[2].priority,'normal','Legacy task defaults to normal');
assert.deepEqual(taskRows(normalized,{priority:'urgent'}).map(x=>x.t.id),['one','five']);
assert.equal(taskRows(normalized,{priority:'low'})[0].t.id,'four');
assert.equal(taskRows(normalized,{priority:'high',query:'другая'}).length,0);
assert.equal(taskPriority('invalid'),'normal');
assert.equal(taskPriorityName('urgent'),'Срочно');
assert.equal(TASK_PRIORITIES.length,4);
assert.equal(normalizeState({...raw,projects:[{...project,episodes:[{...ep,tasks:[{id:'bad',title:'Text',priority:'untrusted'}]}]}]}).projects[0].episodes[0].tasks[0].priority,'normal');
const episodeRoles=normalized.projects[0].episodes[0].roles;
const characters=episodeRoleCharacterOptions(episodeRoles);
assert.deepEqual(characters.map(c=>c.label),['Альфа','Бета','Вега'],'Characters are listed alphabetically in the fourth dropdown');
assert.equal(episodeRoleCharacterKey(episodeRoles[1]),'character:альфа');
assert.deepEqual(filterEpisodeRoles(normalized,episodeRoles,{characterKey:'character:альфа'}).map(r=>r.character),['Альфа']);
assert.deepEqual(filterEpisodeRoles(normalized,episodeRoles,{characterKey:'character:вега',status:'received'}),[],
  'Character and status filters must combine');
assert.deepEqual(filterEpisodeRoles(normalized,episodeRoles,{characterKey:'character:альфа',actorKey:'unassigned'}).map(r=>r.character),['Альфа']);
assert.deepEqual(filterEpisodeRoles(normalized,episodeRoles,{characterKey:'all'}).map(r=>r.character),['Бета','Альфа','Вега']);
const caseInsensitive=[{...episodeRoles[0],character:'Коко'},{...episodeRoles[1],character:' коко '},{...episodeRoles[2],character:'Таро'}];
assert.equal(episodeRoleCharacterOptions(caseInsensitive).find(c=>c.key==='character:коко').count,2);
assert.equal(filterEpisodeRoles(normalized,caseInsensitive,{characterKey:'character:коко'}).length,2);
assert.deepEqual(filterEpisodeRoles(normalized,normalized.projects[0].episodes[0].roles,{order:'original'}).map(r=>r.character),['Бета','Альфа','Вега']);
const app=src('package/web/app.js'),css=src('package/web/task-priorities.css'),picker=src('package/web/visual-selects.js');
for(const required of [
  "id=\"role-character-filter\"",
  "characterKey:ui.roleCharacter||'all'",
  "id=\"task-priority-filter\"",
  "class=\"task-priority-select\"",
  "priority:taskPriority(data.priority)",
  "priority:ui.taskPriority||'all'",
  "order:'priority'",
  "priority-${e(taskPriority(t.priority))}"
]) assert.ok(app.includes(required),'Missing Studio UI wiring: '+required);
for(const selector of ['tbody tr.task-priority-row','priority-urgent','priority-high','priority-normal','priority-low','.fv-dropdown-priority'])
  assert.ok(css.includes(selector),'Priority UI color is missing: '+selector);
assert.ok(picker.includes("return 'priority'"),'Priority dropdown must be visual');
assert.ok(picker.includes("return 'character'"),'Character dropdown must be visual');
assert.ok(picker.includes("'Поиск персонажа'"),'Character dropdown must support search');
assert.ok(!app.includes("['character','По имени персонажа']"),'Character must not be in sort menu');
const html=src('package/web/index.html'),server=src('package/LocalServer.cs');
assert.ok(html.includes('href="task-priorities.css"'));
assert.ok(server.includes('"/task-priorities.css"'),'Local HTTP host must serve priority CSS');
assert.match(src('package/VERSION.txt').trim(),/^\d+\.\d+\.\d+$/,'Studio must declare a valid release version');
const localActor=normalizeState({...raw,actors:[{
 id:'profile-test',name:'Тестовый актёр',telegram:'test_voice',actorAccess:true,
 avatar:'',avatarPreview:'data:image/webp;base64,AAAA',avatarThumbSource:'6:deadbeef'
}]});
assert.equal(localActor.actors[0].avatarPreview,'data:image/webp;base64,AAAA',
  'Cloud-safe thumbnail survives round trip through Studio state');
assert.equal(localActor.actors[0].avatarThumbSource,'6:deadbeef');
const projection=src('package/CloudCommon.cs');
assert.ok(projection.includes('S(actor.Value,"name")'),'Desktop publishes actor names to owner cloud');
assert.ok(projection.includes('S(actor.Value,"telegram")'),'Desktop publishes Telegram usernames');
assert.ok(projection.includes('S(actor.Value,"avatarPreview")'),'Desktop shares small thumbnail, not full local photo');
assert.ok(app.includes('ensureActorPreviews().catch'),'Existing actor photos are converted after boot');
assert.ok(app.includes('canvas.toDataURL'),'Actor thumbnails are generated by WebView canvas');
console.log('PASS: fourth character filter, combined filters, saved task priorities and desktop UI');
