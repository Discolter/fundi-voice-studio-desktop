import {uid,safeRoleImage,validRoleTier} from './core.js';
import {normalizeAssCharacter} from './ass-role-import.js';

// Desktop Studio is the casting editor. A pasted list never edits actor feeds
// directly: normal durable workspace save and versioned Cloud sync publish it.
const normal=value=>normalizeAssCharacter(value);
const telegram=value=>String(value||'').trim().replace(/^https?:\/\/(?:www\.)?t\.me\//i,'').replace(/^@/,'').toLowerCase();
const actorLabel=actor=>actor?.telegram?'@'+telegram(actor.telegram):actor?.name||'';

export function parseTextCast(text){
  if(typeof text!=='string'||text.length>100000)
    throw Error('Список должен быть текстом до 100 000 символов.');
  const rows=[],errors=[];
  for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r\n|\r|\n/).entries()){
    let line=raw.trim().replace(/^\s*(?:\d+[.)]\s*|[•*]\s+|-\s+)/,'').replace(/^\*\*|\*\*$/g,'').trim();
    if(!line||/^#/.test(line)||/^каст\b/i.test(line)&&!/@/.test(line))continue;
    // Prefer the rightmost delimiter before @username so hyphenated character
    // names are not split in the middle. Also accept ordinary "role - actor".
    const at=line.match(/^(.+)\s*[-—–→:=]\s*((?:@|https?:\/\/(?:www\.)?t\.me\/)[\w][^]*)$/i);
    let character='',right='';
    if(at){character=at[1];right=at[2];}
    else{
      const dividers=[...line.matchAll(/\s+[-—–→:=]\s+|\s*[—–→:=]\s*/g)];
      const marker=dividers.at(-1);
      if(marker){character=line.slice(0,marker.index);right=line.slice(marker.index+marker[0].length);}
    }
    character=character.trim().replace(/^\*+|\*+$/g,'').trim();
    right=right.trim().replace(/^\*+|\*+$/g,'').trim();
    if(!character||!right||character.length>200){
      errors.push({line:index+1,message:'Ожидается «Персонаж — @username».'});
      continue;
    }
    const actors=right.split(/\s*[,;+]\s*|\s+и\s+(?=@)/i).map(v=>v.trim()).filter(Boolean);
    if(!actors.length||actors.some(v=>v.length>160)){
      errors.push({line:index+1,message:'Некорректный список актёров.'});continue;
    }
    rows.push({line:index+1,character,actors});
    if(rows.length>2000)throw Error('Слишком много назначений: максимум 2000 строк.');
  }
  if(!rows.length&&!errors.length)throw Error('Вставь хотя бы одну строку «Персонаж — @username».');
  return {rows,errors};
}

function findActor(actors,token){
  const raw=token.trim();
  const handle=/^@|^https?:\/\/(?:www\.)?t\.me\//i.test(raw);
  const search=handle?telegram(raw):normal(raw);
  const found=actors.filter(a=>!a.retiredAt&&(handle
    ? telegram(a.telegram)===search&&!!search
    : normal(a.name)===search || telegram(a.telegram)===raw.toLowerCase()));
  return found.length===1?{actor:found[0]}:{error:found.length?'Несколько актёров подходят под «'+raw+'».':'Актёр «'+raw+'» не найден в Studio.'};
}

export function textCastFingerprint(state,episode){
  return JSON.stringify({
    actors:(state.actors||[]).map(a=>[a.id,a.name,a.telegram,a.retiredAt||'']),
    roles:(episode.roles||[]).map(r=>[r.id,r.character,r.actorId,r.actor,r.status,r.reviewSeen||'']),
    tasks:(episode.tasks||[]).map(t=>[t.id,t.roleId])
  });
}

