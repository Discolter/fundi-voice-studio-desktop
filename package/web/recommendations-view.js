// Presentation for Studio's read-only smart recommendations.
const TITLES={
  received:'Проверить полученную запись',
  processing:'Завершить обработку персонажа',
  remind:'Напомнить актёру о записи',
  'vacation-return':'Скоро закончится отпуск',
  'vacation-start':'Скоро начнётся отпуск',
  assign:'Назначить актёра',
  reassign:'Переназначить роль',
  'finish-episode':'Завершить серию',
  'deadline-risk':'Проверить сроки проекта',
  workload:'Проверить нагрузку актёра',
  task:'Завершить поручение'
};
const isImage = value=>typeof value==='string'&&value.length<710000&&/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(value);
const urgencyLabel=n=>n>=4?'Просрочено':n>=3?'Срочно':n===2?'По сроку':'Планово';
const urgencyClass=n=>n>=3?'urgent':n===2?'soon':'normal';
const roleStatus=r=>({received:'Получено',processing:'Обрабатываю',waiting:'Жду запись',retake:'На перезапись',recording:'В записи'}[r?.status]||'');
const escapeData = (fn,s)=>fn(String(s==null?'':s));
function avatar(actor,e){
  if(!actor)return '';
  const img=isImage(actor.avatarPreview)?actor.avatarPreview:isImage(actor.avatar)?actor.avatar:'';
  return '<span class="rec-avatar" title="'+e(actor.name||'Актёр')+'">'+
    (img?'<img src="'+e(img)+'" alt="" loading="lazy">':e(String(actor.name||'?').slice(0,2).toLocaleUpperCase('ru')))+'</span>';
}
function pictures(item,e,icon){
  const cover=isImage(item.project?.cover)?item.project.cover:'';
  const roleImage=isImage(item.role?.image)?item.role.image:'';
  return '<div class="rec-visual">'+
    (cover?'<img class="rec-poster" src="'+e(cover)+'" alt="" loading="lazy">':
      '<span class="rec-poster rec-placeholder">'+icon(item.project?'folder':item.actor?'users':'spark')+'</span>')+
    (roleImage?'<img class="rec-character" src="'+e(roleImage)+'" alt="" loading="lazy">':'')+
    avatar(item.actor,e)+'</div>';
}
function buttons(item,e,icon){
  const main=item.type==='remind'?'<button class="btn primary small" data-action="recommend-remind" data-rec="'+e(item.id)+'">'+icon('chat')+'Сообщение</button>':
  item.role?'<button class="btn primary small" data-qv-open="role" data-qv-project="'+e(item.project.id)+'" data-qv-episode="'+e(item.episode.id)+'" data-qv-role="'+e(item.role.id)+'">'+icon('arrow')+'Карточка роли</button>':
  item.type==='task'||item.episode?'<button class="btn primary small" data-action="recommend-open-episode" data-project="'+e(item.project.id)+'" data-episode="'+e(item.episode.id)+'" data-tab="'+(item.type==='task'?'tasks':'roles')+'">'+icon('arrow')+'Открыть серию</button>':
  item.actor?'<button class="btn primary small" data-qv-open="actor" data-qv-actor="'+e(item.actor.id)+'">'+icon('users')+'Открыть актёра</button>':'';
  const secondary=item.type==='remind'||item.type==='workload'?
     '<button class="btn ghost small" data-qv-open="actor" data-qv-actor="'+e(item.actor.id)+'">Актёр</button>':
     (item.type==='vacation-start'||item.type==='vacation-return')?
     '<button class="btn ghost small" data-nav="vacations">Отпуска</button>':'';
  return '<div class="rec-card-actions">'+main+secondary+
    '<button class="btn ghost small rec-defer" data-action="recommend-snooze" data-rec="'+e(item.id)+'" title="Убрать рекомендацию на сутки">'+icon('clock')+'На завтра</button>'+
    '<button class="rec-dismiss" data-action="recommend-hide" data-rec="'+e(item.id)+'" aria-label="Скрыть рекомендацию" title="Скрыть до изменения данных">'+icon('close')+'</button></div>';
}
function card(item,e,icon){
  const meta=[];
  if(item.project)meta.push(item.project.title);
  if(item.episode)meta.push('Серия '+(item.episode.number||item.episode.title||'?'));
  if(item.role)meta.push(item.role.character||'Персонаж');
  if(item.actor)meta.push(item.actor.name||'Актёр');
  if(item.task)meta.push(item.task.title||'Поручение');
  return '<article class="rec-card" data-severity="'+urgencyClass(item.priority)+'">'+
    pictures(item,e,icon)+
    '<div class="rec-card-body"><div class="rec-tags"><span class="rec-priority">'+urgencyLabel(item.priority)+'</span>'+
    '<span class="rec-effort">'+icon('clock')+' ≈ '+item.effort+' мин</span>'+
    (item.role?'<span class="rec-role-status">'+e(roleStatus(item.role))+'</span>':'')+'</div>'+
    '<h3>'+e(TITLES[item.type]||'Проверить задачу')+'</h3>'+
    '<p class="rec-context">'+meta.map(v=>e(v)).join(' · ')+'</p>'+
    '<p class="rec-explain">'+e(item.detail||'')+'</p>'+
    buttons(item,e,icon)+'</div></article>';
}
export function renderRecommendationPage(items,{sort='easy',filter='all',icon,escapeHTML}={}){
  const e=value=>escapeData(escapeHTML,value);
  const urgent=items.filter(x=>x.priority>=3).length;
  const quick=items.filter(x=>x.effort<=5).length;
  const tabs=[['all','Все',items.length],['quick','Быстрые',quick],['urgent','Срочные',urgent],['actors','Актёры',items.filter(x=>!!x.actor).length],['projects','Проекты',items.filter(x=>!!x.project).length]];
  const filtered=items.filter(x=>
    filter==='quick'?x.effort<=5:filter==='urgent'?x.priority>=3:filter==='actors'?!!x.actor:filter==='projects'?!!x.project:true);
  const visible=filtered.slice(0,120);
  return '<section class="rec-page">'+
    '<div class="page-head rec-head"><div><h1>Рекомендации</h1><span class="heading-meta">Умный обзор состояния проектов, ролей и актёров · без автоматического изменения статусов</span></div>'+
    '<div class="page-actions"><button class="btn ghost" data-action="refresh-all">'+icon('refresh')+'Обновить данные</button></div></div>'+
    '<div class="rec-summary">'+
    '<div><strong>'+items.length+'</strong><span>Актуальных</span></div>'+
    '<div><strong>'+urgent+'</strong><span>Срочных</span></div>'+
    '<div><strong>'+quick+'</strong><span>Быстрых задач</span></div></div>'+
    '<div class="rec-toolbar"><div class="rec-filters">'+tabs.map(([key,name,count])=>
       '<button class="rec-filter '+(filter===key?'active':'')+'" data-action="recommend-filter" data-filter-value="'+key+'">'+name+' <span>'+count+'</span></button>').join('')+'</div>'+
    '<div class="rec-sort" role="group" aria-label="Сортировать рекомендации">'+
    '<button data-action="recommend-sort" data-sort="easy" class="'+(sort==='easy'?'active':'')+'">От лёгких</button>'+
    '<button data-action="recommend-sort" data-sort="urgent" class="'+(sort==='urgent'?'active':'')+'">По срочности</button></div></div>'+
    (visible.length?'<div class="rec-list">'+visible.map(x=>card(x,e,icon)).join('')+'</div>':
       '<div class="rec-empty">'+icon('check')+'<h3>Всё под контролем</h3><p>По выбранному фильтру нет задач, требующих внимания. Рекомендации появятся после изменения статусов, дедлайнов или отпусков.</p></div>')+
    (filtered.length>visible.length?'<p class="rec-footer">Показаны первые '+visible.length+' из '+filtered.length+' рекомендаций. Отсортируй или выбери фильтр.</p>':'')+
    '<p class="rec-footer">«На завтра» скрывает совет на 24 часа. «Скрыть» — до изменения связанных данных. Напоминания актёрам не отправляются без твоего действия.</p>'+
    '</section>';
}
