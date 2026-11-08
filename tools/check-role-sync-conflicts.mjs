import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as sync from '../package/web/task-cloud-sync.js';
import {escapeHTML,roleStageName,reviewVersion,applyRoleReviews} from '../package/web/core.js';
const source=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const original={projects:[{id:'p',title:'<Project>',season:'1',episodes:[{id:'ep',number:'2',title:'Episode',tasks:[],roles:[
 {id:'r',character:'<Hero>',actorId:'a',actor:'Actor',status:'waiting'},
 {id:'other',character:'Other',actorId:'b',status:'waiting'}]}]}],actors:[{id:'a',name:'Actor'},{id:'b',name:'Other actor'}]};
const getRole=s=>s.projects[0].episodes[0].roles[0];
const before=sync.buildTaskSnapshot(original),local=structuredClone(before),remote=structuredClone(before);
getRole(local).status='retake';getRole(remote).status='processing';
remote.projects[0].episodes[0].roles[1].status='done';
let merged=sync.mergeRoleStages(local,before,remote);
assert.deepEqual(merged.conflicts,['p:ep:r']);
assert.equal(merged.details[0].character,'<Hero>');
assert.equal(merged.details[0].projectTitle,'<Project>');
assert.equal(merged.details[0].episodeNumber,'2');
assert.equal(merged.details[0].baselineStatus,'waiting');
assert.throws(()=>sync.roleStageDecisions(merged.details,{}),/Выбери/,'Never default to overwriting either side');
assert.throws(()=>sync.roleStageDecisions(merged.details,{'role-sync-0':'done'}),/Выбери/);
const localChoice=sync.roleStageDecisions(merged.details,{'role-sync-0':'local'});
const cloudChoice=sync.roleStageDecisions(merged.details,{'role-sync-0':'remote'});
for(const [choices,expected] of [[localChoice,'retake'],[cloudChoice,'processing']]){
 const selected=sync.mergeRoleStages(local,before,remote,choices);
 assert.deepEqual(selected.conflicts,[]);assert.equal(selected.resolved.length,1);
 assert.equal(selected.stages.find(r=>r.id==='p:ep:r').status,expected);
 assert.equal(selected.stages.find(r=>r.id==='p:ep:other').status,'done','Unrelated cloud change must survive');
}
for(const mutate of [r=>r.status='received',r=>r.actorId='new-actor',r=>r.character='Replacement']){
 const changed=structuredClone(remote);mutate(getRole(changed));
 assert.deepEqual(sync.mergeRoleStages(local,before,changed,cloudChoice).conflicts,['p:ep:r'],'Stale choices require a fresh review');
}
const normalizedBase=structuredClone(before),normalizedLocal=structuredClone(before),normalizedCloud=structuredClone(before);
getRole(normalizedBase).status='processed';getRole(normalizedLocal).status='processing';getRole(normalizedCloud).status='done';
assert.deepEqual(sync.mergeRoleStages(normalizedLocal,normalizedBase,normalizedCloud).conflicts,[]);
assert.equal(sync.mergeRoleStages(normalizedLocal,normalizedBase,normalizedCloud).stages[0].status,'done');

