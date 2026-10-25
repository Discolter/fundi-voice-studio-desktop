import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seedState,newProject,debtRows,normalizeState} from '../package/web/core.js';

const alpha=newProject({title:'Ателье колдовских колпаков',season:'1'});
const beta=newProject({title:'Меч и жезл Вистории',season:'2'});
const archived=newProject({title:'Архив',archived:true});
const actors=[{id:'actor-1',name:'Лиса',telegram:'lisa'},{id:'actor-2',name:'Вера',telegram:'vera'}];
alpha.episodes[0].roles=[
 {id:'alpha-waiting',character:'Мама Коко',actorId:'actor-1',status:'waiting'},
 {id:'alpha-retake',character:'Роль на перезапись',actorId:'actor-2',status:'retake'},
 {id:'alpha-recording',character:'Уже записывает',actorId:'actor-1',status:'recording'},
 {id:'alpha-done',character:'Принято',actorId:'actor-1',status:'done'}];
beta.episodes[0].roles=[
 {id:'beta-waiting',character:'Сион',actorId:'actor-1',status:'waiting'},
 {id:'beta-retake',character:'Другая перезапись',actorId:'actor-2',status:'retake'}];
archived.episodes[0].roles=[{id:'archived-waiting',character:'Архивная',actorId:'actor-1',status:'waiting'}];
const state=normalizeState({...seedState(),settings:{workspaceVersion:2},actors,projects:[alpha,beta,archived]});
const id=title=>state.projects.find(p=>p.title===title).id;
const aid=title=>id(title);
const first=aid('Ателье колдовских колпаков'),second=aid('Меч и жезл Вистории');
const ids=options=>debtRows(state,options).map(({r})=>r.id).sort();
assert.deepEqual(ids({}),['alpha-retake','alpha-waiting','beta-retake','beta-waiting']);
assert.deepEqual(ids({projectId:'all'}),ids({}),'Selecting all anime preserves current debt counts');
assert.deepEqual(ids({projectId:first}),['alpha-retake','alpha-waiting']);
assert.deepEqual(ids({projectId:second}),['beta-retake','beta-waiting']);
assert.deepEqual(ids({projectId:'no-such-project'}),[],'Unknown project cannot leak other anime');
assert.deepEqual(ids({projectId:first,actorKey:'id:actor-1'}),['alpha-waiting']);
assert.deepEqual(ids({projectId:first,actorKey:'id:actor-2',status:'retake'}),['alpha-retake']);
assert.deepEqual(ids({projectId:first,status:'retake'}),['alpha-retake']);
assert.deepEqual(ids({projectId:first,query:'мама коко'}),['alpha-waiting']);
assert.deepEqual(ids({projectId:second,query:'мама коко'}),[]);
assert.equal(debtRows(state,{projectId:first}).length,2);
assert.equal(new Set(debtRows(state,{projectId:first}).map(({actorKey})=>actorKey)).size,2);
const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const visual=readFileSync(new URL('../package/web/visual-selects.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../package/web/compact.css',import.meta.url),'utf8');
for(const text of ['debtProject:', 'debtProject:ui.debtProject', "projectId=ui.debtProject==='all'?'':ui.debtProject",
 'debtRows(state,{projectId})','debtRows(state,{projectId,actorKey:ui.debtActor,status:ui.debtStatus,query:ui.query})',
 'id="debt-project-filter"','Выбрать актёра для фильтра долгов','case \'reset-debt-filters\'',
 "if(el.id==='debt-project-filter')"])
 assert.ok(app.includes(text),'Missing anime debt UI or persistence: '+text);
assert.match(app,/if\(ui\.debtProject!=='all'&&!allProjects\.some/,'Deleted or archived project must reset selection');
assert.match(visual,/select\.id === 'debt-project-filter'/);
assert.match(visual,/Поиск аниме/);
assert.match(css,/debt-project-filter/);
console.log('PASS: debts scoped to anime, actor, status, search; actor stats and picker; project dropdown');
