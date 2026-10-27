import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
const nav=app.match(/const navs=\[[^\n]+/);
assert.ok(nav,'Primary Studio navigation must exist');
assert.doesNotMatch(nav[0],/recovery/,'Recovery must not remain in primary sidebar navigation');

const recovery=app.indexOf('class="nav-item studio-recovery-nav');
const vacations=app.indexOf('class="nav-item studio-vacation-nav');
const settings=app.indexOf('data-nav="settings"');
assert.ok(recovery>=0,'Recovery button must exist in the bottom navigation');
assert.ok(settings>=0&&settings<recovery&&recovery<vacations,'Recovery must follow Settings and immediately precede Vacations');
const sidebar=app.slice(app.indexOf('<div class="sidebar-bottom">'),app.indexOf('<div class="profile">'));
assert.ok(sidebar.includes('data-nav="recovery"'),'Recovery must be a clickable Studio-only nav button');
assert.equal(sidebar.split('data-nav="recovery"').length-1,1,'Recovery button must appear once');
assert.ok(sidebar.includes("${icon('password')}"),'Recovery must use the dedicated three-asterisk password icon');
assert.ok(app.includes("ICONS.password='M5 9v6"),'Password icon must be a three-asterisk SVG');
assert.ok(app.includes("ui.page==='recovery'?'Сброс пароля'"),'Recovery page title must remain correct');
assert.match(css,/\.studio-recovery-nav:is\(:hover,:focus-visible\)[^{]*\{[^}]*rgba\(235,54,83,/,'Recovery hover/focus must have a red glow');
assert.match(css,/\.studio-recovery-nav\.active/,'Selected recovery page should be visibly highlighted');
assert.ok(app.includes("if(ui.page==='recovery')return renderRecoveries()"),'Recovery content must remain reachable');
console.log('PASS: Recovery navigation is immediately above vacations with red hover and password icon');
