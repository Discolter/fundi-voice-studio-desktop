import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../package/StudioCloud.cs',import.meta.url),'utf8');
const host=readFileSync(new URL('../package/LocalServer.cs',import.meta.url),'utf8');
const css=readFileSync(new URL('../package/web/compact.css',import.meta.url),'utf8');
const before=app.indexOf('function actorCabinetVisibilityButton('),after=app.indexOf('function rolesTable(',before);
assert.ok(before>0&&after>before,'Roles table needs dedicated actor visibility control');
const fn=app.slice(before,after);
for(const str of ['actorForRole(state,r)','cloud.hiddenRoles||[]','x.actorId===actor.id&&x.roleId===r.id',
    "if(r.status!=='done'&&!hidden)return ''",'data-action="actor-cabinet-visibility"',
    'Скрыть у актёра','Вернуть актёру','!native||!cloud.connected'])
 assert.ok(fn.includes(str),'Missing stateful owner control: '+str);
assert.ok(app.includes('${actorCabinetVisibilityButton(p,ep,r)}'),
    'Visibility action must appear inside regular Studio roles table');
assert.ok(app.includes("case 'actor-cabinet-visibility':"));
assert.ok(app.includes("cloud=await api('cloud/roles/visibility',{actorId:d.actor,roleId:d.item,hidden})"));
assert.ok(app.includes('if(!r||r.actorId!==d.actor)'), 'Do not act on reassigned role');
assert.ok(app.includes("if(hidden&&roleReviewStage(r,reviewForRole(r))!=='done')"),'Check accepted stage before hiding');
assert.ok(cloud.includes('public object SetActorRoleVisibility(string actorId,string roleId,bool hidden)'));
assert.ok(cloud.includes('CloudHttp.Request(server,"/v1/studio/actor-roles/visibility","POST"'));
assert.ok(cloud.includes('hiddenRoles=JsonData.A(fresh,"hiddenRoles")'));
assert.ok(cloud.includes('hiddenRoles=JsonData.A(remote,"hiddenRoles")'));
assert.ok(cloud.includes('hiddenRoles=hiddenRoles'));
assert.ok(host.includes('route=="cloud/roles/visibility"'));
assert.match(css,/\.cast-table \.actor-cabinet-visibility/);
assert.match(css,/\.role-actor-hidden-label/);
assert.doesNotMatch(fn,/touch\(p\)|persist\(\)|delete-role|ep\.roles=/,
  'The actor cabinet action must never alter the local Studio table');

const bulk=app.slice(app.indexOf('function acceptedEpisodeRolesForActors('),app.indexOf('function episodeRoles('));
for(const key of ['withRoleReviews({projects:[p]},cloud.reviews||[])', "r.status!=='done'",'cloud.hiddenRoles||[]','actorForRole(state,r)','actorId:actor.id,roleId:r.id'])
 assert.ok(bulk.includes(key),'Episode archive eligibility missing: '+key);
const bulkUI=app.slice(app.indexOf('function episodeRoles('),app.indexOf('const actorLabel='));
for(const key of ['acceptedEpisodeRolesForActors(p,ep)','hideable.length','data-action="hide-accepted-episode"','Скрыть принятые роли','!native||!cloud.connected'])
 assert.ok(bulkUI.includes(key),'Episode archive button missing: '+key);
const bulkAction=app.slice(app.indexOf("case 'hide-accepted-episode':"),app.indexOf("case 'actor-cabinet-visibility':"));
for(const key of ["cloud=await api('cloud/roles/hide-accepted-episode'",'projectId:p.id,episodeId:ep.id,roles','toast('])
 assert.ok(bulkAction.includes(key),'Bulk archive action missing: '+key);
assert.doesNotMatch(bulkAction,/touch\(p\)|persist\(\)|delete-role|ep\.roles=/,'Archiving must not alter the director roster');
assert.ok(host.includes('route=="cloud/roles/hide-accepted-episode"'));
assert.ok(cloud.includes('public object HideAcceptedEpisodeRoles('));
assert.ok(cloud.includes('/v1/studio/actor-roles/hide-episode'));
console.log('PASS: owner controls actor-only accepted role visibility without modifying Studio roster');
