import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as taskSync from '../package/web/task-cloud-sync.js';
const source=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function syncStudioTasks('),source.indexOf('\nfunction persist(){'));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function scenario(pauseAt){
 const state={projects:[{id:'p',title:'Project',episodes:[{id:'ep',number:'1',roles:[],tasks:[{id:'t',title:'Local edit',priority:'normal'}]}]}],actors:[]};
 const before=taskSync.buildTaskSnapshot(state),remote=structuredClone(before);
 remote.tasks[0].title='Previous title';
 const gate=deferred(),paused=deferred();let retried=0,ready=0,baselineWrites=0,writes=0,written;
 const context=vm.createContext({...taskSync,state,native:true,cloud:{connected:true},taskSyncBusy:false,
  modal:{open:false},saving:false,localEditRevision:0,saveError:'',taskSyncError:'',roleSyncConflicts:[],roleSyncDecisions:[],
  JSON,console,updateCloudIndicator(){},toast(){},render(){},isActorPickerOpen:()=>false,
  scheduleTaskCloudSync(){retried++;},flushSave:async()=>{},persist(){throw Error('Concurrent local edit must never be replaced');},
  async addStudioMirrorToSnapshot(s,snapshot){if(pauseAt==='preview'){paused.resolve();await gate.promise;}return snapshot;},
  verifyStudioMirrorImages(){return {};},
  async api(path,body){
   if(path==='cloud/tasks/read')return {version:written?2:1,snapshot:written||remote};
   if(path==='cloud/tasks/baseline')return {known:true,snapshot:remote};
   if(path==='cloud/tasks/write'){writes++;written=body.snapshot;if(pauseAt==='write'){paused.resolve();await gate.promise;}return {version:2};}
   if(path==='cloud/tasks/baseline/save'){baselineWrites++;return {};}
   if(path==='cloud/roles/sync-ready'){ready++;return {};}
   throw Error('Unexpected request '+path);
  }
 });
 vm.runInContext(code+'\nglobalThis.runSync=syncStudioTasks;',context);
 const running=context.runSync();await paused.promise;
 vm.runInContext("state.projects[0].episodes[0].tasks[0].title='Newer user edit';localEditRevision++;",context);
 gate.resolve();assert.equal(await running,false);
 assert.equal(state.projects[0].episodes[0].tasks[0].title,'Newer user edit');
 assert.equal(retried,1,'A fresh reconciliation is scheduled automatically');
 assert.equal(ready,0,'Stale results must not unlock roster publication');
 assert.equal(baselineWrites,0,'Stale work must not replace the merge baseline');
 assert.equal(writes,pauseAt==='write'?1:0,'Preview-time edits must be caught before the cloud write');
}
await scenario('preview');await scenario('write');
assert.match(source,/function persist\(\)\{\s*localEditRevision\+\+/);
console.log('Studio sync preserves edits made during preview preparation and cloud writes');
