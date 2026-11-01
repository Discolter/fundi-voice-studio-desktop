import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAssCharacters,normalizeAssCharacter,previousAssEpisode,matchAssRole,applyAssCastImport,decodeAssFile} from '../package/web/ass-role-import.js';
import {seedState,newProject,newEpisode,normalizeState} from '../package/web/core.js';

const text='[Script Info]\nTitle: Mob Psycho\n[V4+ Styles]\nFormat: Name,Fontname\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'+
'Dialogue: 0,0:00:01.00,0:00:02.00,Default,Рейген Аратака,0,0,0,,Hello, Mob\n'+
'Dialogue: 0,0:00:03.00,0:00:05.00,Default,Моб,0,0,0,,Yes, master\n'+
'Dialogue: 0,0:00:06.00,0:00:07.00,Default,РЕЙГЕН АРАТАКА,0,0,0,,Words, words\n'+
'Dialogue: 0,0:00:08.00,0:00:09.00,Default,,0,0,0,,No name\n'+
'Comment: 0,0:00:10.00,0:00:11.00,Default,Ignore,0,0,0,,Comment only\n';
const parsed=parseAssCharacters(text);
assert.equal(parsed.characters.length,2);
assert.equal(parsed.characters[0].name,'Рейген Аратака');
assert.equal(parsed.characters[0].lineCount,2);
assert.equal(parsed.characters[1].lineCount,1);
assert.equal(parsed.dialogueCount,4);
assert.equal(parsed.unlabeled,1);
assert.equal(normalizeAssCharacter('  Рейген  Аратака '),normalizeAssCharacter('рейген аратака'));
assert.equal(normalizeAssCharacter('Ёж–Ёж'),normalizeAssCharacter('еж-еж'));
const ssa='[Events]\nFormat: Marked, Start, End, Style, Actor, MarginL, MarginR, MarginV, Effect, Text\nDialogue: Marked=0,0:00:00.00,0:00:02.00,Default,Папа,0,0,0,,Здравствуй, сын';
assert.equal(parseAssCharacters(ssa).characters[0].name,'Папа');
assert.throws(()=>parseAssCharacters('[Events]\nFormat: Layer,Start,End,Style,Text\nDialogue: 0,0:00,0:01,Default,Hello'),/Name\/Actor/);
assert.throws(()=>parseAssCharacters('[Events]\nFormat: Layer,Name,Text\nDialogue: 0,0,hey'),/пустое поле/);
assert.throws(()=>parseAssCharacters('[Script Info]\nTitle: No'),/\[Events\]/);
const cp1251=Uint8Array.from([0xcf,0xf0,0xe8,0xe2,0xe5,0xf2]);
const file={name:'episode.ass',size:cp1251.length,arrayBuffer:async()=>cp1251.buffer};
assert.equal(await decodeAssFile(file),'Привет');
const utf16bytes=Uint8Array.from([0xff,0xfe,0x41,0x00]);
assert.equal(await decodeAssFile({name:'one.ssa',size:utf16bytes.length,arrayBuffer:async()=>utf16bytes.buffer}),'A');
await assert.rejects(decodeAssFile({name:'something.srt',size:1,arrayBuffer:async()=>new ArrayBuffer(1)}),/\.ass/);

const state=seedState();
state.actors=[{id:'a',name:'Актёр А',telegram:'a'},{id:'b',name:'Актёр Б',telegram:'b'}];
const old=newEpisode({number:'1',roles:[
 {id:'old-a',character:'Рейген Аратака',actorId:'a',actor:'Актёр А',image:'data:image/png;base64,a',voiceGender:'male',mine:true,status:'done',lineCount:99,folder:'C:\\old',subtitle:'C:\\old.ass'},
 {id:'old-b',character:'Моб',actorId:'b',actor:'Актёр Б',status:'received',lineCount:42}
]});
const next=newEpisode({number:'2',roles:[]});
const project=newProject({title:'Mob Psycho 100',season:'1',episodes:[next,old]}); // Intentionally out of array order
state.projects=[project];
assert.equal(previousAssEpisode(project,next),old);
const original=JSON.stringify(old);
const preview=matchAssRole(state,project,next,parsed.characters[0]);
assert.equal(preview.actor.id,'a');
assert.equal(preview.existing,null);
let result=applyAssCastImport(state,project,next,parsed.characters);
assert.deepEqual({added:result.added,reused:result.reused,inherited:result.inherited},{added:2,reused:0,inherited:2});
assert.deepEqual(next.roles.map(x=>x.character),['Рейген Аратака','Моб']);
assert.deepEqual(next.roles.map(x=>x.actorId),['a','b']);
assert.notEqual(next.roles[0].id,'old-a');
assert.equal(next.roles[0].status,'waiting');
assert.equal(next.roles[0].folder,'');
assert.equal(next.roles[0].subtitle,'');
assert.equal(next.roles[0].lineCount,2);
assert.equal(next.roles[0].image,'data:image/png;base64,a');
assert.equal(JSON.stringify(old),original,'Prior episode unaffected');
result=applyAssCastImport(state,project,next,parsed.characters);
assert.equal(result.added,0,'Repeat import must not duplicate roles');
assert.equal(result.reused,2);
assert.equal(next.roles.length,2);
next.roles[0].actorId='b';next.roles[0].actor='Актёр Б';
applyAssCastImport(state,project,next,parsed.characters);
assert.equal(next.roles[0].actorId,'b','Manual casting is never overwritten');
const onlyMob=[parsed.characters[1]];
applyAssCastImport(state,project,next,onlyMob,{removeMissing:true});
assert.deepEqual(next.roles.map(x=>x.character),['Моб']);
assert.throws(()=>applyAssCastImport(state,project,next,parsed.characters,{selected:[]}),/хотя бы одного/);
next.roles[0].status='done';
assert.throws(()=>applyAssCastImport(state,project,next,[parsed.characters[0]],{removeMissing:true}),/Нельзя автоматически удалить/);
assert.equal(next.roles.length,1,'Failed replacement must not partially modify episode');
const stateAfter=normalizeState(state);
assert.equal(stateAfter.projects[0].episodes.find(x=>x.number==='2').roles[0].actorId,'b');

const app=readFileSync('package/web/app.js','utf8');
const html=readFileSync('package/web/index.html','utf8');
const host=readFileSync('package/LocalServer.cs','utf8');
assert.match(app,/data-action="import-ass-roles"/);
assert.match(app,/В этой серии пока нет персонажей/);
assert.match(app,/importAssRolesFile\(file,pid,epid\)/);
assert.match(app,/data-action="new-role"/);
assert.match(app,/ass-remove-missing/);
assert.match(html,/id="ass-roles-file"/);
assert.match(html,/ass-role-import\.css/);
assert.match(host,/\/ass-role-import\.js/);
assert.match(host,/\/ass-role-import\.css/);
console.log('PASS: ASS/SSA dialogue import, Unicode and Windows-1251, safe auto-cast, repeat, preview, protection and local host');
