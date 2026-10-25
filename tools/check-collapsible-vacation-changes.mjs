import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../package/web/compact.css',import.meta.url),'utf8');
const start=app.indexOf('let vacationChangesExpanded=false;');
const end=app.indexOf('function renderCloudConnection(){',start);
assert.ok(start>=0&&end>start,'Vacation disclosure state and view must exist');
const section=app.slice(start,end);
const first=section.indexOf('studio-vacation-changes');
const details=section.slice(first);
assert.match(details,/<details class="studio-vacation-section studio-vacation-changes"/,
  'Vacation changes must use accessible native disclosure');
assert.match(details,/\$\{vacationChangesExpanded\?'open':''\}/,
  'Changes stay closed by default, but opened state survives re-render');
assert.match(details,/<summary class="studio-vacation-changes-summary">/,
  'Clickable summary is required');
assert.match(details,/Изменения <span>\$\{cloud\.vacationUnread\|\|0\} новых/,
  'Closed header must show the unread notification count');
assert.match(details,/\$\{events\.length\?\s*\`<div class="studio-vacation-list">/,
  'Event history remains inside the collapsible area');
assert.match(details,/Событий пока нет\.\<\/p\>'\}<\/details>\`;/,
  'Both filled and empty event lists must terminate native disclosure');
assert.match(app,/const changesSummary=event\.target\.closest\('\.studio-vacation-changes > summary'\);/,
  'Click handler must watch the collapsible section only');
assert.match(app,/if\(changesSummary\)vacationChangesExpanded=!changesSummary\.parentElement\.open;/,
  'Toggle state before native click so it survives refreshing the screen');
assert.match(css,/\.studio-vacation-changes:not\(\[open\]\)>:not\(summary\)\{display:none\}/,
  'Hidden event cards must not take vertical screen space');
assert.match(css,/\.studio-vacation-changes-summary:focus-visible/,
  'Keyboard focus must remain visible');
assert.match(css,/\.studio-vacation-changes\[open\]/,
  'Expanded header should have a visual indicator');
assert.ok(app.includes('html+=section(\'Сейчас в отпуске\',active)+section(\'Предстоящие отпуска\',planned);'),
  'Current and upcoming vacations must remain visible');
assert.ok(app.includes("html+=section('История отпусков'"),
  'The existing vacation history section must not be removed');
console.log('PASS: vacation changes collapse by default, retain unread count and preserve open state across refresh');
