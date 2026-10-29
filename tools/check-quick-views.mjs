import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQuickViews,roleSnapshot,actorLoad,candidateScores} from '../package/web/quick-views.js';
const source=readFileSync('package/web/app.js','utf8');
const host=readFileSync('package/LocalServer.cs','utf8');
const index=readFileSync('package/web/index.html','utf8');
const actorCabinet=readFileSync('package/web/actor-cabinet.js','utf8');
const css=readFileSync('package/web/quick-views.css','utf8');
const actor={id:'actor1',name:'Даша',telegram:'Antilles0_w1',avatar:'',actorAccess:true};
const actor2={id:'actor2',name:'Актёр Б',telegram:'actor_b',actorAccess:true};
const actor3={id:'actor3',name:'Актёр В',telegram:'actor_c',actorAccess:true};
const role1={id:'r1',character:'Элиза',status:'waiting',actorId:'actor1',due:'2026-11-04',lineCount:30,
  image:'data:image/webp;base64,AQID'};
const role2={id:'r2',character:'Росты',status:'retake',actorId:'actor1',due:'2026-11-07',lineCount:18};
const role3={id:'r3',character:'Актёр Б',status:'waiting',actorId:'actor2',due:'2026-11-02',lineCount:12};
const state={actors:[actor,actor2,actor3],projects:[{id:'p1',title:'Меч и жезл',season:'2',archived:false,
 episodes:[{id:'e1',number:'01',roles:[role1,role2,role3]}]}]};
const cloud={connected:true,actors:[{actorId:'actor1',registered:true}],
  vacations:[{actorId:'actor1',status:'active',endDate:null}],hiddenRoles:[],reviews:[]};
assert.equal(roleSnapshot(state,'p1','e1','r1')?.r,role1);
assert.equal(roleSnapshot(state,'p1','bad','r1'),null);
assert.equal(actorLoad(state,'actor1').debts,2);
assert.equal(candidateScores(state,[actor3,actor2])[0].actor.id,'actor3');
const listeners={};
const root={innerHTML:'',addEventListener(name,fn){listeners[name]=fn;}};
const docHandlers={};
globalThis.document={
 body:{classList:{toggle(){}}},
 querySelector(){return {open:false}},
 addEventListener(name,fn){docHandlers[name]=fn;}
};
const messages=[];
const callbacks=[];
const icon=name=>'<svg data-icon="'+name+'"></svg>';
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const quick=createQuickViews({
 root,getState:()=>state,getCloud:()=>cloud,
 getRole:(p,e,r)=>roleSnapshot(state,p,e,r),
 getReview:()=>null,getStage:r=>r.status,
 getSourceUrl:()=> 'https://t.me/c/123/456',
 icon,escapeHTML,actorAvatar:a=>'<span class="actor-pick-avatar">'+a.name[0]+'</span>',
 editRole:(p,e,r)=>callbacks.push(['edit',p,e,r]),
 editActor:id=>callbacks.push(['actor',id]),
 editVacation:id=>callbacks.push(['vacation',id]),
 openProject:(p,e)=>callbacks.push(['project',p,e]),
 openFiles:x=>callbacks.push(['files',x.r.id]),
 transferRole:(p,e,r,candidate)=>callbacks.push(['transfer',p,e,r,candidate]),
 availableActors:()=>[actor2,actor3],
 changeRole:(x,patch)=>{callbacks.push(['save',x.r.id,patch]);x.r.status=patch.status;},
 cloudRequest:async ()=>({actors:[{actorId:'actor1',enabled:true,feed:{roles:[{roleId:'r1'}]}}]}),
 refreshCloud:async()=>{},
 openActorCabinet:id=>callbacks.push(['cabinet',id]),
 viewActorDemos:id=>callbacks.push(['demos',id]),
 toast:m=>messages.push(m)
});
assert.equal(quick.openActor('actor1'),true);
assert.match(root.innerHTML,/Даша/);
assert.match(root.innerHTML,/Отпуск|в отпуске/);
assert.match(root.innerHTML,/Меч и жезл/);
assert.match(root.innerHTML,/data-q="edit-actor"/);
assert.match(root.innerHTML,/data-q="actor-cloud"/);
assert.match(root.innerHTML,/data-q="role"/);
const tap=(q,extra={})=>listeners.click({target:{closest(){return {dataset:{q,...extra}}}},preventDefault(){},stopPropagation(){}});
tap('pin');
assert.equal(quick.isPinned(),true);
tap('tab',{tab:'debts'});
assert.match(root.innerHTML,/Долги/);
tap('role',{project:'p1',episode:'e1',role:'r1'});
assert.match(root.innerHTML,/id="qv-role-form"/);
assert.match(root.innerHTML,/Исходники в Telegram/);
assert.match(root.innerHTML,/name="lineCount"/);
tap('edit-role');
assert.deepEqual(callbacks.at(-1),['edit','p1','e1','r1']);
tap('role-cloud');
assert.match(root.innerHTML,/data-q="cloud-refresh"/);
tap('close-dialog');
assert.match(root.innerHTML,/Даша/,'Pinned actor drawer should survive central modal closure');
quick.openReplacement('p1','e1','r1');
assert.match(root.innerHTML,/Подбор замены/);
assert.match(root.innerHTML,/Актёр В/);
tap('compare',{actor:'actor2'});
assert.match(root.innerHTML,/Подробности кандидата/);
tap('demos',{actor:'actor2'});
assert.deepEqual(callbacks.at(-1),['demos','actor2']);
tap('select',{actor:'actor3'});
tap('transfer');
assert.deepEqual(callbacks.at(-1),['transfer','p1','e1','r1','actor3',false]);
assert.equal(quick.isPinned(),true);
quick.closePanel();
assert.equal(quick.isPinned(),false);
assert.doesNotMatch(root.innerHTML,/qv-panel/);
assert.match(source,/createQuickViews\(/);
assert.match(source,/quickViews\.openActor/);
assert.match(source,/quickViews\.openRole/);
assert.match(source,/quickViews\.openReplacement/);
assert.match(source,/quickViews\.contextMenu/);
assert.match(source,/roleReviewStage\(r,reviewForRole\(r\)\)/);
assert.match(source,/changeRole:\(\{p,r\}/);
const transferFn=source.slice(source.indexOf('function vacationReviewTransferForm('),source.indexOf('function renderVacations('));
assert.match(transferFn,/preferredActorId===a\.id\?'selected'/);
const vacationOwner=source.slice(source.indexOf('function studioVacationForm('),source.indexOf('async function studioVacationEnd('));
assert.doesNotMatch(vacationOwner,/preferredActorId/,'Owner vacation selector must not depend on reassignment input');
assert.match(index,/quick-view-root/);
assert.match(index,/quick-views\.css/);
assert.match(host,/"\/quick-views\.js"/);
assert.match(host,/"\/quick-views\.css"/);
assert.match(actorCabinet,/data-qv-open="role"/);
assert.match(css,/body\.qv-has-pinned \.main/);
assert.match(css,/prefers-reduced-motion/);
assert.match(source,/data-qv-open="actor"/);
assert.match(source,/data-qv-open="role"/);
assert.match(source,/data-qv-open="replace"/);
delete globalThis.document;
console.log('PASS: Studio quick views cover debts, editable roles, cloud, replacement comparison, pinning, context menus and original editing callbacks');
