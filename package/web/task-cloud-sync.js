// Two-way task synchronization with Studio Web.
// Never merge unrelated local paths or replace the user's project/actor data.
// Optimistic revision and three-way merge prevent silent loss from concurrent edits.
export const TASK_SYNC_BASELINE_KEY='fundi-voice-tasks-cloud-baseline-v1';

const taskRecord=(project,ep,t)=>({
  id:t.id,projectId:project.id,episodeId:ep.id,title:t.title,due:t.due||'',
  priority:['urgent','high','normal','low'].includes(t.priority)?t.priority:'normal',
  done:!!t.done,actorId:t.actorId||'',roleId:t.roleId||'',mine:!!t.mine
});
export function buildTaskSnapshot(state){
  return {
    tasks:(state.projects||[]).flatMap(p=>(p.episodes||[]).flatMap(ep=>(ep.tasks||[]).map(t=>taskRecord(p,ep,t)))),
    projects:(state.projects||[]).map(p=>({
      id:p.id,title:p.title,season:String(p.season||''),archived:!!p.archived,hidden:!!p.hidden,createdAt:p.createdAt||'',
      episodes:(p.episodes||[]).map(ep=>({
        id:ep.id,number:String(ep.number||''),title:ep.title||'',
        roles:(ep.roles||[]).map(r=>({id:r.id,character:r.character,roleTier:['main','supporting','extras'].includes(r.roleTier)?r.roleTier:'supporting',actorId:r.actorId||'',actor:r.actor||'',
          lineCount:Number.isInteger(r.lineCount)&&r.lineCount>=0?r.lineCount:null,
          status:r.status||'waiting',createdAt:r.createdAt||''}))
      }))
    })),
    actors:(state.actors||[]).map(a=>({id:a.id,name:a.name}))
  };
}

const studioMirrorThumbs=new WeakMap();
const mirrorSource=source=>typeof source==='string'&&source.length<=720000&&
  /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(source);
