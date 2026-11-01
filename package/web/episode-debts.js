import {episodeLabel} from './core.js';
export const OUTSTANDING_ROLE_STATUSES=new Set(['waiting','retake']);

export function outstandingEpisodeRoles(episode){
  return (episode?.roles||[]).filter(r=>OUTSTANDING_ROLE_STATUSES.has(r.status));
}
export function outstandingCastMessage(state,project,episode){
  const rows=outstandingEpisodeRoles(episode),groups=new Map();
  for(const role of rows){
    const actor=(state.actors||[]).find(a=>a.id===role.actorId);
    const name=actor?.name||role.actor||'Не назначен';
    const telegram=(actor?.telegram||'').trim().replace(/^@/,'');
    const key=actor?.id||'legacy:'+name;
    if(!groups.has(key))groups.set(key,{name,telegram,roles:[]});
    groups.get(key).roles.push(role);
  }
  const counts={waiting:rows.filter(r=>r.status==='waiting').length,retake:rows.filter(r=>r.status==='retake').length};
  const heading='📣 Ожидаются записи — '+project.title+' · '+episodeLabel(project,episode);
  if(!rows.length)return heading+'\n\nВсе назначенные роли отправлены на проверку или приняты. Долгов по выбранным статусам нет.';
  const ordered=[...groups.values()].sort((a,b)=>a.name==='Не назначен'?1:b.name==='Не назначен'?-1:a.name.localeCompare(b.name,'ru'));
  return heading+'\n'+'Жду запись: '+counts.waiting+' · На перезапись: '+counts.retake+'\n\n'+
    ordered.map(g=>(g.telegram?'@'+g.telegram:g.name)+'\n'+g.roles.map(r=>'• '+r.character+' — '+(r.status==='retake'?'🔁 На перезапись':'⏳ Жду запись')).join('\n')).join('\n\n');
}
