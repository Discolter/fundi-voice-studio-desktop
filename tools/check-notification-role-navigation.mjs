// Regression: notification "Open role" must show the submitter's roles in that episode.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {episodeRoleActorKey,episodeRoleActorOptions,filterEpisodeRoles,safeRoleImage} from '../package/web/core.js';

const state={actors:[{id:'azure',name:'AZURE'},{id:'other',name:'Другой актёр'}]};
const roles=[
  {id:'buyer1',character:'Покупательница 1',actorId:'azure',actor:'AZURE',status:'received'},
  {id:'buyer2',character:'Покупательница 2',actorId:'azure',actor:'AZURE',status:'waiting'},
  {id:'vendor',character:'Продавец',actorId:'other',actor:'Другой актёр',status:'received'}
];
const actorKey='id:azure';
assert.ok(episodeRoleActorOptions(state,roles).some(choice=>choice.key===actorKey));
assert.deepEqual(filterEpisodeRoles(state,roles,{actorKey}).map(role=>role.id),['buyer1','buyer2'],
  'Opening an actor submission must display every role by that actor in this episode');
roles[0].actorId='other'; // Notification actor stays AZURE even if the submitted role was reassigned.
assert.deepEqual(filterEpisodeRoles(state,roles,{actorKey}).map(role=>role.id),['buyer2'],
  'Reassignment must not redirect the notification to another actor');
assert.equal(episodeRoleActorKey(state,{actorId:'',actor:'Имя без профиля'}),'name:имя без профиля',
  'Legacy assignments can still use the existing name-based filter');

const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const start=app.indexOf("case 'notification-open-role':");
const end=app.indexOf("case 'new-project':",start);
assert.ok(start>=0&&end>start,'Notification navigation handler exists');
const handler=app.slice(start,end);
assert.ok(handler.includes("const actorKey=message.actorId?'id:'+message.actorId:episodeRoleActorKey(state,found.r);"),
  'Prefer the submission actorId, not the current role assignee');
assert.ok(handler.includes("const characterKey=episodeRoleCharacterKey(found.r);"),
  'A submitted role must derive its actual character key');
assert.ok(handler.includes("openProject(found.p.id,found.ep.id,'roles',actorKey,characterKey)"),
  'Notification must pass both actor and character filters to the episode route');
assert.ok(app.includes("episodeRoleActorOptions(state,ep.roles).some(item=>item.key===actorKey)?actorKey:'all'"),
  'Missing/stale actors must fall back to showing all roles');
assert.ok(app.includes("ui.roleCharacter=tab==='roles'&&characterKey&&ep&&episodeRoleCharacterOptions(ep.roles).some(item=>item.key===characterKey)?characterKey:'all'"),
  'Character filter should be selected when opening a submitted role');
assert.ok(app.includes("!filterEpisodeRoles(state,ep.roles,{actorKey:ui.roleActor,characterKey:ui.roleCharacter}).length"),
  'A reassigned character must remain reachable without a stale actor filter');
assert.ok(app.includes('studioRolePortrait(found?.r,item.role)'),
  'Notification list should use a local portrait or the notification role snapshot');
const css=readFileSync(new URL('../package/web/file-tools.css',import.meta.url),'utf8');
assert.match(css,/\.studio-character-thumb img\{[^}]*object-fit:cover/);

const portraits=[
  {id:'lead',character:'Уличный громила',image:'data:image/png;base64,AA=='},
  {id:'sal',character:'Сэл',image:'data:image/png;base64,AQ=='},
  {id:'guard',character:'Охранник «Арасаки»',image:'data:image/png;base64,Ag=='}
];
const linked=portraits.map(({id,character})=>({roleId:id,character}));
const recording={fileId:'take-1',fileName:'артас.flac',actorId:'azure',roleId:'lead',status:'ready'};
const rendering=app.slice(app.indexOf('function recordingForRole('),app.indexOf('function roleRecordingButton('))+
  app.slice(app.indexOf('function renderStudioFiles('),app.indexOf('function reviewForRole('));
function renderRecording(file,recordingContext=null){
  let markup='';
  const view={scrollTop:0};
  runInNewContext(rendering+'\nrenderStudioFiles();',{
    state:{actors:state.actors,projects:[{id:'project',title:'Киберпанк',episodes:[{id:'ep1',roles:portraits}]}]},
    cloud:{files:[file]},recordingContext,modal:{querySelector:()=>view,dataset:{}},
    showModal:(_title,_subtitle,body)=>{markup=body;},
    e:value=>String(value),safeRoleImage,icon:name=>`<i data-icon="${name}"></i>`,
    storageMeter:()=>'',episodeLabel:()=>'Серия 01',fileStatus:()=>'Готово',
    vacationTag:()=>'',formatBytes:()=>'',notificationDate:()=>''
  });
  return markup;
}
const imageSources=markup=>[...markup.matchAll(/<img src="([^"]+)"/g)].map(match=>match[1]);
const roleLinks=markup=>[...markup.matchAll(/data-qv-role="([^"]+)"/g)].map(match=>match[1]);
const shared=renderRecording({...recording,roles:linked});
assert.deepEqual(imageSources(shared),portraits.map(role=>role.image),
  'A shared recording must render the actual portrait of every linked character once');
assert.deepEqual(roleLinks(shared),['lead','sal','guard'],'Every portrait must link to its corresponding role');
assert.equal((shared.match(/data-action="studio-file-download"/g)||[]).length,1,'The shared file is downloaded once');
assert.deepEqual(imageSources(renderRecording({...recording,roles:linked},{actorId:'azure',roleId:'sal'})),
  portraits.map(role=>role.image),'Opening a shared recording from a role still shows all of its characters');

const missing=renderRecording({...recording,roles:[linked[0],{roleId:'removed',character:'Удалённая роль'}]});
assert.deepEqual(imageSources(missing),[portraits[0].image],'An unavailable role must never repeat someone else’s portrait');
assert.deepEqual(roleLinks(missing),['lead']);
assert.ok(missing.includes('Удалённая роль'));
assert.ok(missing.includes('data-icon="mic"'));
const single=renderRecording(recording);
assert.deepEqual(imageSources(single),[portraits[0].image],'Legacy single-role recordings still show one portrait');
assert.deepEqual(roleLinks(single),['lead']);
assert.ok(!single.includes('recording-role-list'));
console.log('PASS: notification navigation and portraits for single and shared recordings');
