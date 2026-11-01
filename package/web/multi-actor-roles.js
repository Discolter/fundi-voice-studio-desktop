import {uid,safeRoleImage} from './core.js';
import {validRoleVoice} from './casting-assistant.js';
import {normalizeAssCharacter} from './ass-role-import.js';

// Each actor gets a separate persisted role ID; Cloud and Actor already support
// per-actor status, voice files, retakes, tasks and acceptance for that role ID.
export function matchingCharacterRoles(episode,role){
  const key=normalizeAssCharacter(role?.character);
  return key?(episode?.roles||[]).filter(r=>normalizeAssCharacter(r.character)===key):[];
}
export function assignedCharacterActors(episode,role){
  return new Set(matchingCharacterRoles(episode,role).map(r=>r.actorId).filter(Boolean));
}
export function addActorsToCharacter(state,episode,baseRole,actorIds,{unavailableActorIds=[]}={}){
  if(!episode||!baseRole||!episode.roles.includes(baseRole))
    throw Error('Персонаж не найден в серии. Открой список ролей заново.');
  const wanted=[...new Set(actorIds||[])];
  if(!wanted.length)throw Error('Выбери хотя бы одного актёра.');
  if(wanted.length>100)throw Error('Одновременно можно назначить не более 100 актёров.');
  const roster=new Map((state.actors||[]).map(a=>[a.id,a]));
  const blocked=new Set(unavailableActorIds);
  for(const id of wanted){
    if(!roster.has(id))throw Error('Актёр больше не существует в базе.');
    if(blocked.has(id))throw Error('Актёр сейчас в отпуске: '+roster.get(id).name);
  }
  const existing=matchingCharacterRoles(episode,baseRole);
  const occupied=assignedCharacterActors(episode,baseRole);
  const toAdd=wanted.filter(id=>!occupied.has(id));
  if(!toAdd.length)throw Error('Все выбранные актёры уже назначены на этого персонажа.');
  // Preserve the empty role originally created by ASS/manual input.
  const empty=existing.find(r=>!r.actorId&&!r.actor)||null;
  const slotsNeeded=toAdd.length-(empty?1:0);
  if(episode.roles.length+slotsNeeded>2000)
    throw Error('В серии может быть не более 2000 назначений.');
  const now=new Date().toISOString();
  const newRoles=toAdd.map((id,index)=>{
    const actor=roster.get(id);
    const role={id:uid(),createdAt:now,character:baseRole.character,actorId:id,actor:actor.name,
      voiceGender:validRoleVoice(baseRole.voiceGender)||validRoleVoice(actor.voiceGroup),
      image:safeRoleImage(baseRole.image),lineCount:null,
      mine:false,status:'waiting',inProject:false,folder:'',subtitle:'',notes:'',due:baseRole.due||'',
      reviewSeen:'',reviewCandidates:[]};
    if(index===0&&empty){
      // Reuse ID for an empty role to preserve existing task/role references.
      Object.assign(empty,{actorId:id,actor:actor.name,voiceGender:role.voiceGender,
        image:empty.image||role.image,status:'waiting',reviewSeen:'',reviewCandidates:[]});
      return null;
    }
    return role;
  }).filter(Boolean);
  const after=episode.roles.indexOf(existing[existing.length-1]||baseRole);
  episode.roles.splice(after+1,0,...newRoles);
  return {assigned:toAdd.length,added:newRoles.length,reusedEmpty:!!empty,count:matchingCharacterRoles(episode,baseRole).length};
}
