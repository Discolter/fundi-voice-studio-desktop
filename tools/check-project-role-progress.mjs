import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {latestProjectEpisode,latestEpisodeRoleProgress,withRoleReviews,selectProjects} from '../package/web/core.js';

const roles=(total,accepted)=>Array.from({length:total},(_,i)=>({
  id:'role-'+i,actorId:'actor-'+i,status:i<accepted?'done':'waiting',character:'Актёр '+i
}));
const episode=(number,total,accepted,stage='record')=>({id:'e'+number,number:String(number),stage,roles:roles(total,accepted)});
const project={title:'Тестовый тайтл',color:'violet',favorite:false,cover:'',episodes:[
  episode(8,10,4), episode(12,8,4), episode(3,15,15)
]};
assert.equal(latestProjectEpisode(project).number,'12','Choose the highest numbered episode, not the last array entry');
assert.deepEqual(latestEpisodeRoleProgress(project),{
  episode:project.episodes[1],total:8,accepted:4,remaining:4,tone:'yellow'
},'Exactly half complete is yellow unless only 3 roles are left');
project.episodes[1].roles=roles(8,3);
assert.equal(latestEpisodeRoleProgress(project).tone,'red','Less than half is red');
project.episodes[1].roles=roles(8,5);
assert.equal(latestEpisodeRoleProgress(project).tone,'green','3 remaining takes precedence over yellow');
project.episodes[1].roles=roles(10,6);
assert.equal(latestEpisodeRoleProgress(project).tone,'yellow','More than 3 remaining is still yellow');
project.episodes[1].roles=roles(10,10);
assert.equal(latestEpisodeRoleProgress(project).tone,'green','Fully accepted is green');
project.episodes[1].roles=roles(4,0);
assert.equal(latestEpisodeRoleProgress(project).tone,'red','4 unaccepted roles are red');
project.episodes[1].roles=roles(3,0);
assert.equal(latestEpisodeRoleProgress(project).tone,'green','3 unaccepted roles follow requested green threshold');
project.episodes[1].roles=[];
assert.deepEqual(latestEpisodeRoleProgress(project),{episode:project.episodes[0],total:10,accepted:4,remaining:6,tone:'red'},'Empty latest series falls back to last staffed series');
assert.equal(latestEpisodeRoleProgress({episodes:[episode(1,0,0),episode(2,0,0)]}).tone,'none','All-empty project remains neutral');
const recover={episodes:[episode(1,0,0),episode(2,24,4),episode(3,0,0)]};
assert.equal(latestEpisodeRoleProgress(recover).episode.number,'2','New blank episode must preserve earlier recording progress');
project.episodes[1].roles=[{status:'received'},{status:'retake'},{status:'processing'},{status:'done'}];
assert.equal(latestEpisodeRoleProgress(project).accepted,1,'Only accepted (done) roles count');
project.episodes[1].stage='done'; // Stage has no influence on latest-series selection.
assert.equal(latestProjectEpisode(project).number,'12');
const ties={episodes:[episode(4,1,0),episode(4,1,1)]};
assert.strictEqual(latestProjectEpisode(ties),ties.episodes[1],'For equal episode numbers take the last entry');
assert.equal(latestEpisodeRoleProgress({episodes:[]}).tone,'none');
const before=JSON.stringify(project);
latestEpisodeRoleProgress(project);
assert.equal(JSON.stringify(project),before,'Reading progress must never modify saved project state');

// Progress sorting follows the same episode and accepted statuses as the cards.
const sortable=(title,total,accepted,favorite=false)=>({
  title, favorite, archived:false, hidden:false,
  episodes:[{...episode(1,total,accepted),resources:[],tasks:[]}]
});
const complete=sortable('Готовый',5,5),near=sortable('Почти',9,8),
  half=sortable('Половина',100,50),smallHalf=sortable('Мало',4,2),
  zero=sortable('Начатый',10,0,true),blankProject=sortable('Пустой',0,0,true);
near.episodes.push({...episode(2,0,0),resources:[],tasks:[]});
const projectState={projects:[half,zero,blankProject,near,smallHalf,complete]};
const sorted=()=>selectProjects(projectState,{sort:'progress'});
assert.deepEqual(sorted(),[complete,near,smallHalf,half,zero,blankProject],
  'Sort by accepted fraction, remaining roles, and put empty projects last regardless of favorites');
near.episodes[0].roles=roles(9,9);
assert.deepEqual(sorted().slice(0,2),[complete,near],'Recompute progress when role statuses change');
zero.episodes[0].roles=roles(10,10);
assert.ok(sorted().indexOf(zero)<sorted().indexOf(half),'Updated roles move a project ahead');
assert.deepEqual(selectProjects(projectState,{sort:'progress',filter:'favorite'}),[zero,blankProject]);
assert.ok(selectProjects(projectState,{sort:'name'})[0].favorite,'Other sorts retain pinned favorites');

// Exercise the real renderCard template with helper functions in isolation.
const app=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
const begin=app.indexOf('function renderCard(p){');
const end=app.indexOf('// Collapsible project strips',begin);
assert.ok(begin>=0&&end>begin,'Project card function exists');
const renderSource=app.slice(begin,end);
const display=new Function('latestEpisodeRoleProgress','latestProjectEpisode','e','episodeLabel','projectArt','badge','episodeAgeBadge','icon','dueClass','dueLabel','expandedProjectRoles','state','actorForRole','actorPickAvatar','safeRoleImage','roleStageName',
  renderSource+'; return renderCard;')(
  latestEpisodeRoleProgress,latestProjectEpisode,
  value=>String(value).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])),
  (_p,ep)=>'Серия '+ep.number,
  ()=>'🖼',()=>'<span>Запись</span>',ep=>'<span data-age-episode="'+ep.number+'">11 дней</span>',
  ()=>'⬈',()=>'',()=>'',new Set(),{actors:[{id:'actor-5',name:'Test Actor',telegram:'test_actor',avatar:'data:image/png;base64,YQ=='}]},
  (state,r)=>state.actors.find(a=>a.id===r.actorId),a=>a?.avatar?'<img src="'+a.avatar+'">':a?.name||'?',v=>v||'',s=>s
);
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
project.episodes[1].roles=[];
html=display(project);
assert.match(html,/data-progress="red"/);
assert.match(html,/class="project-accepted-count">4\/10/);
assert.match(html,/project-progress-source/);
assert.match(html,/Серия 8:/,'Label the episode used for role progress');
assert.match(html,/card-meta">Серия 12/,'Keep latest episode in card subtitle');
assert.match(html,/data-age-episode="12"/,'Age follows newest episode even if its roles are still empty');
assert.match(app,/episodeAgeBadge\(ep,true\)/,'List view also displays episode age');
assert.match(html,/Незавершённые роли · 6/);
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
assert.match(css,/grid-template-rows:0fr/);
assert.match(css,/grid-template-rows:1fr/);
assert.match(app,/selectProjects\(withRoleReviews\(state,cloud.reviews\|\|\[\]\)/,'Project cards must use cloud-adjusted statuses');
for(const tone of ['red','yellow','green','none']){
  assert.ok(css.includes('.project-role-progress[data-progress="'+tone+'"]'),'Missing progress style for '+tone);
}
assert.match(app,/import \{[\s\S]*latestEpisodeRoleProgress[\s\S]*\} from '\.\/core\.js'/);
console.log('PASS: last staffed episode fallback, cloud review counts, card episode label, thresholds and empty state');
