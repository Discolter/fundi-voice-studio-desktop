import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
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
const visual=readFileSync('package/web/visual-selects.js','utf8');
const visualCss=readFileSync('package/web/visual-selects.css','utf8');
const segment=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const preferenceKey='role-tiers-test',id='test-project';
let savedUI='{}';
function castView(){
  const buttonAttrs=new Map([['aria-controls',`role-tier-main-${id}`],['aria-expanded','true']]);
  const button={getAttribute:key=>buttonAttrs.get(key),setAttribute:(key,value)=>buttonAttrs.set(key,value)};
  const panel={setAttribute:(key,value)=>panel[key]=value,toggleAttribute:(key,value)=>panel[key]=value,
    classList:{toggle:(key,value)=>panel[key]=value}};
  const settingsFilter=value=>value??'all';
  const context=vm.createContext({ROLE_TIERS,validRoleTier,UIKEY:preferenceKey,
    TASK_PRIORITIES:[['all']],validTaskOrder:settingsFilter,validMyRoleOrder:settingsFilter,
    validTaskStatusFilter:settingsFilter,validTaskLineFilter:settingsFilter,validRecommendationFilter:settingsFilter,
    localStorage:{getItem:()=>savedUI,setItem:(key,value)=>{assert.equal(key,preferenceKey);savedUI=value;}},
    document:{getElementById:key=>key===buttonAttrs.get('aria-controls')?panel:null},
    closeActorPickers(){},icon:()=>'<svg></svg>',e:x=>x,
    castRoleRow:row=>`<tr><td>${row.r.id}</td></tr>`});
  vm.runInContext('const collapsedRoleTiers=new Map();const projectProgressEpisodes=new Map();'+
    segment('let ui=','const app=')+segment('function saveUI(){','function navigate(page)')+
    segment('function rolesTable(rows,global=false){','function castRoleRow(')+
    segment('function updateDisclosure(button,panel,expanded){',"  if(a==='toggle-project-missing'){")+'}\n'+
    'globalThis.table=rolesTable;globalThis.action=action;',context);
  return {button,buttonAttrs,panel,table:context.table,action:context.action};
}
const rows=projectId=>['extras','supporting','main'].map(tier=>({p:{id:projectId},r:{id:tier,roleTier:tier}}));
const firstView=castView();
const open=firstView.table(rows(id));
assert.equal([...open.matchAll(/aria-expanded="true"/g)].length,3,'New projects expand all categories');
assert.ok(open.indexOf('Главные роли')<open.indexOf('Второстепенные роли'));
assert.ok(open.indexOf('Второстепенные роли')<open.indexOf('Массовка'));
await firstView.action('toggle-role-tier',{id,tier:'main'},firstView.button);
assert.equal(firstView.buttonAttrs.get('aria-expanded'),'false');
assert.equal(firstView.panel['aria-hidden'],'true');assert.equal(firstView.panel.inert,true);
const collapsed=firstView.table(rows(id));
assert.match(collapsed,/data-tier="main"\s+aria-expanded="false"/);
assert.match(collapsed,/role-tier-main-test-project" aria-hidden="true" inert/);
assert.match(collapsed,/data-tier="supporting"\s+aria-expanded="true"/);
const secondView=castView();
assert.match(secondView.table(rows(id)),/data-tier="main"\s+aria-expanded="false"/,'Collapse survives a restart');
assert.equal([...secondView.table(rows('other-project')).matchAll(/aria-expanded="true"/g)].length,3);
await firstView.action('toggle-role-tier',{id,tier:'main'},firstView.button);
assert.equal(firstView.panel.inert,false);
assert.deepEqual(JSON.parse(savedUI).collapsedRoleTiers,{});
assert.match(css,/\.role-tier-cell-panel\{[^}]+transition:grid-template-rows/s);
assert.match(app,/name="roleTier"/);
assert.match(app,/class="row-select role-tier/);
assert.match(app,/matchingCharacterRoles\(ep,r\)\)sibling\.roleTier/);
for(const [tier] of ROLE_TIERS){
  assert.match(css,new RegExp(`\\.role-tier-divider-${tier}[^\\n]+\\[data-role-tier=${tier}\\][^{]*\\{\\s*--tier-accent:var\\(--role-tier-${tier}\\);\\s*--tier-text:var\\(--role-tier-${tier}-text\\)`));
}
assert.match(visual,/classList\.contains\('role-tier'\)\) return 'role-tier'/);
assert.match(visual,/button\.dataset\.roleTier = option\?\.value/);
assert.match(visual,/item\.dataset\.roleTier = option\.value/);
assert.match(visualCss,/\.fv-type-role-tier[\s\S]+\.fv-option-name\{\s*color:var\(--tier-text\)/);
console.log('PASS: role tiers, ASS inheritance, multicasting, colors and independent persistent project disclosure');
