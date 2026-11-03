// Owner-only, read-only actor delivery analytics. No synthetic dates for legacy roles.
const isIso = x => typeof x==='string' && Number.isFinite(Date.parse(x)) && /T/.test(x);
const date = x => isIso(x)?x:'';
const empty = () => ({assignedAt:'',firstSubmittedAt:'',submittedDue:'',retakes:[]});
const active = new Set(['waiting','recording','retake']);
const delivered = new Set(['received','processing','processed']);
const dayEnd = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? new Date(value+'T23:59:59.999').getTime() : NaN;
const elapsedDays = (from,to) => (Date.parse(to)-Date.parse(from))/86400000;
export function normalizeDelivery(raw){
  const d=raw&&typeof raw==='object'?raw:{};
  return {assignedAt:date(d.assignedAt),firstSubmittedAt:date(d.firstSubmittedAt),
    submittedDue:typeof d.submittedDue==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.submittedDue)?d.submittedDue:'',
    retakes:Array.isArray(d.retakes)?d.retakes.slice(-30).map(r=>({requestedAt:date(r?.requestedAt),submittedAt:date(r?.submittedAt)})).filter(r=>r.requestedAt):[]};
}
export function roleDeliverySnapshot(state){
  const snapshot=new Map();
  for(const p of state.projects||[])for(const ep of p.episodes||[])for(const r of ep.roles||[]){
    snapshot.set(r.id,{actorId:r.actorId||'',status:r.status||'waiting'});
  }
  return snapshot;
}
// Run immediately before persistence, with the previous saved view of the roster.
// This captures NEW transitions only; already-existing legacy roles have unknown assignment times.
export function trackRoleDeliveries(state,previous,now=new Date().toISOString()){
  const next=roleDeliverySnapshot(state);
  for(const p of state.projects||[])for(const ep of p.episodes||[])for(const r of ep.roles||[]){
    const actorId=r.actorId||'',before=previous?.get(r.id);
    if(!actorId)continue;
    let d=normalizeDelivery(r.delivery);
    if((before&&before.actorId!==actorId)||(!before&&!d.assignedAt&&r.status==='waiting')){
      d=empty();d.assignedAt=now;
    }
    if(before&&before.actorId===actorId&&before.status!==r.status){
      if(r.status==='retake'&&before.status!=='retake'){
        d.retakes.push({requestedAt:now,submittedAt:''});d.retakes=d.retakes.slice(-30);
      }
      if(delivered.has(r.status)&&!delivered.has(before.status)){
        if(!d.firstSubmittedAt){d.firstSubmittedAt=now;d.submittedDue=r.due||ep.due||'';}
        const pending=[...d.retakes].reverse().find(item=>!item.submittedAt);
        if(pending&&before.status==='retake')pending.submittedAt=now;
      }
    }
    r.delivery=d;
  }
  return next;
}
function vacationOverlaps(vacations,actorId,start,end){
  const from=Date.parse(start),to=Date.parse(end);
  if(!Number.isFinite(from)||!Number.isFinite(to))return false;
  return (vacations||[]).some(v=>{
    if(v.actorId!==actorId||!v.startDate)return false;
    const a=Date.parse(v.startDate+'T00:00:00'),b=v.endDate?Date.parse(v.endDate+'T23:59:59'):v.status==='active'?Date.now():NaN;
    // A planned absence without a known end is not yet a historical interval.
    return Number.isFinite(a)&&Number.isFinite(b)&&a<=to&&b>=from;
  });
}
function average(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}
export function actorDeliveryRows(state,{vacations=[],now=new Date(),query='',sort='speed',includeArchived=true}={}){
  const today=now instanceof Date?now:new Date(now);
  const current=today.getTime();
  const byId=new Map((state.actors||[]).map(actor=>[actor.id,{
    actor,assigned:0,accepted:0,waiting:0,inReview:0,overdue:0,retakes:0,
    speedDays:[],retakeDays:[],onTime:0,withDeadline:0,excludedVacations:0
  }]));
  for(const p of state.projects||[]){
    if(!includeArchived&&p.archived)continue;
    for(const ep of p.episodes||[])for(const role of ep.roles||[]){
      const row=byId.get(role.actorId);if(!row)continue;
      row.assigned++;
      const v=(vacations||[]).find(v=>v.actorId===role.actorId&&v.status==='active');
      const due=role.due||ep.due||'';
      const status=role.status||'waiting';
      if(status==='done')row.accepted++;
      else if(active.has(status)){
        row.waiting++;
        if(!v&&Number.isFinite(dayEnd(due))&&dayEnd(due)<current)row.overdue++;
      }else if(delivered.has(status))row.inReview++;
      if(status==='retake')row.retakes++;
      const d=normalizeDelivery(role.delivery);
      row.retakes+=d.retakes.length-(status==='retake'&&d.retakes.some(x=>!x.submittedAt)?1:0);
      if(d.assignedAt&&d.firstSubmittedAt&&Date.parse(d.firstSubmittedAt)>=Date.parse(d.assignedAt)){
        if(vacationOverlaps(vacations,role.actorId,d.assignedAt,d.firstSubmittedAt))row.excludedVacations++;
        else{
          row.speedDays.push(elapsedDays(d.assignedAt,d.firstSubmittedAt));
          if(d.submittedDue&&Number.isFinite(dayEnd(d.submittedDue))){
            row.withDeadline++;if(Date.parse(d.firstSubmittedAt)<=dayEnd(d.submittedDue))row.onTime++;
          }
        }
      }
      for(const cycle of d.retakes)if(cycle.submittedAt&&Date.parse(cycle.submittedAt)>=Date.parse(cycle.requestedAt)){
        if(!vacationOverlaps(vacations,role.actorId,cycle.requestedAt,cycle.submittedAt))
          row.retakeDays.push(elapsedDays(cycle.requestedAt,cycle.submittedAt));
      }
    }
  }
  const q=String(query).toLocaleLowerCase('ru').trim();
  const rows=[...byId.values()].filter(row=>!q||[row.actor.name,row.actor.telegram,row.actor.notes].some(v=>String(v||'').toLocaleLowerCase('ru').includes(q)))
    .map(row=>({...row,averageDays:average(row.speedDays),averageRetakeDays:average(row.retakeDays),
      onTimePercent:row.withDeadline?Math.round(100*row.onTime/row.withDeadline):null,
      speedCount:row.speedDays.length,retakeCount:row.retakeDays.length}));
  const alpha=(a,b)=>a.actor.name.localeCompare(b.actor.name,'ru');
  const missing=(value,other)=>value===null?other===null?0:1:other===null?-1:0;
  const cmp=(a,b)=>sort==='name'?alpha(a,b):
    sort==='overdue'?b.overdue-a.overdue||alpha(a,b):
    sort==='accepted'?b.accepted-a.accepted||alpha(a,b):
    sort==='onTime'?missing(a.onTimePercent,b.onTimePercent)||((b.onTimePercent??0)-(a.onTimePercent??0))||alpha(a,b):
    missing(a.averageDays,b.averageDays)||((a.averageDays??0)-(b.averageDays??0))||alpha(a,b);
  return rows.sort(cmp);
}
export function actorDeliverySummary(rows){
  const values=rows.flatMap(r=>r.speedDays);
  const tested=rows.reduce((n,r)=>n+r.withDeadline,0);
  const onTime=rows.reduce((n,r)=>n+r.onTime,0);
  return {avgDays:average(values),sampleCount:values.length,onTimePercent:tested?Math.round(100*onTime/tested):null,
    tested,overdue:rows.reduce((n,r)=>n+r.overdue,0),accepted:rows.reduce((n,r)=>n+r.accepted,0)};
}
