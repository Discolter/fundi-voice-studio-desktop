// A derived review queue: no duplicate task table and no changes to the vacation database.
// Only roles that still require an actor's recording are candidates for reassignment.
import {effectiveRoleDue} from './core.js';
import {rankActorsForRole,applyRoleVoiceFromActor} from './casting-assistant.js';

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


export const REVIEW_CANDIDATE_LIMIT=50;

// Shortlists live only inside the Studio workspace. They never create actor assignments.
export function vacationReviewCandidates(state,role,vacations=[]){
  const unavailable=currentVacations(vacations);
  const byId=new Map((state?.actors||[]).map(a=>[a.id,a]));
  return (Array.isArray(role?.reviewCandidates)?role.reviewCandidates:[])
    .map(id=>byId.get(id))
    .filter(actor=>actor&&actor.id!==role.actorId)
    .map(actor=>({actor,vacation:unavailable.get(actor.id)||null}));
}

function reviewRow(state,vacations,{projectId,episodeId,roleId}){
  const row=vacationReviewRows(state,vacations).find(({p,ep,r})=>
    p.id===projectId&&ep.id===episodeId&&r.id===roleId);
  if(!row)throw new Error('Роль больше не требует пересмотра. Обнови список.');
  return row;
}

// Adding several candidates is an owner-only draft: no roster, status or Cloud changes.
export function addVacationReviewCandidates(state,vacations,{projectId,episodeId,roleId,actorIds}){
  const row=reviewRow(state,vacations,{projectId,episodeId,roleId});
  if(!Array.isArray(actorIds)||!actorIds.length)throw new Error('Выбери хотя бы одного кандидата.');
  const allowed=new Set(rankActorsForRole(state,row.ep,row.r,vacations,{
    excludeActorId:row.actor.id,showAll:true
  }).map(x=>x.actor.id));
  const ids=[...new Set(actorIds)];
  if(ids.some(id=>typeof id!=='string'||!allowed.has(id)))
    throw new Error('Кандидат удалён, занят отпуском или больше недоступен. Обнови список.');
  const current=Array.isArray(row.r.reviewCandidates)?row.r.reviewCandidates:[];
  const combined=[...new Set([...current,...ids])];
  if(combined.length>REVIEW_CANDIDATE_LIMIT)
    throw new Error('Для одной роли можно сохранить не более '+REVIEW_CANDIDATE_LIMIT+' кандидатов.');
  row.r.reviewCandidates=combined;
  return {project:row.p,role:row.r,added:combined.length-current.length};
}

export function removeVacationReviewCandidate(state,vacations,{projectId,episodeId,roleId,actorId}){
  const row=reviewRow(state,vacations,{projectId,episodeId,roleId});
  const current=Array.isArray(row.r.reviewCandidates)?row.r.reviewCandidates:[];
  if(!current.includes(actorId))throw new Error('Этого актёра уже нет среди кандидатов.');
  row.r.reviewCandidates=current.filter(id=>id!==actorId);
  return {project:row.p,role:row.r};
}

export function reassignVacationRole(state,vacations,{projectId,episodeId,roleId,previousActorId,newActorId,showAllActors=false}){
  const row=vacationReviewRows(state,vacations).find(({p,ep,r})=>
    p.id===projectId&&ep.id===episodeId&&r.id===roleId);
  if(!row)throw new Error('Роль больше не требует пересмотра. Обнови список.');
  if(row.r.actorId!==previousActorId)throw new Error('Исполнитель роли уже изменён. Обнови список.');
  const target=rankActorsForRole(state,row.ep,row.r,vacations,{excludeActorId:previousActorId,showAll:showAllActors===true})
    .find(candidate=>candidate.actor.id===newActorId)?.actor;
  if(!target)throw new Error('Новый исполнитель не найден, в отпуске или не подходит по типу голоса. Для нестандартного кастинга включи «Показать всех актёров».');
  // Preserve role ID, character, timings, notes, line count, deadlines and file links.
  // Retake/recording statuses belong to the previous actor and cannot carry over.
  applyRoleVoiceFromActor(row.r,row.actor); // Lock voice type inherited from outgoing performer.
  row.r.actorId=target.id;
  row.r.actor=target.name;
  row.r.status='waiting';
  row.r.reviewSeen=0;
  row.r.reviewCandidates=[]; // Resolved queue: do not carry prospects to a new assignee.
  return {project:row.p,episode:row.ep,role:row.r,previousActor:row.actor,newActor:target};
}
