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
  '@Antilles0_w1 — Элиза ✅',
  '@voice_actor — Росты 🔴',
  '@Antilles0_w1 — Эдвард 🟡',
  '@voice_actor — Без статуса работы',
  '@voice_actor — Старый этап 🟡',
  'Не назначен — Свободная роль ✅'
].join('\n'));
const all=castText(state,project,'all');
assert.match(all,/Серия 02\n@Antilles0_w1 — Продолжение ✅$/);
assert.ok(all.startsWith(one));
assert.equal(castText(state,project,'e2').includes('Росты'),false);
assert.ok(!one.includes('<span')&&!one.includes('class=')&&!one.includes('**'),
  'Telegram status markers must remain portable plain text, not HTML or markup');
// Studio should respect Cloud review status when the actor submits/gets accepted.
const reviewed=withRoleReviews(state,[{actorId:'a2',roleId:'retake',state:'accepted',submissionId:8}]);
assert.match(castText(reviewed,reviewed.projects[0],'e1'),/@voice_actor — Росты ✅/);
const app=readFileSync('package/web/app.js','utf8');
assert.ok(app.includes("const reviewed=withRoleReviews(state,cloud.reviews||[]);"),
  'The text must reflect the same Cloud review stages as the Studio table');
assert.match(app,/e\(castFromCurrentStatus\(p\.id,selected\)\)/);
assert.match(app,/modal\.querySelector\('#cast-draft'\)\.value=castFromCurrentStatus\(p\.id,el\.value\)/);
assert.match(app,/await copyText\(data\.text\)/);
console.log('PASS: Telegram cast emojis reflect accepted, retake and processing roles in one/all episodes and review updates');
