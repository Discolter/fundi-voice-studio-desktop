import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STUDIO_PROJECTS_FOLDER} from '../package/web/file-browser.js';
const js=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
const browser=readFileSync('package/web/file-browser.js','utf8');
assert.equal(STUDIO_PROJECTS_FOLDER,String.raw`C:\Users\Mayak\Desktop\FundiVoice\Текущие проекты`);
for(const term of ['actorRegistrationFilter','actor-registration-filter','reg.state===ui.actorRegistrationFilter',
 "registration.state==='yes'",'account.registered===true'])assert.ok(js.includes(term),term);
assert.ok(browser.includes("load(STUDIO_PROJECTS_FOLDER,'',true)"));
assert.ok(browser.includes('if(firstAttempt){await load('));
for(const term of ['body[data-theme^="living-"] .cast-table tbody tr.role-row','var(--row-accent) 18%,var(--panel)','var(--panel);'])assert.ok(css.includes(term),term);
console.log('PASS: Studio registration filters, opaque gradients and preferred file browser directory.');