// Produce compact previews for the actor-only Studio mirror. Never send file paths,
// raw voice files, notes or full-size locally stored artwork to the actor catalog.
async function studioMirrorPreview(owner,source,width,height,maxLength){
  if(!source)return '';
  if(!mirrorSource(source))throw Error('Не удалось подготовить картинку: неподдерживаемый формат.');
  const old=studioMirrorThumbs.get(owner);
  const size=width+':'+height+':'+maxLength;
  if(old?.source===source&&old.size===size)return old.preview;
  const preview=await new Promise((resolve,reject)=>{
    const img=new Image();
    const timer=setTimeout(()=>reject(Error('Подготовка картинки заняла слишком много времени. Повтори обновление.')),8000);
    img.onerror=()=>{clearTimeout(timer);reject(Error('Не удалось прочитать одну из картинок. Загрузи её заново.'));};
    img.onload=()=>{
      clearTimeout(timer);
      try{
        const ratio=Math.min(width/img.naturalWidth,height/img.naturalHeight,1);
        if(!Number.isFinite(ratio)||ratio<=0)throw Error('Некорректный размер картинки.');
        const canvas=document.createElement('canvas');
        for(const [scale,quality] of [[1,.72],[.8,.55],[.6,.45],[.4,.35],[.25,.3],[.125,.25]]){
          canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio*scale));
          canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio*scale));
          const context=canvas.getContext('2d');
          if(!context)throw Error('Не удалось подготовить миниатюру картинки.');
          context.drawImage(img,0,0,canvas.width,canvas.height);
          for(const format of ['image/webp','image/jpeg']){
            const value=canvas.toDataURL(format,quality);
            if(mirrorSource(value)&&value.length<=maxLength){resolve(value);return;}
          }
        }
        reject(Error('Не удалось уменьшить одну из картинок для отправки. Загрузи её заново.'));
      }catch(error){reject(error);}
    };
    img.src=source;
  });
  // Failed conversions are never cached as empty images.
  studioMirrorThumbs.set(owner,{source,size,preview});
  return preview;
}
export async function addStudioMirrorToSnapshot(state,snapshot){
  // Images share a fixed budget: catalog sync remains smaller than the server's
  // 2.4MB snapshot limit even for large anime casts.
  const images=[];
  const use=(target,field,entity,source,w,h,limit)=>{
    target[field]='';
    if(source)images.push({target,field,entity,source,w,h,limit});
  };
  const actors=new Map((state.actors||[]).map(a=>[a.id,a]));
  for(const p of snapshot.projects||[]){
    const original=(state.projects||[]).find(item=>item.id===p.id);
    if(!original)continue;
    p.color=original.color||'lime';
    p.favorite=!!original.favorite;
    use(p,'cover',original,original.cover,168,240,65000);
    for(const ep of p.episodes||[]){
      const source=(original.episodes||[]).find(item=>item.id===ep.id);
      if(!source)continue;
      ep.stage=source.stage||'unset';
      ep.due=source.due||'';
    }
  }
  for(const actor of snapshot.actors||[]){
    const original=actors.get(actor.id);
    use(actor,'avatar',original,original?.avatar||original?.avatarPreview,48,48,14000);
  }
  for(const p of snapshot.projects||[]){
    const original=(state.projects||[]).find(item=>item.id===p.id);
    for(const ep of p.episodes||[]){
      const originalEp=(original?.episodes||[]).find(item=>item.id===ep.id);
      for(const r of ep.roles||[]){
        const originalRole=(originalEp?.roles||[]).find(item=>item.id===r.id);
        if(!originalRole)continue;
        r.voiceGender=originalRole.voiceGender||'';
        use(r,'image',originalRole,originalRole.image,72,96,19000);
      }
    }
  }
  let budget=1150000,remaining=images.length;
  for(const item of images){
    // Reserve room for every remaining picture, including repeated characters
    // across episodes. Do not silently drop the tail of a large cast.
    const limit=Math.min(item.limit,Math.floor(budget/remaining));
    if(limit<256)throw Error('Слишком много картинок для одной синхронизации.');
    const value=await studioMirrorPreview(item.entity,item.source,item.w,item.h,limit);
    item.target[item.field]=value;budget-=value.length;remaining--;
  }
  return snapshot;
}

export function verifyStudioMirrorImages(expected,received){
  const counts={projects:0,characters:0,actors:0};
  const check=(value,actual,type)=>{
    if((value||'')!==(actual||''))throw Error('Облако не подтвердило сохранение всех картинок. Повтори обновление Studio.');
    if(value)counts[type]++;
  };
  for(const p of expected.projects||[]){
    const saved=(received?.projects||[]).find(x=>x.id===p.id);
    check(p.cover,saved?.cover,'projects');
    if(!!p.hidden!==!!saved?.hidden)throw Error('Облако не подтвердило состояние заморозки проекта. Повтори синхронизацию.');
    for(const ep of p.episodes||[]){
      const savedEp=(saved?.episodes||[]).find(x=>x.id===ep.id);
      for(const r of ep.roles||[])check(r.image,(savedEp?.roles||[]).find(x=>x.id===r.id)?.image,'characters');
    }
  }
  for(const a of expected.actors||[])check(a.avatar,(received?.actors||[]).find(x=>x.id===a.id)?.avatar,'actors');
  return counts;
}

