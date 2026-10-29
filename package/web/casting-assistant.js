// Casting is advisory only: voice type, episode repetition, current workload and leave.
// No automatic reassignment, and no claims about the actual timbre of an actor's voice.
export const ROLE_VOICE_OPTIONS=Object.freeze([
  ['','Не указано'],['male','Мужской'],['female','Женский']
]);
export const validRoleVoice=value=>value==='male'||value==='female'?value:'';
export const roleVoiceLabel=value=>ROLE_VOICE_OPTIONS.find(([key])=>key===validRoleVoice(value))[1];
export const roleVoiceFromActor=(role,actor)=>validRoleVoice(role?.voiceGender)||validRoleVoice(actor?.voiceGroup);
export function applyRoleVoiceFromActor(role,actor){
  if(!validRoleVoice(role?.voiceGender)){
    role.voiceGender=validRoleVoice(actor?.voiceGroup);
  }
  return role.voiceGender;
}


export function episodeActorWorkload(episode,actorId,exceptRoleId=''){
  const assigned=(episode?.roles||[]).filter(r=>r.actorId===actorId&&r.id!==exceptRoleId);
  const known=assigned.filter(r=>Number.isInteger(r.lineCount)&&r.lineCount>=0);
  return {
    count:assigned.length,
    lines:known.reduce((sum,r)=>sum+r.lineCount,0),
    unknown:assigned.length-known.length,
    characters:assigned.map(r=>r.character).filter(Boolean)
  };
}

export function rankActorsForRole(state,episode,role,vacations=[],{excludeActorId='',showAll=false}={}){
  const gender=validRoleVoice(role?.voiceGender);
  const unavailable=new Set((Array.isArray(vacations)?vacations:[])
    .filter(v=>['active','planned'].includes(v?.status)).map(v=>v.actorId));
  const candidates=[];
  for(const actor of state?.actors||[]){
    if(actor.id===excludeActorId||unavailable.has(actor.id))continue;
    // Strict voice-type match for recommendations; manual casting remains possible.
    if(gender&&!showAll&&actor.voiceGroup!==gender)continue;
    const inEpisode=episodeActorWorkload(episode,actor.id,role?.id);
    const allActive=(state?.projects||[]).filter(p=>!p.archived).flatMap(p=>(p.episodes||[])
      .flatMap(ep=>(ep.roles||[]).filter(r=>r.actorId===actor.id&&r.id!==role?.id&&r.status!=='done')));
    const debts=allActive.filter(r=>['waiting','retake'].includes(r.status)).length;
    candidates.push({actor,episodeCount:inEpisode.count,episodeLines:inEpisode.lines,
      unknownLines:inEpisode.unknown,characters:inEpisode.characters,
      activeCount:allActive.length,debtCount:debts,hasAccess:actor.actorAccess===true});
  }
  return candidates.sort((a,b)=>
    (gender&&showAll?Number(a.actor.voiceGroup!==gender)-Number(b.actor.voiceGroup!==gender):0)||
    a.episodeCount-b.episodeCount||
    a.episodeLines-b.episodeLines||
    a.unknownLines-b.unknownLines||
    a.activeCount-b.activeCount||
    a.debtCount-b.debtCount||
    Number(b.hasAccess)-Number(a.hasAccess)||
    a.actor.name.localeCompare(b.actor.name,'ru',{sensitivity:'base',numeric:true}));
}
