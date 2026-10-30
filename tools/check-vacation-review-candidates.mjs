import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seedState,normalizeState,actorPublicFeed,removeActor} from '../package/web/core.js';
import {vacationReviewRows,vacationReviewCandidates,addVacationReviewCandidates,removeVacationReviewCandidate,reassignVacationRole,REVIEW_CANDIDATE_LIMIT} from '../package/web/vacation-review.js';

const a={id:'old',name:'Отдыхающий',voiceGroup:'female',castGroup:'main',actorAccess:true};
const b={id:'bob',name:'Борис',voiceGroup:'male',castGroup:'main',actorAccess:true};
const c={id:'vera',name:'Вера',voiceGroup:'female',castGroup:'main',actorAccess:true};
const d={id:'anna',name:'Анна',voiceGroup:'female',castGroup:'support',actorAccess:true};
const role={id:'role',character:'Рам',status:'waiting',actorId:a.id,actor:a.name,voiceGender:'female',lineCount:18,notes:'Не терять',due:'2026-11-10',reviewCandidates:[]};
const episode={id:'episode',number:'6',due:'2026-11-15',roles:[role],tasks:[],resources:[],paths:{}};
const project={id:'project',title:'ReZero',season:'4',archived:false,episodes:[episode]};
const state=seedState();state.actors=[a,b,c,d];state.projects=[project];
const vacation=[{actorId:'old',status:'active',startDate:'2026-10-29',endDate:null}];
const key={projectId:'project',episodeId:'episode',roleId:'role'};
assert.equal(vacationReviewRows(state,vacation).length,1);

const result=addVacationReviewCandidates(state,vacation,{...key,actorIds:['vera','anna']});
assert.equal(result.added,2);
assert.deepEqual(role.reviewCandidates,['vera','anna']);
assert.equal(role.actorId,'old','shortlisting must not reassign a role');
assert.equal(role.status,'waiting','shortlisting must not reset status');
assert.equal(actorPublicFeed(state,'vera',{preview:true}).roles.length,0,'candidates are invisible to Actor');
assert.equal(actorPublicFeed(state,'anna',{preview:true}).roles.length,0,'candidates do not receive assignment');
assert.equal(vacationReviewRows(state,vacation).length,1);
assert.equal(addVacationReviewCandidates(state,vacation,{...key,actorIds:['vera']}).added,0,'no duplicates');
assert.throws(()=>addVacationReviewCandidates(state,vacation,{...key,actorIds:['old']}),/недоступен/);
assert.throws(()=>addVacationReviewCandidates(state,vacation,{...key,actorIds:['missing']}),/недоступен/);
assert.throws(()=>addVacationReviewCandidates(state,vacation,{...key,actorIds:[]}),/хотя бы одного/);
assert.throws(()=>addVacationReviewCandidates(state,[...vacation,{actorId:'bob',status:'planned',startDate:'2026-11-01'}],{...key,actorIds:['bob']}),/недоступен/);
assert.equal(vacationReviewCandidates(state,role,vacation).length,2);
assert.equal(vacationReviewCandidates(state,role,[...vacation,{actorId:'anna',status:'planned'}])[1].vacation.status,'planned','existing candidate shows unavailable');
removeVacationReviewCandidate(state,vacation,{...key,actorId:'anna'});
assert.deepEqual(role.reviewCandidates,['vera']);
assert.equal(role.actorId,'old','removing candidate does not change performer');
assert.throws(()=>removeVacationReviewCandidate(state,vacation,{...key,actorId:'anna'}),/нет среди/);
addVacationReviewCandidates(state,vacation,{...key,actorIds:['anna']});

const copy=normalizeState(JSON.parse(JSON.stringify(state)));
const stored=copy.projects[0].episodes[0].roles[0];
assert.deepEqual(stored.reviewCandidates,['vera','anna'],'candidates survive save and reopen');
assert.equal(copy.actors.some(actor=>actor.id===stored.reviewCandidates[0]),true);
const broken=JSON.parse(JSON.stringify(state));
broken.projects[0].episodes[0].roles[0].reviewCandidates=['vera','vera','missing','old',null,42,'anna'];
assert.deepEqual(normalizeState(broken).projects[0].episodes[0].roles[0].reviewCandidates,['vera','anna'],'normalization rejects stale and duplicate IDs');

const removed=normalizeState(JSON.parse(JSON.stringify(state)));
removeActor(removed,'anna');
assert.deepEqual(removed.projects[0].episodes[0].roles[0].reviewCandidates,['vera'],'deleting actor cleans shortlist');
assert.equal(REVIEW_CANDIDATE_LIMIT,50);
const transfer=reassignVacationRole(copy,vacation,{...key,previousActorId:'old',newActorId:'vera'});
assert.equal(transfer.role.actorId,'vera');
assert.deepEqual(transfer.role.reviewCandidates,[],'confirmed transfer clears shortlist');
assert.equal(transfer.role.notes,'Не терять');
assert.equal(vacationReviewRows(copy,vacation).length,0);

const app=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
for(const marker of [
  'vacation-review-candidate-add','vacation-review-candidate-chip',
  'vacation-review-candidate-details','vacation-review-candidate-remove',
  'function vacationReviewAddCandidateForm(', 'function vacationReviewCandidateDetails(',
  'data-candidate-search','name="candidateActorId"','if(changedActor)r.reviewCandidates=[]'
])assert.ok(app.includes(marker),'Missing shortlist UI: '+marker);
assert.match(app,/vacation-review-actions[^\n]*vacation-review-candidate-group[^\n]*reaperShortcutButton\(p,ep\)/,'Candidates must appear before REAPER shortcut');
assert.ok(css.includes('.vacation-review-candidate-option[hidden]'));
assert.match(app,/vacation-review-role-art">\$\{roleImageThumb\(r\)\|\|/,'review cards reuse saved character portraits');
assert.ok(app.includes('vacation-review-role-image-empty'),'review has a fallback for missing character artwork');
assert.ok(css.includes('.vacation-review-role-art .role-character-image img'),'review uses portrait thumbnails');

console.log('PASS: multi-select shortlists, persistence, safe handoff, removal and Studio UI');
