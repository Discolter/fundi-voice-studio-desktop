import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cloudHealth} from '../package/web/cloud-health.js';
import {outstandingCastMessage,outstandingEpisodeRoles} from '../package/web/episode-debts.js';
import {cloneEpisodeCast,newEpisode,newProject,normalizeState,seedState} from '../package/web/core.js';

const clock=Date.UTC(2026,10,1,12,0,0);
const connected={connected:true,lastStatus:new Date(clock-1000).toISOString(),pending:false,busy:false,error:'',roleSyncReady:true};
assert.equal(cloudHealth(connected,'',true,clock).code,'online');
assert.equal(cloudHealth({...connected,lastStatus:''},'',true,clock).code,'offline');
assert.equal(cloudHealth({...connected,lastStatus:new Date(clock-100000).toISOString()},'',true,clock).code,'offline');
assert.equal(cloudHealth({...connected,busy:true},'',true,clock).code,'checking');
assert.equal(cloudHealth({...connected,pending:true},'',true,clock).code,'pending');
assert.equal(cloudHealth({...connected,roleSyncReady:false},'',true,clock).code,'pending');
assert.equal(cloudHealth({...connected,error:'Нет ответа от сервера'},'',true,clock).code,'offline');
assert.equal(cloudHealth({...connected,conflict:true},'',true,clock).code,'error');
assert.equal(cloudHealth(connected,'Конфликт статусов',true,clock).code,'error');
assert.equal(cloudHealth({connected:false},'',true,clock).code,'disconnected');

const image='data:image/png;base64,a';
const oldRole={id:'old',character:'Моб',actorId:'actor-a',actor:'Актёр А',status:'done',image,voiceGender:'male',lineCount:46,
  mine:true,folder:'C:\\Old\\Voices',subtitle:'C:\\Old\\Mob.ass',notes:'Принято',due:'2026-11-01',
  reviewSeen:'abc',reviewCandidates:['actor-b'],inProject:true};
const current=newEpisode({number:'1',stage:'done',roles:[oldRole,{...oldRole,id:'r2',character:'Рейген',status:'retake',actorId:'actor-b',actor:'Актёр Б',mine:false},
  {...oldRole,id:'r3',character:'Димпл',status:'received',actorId:'actor-a'},
  {...oldRole,id:'r4',character:'Рицу',status:'waiting',actorId:'actor-a'},
  {...oldRole,id:'r5',character:'Неизвестный',status:'waiting',actorId:'',actor:''}]});
const before=JSON.stringify(current),copies=cloneEpisodeCast(current);
assert.equal(copies.length,5);
assert.equal(copies[0].actorId,'actor-a');
assert.equal(copies[0].image,image);
assert.equal(copies[0].mine,true);
assert.notEqual(copies[0].id,oldRole.id);
assert.equal(new Set(copies.map(x=>x.id)).size,5);
for(const c of copies){
  assert.equal(c.status,'waiting');
  assert.equal(c.folder,'');assert.equal(c.subtitle,'');assert.equal(c.notes,'');
  assert.equal(c.lineCount,null);assert.equal(c.due,'');assert.equal(c.inProject,false);
  assert.equal(c.reviewSeen,'');assert.deepEqual(c.reviewCandidates,[]);
}
assert.equal(JSON.stringify(current),before);
const state=seedState();
state.actors=[{id:'actor-a',name:'Актёр А',telegram:'actor_a'},{id:'actor-b',name:'Актёр Б',telegram:'actor_b'}];
const next=newEpisode({number:'2',roles:copies});
state.projects=[newProject({title:'Моб Психо 100',season:'1',episodes:[current,next]})];
assert.equal(next.stage,'unset');assert.deepEqual(next.resources,[]);assert.deepEqual(next.tasks,[]);
const normalized=normalizeState(state);
assert.equal(normalized.projects[0].episodes[0].roles[0].status,'done');
assert.equal(normalized.projects[0].episodes[1].roles[0].status,'waiting');
assert.equal(normalized.projects[0].episodes[1].roles[0].actorId,'actor-a');
const outstanding=outstandingEpisodeRoles(current);
assert.deepEqual(outstanding.map(x=>x.character),['Рейген','Рицу','Неизвестный']);
const message=outstandingCastMessage(state,state.projects[0],current);
assert.match(message,/@actor_a/);
assert.match(message,/@actor_b/);
assert.match(message,/Рейген — 🔁 На перезапись/);
assert.match(message,/Рицу — ⏳ Жду запись/);
assert.match(message,/Не назначен/);
assert.doesNotMatch(message,/Моб —/);
assert.doesNotMatch(message,/Димпл —/);
assert.equal(outstandingCastMessage(state,state.projects[0],{...current,roles:[]}).includes('Долгов по выбранным статусам нет'),true);

const app=readFileSync('package/web/app.js','utf8');
const cloud=readFileSync('package/StudioCloud.cs','utf8');
const html=readFileSync('package/web/index.html','utf8');
assert.match(app,/data-action="complete-episode"/);
assert.match(app,/data-action="debts-preview"/);
assert.match(app,/data-action="cast-preview"/);
assert.match(app,/finishEpisodeId:ep\.id/);
assert.match(app,/if\(completed\)completed\.stage='done'/);
assert.match(app,/cloneEpisodeCast\(source\)/);
assert.match(app,/name="copyRoles"/);
assert.match(app,/outstandingCastMessage\(state,p,ep\)/);
assert.match(app,/id="cloud-sync-indicator"/);
assert.match(app,/updateCloudIndicator\(\)/);
assert.match(cloud,/lastStatus=lastStatus==DateTime\.MinValue/);
assert.match(cloud,/roleSyncReady=roleSyncReady/);
assert.match(html,/cloud-indicator\.css/);
console.log('PASS: episode closeout and cast inheritance, Telegram debts and Cloud health status');
