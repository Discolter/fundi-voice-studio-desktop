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
      id:p.id,title:p.title,season:String(p.season||''),archived:!!p.archived,createdAt:p.createdAt||'',
      episodes:(p.episodes||[]).map(ep=>({
        id:ep.id,number:String(ep.number||''),title:ep.title||'',
        roles:(ep.roles||[]).map(r=>({id:r.id,character:r.character,actorId:r.actorId||'',actor:r.actor||'',
          lineCount:Number.isInteger(r.lineCount)&&r.lineCount>=0?r.lineCount:null,
          status:r.status||'waiting',createdAt:r.createdAt||''}))
      }))
    })),
    actors:(state.actors||[]).map(a=>({id:a.id,name:a.name}))
  };
}

const studioMirrorThumbs=new WeakMap();
// Produce compact previews for the actor-only Studio mirror. Never send file paths,
// raw voice files, notes or full-size locally stored artwork to the actor catalog.
async function studioMirrorPreview(owner,source,width,height,maxLength){
  if(typeof source!=='string'||source.length>720000||
     !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(source))return '';
  const old=studioMirrorThumbs.get(owner);
  if(old?.source===source)return old.preview;
  const preview=await new Promise(resolve=>{
    const img=new Image();
    img.onerror=()=>resolve('');
    img.onload=()=>{
      try{
        const ratio=Math.min(width/img.naturalWidth,height/img.naturalHeight,1);
        if(!Number.isFinite(ratio)||ratio<=0){resolve('');return;}
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));
        canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        const webp=canvas.toDataURL('image/webp',0.72);
        resolve(webp.length<=maxLength?webp:'');
      }catch{resolve('');}
    };
    img.src=source;
  });
  studioMirrorThumbs.set(owner,{source,preview});
  return preview;
}
export async function addStudioMirrorToSnapshot(state,snapshot){
  // Images share a fixed budget: catalog sync remains smaller than the server's
  // 2.4MB snapshot limit even for large anime casts.
  let budget=1150000;
  const use=async(entity,source,w,h,limit)=>{
    if(budget<=limit/2)return '';
    const image=await studioMirrorPreview(entity,source,w,h,limit);
    if(image.length>budget)return '';
    budget-=image.length;
    return image;
  };
  const actors=new Map((state.actors||[]).map(a=>[a.id,a]));
  for(const p of snapshot.projects||[]){
    const original=(state.projects||[]).find(item=>item.id===p.id);
    if(!original)continue;
    p.color=original.color||'lime';
    p.favorite=!!original.favorite;
    p.cover=await use(original,original.cover,168,240,65000);
    for(const ep of p.episodes||[]){
      const source=(original.episodes||[]).find(item=>item.id===ep.id);
      if(!source)continue;
      ep.stage=source.stage||'unset';
      ep.due=source.due||'';
    }
  }
  for(const actor of snapshot.actors||[]){
    const original=actors.get(actor.id);
    actor.avatar=original?await use(original,original.avatar||original.avatarPreview,48,48,14000):'';
  }
  for(const p of snapshot.projects||[]){
    const original=(state.projects||[]).find(item=>item.id===p.id);
    for(const ep of p.episodes||[]){
      const originalEp=(original?.episodes||[]).find(item=>item.id===ep.id);
      for(const r of ep.roles||[]){
        const originalRole=(originalEp?.roles||[]).find(item=>item.id===r.id);
        if(!originalRole)continue;
        r.voiceGender=originalRole.voiceGender||'';
        r.image=await use(originalRole,originalRole.image,72,96,19000);
      }
    }
  }
  return snapshot;
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
    else {conflicts.push(id);continue;}
    if(chosen)tasks.push(chosen);
  }
  return {tasks,conflicts};
}
export function mergeTaskCatalog(local,remote){
  const projects=local.projects.map(p=>({...p,episodes:p.episodes.map(ep=>({...ep,roles:[...ep.roles]}))}));
  for(const p of remote.projects||[]){
    const existing=projects.find(x=>x.id===p.id);
    if(!existing){projects.push(p);continue;}
    for(const ep of p.episodes||[])if(!existing.episodes.some(x=>x.id===ep.id))existing.episodes.push(ep);
  }
  const actors=[...local.actors];
  for(const actor of remote.actors||[])if(!actors.some(a=>a.id===actor.id))actors.push(actor);
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
export function mergeRoleStages(local,baseline,remote){
  const map=snapshot=>new Map((snapshot?.projects||[]).flatMap(p=>(p.episodes||[])
    .flatMap(ep=>(ep.roles||[]).map(r=>[p.id+':'+ep.id+':'+r.id,r.status||'']))));
  const ours=map(local),base=map(baseline),theirs=map(remote),stages=[],conflicts=[];
  for(const [id,localStage] of ours){
    const remoteStage=theirs.get(id)||'',prior=base.get(id)||'';
    let next=localStage;
    if(!remoteStage||remoteStage===localStage){/* local is already current */}
    else if(!baseline){ next=localStage; /* legacy first sync retains the Windows source */ }
    else if(localStage===prior)next=remoteStage;
    else if(remoteStage===prior)next=localStage;
    else {conflicts.push(id);continue;}
    stages.push({id,status:next});
  }
  return {stages,conflicts};
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
