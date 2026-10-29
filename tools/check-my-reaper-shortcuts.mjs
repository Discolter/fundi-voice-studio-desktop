import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const helperSource=source.match(/function reaperShortcutButton\([\s\S]*?\r?\n}\r?\n/)?.[0];
assert.ok(helperSource,'REAPER shortcut helper is present');

const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const button=new Function('icon','e','episodeLabel',helperSource+'; return reaperShortcutButton;')(
  name=>'<svg>'+name+'</svg>',escape,(project,episode)=>'Серия '+episode.number
);
const project={id:'anime-a',title:'Аниме A'};
const episode1={id:'ep-one',number:'01',paths:{reaper:'C:\\Voice\\one.rpp'},resources:[]};
const episode2={id:'ep-two',number:'02',paths:{},resources:[]};
const first=button(project,episode1);
const second=button(project,episode2,true);

assert.match(first,/data-action="quick-reaper"/);
assert.match(first,/data-id="anime-a" data-ep="ep-one"/);
assert.match(first,/Открыть проект REAPER/);
assert.match(first,/>REAPER<\/button>/);
assert.match(second,/data-id="anime-a" data-ep="ep-two"/);
assert.match(second,/Привязать проект REAPER/);
assert.match(second,/class="icon-btn task-reaper-shortcut"/);

const multiple=button(project,{id:'ep-three',number:'03',paths:{},resources:[
  {kind:'reaper',path:'C:\\one.rpp'},{kind:'reaper',path:'C:\\two.rpp'}
]},true);
assert.match(multiple,/Выбрать проект REAPER/);

// Each role and task uses its own episode, never currentEpisode(project).
const roleSection=source.slice(source.indexOf('function groupedMyRoles('),source.indexOf('function renderMyTasks('));
const taskSection=source.slice(source.indexOf('function tasksTable('),source.indexOf('function actorAvatar('));
assert.match(roleSection,/\$\{reaperShortcutButton\(p,ep\)\}/);
assert.match(taskSection,/\$\{reaperShortcutButton\(p,ep,true\)\}/);
assert.match(source,/case 'quick-reaper':\{const target=d\.ep\?ep:currentEpisode\(p\)/);

console.log('Personal role and task REAPER shortcuts: OK');
