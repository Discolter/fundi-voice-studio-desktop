import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankActorsForRole,episodeActorWorkload,validRoleVoice,roleVoiceLabel,roleVoiceFromActor,applyRoleVoiceFromActor} from '../package/web/casting-assistant.js';
import {normalizeState,seedState} from '../package/web/core.js';
import {reassignVacationRole} from '../package/web/vacation-review.js';

const actors=[
 {id:'m1',name:'Вадим',voiceGroup:'male',actorAccess:true},
 {id:'m2',name:'Борис',voiceGroup:'male',actorAccess:true},
 {id:'m3',name:'Денис',voiceGroup:'male',actorAccess:false},
 {id:'f1',name:'Алиса',voiceGroup:'female',actorAccess:true},
 {id:'x1',name:'Без группы',voiceGroup:'',actorAccess:true}
];
const role=(id,actorId,status='waiting',voiceGender='male',lineCount=10)=>({id,character:id,actorId,
 actor:actors.find(x=>x.id===actorId)?.name||'',status,voiceGender,lineCount});
const episode={id:'ep',number:'1',roles:[
 role('target','m2','waiting','male',100),
 role('another1','m2','done','male',300),
 role('another2','m3','waiting','male',30),
 role('another3','m3','waiting','male',null),
 role('f-role','f1','waiting','female',20)
 ]};
const state={actors,projects:[{id:'p',title:'Аниме',archived:false,episodes:[episode,
 {id:'other',roles:[role('other1','m1'),role('other2','m2'),role('other3','m2')]}]}],trash:[]};
const ranked=rankActorsForRole(state,episode,episode.roles[0],[]);
assert.deepEqual(ranked.map(x=>x.actor.id),['m1','m2','m3']);
assert.equal(ranked[0].episodeCount,0);
assert.equal(ranked[1].episodeCount,1,'editing the role must not count its own casting twice');
assert.equal(ranked[2].episodeCount,2);
assert.equal(ranked[2].unknownLines,1);
assert.equal(ranked[0].activeCount,1,'total open work across the whole anime still matters');
assert.equal(ranked[1].activeCount,2);
assert.deepEqual(episodeActorWorkload(episode,'m2','target').characters,['another1']);
assert.equal(validRoleVoice('unexpected'),'');
assert.equal(roleVoiceLabel('female'),'Женский');

const holidays=[{actorId:'m1',status:'planned'},{actorId:'m3',status:'active'}];
assert.deepEqual(rankActorsForRole(state,episode,episode.roles[0],holidays).map(x=>x.actor.id),['m2']);
assert.deepEqual(rankActorsForRole(state,episode,{id:'new',voiceGender:''},[])
 .map(x=>x.actor.id).sort(),actors.map(a=>a.id).sort(),'unknown voice type must not filter actors');
assert.deepEqual(rankActorsForRole(state,episode,episode.roles[0],[],{excludeActorId:'m2'})
 .map(x=>x.actor.id),['m1','m3']);

assert.equal(roleVoiceFromActor({voiceGender:''},actors[0]),'male');
assert.equal(roleVoiceFromActor({voiceGender:'female'},actors[0]),'female','explicit label wins over actor group');
const tagged={voiceGender:''};
assert.equal(applyRoleVoiceFromActor(tagged,actors[0]),'male');
applyRoleVoiceFromActor(tagged,actors[3]);
assert.equal(tagged.voiceGender,'male','actor replacement does not overwrite character voice type');
assert.deepEqual(rankActorsForRole(state,episode,{id:'target',actorId:'m2',voiceGender:''},[]).map(x=>x.actor.id),['m1','m3'],'old roles use linked actor type before migration');
const allCandidates=rankActorsForRole(state,episode,episode.roles[0],[],{excludeActorId:'m2',showAll:true});
assert.deepEqual(allCandidates.map(x=>x.actor.id).slice(0,2),['m1','m3'],'same group stays ahead even if opposite group is less busy');
assert.ok(allCandidates.some(x=>x.actor.id==='f1'));
assert.ok(allCandidates.some(x=>x.actor.id==='x1'),'Show all includes actors without gender group');
assert.equal(rankActorsForRole(state,episode,episode.roles[0],[{actorId:'f1',status:'planned'}],{showAll:true}).some(x=>x.actor.id==='f1'),false,'Show all never ignores holidays');

const copy=seedState();
copy.actors=actors;
copy.projects=[{id:'p',title:'Аниме',episodes:[episode]}];
const normalized=normalizeState(copy);
assert.equal(normalized.projects[0].episodes[0].roles[0].voiceGender,'male');
const invalid=structuredClone(copy);
invalid.projects[0].episodes[0].roles[0].voiceGender='bad';
assert.equal(normalizeState(invalid).projects[0].episodes[0].roles[0].voiceGender,'male','invalid labels infer from linked actor');
const legacy=structuredClone(copy);
delete legacy.projects[0].episodes[0].roles[0].voiceGender;
assert.equal(normalizeState(legacy).projects[0].episodes[0].roles[0].voiceGender,'male','old assignments inherit linked actor voice group');

const app=readFileSync('package/web/app.js','utf8');
const quick=readFileSync('package/web/quick-views.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
for(const needle of [
 'function castingAssistantForm(', 'function updateCastingSuggestions()',
 'id="role-voice-gender"', 'voiceGender:roleVoiceFromActor({voiceGender:data.voiceGender},actor)',
 'case \'casting-assistant\':castingAssistantForm(d.id,d.ep,d.item)',
 'case \'casting-pick\':', 'data-action="casting-assistant"',
 'rankActorsForRole(state,ep,r,cloud.vacations||[],{excludeActorId:actor.id,showAll:showAllActors})',
 'updateCastingSuggestions();'
])assert.ok(app.includes(needle),'Studio casting UI missing: '+needle);
assert.ok(quick.includes("data-q=\"casting-assistant\"")||quick.includes("btn('casting-assistant'"));
assert.ok(css.includes('.casting-suggestion-list'));
assert.ok(css.includes('.casting-modal-option'));
assert.ok(css.includes('.casting-show-all'));
assert.ok(app.includes('id="review-show-all-actors"'));
assert.ok(app.includes('id="casting-modal-show-all"'));
assert.ok(app.includes('actor-picker-show-all-input'));
assert.ok(app.includes('showAll:showAllActors'));
assert.ok(quick.includes('data-q="show-all-candidates"'));

assert.ok(app.includes('reviewSeen:changedActor?\'\':r.reviewSeen'),'changing actor resets previous feedback');

console.log('PASS: gender persistence, episode repeat counts, holiday-safe casting recommendations and manual UI');
