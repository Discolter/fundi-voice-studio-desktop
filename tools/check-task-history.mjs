import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,basename,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {seedState,newProject,normalizeState,escapeHTML,taskPriorityName} from '../package/web/core.js';
import {archiveTask,restoreTask,mergeTaskHistory,taskHistoryRows} from '../package/web/task-history.js';
import {deleteBulkTasks,bulkTaskKey} from '../package/web/task-bulk.js';
import {buildTaskSnapshot,applyTaskSnapshot} from '../package/web/task-cloud-sync.js';

const state=seedState(),p=newProject({title:'История',season:'2'}),ep=p.episodes[0];
state.projects=[p];state.actors=[{id:'actor',name:'Актёр'}];
ep.roles=[{id:'role',character:'Персонаж',actorId:'actor',lineCount:123,status:'processing'}];
const original={id:'task',title:'Обработать',actorId:'actor',roleId:'role',priority:'urgent',due:'2026-12-01',mine:true,done:true};
ep.tasks=[original];
const roleBefore=JSON.stringify(ep.roles);
archiveTask(state,p,ep,original);ep.tasks=[];
assert.equal(taskHistoryRows(state).length,1);
assert.equal(taskHistoryRows(state,'персонаж')[0].lineCount,123);
assert.equal(taskHistoryRows(state,'актёр').length,1);
const saved=normalizeState(JSON.parse(JSON.stringify(state))),id=taskHistoryRows(saved)[0].id;
const savedRolesBefore=JSON.stringify(saved.projects[0].episodes[0].roles);
assert.deepEqual(restoreTask(saved,id).task,original,'Restore all task fields and original identity');
assert.equal(taskHistoryRows(saved).length,0);
assert.equal(JSON.stringify(saved.projects[0].episodes[0].roles),savedRolesBefore,'Restoring a task leaves role assignments and statuses unchanged');
assert.throws(()=>restoreTask(saved,id),/уже восстановлено/);
const afterRestore=structuredClone(saved.taskHistory);
mergeTaskHistory(saved,state.taskHistory);
assert.equal(taskHistoryRows(saved).length,0,'Old backups cannot resurrect restored tasks');
assert.ok(afterRestore[0].restoredAt);
assert.ok(!JSON.stringify(buildTaskSnapshot(saved)).includes('taskHistory'),'History is never published');

// Duplicate legacy IDs in distinct projects must retain their own history records.
const other=newProject({title:'Другой'});state.projects.push(other);
ep.tasks=[{...original}];other.episodes[0].tasks=[{...original,title:'Другое поручение'}];
const result=deleteBulkTasks(state,new Set([bulkTaskKey(p.id,ep.id,original.id)]));
assert.equal(result.removed,1);mergeTaskHistory(state);
assert.equal(taskHistoryRows(state).length,1);
assert.equal(other.episodes[0].tasks.length,1);
const restored=restoreTask(state,taskHistoryRows(state)[0].id);
assert.notEqual(restored.task.id,original.id,'Legacy ID collision gets a fresh ID without touching other tasks');
assert.equal(JSON.stringify(ep.roles),roleBefore);

// Deletions received from Studio Web also retain the last local task metadata.
const snapshot=buildTaskSnapshot(state);
applyTaskSnapshot(state,snapshot.tasks.map(t=>t.id===restored.task.id?{...t,title:'Изменено в Web'}:t));
assert.equal(taskHistoryRows(state).length,0,'Ordinary cloud edits are not deletions');
applyTaskSnapshot(state,snapshot.tasks.filter(t=>t.id!==restored.task.id));
assert.equal(taskHistoryRows(state).length,1);
assert.equal(taskHistoryRows(state)[0].source,'cloud');
assert.equal(taskHistoryRows(state)[0].task.title,'Изменено в Web');

// A removed source series can be recovered into an explicitly chosen series.
const orphan=taskHistoryRows(state)[0];state.projects=state.projects.filter(x=>x.id!==orphan.projectId);
const oldOrphan=structuredClone(orphan);
assert.throws(()=>restoreTask(state,orphan.id),/Исходная серия/);
const target=state.projects[0],targetEp=target.episodes[0];
const moved=restoreTask(state,orphan.id,target.id,targetEp.id);
assert.equal(moved.task.roleId,'');assert.equal(moved.task.actorId,'actor');
mergeTaskHistory(state,[oldOrphan]);
assert.equal(taskHistoryRows(state).length,0,'Moved restores remain suppressed when importing an older backup');

// Execute the actual dialog renderer and restore handler with a lightweight DOM host.
const uiState=seedState(),uiProject=newProject({title:'Проект окна'}),uiEpisode=uiProject.episodes[0];
uiState.projects=[uiProject];
archiveTask(uiState,uiProject,uiEpisode,{id:'ui-task',title:'<img src=x onerror=alert(1)>',priority:'high',done:true});
const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
let dialog;
const dialogHost={dataset:{},classList:{add(){}},querySelector(){return null;}};
const uiContext=vm.createContext({state:uiState,taskHistoryRows,restoreTask,e:escapeHTML,taskPriorityName,
  icon:()=>'',dueLabel:v=>v,getProject:id=>uiState.projects.find(p=>p.id===id),render(){},touch(){},toast(){},
  showModal:(title,subtitle,html)=>{dialog={title,subtitle,html};},modal:dialogHost,document:{addEventListener(){}},Date});
vm.runInContext("let taskHistoryQuery='';\n"+app.slice(app.indexOf('function taskHistoryListHTML()'),app.indexOf('function renderDebts()')),uiContext);
vm.runInContext('showTaskHistory()',uiContext);
assert.equal(dialog.title,'История поручений');
assert.ok(dialog.html.includes('&lt;img'));
assert.ok(!dialog.html.includes('<img src=x'),'History labels are escaped before rendering');
assert.ok(dialog.html.includes('data-action="restore-task"'));
vm.runInContext('restoreTaskFromHistory('+JSON.stringify(taskHistoryRows(uiState)[0].id)+')',uiContext);
assert.equal(uiEpisode.tasks.length,1,'The dialog restore action returns the task to its episode');
assert.equal(taskHistoryRows(uiState).length,0);
assert.ok(dialog.html.includes('Удалённых поручений нет'));

// Compile and exercise the same file-based recovery store used by the Windows app.
if(process.platform==='win32'){
  const taskRoot=mkdtempSync(join(tmpdir(),'fundi-task-history-'));
  const repo=resolve(import.meta.dirname,'..'),script=join(taskRoot,'run.ps1');
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  writeFileSync(script,"$ErrorActionPreference='Stop'\nAdd-Type -Path @("+
    [join(repo,'package/TaskHistory.cs'),join(repo,'tools/fixtures/TaskHistoryChecks.cs')].map(quote).join(',')+
    ") -ReferencedAssemblies 'System.dll','System.Core.dll','System.Web.Extensions.dll'\n[FundiVoice.TaskHistoryChecks]::Run("+quote(taskRoot)+")\n");
  try{
    const run=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{encoding:'utf8'});
    assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
    console.log(run.stdout.trim());
  }finally{
    if(resolve(taskRoot).startsWith(resolve(tmpdir())+sep)&&basename(taskRoot).startsWith('fundi-task-history-'))rmSync(taskRoot,{recursive:true,force:true});
  }
}
console.log('PASS: task history, single/bulk/cloud deletion, exact restoration, backup round-trip, no resurrection and orphan recovery');
