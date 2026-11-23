// Owner-only deleted task records. They never enter actor feeds or task snapshots.
const text=(value,max=500)=>typeof value==='string'?value.slice(0,max):'';
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
  Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value?value:'';
const priorities=new Set(['urgent','high','normal','low']);
const sources=new Set(['deleted','cloud','backup']);
const activeTasks=state=>[...(state.projects||[]),...(state.trash||[])]
  .flatMap(p=>(p.episodes||[]).flatMap(ep=>ep.tasks||[]));
const historyKey=(projectId,episodeId,taskId)=>JSON.stringify([projectId,episodeId,taskId]);
const activeKeys=state=>new Set([...(state.projects||[]),...(state.trash||[])]
  .flatMap(p=>(p.episodes||[]).flatMap(ep=>(ep.tasks||[]).map(t=>historyKey(p.id,ep.id,t.id)))));
const eventTime=entry=>[entry.deletedAt,entry.recoveredAt,entry.restoredAt].filter(Boolean).sort().at(-1)||'';

export function taskRoleIds(task){
  const ids=Array.isArray(task?.roleIds)?task.roleIds:[task?.roleId];
  return [...new Set(ids.map(id=>text(id,80)).filter(Boolean))].slice(0,2000);
}

export function taskRoleFields(task){
  const roleIds=taskRoleIds(task);
  return Array.isArray(task?.roleIds)?{roleId:roleIds[0]||'',roleIds}:{roleId:roleIds[0]||''};
}

export function normalizeTaskHistory(value){
  const entries=new Map();
  for(const entry of Array.isArray(value)?value:[]){
    if(!entry||typeof entry!=='object'||!entry.task||typeof entry.task!=='object')continue;
    const t=entry.task,taskId=text(t.id,80),title=text(t.title).trim();
    if(!taskId||!title)continue;
    const id=historyKey(text(entry.projectId,80),text(entry.episodeId,80),taskId);
    const record={id,projectId:text(entry.projectId,80),projectTitle:text(entry.projectTitle,160),
      season:text(entry.season,4),episodeId:text(entry.episodeId,80),
      episodeNumber:text(entry.episodeNumber,4),episodeTitle:text(entry.episodeTitle,120),
      actorName:text(entry.actorName,200),character:text(entry.character,2000),
      lineCount:Number.isInteger(entry.lineCount)&&entry.lineCount>=0?entry.lineCount:null,
      deletedAt:text(entry.deletedAt,50),recoveredAt:text(entry.recoveredAt,50),restoredAt:text(entry.restoredAt,50),
      source:sources.has(entry.source)?entry.source:'backup',recoveredFrom:text(entry.recoveredFrom,260),
      task:{id:taskId,title,done:!!t.done,mine:!!t.mine,due:date(t.due),
        priority:priorities.has(t.priority)?t.priority:'normal',actorId:text(t.actorId,80),...taskRoleFields(t)}};
    const prior=entries.get(id);
    if(!prior||eventTime(record)>=eventTime(prior))entries.set(id,record);
  }
  return [...entries.values()].sort((a,b)=>eventTime(b).localeCompare(eventTime(a))||a.id.localeCompare(b.id));
}

export function mergeTaskHistory(state,entries=[]){
  const active=activeKeys(state);
  const next=normalizeTaskHistory([...(state.taskHistory||[]),...entries]).map(entry=>
    active.has(entry.id)&&!entry.restoredAt?{...entry,restoredAt:new Date().toISOString()}:entry);
  const changed=JSON.stringify(next)!==JSON.stringify(state.taskHistory||[]);
  state.taskHistory=next;
  return changed;
}

export function archiveTask(state,project,episode,task,source='deleted'){
  if(!task)return false;
  const roleIds=taskRoleIds(task);
  const roles=roleIds.map(id=>(episode.roles||[]).find(r=>r.id===id)).filter(Boolean);
  const actorId=roleIds.length>1?task.actorId:roles[0]?.actorId||task.actorId;
  const actor=(state.actors||[]).find(a=>a.id===actorId);
  const lineCount=roles.length&&roles.length===roleIds.length&&roles.every(r=>Number.isInteger(r.lineCount)&&r.lineCount>=0)?
    roles.reduce((sum,r)=>sum+r.lineCount,0):null;
  const record={projectId:project.id,projectTitle:project.title,season:String(project.season||''),
    episodeId:episode.id,episodeNumber:String(episode.number||''),episodeTitle:episode.title||'',
    actorName:actor?.name||roles[0]?.actor||'',character:roles.map(r=>r.character).join(', '),lineCount,
    deletedAt:new Date().toISOString(),recoveredAt:'',source,task:{...task}};
  state.taskHistory=normalizeTaskHistory([...(state.taskHistory||[]),record]);
  return true;
}

export function restoreTask(state,historyId,projectId,episodeId){
  const entry=(state.taskHistory||[]).find(item=>item.id===historyId&&!item.restoredAt);
  if(!entry)throw Error('Это поручение уже восстановлено.');
  const p=(state.projects||[]).find(p=>p.id===(projectId||entry.projectId));
  const ep=p?.episodes.find(ep=>ep.id===(episodeId||entry.episodeId));
  if(!ep)throw Error('Исходная серия удалена. Выбери проект и серию для восстановления.');
  if((ep.tasks||[]).some(t=>t.id===entry.task.id))throw Error('Такое поручение уже есть в этой серии.');
  if((ep.tasks||[]).length>=2000)throw Error('В серии уже 2000 задач. Выбери другую серию.');
  const task={...entry.task};
  if(activeTasks(state).some(t=>t.id===task.id))task.id=globalThis.crypto?.randomUUID?.()||`task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // A different series may have entirely different characters. Never invent a link.
  if(p.id!==entry.projectId||ep.id!==entry.episodeId)Object.assign(task,taskRoleFields({roleIds:[]}));
  ep.tasks=ep.tasks||[];ep.tasks.push(task);
  p.updatedAt=new Date().toISOString();
  entry.restoredAt=new Date().toISOString();
  return {p,ep,task};
}

export function taskHistoryRows(state,query=''){
  const q=query.trim().toLocaleLowerCase('ru');
  return (state.taskHistory||[]).filter(entry=>!entry.restoredAt&&(!q||[
    entry.task.title,entry.projectTitle,entry.season,entry.episodeNumber,entry.episodeTitle,
    entry.actorName,entry.character,entry.task.due
  ].join(' ').toLocaleLowerCase('ru').includes(q)));
}
