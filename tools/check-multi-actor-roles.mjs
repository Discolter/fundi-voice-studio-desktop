import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newActor,newEpisode,newProject,seedState,normalizeState,actorPublicFeed,castText} from '../package/web/core.js';
import {matchingCharacterRoles,assignedCharacterActors,addActorsToCharacter} from '../package/web/multi-actor-roles.js';
import {parseAssCharacters,applyAssCastImport} from '../package/web/ass-role-import.js';
import {outstandingEpisodeRoles,outstandingCastMessage} from '../package/web/episode-debts.js';

const image='data:image/webp;base64,AQID';
const a=newActor({name:'Актёр А',telegram:'a_voice',actorAccess:true,voiceGroup:'male'});
const b=newActor({name:'Актёр Б',telegram:'b_voice',actorAccess:true,voiceGroup:'male'});
const c=newActor({name:'Актриса В',telegram:'c_voice',actorAccess:true,voiceGroup:'female'});
const state=seedState();
state.actors=[a,b,c];
const original={id:'crowd-1',character:'Массовка',actorId:'',actor:'',image,
  createdAt:'2026-11-01T10:00:00.000Z',voiceGender:'',lineCount:30,
  status:'waiting',inProject:false,subtitle:'C:\\series\\crowd.ass',folder:'C:\\series\\crowd',due:'',mine:false};
const episode=newEpisode({number:'2',roles:[original],tasks:[]});
const p=newProject({title:'Лето, когда погас свет',episodes:[episode]});
state.projects=[p];
assert.equal(matchingCharacterRoles(episode,original).length,1);
let result=addActorsToCharacter(state,episode,original,[a.id,b.id]);
assert.equal(result.assigned,2);
assert.equal(result.reusedEmpty,true);
assert.equal(result.added,1);
assert.equal(episode.roles.length,2);
assert.equal(episode.roles[0].id,'crowd-1','Preserve ID of ASS-imported empty role');
assert.deepEqual(episode.roles.map(r=>r.actorId),[a.id,b.id]);
assert.notEqual(episode.roles[0].id,episode.roles[1].id,'Independent role IDs');
assert.equal(episode.roles[0].subtitle,'C:\\series\\crowd.ass','Existing source remains untouched');
assert.equal(episode.roles[1].subtitle,'','No accidental shared recording/subtitle file');
assert.equal(episode.roles[1].folder,'','No accidental shared local recording folder');
assert.equal(episode.roles[1].lineCount,null,'New performer has unknown share of lines');
assert.equal(episode.roles[1].image,image,'Character portrait copied');
assert.equal(episode.roles[1].status,'waiting');
assert.equal(episode.roles[1].mine,false);
assert.equal(assignedCharacterActors(episode,original).size,2);
const snapshot=JSON.stringify(episode.roles);
assert.throws(()=>addActorsToCharacter(state,episode,original,[b.id]),/уже назначены/);
assert.equal(JSON.stringify(episode.roles),snapshot,'Existing actor not duplicated or modified');

result=addActorsToCharacter(state,episode,original,[c.id,c.id]);
assert.equal(result.added,1,'Repeated checkbox IDs deduplicated');
assert.equal(episode.roles.length,3);
assert.equal(episode.roles[2].actorId,c.id);
assert.equal(matchingCharacterRoles(episode,original).length,3);
episode.roles[0].status='done';
episode.roles[1].status='retake';
episode.roles[2].status='waiting';
assert.equal(outstandingEpisodeRoles(episode).length,2,'Accepted performer has no debt');
const debts=outstandingCastMessage(state,p,episode);
assert.match(debts,/@b_voice/);
assert.match(debts,/@c_voice/);
assert.doesNotMatch(debts,/@a_voice/);
const normalized=normalizeState(JSON.parse(JSON.stringify(state)));
const actual=normalized.projects[0].episodes[0].roles;
assert.equal(actual.length,3,'Workspace persistence retains each actor');
assert.notEqual(actual[0].id,actual[1].id);
assert.equal(actorPublicFeed(normalized,a.id).roles.length,1);
assert.equal(actorPublicFeed(normalized,b.id).roles.length,1);
assert.equal(actorPublicFeed(normalized,c.id).roles.length,1);
assert.deepEqual([actorPublicFeed(normalized,a.id).roles[0].status,
  actorPublicFeed(normalized,b.id).roles[0].status,actorPublicFeed(normalized,c.id).roles[0].status],
  ['done','retake','waiting'],'Actor statuses independent');

assert.throws(()=>addActorsToCharacter(state,episode,original,['invalid']),/не существует/);
assert.throws(()=>addActorsToCharacter(state,episode,original,[]),/хотя бы одного/);
const second=newEpisode({number:'3',roles:[{id:'n',character:'Жители деревни',actorId:'',actor:''}]});
assert.throws(()=>addActorsToCharacter(state,second,second.roles[0],[a.id],{unavailableActorIds:[a.id]}),/отпуске/);
assert.equal(second.roles.length,1,'Failed leave assignment must not modify state');

const ass='[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n'
  +'Dialogue: 0,0:00:01.00,0:00:02.00,Default,Массовка,0,0,0,,Привет\n';
const parsed=parseAssCharacters(ass);
const before=episode.roles.map(role=>({id:role.id,actorId:role.actorId,status:role.status,lineCount:role.lineCount}));
result=applyAssCastImport(state,p,episode,parsed.characters);
assert.equal(result.added,0,'ASS reimport cannot duplicate multi-cast role');
assert.equal(episode.roles.length,3);
assert.deepEqual(episode.roles.map(r=>({id:r.id,actorId:r.actorId,status:r.status,lineCount:r.lineCount})),before,
  'ASS reimport preserves each performer status, ID and per-actor line count');
applyAssCastImport(state,p,episode,parsed.characters,{removeMissing:true});
assert.equal(episode.roles.length,3,'ASS replacement retains all actor rows for matching character');

const app=readFileSync('package/web/app.js','utf8');
const host=readFileSync('package/LocalServer.cs','utf8');
const css=readFileSync('package/web/compact.css','utf8');
assert.match(app,/data-action="multi-role-actors"/);
assert.match(app,/function multiRoleActorsForm\(/);
assert.match(app,/case 'multi-role-actors':multiRoleActorsForm/);
assert.match(app,/addActorsToCharacter\(state,target,base,selected/);
assert.match(app,/data-actor-search=/);
assert.match(app,/function multiActorCharacterMark/);
assert.match(host,/\/multi-actor-roles\.js/);
assert.match(css,/\.multi-actor-count/);
assert.match(css,/\.multi-actor-person/);
console.log('PASS: multi-actor crowd casting, independent status/debt/cloud, ASS reimport, safe duplicate prevention and Studio UI');
