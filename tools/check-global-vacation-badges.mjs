import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync('package/web/app.js','utf8');
const cloud=readFileSync('package/StudioVacations.cs','utf8');
const compact=readFileSync('package/web/compact.css','utf8');
const expected=[
  ['shared vacation resolver',"const vacationFor=id=>"],
  ['active and planned status',"const vacationTag=id=>"],
  ['badge renders dates',"v.startDate?' · с '"],
  ['debt cards',"${vacationTag(actor?.id)}</span></div><div class=\"debt-card-role\""],
  ['debt actor filter',"${vacationTag(item.actor?.id)}</span>"],
  ['task rows',"${vacationTag(linked.actorId)}</td>"],
  ['task actor filter',"a.name+vacationOptionSuffix(a.id)"],
  ['task assignment actor options',"${e(vacationOptionSuffix(a.id))}</option>"],
  ['episode role filter',"vacationOptionSuffix(a.key.startsWith('id:')?a.key.slice(3):'')"],
  ['actor roster cards',"function actorCard(a)"],
  ['actor roster badge',"${vacationTag(a.id)}</div>"],
  ['actor portal cards',"function renderActorPortal()"],
  ['actor portal badge',"${vacationTag(a.id)}${a.telegram?"],
  ['role table',"function rolesTable(rows,global=false)"],
  ['role table badge',"${vacationTag(r.actorId)}</td>"],
  ['unassigned actor badge',"${vacationTag(actor.id)}</div>"],
  ['actor details modal',"${actorAvatar(a,true)}${vacationTag(a.id)}"],
  ['actor portal role preview',"${vacationTag(id)}${rows}</div>"],
  ['password recovery actors',"${vacationTag(row.actorId)}"],
  ['role picker upcoming vacation',"'◷ Отпуск запланирован'"],
];
for(const [name,needle] of expected) assert.ok(app.includes(needle),'Missing vacation visibility in '+name);
assert.ok(app.includes('if(renderPage&&changed'), 'Cloud changes should trigger re-render');
assert.ok(app.includes('||vacationsChanged||'), 'Vacation changes must refresh all pages including tasks');
assert.ok(cloud.includes('RefreshVacations(true);'), 'Owner edits refresh vacation data immediately');
assert.ok(compact.includes('.studio-vacation-tag.active'), 'Active vacation badge must have distinct styling');
console.log('PASS: vacation availability visible across Studio lists, filters and actor details');
