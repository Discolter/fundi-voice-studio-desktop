import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seedState,newProject,newActor,newEpisode,normalizeState,actorPublicFeed,safeRoleImage,episodeRoleCharacterKey,episodeRoleCharacterImage} from '../package/web/core.js';
const image='data:image/webp;base64,AQID';
assert.equal(safeRoleImage(image),image);
assert.equal(safeRoleImage('javascript:alert(1)'),'');
assert.equal(safeRoleImage('data:image/svg+xml;base64,AQID'),'');
assert.equal(safeRoleImage('data:image/png;base64,'+'A'.repeat(150000)),'');
const state=seedState(),first=newActor({name:'Актёр',actorAccess:true}),second=newActor({name:'Актёр 2',actorAccess:true});
state.actors=[first,second];
const p=newProject({title:'Тест',episodes:[newEpisode({number:'1'})]});
p.episodes[0].roles.push({id:'role-character-test',character:'Персонаж',image,actorId:first.id,actor:first.name,status:'waiting',lineCount:4,due:''});
state.projects=[p];
const saved=normalizeState(JSON.parse(JSON.stringify(state)));
assert.equal(saved.projects[0].episodes[0].roles[0].image,image);
assert.equal(actorPublicFeed(saved,first.id).roles[0].image,image);
const role=saved.projects[0].episodes[0].roles[0];
role.actorId=second.id;
assert.equal(actorPublicFeed(saved,first.id).roles.length,0);
assert.equal(actorPublicFeed(saved,second.id).roles[0].image,image);
const app=readFileSync('package/web/app.js','utf8');
const host=readFileSync('package/LocalServer.cs','utf8');
assert.match(app,/function roleImageEditor\(/);
assert.match(app,/roleImageThumb\(r\)/);
assert.match(app,/ICONS\.review=ICONS\.refresh/);
assert.ok(host.includes('"/role-image-viewer.js"')&&host.includes('"/role-image-viewer.css"'));
const characterKey=episodeRoleCharacterKey(role);
assert.equal(episodeRoleCharacterImage(saved.projects[0].episodes[0].roles,characterKey),image,
  'Assigned character image should be available to the filter');
assert.equal(episodeRoleCharacterImage(saved.projects[0].episodes[0].roles,'all'),'',
  'The all-characters filter keeps its generic icon');
assert.equal(episodeRoleCharacterImage(saved.projects[0].episodes[0].roles,'character:missing'),'');
assert.equal(episodeRoleCharacterImage([
  {character:' Персонаж ',image:'data:image/svg+xml;base64,AQID'},
  {character:'пЕРСОНАЖ',image},
  {character:'Другой персонаж',image:'data:image/png;base64,AQID'}
],characterKey),image,'Duplicate names should use the first valid matching portrait');
assert.equal(episodeRoleCharacterImage([{character:'Персонаж'}],characterKey),'',
  'Characters without photos retain the star icon');
const visuals=readFileSync('package/web/visual-selects.js','utf8');
const visualCss=readFileSync('package/web/visual-selects.css','utf8');
assert.match(visuals,/getCharacterImage=\(\)=>''/);
assert.match(visuals,/image:value==='all'\?'':getCharacterImage\(value\)/);
assert.match(visuals,/if\(detail\.image\)/);
assert.match(visuals,/art\.append\(image\)/);
assert.match(visuals,/icon\(detail\.value === 'all' \? 'grid' : 'star'\)/);
assert.match(visuals,/image\.addEventListener\('error'/);
assert.match(visualCss,/\.fv-character-art \.fv-character-avatar\{[^}]*object-fit:cover/);
assert.match(app,/getCharacterImage:key=>episodeRoleCharacterImage\(/);
console.log('PASS: Studio role filter shows saved rounded portraits with icon fallbacks');
console.log('PASS: character images survive workspace save, actor reassign and cloud projection');
