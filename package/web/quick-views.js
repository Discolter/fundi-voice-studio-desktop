// Studio-only contextual actions, rendered outside #app so pages retain filters/scroll.
const STAGES=[['waiting','Жду запись'],['recording','В записи'],['received','Получено'],['processing','Обрабатываю'],['retake','На перезапись'],['done','Принято']];
const validImage=s=>typeof s==='string'&&s.length<=150000&&/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/i.test(s)?s:'';
const validTelegram=s=>typeof s==='string'&&/^https:\/\/(?:t\.me|telegram\.me)\/[A-Za-z0-9_+/-]+\/?$/.test(s)?s:'';
export const roleSnapshot=(state,pid,eid,rid)=>{
 const p=(state?.projects||[]).find(x=>x.id===pid),ep=p?.episodes?.find(x=>x.id===eid),r=ep?.roles?.find(x=>x.id===rid);
 return p&&ep&&r?{p,ep,r}:null;
};
export const actorLoad=(state,id)=>{
 const rows=(state?.projects||[]).filter(p=>!p.archived).flatMap(p=>p.episodes.flatMap(ep=>ep.roles.filter(r=>r.actorId===id).map(r=>({p,ep,r}))));
 return {rows,debts:rows.filter(x=>['waiting','retake'].includes(x.r.status)).length};
};
export const candidateScores=(state,actors)=>actors.map(actor=>{
 const {rows,debts}=actorLoad(state,actor.id);
 const nearest=rows.filter(x=>['waiting','recording','retake'].includes(x.r.status)).map(x=>x.r.due||x.ep.due).filter(Boolean).sort()[0]||'';
 return {actor,debts,active:rows.filter(x=>x.r.status!=='done').length,nearest};
}).sort((a,b)=>a.debts-b.debts||a.active-b.active||a.actor.name.localeCompare(b.actor.name,'ru'));

