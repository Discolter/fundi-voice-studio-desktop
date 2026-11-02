import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLE_TIERS,validRoleTier,seedState,newProject,newEpisode,cloneEpisodeCast,normalizeState} from '../package/web/core.js';
import {parseAssCharacters,applyAssCastImport} from '../package/web/ass-role-import.js';
import {addActorsToCharacter} from '../package/web/multi-actor-roles.js';

assert.deepEqual(ROLE_TIERS.map(([key])=>key),['main','supporting','extras']);
assert.equal(validRoleTier('main'),'main');
assert.equal(validRoleTier('extras'),'extras');
assert.equal(validRoleTier('unknown'),'supporting','Legacy and unknown categories stay editable');

const state=seedState();
state.actors=[{id:'a',name:'Актёр A'},{id:'b',name:'Актёр Б'}];
const previous=newEpisode({number:'1',roles:[
  {id:'hero',character:'Главный герой',roleTier:'main',status:'done',actorId:'a',actor:'Актёр A',image:''},
  {id:'crowd',character:'Толпа',roleTier:'extras',status:'received',actorId:'',actor:''}
]});
const next=newEpisode({number:'2'});
const project=newProject({title:'Сериал',episodes:[previous,next]});
state.projects=[project];

const cloned=cloneEpisodeCast(previous);
assert.deepEqual(cloned.map(r=>r.roleTier),['main','extras']);
assert.deepEqual(cloned.map(r=>r.status),['waiting','waiting']);

const ass='[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n'
  +'Dialogue: 0,0:00:01.00,0:00:02.00,Default,Главный герой,0,0,0,,Привет\n'
  +'Dialogue: 0,0:00:02.00,0:00:03.00,Default,Толпа,0,0,0,,Шум\n'
  +'Dialogue: 0,0:00:03.00,0:00:04.00,Default,Новый персонаж,0,0,0,,Фраза\n';
const entries=parseAssCharacters(ass).characters;
applyAssCastImport(state,project,next,entries);
assert.deepEqual(next.roles.map(r=>r.roleTier),['main','extras','supporting'],
  'ASS inherits known character categories but does not guess unknown ones');
const originalId=next.roles[0].id;
next.roles[0].roleTier='extras';
applyAssCastImport(state,project,next,entries);
assert.equal(next.roles[0].id,originalId,'Repeat import keeps original identity');
assert.equal(next.roles[0].roleTier,'extras','Repeat import does not erase manual category');

const crowd=next.roles[1];
addActorsToCharacter(state,next,crowd,['a','b']);
assert.equal(next.roles.filter(r=>r.character==='Толпа').length,2);
assert.ok(next.roles.filter(r=>r.character==='Толпа').every(r=>r.roleTier==='extras'),
  'Multiple actors for one character retain category');
const restored=normalizeState(JSON.parse(JSON.stringify(state)));
assert.deepEqual(restored.projects[0].episodes[1].roles.map(r=>r.roleTier),
  next.roles.map(r=>r.roleTier),'Workspace normalization preserves category');
const legacy=seedState();legacy.projects=[newProject({title:'Старый проект',episodes:[
  newEpisode({roles:[{id:'old',character:'Герой',status:'waiting'}]})
]})];
assert.equal(normalizeState(legacy).projects[0].episodes[0].roles[0].roleTier,'supporting');

const app=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
assert.match(app,/roleTierSortedRows\(rows\)\.map/);
assert.match(app,/roleTierDivider\(arr,i\)/);
assert.match(app,/name="roleTier"/);
assert.match(app,/class="row-select role-tier/);
assert.match(app,/matchingCharacterRoles\(ep,r\)\)sibling\.roleTier/);
assert.match(css,/role-tier-divider-main/);
assert.match(css,/role-tier-divider-extras/);
console.log('PASS: role tiers, ASS inheritance, multicasting, legacy persistence and grouping UI');
