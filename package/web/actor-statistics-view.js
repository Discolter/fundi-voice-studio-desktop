import {actorDeliveryRows,actorDeliverySummary} from './actor-statistics.js';

export function actorSubtabs(ui,icon){
  return `<div class="actor-subtabs" role="tablist" aria-label="Раздел актёров">
    <button type="button" role="tab" aria-selected="${ui.actorSubtab==='list'}" class="${ui.actorSubtab==='list'?'active':''}" data-action="actor-subtab" data-value="list">${icon('users')}Список актёров</button>
    <button type="button" role="tab" aria-selected="${ui.actorSubtab==='stats'}" class="${ui.actorSubtab==='stats'?'active':''}" data-action="actor-subtab" data-value="stats">${icon('workload')}Статистика</button>
  </div>`;
}
function days(value){
  if(value===null)return '—';
  if(value<1)return (value*24).toLocaleString('ru-RU',{maximumFractionDigits:1})+' ч';
  return value.toLocaleString('ru-RU',{maximumFractionDigits:1})+' дн.';
}
export function renderActorStatistics(state,cloud,ui,{e,icon,options,heading,vacationTag}){
  const settings={vacations:cloud.vacations||[],now:new Date(),query:ui.query,sort:ui.actorStatSort,includeArchived:ui.actorStatIncludeArchive};
  const rows=actorDeliveryRows(state,settings);
  const summary=actorDeliverySummary(actorDeliveryRows(state,{...settings,query:''}));
  const metric=(caption,value,hint='')=>`<div class="actor-stat-tile"><small>${e(caption)}</small><strong>${e(String(value))}</strong>${hint?`<span>${e(hint)}</span>`:''}</div>`;
  let html=heading('Актёры','',`<button type="button" class="btn primary" data-action="new-actor">${icon('plus')}Добавить актёра</button>`)+actorSubtabs(ui,icon);
  html+=`<div class="actor-stat-overview">${metric('Средняя сдача',days(summary.avgDays),summary.sampleCount+' замеров')}${metric('Сдача в срок',summary.onTimePercent===null?'—':summary.onTimePercent+'%',summary.tested+' с дедлайном')}${metric('Просрочено',summary.overdue,'только текущие долги')}${metric('Принято записей',summary.accepted)}</div>`;
  html+=`<div class="actor-stat-toolbar"><label>Сортировать <select id="actor-stat-sort">${options([['speed','Сначала быстрые'],['onTime','Сначала пунктуальные'],['overdue','Больше просрочек'],['accepted','Больше принятых'],['name','По имени']],ui.actorStatSort)}</select></label><label class="actor-stat-archive"><input id="actor-stat-include-archive" type="checkbox" ${ui.actorStatIncludeArchive?'checked':''}>Учитывать архив</label></div>`;
  if(!rows.length)return html+'<div class="actor-stat-empty">Актёры не найдены. Измени поисковый запрос.</div>';
  html+=`<div class="table-wrap actor-stat-table-wrap"><table class="actor-stat-table"><thead><tr><th>Актёр</th><th>Средняя сдача</th><th>В срок</th><th>Принято</th><th>На запись</th><th>Просрочено</th><th>Перезаписи</th></tr></thead><tbody>`;
  for(const x of rows){
    const a=x.actor;
    const avatar=a.avatar?`<img src="${e(a.avatar)}" alt="" loading="lazy">`:e((a.name||'?').trim().slice(0,2).toUpperCase());
    const onTime=x.onTimePercent===null?'—':x.onTimePercent+'%';
    const tier=x.onTimePercent===null?'unknown':x.onTimePercent>=90?'good':x.onTimePercent>=70?'medium':'late';
    html+=`<tr><td><button type="button" class="actor-stat-person" data-action="actor-details" data-actor="${e(a.id)}"><span class="actor-stat-avatar">${avatar}</span><span><strong>${e(a.name)}</strong><small>${a.telegram?'@'+e(a.telegram):'Нет Telegram'}</small></span></button>${vacationTag(a.id)}</td><td><strong>${e(days(x.averageDays))}</strong><small>${x.speedCount?'По '+x.speedCount+' записям':'Нет точных дат'}</small></td><td><span class="actor-stat-percent ${tier}">${onTime}</span><small>${x.withDeadline?'Из '+x.withDeadline+' записей':'Без подтверждённых сроков'}</small></td><td>${x.accepted}</td><td>${x.waiting}</td><td><strong class="${x.overdue?'actor-stat-warning':''}">${x.overdue}</strong></td><td>${x.retakes}${x.retakeCount?`<small>Среднее: ${e(days(x.averageRetakeDays))}</small>`:''}</td></tr>`;
  }
  html+='</tbody></table></div>';
  html+='<p class="actor-stat-note">Скорость считается только по новым назначениям с зафиксированной сдачей. Для старых записей без истории показан прочерк. Процент в срок — по первой сдаче и известному дедлайну; доступные периоды отпуска исключаются из замеров. Текущие отпуска не считаются просрочками. Статистика доступна только руководителю Studio.</p>';
  if(!cloud.connected)html+='<p class="actor-stat-note">Cloud не подключён: информация об отпусках может быть неполной.</p>';
  return html;
}
