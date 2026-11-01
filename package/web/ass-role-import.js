import {uid,safeRoleImage} from './core.js';

// ASS/SSA dialogue "Name" (also called "Actor" by some subtitle editors).
// Preserve names and their original spelling; use conservative matching for casting.
export function normalizeAssCharacter(value){
  return String(value||'').normalize('NFKC').toLocaleLowerCase('ru')
    .replace(/ё/g,'е').replace(/[’'´"«»`]/g,'')
    .replace(/[‐‑‒–—-]/g,' ').replace(/\s+/g,' ').trim();
}

export function parseAssCharacters(text){
  if(typeof text!=='string')throw Error('Не удалось прочитать ASS-файл.');
  const names=new Map(),lines=text.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/);
  let inEvents=false,hasEvents=false,format=null,total=0,unlabeled=0,invalid=0;
  for(const raw of lines){
    const section=raw.trim().match(/^\[([^\]]+)\]$/);
    if(section){inEvents=section[1].trim().toLowerCase()==='events';if(inEvents)hasEvents=true;continue;}
    if(!inEvents)continue;
    const formatLine=raw.match(/^\s*Format\s*:\s*(.*)$/i);
    if(formatLine){
      const labels=formatLine[1].split(',').map(s=>s.trim().toLowerCase());
      const name=labels.indexOf('name')>=0?labels.indexOf('name'):labels.indexOf('actor');
      if(name<0)throw Error('В разделе [Events] нет колонки Name/Actor. Неоткуда взять имена персонажей.');
      if(labels.indexOf('text')<0)throw Error('В разделе [Events] отсутствует колонка Text.');
      if(labels.at(-1)!=='text')throw Error('В ASS колонка Text должна быть последней в Format.');
      if(labels.length<3)throw Error('Повреждён формат событий ASS.');
      format={count:labels.length,name};continue;
    }
    const match=raw.match(/^\s*Dialogue\s*:\s*(.*)$/i);
    if(!match)continue;
    total++;
    if(!format){invalid++;continue;}
    // The final Text column can contain commas. Split only at the first N-1.
    const fields=[],value=match[1];let start=0;
    for(let i=0;i<format.count-1;i++){
      const pos=value.indexOf(',',start);
      if(pos<0)break;
      fields.push(value.slice(start,pos));start=pos+1;
    }
    if(fields.length!==format.count-1){invalid++;continue;}
    fields.push(value.slice(start));
    const name=fields[format.name]?.trim()||'';
    if(!name){unlabeled++;continue;}
    const key=normalizeAssCharacter(name);
    if(!key){unlabeled++;continue;}
    if(name.length>200){invalid++;continue;}
    const existing=names.get(key);
    if(existing)existing.lineCount++;
    else {
      if(names.size>=2000)throw Error('Слишком много персонажей в ASS (максимум 2000).');
      names.set(key,{name,lineCount:1,key});
    }
  }
  if(!hasEvents)throw Error('В файле отсутствует раздел [Events]. Выбери субтитры в формате ASS/SSA.');
  if(!format)throw Error('В ASS-файле отсутствует Format для диалогов.');
  if(!total)throw Error('В ASS-файле нет событий Dialogue.');
  if(!names.size)throw Error('У всех реплик пустое поле Name/Actor. Проставь имена персонажей в редакторе субтитров.');
  return {characters:[...names.values()],dialogueCount:total,unlabeled,invalid};
}

export async function decodeAssFile(file){
  if(!file||!/\.(ass|ssa)$/i.test(file.name||''))throw Error('Выбери файл субтитров .ass или .ssa.');
  if(!file.size||file.size>20*1024*1024)throw Error('ASS должен быть непустым и не превышать 20 МБ.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xfe)
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff)
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{return new TextDecoder('windows-1251').decode(bytes);}
}

export function previousAssEpisode(project,episode){
  const episodes=project?.episodes||[],index=episodes.indexOf(episode);
  if(index<0)return null;
  const number=Number(episode.number);
  if(number>0){
    const prior=episodes.map((ep,i)=>({ep,i,n:Number(ep.number)}))
      .filter(item=>item.ep!==episode&&item.n>0&&item.n<number)
      .sort((a,b)=>b.n-a.n||b.i-a.i);
    if(prior.length)return prior[0].ep;
    return null;
  }
  return index?episodes[index-1]:null;
}

