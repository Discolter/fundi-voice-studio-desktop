// A derived review queue: no duplicate task table and no changes to the vacation database.
// Only roles that still require an actor's recording are candidates for reassignment.
import {effectiveRoleDue} from './core.js';
import {rankActorsForRole} from './casting-assistant.js';

export const VACATION_REVIEW_STAGES=Object.freeze(['waiting','recording','retake']);

export function currentVacations(vacations=[]){
  const byActor=new Map();
  for(const item of Array.isArray(vacations)?vacations:[]){
    if(!item?.actorId||!['active','planned'].includes(item.status))continue;
    const previous=byActor.get(item.actorId);
    if(!previous||item.status==='active'&&previous.status!=='active')
      byActor.set(item.actorId,item);
  }
  return byActor;
}

export function vacationReviewRows(state,vacations=[]){
  const byActor=currentVacations(vacations);
  const rows=[];
  for(const p of state?.projects||[]){
    if(p.archived)continue;
    for(const ep of p.episodes||[]){
      for(const r of ep.roles||[]){
        const vacation=byActor.get(r.actorId);
        if(!vacation||!VACATION_REVIEW_STAGES.includes(r.status))continue;
        // An already-due role before a *future* leave need not be transferred.
        const due=effectiveRoleDue(r,ep);
        if(vacation.status==='planned'&&due&&vacation.startDate&&due<vacation.startDate)continue;
        const actor=(state.actors||[]).find(a=>a.id===r.actorId);
        if(!actor)continue; // Cannot safely reassign a legacy name-only role.
        rows.push({p,ep,r,actor,vacation,due});
      }
    }
  }
  return rows.sort((a,b)=>
    (a.vacation.status==='active'?0:1)-(b.vacation.status==='active'?0:1)||
    a.actor.name.localeCompare(b.actor.name,'ru')||
    String(a.due||'9999-12-31').localeCompare(String(b.due||'9999-12-31'))||
    a.p.title.localeCompare(b.p.title,'ru')||
    String(a.ep.number||'').localeCompare(String(b.ep.number||''))||
    a.r.character.localeCompare(b.r.character,'ru'));
}

export function availableReplacementActors(state,vacations,oldActorId){
  const unavailable=currentVacations(vacations);
  const original=(state?.actors||[]).find(a=>a.id===oldActorId);
  return (state?.actors||[])
    .filter(actor=>actor.id!==oldActorId&&!unavailable.has(actor.id))
    .sort((a,b)=>
      Number(b.voiceGroup===original?.voiceGroup)-Number(a.voiceGroup===original?.voiceGroup)||
      Number(b.castGroup===original?.castGroup)-Number(a.castGroup===original?.castGroup)||
      a.name.localeCompare(b.name,'ru'));
}

export function reassignVacationRole(state,vacations,{projectId,episodeId,roleId,previousActorId,newActorId}){
  const row=vacationReviewRows(state,vacations).find(({p,ep,r})=>
    p.id===projectId&&ep.id===episodeId&&r.id===roleId);
  if(!row)throw new Error('Роль больше не требует пересмотра. Обнови список.');
  if(row.r.actorId!==previousActorId)throw new Error('Исполнитель роли уже изменён. Обнови список.');
  const target=rankActorsForRole(state,row.ep,row.r,vacations,{excludeActorId:previousActorId})
    .find(candidate=>candidate.actor.id===newActorId)?.actor;
  if(!target)throw new Error('Новый исполнитель не найден, находится в отпуске или не подходит по типу голоса роли.');
  // Preserve role ID, character, timings, notes, line count, deadlines and file links.
  // Retake/recording statuses belong to the previous actor and cannot carry over.
  row.r.actorId=target.id;
  row.r.actor=target.name;
  row.r.status='waiting';
  row.r.reviewSeen=0;
  return {project:row.p,episode:row.ep,role:row.r,previousActor:row.actor,newActor:target};
}
