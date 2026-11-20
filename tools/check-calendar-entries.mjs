import assert from 'node:assert/strict';
import {calendarLinkKey, normalizeCalendarEntry, normalizeCalendarLink, normalizeState, seedState} from '../package/web/core.js';
import {buildTaskSnapshot} from '../package/web/task-cloud-sync.js';

const {calendarEntries: legacyEntries, ...legacy} = seedState();
assert.deepEqual(legacyEntries, []);
assert.deepEqual(normalizeState(legacy).calendarEntries, []);

const project = {kind:'project',id:'project-1',label:'Первый проект'};
const actor = {kind:'actor',id:'actor-1',label:'Актёр',detail:'@voice'};
const role = {kind:'role',id:'role-1',projectId:'project-1',episodeId:'episode-1',label:'Персонаж'};
const roleFolder = {...role,kind:'material',id:'role-folder:role-1',label:'Персонаж · голос'};
const web = {kind:'url',url:'https://example.com',label:'Созвон'};
const record = {
  id:'event-1',title:'  Перезапись  ',date:'2028-02-29',time:'17:45',notes:'Первые две сцены\nПроверить шум в паузах',
  links:[project,actor,role,role,roleFolder,web,{...web,url:'https://example.com/'},
    {kind:'url',url:'javascript:void(0)'},{kind:'role',id:'orphan'}]
};
const clean = normalizeCalendarEntry(record);
assert.equal(clean.title, 'Перезапись');
assert.equal(clean.time, '17:45');
assert.equal(clean.date, '2028-02-29');
assert.equal(clean.notes, record.notes);
assert.equal(clean.links.length, 5);
assert.deepEqual(clean.links.map(link=>link.kind), ['project','actor','role','material','url']);
assert.equal(clean.links.at(-1).url, 'https://example.com/');
assert.equal(clean.links.find(link=>link.kind==='role').episodeId, 'episode-1');
assert.notEqual(calendarLinkKey(clean.links[2]), calendarLinkKey(clean.links[3]));
assert.equal(normalizeCalendarEntry({...record,date:'2026-02-29'}), null);
assert.equal(normalizeCalendarEntry({...record,time:'25:00'}).time, '');
assert.equal(normalizeCalendarEntry({...record,title:'   '}), null);
assert.equal(normalizeCalendarLink({kind:'url',url:'https://user:pass@example.com/'}), null);
assert.equal(normalizeCalendarLink({kind:'url',url:'file:///some-file.txt'}), null);

const loaded = normalizeState({...legacy,calendarEntries:[record,{...record,date:'2028-03-01'}]});
assert.equal(loaded.calendarEntries.length, 2);
assert.notEqual(loaded.calendarEntries[0].id, loaded.calendarEntries[1].id);
assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(loaded))).calendarEntries, loaded.calendarEntries);
assert.equal(Object.hasOwn(buildTaskSnapshot(loaded),'calendarEntries'), false);
console.log('PASS manual calendar entries, links, legacy workspaces, local backups and Cloud snapshot privacy');