const key=t=>t.id;
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
export function mergeTaskSnapshots(local,baseline,remote){
  const original=new Map((baseline?.tasks||[]).map(t=>[key(t),t]));
  const current=new Map((local.tasks||[]).map(t=>[key(t),t]));
  const incoming=new Map((remote.tasks||[]).map(t=>[key(t),t]));
  const keys=new Set([...original.keys(),...current.keys(),...incoming.keys()]);
  const tasks=[],conflicts=[];
  for(const id of keys){
    const base=original.get(id),ours=current.get(id),theirs=incoming.get(id);
    let chosen;
    if(!baseline){chosen=theirs||ours;} // First connection: preserve web edits over stale local rows.
    else if(same(ours,theirs))chosen=ours;
    else if(same(ours,base))chosen=theirs;
    else if(same(theirs,base))chosen=ours;
    else if(base&&ours&&theirs){
      // The same task may be edited in two windows without editing the same
      // field (e.g. a new deadline in Web and a priority change on Windows).
      // Merge those changes instead of blocking the entire task.
      // Actor+role linkage is one logical unit: do not combine its two fields
      // from different sources without explicit review.
      if((ours.actorId!==base.actorId&&theirs.roleId!==base.roleId)||
         (theirs.actorId!==base.actorId&&ours.roleId!==base.roleId)){
        conflicts.push(id);continue;
      }
      const next={...base};
      let collision=false;
      for(const field of new Set([...Object.keys(base),...Object.keys(ours),...Object.keys(theirs)])){
        if(field==='id')continue;
        const earlier=base[field],onWindows=ours[field],inCloud=theirs[field];
        let value;
        if(same(onWindows,inCloud))value=onWindows;
        else if(same(onWindows,earlier))value=inCloud;
        else if(same(inCloud,earlier))value=onWindows;
        else {collision=true;break;}
        if(value===undefined)delete next[field];
        else next[field]=value;
      }
      if(collision){conflicts.push(id);continue;}
      chosen=next;
    }
    else {conflicts.push(id);continue;}
    if(chosen)tasks.push(chosen);
  }
  return {tasks,conflicts};
}
export function mergeTaskCatalog(local,remote,baseline=null){
  const projects=local.projects.map(p=>({...p,episodes:p.episodes.map(ep=>({...ep,roles:[...ep.roles]}))}));
  const priorProjects=new Map((baseline?.projects||[]).map(p=>[p.id,p]));
  for(const p of remote.projects||[]){
    const existing=projects.find(x=>x.id===p.id);
    // Keep unknown remote entries, but do not resurrect a project deliberately
    // removed from the Windows workspace since the last successful sync.
    if(!existing){if(!priorProjects.has(p.id))projects.push(p);continue;}
    const priorEpisodes=new Set((priorProjects.get(p.id)?.episodes||[]).map(ep=>ep.id));
    for(const ep of p.episodes||[])
      if(!existing.episodes.some(x=>x.id===ep.id)&&!priorEpisodes.has(ep.id))existing.episodes.push(ep);
  }
  const actors=[...local.actors],priorActors=new Set((baseline?.actors||[]).map(a=>a.id));
  for(const actor of remote.actors||[])
    if(!actors.some(a=>a.id===actor.id)&&!priorActors.has(actor.id))actors.push(actor);
  return {projects,actors};
}

export function applyTaskSnapshot(state,tasks){
  let changed=false;
  for(const p of state.projects||[])for(const ep of p.episodes||[]){
    const next=tasks.filter(t=>t.projectId===p.id&&t.episodeId===ep.id).map(t=>({
      id:t.id,title:t.title,due:t.due||'',priority:t.priority||'normal',done:!!t.done,
      actorId:t.actorId||'',roleId:t.roleId||'',mine:!!t.mine
    }));
    if(!same(ep.tasks,next)){ep.tasks=next;changed=true;}
  }
  return changed;
}

