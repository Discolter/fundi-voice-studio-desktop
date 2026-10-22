import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {episodeUnassignedActors,filterEpisodeRoles} from '../package/web/core.js';

const actors=[
  {id:'a',name:'Анна',telegram:'anna',avatar:'data:image/png;base64,a'},
  {id:'b',name:'Борис',telegram:'boris'},
  {id:'c',name:'Вера',telegram:'vera'},
  {id:'d',name:'Дубль',telegram:'dup1'},
  {id:'e',name:'Дубль',telegram:'dup2'}
];
const state={actors};
const ep1={roles:[
  {actorId:'b',status:'done',character:'Принято'},
  {actorId:'b',status:'waiting',character:'Вторая'},
  {actor:'  ВЕРА  ',actorId:'',status:'received',character:'Старая запись'},
  {actor:'Дубль',actorId:'',status:'waiting',character:'Неоднозначная старая запись'},
  {actorId:'',actor:'',status:'waiting',character:'Нет исполнителя'}
]};
const ep2={roles:[{actorId:'a',status:'processing',character:'Другая серия'}]};
const frozen=JSON.stringify({state,ep1,ep2});
assert.deepEqual(episodeUnassignedActors(state,ep1).map(a=>a.id),['a','d','e']);
assert.deepEqual(episodeUnassignedActors(state,ep2).map(a=>a.id),['b','c','d','e']);
assert.equal(episodeUnassignedActors(state,{roles:[]}).length,5);
assert.equal(episodeUnassignedActors({actors:[]},ep1).length,0);
assert.deepEqual(episodeUnassignedActors(state,{roles:[{actorId:'a',status:'done'}]}).map(a=>a.id),['b','c','d','e']);
assert.equal(filterEpisodeRoles(state,ep1.roles,{status:'done'}).length,1);
assert.equal(JSON.stringify({state,ep1,ep2}),frozen,'List computation must not modify assignments');

const app=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
assert.ok(app.includes('${episodeUnassignedList(ep)}'),'The fifth widget should be in role toolbar');
assert.ok(app.includes('episodeUnassignedActors(state,ep)'),'Widget must be derived from current episode');
assert.ok(app.includes('data-unassigned-search'),'Search should include Actor and Telegram usernames');
assert.ok(app.includes('actorPickAvatar(actor)'),'Existing actor avatars should be used');
assert.ok(!app.includes('roleUnassignedFilter'),'This is not a role-table filter');
assert.ok(css.includes('.episode-unassigned-menu'),'The list should be styled as a dropdown');
assert.ok(css.includes('episode-unassigned-person[hidden]'),'Search hiding should work');
console.log('PASS: episode-specific unused actor roster and visual wiring');
