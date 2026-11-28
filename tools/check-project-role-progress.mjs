import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {episodeLabel,escapeHTML,latestProjectEpisode,projectRoleProgress,withRoleReviews,selectProjects} from '../package/web/core.js';

const roles=(total,accepted)=>Array.from({length:total},(_,i)=>({
  id:'role-'+i,actorId:'actor-'+i,status:i<accepted?'done':'waiting',character:'Актёр '+i
}));
const episode=(number,total,accepted,stage='record')=>({id:'e'+number,number:String(number),stage,roles:roles(total,accepted)});
const project={id:'test',title:'Тестовый тайтл',color:'violet',favorite:false,cover:'',episodes:[
  episode(8,10,4), episode(12,8,4), episode(3,15,15)
]};
assert.equal(latestProjectEpisode(project).number,'12','Choose the highest numbered episode, not the last array entry');
assert.deepEqual(projectRoleProgress(project),{
  episode:project.episodes[1],total:8,accepted:4,remaining:4,tone:'yellow'
},'Exactly half complete is yellow unless only 3 roles are left');
project.episodes[1].roles=roles(8,3);
assert.equal(projectRoleProgress(project).tone,'red','Less than half is red');
project.episodes[1].roles=roles(8,5);
assert.equal(projectRoleProgress(project).tone,'green','3 remaining takes precedence over yellow');
project.episodes[1].roles=roles(10,6);
assert.equal(projectRoleProgress(project).tone,'yellow','More than 3 remaining is still yellow');
project.episodes[1].roles=roles(10,10);
assert.equal(projectRoleProgress(project).tone,'green','Fully accepted is green');
project.episodes[1].roles=roles(4,0);
assert.equal(projectRoleProgress(project).tone,'red','4 unaccepted roles are red');
project.episodes[1].roles=roles(3,0);
assert.equal(projectRoleProgress(project).tone,'green','3 unaccepted roles follow requested green threshold');
project.episodes[1].roles=[];
assert.deepEqual(projectRoleProgress(project),{episode:project.episodes[1],total:0,accepted:0,remaining:0,tone:'none'},
  'Use the newest episode until a specific episode is selected');
assert.deepEqual(projectRoleProgress(project,'e8'),{episode:project.episodes[0],total:10,accepted:4,remaining:6,tone:'red'});
assert.equal(projectRoleProgress(project,'deleted-episode').episode.number,'12','An obsolete choice uses the newest episode');
assert.equal(projectRoleProgress({episodes:[episode(1,0,0),episode(2,0,0)]}).tone,'none','All-empty project remains neutral');
project.episodes[1].roles=[{status:'received'},{status:'retake'},{status:'processing'},{status:'done'}];
assert.equal(projectRoleProgress(project).accepted,1,'Only accepted (done) roles count');
project.episodes[1].stage='done'; // Stage has no influence on latest-series selection.
assert.equal(latestProjectEpisode(project).number,'12');
const ties={episodes:[episode(4,1,0),episode(4,1,1)]};
assert.strictEqual(latestProjectEpisode(ties),ties.episodes[1],'For equal episode numbers take the last entry');
assert.equal(projectRoleProgress({episodes:[]}).tone,'none');
const before=JSON.stringify(project);
projectRoleProgress(project);
assert.equal(JSON.stringify(project),before,'Reading progress must never modify saved project state');

// Progress sorting follows the same episode and accepted statuses as the cards.
const sortable=(title,total,accepted,favorite=false)=>({
  id:title, title, favorite, archived:false, hidden:false,
  episodes:[{...episode(1,total,accepted),resources:[],tasks:[]}]
});
const complete=sortable('Готовый',5,5),near=sortable('Почти',9,8),
  half=sortable('Половина',100,50),smallHalf=sortable('Мало',4,2),
  zero=sortable('Начатый',10,0,true),blankProject=sortable('Пустой',0,0,true);
near.episodes.push({...episode(2,0,0),resources:[],tasks:[]});
const projectState={projects:[half,zero,blankProject,near,smallHalf,complete]};
const sorted=progressEpisodes=>selectProjects(projectState,{sort:'progress',progressEpisodes});
assert.deepEqual(sorted(),[complete,smallHalf,half,zero,near,blankProject],
  'Sort by displayed progress, remaining roles, and put empty projects last regardless of favorites');
const chooseNearFirst=new Map([[near.id,'e1']]);
assert.deepEqual(sorted(chooseNearFirst),[complete,near,smallHalf,half,zero,blankProject],
  'Sorting uses the same selected episode as the card');
