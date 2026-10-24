import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seedState,newProject} from '../package/web/core.js';
import {buildTaskSnapshot,mergeTaskSnapshots,mergeTaskCatalog,applyTaskSnapshot} from '../package/web/task-cloud-sync.js';

const workspace=seedState(),p=newProject({title:'Тестовая серия'}),ep=p.episodes[0];
workspace.projects=[p];workspace.actors=[{id:'actor-1',name:'Тестовый актёр'}];
ep.roles=[{id:'r1',character:'Герой',actorId:'actor-1',actor:'Тестовый актёр',lineCount:100}];
ep.tasks=[{id:'a',title:'Сведение',actorId:'actor-1',roleId:'r1',priority:'high',due:'',done:false}];
test('build public task catalog includes role workload but excludes local file paths',()=>{
  const result=buildTaskSnapshot(workspace);
  assert.equal(result.tasks[0].roleId,'r1');
  assert.equal(result.projects[0].episodes[0].roles[0].lineCount,100);
  assert.ok(!JSON.stringify(result).includes('folder'));
});
test('first publish preserves local tasks; first adoption preserves prior web edit',()=>{
  const local=buildTaskSnapshot(workspace);
  assert.deepEqual(mergeTaskSnapshots(local,null,{...local,tasks:[]}).tasks,local.tasks);
  const web={...local,tasks:[{...local.tasks[0],title:'Исправлено в Web'}]};
  assert.equal(mergeTaskSnapshots(local,null,web).tasks[0].title,'Исправлено в Web');
});
test('three-way merges independent edits without overwriting completed updates',()=>{
  const base=buildTaskSnapshot(workspace);
  const local={...base,tasks:[{...base.tasks[0],priority:'urgent'},{...base.tasks[0],id:'new-local'}]};
  const remote={...base,tasks:[base.tasks[0],{...base.tasks[0],id:'new-remote'}]};
  const merged=mergeTaskSnapshots(local,base,remote);
  assert.deepEqual(merged.conflicts,[]);
  assert.equal(merged.tasks.length,3);
  assert.equal(merged.tasks.find(t=>t.id==='a').priority,'urgent');
});
test('conflicts do not silently win and remote deletions persist',()=>{
  const base=buildTaskSnapshot(workspace);
  const local={...base,tasks:[{...base.tasks[0],priority:'urgent'}]};
  const remote={...base,tasks:[{...base.tasks[0],title:'Edit in Web'}]};
  const merged=mergeTaskSnapshots(local,base,remote);
  assert.deepEqual(merged.conflicts,['a']);
  const untouched=mergeTaskSnapshots(base,base,{...base,tasks:[]});
  assert.equal(untouched.tasks.length,0);
});
test('applies remote tasks by episode without replacing actors and roles',()=>{
  const base=buildTaskSnapshot(workspace);
  const copy=structuredClone(workspace);
  assert.equal(applyTaskSnapshot(copy,[{...base.tasks[0],done:true}]),true);
  assert.equal(copy.projects[0].episodes[0].tasks[0].done,true);
  assert.equal(copy.projects[0].episodes[0].roles[0].lineCount,100);
});
test('preserves web-only catalog entries until local series becomes available',()=>{
  const local=buildTaskSnapshot(workspace);
  const extra={...local.projects[0],id:'remote',episodes:[{...local.projects[0].episodes[0],id:'another'}]};
  const union=mergeTaskCatalog(local,{projects:[extra],actors:[{id:'remote-actor',name:'Актёр'}]});
  assert.equal(union.projects.length,2);
  assert.equal(union.actors.length,2);
});
test('desktop web and native sources contain task sync wiring',()=>{
 const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../package/LocalServer.cs',import.meta.url),'utf8');
 const cloud=readFileSync(new URL('../package/StudioCloud.cs',import.meta.url),'utf8');
 assert.match(app,/syncStudioTasks/);
 assert.match(app,/cloud\/tasks\/baseline\/save/);
 assert.match(server,/cloud\/tasks\/write/);
 assert.match(cloud,/\/v1\/studio\/tasks/);
});