// Field-level, three-way synchronization for statuses only.
// Names, assignments, paths and existing local project data are never overwritten.
// Legacy remote catalogs lack status and therefore cannot reset Windows statuses.
const canonicalRoleStage=status=>status==='processed'?'processing':status||'';
export function mergeRoleStages(local,baseline,remote,decisions=[]){
  const map=snapshot=>new Map((snapshot?.projects||[]).flatMap(p=>(p.episodes||[])
    .flatMap(ep=>(ep.roles||[]).map(r=>[p.id+':'+ep.id+':'+r.id,{p,ep,r,status:canonicalRoleStage(r.status)}]))));
  const ours=map(local),base=map(baseline),theirs=map(remote),choices=new Map(decisions.map(d=>[d.id,d]));
  const stages=[],conflicts=[],details=[],resolved=[];
  for(const [id,entry] of ours){
    const incoming=theirs.get(id),previous=base.get(id);
    const localStage=entry.status,remoteStage=incoming?.status||'',prior=previous?.status||'';
    let next=localStage;
    if(!remoteStage||remoteStage===localStage){/* local is already current */}
    else if(!baseline){ next=localStage; /* legacy first sync retains the Windows source */ }
    else if(localStage===prior)next=remoteStage;
    else if(remoteStage===prior)next=localStage;
    else {
      const {p,ep,r}=entry;
      // A choice applies only to the exact comparison the owner saw. A newer
      // stage, reassignment or character edit must be reviewed again.
      const decisionKey=JSON.stringify([id,prior,localStage,remoteStage,
        r.actorId||'',incoming.r.actorId||'',r.character||'',incoming.r.character||'']);
      const detail={id,decisionKey,projectId:p.id,episodeId:ep.id,roleId:r.id,
        projectTitle:p.title||'',season:p.season||'',episodeNumber:ep.number||'',episodeTitle:ep.title||'',
        character:r.character||'',actor:r.actor||'',image:r.image||'',
        baselineStatus:prior,localStatus:localStage,remoteStatus:remoteStage};
      const choice=choices.get(id);
      if(choice?.decisionKey===decisionKey&&['local','remote'].includes(choice.choice)){
        next=choice.choice==='local'?localStage:remoteStage;
        resolved.push({...detail,choice:choice.choice,status:next});
      }else{conflicts.push(id);details.push(detail);continue;}
    }
    stages.push({id,status:next});
  }
  return {stages,conflicts,details,resolved};
}
export function roleStageDecisions(details,values){
  return details.map((detail,index)=>{
    const choice=values['role-sync-'+index];
    if(!['local','remote'].includes(choice))throw Error('Выбери нужный этап для каждого персонажа.');
    return {id:detail.id,decisionKey:detail.decisionKey,choice};
  });
}
export function applyRoleStages(state,stages){
  const values=new Map(stages.map(r=>[r.id,r.status]));let changed=false;
  for(const p of state.projects||[])for(const ep of p.episodes||[])for(const role of ep.roles||[]){
    const status=values.get(p.id+':'+ep.id+':'+role.id);
    if(status&&role.status!==status){role.status=status;changed=true;}
  }
  return changed;
}
export function addRoleStagesToCatalog(catalog,stages){
  const values=new Map(stages.map(r=>[r.id,r.status]));
  return {...catalog,projects:(catalog.projects||[]).map(p=>({...p,
    episodes:(p.episodes||[]).map(ep=>({...ep,roles:(ep.roles||[]).map(r=>({
      ...r,status:values.get(p.id+':'+ep.id+':'+r.id)||r.status||''
    }))}))}))};
}


// Owner-only two-way casting sync. Role IDs identify the assignment; display names
// are metadata, never identity. Windows remains responsible for files and notes.
const roleEntries=snapshot=>new Map((snapshot?.projects||[]).flatMap(p=>(p.episodes||[])
  .flatMap(ep=>(ep.roles||[]).map(r=>[p.id+':'+ep.id+':'+r.id,{p,ep,r}]))));
const roleActor=entry=>entry?.r?.actorId||'';
const actorLabel=(snapshot,id,role)=>id
  ?(snapshot?.actors||[]).find(actor=>actor.id===id)?.name||role?.actor||id
  :'Не назначен';

