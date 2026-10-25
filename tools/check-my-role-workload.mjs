import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {myRoleLineCount,myRoleWorkloadColor,summarizeMyRoleEpisodes,
        sortMyRoleGroups,MY_ROLE_ORDERS,validMyRoleOrder} from '../package/web/my-role-workload.js';

assert.deepEqual(MY_ROLE_ORDERS.map(x=>x[0]),['original','linesDesc','linesAsc']);
assert.equal(validMyRoleOrder('nonsense'),'original');
for(const [input,color] of [[0,'low'],[50,'low'],[51,'medium'],[100,'medium'],[101,'high'],[1025,'high'],[null,'unknown'],[undefined,'unknown'],['50','unknown'],[-1,'unknown']])
  assert.equal(myRoleWorkloadColor(input),color,'Workload boundary '+String(input));
assert.equal(myRoleLineCount(null),null);
assert.equal(myRoleLineCount(0),0);

const first={id:'ep1',number:'1',title:'Начало'},second={id:'ep2',number:'2',title:'Дальше'};
const r=(ep,id,lineCount)=>({ep,r:{id,character:id,lineCount}});
const itemsA=[r(second,'c',100),r(first,'a',50),r(first,'b',101)];
const summary=summarizeMyRoleEpisodes(itemsA);
assert.deepEqual(summary.episodes.map(g=>g.ep.id),['ep1','ep2'],'Episodes must render in natural order');
assert.deepEqual(summary.episodes.map(g=>g.total),[151,100]);
assert.equal(summary.total,251,'Anime total sums every assigned role in every episode');
assert.equal(summary.unknown,0);
assert.equal(summary.episodes[0].items.length,2,'All roles in one episode must be visible');
const unknown=summarizeMyRoleEpisodes([r(first,'unset',null),r(first,'zero',0)]);
assert.equal(unknown.total,0);
assert.equal(unknown.unknown,1,'Unknown count is never silently interpreted as zero');
assert.equal(unknown.episodes[0].unknown,1);
assert.equal(summarizeMyRoleEpisodes([]).total,0);
const groups=[
  {p:{id:'a'},items:itemsA}, // 251 lines across two episodes
  {p:{id:'b'},items:[r(first,'small',23)]},
  {p:{id:'c'},items:[r(first,'unset',null),r(first,'known',500)]},
  {p:{id:'d'},items:[r(first,'many',102)]},
  {p:{id:'e'},items:[r(first,'same',102)]}
];
const groupIds=arr=>arr.map(x=>x.p.id);
assert.deepEqual(groupIds(sortMyRoleGroups(groups,'linesDesc')),['a','d','e','b','c'],
  'Largest complete sum first, incomplete projects last');
assert.deepEqual(groupIds(sortMyRoleGroups(groups,'linesAsc')),['b','d','e','a','c'],
  'Smallest complete sum first, stable ties, incomplete totals last');
assert.deepEqual(groupIds(sortMyRoleGroups(groups,'original')),['a','b','c','d','e'],
  'Original project order remains stable');
assert.deepEqual(groupIds(groups),['a','b','c','d','e'],'Sort must not mutate source groups');

const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../package/web/compact.css',import.meta.url),'utf8');
const visual=readFileSync(new URL('../package/web/visual-selects.js',import.meta.url),'utf8');
const host=readFileSync(new URL('../package/LocalServer.cs',import.meta.url),'utf8');
for(const marker of ['myRoleSummaryHTML(p,items)','my-role-summary-episode','my-role-inline-role',
  'my-role-lines-pill workload-','myRoleWorkloadColor(n)','summary.episodes.map(',
  "sortMyRoleGroups([...groups.values()],ui.myRoleOrder)",'my-role-summary-total workload-',
  "id=\"my-role-order\"","if(el.id==='my-role-order')","ui.myRoleOrder=validMyRoleOrder(saved.myRoleOrder)",
  'myRoleOrder:ui.myRoleOrder','myRolesExpanded.has(p.id)'])
 assert.ok(app.includes(marker),'Missing read-only role summary or sorting wiring: '+marker);
assert.ok(app.includes("const isOpen=myRolesExpanded!==null&&myRolesExpanded.has(p.id)"),
  'All role names must be visible without opening every anime');
assert.ok(host.includes('"/my-role-workload.js"'), 'Localhost must serve new module before any Studio release');
assert.ok(visual.includes("select.id === 'my-role-order'"));
for(const name of ['workload-low','workload-medium','workload-high','workload-unknown',
    '.my-role-inline-list','.my-role-sort-toolbar','body[data-theme=light] .my-role-lines-pill.workload-high'])
 assert.ok(css.includes(name),'Missing styling: '+name);
console.log('PASS: personal role chips, episode subtotals, incomplete totals and stable workload sort');
