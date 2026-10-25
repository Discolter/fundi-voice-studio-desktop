import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTaskSnapshot,mergeRoleStages} from '../package/web/task-cloud-sync.js';

const web=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../package/StudioCloud.cs',import.meta.url),'utf8');
const host=readFileSync(new URL('../package/LocalServer.cs',import.meta.url),'utf8');

// Independent actor recording action increments both the task catalog and roster
// revision.  Studio must merge that role stage first, then refresh the roster
// revision only if the task-catalog version is still identical.
const original={projects:[{id:'anime',title:'Test',season:'1',episodes:[
  {id:'e',number:'1',roles:[{id:'r',status:'waiting',character:'Hero'}],tasks:[]}]
}],actors:[],tasks:[]};
const local=structuredClone(original),remote=structuredClone(original);
remote.projects[0].episodes[0].roles[0].status='recording';
assert.deepEqual(mergeRoleStages(local,original,remote).conflicts,[]);
assert.equal(mergeRoleStages(local,original,remote).stages[0].status,'recording');
const clash=structuredClone(local);
clash.projects[0].episodes[0].roles[0].status='retake';
assert.deepEqual(mergeRoleStages(clash,original,remote).conflicts,['anime:e:r'],
 'simultaneous local and actor recording changes must stop publication');

const reqVersion=web.indexOf('const snapshotVersion=published?.version??remote.version;');
const ready=web.indexOf("await api('cloud/roles/sync-ready',{snapshotVersion})");
assert.ok(reqVersion>=0&&ready>reqVersion,
  'Only a matching snapshot revision can authorize roster rebasing');
assert.ok(web.includes("if(saveError)throw Error('Не удалось сохранить согласованные роли на диск: '"),
  'Do not enable publication if the merged disk state was not saved');

const method=cloud.slice(cloud.indexOf('public object FinishRoleSync(long expectedSnapshotVersion)'),
 cloud.indexOf('public object TasksBaseline()'));
for(const phrase of ['lock(syncGate)','/v1/studio/sync-status','/v1/studio/tasks',
 'JsonData.N(latestSnapshot,"version")!=expectedSnapshotVersion','PrivateFile.Save(connectionFile,connection)',
 'roleSyncReady=true','conflict=false','nextTry=DateTime.MinValue'])
 assert.ok(method.includes(phrase),'Missing guarded cloud version recovery: '+phrase);
assert.ok(method.indexOf('/v1/studio/sync-status')<method.indexOf('/v1/studio/tasks'),
  'Read the roster revision before validating the snapshot version');
assert.ok(method.indexOf('!=expectedSnapshotVersion')<method.indexOf('connection["revision"]=serverRevision'),
  'Never refresh roster version before checking for intervening actor edits');
assert.ok(method.indexOf('connection["revision"]=serverRevision')<method.indexOf('roleSyncReady=true'));
assert.ok(method.includes('if(requestConflict)throw'),
  'Request ID conflicts must never be silently rebased');
assert.ok(cloud.includes('requestConflict=problem.Code=="request_conflict"'));
assert.ok(host.includes('Cloud.FinishRoleSync(FundiVoice.Desktop.JsonData.N(dataBody,"snapshotVersion"))'));
assert.ok(cloud.includes('if(requestId!=""&&roleSyncReady)'),
  'Roster updates still require the validated permission gate');
assert.ok(web.includes("case 'cloud-replace':confirmAction("),
  'Forced overwrite remains an explicit user-confirmed action only');

console.log('PASS: actor recording revision conflict recovers only after verified, saved role reconciliation');
