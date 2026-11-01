import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roleImageFromClipboard} from '../package/web/role-image-clipboard.js';
import {seedState,newProject,newEpisode,newActor,normalizeState,actorPublicFeed,safeRoleImage} from '../package/web/core.js';

const image={type:'image/png',size:23000};
const item={kind:'file',type:'image/png',getAsFile:()=>image};
assert.equal(roleImageFromClipboard({items:[{kind:'string',type:'text/plain'},item]}),image);
assert.equal(roleImageFromClipboard({items:[],files:[image]}),image);
assert.equal(roleImageFromClipboard({items:[{kind:'string',type:'text/html'}],files:[]}),null,
  'Copying HTML or an image URL must not trigger a remote download');
assert.equal(roleImageFromClipboard({items:[{kind:'file',type:'image/svg+xml',getAsFile:()=>({size:100,type:'image/svg+xml'})}]}),null);
assert.equal(roleImageFromClipboard({items:[{kind:'file',type:'image/png',getAsFile:()=>({size:0,type:'image/png'})}]}),null);
assert.equal(roleImageFromClipboard(null),null);
const good='data:image/webp;base64,AQID';
assert.equal(safeRoleImage(good),good);
const state=seedState(),actor=newActor({name:'Актёр',actorAccess:true});
state.actors=[actor];
state.projects=[newProject({title:'Тест',episodes:[newEpisode({number:'1',roles:[
  {id:'role-paste',character:'Рэйгэн',actorId:actor.id,actor:actor.name,image:good,status:'waiting'}
]})]})];
const saved=normalizeState(JSON.parse(JSON.stringify(state)));
assert.equal(actorPublicFeed(saved,actor.id).roles[0].image,good,
  'Clipboard images must use existing role feed and actor synchronization');
const app=readFileSync('package/web/app.js','utf8');
const host=readFileSync('package/LocalServer.cs','utf8');
assert.match(app,/roleImageFromClipboard\(event\.clipboardData\)/);
assert.match(app,/modal\.addEventListener\('paste'/);
assert.match(app,/event\.preventDefault\(\)/);
assert.match(app,/if\(!file\)return;/);
assert.match(app,/loadRoleImage\(file\)/);
assert.match(app,/return true;/);
assert.match(app,/role-image-preview" tabindex="0"/);
assert.match(app,/Ctrl\+V/);
assert.match(app,/safeRoleImage\(data\.image\)/);
assert.match(host,/\/role-image-clipboard\.js/);
console.log('PASS: clipboard PNG/JPEG/WebP image extraction, URL/text exclusion, role preview, actor feed and secure static module');
