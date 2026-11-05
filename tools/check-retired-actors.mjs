import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seedState,newActor,newProject,newEpisode,removeActor,pruneRetiredActors,normalizeState,
  actorPublicFeed,cloneEpisodeCast,taskAssignment,taskRoleStatusTarget} from '../package/web/core.js';
import {vacationReviewRows,reassignVacationRole,availableReplacementActors} from '../package/web/vacation-review.js';
import {rankActorsForRole} from '../package/web/casting-assistant.js';
import {actorWorkloadRows} from '../package/web/actor-workload.js';
import {actorDeliveryRows} from '../package/web/actor-statistics.js';

const old=newActor({id:'old',name:'Бывший',telegram:'former',actorAccess:true,voiceGroup:'male'});
const next=newActor({id:'next',name:'Новый',voiceGroup:'male'});
const role=(id,status)=>({id,character:id,actorId:'old',actor:'Бывший',status,
  voiceGender:'male',notes:'Сохранить заметку',folder:'D:/voice',subtitle:'D:/sub.srt',lineCount:42});
const task={id:'task1',title:'Записать',actorId:'old',roleId:'r1',done:false};
const active=newProject({id:'p1',title:'Рабочий проект',episodes:[newEpisode({
  id:'ep1',number:'1',roles:[role('r1','waiting'),role('r2','done')],tasks:[task]
})]});
const archive=newProject({id:'p2',title:'Архивный проект',archived:true,episodes:[
  newEpisode({id:'ep2',roles:[role('r3','processing')]})
]});
const trash=newProject({id:'p3',title:'Корзина',episodes:[
  newEpisode({id:'ep3',roles:[role('trash-role','retake')]})
]});
const state=seedState();
state.actors=[old,next];
state.projects=[active,archive];
state.trash=[trash];
const original=JSON.stringify(state);
assert.equal(removeActor(state,'missing'),null);
assert.equal(JSON.stringify(state),original,'Unknown actor deletion is a no-op');
removeActor(state,'old');
assert.equal(old.actorAccess,false,'Actor account must be disabled');
assert.ok(old.retiredAt,'Tombstone records deletion time');
for(const p of [...state.projects,...state.trash])
  for(const ep of p.episodes)
    for(const r of ep.roles)assert.equal(r.actorId,'old','Do not lose historical actor IDs');
assert.equal(pruneRetiredActors(state),0,'References prevent early removal');
assert.equal(actorPublicFeed(state,'old'),null,'Retired actor cannot receive a published feed');
assert.equal(taskAssignment(state,active.episodes[0],task).actorName,'Бывший (Удалённый актёр)');
assert.equal(taskRoleStatusTarget(state,active.episodes[0],task),null,'A retired performer cannot change task status');
const rows=vacationReviewRows(state,[]);
assert.deepEqual(rows.map(x=>x.r.id).sort(),['r1','r2','r3'],'Show all role stages, including completed and archived projects');
assert.ok(rows.every(x=>x.vacation.status==='removed'));
assert.equal(vacationReviewRows(state,[]).some(x=>x.r.id==='trash-role'),false,'Do not transfer a role in deleted projects');
assert.deepEqual(availableReplacementActors(state,[],'old').map(a=>a.id),['next']);
assert.deepEqual(rankActorsForRole(state,active.episodes[0],active.episodes[0].roles[0],[],{showAll:true}).map(x=>x.actor.id),['next']);
assert.equal(actorWorkloadRows(state).some(x=>x.actor.id==='old'),false,'Removed actor is not in workload');
assert.equal(actorDeliveryRows(state).some(x=>x.actor.id==='old'),false,'Removed actor is not in delivery statistics');
const copy=cloneEpisodeCast(active.episodes[0],state);
assert.ok(copy.every(r=>!r.actorId&&!r.actor),'New episodes must not inherit a removed actor');

const normalized=normalizeState(JSON.parse(JSON.stringify(state)));
assert.equal(normalized.actors.find(a=>a.id==='old')?.retiredAt,old.retiredAt,'Deletion survives export/import');
assert.equal(normalized.projects[0].episodes[0].roles[0].actorId,'old','Role links survive export/import');
assert.equal(normalized.actors.find(a=>a.id==='old')?.actorAccess,false);

const first=reassignVacationRole(state,[],{projectId:'p1',episodeId:'ep1',roleId:'r1',previousActorId:'old',newActorId:'next'});
assert.equal(first.role.status,'waiting');
assert.equal(first.role.folder,'D:/voice');
assert.equal(first.role.subtitle,'D:/sub.srt');
assert.equal(first.role.notes,'Сохранить заметку');
assert.equal(task.actorId,'next','Role-linked tasks follow a reassignment');
assert.equal(pruneRetiredActors(state),0);
reassignVacationRole(state,[],{projectId:'p1',episodeId:'ep1',roleId:'r2',previousActorId:'old',newActorId:'next'});
assert.equal(active.episodes[0].roles[1].status,'waiting','Completed assignment needs a new recording only after transfer');
reassignVacationRole(state,[],{projectId:'p2',episodeId:'ep2',roleId:'r3',previousActorId:'old',newActorId:'next'});
assert.equal(vacationReviewRows(state,[]).length,0,'Review closes when all visible roles are reassigned');
assert.equal(pruneRetiredActors(state),0,'References in trash still block purging the profile');
trash.episodes[0].roles=[];
assert.equal(pruneRetiredActors(state),1,'Remove tombstone only after the final role and task reference are gone');
assert.equal(state.actors.some(a=>a.id==='old'),false);

const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
assert.match(app,/deleted-actor-tag/);
assert.match(app,/pruneRetiredActors\(state\)/);
assert.match(app,/v\.status==='removed'/);
assert.match(app,/!a\.retiredAt/);
assert.match(app,/const removed=!!state\.actors\.find/);
console.log('PASS: archive actor deletion, review, reassignment and safe garbage collection');
