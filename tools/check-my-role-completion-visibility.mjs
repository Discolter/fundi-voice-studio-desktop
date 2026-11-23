import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unfinishedMyRoleEpisodes,isMyRoleAccepted} from '../package/web/my-role-workload.js';
import {myRoleRows,seedState} from '../package/web/core.js';
import {createStudioResources} from '../package/web/studio-resources.js';

const project=(id,eps)=>({id,title:id,season:'1',episodes:eps});
const ep=(id,roles)=>({id,number:'1',roles:roles.map(([character,status])=>({
  id:character,character,mine:true,status,actor:'Discolter',lineCount:25
})),tasks:[]});
const data=seedState();
data.projects=[
 project('anime-one',[
    ep('first',[['A_unique','done'],['B','done']]),
    ep('second',[['C_unique','done'],['D','waiting']]),
    ep('third',[['E','received']])
 ]),
 project('anime-two',[ep('only',[['F','done']])]),
 project('anime-three',[ep('other',[['G','waiting']])])
];
const all=myRoleRows(data), visible=unfinishedMyRoleEpisodes(all);
assert.deepEqual(visible.map(({r})=>r.character),['C_unique','D','E','G'],
 'All roles of completed episodes should be absent; partially accepted episodes stay visible');
assert.equal(visible.find(({r})=>r.character==='C_unique').r.status,'done',
 'Accepted role in a partially complete episode remains visible and green');
assert.equal(visible.some(({p})=>p.id==='anime-two'),false,
 'Project disappears from My Roles only if all its episodes are complete');
assert.equal(all.length,7,'Canonical personal assignment list must not be mutated');
assert.equal(data.projects[0].episodes[0].roles.length,2,'Studio roles table stays untouched');
assert.equal(data.projects[1].episodes[0].roles[0].status,'done','Accepted role remains accepted');
assert.equal(isMyRoleAccepted(visible[0].r),true);
const search=myRoleRows(data,{query:'C_unique'});
assert.deepEqual(unfinishedMyRoleEpisodes(all,search).map(({r})=>r.character),['C_unique'],
 'Search results must check the full episode, not only matching accepted role');
assert.deepEqual(unfinishedMyRoleEpisodes(all,myRoleRows(data,{query:'A_unique'})),[],
 'Fully accepted episodes never reappear through search');
data.projects[0].episodes[1].roles[1].status='done';
assert.equal(unfinishedMyRoleEpisodes(myRoleRows(data)).some(({ep})=>ep.id==='second'),false,
 'Last acceptance makes its whole episode disappear automatically');
data.projects[0].episodes[0].roles[0].status='retake';
assert.equal(unfinishedMyRoleEpisodes(myRoleRows(data)).some(({ep})=>ep.id==='first'),true,
 'Reopening a completed character restores episode visibility');

const cyberpunk=project('Киберпанк: бегущие по краю',[ep('reserve-ep',[['Люси','done'],['Дэвид','done'],['Киви','waiting']])]);
const reserveEpisode=cyberpunk.episodes[0];
reserveEpisode.roles[0].mine=false;
reserveEpisode.roles[0].actorId='primary';
reserveEpisode.roles[2].mine=false;
data.projects=[cyberpunk];
data.actors=[{id:'me',name:'Владелец',telegram:'Discolter'},{id:'primary',name:'Другой актёр',telegram:'other'}];
data.settings.myTelegram='@DISCOLTER';
const entry={id:'reserve-id',projectId:cyberpunk.id,episodeId:reserveEpisode.id,
  roleId:'Люси',actorId:'me',confirmed:false,notes:'Записать запас'};
const another={...entry,id:'other-reserve',actorId:'primary',roleId:'Киви'};
let entries=[entry,another],updates=0;
const resources=createStudioResources({identity:()=> 'connected',request:async()=>({reserves:entries}),reservesChanged:()=>updates++});
const personal=()=>unfinishedMyRoleEpisodes(myRoleRows(data,{reserves:resources.reserves()}));
assert.ok(personal().some(({r})=>r.character==='Киви'),'A legacy owner assignment still works with an empty reserve cache');
reserveEpisode.roles[2].actorId='primary';
await resources.linkItems('reserves');
assert.equal(updates,1);
assert.deepEqual(personal().map(({r,reserve})=>[r.character,r.lineCount,r.status,reserve.id]),[['Люси',25,'waiting','reserve-id']]);
assert.equal(reserveEpisode.roles[0].actorId,'primary');
assert.equal(reserveEpisode.roles[0].status,'done');
assert.equal(myRoleRows(data,{reserves:[entry],query:'запас'}).length,1);
assert.equal(myRoleRows(data,{reserves:[{...entry,episodeId:'missing'}]}).some(row=>row.reserve),false);
assert.equal(myRoleRows(data,{reserves:[{...entry,roleId:'Дэвид'}]}).filter(({r})=>r.character==='Дэвид').length,1);
entries=[];
await resources.linkItems('reserves');
assert.equal(updates,2);
assert.equal(personal().length,0);

const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
assert.match(app,/storedMyRoleRows\(source,\{reserves\}\)/);
assert.match(app,/\['detail','recommendations','mytasks'\]/,'Refresh an open personal board after loading reserves');
assert.match(app,/const characterAction=reserve\?reserveAction:/,'Open the reserve record from the personal role');
assert.ok(app.includes("isMyRoleAccepted(r)?'my-role-accepted':''"),
  'Partially accepted roles remain green in collapsed groups');
assert.ok(app.includes('Полностью принятые серии автоматически скрыты'),
  'UI should explain why completed episodes are no longer in My Roles');
console.log('PASS: completed personal episodes, reserve additions and removals, owner matching, and independent role status');
