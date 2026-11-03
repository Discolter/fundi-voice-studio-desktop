import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {castText,castRoleStatusEmoji,withRoleReviews} from '../package/web/core.js';

// Plain Unicode emojis must survive copy/paste and remain attached to each role.
assert.equal(castRoleStatusEmoji('done'),' ✅');
assert.equal(castRoleStatusEmoji('retake'),' 🔴');
assert.equal(castRoleStatusEmoji('processing'),' 🟡');
assert.equal(castRoleStatusEmoji('processed'),' 🟡');
for(const status of ['waiting','recording','received','unset',''])assert.equal(castRoleStatusEmoji(status),'');
const project={
  id:'p1',title:'Меч и жезл Вистории',season:'2',archived:false,
  episodes:[
    {id:'e1',number:'01',roles:[
      {id:'accepted',character:'Элиза',actorId:'a1',status:'done'},
      {id:'retake',character:'Росты',actorId:'a2',status:'retake'},
      {id:'work',character:'Эдвард',actorId:'a1',status:'processing'},
      {id:'waiting',character:'Без статуса работы',actorId:'a2',status:'waiting'},
      {id:'legacy',character:'Старый этап',actorId:'a2',status:'processed'},
      {id:'unassigned',character:'Свободная роль',actorId:'',status:'done'}
    ]},
    {id:'e2',number:'02',roles:[
      {id:'second',character:'Продолжение',actorId:'a1',status:'done'}
    ]}
  ]
};
const state={
  actors:[{id:'a1',name:'Даша',telegram:'Antilles0_w1'},{id:'a2',name:'Другой',telegram:'voice_actor'}],
  projects:[project]
};
const one=castText(state,project,'e1');
assert.equal(one,[
  'Меч и жезл Вистории · Сезон 2','',
  'Серия 01',
  '@Antilles0_w1 - Элиза ✅ | Эдвард 🟡',
  '@voice_actor - Росты 🔴 | Без статуса работы | Старый этап 🟡',
  'Не назначен - Свободная роль ✅'
].join('\n'));
const all=castText(state,project,'all');
assert.match(all,/Серия 02\n@Antilles0_w1 - Продолжение ✅$/);
assert.ok(all.startsWith(one));
assert.equal(castText(state,project,'e2').includes('Росты'),false);
assert.ok(!one.includes('<span')&&!one.includes('class=')&&!one.includes('**'),
  'Telegram status markers must remain portable plain text, not HTML or markup');
// Studio should respect Cloud review status when the actor submits/gets accepted.
const reviewed=withRoleReviews(state,[{actorId:'a2',roleId:'retake',state:'accepted',submissionId:8}]);
assert.match(castText(reviewed,reviewed.projects[0],'e1'),/@voice_actor - Росты ✅ \| Без статуса работы \| Старый этап 🟡/);
const app=readFileSync('package/web/app.js','utf8');
assert.ok(app.includes("const reviewed=withRoleReviews(state,cloud.reviews||[]);"),
  'The text must reflect the same Cloud review stages as the Studio table');
assert.match(app,/e\(castFromCurrentStatus\(p\.id,selected\)\)/);
assert.match(app,/modal\.querySelector\('#cast-draft'\)\.value=castFromCurrentStatus\(p\.id,el\.value\)/);
assert.match(app,/await copyText\(data\.text\)/);
// Keep first-appearance ordering even when actor cards are interleaved.
assert.equal(one.match(/@Antilles0_w1/g)?.length,1);
assert.equal(one.match(/@voice_actor/g)?.length,1);
// A missing Telegram handle should not merge distinct actors sharing the placeholder.
const noHandles={...state,actors:[{id:'a1',name:'Актёр A',telegram:''},{id:'a2',name:'Актёр B',telegram:''}]};
const unlinked=castText(noHandles,project,'e1');
assert.equal(unlinked.split('\\n').filter(line=>line.startsWith('Без @username - ')).length,2);
const sameUsername={...state,actors:[...state.actors,{id:'a3',name:'Третий профиль',telegram:'VOICE_ACTOR'}]};
const matchingProfile={...project,episodes:[{id:'e3',number:'03',roles:[
  {id:'multi-1',character:'Персонаж A',actorId:'a2',status:'waiting'},
  {id:'multi-2',character:'Персонаж B',actorId:'a3',status:'retake'},
  {id:'multi-3',character:'Персонаж A',actorId:'a2',status:'waiting'}
]}]};
const grouped=castText(sameUsername,matchingProfile,'e3');
assert.match(grouped,/@voice_actor - Персонаж A \\| Персонаж B 🔴/);
assert.equal(grouped.split('\\n').filter(line=>line.startsWith('@')).length,1);
assert.equal((grouped.match(/Персонаж A/g)||[]).length,1,'Duplicate exact character/status is not repeated');
assert.equal(castText(state,{...project,episodes:[{id:'empty',number:'03',roles:[]}]},'empty').includes('Роли не добавлены'),true);
console.log('PASS: Telegram cast is grouped by actor with independent role statuses, stable ordering and deduplication');
