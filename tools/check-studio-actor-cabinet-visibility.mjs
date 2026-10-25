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
console.log('PASS: owner controls actor-only accepted role visibility without modifying Studio roster');
