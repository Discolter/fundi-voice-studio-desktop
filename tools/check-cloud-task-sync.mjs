import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seedState,newProject} from '../package/web/core.js';
import {buildTaskSnapshot,mergeTaskSnapshots,mergeTaskCatalog,applyTaskSnapshot,taskSyncDecisions} from '../package/web/task-cloud-sync.js';

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
test('independent fields merge but conflicting task edits still require review',()=>{
  const base=buildTaskSnapshot(workspace);
  const local={...base,tasks:[{...base.tasks[0],priority:'urgent'}]};
  const remote={...base,tasks:[{...base.tasks[0],title:'Edit in Web'}]};
  const merged=mergeTaskSnapshots(local,base,remote);
  assert.deepEqual(merged.conflicts,[]);
  assert.equal(merged.tasks[0].title,'Edit in Web');
  assert.equal(merged.tasks[0].priority,'urgent');
  const overlapping={...base,tasks:[{...base.tasks[0],priority:'low'}]};
  assert.deepEqual(mergeTaskSnapshots(local,base,overlapping).conflicts,['a']);
  const changingActor={...base,tasks:[{...base.tasks[0],actorId:'another'}]};
  const changingRole={...base,tasks:[{...base.tasks[0],roleId:'other-role'}]};
  assert.deepEqual(mergeTaskSnapshots(changingActor,base,changingRole).conflicts,['a'],
    'Actor and role linkage must not be merged independently');
  const untouched=mergeTaskSnapshots(base,base,{...base,tasks:[]});
  assert.equal(untouched.tasks.length,0);
});
test('owner can explicitly resolve overlapping or deletion task conflicts',()=>{
  const base=buildTaskSnapshot(workspace);
  const local={...base,tasks:[{...base.tasks[0],priority:'urgent'}]};
  const remote={...base,tasks:[{...base.tasks[0],priority:'low'}]};
  const found=mergeTaskSnapshots(local,base,remote);
  assert.deepEqual(found.conflicts,['a']);
  assert.equal(found.details[0].id,'task:a');
  assert.throws(()=>taskSyncDecisions(found.details,{}),/Выбери/);
  for(const [selection,expected] of [['local','urgent'],['remote','low']]){
    const choices=taskSyncDecisions(found.details,{'task-sync-0':selection});
    const accepted=mergeTaskSnapshots(local,base,remote,choices);
    assert.deepEqual(accepted.conflicts,[]);
    assert.equal(accepted.tasks[0].priority,expected);
    const changed=structuredClone(remote);
    changed.tasks[0].priority='normal';
    assert.deepEqual(mergeTaskSnapshots(local,base,changed,choices).conflicts,['a'],
      'Stale decisions cannot overwrite a newer cloud task');
  }
  const deleted={...base,tasks:[]};
  assert.deepEqual(mergeTaskSnapshots(local,base,deleted).conflicts,['a']);
  const drop=mergeTaskSnapshots(local,base,deleted,taskSyncDecisions(
    mergeTaskSnapshots(local,base,deleted).details,{'task-sync-0':'remote'}));
  assert.deepEqual(drop.tasks,[]);
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


test('deleted local projects, episodes and actors do not reappear in the cloud catalog',()=>{
 const base=buildTaskSnapshot(workspace);
 const removed=mergeTaskCatalog({projects:[],actors:[]},base,base);
 assert.equal(removed.projects.length,0);
 assert.equal(removed.actors.length,0);
 const local={...base,projects:[{...base.projects[0],episodes:[]}]};
 assert.equal(mergeTaskCatalog(local,base,base).projects[0].episodes.length,0);
 const remoteOnly={...base,projects:[...base.projects,{...base.projects[0],id:'other-windows-project'}]};
 assert.equal(mergeTaskCatalog(local,remoteOnly,base).projects.length,2,
   'An unknown project from another device is preserved');
});
