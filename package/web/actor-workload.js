// Actor workload overview is a READ-ONLY summary across the selected project scope.
// This is an advisory distribution metric, never a judgment of acting performance.
export const VOICE_WORK_STAGES=Object.freeze(['waiting','recording','retake']);
export const IN_REVIEW_STAGES=Object.freeze(['received','processing','processed']);
const knownLines=role=>Number.isInteger(role?.lineCount)&&role.lineCount>=0?role.lineCount:null;
export function actorWorkloadRows(state,{includeArchived=false,query=''}={}){
  const people=(state?.actors||[]).map(actor=>({
    actor,pending:0,pendingLines:0,pendingUnknown:0,inReview:0,accepted:0,
    total:0,allLines:0,allUnknown:0,projects:new Set(),assignments:[]}));
  const byId=new Map(people.map(x=>[x.actor.id,x]));
  const projects=(state?.projects||[]).filter(p=>includeArchived||!p.archived);
  for(const project of projects)for(const episode of project.episodes||[])for(const role of episode.roles||[]){
    const item=byId.get(role.actorId);if(!item)continue;
    item.total++;
    item.projects.add(project.id);
    const lines=knownLines(role);
    if(lines===null)item.allUnknown++;else item.allLines+=lines;
    if(VOICE_WORK_STAGES.includes(role.status)){
      item.pending++;
      if(lines===null)item.pendingUnknown++;else item.pendingLines+=lines;
    }else if(IN_REVIEW_STAGES.includes(role.status)){item.inReview++;}
    else if(role.status==='done'){item.accepted++;}
    item.assignments.push({projectId:project.id,episodeId:episode.id,roleId:role.id,character:role.character,status:role.status,lineCount:lines});
  }
  const q=String(query||'').trim().toLocaleLowerCase('ru');
  return people.filter(item=>!q||[item.actor.name,item.actor.telegram||'',item.actor.notes||'']
    .some(text=>text.toLocaleLowerCase('ru').includes(q))).map(item=>{
    // 50 known lines approximate one small assignment. The workload index is deliberately
    // transparent and shows both source metrics, without treating accepted roles as work.
    const score=Math.max(item.pending,Math.ceil(item.pendingLines/50));
    const tier=score>=6?'high':score<=2?'low':'medium';
    return {...item,projectsCount:item.projects.size,score,tier};
  }).sort((a,b)=>b.score-a.score||b.pending-a.pending||
    b.pendingLines-a.pendingLines||a.actor.name.localeCompare(b.actor.name,'ru',{sensitivity:'base'}));
}
export function actorWorkloadGroups(rows){
  return {
    high:rows.filter(x=>x.tier==='high'),
    medium:rows.filter(x=>x.tier==='medium'),
    low:rows.filter(x=>x.tier==='low').sort((a,b)=>a.score-b.score||
      a.pending-b.pending||a.actor.name.localeCompare(b.actor.name,'ru',{sensitivity:'base'}))
  };
}
