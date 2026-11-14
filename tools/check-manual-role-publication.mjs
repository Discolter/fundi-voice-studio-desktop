import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const desktop=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const host=readFileSync(new URL('../package/LocalServer.cs',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../package/StudioCloud.cs',import.meta.url),'utf8');

assert.ok(desktop.includes('function episodeRoles(p,ep)') &&
  desktop.includes('episodePublishButton(p,ep)') &&
  desktop.includes('case \'publish-episode-roles\':{'),
  'Publish roles must be available at the top of each episode role table');
assert.ok(desktop.includes("showModal('Опубликовать роли?'") &&
  desktop.includes("await api('cloud/roles/publish-episode'"),
  'Only a deliberate confirmation may publish assignments');
assert.ok(desktop.includes('syncedRoleSnapshotVersion=snapshotVersion') &&
  desktop.includes('if(!await syncStudioTasks(true)||syncedRoleSnapshotVersion<0)') &&
  desktop.includes('approvedEditRevision=localEditRevision'),
  'Approval must follow owner snapshot synchronization and detect a stale local draft');
assert.ok(!host.includes('Cloud.Queue(dataBody)') &&
  !host.includes('if(File.Exists(DataFile))Cloud.Queue('),
  'Local autosave and pairing must never publish actor roles');
assert.ok(host.includes('Cloud.PublishEpisodeRoles(saved,') &&
  host.includes('lock(SaveLock)'),
  'Native publishing must read the saved workspace, not unsaved browser changes');
const method=cloud.slice(cloud.indexOf('public object PublishEpisodeRoles('),
  cloud.indexOf('void RefreshSourceLinks()',cloud.indexOf('public object PublishEpisodeRoles(')));
for(const part of [
 'lock(syncGate)','expectedSnapshotVersion','/v1/studio/tasks',
 '/v1/studio/web/roster','/v1/studio/sync-status',
 'JsonData.S(role,"projectId")==projectId&&JsonData.S(role,"episodeId")==episodeId',
 'roles.AddRange(specific)','requestId=Guid.NewGuid()','/v1/studio/roster'
])assert.ok(method.includes(part),'Missing explicit publish safety check: '+part);
assert.ok(method.indexOf('!=expectedSnapshotVersion')<method.indexOf('"/v1/studio/roster","PUT"'),
  'Do not publish without validating cloud snapshot version');
// Explicit cast publication must not roll back already live fields. The
// server roster is the authority for processing status and category.
for(const required of ['liveRoleMetadata','if(live.ContainsKey("status"))role["status"]=live["status"]',
  'if(live.ContainsKey("roleTier"))role["roleTier"]=live["roleTier"]'])
  assert.ok(method.includes(required),'Roster publish may roll back live metadata: '+required);
assert.ok(cloud.includes('pending=new Dictionary<string,object>();') &&
  cloud.includes('File.Delete(pendingFile)'),
  'Old automatically enqueued roles must not be published after an upgrade');
console.log('PASS: explicit episode role publishing is confirmed, scoped and free of autosave triggers');
