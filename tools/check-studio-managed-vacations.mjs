import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync('package/web/app.js','utf8');
const vacations=readFileSync('package/StudioVacations.cs','utf8');
const local=readFileSync('package/LocalServer.cs','utf8');
const css=readFileSync('package/web/compact.css','utf8');
for(const expected of [
  "data-action=\"studio-vacation-new\"",
  "case 'studio-vacation-new':studioVacationForm()",
  "case 'studio-vacation-edit':studioVacationForm(d.actor)",
  "case 'studio-vacation-end':await studioVacationEnd(d.actor)",
  "cloud/vacations/manage",
  "action:current?'update':'start'",
  "action:'end',actorId",
  "state.actors||[]",
  "reason:data.reason||''",
  "modal.close();render()"
])assert.ok(app.includes(expected),'Missing owner UI wiring: '+expected);
assert.ok(app.includes("Отпуск может назначить руководитель даже без регистрации актёра"));
assert.ok(vacations.includes('SyncNow(false);'),'New actor profiles must sync before marking vacation');
assert.ok(vacations.includes('RefreshVacations(true);'),'Owner changes must appear immediately');
assert.ok(vacations.includes('/v1/studio/actors/'),'Owner API must address actor IDs');
assert.ok(local.includes('route=="cloud/vacations/manage"'),'Local actions require app session token');
assert.ok(css.includes('.studio-vacation-actions'));
console.log('PASS: Studio owner vacation creation, editing, ending and actor ID binding');