near.episodes[0].roles=roles(9,9);
assert.deepEqual(sorted().slice(-2),[near,blankProject],'A change to another episode preserves the default sorting');
near.episodes[1].roles=roles(9,8);
assert.deepEqual(sorted(),[complete,near,smallHalf,half,zero,blankProject],'Adding roles to the current episode restores progress sorting');
near.episodes[1].roles=roles(9,9);
assert.deepEqual(sorted().slice(0,2),[complete,near],'Recompute progress when role statuses change');
zero.episodes[0].roles=roles(10,10);
assert.ok(sorted().indexOf(zero)<sorted().indexOf(half),'Updated roles move a project ahead');
assert.deepEqual(selectProjects(projectState,{sort:'progress',filter:'favorite'}),[zero,blankProject]);
assert.ok(selectProjects(projectState,{sort:'name'})[0].favorite,'Other sorts retain pinned favorites');

// Exercise the real renderCard template with helper functions in isolation.
const app=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
const begin=app.indexOf('function projectEpisodePicker(p,episode){');
const end=app.indexOf('// Collapsible project strips',begin);
assert.ok(begin>=0&&end>begin,'Project card function exists');
const renderSource=app.slice(begin,end);
const progressEpisodes=new Map();
const {renderCard:display,renderProjectListRow}=new Function('projectRoleProgress','projectProgressEpisodes','options','e','episodeLabel','projectArt','badge','episodeAgeBadge','icon','dueClass','dueLabel','expandedProjectRoles','state','actorForRole','actorPickAvatar','safeRoleImage','roleStageName',
  renderSource+'; return {renderCard,renderProjectListRow};')(
  projectRoleProgress,progressEpisodes,
  (items,current)=>items.map(([id,label])=>`<option value="${id}" ${id===current?'selected':''}>${escapeHTML(label)}</option>`).join(''),
  escapeHTML,episodeLabel,
  ()=>'🖼',()=>'<span>Запись</span>',ep=>'<span data-age-episode="'+ep.number+'">11 дней</span>',
  ()=>'⬈',()=>'',()=>'',new Set(),{actors:[{id:'actor-5',name:'Test Actor',telegram:'test_actor',avatar:'data:image/png;base64,YQ=='}]},
  (state,r)=>state.actors.find(a=>a.id===r.actorId),a=>a?.avatar?'<img src="'+a.avatar+'">':a?.name||'?',v=>v||'',s=>s
);
function checkBar(markup,tone,accepted,total){
  const match=markup.match(/<progress class="project-progress-bar" data-progress="([^"]+)" value="(\d+)" max="(\d+)"/);
  assert.ok(match,'Expected a project progress bar');
  assert.deepEqual(match.slice(1),[tone,String(accepted),String(total||1)]);
}
for(const [accepted,tone] of [[0,'red'],[1,'red'],[2,'orange'],[3,'orange'],[4,'yellow'],[5,'yellow'],[6,'green'],[8,'green']]){
  project.episodes[1].roles=roles(8,accepted);
  checkBar(display(project),tone,accepted,8);
}
project.episodes[1].roles=roles(8,4);
let html=display(project);
assert.match(html,/data-progress="yellow"/);
assert.match(html,/class="project-accepted-count">4\/8/);
assert.match(html,/осталось <b>4<\/b>/);
assert.match(html,/Серия 12/);
assert.match(html,/aria-expanded="false"/);
assert.match(html,/aria-hidden="true" inert/);
assert.match(html,/Незавершённые роли · 4/);
assert.equal((html.match(/class="project-missing-role"/g)||[]).length,4);
assert.doesNotMatch(html,/data-role-id="role-0"/);
assert.match(html,/@test_actor/);
assert.match(html,/data:image\/png;base64,YQ==/);
assert.doesNotMatch(html,/15\/15/,'Do not display totals from older episodes');
project.episodes[1].roles=roles(8,5);
html=display(project);
assert.match(html,/data-progress="green"/);
assert.match(html,/class="project-accepted-count">5\/8/);
project.episodes[0].roles=roles(10,10);
project.episodes[1].roles=[];
html=display(project);
assert.match(html,/data-progress="none"/);
assert.match(html,/0 ролей/);
assert.doesNotMatch(html,/class="project-accepted-count"/,'A finished previous episode does not supply card totals');
assert.match(html,/value="e12" selected>Серия 12/);
assert.match(html,/data-age-episode="12"/);
assert.match(app,/episodeAgeBadge\(ep,true\)/,'List view also displays episode age');
assert.match(html,/Незавершённые роли · 0/);
assert.match(html,/Роли пока не добавлены/);
assert.doesNotMatch(html,/data-role-id=/);
checkBar(html,'none',0,0);
assert.match(html,/aria-valuetext="Роли серии пока не добавлены"/);
const blank={title:'Пустой',color:'violet',favorite:false,cover:'',episodes:[episode(2,0,0),episode(3,0,0)]};
html=display(blank);
assert.match(html,/data-progress="none"/);
assert.match(html,/0 ролей/);
assert.match(html,/Роли пока не добавлены/);
assert.doesNotMatch(html,/class="project-accepted-count"/);
project.episodes[1].roles=roles(8,4);
const reviewAdjusted=withRoleReviews({projects:[project]},[{actorId:'actor-4',roleId:'role-4',state:'accepted',submissionId:12}]).projects[0];
html=display(reviewAdjusted);
assert.match(html,/class="project-accepted-count">5\/8/,'Cloud-accepted role contributes to card count');
assert.doesNotMatch(html,/data-role-id="role-4"/,'Cloud accepted roles must not appear in the list');