export function mergeRoleAssignments(local,baseline,remote,decisions=[]){
  const ours=roleEntries(local),before=roleEntries(baseline),theirs=roleEntries(remote);
  const choices=new Map(decisions.map(choice=>[choice.id,choice]));
  const assignments=[],conflicts=[],details=[],resolved=[];
  const localActors=new Set((local.actors||[]).map(actor=>actor.id));
  for(const [key,entry] of ours){
    const incoming=theirs.get(key);
    if(!incoming)continue; // Remote-only catalogue entries do not erase local roles.
    const previous=before.get(key);
    const localId=roleActor(entry),remoteId=roleActor(incoming),priorId=roleActor(previous);
    let target=localId;
    const firstSync=!baseline||!previous;
    let needsReview=false;
    if(localId===remoteId){/* Already synchronized. */}
    else if(firstSync){
      if(!localId)target=remoteId; // Adopt the cloud's initial cast.
      else if(!remoteId)target=localId; // Preserve a new offline casting.
      else needsReview=true; // Two different non-empty first-time casts.
    }else if(localId===priorId)target=remoteId;
    else if(remoteId===priorId)target=localId;
    else needsReview=true;

    const id='assignment:'+key;
    const decisionKey=JSON.stringify([id,priorId,localId,remoteId,
      entry.r.character||'',incoming.r.character||'',entry.r.status||'',incoming.r.status||'']);
    const detail={
      kind:'assignment',id,decisionKey,projectId:entry.p.id,episodeId:entry.ep.id,roleId:entry.r.id,
      projectTitle:entry.p.title||'',season:entry.p.season||'',episodeNumber:entry.ep.number||'',
      episodeTitle:entry.ep.title||'',character:entry.r.character||'',actor:entry.r.actor||'',
      image:entry.r.image||'',baselineActor:actorLabel(baseline,priorId,previous?.r),
      localActor:actorLabel(local,localId,entry.r),remoteActor:actorLabel(remote,remoteId,incoming.r),
      localActorId:localId,remoteActorId:remoteId
    };
    const choice=choices.get(id);
    if(needsReview){
      if(choice?.decisionKey===decisionKey&&['local','remote'].includes(choice.choice)){
        target=choice.choice==='local'?localId:remoteId;
        resolved.push({...detail,choice:choice.choice,actorId:target});
      }else{
        conflicts.push(id);details.push(detail);continue;
      }
    }
    // Never create a fabricated actor card or silently reassign to a missing ID.
    // The owner must first add that actor to the local cast.
    if(target&&!localActors.has(target)){
      if(choice?.decisionKey===decisionKey&&choice.choice==='local'&&(!localId||localActors.has(localId))){
        target=localId;
        resolved.push({...detail,choice:'local',actorId:target});
      }else{
        conflicts.push(id);
        details.push({...detail,missingActor:true});
        continue;
      }
    }
    const label=target
      ?(local.actors||[]).find(actor=>actor.id===target)?.name||actorLabel(remote,target,incoming.r)
      :'';
    assignments.push({id:key,actorId:target,actor:label});
  }
  return {assignments,conflicts,details,resolved};
}

export function applyRoleAssignments(state,assignments){
  const selected=new Map(assignments.map(item=>[item.id,item]));
  let changed=false;
  for(const p of state.projects||[])for(const ep of p.episodes||[])for(const r of ep.roles||[]){
    const incoming=selected.get(p.id+':'+ep.id+':'+r.id);
    if(!incoming)continue;
    const newId=incoming.actorId||'';
    const known=(state.actors||[]).find(a=>a.id===newId);
    if(newId&&!known)throw Error('Нельзя синхронизировать роль '+r.character+': актёр отсутствует в Windows Studio.');
    const newName=newId?known.name:'';
    if(r.actorId!==newId||r.actor!==newName){
      if(r.actorId!==newId){r.reviewSeen='';r.reviewCandidates=[];}
      r.actorId=newId;r.actor=newName;changed=true;
    }
  }
  return changed;
}

export function addRoleAssignmentsToCatalog(catalog,assignments){
  const selected=new Map(assignments.map(item=>[item.id,item]));
  return {...catalog,projects:(catalog.projects||[]).map(p=>({...p,
    episodes:(p.episodes||[]).map(ep=>({...ep,
      roles:(ep.roles||[]).map(r=>{
        const match=selected.get(p.id+':'+ep.id+':'+r.id);
        return match?{...r,actorId:match.actorId,actor:match.actor}:r;
      })
    }))}))};
}
