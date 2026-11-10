// Studio recommendation engine. Pure calculations over the *current* workspace snapshot.
// No background requests, automatic status changes, or messages to actors.
const DAY = 86400000;
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WORK = new Set(['waiting','recording','retake','pickup']);
const FINISHED = new Set(['done']);
const toDay = value => {
  const text = String(value || '').slice(0,10);
  if(!VALID_DATE.test(text))return null;
  const valueMs = Date.parse(text+'T12:00:00Z');
  return Number.isFinite(valueMs) && new Date(valueMs).toISOString().slice(0,10)===text ? text : null;
};
const utcDay = date => Date.UTC(+date.slice(0,4),+date.slice(5,7)-1,+date.slice(8,10));
const difference = (date, current) => date && current ? Math.round((utcDay(date)-utcDay(current))/DAY) : null;
const urgency = left => left===null?1:left<0?4:left<=1?3:left<=3?2:1;
const lines = r => Number.isInteger(r?.lineCount)&&r.lineCount>=0?r.lineCount:null;
const cost = (r,base=3) => Math.min(150,base+(lines(r)===null?8:Math.ceil(lines(r)/5)));
const identity = parts => parts.filter(v=>v!==undefined&&v!==null&&v!=='').join('|');
export const recommendationDay = date => {
  const d=date instanceof Date?date:new Date(date);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
export function collectRecommendations(state,cloud={},options={}){
  const now=options.now||new Date();
  const today=toDay(typeof now==='string'?now:recommendationDay(now))||recommendationDay(new Date());
  const actors=(state?.actors||[]),byActor=new Map(actors.map(a=>[a.id,a]));
  const vacations=Array.isArray(cloud?.vacations)&&cloud.connected!==false&&!cloud.vacationError&&!cloud.error?cloud.vacations:[];
  const byVacation=new Map(vacations.filter(v=>['active','planned'].includes(v.status)).map(v=>[v.actorId,v]));
  const items=[], reminders=new Map(), workloads=new Map();
  const push=(type,data)=>{
    const recommendation={type,priority:1,effort:5,...data};
    recommendation.id=identity([type,recommendation.project?.id,recommendation.episode?.id,recommendation.role?.id,recommendation.actor?.id,recommendation.task?.id]);
    recommendation.signature=identity([recommendation.id,recommendation.role?.status||'',recommendation.due||'',recommendation.actor?.retiredAt||'',recommendation.count||'',recommendation.vacation?.startDate||'',recommendation.vacation?.endDate||'',recommendation.episode?.stage||'']);
    items.push(recommendation);
  };
  for(const project of state?.projects||[]){
    if(project.archived||project.hidden)continue;
    for(const episode of project.episodes||[]){
      if(episode.stage==='done')continue;
      const roles=episode.roles||[],accepted=roles.filter(r=>r.status==='done').length,remaining=roles.length-accepted;
      const epDue=toDay(episode.due),epLeft=difference(epDue,today);
      if(roles.length&&remaining<=3){
        push('finish-episode',{project,episode,priority:remaining===0?2:1,effort:remaining===0?2:10+remaining*5,
          detail:remaining===0?'Все роли приняты. Можно завершить серию.':'Осталось принять '+remaining+' из '+roles.length+' ролей.',count:remaining});
      }
      if(roles.length&&epLeft!==null&&epLeft<=3&&remaining>3&&remaining/roles.length>=0.4){
        push('deadline-risk',{project,episode,due:epDue,priority:urgency(epLeft),effort:12,
          detail:(epLeft<0?'Дедлайн прошёл. ':epLeft===0?'Дедлайн сегодня. ':'Срок близко. ')+
          'Не приняты '+remaining+' из '+roles.length+' ролей.'});
      }
      for(const role of roles){
        if(FINISHED.has(role.status))continue;
        const actor=byActor.get(role.actorId);
        const missingActor=role.actorId&&actor?.retiredAt;
        const due=toDay(role.due)||epDue,until=difference(due,today);
        const base={project,episode,role,actor,due,priority:urgency(until)};
        if(missingActor){
          push('reassign',{...base,priority:3,effort:7,
            detail:'Актёр исключён из состава. Переназначь роль.'});
          continue;
        }
        if(!role.actorId&&!String(role.actor||'').trim()){
          push('assign',{...base,priority:until!==null&&until<=3?3:1,effort:5,
            detail:'На персонажа пока не назначен исполнитель.'});
          continue;
        }
        if(role.status==='received'){
          push('received',{...base,effort:Math.min(25,cost(role,2)),
            detail:'Материал получен и ожидает проверки или обработки.'});
        }else if(['processing','processed'].includes(role.status)){
          push('processing',{...base,effort:cost(role,15),
            detail:'Обработка начата, но роль ещё не принята.'});
        }else if(WORK.has(role.status)&&actor&&!actor.retiredAt){
          const vacation=byVacation.get(actor.id);
          const vacationStarts=difference(toDay(vacation?.startDate),today);
          const absent=vacation&&(vacation.status==='active'||vacation.status==='planned'&&(vacationStarts===null||vacationStarts<=0));
          const age=difference(toDay(role.createdAt),today);
          const waitingLong=age!==null&&age<=-7;
          const dueSoon=until!==null&&until<=3;
          if(!absent&&(dueSoon||(until===null&&waitingLong)||role.status==='retake'&&waitingLong)){
            const group=reminders.get(actor.id)||{actor,roles:[],priority:1,effort:2};
            group.roles.push(base);
            group.priority=Math.max(group.priority,urgency(until),role.status==='retake'?2:1);
            reminders.set(actor.id,group);
          }
          const load=workloads.get(actor.id)||{actor,count:0,knownLines:0,unknown:0};
          load.count++;if(lines(role)===null)load.unknown++;else load.knownLines+=lines(role);
          workloads.set(actor.id,load);
        }
      }
      for(const task of episode.tasks||[]){
        if(task.done)continue;
        const due=toDay(task.due),remainingDays=difference(due,today);
        if(remainingDays===null||remainingDays>3)continue;
        const actor=byActor.get(task.actorId);
        push('task',{project,episode,task,actor,due,priority:urgency(remainingDays),effort:5,
          detail:remainingDays<0?'Просрочено поручение.':'Поручение требует внимания до дедлайна.'});
      }
    }
  }
  for(const {actor,roles,priority} of reminders.values()){
    roles.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
    const first=roles[0],count=roles.length;
    push('remind',{...first,actor,priority,effort:2,count,
      detail:count===1?'Роль ожидает запись, перезапись или недостающие реплики.':'Нужно напомнить о '+count+' ожидающих записях.',
      linkedRoles:roles});
  }
  for(const {actor,count,knownLines,unknown} of workloads.values()){
    const score=Math.max(count,Math.ceil(knownLines/50));
    if(score<6)continue;
    push('workload',{actor,count,priority:score>=10?3:2,effort:10,
      detail:'У актёра '+count+' незавершённых записей'+(knownLines?' · '+knownLines+' реплик':'')+
        (unknown?' · '+unknown+' ролей без числа реплик':'')+'. Возможно, нужна помощь или перераспределение.'});
  }
  for(const vacation of vacations){
    if(!['active','planned'].includes(vacation.status))continue;
    const actor=byActor.get(vacation.actorId);if(!actor||actor.retiredAt)continue;
    const active=vacation.status==='active';
    const date=toDay(active?vacation.endDate:vacation.startDate);
    if(!date)continue; // "Бессрочно" must not imply an approaching return.
    const left=difference(date,today);
    if(left>3||left< -3)continue;
    push(active?'vacation-return':'vacation-start',{actor,vacation,due:date,priority:left<0?3:urgency(left),
      effort:3,detail:active?(left<0?'Указанный конец отпуска уже прошёл. Проверь состояние.':
        left===0?'Отпуск должен закончиться сегодня.':'До конца отпуска '+left+' дн.'):
        left<0?'Проверь, начался ли запланированный отпуск.':
        left===0?'Отпуск начинается сегодня.':'Отпуск начнётся через '+left+' дн.'});
  }
  return items;
}
const STORE='fundi-voice-recommendation-mutes-v1';
function readMutes(storage){
  try{const raw=JSON.parse(storage.getItem(STORE)||'{}');return raw&&typeof raw==='object'?raw:{};}catch{return {};}
}
export function visibleRecommendations(items,storage=globalThis.localStorage,now=Date.now()){
  if(!storage)return items;
  const muted=readMutes(storage);
  return items.filter(item=>{
    const m=muted[item.id];
    return !m||m.signature!==item.signature||m.until&&m.until<=now;
  });
}
export function muteRecommendation(item,{hours=0,storage=globalThis.localStorage,now=Date.now()}={}){
  if(!storage||!item?.id)return;
  const muted=readMutes(storage);
  muted[item.id]={signature:item.signature,until:hours>0?now+hours*3600000:0};
  const compact=Object.fromEntries(Object.entries(muted).slice(-250));
  try{storage.setItem(STORE,JSON.stringify(compact));}catch{}
}
export function sortRecommendations(items,sort='easy'){
  return [...items].sort((a,b)=>sort==='urgent'?
    b.priority-a.priority||a.effort-b.effort||a.id.localeCompare(b.id):
    a.effort-b.effort||b.priority-a.priority||a.id.localeCompare(b.id));
}
export function recommendationMessage(item){
  if(item?.type!=='remind'||!item.actor)return '';
  const lines=(item.linkedRoles||[item]).slice(0,8).map(x=>
    '• '+(x.project?.title||'Проект')+' · серия '+(x.episode?.number||'?')+' · '+(x.role?.character||'Роль')).join('\n');
  return 'Привет! Напоминаю о записи для Fundi Voice:\n'+lines+
    '\nПодскажи, пожалуйста, когда получится записать? Спасибо!';
}
