// Regression: notification "Open role" must show the submitter's roles in that episode.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {episodeRoleActorKey,episodeRoleActorOptions,filterEpisodeRoles} from '../package/web/core.js';

const state={actors:[{id:'azure',name:'AZURE'},{id:'other',name:'Другой актёр'}]};
const roles=[
  {id:'buyer1',character:'Покупательница 1',actorId:'azure',actor:'AZURE',status:'received'},
  {id:'buyer2',character:'Покупательница 2',actorId:'azure',actor:'AZURE',status:'waiting'},
  {id:'vendor',character:'Продавец',actorId:'other',actor:'Другой актёр',status:'received'}
];
const actorKey='id:azure';
assert.ok(episodeRoleActorOptions(state,roles).some(choice=>choice.key===actorKey));
assert.deepEqual(filterEpisodeRoles(state,roles,{actorKey}).map(role=>role.id),['buyer1','buyer2'],
  'Opening an actor submission must display every role by that actor in this episode');
roles[0].actorId='other'; // Notification actor stays AZURE even if the submitted role was reassigned.
assert.deepEqual(filterEpisodeRoles(state,roles,{actorKey}).map(role=>role.id),['buyer2'],
  'Reassignment must not redirect the notification to another actor');
assert.equal(episodeRoleActorKey(state,{actorId:'',actor:'Имя без профиля'}),'name:имя без профиля',
  'Legacy assignments can still use the existing name-based filter');

const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const start=app.indexOf("case 'notification-open-role':");
const end=app.indexOf("case 'new-project':",start);
assert.ok(start>=0&&end>start,'Notification navigation handler exists');
const handler=app.slice(start,end);
assert.ok(handler.includes("const actorKey=message.actorId?'id:'+message.actorId:episodeRoleActorKey(state,found.r);"),
  'Prefer the submission actorId, not the current role assignee');
assert.ok(handler.includes("openProject(found.p.id,found.ep.id,'roles',actorKey)"),
  'Notification must pass the actor filter to the episode route');
assert.ok(app.includes("episodeRoleActorOptions(state,ep.roles).some(item=>item.key===actorKey)?actorKey:'all'"),
  'Missing/stale actors must fall back to showing all roles');
console.log('PASS: notification links preserve actor filter and safely handle reassigned roles');
