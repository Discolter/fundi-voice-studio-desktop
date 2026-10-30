import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {actorWorkloadRows,actorWorkloadGroups,matchesWorkloadActor} from '../package/web/actor-workload.js';

const actor=(id,name)=>({id,name,telegram:id,avatar:'',notes:''});
const role=(id,actorId,status,lineCount)=>({id,actorId,status,lineCount,character:id});
const project=(id,archived,roles)=>({id,archived,episodes:[{id:id+'-ep',roles}]});
const state={
  actors:[actor('busy','Загружен'),actor('medium','Средний'),actor('free','Свободен'),actor('heavy','Одна большая роль'),actor('zero','Нет ролей')],
  projects:[
    project('first',false,[
      ...Array.from({length:6},(_,i)=>role('b'+i,'busy','waiting',10)),
      role('m1','medium','waiting',40),role('m2','medium','recording',40),role('m3','medium','retake',40),
      role('f1','free','done',10),
      role('h1','heavy','waiting',375)
    ]),
    project('second',false,[role('b7','busy','done',500),role('f2','free','received',5),role('m4','medium','done',150)]),
    project('archive',true,[role('archive1','free','waiting',100),role('archive2','busy','retake',100)])
  ]
};
const rows=actorWorkloadRows(state);
const byId=id=>rows.find(x=>x.actor.id===id);
assert.equal(rows.length,5,'Everyone in actor database must appear, including actors without roles');
assert.equal(byId('busy').tier,'high');
assert.equal(byId('busy').pending,6);
assert.equal(byId('busy').pendingLines,60);
assert.equal(byId('busy').total,7,'Count all assignments in active projects, even accepted');
assert.equal(byId('busy').accepted,1);
assert.equal(byId('busy').projectsCount,2);
assert.equal(byId('medium').tier,'medium');
assert.equal(byId('medium').pending,3,'Waiting, recording and retake count as current performer workload');
assert.equal(byId('medium').inReview,0);
assert.equal(byId('medium').accepted,1);
assert.equal(byId('free').tier,'low');
assert.equal(byId('free').pending,0,'Accepted and submitted roles do not need another recording');
assert.equal(byId('free').inReview,1);
assert.equal(byId('free').accepted,1);
assert.equal(byId('heavy').tier,'high','One huge role should not look like low workload');
assert.equal(byId('heavy').pending,1);
assert.equal(byId('heavy').pendingLines,375);
assert.equal(byId('heavy').score,8);
assert.equal(byId('zero').total,0);
assert.equal(byId('zero').tier,'low');
assert.deepEqual(actorWorkloadGroups(rows).high.map(x=>x.actor.id),['heavy','busy']);
assert.ok(actorWorkloadGroups(rows).low.some(x=>x.actor.id==='zero'));
assert.equal(actorWorkloadRows(state,{query:'СРЕДН'}).length,1,'Russian case-insensitive lookup');
// The workload-only search finds nicknames and Telegram handles as the owner types.
assert.equal(matchesWorkloadActor({name:'Романчик',telegram:'Romanshik228325'},'РОМ'),true);
assert.equal(matchesWorkloadActor({name:'Романчик',telegram:'Romanshik228325'},'@rom'),true);
assert.equal(matchesWorkloadActor({name:'Романчик',telegram:'Romanshik228325'},'manshik'),true);
assert.equal(matchesWorkloadActor({name:'Романчик',telegram:'Romanshik228325'},'@ROmAnShIk'),true);
assert.equal(matchesWorkloadActor({name:'Романчик',telegram:'Romanshik228325'},'@absent'),false);
assert.equal(matchesWorkloadActor({name:'Имя',telegram:'@TelegramNick'},'@tele'),true,'Stored @ prefix is optional');
assert.equal(actorWorkloadRows(state,{actorQuery:'@bu'}).map(x=>x.actor.id).join(','),'busy','@ prefix matches Telegram');
assert.equal(actorWorkloadRows(state,{actorQuery:'mEd'}).map(x=>x.actor.id).join(','),'medium','Mixed-case handle lookup');
assert.equal(actorWorkloadRows(state,{actorQuery:'ЗАГР'}).map(x=>x.actor.id).join(','),'busy','Name-prefix lookup');
assert.equal(actorWorkloadRows(state,{actorQuery:'груж'}).map(x=>x.actor.id).join(','),'busy','Name substring lookup');
assert.equal(actorWorkloadRows(state,{actorQuery:'@'}).length,5,'An incomplete @ query does not hide actors');
assert.equal(actorWorkloadRows(state,{actorQuery:'nothing'}).length,0,'No matches are hidden');
state.actors[0].notes='needle in private notes';
assert.equal(actorWorkloadRows(state,{actorQuery:'needle'}).length,0,'Local actor search must not match private notes');
assert.equal(actorWorkloadRows(state,{query:'needle'}).length,1,'Existing global search keeps its broader behavior');
assert.equal(actorWorkloadRows(state,{includeArchived:true}).find(x=>x.actor.id==='free').pending,1,'Archive scope is optional');
assert.equal(actorWorkloadRows(state,{includeArchived:true}).find(x=>x.actor.id==='busy').pending,7);
state.projects[0].episodes[0].roles.push(role('pending-unknown','free','waiting',null));
const unknown=actorWorkloadRows(state).find(x=>x.actor.id==='free');
assert.equal(unknown.pendingUnknown,1);
assert.equal(unknown.pendingLines,0,'Missing lines must not be invented');
const unchanged=JSON.stringify(state);
actorWorkloadRows(state);
assert.equal(JSON.stringify(state),unchanged,'Dashboard reads roles without mutating assignments');