export function createQuickViews({root,getState,getCloud,getRole,getReview,getSourceUrl,
 icon,escapeHTML:e,actorAvatar,getStage,editRole,editActor,openProject,openFiles,transferRole,
 availableActors,changeRole,cloudRequest,refreshCloud,openActorCabinet,editVacation,toast}) {
 let panel=null,dialog=null,pinned=false,tab='roles',history=[],context=null,selectedCandidate='';
 let cloudResult=null,checking=false,cloudError='',stamp='';
 const state=()=>getState(),cloud=()=>getCloud()||{};
 const actor=id=>(state()?.actors||[]).find(a=>a.id===id);
 const role=()=>getRole(dialog?.projectId,dialog?.episodeId,dialog?.roleId);
 const ref=x=>'data-project="'+e(x.p.id)+'" data-episode="'+e(x.ep.id)+'" data-role="'+e(x.r.id)+'"';
 const stage=r=>getStage(r);
 const tag=r=>'<span class="qv-status qv-status-'+e(stage(r))+'">'+e(STAGES.find(([k])=>k===stage(r))?.[1]||r.status)+'</span>';
 const btn=(act,label,ic,extra='')=>'<button type="button" class="btn ghost small" data-q="'+act+'" '+extra+'>'+icon(ic)+' '+e(label)+'</button>';
 const id=a=>'<div class="qv-identity">'+actorAvatar(a)+'<span><strong>'+e(a.name)+'</strong><small>'+e(a.telegram?'@'+a.telegram:'Telegram не указан')+'</small></span></div>';
 const roleImage=r=>validImage(r.image)?'<button type="button" data-role-image-open class="qv-thumb" aria-label="Увеличить '+e(r.character)+'"><img src="'+e(r.image)+'" alt=""></button>':'<span class="qv-thumb">'+icon('star')+'</span>';
 const note='<p class="qv-muted">Изменения сохраняются через Studio. Публикацию на сервере можно проверить отдельно.</p>';
 function actorView(){
  const a=actor(panel?.actorId);if(!a)return '<p>Актёр больше не найден.</p>';
  const {rows,debts}=actorLoad(state(),a.id),hidden=new Set((cloud().hiddenRoles||[]).filter(x=>x.actorId===a.id).map(x=>x.roleId));
  const filtered=rows.filter(x=>tab==='debts'?['waiting','retake'].includes(stage(x.r)):
    tab==='history'?stage(x.r)==='done'&&hidden.has(x.r.id):!(stage(x.r)==='done'&&hidden.has(x.r.id)));
  const groups=new Map();for(const x of filtered){if(!groups.has(x.p.id))groups.set(x.p.id,{p:x.p,items:[]});groups.get(x.p.id).items.push(x);}
  const v=(cloud().vacations||[]).find(x=>x.actorId===a.id&&['active','planned'].includes(x.status));
  const acc=(cloud().actors||[]).find(x=>x.actorId===a.id);
  return id(a)+(v?'<p class="qv-warning">Актёр '+(v.status==='active'?'в отпуске':'планирует отпуск')+
    (v.endDate?' до '+e(v.endDate):' · бессрочно')+'</p>':'')+
    '<div class="qv-stats"><span><b>'+rows.length+'</b> ролей</span><span><b>'+debts+'</b> долгов</span><span><b>'+rows.filter(x=>stage(x.r)==='done').length+'</b> принято</span></div>'+
    '<div class="qv-actions">'+btn('edit-actor','Изменить профиль','edit')+btn('actor-cloud','Проверить Cloud','refresh')+
      btn('actor-account','Кабинет Actor','users')+(v?btn('vacation-edit','Изменить отпуск','calendar'):'')+'</div>'+
    '<p class="qv-muted">'+(acc?.registered?'Аккаунт зарегистрирован':'Аккаунт не зарегистрирован')+
      ' · '+(a.actorAccess?'Доступ разрешён':'Доступ отключён')+'</p>'+
    '<div class="qv-tabs">'+[['roles','Все роли'],['debts','Долги'],['history','История']].map(([key,name])=>
      '<button type="button" data-q="tab" data-tab="'+key+'" class="'+(tab===key?'active':'')+'">'+name+'</button>').join('')+'</div>'+
    ([...groups.values()].map(g=>'<section class="qv-project"><h4>'+e(g.p.title)+'</h4>'+
      g.items.map(x=>'<button type="button" class="qv-role-row" data-q="role" '+ref(x)+'><span><b>'+e(x.r.character)+
      '</b><small>Серия '+e(x.ep.number||x.ep.title||'')+(Number.isInteger(x.r.lineCount)?' · '+x.r.lineCount+' репл.':'')+
      '</small></span>'+tag(x.r)+icon('chevron')+'</button>').join('')+'</section>').join('')||'<p class="qv-muted">Ролей не найдено.</p>')+note;
 }
 function roleView(){
  const x=role();if(!x)return '<p>Роль уже удалена.</p>';
  const {p,ep,r}=x,a=actor(r.actorId),siblings=ep.roles||[],index=siblings.findIndex(y=>y.id===r.id),url=validTelegram(getSourceUrl(p.id,ep.id));
  return '<div class="qv-role-heading">'+roleImage(r)+'<div><h2>'+e(r.character)+'</h2><p>'+e(p.title)+' · Серия '+e(ep.number||ep.title||'')+'</p>'+
    (a?'<button type="button" class="qv-link" data-q="actor" data-actor="'+e(a.id)+'">'+e(a.name)+' · открыть актёра →</button>':'<small>Актёр не назначен</small>')+'</div></div>'+
    '<div class="qv-actions">'+btn('previous','Предыдущая','back',index===0?'disabled':'')+btn('next','Следующая','arrow',index>=siblings.length-1?'disabled':'')+'</div>'+
    '<form id="qv-role-form" class="qv-form"><label>Обработка<select name="status">'+STAGES.map(([key,label])=>'<option value="'+key+'" '+(stage(r)===key?'selected':'')+'>'+label+'</option>').join('')+
      '</select></label><label>Дедлайн<input type="date" name="due" value="'+e(r.due||'')+'"></label>'+
      '<label>Реплики<input type="number" min="0" max="1000000" name="lineCount" placeholder="Не указано" value="'+e(r.lineCount??'')+'"></label>'+
      '<button class="btn primary" type="submit">Сохранить показатели</button></form>'+
    '<div class="qv-actions">'+btn('edit-role','Полное редактирование','edit')+btn('recordings','Записи','download')+
      btn('role-cloud','Проверка Cloud','refresh')+btn('project','Открыть проект','folder')+'</div>'+
    (url?'<a class="qv-source" href="'+e(url)+'" target="_blank" rel="noopener noreferrer">'+icon('external')+' Исходники в Telegram ↗</a>':
      '<p class="qv-muted">Ссылка на исходники Telegram не прикреплена.</p>')+
    (r.notes?'<section class="qv-project"><h4>Заметки</h4><p>'+e(r.notes)+'</p></section>':'')+note;
 }
 function replacementView(){
  const x=role();if(!x)return '<p>Роль уже удалена.</p>';
  const candidates=candidateScores(state(),availableActors(x.r.actorId));
  if(!candidates.some(v=>v.actor.id===selectedCandidate))selectedCandidate=candidates[0]?.actor.id||'';
  return '<p class="qv-muted">'+e(x.p.title)+' · '+e(x.r.character)+' · Серия '+e(x.ep.number||'')+'</p>'+
    '<p class="qv-warning">Переназначение потребует подтверждения и актуального статуса отпуска.</p>'+
    '<div class="qv-candidates">'+candidates.map(({actor:a,debts,active,nearest})=>
      '<article class="qv-candidate '+(selectedCandidate===a.id?'selected':'')+'">'+id(a)+
      '<p>'+debts+' долгов · '+active+' активных ролей</p><small>'+(nearest?'Ближайший срок: '+e(nearest):'Сроки не указаны')+'</small>'+
      '<div class="qv-actions"><button class="btn '+(selectedCandidate===a.id?'primary':'ghost')+' small" type="button" data-q="select" data-actor="'+e(a.id)+'">'+
      (selectedCandidate===a.id?'Выбран':'Выбрать')+'</button>'+btn('compare','Демки и роли','users','data-actor="'+e(a.id)+'"')+'</div></article>').join('')+'</div>'+
    (candidates.length?'<button type="button" data-q="transfer" class="btn primary">Продолжить переназначение</button>':'<p>Нет доступных исполнителей.</p>')+
    '<p class="qv-muted">Нагрузка — подсказка, не оценка голосового соответствия.</p>';
 }
 function cloudView(){
  const x=role(),a=actor(dialog?.actorId||x?.r?.actorId);if(!a)return '<p>Актёр не выбран.</p>';
  const account=(cloud().actors||[]).find(v=>v.actorId===a.id);
  let info='<p class="qv-muted">Нажми «Проверить сервер», чтобы получить опубликованные назначения.</p>';
  if(checking)info='<p>Проверяем Cloud…</p>';
  else if(cloudError)info='<p class="qv-warning">'+e(cloudError)+'</p>';
  else if(cloudResult){
   const server=cloudResult.actors.find(v=>v.actorId===a.id);
   const assigned=x?.r?(server?.feed?.roles||[]).some(v=>v.roleId===x.r.id):(server?.feed?.roles||[]).length>0;
   const hidden=x?.r&&(cloud().hiddenRoles||[]).some(v=>v.actorId===a.id&&v.roleId===x.r.id);
   info='<div class="qv-checklist"><p>✅ Сохранено в Studio</p><p>'+(assigned?'✅':'🔴')+' '+(x?.r?'Роль опубликована':'Есть опубликованные роли')+'</p>'+
     '<p>'+(server?.enabled?'✅ Доступ разрешён':'🔴 Доступ отключён')+'</p>'+
     '<p>'+(account?.registered?'✅ Аккаунт зарегистрирован':'🟡 Аккаунт не зарегистрирован')+'</p>'+
     (hidden?'<p>🟡 Роль скрыта и находится в истории Actor.</p>':'')+
     '<p>❔ Просмотрено актёром: неизвестно</p></div><p class="qv-muted">Проверено: '+e(stamp)+'</p>';
  }
  return id(a)+(x?.r?'<h3>'+e(x.r.character)+'</h3>':'')+info+
    '<div class="qv-actions">'+btn('cloud-refresh','Проверить сервер','refresh')+
    btn('cloud-sync','Отправить изменения','check')+'</div>'+note;
 }
 const head=(title,isPanel)=>'<header class="qv-header"><strong>'+e(title)+'</strong><div>'+
   (isPanel&&history.length?'<button type="button" data-q="back" title="Назад">'+icon('back')+'</button>':'')+
   (isPanel?'<button type="button" data-q="pin" aria-pressed="'+pinned+'" title="'+(pinned?'Открепить':'Закрепить')+'">'+(pinned?'📌':'📍')+'</button>':'')+
   '<button type="button" data-q="'+(isPanel?'close-panel':'close-dialog')+'" title="Закрыть">'+icon('close')+'</button></div></header>';
 function render(){
  const panelHtml=panel?'<aside class="qv-panel '+(pinned?'pinned':'')+'" role="complementary" aria-label="Кабинет актёра">'+
    head('Актёр · '+(actor(panel.actorId)?.name||''),true)+'<div class="qv-body">'+actorView()+'</div></aside>':'';
  const title=dialog?.kind==='role'?'Карточка персонажа':dialog?.kind==='replace'?'Подбор замены':'Проверка Cloud';
  const modalHtml=dialog?'<div class="qv-shade" data-q="close-dialog"></div>'+
    '<section class="qv-dialog '+(dialog.kind==='cloud'?'small':dialog.kind==='replace'?'wide':'')+'" role="dialog" aria-modal="true" aria-labelledby="qv-modal-title">'+
    '<div id="qv-modal-title">'+head(title,false)+'</div><div class="qv-body">'+
    (dialog.kind==='role'?roleView():dialog.kind==='replace'?replacementView():cloudView())+'</div></section>':'';
  const menu=context?'<div role="menu" class="qv-context" style="left:'+context.x+'px;top:'+context.y+'px">'+
    '<button data-q="context-actor">Быстрый просмотр актёра</button><button data-q="context-role">Карточка персонажа</button>'+
    '<button data-q="context-cloud">Проверить Cloud</button><button data-q="context-pin">Закрепить панель</button></div>':'';
  root.innerHTML=(panel&&!pinned&&!dialog?'<div class="qv-panel-shade" data-q="close-panel"></div>':'')+panelHtml+modalHtml+menu;
  document.body.classList.toggle('qv-has-pinned',Boolean(panel&&pinned));
 }
 function openActor(actorId,{pin=false}={}){
  if(!actor(actorId))return false;
  if(panel?.actorId!==actorId){if(panel?.actorId)history.push(panel.actorId);tab='roles';}
  panel={actorId};if(pin)pinned=true;context=null;render();return true;
 }
 function openRole(projectId,episodeId,roleId){
  if(!getRole(projectId,episodeId,roleId))return false;
  dialog={kind:'role',projectId,episodeId,roleId};context=null;render();return true;
 }
 function openReplacement(projectId,episodeId,roleId){
  if(!getRole(projectId,episodeId,roleId))return false;
  dialog={kind:'replace',projectId,episodeId,roleId};selectedCandidate='';context=null;render();return true;
 }
 function openCloud(projectId='',episodeId='',roleId='',actorId=''){
  dialog={kind:'cloud',projectId,episodeId,roleId,actorId};cloudResult=null;checking=false;cloudError='';context=null;render();return true;
 }
 function closeDialog(){dialog=null;cloudResult=null;render();}
 function closePanel(){panel=null;pinned=false;history=[];render();}
 async function checkCloud(){
  if(!cloud().connected){cloudError='Cloud не подключён';render();return;}
  checking=true;cloudError='';render();
  try{const data=await cloudRequest('cloud/actor-roster',{});
   if(!Array.isArray(data.actors))throw Error('Сервер не вернул список ролей.');
   cloudResult=data;stamp=new Date().toLocaleString('ru-RU');cloudError='';
  }catch(err){cloudResult=null;cloudError=err.message||String(err);}
  finally{checking=false;render();}
 }
 async function command(q,node){
  if(q==='close-dialog'){closeDialog();return;}
  if(q==='close-panel'){if(!pinned)closePanel();return;}
  if(q==='pin'){pinned=!pinned;render();return;}
  if(q==='back'){const a=history.pop();if(a){panel={actorId:a};tab='roles';render();}return;}
  if(q==='tab'){tab=node.dataset.tab;render();return;}
  if(q==='actor'){openActor(node.dataset.actor);return;}
  if(q==='role'){openRole(node.dataset.project,node.dataset.episode,node.dataset.role);return;}
  if(q==='edit-actor'&&panel){editActor(panel.actorId);return;}
  if(q==='vacation-edit'&&panel){editVacation(panel.actorId);return;}
  if(q==='actor-cloud'&&panel){openCloud('','','',panel.actorId);return;}
  if(q==='actor-account'&&panel){openActorCabinet(panel.actorId);return;}
  const x=role();
  if(q==='edit-role'&&x){editRole(x.p.id,x.ep.id,x.r.id);return;}
  if(q==='recordings'&&x){openFiles(x);return;}
  if(q==='project'&&x){closeDialog();openProject(x.p.id,x.ep.id);return;}
  if(q==='role-cloud'&&x){openCloud(x.p.id,x.ep.id,x.r.id,x.r.actorId);return;}
  if((q==='previous'||q==='next')&&x){
   const i=x.ep.roles.findIndex(y=>y.id===x.r.id),next=x.ep.roles[i+(q==='previous'?-1:1)];
   if(next)openRole(x.p.id,x.ep.id,next.id);return;
  }
  if(q==='select'){selectedCandidate=node.dataset.actor;render();return;}
  if(q==='compare'){openActor(node.dataset.actor);return;}
  if(q==='transfer'&&x&&selectedCandidate){const choice=selectedCandidate;closeDialog();transferRole(x.p.id,x.ep.id,x.r.id,choice);return;}
  if(q==='cloud-refresh'){await checkCloud();return;}
  if(q==='cloud-sync'){await refreshCloud();if(dialog?.kind==='cloud')await checkCloud();return;}
  if(q.startsWith('context-')){
   const ctx=context;context=null;render();if(!ctx)return;
   if(q==='context-actor'||q==='context-pin'){openActor(ctx.actorId,{pin:q==='context-pin'});return;}
   if(q==='context-role'){openRole(ctx.projectId,ctx.episodeId,ctx.roleId);return;}
   if(q==='context-cloud'){openCloud(ctx.projectId,ctx.episodeId,ctx.roleId,ctx.actorId);}
  }
 }
 root.addEventListener('click',ev=>{
  const node=ev.target.closest?.('[data-q]');if(!node)return;
  ev.preventDefault();ev.stopPropagation();
  Promise.resolve(command(node.dataset.q,node)).catch(err=>toast(err.message,true));
 });
 root.addEventListener('submit',ev=>{
  if(ev.target.id!=='qv-role-form')return;
  ev.preventDefault();const x=role();if(!x)return;
  const data=new FormData(ev.target);
  Promise.resolve(changeRole(x,{status:String(data.get('status')),due:String(data.get('due')||''),
   lineCount:String(data.get('lineCount')??'')})).then(()=>{render();toast('Роль сохранена');}).catch(err=>toast(err.message,true));
 });
 document.addEventListener('keydown',ev=>{
  if(ev.key!=='Escape'||document.querySelector('#modal')?.open)return;
  if(context){context=null;render();}else if(dialog){closeDialog();ev.preventDefault();}
  else if(panel&&!pinned){closePanel();ev.preventDefault();}
 });
 document.addEventListener('pointerdown',ev=>{if(context&&!ev.target.closest('.qv-context')){context=null;render();}});
 function contextMenu(ev,ctx){
  if(!ctx?.actorId&&!ctx?.roleId)return false;
  ev.preventDefault();context={...ctx,x:Math.max(8,Math.min(ev.clientX,innerWidth-240)),
   y:Math.max(8,Math.min(ev.clientY,innerHeight-190))};render();return true;
 }
 return {render,openActor,openRole,openReplacement,openCloud,closeDialog,closePanel,contextMenu,
  isPinned:()=>pinned,refresh:()=>{if(panel||dialog)render();}};
}
