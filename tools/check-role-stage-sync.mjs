import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTaskSnapshot,mergeRoleStages,applyRoleStages,addRoleStagesToCatalog} from '../package/web/task-cloud-sync.js';

const state={projects:[{id:'p',title:'Test',season:'1',archived:false,episodes:[
 {id:'ep',number:'1',title:'',tasks:[],roles:[{id:'r',character:'Hero',status:'waiting',actorId:'a'}]}]}],actors:[{id:'a',name:'Actor'}]};
const before=buildTaskSnapshot(state);
assert.equal(before.projects[0].episodes[0].roles[0].status,'waiting');
const remote=structuredClone(before);remote.projects[0].episodes[0].roles[0].status='processing';
const result=mergeRoleStages(before,before,remote);
assert.deepEqual(result.conflicts,[]);
assert.equal(result.stages[0].status,'processing');
assert.equal(applyRoleStages(state,result.stages),true);
assert.equal(state.projects[0].episodes[0].roles[0].status,'processing');
assert.equal(applyRoleStages(state,result.stages),false);
const updated=addRoleStagesToCatalog(before,result.stages);
assert.equal(updated.projects[0].episodes[0].roles[0].status,'processing');
const localChanged=structuredClone(before);localChanged.projects[0].episodes[0].roles[0].status='retake';
assert.deepEqual(mergeRoleStages(localChanged,before,remote).conflicts,['p:ep:r']);
const legacy=structuredClone(remote);delete legacy.projects[0].episodes[0].roles[0].status;
assert.equal(mergeRoleStages(before,null,legacy).stages[0].status,'waiting');
const boot=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const host=readFileSync(new URL('../package/StudioCloud.cs',import.meta.url),'utf8');
assert.ok(boot.includes("await api('cloud/roles/sync-ready',{})"));
assert.ok(host.includes('requestId!=""&&roleSyncReady'));
const startup=boot.slice(boot.indexOf('async function boot(){'));
assert.ok(startup.includes('render();ensureActorPreviews().catch(()=>{});'),
  'Desktop startup must render locally loaded projects before waiting for Cloud');
assert.ok(startup.includes('void finishStartupCloud().catch('),
  'Cloud reconciliation must run without blocking the startup screen');
assert.ok(!startup.includes('await refreshCloud()')&&!startup.includes('await syncStudioTasks()'),
  'The initial UI must not await remote operations');
const background=boot.slice(boot.indexOf('async function finishStartupCloud(){'),boot.indexOf('async function boot(){'));
assert.ok(background.includes('await refreshCloud()'));
assert.ok(background.includes('await syncStudioTasks()'));
assert.ok(background.indexOf('await syncStudioTasks()')<background.indexOf('if(!saveError){persist();'),
  'Do not publish or save boot state before website role edits are reconciled');
console.log('Two-way role status merge and startup conflict guard passed');
