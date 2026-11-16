// Role/project/episode age is based on creation timestamps, never on the due date.
// Unknown legacy timestamps must not be replaced with today's date or guessed.
export function ageInfo(value, now=new Date()){
  if(typeof value!=='string'||!value.trim())return null;
  const start=new Date(value);
  if(!Number.isFinite(start.getTime()))return null;
  const dateOnly=d=>Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
  const today=dateOnly(now),initial=dateOnly(start);
  if(!Number.isFinite(today))return null;
  if(initial>today)return {days:0,label:'0 дн.',level:'green',date:start.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'})};
  const days=Math.max(0,Math.floor((today-initial)/86400000));
  const s=new Date(initial),n=new Date(today);
  let months=(n.getUTCFullYear()-s.getUTCFullYear())*12+n.getUTCMonth()-s.getUTCMonth();
  const anniversary=count=>{
    const year=s.getUTCFullYear(),month=s.getUTCMonth()+count;
    const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    return Date.UTC(year,month,Math.min(s.getUTCDate(),last));
  };
  months=Math.max(0,months);
  if(anniversary(months)>today)months--;
  const rest=Math.floor((today-anniversary(months))/86400000);
  const years=Math.floor(months/12),remMonths=months%12;
  const label=[years?years+' г.':'',remMonths?remMonths+' мес.':'',rest||!months?rest+' дн.':''].filter(Boolean).join(' ');
  return {days,label,level:days<=14?'green':days<=30?'yellow':'red',
    date:start.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'})};
}
export function ageBadge(value,showDate=false,estimated=false){
  const info=ageInfo(value);
  const text=info?(estimated?'≈ ':'')+info.label:'дата неизвестна';
  const title=info?(estimated?'Приблизительно: '+info.date+' · По самой ранней сохранённой дате роли серии; точную дату можно указать в настройках серии':'Создана: '+info.date+' · Возраст записи, не дедлайн'):'Дата создания не сохранена для старой записи';
  return '<span class="fv-age fv-age-'+(info?info.level:'unknown')+'" title="'+title+'">◷ '+text+(showDate&&info?'<small class="fv-age-date">'+info.date+'</small>':'')+'</span>';
}

// Legacy role timestamps are only an estimate; never write it to the creation field.
export function episodeAgeSource(episode,now=new Date()){
  if(ageInfo(episode?.createdAt,now))return {value:episode.createdAt,estimated:false};
  const first=(episode?.roles||[]).map(r=>r.createdAt).filter(v=>ageInfo(v,now)).sort((a,b)=>Date.parse(a)-Date.parse(b))[0];
  return {value:first||'',estimated:!!first};
}
export function episodeAgeBadge(episode,showDate=false){
  const {value,estimated}=episodeAgeSource(episode);
  return ageBadge(value,showDate,estimated);
}
