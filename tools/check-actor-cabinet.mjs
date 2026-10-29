import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {actorCabinetSnapshot,createActorCabinet} from '../package/web/actor-cabinet.js';
const actor={id:'actor-1',name:'Актриса',telegram:'voice_actor',actorAccess:true,avatar:''};
const base={roleId:'role-1',projectId:'project-1',projectTitle:'Меч и жезл Вистории',season:'2',
  episodeId:'ep-1',episodeNumber:'01',character:'Элиза',lineCount:30,status:'waiting',
  due:'2026-11-03',image:'data:image/webp;base64,AQID'};
const unsynced={...base,roleId:'role-local',character:'Новая роль'};
const finished={...base,roleId:'role-history',character:'Принятая роль',status:'done'};
const local={roles:[base,unsynced,finished]};
const remote={actors:[{actorId:'actor-1',enabled:true,username:'voiceactor',
  feed:{roles:[base,finished]}}]};
const hidden=[{actorId:'actor-1',roleId:'role-history'}];
const links=[{projectId:'project-1',episodeId:'ep-1',url:'https://t.me/c/123/456'}];
const snap=actorCabinetSnapshot(actor,local,remote,hidden,[],links);
assert.equal(snap.verified,true);
assert.equal(snap.enabled,true);
assert.equal(snap.active.length,1);
assert.equal(snap.history.length,1);
assert.equal(snap.missing.length,1);
assert.equal(snap.missing[0].roleId,'role-local');
assert.equal(snap.active[0].sourceUrl,'https://t.me/c/123/456');
assert.equal(actorCabinetSnapshot(actor,local,{actors:[{actorId:actor.id,enabled:false,feed:{roles:[base]}}]}).active.length,0);
assert.equal(actorCabinetSnapshot(actor,local,null).verified,false);
assert.equal(actorCabinetSnapshot(actor,local,null).active.length,3);
assert.equal(actorCabinetSnapshot(actor,local,remote,[],[],[{...links[0],url:'javascript:alert(1)'}]).active[0].sourceUrl,'');
const app=readFileSync('package/web/app.js','utf8');
const index=readFileSync('package/web/index.html','utf8');
const server=readFileSync('package/LocalServer.cs','utf8');
const client=readFileSync('package/StudioCloud.cs','utf8');
assert.match(app,/data-site-mode="cabinet"/);
assert.match(app,/createActorCabinet\(/);
assert.match(app,/actorCabinet\.start\(/);
assert.match(app,/actorCabinet\.render\(\)/);
assert.match(index,/actor-cabinet\.css/);
assert.match(server,/"\/actor-cabinet\.js"/);
assert.match(server,/"\/actor-cabinet\.css"/);
assert.match(server,/route=="cloud\/actor-roster"/);
assert.match(client,/public object ActorRoster\(\)/);
assert.match(client,/\/v1\/studio\/web\/roster/);
assert.match(client,/\/v1\/studio\/source-links/);
let rerenders=0;
const actions=[];
const manager=createActorCabinet({
  getActors:()=>[actor],
  getCloud:()=>({connected:true,actors:[{actorId:actor.id,registered:true,username:'voiceactor'}],
    reviews:[],hiddenRoles:hidden}),
  getLocalFeed:()=>local,
  actorAvatar:a=>'<span class="actor-pick-avatar">'+a.name[0]+'</span>',
  icon:name=>'<svg data-icon="'+name+'"></svg>',
  escapeHTML:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  rerender:()=>{rerenders++},
  api:async (path,body)=>{
    assert.equal(path,'cloud/actor-roster');
    assert.deepEqual(body,{});
    actions.push(path);
    return {...remote,sourceLinks:links,checkedAt:'2026-10-29T14:00:00Z'};
  }
});
assert.match(manager.render(),/Роли актёров/);
await manager.refresh();
assert.equal(actions.length,1);
assert.ok(rerenders>=2);
globalThis.window={scrollTo(){}};
manager.action({cabinet:'actor',id:actor.id});
let html=manager.render();
assert.match(html,/Твои проекты/);
assert.match(html,/Элиза/);
assert.match(html,/Исходники в Telegram/);
assert.match(html,/https:\/\/t\.me\/c\/123\/456/);
assert.match(html,/data:image\/webp;base64,AQID/);
assert.match(html,/отсутствуют в опубликованном списке: 1/);
assert.doesNotMatch(html.split('<div class="ac-projects">')[1]||'',/Новая роль<\/strong>/, 'Unpublished roles must appear only in diagnostics, never in the Actor project list');
manager.action({cabinet:'section',section:'history'});
html=manager.render();
assert.match(html,/Принятая роль/);
assert.doesNotMatch(html,/>Элиза<\/strong>/);
manager.action({cabinet:'section',section:'debts'});
assert.match(manager.render(),/Мои долги/);
manager.action({cabinet:'home'});
assert.match(manager.render(),/Найти актёра/);
delete globalThis.window;
console.log('PASS: Actor Roles mode verifies real Cloud roster, lists Actor-style projects and links, detects unsynced roles and hidden history without impersonation');