// Check the real UI and nav wiring, and render with deterministic stubs.
const source=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
const host=readFileSync('package/LocalServer.cs','utf8');
assert.match(source,/import \{actorWorkloadRows,actorWorkloadGroups\} from '\.\/actor-workload\.js'/);
assert.match(source,/\['workload','workload','Нагрузка'\]/);
assert.match(source,/if\(ui\.page==='workload'\)return renderWorkload\(\)/);
assert.match(source,/workloadIncludeArchive/);
assert.match(source,/id='workload-include-archive'|id="workload-include-archive"/);
assert.match(source,/data-qv-open="actor"/);
assert.ok(!source.includes('class="icon-btn casting-table-button"'),'Remove the quick casting button from role rows');
assert.ok(host.includes('"/actor-workload.js"'),'New local module must be served in Windows Studio');
assert.ok(css.includes('.workload-grid')&&css.includes('.workload-actor-card'),'Workload board needs usable responsive layout');
assert.ok(css.includes('#workload-search')&&css.includes('.workload-search-wrap'),'Dedicated search must be responsive');
assert.match(source,/id="workload-search"/,'Workload search input exists');
assert.match(source,/placeholder="Имя актёра или @Telegram"/,'Search mentions both name and handle');
assert.match(source,/actorQuery:ui\.workloadQuery/,'Workload query is wired into actor filtering');
assert.match(source,/if\(event\.target\.id==='workload-search'\)/,'Each input edit updates filtered cards');
assert.match(source,/case 'workload-search-clear'/,'Clear button restores all actors');
assert.match(source,/next\.setSelectionRange\(start,end\)/,'Typing keeps its caret position');
const begin=source.indexOf('function renderWorkload(){');
const end=source.indexOf('function renderActors(){',begin);
assert.ok(begin>=0&&end>begin,'Workload dashboard source must exist');
const render=new Function('actorWorkloadRows','actorWorkloadGroups','state','ui','e','icon','vacationTag','heading',
  source.slice(begin,end)+'; return renderWorkload;')(
  actorWorkloadRows,actorWorkloadGroups,state,{query:'',workloadIncludeArchive:false},
  value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  name=>'<svg>'+name+'</svg>',id=>id==='busy'?'<span>В отпуске</span>':'',
  (title,sub)=>'<h1>'+title+'</h1><p>'+sub+'</p>'
);
const html=render();
assert.match(html,/<h1>Нагрузка<\/h1>/);
assert.match(html,/Высокая нагрузка/);
assert.match(html,/Средняя нагрузка/);
assert.match(html,/Низкая нагрузка/);
assert.match(html,/На запись/);
assert.match(html,/На проверке/);
assert.match(html,/Всего ролей/);
assert.match(html,/data-qv-actor="heavy"/);
assert.match(html,/7\s*<\/strong><small>Всего ролей<\/small>/);
assert.match(html,/В отпуске/);
assert.match(html,/Учитывать архивные проекты/);
assert.match(html,/id="workload-search"/);
assert.match(html,/Имя актёра или @Telegram/);
console.log('PASS: high/medium/low workload by roles and known lines, archive scope, all actors, live UI and removed shortcut');
