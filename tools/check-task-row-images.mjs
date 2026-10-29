import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeState,seedState,newProject,taskAssignment} from '../package/web/core.js';

const source=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../package/web/task-priorities.css',import.meta.url),'utf8');
const definitions=['taskProjectVisual','taskActorVisual','taskCharacterVisual'].map(name=>{
  const re=new RegExp('function '+name+'\\([\\s\\S]*?\\r?\\n}\\r?\\n');
  const match=source.match(re);
  assert.ok(match,'Missing visual helper: '+name);
  return match[0];
}).join('\n');
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validImage=s=>typeof s==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(s)?s:'';
const visuals=new Function('e','projectArt','safeCover','safeRoleImage','icon','episodeLabel',
  definitions+'; return {taskProjectVisual,taskActorVisual,taskCharacterVisual};')(
    escapeHTML,
    p=>p.cover?'<img class="project-poster" src="'+escapeHTML(p.cover)+'">':'<span class="mini-emblem">★</span>',
    validImage,validImage,
    kind=>'<svg>'+kind+'</svg>',
    (p,ep)=>'Сезон '+p.season+' · Серия '+String(ep.number).padStart(2,'0')
);
const cover='data:image/png;base64,AQID';
const avatar='data:image/webp;base64,AQID';
const roleImage='data:image/jpeg;base64,AQID';
const workspace=seedState();
workspace.actors=[{id:'act1',name:'Кана',avatar,telegram:'kana'}];
const p=newProject({id:'anime',title:'Re:Zero & Friends',season:'4',cover});
const ep=p.episodes[0];ep.id='ep6';ep.number='06';
ep.roles=[{id:'m1',character:'Мэйли',actorId:'act1',actor:'Кана',image:roleImage,status:'waiting',lineCount:1}];
ep.tasks=[{id:'t1',title:'Задача',actorId:'act1',roleId:'m1',priority:'normal'}];
workspace.projects=[p];
const restored=normalizeState(workspace);
const project=restored.projects[0],episode=project.episodes[0],linked=taskAssignment(restored,episode,episode.tasks[0]);

const proj=visuals.taskProjectVisual(project,episode);
assert.match(proj,/task-project-image/);
assert.match(proj,/data-action="open-project" data-id="anime" data-ep="ep6"/);
assert.match(proj,/data:image\/png;base64,AQID/);
assert.match(proj,/Re:Zero &amp; Friends/);
assert.match(proj,/Сезон 4 · Серия 06/);
const person=visuals.taskCharacterVisual(project,episode,linked,'Мэйли');
assert.match(person,/task-character-image/);
assert.match(person,/data-qv-open="role" data-qv-project="anime" data-qv-episode="ep6" data-qv-role="m1"/);
assert.match(person,/data:image\/jpeg;base64,AQID/);
assert.match(person,/Мэйли/);
const act=visuals.taskActorVisual(linked);
assert.match(act,/task-actor-image/);
assert.match(act,/data-qv-open="actor" data-qv-actor="act1"/);
assert.match(act,/data:image\/webp;base64,AQID/);
assert.match(act,/Кана/);

// The next render reuses the live role/actor data without duplicating photos in tasks.
episode.roles[0].image='';
restored.actors[0].avatar='';
let updated=taskAssignment(restored,episode,episode.tasks[0]);
assert.match(visuals.taskCharacterVisual(project,episode,updated,'Мэйли'),/task-character-placeholder/);
assert.match(visuals.taskActorVisual(updated),/task-actor-initials/);
project.cover='';
assert.match(visuals.taskProjectVisual(project,episode),/mini-emblem/);
assert.doesNotMatch(visuals.taskProjectVisual(project,episode),/project-poster/);

// Legacy/unlinked tasks keep visible fallback icons without broken or dead buttons.
const unlinked=taskAssignment(restored,episode,{title:'Без назначения'});
assert.match(visuals.taskActorVisual(unlinked),/task-identity-unlinked/);
assert.doesNotMatch(visuals.taskActorVisual(unlinked),/data-qv-open="actor"/);
assert.match(visuals.taskCharacterVisual(project,episode,unlinked,'—'),/task-identity-unlinked/);
assert.doesNotMatch(visuals.taskCharacterVisual(project,episode,unlinked,'—'),/data-qv-open="role"/);

// Invalid image data must never appear as an unsanitized image URL.
restored.actors[0].avatar='javascript:alert(1)';
episode.roles[0].image='javascript:alert(2)';
updated=taskAssignment(restored,episode,episode.tasks[0]);
assert.doesNotMatch(visuals.taskActorVisual(updated),/javascript:/);
assert.doesNotMatch(visuals.taskCharacterVisual(project,episode,updated,'Мэйли'),/javascript:/);

const table=source.slice(source.indexOf('function tasksTable('),source.indexOf('function actorAvatar('));
assert.match(table,/\$\{taskProjectVisual\(p,ep\)\}/);
assert.match(table,/\$\{taskActorVisual\(linked\)\}/);
assert.match(table,/\$\{taskCharacterVisual\(p,ep,linked,character\)\}/);
assert.match(table,/vacationTag\(linked\.actorId\)/);
assert.match(table,/reaperShortcutButton\(p,ep,true\)/);
assert.match(table,/task-bulk-checkbox/);
for(const cls of ['.task-project-image','.task-actor-image','.task-character-image','.task-identity-copy']){
  assert.ok(css.includes(cls),'Missing thumbnail layout: '+cls);
}
console.log('PASS: project covers, actor avatars, role portraits, fallbacks, live task links and visual controls');