export function planTextCast(state,episode,parsed,{createMissing=false,replaceWaiting=false}={}){
  if(!episode||!Array.isArray(episode.roles)||!Array.isArray(parsed?.rows))
    throw Error('Сначала выбери серию и подготовь текст.');
  const issues=(parsed.errors||[]).map(e=>({line:e.line,message:e.message}));
  const groups=new Map();
  for(const row of parsed.rows){
    const key=normal(row.character);
    if(!key){issues.push({line:row.line,message:'Пустое имя персонажа.'});continue;}
    if(!groups.has(key))groups.set(key,{character:row.character,line:row.line,actors:new Map()});
    const group=groups.get(key);
    for(const token of row.actors){
      const match=findActor(state.actors||[],token);
      if(match.error){issues.push({line:row.line,message:match.error});continue;}
      group.actors.set(match.actor.id,match.actor);
    }
  }
  const actions=[],used=new Set(),roles=episode.roles||[];
  for(const [key,group] of groups){
    const existing=roles.filter(r=>normal(r.character)===key);
    if(!existing.length&&!createMissing){
      issues.push({line:group.line,message:'Персонаж «'+group.character+'» отсутствует в серии. Проверь имя или включи создание новых ролей.'});
      continue;
    }
    const desired=[...group.actors.values()];
    for(const actor of desired){
      if(existing.some(r=>r.actorId===actor.id)){continue;}
      const empty=existing.find(r=>!r.actorId&&!r.actor&&!used.has(r.id));
      if(empty){
        used.add(empty.id);
        actions.push({kind:'assign',roleId:empty.id,character:empty.character,actorId:actor.id,actorName:actor.name,from:''});
        continue;
      }
      const lone=existing.length===1?existing[0]:null;
      if(desired.length===1&&lone&&lone.actorId&&lone.actorId!==actor.id){
        const hasTask=(episode.tasks||[]).some(t=>t.roleId===lone.id);
        if(!replaceWaiting||lone.status!=='waiting'||hasTask||lone.reviewSeen){
          issues.push({line:group.line,message:'«'+group.character+'» уже назначен другому актёру. Можно переназначить только ожидающую роль без записей/поручений; при необходимости сделай это вручную.'});
          continue;
        }
        actions.push({kind:'replace',roleId:lone.id,character:lone.character,actorId:actor.id,actorName:actor.name,from:lone.actor||lone.actorId});
        continue;
      }
      if(existing.length===0){
        actions.push({kind:'create',roleId:'',character:group.character,actorId:actor.id,actorName:actor.name,from:''});
      }else{
        // Several people can read one character; each receives a separate role ID
        // and their own independent recording/review status.
        actions.push({kind:'add',roleId:'',character:existing[0].character,actorId:actor.id,actorName:actor.name,from:''});
      }
    }
  }
  if(roles.length+actions.filter(a=>a.kind==='add'||a.kind==='create').length>2000)
    issues.push({line:0,message:'Лимит 2000 ролей на серию. Уменьши список.'});
  return {actions,issues,unchanged:[...groups].reduce((count,[key,g])=>count+[...g.actors.keys()].filter(id=>roles.some(r=>normal(r.character)===key&&r.actorId===id)).length,0),
    fingerprint:textCastFingerprint(state,episode),sourceRows:parsed.rows.length};
}

export function applyTextCastPlan(state,episode,plan){
  if(!plan||plan.issues?.length)throw Error('Исправь ошибки списка перед распределением.');
  if(plan.fingerprint!==textCastFingerprint(state,episode))
    throw Error('Состав серии или актёров изменился после проверки. Повтори предварительный просмотр.');
  const roster=new Map((state.actors||[]).map(a=>[a.id,a]));
  const roles=episode.roles.map(r=>({...r}));
  const now=new Date().toISOString(),counts={assigned:0,replaced:0,added:0};
  for(const action of plan.actions||[]){
    const actor=roster.get(action.actorId);
    if(!actor||actor.retiredAt)throw Error('Исполнитель больше не найден. Повтори проверку.');
    if(action.kind==='assign'||action.kind==='replace'){
      const role=roles.find(r=>r.id===action.roleId);
      if(!role)throw Error('Роль изменилась. Повтори проверку.');
      role.actorId=actor.id;role.actor=actor.name;
      role.status='waiting';role.reviewSeen='';role.reviewCandidates=[];
      if(!role.voiceGender&&['male','female'].includes(actor.voiceGroup))role.voiceGender=actor.voiceGroup;
      if(action.kind==='replace')counts.replaced++;else counts.assigned++;
      continue;
    }
    if(action.kind!=='add'&&action.kind!=='create')throw Error('Неизвестный тип назначения.');
    const template=roles.find(r=>normal(r.character)===normal(action.character));
    roles.push({id:uid(),createdAt:now,character:action.character,lineCount:null,
      actorId:actor.id,actor:actor.name,roleTier:validRoleTier(template?.roleTier),
      voiceGender:template?.voiceGender||(['male','female'].includes(actor.voiceGroup)?actor.voiceGroup:''),
      image:safeRoleImage(template?.image),mine:false,status:'waiting',inProject:false,
      folder:'',subtitle:'',notes:'',due:template?.due||'',
      reviewSeen:'',reviewCandidates:[]});
    counts.added++;
  }
  episode.roles=roles;
  return {...counts,total:plan.actions.length,unchanged:plan.unchanged};
}