const syncCode=source.slice(source.indexOf('async function syncStudioTasks('),source.indexOf('\nfunction persist(){'));
async function scenario({choice,failDisk=false,newEditWhileSaving=false,changeCloudAfterWrite=false,rejectWrite=false,failBaseline=false}={}){
 const state=structuredClone(original);getRole(state).status='retake';
 const calls=[];let savedSnapshot=structuredClone(remote),version=4,opened=0,retried=0;
 const review={actorId:'a',roleId:'r',state:'pending',submissionId:10,messageId:20};
 const context=vm.createContext({...sync,state,native:true,cloud:{connected:true,reviews:[review]},modal:{open:false},
  saving:false,saveError:'',localEditRevision:0,taskSyncBusy:false,taskSyncError:'',roleSyncConflicts:[],roleSyncDecisions:choice||[],
  JSON,console,updateCloudIndicator(){},toast(){},render(){},isActorPickerOpen:()=>false,
  reviewVersion,reviewForRole:role=>role.id==='r'?review:null,
  async addStudioMirrorToSnapshot(s,snapshot){return snapshot;},
  showRoleSyncConflicts(){opened++;},scheduleTaskCloudSync(){retried++;},
  persist(){context.localEditRevision++;},
  async flushSave(){
   calls.push('disk/save');
   if(failDisk)context.saveError='Disk is full';
   if(newEditWhileSaving){getRole(state).status='done';context.localEditRevision++;}
  },
  async api(path,body){
   calls.push(path);
   if(path==='cloud/tasks/read')return {version,snapshot:structuredClone(savedSnapshot)};
   if(path==='cloud/tasks/baseline')return {known:true,snapshot:structuredClone(before)};
   if(path==='cloud/tasks/write'){
    assert.equal(body.baseVersion,4);
    if(rejectWrite)throw Error('409 task_version_conflict');
    savedSnapshot=structuredClone(body.snapshot);version=5;
    if(changeCloudAfterWrite){getRole(savedSnapshot).status='received';version=6;}
    return {version:5};
   }
   if(path==='cloud/tasks/baseline/save'){if(failBaseline)throw Error('Cannot save baseline');return {};}
   if(path==='cloud/roles/sync-ready'){assert.equal(body.snapshotVersion,version);return {};}
   throw Error('Unexpected or forced sync request '+path);
  }
 });
 vm.runInContext(syncCode+'\nglobalThis.runSync=syncStudioTasks;',context);
 const ok=await context.runSync(true);
 return {ok,state,calls,savedSnapshot,opened,retried,context,review};
}
let result=await scenario();
assert.equal(result.ok,false);assert.equal(result.opened,1);
assert.ok(!result.calls.includes('cloud/tasks/write')&&!result.calls.includes('cloud/roles/sync-ready'),'Unresolved conflict must not publish');
assert.equal(getRole(result.state).status,'retake');
for(const [choice,expected] of [[localChoice,'retake'],[cloudChoice,'processing']]){
 result=await scenario({choice});assert.equal(result.ok,true);
 assert.equal(getRole(result.state).status,expected);assert.equal(getRole(result.savedSnapshot).status,expected);
 assert.ok(result.calls.indexOf('disk/save')<result.calls.indexOf('cloud/tasks/baseline/save'),'Disk success precedes baseline advancement');
 assert.ok(result.calls.indexOf('cloud/tasks/baseline/save')<result.calls.indexOf('cloud/roles/sync-ready'));
 assert.equal(result.context.roleSyncConflicts.length,0);assert.equal(result.context.roleSyncDecisions.length,0);
 assert.equal(applyRoleReviews(result.state,[result.review]),false,'An already seen pending review cannot undo the explicit choice');
 assert.equal(applyRoleReviews(result.state,[{...result.review,submissionId:11,messageId:21}]),true,'New submissions must still be applied');
}
for(const options of [{failDisk:true},{newEditWhileSaving:true},{changeCloudAfterWrite:true},{rejectWrite:true}]){
 result=await scenario({choice:cloudChoice,...options});assert.equal(result.ok,false);
 assert.ok(!result.calls.includes('cloud/tasks/baseline/save'),'Failed or stale work must retain the prior baseline');
 assert.ok(!result.calls.includes('cloud/roles/sync-ready'),'Failed or stale work must not unlock publication');
 if(options.newEditWhileSaving){assert.equal(getRole(result.state).status,'done');assert.equal(result.retried,1);}
 if(options.changeCloudAfterWrite){assert.equal(getRole(result.state).status,'retake');assert.equal(result.retried,1);}
}
result=await scenario({choice:cloudChoice,failBaseline:true});
assert.equal(result.ok,false);assert.ok(!result.calls.includes('cloud/roles/sync-ready'));

// Exercise the actual dialog and submit callback with untrusted role names.
let body='',handler,refreshes=0;
const ui=vm.createContext({roleSyncConflicts:merged.details,roleSyncDecisions:[{id:'older',decisionKey:'preserve',choice:'local'}],
 modal:{open:false,classList:{add(){}},close(){this.open=false;}},e:escapeHTML,roleStageName,roleStageDecisions:sync.roleStageDecisions,
 studioRolePortrait:()=>'<span class="portrait"></span>',
 showModal(title,subtitle,html,label,submit){body=html;handler=submit;ui.modal.open=true;},
 refreshAllStudio:async()=>{refreshes++;}});
vm.runInContext(source.slice(source.indexOf('function roleSyncBannerHTML(){'),source.indexOf('function saveStatusState(){'))+'\nglobalThis.open=showRoleSyncConflicts;globalThis.banner=roleSyncBannerHTML;',ui);
assert.match(ui.banner(),/data-action="cloud-resolve-conflict"/);assert.ok(!ui.banner().includes('<Hero>'));
ui.open();assert.ok(body.includes('&lt;Hero&gt;')&&body.includes('&lt;Project&gt;'));
assert.match(body,/name="role-sync-0" value="local" required/);assert.match(body,/name="role-sync-0" value="remote" required/);
assert.ok(!/\bchecked\b/.test(body),'No hidden preference for either status');
await assert.rejects(()=>handler({}),/Выбери/);assert.equal(ui.modal.open,true);assert.equal(refreshes,0);
await handler({'role-sync-0':'remote'});assert.equal(ui.modal.open,false);assert.equal(refreshes,1);
assert.equal(ui.roleSyncDecisions.length,2,'Decisions for other unresolved roles survive reopening the dialog');
console.log('PASS: explicit per-role conflict choices, stale decision guards, legacy stage normalization, safe dialog and durable reconciliation');