const recover={...project,id:'recover',title:'Адский Рай 2 (Recover)',episodes:[
  episode(1,24,12),episode(2,0,0,'unset'),episode(3,0,0,'unset')
]};
html=display(recover);
assert.match(html,/value="e3" selected>Серия 03/);
assert.match(html,/0 ролей/);
assert.equal((html.match(/<option /g)||[]).length,3,'Every existing episode can be selected');
progressEpisodes.set(recover.id,'e1');
html=display(recover);
assert.match(html,/value="e1" selected>Серия 01/);
assert.match(html,/data-age-episode="1"/);
assert.match(html,/data-action="open-project" data-id="recover" data-ep="e1"/);
assert.match(html,/project-accepted-count">12\/24/);
assert.match(html,/осталось <b>12<\/b>/);
assert.match(html,/Незавершённые роли · 12/);
assert.equal((html.match(/class="project-missing-role"/g)||[]).length,12);
assert.doesNotMatch(html,/data-role-id="role-0"/);
const updatedRecover=withRoleReviews({projects:[recover]},[
  {actorId:'actor-12',roleId:'role-12',state:'accepted',submissionId:12}
]).projects[0];
html=display(updatedRecover);
assert.match(html,/project-accepted-count">13\/24/);
assert.doesNotMatch(html,/data-role-id="role-12"/);
const listRow=renderProjectListRow(updatedRecover);
assert.match(listRow,/value="e1" selected>Серия 01/);
assert.match(listRow,/project-accepted-count">13\/24/);
checkBar(html,'yellow',13,24);
checkBar(listRow,'yellow',13,24);
assert.match(listRow,/aria-valuetext="54% · Принято 13 из 24"/);
assert.match(display(project),/value="e12" selected/,'Another project has its own selection');
recover.episodes[2].roles=roles(5,0);
html=display(recover);
assert.match(html,/project-accepted-count">12\/24/,'Newer roles leave a deliberate selection in place');
progressEpisodes.set(recover.id,'e3');
assert.match(display(recover),/project-accepted-count">0\/5/);
progressEpisodes.set(recover.id,'absent');
assert.match(display(recover),/value="e3" selected>Серия 03/);
assert.doesNotMatch(display({...recover,episodes:[recover.episodes[0]]}),/project-episode-select/,
  'A single episode is displayed without a redundant picker');

const section=(start,end)=>{
  const from=app.indexOf(start),to=app.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from);return app.slice(from,to);
};
let stored='{}',changeHandler;
const pass=value=>value??'all';
function session(){
  const context=vm.createContext({UIKEY:'test-ui',TASK_PRIORITIES:[['all']],validTaskOrder:pass,
    validMyRoleOrder:pass,validTaskStatusFilter:pass,validTaskLineFilter:pass,
    localStorage:{getItem:()=>stored,setItem:(_key,value)=>{stored=value;}},
    getProject:id=>id===recover.id?recover:null,
    document:{addEventListener:(_event,handler)=>{changeHandler=handler;}},
    render(){},requestAnimationFrame(){}});
  vm.runInContext('const projectProgressEpisodes=new Map();const collapsedRoleTiers=new Map();'+
    section('let ui=','const app=')+section('function saveUI(){','function navigate(page)')+
    section("document.addEventListener('change',event=>{const el=event.target;","  if(el.id==='bulk-task-select-all'){")+'});'+
    'globalThis.selection=id=>projectProgressEpisodes.get(id);',context);
  return context;
}
const firstSession=session();
const choose=value=>changeHandler({target:{classList:{contains:key=>key==='project-episode-select'},
  dataset:{id:recover.id},value}});
choose('e1');
assert.equal(firstSession.selection(recover.id),'e1');
choose('other-project-episode');
assert.equal(session().selection(recover.id),'e1','Persist only existing series for the selected project');

assert.match(css,/grid-template-rows:0fr/);
assert.match(css,/grid-template-rows:1fr/);
assert.match(app,/selectProjects\(withRoleReviews\(state,cloud.reviews\|\|\[\]\)/,'Project cards must use cloud-adjusted statuses');
for(const tone of ['red','yellow','green','none']){
  assert.ok(css.includes('.project-role-progress[data-progress="'+tone+'"]'),'Missing progress style for '+tone);
}
for(const tone of ['red','orange','yellow','green']){
  assert.ok(css.includes('.project-progress-bar[data-progress="'+tone+'"]'),'Missing bar color for '+tone);
}
assert.match(app,/import \{[\s\S]*projectRoleProgress[\s\S]*\} from '\.\/core\.js'/);
console.log('PASS: per-project episode picker, persistence, card and list progress, sorting and cloud review counts');
