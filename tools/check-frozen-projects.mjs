import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCHEMA,newActor,newProject,normalizeState,selectProjects,actorAssignments,
  myRoleRows,debtRows,taskRows,actorPublicFeed} from '../package/web/core.js';
import {buildTaskSnapshot} from '../package/web/task-cloud-sync.js';
import {actorWorkloadRows} from '../package/web/actor-workload.js';
import {collectRecommendations} from '../package/web/recommendations.js';

const actor=newActor({id:'actor1',name:'Актёр',actorAccess:true});
const project=newProject({id:'project1',title:'Приостановленный проект',favorite:true});
project.episodes[0].stage='record';
project.episodes[0].roles.push({
 id:'role1',character:'Герой',actorId:'actor1',actor:'Актёр',
 status:'waiting',mine:true,lineCount:75,createdAt:'2026-10-01T00:00:00Z'
});
project.episodes[0].tasks.push({
 id:'task1',title:'Записать героя',due:'2099-01-01',
 priority:'normal',done:false,actorId:'actor1',roleId:'role1',mine:true
});
const state={schema:SCHEMA,projects:[project],actors:[actor],trash:[],
 settings:{mode:'studio',name:'Студия',myTelegram:''}};
const visible=()=>({
 active:selectProjects(state).length, favorite:selectProjects(state,{filter:'favorite'}).length,
 hidden:selectProjects(state,{hidden:true}).length, debts:debtRows(state).length,
 mine:myRoleRows(state).length, tasks:taskRows(state,{includeArchived:true}).length,
 actorRoles:actorAssignments(state,actor.id).length,
 workload:actorWorkloadRows(state).find(row=>row.actor.id===actor.id)?.total,
 recommendations:collectRecommendations(state,{connected:false},{now:new Date('2026-11-06')}).filter(r=>r.project?.id===project.id).length
});
const initial=visible();
assert.equal(initial.active,1);
assert.equal(initial.favorite,1);
assert.equal(initial.debts,1);
assert.equal(initial.tasks,1);
assert.equal(initial.actorRoles,1);
const before=JSON.stringify({episodes:project.episodes,archived:project.archived,favorite:project.favorite});
project.hidden=true;
const frozen=visible();
for(const [key,val] of Object.entries(frozen))
 assert.equal(val,key==='hidden'?1:0,'Frozen project should disappear from '+key);
assert.equal(JSON.stringify({episodes:project.episodes,archived:project.archived,favorite:project.favorite}),before);
assert.equal(buildTaskSnapshot(state).projects[0].hidden,true,'Cloud sync transfers frozen status');
assert.equal(buildTaskSnapshot(state).tasks.length,1,'Cloud storage retains frozen tasks');
assert.equal(actorPublicFeed(state,actor.id).roles.length,1,'Publisher preserves assignments; server filters actor-facing feed');
const restoredFromFile=normalizeState(state);
assert.equal(restoredFromFile.projects[0].hidden,true,'JSON backups retain frozen state');
restoredFromFile.projects[0].hidden=false;
assert.equal(restoredFromFile.projects[0].episodes[0].tasks.length,1);
assert.equal(restoredFromFile.projects[0].episodes[0].roles[0].status,'waiting');
project.hidden=false;
assert.deepEqual(visible(),initial,'Restoring project restores all derived views');
const app=readFileSync('package/web/app.js','utf8');
assert.match(app,/data-nav="hidden"/);
assert.match(app,/case 'toggle-hidden-project'/);
assert.match(app,/p\.hidden\?\'eye\':\'eye-off\'/);
console.log('Frozen projects: all checks passed');