function matchingRoles(episode,key){
  return (episode?.roles||[]).filter(role=>normalizeAssCharacter(role.character)===key);
}
function uniqueMatchingRole(episode,key){
  const matches=matchingRoles(episode,key);
  return matches.length===1?matches[0]:null;
}

export function matchAssRole(state,project,episode,entry){
  const key=normalizeAssCharacter(entry.name);
  const existing=matchingRoles(episode,key)[0]||null;
  const previous=uniqueMatchingRole(previousAssEpisode(project,episode),key);
  let actor=null;
  if(previous){
    actor=(state.actors||[]).find(a=>a.id===previous.actorId)||null;
    if(!actor&&previous.actor){
      const matches=(state.actors||[]).filter(a=>a.name.toLocaleLowerCase('ru')===previous.actor.toLocaleLowerCase('ru'));
      if(matches.length===1)actor=matches[0];
    }
  }
  return {existing,previous,actor};
}

export function applyAssCastImport(state,project,episode,entries,{selected=null,removeMissing=false}={}){
  if(!Array.isArray(entries)||!entries.length)throw Error('В ASS не найдены персонажи.');
  const selectedSet=selected===null?new Set(entries.map((_,i)=>i)):new Set(selected);
  const choices=entries.filter((entry,i)=>selectedSet.has(i));
  if(!choices.length)throw Error('Отметь хотя бы одного персонажа.');
  const keys=new Set(choices.map(entry=>normalizeAssCharacter(entry.name)));
  if(keys.size!==choices.length)throw Error('В списке персонажей есть повторяющиеся имена.');
  const missing=episode.roles.filter(role=>!keys.has(normalizeAssCharacter(role.character)));
  if(removeMissing){
    const protectedRoles=missing.filter(role=>role.status!=='waiting'||episode.tasks?.some(task=>task.roleId===role.id));
    if(protectedRoles.length)throw Error('Нельзя автоматически удалить роли с работой или связанными задачами: '+protectedRoles.map(r=>r.character).slice(0,5).join(', ')+'. Удали их вручную после проверки.');
  }
  if((removeMissing?episode.roles.length-missing.length:episode.roles.length)+choices.length>4000)
    throw Error('Слишком много ролей.');
  // If full replacement is explicitly requested, restore exact ASS first-appearance order.
  const updated=removeMissing?[]:[...episode.roles];
  let added=0,reused=0,inherited=0;
  for(const entry of choices){
    const {existing,previous,actor}=matchAssRole(state,project,episode,entry);
    const same=matchingRoles(episode,entry.key);
    if(existing){
      const index=updated.findIndex(role=>role.id===existing.id);
      if(index>=0||removeMissing){
        // One character may already have several independently tracked actors.
        // ASS dialogue count does not tell us how lines were divided between them.
        const saved={...existing,lineCount:same.length>1?existing.lineCount:entry.lineCount};
        if(!saved.actorId&&!saved.actor&&actor){
          saved.actorId=actor.id;saved.actor=actor.name;
          saved.voiceGender=previous?.voiceGender||saved.voiceGender||'';
          saved.mine=previous?.mine||false;
          saved.image=saved.image||safeRoleImage(previous?.image);
          inherited++;
        }
        if(index>=0)updated[index]=saved;else updated.push(saved);
        if(removeMissing)for(const other of same.slice(1))updated.push(other);
        reused++;continue;
      }
    }
    updated.push({id:uid(),createdAt:new Date().toISOString(),character:entry.name,lineCount:entry.lineCount,
      actorId:actor?.id||'',actor:actor?.name||'',voiceGender:previous?.voiceGender||'',
      image:safeRoleImage(previous?.image),mine:!!previous?.mine&&!!actor,status:'waiting',
      inProject:false,folder:'',subtitle:'',notes:'',due:'',reviewSeen:'',reviewCandidates:[]});
    if(actor)inherited++;
    added++;
  }
  if(updated.length>2000)throw Error('В одной серии может быть не более 2000 ролей.');
  episode.roles=updated;
  return {added,reused,inherited,removed:removeMissing?missing.length:0,total:episode.roles.length};
}
