import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {latestProjectEpisode,latestEpisodeRoleProgress} from '../package/web/core.js';

const roles=(total,accepted)=>Array.from({length:total},(_,i)=>({
  id:'role-'+i,status:i<accepted?'done':'waiting',character:'Актёр '+i
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
assert.deepEqual(latestEpisodeRoleProgress(project),{episode:project.episodes[1],total:0,accepted:0,remaining:0,tone:'none'},'Empty series is neutral, not complete');
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

// Exercise the real renderCard template with helper functions in isolation.
const app=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
const begin=app.indexOf('function renderCard(p){');
const end=app.indexOf('// Collapsible project strips',begin);
assert.ok(begin>=0&&end>begin,'Project card function exists');
const renderSource=app.slice(begin,end);
const display=new Function('latestEpisodeRoleProgress','e','episodeLabel','projectArt','badge','ageBadge','icon','dueClass','dueLabel',
  renderSource+'; return renderCard;')(
  latestEpisodeRoleProgress,
  value=>String(value).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])),
  (_p,ep)=>'Серия '+ep.number,
  ()=>'🖼',()=>'<span>Запись</span>',()=>'<span>11 дней</span>',
  ()=>'⬈',()=>'',()=>''
);
project.episodes[1].roles=roles(8,4);
let html=display(project);
assert.match(html,/data-progress="yellow"/);
assert.match(html,/class="project-accepted-count">4\/8/);
assert.match(html,/осталось <b>4<\/b>/);
assert.match(html,/Серия 12/);
assert.doesNotMatch(html,/15\/15/,'Do not display totals from older episodes');
project.episodes[1].roles=roles(8,5);
html=display(project);
assert.match(html,/data-progress="green"/);
assert.match(html,/class="project-accepted-count">5\/8/);
project.episodes[1].roles=[];
html=display(project);
assert.match(html,/data-progress="none"/);
assert.match(html,/0 ролей/);
assert.doesNotMatch(html,/class="project-accepted-count"/);
for(const tone of ['red','yellow','green','none']){
  assert.ok(css.includes('.project-role-progress[data-progress="'+tone+'"]'),'Missing progress style for '+tone);
}
assert.match(app,/import \{[\s\S]*latestEpisodeRoleProgress[\s\S]*\} from '\.\/core\.js'/);
console.log('PASS: latest numbered episode, accepted-only counts, thresholds, remaining count, compact card markup and empty state');
