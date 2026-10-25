import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMyRoleAccepted,myRoleWorkloadColor,summarizeMyRoleEpisodes} from '../package/web/my-role-workload.js';
import {roleStageName} from '../package/web/core.js';

for(const status of ['waiting','recording','received','processing','retake','processed','unknown',null,undefined])
  assert.equal(isMyRoleAccepted({status}),false,'Only Принято roles must turn green, not '+status);
assert.equal(isMyRoleAccepted({status:'done'}),true);
assert.equal(isMyRoleAccepted(null),false);
assert.equal(roleStageName('done'),'Принято');

const ep={id:'ep',number:'1'},items=[
 {ep,r:{character:'Роль принята',status:'done',lineCount:129}},
 {ep,r:{character:'Роль не принята',status:'processing',lineCount:30}}
];
assert.equal(summarizeMyRoleEpisodes(items).total,159,'Accepted roles stay in workload totals');
assert.equal(myRoleWorkloadColor(items[0].r.lineCount),'high','Count colors independent of accepted status');
assert.equal(myRoleWorkloadColor(items[1].r.lineCount),'low');

const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../package/web/compact.css',import.meta.url),'utf8');
const summary=app.slice(app.indexOf('function myRoleSummaryHTML('),app.indexOf('function renderMyTasks(){'));
assert.ok(summary.includes("isMyRoleAccepted(r)?'my-role-accepted':''"),
 'Accepted status must color the summary chip, not other roles');
assert.ok(summary.includes('title="Принято" aria-label="Роль принята"'),
 'Color should be backed by an explicit tooltip and accessible status');
assert.ok(summary.includes("r.character+' · '+(n===null?"),
 'Character tooltip should still show its count');
assert.ok(summary.includes('my-role-lines-pill workload-${myRoleWorkloadColor(n)}'),
 'Numeric pills must still use workload colors (green/yellow/red)');
assert.ok(summary.includes("isMyRoleAccepted(r)?'my-role-accepted-card':''"),
 'Expanded accepted cards must have a matching highlight');
assert.match(css,/\.my-role-inline-role\.my-role-accepted\{/,
 'Only accepted character chips get a green completion color');
assert.match(css,/\.my-role-card\.my-role-accepted-card\{/,
 'Expanded accepted role cards need the same completion accent');
for(const v of ['body[data-theme=light] .my-role-inline-role.my-role-accepted',
                 'body[data-theme=silver] .my-role-inline-role.my-role-accepted',
                 '.my-role-accepted-mark svg'])
 assert.ok(css.includes(v),'Expected accessible theme/status styles: '+v);
assert.equal(summary.includes('my-role-group-summary'),true,'Anime summary remains accessible without expansion');
console.log('PASS: only accepted roles get green labels and check marks; line workload colors stay intact');
