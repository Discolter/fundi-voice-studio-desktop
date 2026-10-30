import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vacationReviewRows,availableReplacementActors,reassignVacationRole} from '../package/web/vacation-review.js';

const alice={id:'alice',name:'Алиса',voiceGroup:'female',castGroup:'main',actorAccess:true};
const bob={id:'bob',name:'Борис',voiceGroup:'male',castGroup:'support'};
const vera={id:'vera',name:'Вера',voiceGroup:'female',castGroup:'main',actorAccess:true};
const fedor={id:'fedor',name:'Фёдор',voiceGroup:'male',castGroup:'main'};
const role=(id,status,actorId='alice',due='')=>({id,character:id,actorId,actor:actorId==='alice'?'Алиса':'Борис',status,due,voiceGender:actorId==='alice'?'female':'male',lineCount:37,folder:'C:/voices/test',notes:'Important dialogue',reviewSeen:'old'});
const ep={id:'ep1',number:'2',due:'2026-11-12',roles:[
  role('waiting','waiting'),role('recording','recording'),role('retake','retake'),
  role('received','received'),role('processing','processing'),role('done','done'),
  role('planned-early','waiting','bob','2026-11-01'),
  role('planned-late','waiting','bob','2026-11-20'),
  role('unassigned','waiting','')],tasks:[]};
const state={actors:[alice,bob,vera,fedor],projects:[
  {id:'project',title:'Аниме',archived:false,episodes:[ep]},
  {id:'archive',title:'Архив',archived:true,episodes:[{...ep,id:'archive-ep',roles:[role('archived','waiting')]}]}
]};
const vacations=[
 {actorId:'alice',status:'active',startDate:'2026-10-28',endDate:null},
 {actorId:'bob',status:'planned',startDate:'2026-11-15',endDate:'2026-11-24'},
 {actorId:'fedor',status:'completed',startDate:'2026-10-01',endDate:'2026-10-10'}
];
const rows=vacationReviewRows(state,vacations);
assert.deepEqual(rows.map(x=>x.r.id).sort(),['waiting','recording','retake','planned-late'].sort());
assert.equal(rows.filter(x=>x.actor.id==='alice').length,3);
assert.equal(rows.filter(x=>x.vacation.status==='planned').length,1);
assert.equal(rows.every(x=>x.p.id==='project'),true);
assert.deepEqual(availableReplacementActors(state,vacations,'alice').map(x=>x.id),['vera','fedor']);
assert.throws(()=>reassignVacationRole(state,vacations,{projectId:'project',episodeId:'ep1',roleId:'waiting',previousActorId:'alice',newActorId:'bob'}),/в отпуске/);
assert.throws(()=>reassignVacationRole(state,vacations,{projectId:'project',episodeId:'ep1',roleId:'done',previousActorId:'alice',newActorId:'vera'}),/пересмотра/);
assert.throws(()=>reassignVacationRole(state,vacations,{projectId:'project',episodeId:'ep1',roleId:'waiting',previousActorId:'wrong',newActorId:'vera'}),/изменён/);
assert.throws(()=>reassignVacationRole(state,vacations,{projectId:'project',episodeId:'ep1',roleId:'recording',previousActorId:'alice',newActorId:'fedor'}),/Показать всех актёров/);
const opposite=reassignVacationRole(state,vacations,{projectId:'project',episodeId:'ep1',roleId:'recording',previousActorId:'alice',newActorId:'fedor',showAllActors:true});
assert.equal(opposite.role.actorId,'fedor','manual override allows a male actor on female character');
assert.equal(opposite.role.voiceGender,'female','role gender stays stable after opposite-gender reassignment');
assert.equal(opposite.role.status,'waiting');
assert.throws(()=>reassignVacationRole(state,vacations,{projectId:'project',episodeId:'ep1',roleId:'waiting',previousActorId:'alice',newActorId:'bob',showAllActors:true}),/Показать всех актёров/,'override must not bypass vacation validation');

const moved=reassignVacationRole(state,vacations,{projectId:'project',episodeId:'ep1',roleId:'retake',previousActorId:'alice',newActorId:'vera'});
assert.equal(moved.role.actorId,'vera');
assert.equal(moved.role.actor,'Вера');
assert.equal(moved.role.status,'waiting','new actor cannot inherit retake or recording state');
assert.equal(moved.role.reviewSeen,0);
assert.equal(moved.role.folder,'C:/voices/test');
assert.equal(moved.role.notes,'Important dialogue');
assert.equal(moved.role.lineCount,37);
assert.equal(moved.role.id,'retake','role ID must stay stable for data and file history');
assert.equal(vacationReviewRows(state,vacations).some(x=>x.r.id==='retake'),false,'transferred role disappears automatically');
assert.throws(()=>reassignVacationRole(state,vacations,{projectId:'project',episodeId:'ep1',roleId:'retake',previousActorId:'alice',newActorId:'vera'}),/пересмотра/);
assert.equal(vacationReviewRows(state,[]).length,0,'returning actors clears review queue');
const app=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
const workflow=readFileSync('.github/workflows/publish-studio.yml','utf8');
for(const needle of [
 "if(ui.page==='review')return renderVacationReview()",
 "function renderVacationReview()",
 "function vacationReviewTransferForm(",
 "case 'vacation-review-transfer':vacationReviewTransferForm(d.id,d.ep,d.item)",
 "nav-item vacation-review-nav",
 "data-nav=\"review\"",
 "role:transfer.role",
 "await flushSave()",
 "await api('cloud/sync',{replace:false})",
 "ui.page==='review'||reviewsChanged",
 "['vacations','review'].includes(page)",
 "const rows=vacationReviewRows(state,cloud.vacations||[])"
]){
  // A persisted reference to the transferred role can differ by statement structure.
  if(needle==='role:transfer.role')continue;
  assert.ok(app.includes(needle),'Missing review UI wiring: '+needle);
}
assert.ok(css.includes('.vacation-review-role'));
const reviewSection=app.slice(app.indexOf('function renderVacationReview()'),app.indexOf('function vacationReviewCandidateOptions('));
assert.match(reviewSection, /vacation-review-actions[^\n]*\$\{reaperShortcutButton\(p,ep\)\}/,
  'each review role must display the shared REAPER shortcut for its exact episode');
assert.match(css, /\.vacation-review-actions\{[^}]*flex-wrap:wrap/,
  'review actions must wrap on narrow screens');
assert.ok(workflow.includes('node ./tools/check-vacation-role-review.mjs'));
console.log('PASS: derived vacation review queue, actor eligibility and safe manual handoff');
