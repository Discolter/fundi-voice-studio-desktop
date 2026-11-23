import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {episodeLabel,escapeHTML,groupTaskRows,latestEpisodeRoleProgress,taskRows,withRoleReviews} from '../package/web/core.js';
const state={actors:[{id:'k',name:'Кира'},{id:'a',name:'Актёр'}]};
const p={id:'cyber'},p2={id:'other'};
const ep={id:'e1',roles:[{id:'a',actorId:'k',character:'Персонаж фильма 3',lineCount:1},{id:'b',actorId:'k',character:'Эмили',lineCount:14},{id:'c',actorId:'a',character:'Другой',lineCount:10}]};
const row=(p,ep,id,roleId,done=false)=>({p,ep,t:{id,roleId,done,title:'Обработать'}});
const rows=[row(p,ep,'1','a'),row(p,ep,'2','b'),row(p,ep,'3','c'),row(p,ep,'4','b')];
const groups=(opts={},list=rows)=>groupTaskRows(state,list,opts);
assert.equal(groups().length,2);
assert.deepEqual(groups({order:'linesAsc'}).map(g=>g.total),[10,15]);
assert.deepEqual(groups({order:'linesDesc'}).map(g=>g.total),[15,10]);
assert.equal(groups()[0].rows.length,3);
assert.equal(groups()[0].roles.length,2,'Repeated tasks do not double-count a role');
assert.equal(groups({lines:'small'}).length,2);
const ep2={id:'e2',roles:[{id:'a',actorId:'k',character:'Эмили',lineCount:22}]};
const more=[...rows,row(p,ep2,'1','a'),row(p2,ep,'1','a'),row(p,ep,'note','')];
assert.deepEqual(groups({order:'linesDesc'},more).map(g=>g.total),[37,10,1,0]);
assert.equal(groups({lines:'medium'},more)[0].total,37);
assert.equal(groups({lines:'unknown'},more).length,1);
assert.equal(groups({lines:'small'},more).length,2);
ep.roles[1].lineCount=50;
assert.equal(groups()[0].total,51,'Live counts, not cached');
ep.roles[1].lineCount=null;
assert.equal(groups({order:'linesAsc'}).at(-1).unknown,1);
assert.equal(groups({lines:'unknown'}).length,1);
assert.equal(groups({order:'linesDesc'},[row(p,ep,'done','c',true),...rows.filter(x=>x.t.roleId!=='c')]).at(-1).done,true);
assert.equal(rows.length,4);
console.log('PASS: group totals, unique roles, project and actor boundaries, episode identity, unknown counts, completion and filters');

const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const section=(start,end)=>{
  const from=app.indexOf(start),to=app.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from,'Missing '+start);
  return app.slice(from,to);
};
const expanded=new Set();
const {groupTaskProjects,renderTaskProjects}=new Function(
  'latestEpisodeRoleProgress','episodeLabel','e','expandedTaskProjects','projectArt','icon','tasksTable',
  section('function projectRoleProgressLabel(', 'function projectMissingRolesHTML(')+
  section('function groupTaskProjects(', 'function renderMyTasks(')+
  ';return {groupTaskProjects,renderTaskProjects};'
)(latestEpisodeRoleProgress,episodeLabel,escapeHTML,expanded,()=>'',()=>'',(rows,global,groups)=>{
  assert.equal(global,true,'Project panels keep the personal task table actions');
  assert.deepEqual(rows,groups.flatMap(group=>group.rows));
  return rows.map(({t})=>'<p>'+escapeHTML(t.title)+'</p>').join('');
});
const taskProject=(id,statuses,{archived=false,taskPriority='normal'}={})=>({
  id,title:'Проект '+id,season:'1',archived,
  episodes:[{id:'ep1',number:'1',roles:statuses.map((status,i)=>({id:id+'-r'+i,actorId:'k',character:'Герой '+i,status})),
    tasks:[{id:'same-task-id',title:'Задача '+id,actorId:'k',roleId:id+'-r0',priority:taskPriority,done:false}]}]
});
const later=taskProject('later',['done','waiting','waiting','waiting','waiting'],{taskPriority:'urgent'});
const near=taskProject('near',['done','done','done','done','done']);
const newest={id:'ep2',number:'2',roles:[],tasks:[{id:'same-task-id',title:'Готовое поручение',priority:'normal',done:true}]};
near.episodes.push(newest);
const unstarted=taskProject('start',['waiting','waiting']);
const archive=taskProject('archive',['done','waiting'],{archived:true});
const board={actors:state.actors,projects:[later,near,unstarted,archive]};
const recentCast=taskProject('current',['done','received','waiting','retake','processing']).episodes[0].roles;
const reviews=[{actorId:'k',roleId:'current-r1',state:'accepted',submissionId:12}];
const projectGroups=(status='all')=>groupTaskProjects(
  groupTaskRows(board,taskRows(board,{includeArchived:true,order:'priority',status})),withRoleReviews(board,reviews).projects
);
const emptyProject=projectGroups().find(({p})=>p.id==='near');
assert.equal(emptyProject.progress.episode.id,'ep2');
assert.equal(emptyProject.progress.total,0);
assert.equal(emptyProject.priority,false);
assert.match(renderTaskProjects([emptyProject]),/0 ролей/);
newest.roles=recentCast;
const projects=projectGroups();
assert.equal(projects[0].p.id,'near','Put near-ready active projects ahead of other projects');
assert.deepEqual(projects.filter(p=>p.priority).map(({p})=>p.id),['near']);
assert.deepEqual(projects[0].groups.flatMap(g=>g.rows.map(({t})=>t.title)),['Задача near','Готовое поручение']);
assert.equal(projects[0].progress.episode.id,'ep2');
assert.equal(projects[0].progress.accepted,2,'Count accepted roles from Cloud reviews too');
assert.equal(projects[0].progress.remaining,3);
assert.equal(newest.roles[1].status,'received','Rendering preserves the stored role');
assert.equal(projectGroups('open')[0].groups.flatMap(g=>g.rows).length,1,'Keep the task-status filter');
let markup=renderTaskProjects(projects);
assert.match(markup,/aria-controls="task-project-near" aria-expanded="false"/);
assert.match(markup,/id="task-project-near" class="task-project-panel" aria-hidden="true" inert/);
assert.match(markup,/Сезон 1 · Серия 02/);
assert.match(markup,/class="project-accepted-count">2\/5<\/strong>/);
assert.match(markup,/осталось <b>3<\/b>/);
assert.match(markup,/Задач <strong>2<\/strong>/);
expanded.add('near');
markup=renderTaskProjects(projectGroups());
assert.match(markup,/id="task-project-near" class="task-project-panel is-expanded" aria-hidden="false"/);
assert.match(markup,/aria-controls="task-project-later" aria-expanded="false"/);
assert.equal(renderTaskProjects([]),'','Filtered empty state uses the existing placeholder');
console.log('PASS: project panels, role progress and priority ordering, matching-task counts, and independent disclosure');
