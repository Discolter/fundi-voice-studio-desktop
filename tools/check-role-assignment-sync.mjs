import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  buildTaskSnapshot, mergeRoleAssignments, addRoleAssignmentsToCatalog, applyRoleAssignments
} from '../package/web/task-cloud-sync.js';

const workspace={
  projects:[{id:'p',title:'Моб Психо 100',season:'1',episodes:[
    {id:'ep',number:'2',title:'',roles:[
      {id:'mob',character:'Моб',actorId:'a',actor:'Актёр A',status:'received',
        image:'data:image/webp;base64,QQ==',subtitle:'important.ass',notes:'keep local',folder:'D:/voices'},
      {id:'reigen',character:'Рейген',actorId:'',actor:'',status:'waiting'}
    ],tasks:[]}
  ]}],
  actors:[{id:'a',name:'Актёр A'},{id:'b',name:'Актёр B'},{id:'c',name:'Актёр C'}]
};
const role=(state,id)=>state.projects[0].episodes[0].roles.find(r=>r.id===id);
const base=buildTaskSnapshot(workspace);
const local=structuredClone(base);
const cloud=structuredClone(base);

// Cloud-side casting is adopted when the Windows copy has not changed since baseline.
role(cloud,'mob').actorId='b';
role(cloud,'mob').actor='Актёр B';
role(cloud,'reigen').actorId='c';
role(cloud,'reigen').actor='Актёр C';
let result=mergeRoleAssignments(local,base,cloud);
assert.deepEqual(result.conflicts,[]);
assert.equal(result.assignments.length,2);
assert.equal(result.assignments.find(r=>r.id==='p:ep:mob').actorId,'b');
const joined=addRoleAssignmentsToCatalog(local,result.assignments);
assert.equal(role(joined,'mob').actorId,'b');
assert.equal(role(joined,'reigen').actorId,'c');
const updated=structuredClone(workspace);
assert.equal(applyRoleAssignments(updated,result.assignments),true);
assert.equal(role(updated,'mob').actorId,'b');
assert.equal(role(updated,'mob').actor,'Актёр B');
assert.equal(role(updated,'mob').status,'received','Do not erase recording progress');
assert.equal(role(updated,'mob').folder,'D:/voices');
assert.equal(role(updated,'mob').subtitle,'important.ass');
assert.equal(role(updated,'mob').notes,'keep local');
assert.equal(applyRoleAssignments(updated,result.assignments),false,'Idempotent sync');

// Desktop-only changes must be exported rather than reset from the cloud.
const desktop=structuredClone(base);
role(desktop,'mob').actorId='c';
role(desktop,'mob').actor='Актёр C';
result=mergeRoleAssignments(desktop,base,base);
assert.deepEqual(result.conflicts,[]);
assert.equal(result.assignments.find(r=>r.id==='p:ep:mob').actorId,'c');

// Simultaneous differing edits must remain blocked until the owner chooses a side.
result=mergeRoleAssignments(desktop,base,cloud);
assert.equal(result.conflicts.length,1);
const details=result.details;
assert.equal(details[0].kind,'assignment');
assert.equal(details[0].localActor,'Актёр C');
assert.equal(details[0].remoteActor,'Актёр B');
assert.equal(details[0].baselineActor,'Актёр A');
for(const [choice,expected] of [['local','c'],['remote','b']]){
 const resolved=mergeRoleAssignments(desktop,base,cloud,[{
   id:details[0].id,decisionKey:details[0].decisionKey,choice
 }]);
 assert.deepEqual(resolved.conflicts,[]);
 assert.equal(resolved.assignments.find(r=>r.id==='p:ep:mob').actorId,expected);
}
const stale=structuredClone(cloud);role(stale,'mob').actorId='a';
assert.deepEqual(mergeRoleAssignments(desktop,base,stale,[{
  id:details[0].id,decisionKey:details[0].decisionKey,choice:'remote'
}]).conflicts,[]); // Now the cloud equals baseline, so no conflict.
role(stale,'mob').actorId='unrelated';
assert.equal(mergeRoleAssignments(desktop,base,stale,[{
  id:details[0].id,decisionKey:details[0].decisionKey,choice:'remote'
}]).conflicts.length,1,'Never reuse a stale conflict choice');

// First connection merges a single-sided cast, but refuses different non-empty actors.
const blank=structuredClone(base);role(blank,'mob').actorId='';role(blank,'mob').actor='';
assert.equal(mergeRoleAssignments(blank,null,cloud).assignments.find(r=>r.id==='p:ep:mob').actorId,'b');
assert.equal(mergeRoleAssignments(desktop,null,blank).assignments.find(r=>r.id==='p:ep:mob').actorId,'c');
assert.equal(mergeRoleAssignments(desktop,null,cloud).conflicts.length,1);

// An unrecognised cloud actor must never produce a phantom local actor.
const outsider=structuredClone(base);
role(outsider,'mob').actorId='unknown';role(outsider,'mob').actor='Чужой ID';
const noActor=mergeRoleAssignments(base,base,outsider);
assert.equal(noActor.conflicts.length,1);
assert.equal(noActor.details[0].missingActor,true);
const chooseLocal=mergeRoleAssignments(base,base,outsider,[{
  id:noActor.details[0].id,decisionKey:noActor.details[0].decisionKey,choice:'local'
}]);
assert.deepEqual(chooseLocal.conflicts,[]);
assert.equal(chooseLocal.assignments.find(r=>r.id==='p:ep:mob').actorId,'a');
assert.throws(()=>applyRoleAssignments(structuredClone(workspace),[
  {id:'p:ep:mob',actorId:'unknown',actor:'Неизвестный'}]),/отсутствует/);

const source=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
assert.match(source,/mergeRoleAssignments\(local,prior,remote\.snapshot/);
assert.match(source,/addRoleAssignmentsToCatalog/);
assert.match(source,/applyRoleAssignments\(state,assignmentMerge\.assignments/);
assert.ok(source.indexOf('applyRoleAssignments(state,assignmentMerge.assignments)')<
          source.indexOf("cloud/tasks/baseline/save"),'Apply local casting before baseline advance');
console.log('PASS: bidirectional casting merge, conflicts, safe actor identities and local file preservation');
