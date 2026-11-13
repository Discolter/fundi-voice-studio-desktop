import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseTextCast,planTextCast,applyTextCastPlan,textCastFingerprint} from '../package/web/text-cast-import.js';

const state={actors:[
  {id:'a',name:'Первый актёр',telegram:'First_Actor',voiceGroup:'male'},
  {id:'b',name:'Второй актёр',telegram:'second_actor',voiceGroup:'female'},
  {id:'c',name:'Третий',telegram:'thirdactor'},
],projects:[]};
const episode={roles:[
  {id:'reigen',character:'Аратака Рейген',actorId:'',actor:'',status:'waiting',lineCount:55,image:'data:image/png;base64,a'},
  {id:'mob',character:'Сигэо Кагэяма (Моб)',actorId:'',actor:'',status:'waiting'},
  {id:'accepted',character:'Рассказчик',actorId:'a',actor:'Первый актёр',status:'done',reviewSeen:'saved'},
  {id:'waiting',character:'Клиент',actorId:'a',actor:'Первый актёр',status:'waiting'},
  {id:'busy',character:'Ученик',actorId:'a',actor:'Первый актёр',status:'waiting'}
],tasks:[{id:'task',roleId:'busy'}]};
const parsed=parseTextCast('**Каст**\n1. Аратака Рейген-@First_Actor\n2. Сигэо Кагэяма (Моб) - @second_actor\nРассказчик - @First_Actor\nАратака Рейген - @First_Actor');
assert.equal(parsed.errors.length,0);
assert.equal(parsed.rows.length,4);
let plan=planTextCast(state,episode,parsed);
assert.equal(plan.issues.length,0);
assert.equal(plan.actions.length,2);
assert.equal(plan.unchanged,1);
const before=JSON.stringify(episode);
assert.equal(before,JSON.stringify(episode),'Planning is read-only');
let done=applyTextCastPlan(state,episode,plan);
assert.equal(done.assigned,2);
assert.equal(episode.roles.find(r=>r.id==='reigen').actorId,'a');
assert.equal(episode.roles.find(r=>r.id==='mob').actorId,'b');
assert.equal(episode.roles.find(r=>r.id==='reigen').lineCount,55,'existing line count kept');
assert.equal(episode.roles.find(r=>r.id==='reigen').image,'data:image/png;base64,a','existing artwork kept');
assert.equal(episode.roles.find(r=>r.id==='accepted').status,'done','accepted recording untouched');
plan=planTextCast(state,episode,parsed);
assert.equal(plan.actions.length,0,'Repeated list must be idempotent');

const text=parseTextCast('Персонаж массовки - @First_Actor, @second_actor\nПерсонаж массовки - @thirdactor');
plan=planTextCast(state,episode,text,{createMissing:true});
assert.equal(plan.issues.length,0);
assert.equal(plan.actions.length,3);
done=applyTextCastPlan(state,episode,plan);
assert.equal(done.added,3);
const crowd=episode.roles.filter(r=>r.character==='Персонаж массовки');
assert.deepEqual(crowd.map(r=>r.actorId),['a','b','c']);
assert.equal(new Set(crowd.map(r=>r.id)).size,3,'Each actor gets independent role ID and status');
assert(crowd.every(r=>r.status==='waiting'&&r.folder===''&&r.subtitle===''));
assert.equal(planTextCast(state,episode,text,{createMissing:true}).actions.length,0);

const wrong=parseTextCast('Аратака Рейген - @missing');
const untouched=JSON.stringify(episode);
plan=planTextCast(state,episode,wrong);
assert.match(plan.issues[0].message,/не найден/);
assert.throws(()=>applyTextCastPlan(state,episode,plan),/Исправь/);
assert.equal(JSON.stringify(episode),untouched,'Unknown actor cannot cause partial writes');
const typo=parseTextCast('Аратака Рейген - @First_Actor\nМоб без уточнения - @second_actor');
assert.equal(planTextCast(state,episode,typo).issues.length,1,'Unknown character blocks the whole import');
assert.equal(planTextCast(state,episode,typo,{createMissing:true}).issues.length,0);

const accepted=parseTextCast('Рассказчик - @second_actor');
assert(planTextCast(state,episode,accepted,{replaceWaiting:true}).issues.length,'Accepted role cannot be overwritten');
const busy=parseTextCast('Ученик - @second_actor');
assert(planTextCast(state,episode,busy,{replaceWaiting:true}).issues.length,'Existing task blocks reassignment');
const replacement=parseTextCast('Клиент - @second_actor');
assert(planTextCast(state,episode,replacement).issues.length,'Replacement requires opt-in');
plan=planTextCast(state,episode,replacement,{replaceWaiting:true});
assert.equal(plan.actions[0].kind,'replace');
applyTextCastPlan(state,episode,plan);
assert.equal(episode.roles.find(r=>r.id==='waiting').actorId,'b');
assert.equal(episode.roles.find(r=>r.id==='waiting').status,'waiting');
assert.equal(episode.roles.find(r=>r.id==='waiting').reviewSeen,'');

const stalePlan=planTextCast(state,episode,parseTextCast('Клиент - @First_Actor'),{replaceWaiting:true});
episode.roles.find(r=>r.id==='waiting').status='received';
assert.notEqual(stalePlan.fingerprint,textCastFingerprint(state,episode));
assert.throws(()=>applyTextCastPlan(state,episode,stalePlan),/измени/,'Stale preview cannot mutate role');
assert.throws(()=>parseTextCast('Персонаж без актёра'),/Не найден|Ожидается|Вставь/);

const app=readFileSync('package/web/app.js','utf8');
const host=readFileSync('package/LocalServer.cs','utf8');
assert.match(app,/data-action="text-cast-import"/);
assert.match(app,/parseTextCast\(data\.castText\)/);
assert.match(app,/applyTextCastPlan\(state,freshEpisode,plan\)/);
assert.match(app,/await syncStudioTasks\(true\)/);
assert.match(app,/await api\('cloud\/sync',\{replace:false\}\)/);
assert.match(host,/\/text-cast-import\.js/);
console.log('PASS: text cast parsing, exact Telegram matching, previews, idempotence, independent mass cast, no silent overwrites, Cloud handoff, static module');
