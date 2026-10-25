import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unfinishedMyRoleEpisodes,isMyRoleAccepted} from '../package/web/my-role-workload.js';
import {myRoleRows,seedState} from '../package/web/core.js';

const project=(id,eps)=>({id,title:id,season:'1',episodes:eps});
const ep=(id,roles)=>({id,number:'1',roles:roles.map(([character,status])=>({
  id:character,character,mine:true,status,actor:'Discolter',lineCount:25
})),tasks:[]});
const data=seedState();
data.projects=[
 project('anime-one',[
    ep('first',[['A','done'],['B','done']]),
    ep('second',[['C','done'],['D','waiting']]),
    ep('third',[['E','received']])
 ]),
 project('anime-two',[ep('only',[['F','done']])]),
 project('anime-three',[ep('other',[['G','waiting']])])
];
const all=myRoleRows(data), visible=unfinishedMyRoleEpisodes(all);
assert.deepEqual(visible.map(({r})=>r.character),['C','D','E','G'],
 'All roles of completed episodes should be absent; partially accepted episodes stay visible');
assert.equal(visible.find(({r})=>r.character==='C').r.status,'done',
 'Accepted role in a partially complete episode remains visible and green');
assert.equal(visible.some(({p})=>p.id==='anime-two'),false,
 'Project disappears from My Roles only if all its episodes are complete');
assert.equal(all.length,7,'Canonical personal assignment list must not be mutated');
assert.equal(data.projects[0].episodes[0].roles.length,2,'Studio roles table stays untouched');
assert.equal(data.projects[1].episodes[0].roles[0].status,'done','Accepted role remains accepted');
assert.equal(isMyRoleAccepted(visible[0].r),true);
const search=myRoleRows(data,{query:'C'});
assert.deepEqual(unfinishedMyRoleEpisodes(all,search).map(({r})=>r.character),['C'],
 'Search results must check the full episode, not only matching accepted role');
assert.deepEqual(unfinishedMyRoleEpisodes(all,myRoleRows(data,{query:'A'})),[],
 'Fully accepted episodes never reappear through search');
data.projects[0].episodes[1].roles[1].status='done';
assert.equal(unfinishedMyRoleEpisodes(myRoleRows(data)).some(({ep})=>ep.id==='second'),false,
 'Last acceptance makes its whole episode disappear automatically');
data.projects[0].episodes[0].roles[0].status='retake';
assert.equal(unfinishedMyRoleEpisodes(myRoleRows(data)).some(({ep})=>ep.id==='first'),true,
 'Reopening a completed character restores episode visibility');

const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
assert.ok(app.includes('unfinishedMyRoleEpisodes(storedMyRoleRows(source),storedMyRoleRows(source,options))'),
  'My Tasks must filter finished episodes after computing full personal assignments');
assert.ok(app.includes("isMyRoleAccepted(r)?'my-role-accepted':''"),
  'Partially accepted roles remain green in collapsed groups');
assert.ok(app.includes('Полностью принятые серии автоматически скрыты'),
  'UI should explain why completed episodes are no longer in My Roles');
console.log('PASS: hide completed personal episodes; partial accepted chips remain, role tables untouched');
