import {formatBytes,storageMeter,transferPanel,fileStatus} from './file-tools.js';
import {ageBadge} from './age.js';
import {summarizeMyRoleEpisodes,myRoleLineCount,myRoleWorkloadColor,isMyRoleAccepted,unfinishedMyRoleEpisodes,MY_ROLE_ORDERS,validMyRoleOrder,sortMyRoleGroups} from './my-role-workload.js';
import {createSiteManager} from './site-manager.js';
import {createActorCabinet} from './actor-cabinet.js';
import {createQuickViews,roleSnapshot} from './quick-views.js';
import {createStudioNavigation} from './navigation-history.js';
import {startUpdateNotice} from './update-notice.js';
import {openFileBrowser} from './file-browser.js';
import {vacationReviewRows,availableReplacementActors,reassignVacationRole} from './vacation-review.js';
import {actorWorkloadRows,actorWorkloadGroups} from './actor-workload.js';
import {ROLE_VOICE_OPTIONS,validRoleVoice,roleVoiceLabel,roleVoiceFromActor,applyRoleVoiceFromActor,episodeActorWorkload,rankActorsForRole} from './casting-assistant.js';
import {installVisualSelects} from './visual-selects.js';
import {buildTaskSnapshot,mergeTaskSnapshots,mergeTaskCatalog,applyTaskSnapshot,mergeRoleStages,applyRoleStages,addRoleStagesToCatalog} from './task-cloud-sync.js';
import {bulkTaskKey,retainVisibleTasks,deleteBulkTasks} from './task-bulk.js';
import {SCHEMA,ACTOR_GROUPS,CAST_GROUPS,STAGES,ROLE_STAGES,TASK_PRIORITIES,taskPriority,taskPriorityName,TASK_ORDERS,TASK_LINE_FILTERS,TASK_STATUS_FILTERS,validTaskOrder,validTaskLineFilter,validTaskStatusFilter,DEBT_STAGES,THEMES,diskFolderName,projectFolderName,episodeFolderName,expandFolderKeys,safeCover,safeRoleImage,newActor,cleanTelegram,actorForRole,actorName,actorAssignments,episodeRoleActorOptions,episodeRoleCharacterOptions,episodeRoleCharacterImage,episodeUnassignedActors,filterEpisodeRoles,removeActor,castText,KINDS,COLORS,PATHS,uid,today,dateValue,seedState,newProject,newEpisode,normalizeState,stageName,roleStageName,kindName,episodeLabel,projectProgress,currentEpisode,latestEpisodeRoleProgress,nearestDue,projectMatches,selectProjects,taskRows,taskAssignment,roleRows as storedRoleRows,myRoleRows as storedMyRoleRows,debtRows as storedDebtRows,withRoleReviews,roleReviewStage,reviewVersion,applyRoleReviews,actorPublicFeed,effectiveRoleDue,materialRows,removeProject,restoreProject,classifyFile,escapeHTML as e} from './core.js';

const ICONS={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',check:'m5 12 4 4L19 6',tasks:'M9 5h11M9 12h11M9 19h11M3 5l1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2',folder:'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',mic:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',archive:'M3 3h18v5H3zM5 8v13h14V8M10 12h4',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3l-1 3-3 1-2 3 2 3-1 3 3 2 3-1 2 4 3-1 1-3 3-1 2-3-2-3 1-3-3-2-3 1-2-4Z',search:'M21 21l-5-5M17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0Z',plus:'M12 5v14M5 12h14',chevron:'m9 5 7 7-7 7',arrow:'M5 12h14m-5-5 5 5-5 5',back:'M19 12H5m5-5-5 5 5 5',star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z',edit:'m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',close:'m6 6 12 12M18 6 6 18',clock:'M12 7v5l3 2M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0',calendar:'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16',file:'M14 2H5v20h14V7ZM14 2v6h5M8 13h8M8 17h5',reaper:'M5 18V7l7-4 7 4v11l-7 3ZM8 9v7M12 7v12M16 9v7',copy:'M8 8h13v13H8zM16 8V3H3v13h5',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',external:'M14 3h7v7M21 3l-11 11M10 3H3v18h18v-7',help:'M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 3M12 18h.01M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-4-4',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',link:'m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 0 2-2a4 4 0 1 1 6 6l-4 4a4 4 0 0 1-6 0',restore:'M3 10a9 9 0 1 1 0 5M3 3v7h7M12 7v5l4 2',logout:'M9 3H3v18h6M12 12h10m-5-5 5 5-5 5',sort:'M8 4v16m-4-4 4 4 4-4M16 4h5M16 10h3M16 16h1'};
ICONS.play='m8 5 12 7-12 7Z';
ICONS.star='m12 2 3.1 6.3 7 1-5.1 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5.1-4.9 7-1Z';
ICONS.grip='M8 5h.01M8 12h.01M8 19h.01M16 5h.01M16 12h.01M16 19h.01';
ICONS.debts='M12 3 2 21h20L12 3ZM12 9v5M12 18h.01';
ICONS.shield='M12 2 20 6v6c0 5-4 8-8 10C8 20 4 17 4 12V6l8-4ZM9 12l2 2 4-4';
ICONS.bell='M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4';
ICONS.workload='M4 20V12M9 20V7M14 20V4M19 20V10M2 20h20';
ICONS.chat='M3 3h18v14H9l-6 4Z';
ICONS.eye='M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6';
ICONS['eye-off']='M3 3l18 18M10.6 5.2A10.5 10.5 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.5 4.3M6.8 6.8C3.5 8.8 2 12 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.3M10 10a3 3 0 0 0 4 4';
ICONS.refresh='M3 11a9 9 0 0 1 15-6l3 3M21 3v5h-5M21 13a9 9 0 0 1-15 6l-3-3M3 21v-5h5';
ICONS.vacation='M12 3a9 9 0 1 0 9 9M12 3v9l5 3M8 21h8';
// Two rounded clockwise arrows are clearer for roles needing reassignment.
ICONS.review=ICONS.refresh;
// Three asterisks symbolize a password without reusing the actor-access shield.
ICONS.password='M5 9v6M2.5 10.5l5 3M7.5 10.5l-5 3M12 9v6M9.5 10.5l5 3M14.5 10.5l-5 3M19 9v6M16.5 10.5l5 3M21.5 10.5l-5 3';
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]||ICONS.file}"/></svg>`;
const ART={hourglass:'M22 10h44M22 78h44M26 10c0 19 9 22 18 34-9 12-18 16-18 34M62 10c0 19-9 22-18 34 9 12 18 16 18 34M31 68l13-15 13 15ZM33 23h22M14 37l3 3-3 3-3-3ZM72 48v8M68 52h8',witch:'M10 64 43 14l19 45 15 5c-17 12-45 16-67 0ZM25 59l37 0M37 31l19 22M44 3v6M41 6h6M71 22v10M66 27h10M18 22l3 3-3 3-3-3Z',bolt:'m49 5-30 41 24-1-5 37 31-47-25 3ZM11 20l7 5M69 65l8 4M73 14l-7 8M16 67l8-5M10 47h6',swords:'m17 72 11-11M60 16l12-7-7 12-29 35-10-10ZM17 50l20 20M20 21l-3-11 10 4 35 31-10 10ZM52 63l18-18M60 62l12 12',orbit:'M44 12v6M44 70v6M12 44h6M70 44h6M21 21l5 5M62 62l5 5M21 67l5-5M62 26l5-5M61 44a17 17 0 1 0-34 0 17 17 0 0 0 34 0ZM38 40v3M50 40v3M38 51c4 4 8 4 12 0M79 44a35 35 0 1 0-70 0 35 35 0 0 0 70 0',flower:'M44 37C20 14 40-2 44 19 50-3 68 16 50 37 77 20 87 44 62 44 87 50 70 70 50 51 68 78 43 90 44 62 38 87 17 72 37 51 9 69 0 42 25 44 0 37 17 18 37 37ZM50 44a6 6 0 1 0-12 0 6 6 0 0 0 12 0',spark:'m44 9 10 25 25 10-25 10-10 25-10-25L9 44l25-10ZM11 10v9M7 14h9M73 69v10M68 74h10'};
const art=p=>`<svg class="cover-art" viewBox="0 0 88 88" aria-hidden="true"><path d="${ART[p.symbol]||ART.spark}"/></svg>`;
const STORAGE='fundi-voice-workspace-v1', UIKEY='fundi-voice-ui-v1';
let lastScreen='',projectWizard=null,actorDrag=null;
const ACTOR_DRAG_TYPE='application/x-fundi-voice-actor';
let state, native=false, token='', info={}, saving=false, saveError='', saveTimer, saveChain=Promise.resolve(),modalSubmit=null,scanResults=[];
let cloud={connected:false,server:'',pending:false,busy:false,error:'',lastSync:'',actors:[]},cloudWizard=null;
let refreshing=false,manualRefreshAt=0;
const selectedTasks=new Set(); // Ephemeral UI selection: never stored in the workspace.
let taskSyncBusy=false,taskSyncTimer=null,taskSyncError='';
let ui={siteMode:'studio',sitePage:'releases',page:'projects',query:'',filter:'all',sort:'recent',layout:'grid',project:null,episode:null,tab:'roles',actorExpanded:[],actorRegistrationFilter:'all',debtActor:'',debtStatus:'all',debtProject:'all',roleFilter:'all',roleActor:'all',roleCharacter:'all',roleOrder:'original',myRoleOrder:'original',taskPriority:'all',taskOrder:'priority',taskStatus:'all',taskLines:'all',taskActor:'all',taskProject:'all',workloadIncludeArchive:false};
try{const saved=JSON.parse(localStorage.getItem(UIKEY)||'{}');ui.layout=saved.layout==='table'?'table':'grid';ui.sort=['recent','due','name'].includes(saved.sort)?saved.sort:'recent';ui.actorExpanded=Array.isArray(saved.actorExpanded)?saved.actorExpanded.filter(k=>typeof k==='string'&&/^(?:cast:(?:main|support|unspecified)|voice:(?:main|support|unspecified):(?:male|female|unspecified))$/.test(k)):[];  ui.taskPriority=TASK_PRIORITIES.some(([key])=>key===saved.taskPriority)?saved.taskPriority:'all';
  ui.taskOrder=validTaskOrder(saved.taskOrder);
  ui.workloadIncludeArchive=saved.workloadIncludeArchive===true;
  ui.myRoleOrder=validMyRoleOrder(saved.myRoleOrder);
  ui.taskStatus=validTaskStatusFilter(saved.taskStatus);
  ui.taskLines=validTaskLineFilter(saved.taskLines);
  ui.taskActor=typeof saved.taskActor==='string'&&saved.taskActor.length<=80?saved.taskActor:'all';
  ui.actorRegistrationFilter=['all','yes','no'].includes(saved.actorRegistrationFilter)?saved.actorRegistrationFilter:'all';
  ui.taskProject=typeof saved.taskProject==='string'&&saved.taskProject.length<=80?saved.taskProject:'all';
  ui.debtProject=typeof saved.debtProject==='string'&&saved.debtProject.length<=80?saved.debtProject:'all';
}catch{}
const app=document.querySelector('#app'),modal=document.querySelector('#modal');
const activeProjects=()=>state.projects.filter(p=>!p.archived);
const getProject=id=>state.projects.find(p=>p.id===(id||ui.project));
const getEpisode=(p,id)=>p?.episodes.find(ep=>ep.id===(id||ui.episode))||p?.episodes[0];
const options=(arr,value)=>arr.map(([v,l])=>`<option value="${e(v)}" ${String(value)===String(v)?'selected':''}>${e(l)}</option>`).join('');
const badge=ep=>`<span class="stage-badge" data-stage="${e(ep.stage)}">${e(stageName(ep.stage))}</span>`;
const dueLabel=due=>!due?'Без дедлайна':new Date(due+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
const dueClass=(due,done)=>due&&due<today()&&!done?'due-over':'';
const roleRows=(s,options)=>storedRoleRows(s===state?withRoleReviews(s,cloud.reviews||[]):s,options);
const myRoleRows=(s,options)=>{
  const source=s===state?withRoleReviews(s,cloud.reviews||[]):s;
  // Compute completed episodes from ALL personal roles, not the filtered search
  // subset, otherwise searching for an accepted character could hide a partial episode.
  return unfinishedMyRoleEpisodes(storedMyRoleRows(source),storedMyRoleRows(source,options));
};
const debtRows=(s,options)=>storedDebtRows(s===state?withRoleReviews(s,cloud.reviews||[]):s,options);
const counts=()=>({projects:activeProjects().length,actors:(state.actors||[]).length,mytasks:myRoleRows(state).length,debts:debtRows(state).length,review:vacationReviewRows(state,cloud.vacations||[]).length});
const navs=[['projects','grid','Проекты'],['mytasks','tasks','Мои задачи'],['debts','debts','Долги'],['actors','users','Актёры'],['workload','workload','Нагрузка'],['actorportal','shield','Доступ актёров']];
let recoveryRequests=[],recoveryCode='';
const vacationFor=id=>(cloud.vacations||[]).find(v=>v.actorId===id&&(v.status==='active'||v.status==='planned'));
const activeVacation=id=>vacationFor(id)?.status==='active';
const vacationTag=id=>{const v=vacationFor(id);return v?`<span class="studio-vacation-tag ${v.status==='active'?'active':'planned'}" title="${e((v.status==='active'?'В отпуске: новые роли не назначать':'Запланирован отпуск')+(v.startDate?' · с '+v.startDate:'')+(v.endDate?' по '+v.endDate:' · Бессрочно'))}">${icon('vacation')}${v.status==='active'?'В отпуске':'Отпуск скоро'}</span>`:'';};
const vacationOptionSuffix=id=>{const v=vacationFor(id);return v?(v.status==='active'?' · ⛔ В отпуске':' · ◷ Отпуск скоро'):'';};

async function api(path,body){
  const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'X-Fundi-Key':token,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json().catch(()=>({error:'Локальное приложение не ответило. Перезапусти FundiVoiceStudio.exe.'}));
  if(!r.ok){const error=new Error(data.error||'Не удалось выполнить действие.');error.code=data.code||'';throw error;}return data;
}
function toast(msg,error=false){const t=document.createElement('div');t.className='toast'+(error?' error':'');t.textContent=msg;document.querySelector('#toasts').append(t);setTimeout(()=>t.remove(),error?9000:4200);}
const siteManager=createSiteManager({toast,escapeHTML:e,rerender:()=>render()});
const actorCabinet=createActorCabinet({
  getActors:()=>state?.actors||[],
  getCloud:()=>cloud,
  getLocalFeed:id=>actorPublicFeed(state,id,{preview:true}),
  actorAvatar:actorPickAvatar,icon,escapeHTML:e,
  rerender:()=>render(),api
});
const quickViews=createQuickViews({
 root:document.querySelector('#quick-view-root'),
 getState:()=>state,getCloud:()=>cloud,
 getRole:(pid,eid,rid)=>roleSnapshot(state,pid,eid,rid),
 getReview:r=>reviewForRole(r),
 getStage:r=>roleReviewStage(r,reviewForRole(r)),
 getSourceUrl:(pid,eid)=>(cloud.sourceLinks||[]).find(x=>x.projectId===pid&&x.episodeId===eid)?.url||'',
 icon,escapeHTML:e,actorAvatar:actorPickAvatar,
 editRole:(pid,eid,rid)=>roleForm(pid,eid,rid),
 editActor:id=>actorForm(id),
 editVacation:id=>studioVacationForm(id),
 viewActorDemos:id=>actorDetails(id,'demos'),
 openProject:(pid,eid)=>{ui.siteMode='studio';openProject(pid,eid,'roles');},
 openFiles:({p,ep,r})=>showStudioFiles({roleId:r.id,actorId:r.actorId,title:r.character+' · '+p.title+' · '+episodeLabel(p,ep)}),
 openActorCabinet:id=>{ui.siteMode='cabinet';actorCabinet.start();actorCabinet.action({cabinet:'actor',id});render();},
 transferRole:(pid,eid,rid,actorId,showAllActors=false)=>vacationReviewTransferForm(pid,eid,rid,actorId,showAllActors),
 castingAssistant:(pid,eid,rid)=>castingAssistantForm(pid,eid,rid),
 availableActors:oldId=>availableReplacementActors(state,cloud.vacations||[],oldId),
 cloudRequest:api,refreshCloud:()=>refreshAllStudio(),
 changeRole:({p,r},{status,due,lineCount})=>{
   if(!ROLE_STAGES.some(([key])=>key===status))throw Error('Выбери корректный статус роли.');
   if(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))throw Error('Укажи корректную дату.');
   if(lineCount!==''&&!/^(?:0|[1-9][0-9]{0,6})$/.test(lineCount))throw Error('Реплики: целое число от 0 до 1 000 000.');
   const count=lineCount===''?null:Number(lineCount);
   if(count!==null&&count>1000000)throw Error('Максимум 1 000 000 реплик.');
   r.status=status;r.due=dateValue(due);r.lineCount=count;
   const review=reviewForRole(r);if(review)r.reviewSeen=reviewVersion(review);
   touch(p);render();
 },
 toast
});

const studioNavigation=createStudioNavigation({
  win:window,
  canNavigate:()=>!modal.open,
  read:()=>({
    siteMode:ui.siteMode,sitePage:ui.sitePage,page:ui.page,
    project:ui.project,episode:ui.episode,tab:ui.tab,
    cabinet:ui.siteMode==='cabinet'?actorCabinet.navigationState():null
  }),
  restore:route=>{
    ui.siteMode=['studio','site','cabinet'].includes(route.siteMode)?route.siteMode:'studio';
    ui.sitePage=['releases','news','notifications','ratings','users'].includes(route.sitePage)?route.sitePage:'releases';
    const sections=['projects','archive','detail','mytasks','debts','actors','workload','actorportal','settings','review','vacations','recovery'];
    ui.page=sections.includes(route.page)?route.page:'projects';
    const project=state.projects.find(p=>p.id===route.project);
    ui.project=project?.id||null;
    const episode=project?.episodes.find(ep=>ep.id===route.episode);
    ui.episode=episode?.id||(project?.episodes[0]?.id||null);
    ui.tab=['roles','materials','tasks'].includes(route.tab)?route.tab:'roles';
    if(ui.page==='detail'&&!project)ui.page='projects';
    if(ui.siteMode==='cabinet')actorCabinet.restoreNavigation(route.cabinet);
    if(ui.siteMode==='site')siteManager.start();
    ui.query='';ui.roleFilter='all';ui.roleActor='all';ui.roleCharacter='all';
    selectedTasks.clear();
    render();window.scrollTo(0,0);
  }
});

function saveStatusState(){return saveError?'error':saving?'saving':'saved';}
function updateSaveStatus(){const el=document.querySelector('#save-status');if(!el)return;el.textContent=saveError?'Ошибка сохранения':saving?'Сохраняем…':'Сохранено';const indicator=el.closest('.status-indicator');if(indicator)indicator.dataset.saveState=saveStatusState();}
function scheduleTaskCloudSync(){
  if(!native||!cloud.connected||taskSyncBusy)return;
  clearTimeout(taskSyncTimer);
  taskSyncTimer=setTimeout(()=>syncStudioTasks().catch(()=>{}),6000);
}
async function syncStudioTasks(visible=false){
  if(!native||!cloud.connected||taskSyncBusy||modal.open)return false;
  taskSyncBusy=true;
  try{
    if(saving)await flushSave();
    const [remote,baselineData]=await Promise.all([api('cloud/tasks/read',{}),api('cloud/tasks/baseline',{})]);
    const local=buildTaskSnapshot(state),prior=baselineData?.known?baselineData.snapshot:null;
    const merged=mergeTaskSnapshots(local,prior,remote.snapshot);
    if(merged.conflicts.length)throw Error('Есть конфликт в '+merged.conflicts.length+' задачах: изменения Windows и сайта сделаны одновременно. Проверь данные перед повторной синхронизацией.');
    const roleMerge=mergeRoleStages(local,prior,remote.snapshot);
    if(roleMerge.conflicts.length)throw Error('Конфликт этапов в '+roleMerge.conflicts.length+' ролях. В Windows и на сайте изменили одну роль одновременно; данные не перезаписаны.');
    const catalog=addRoleStagesToCatalog(mergeTaskCatalog(local,remote.snapshot),roleMerge.stages);
    const snapshot={...catalog,tasks:merged.tasks};
    const different=JSON.stringify(snapshot)!==JSON.stringify(remote.snapshot);
    const published=different?await api('cloud/tasks/write',{baseVersion:remote.version,snapshot}):null;
    const snapshotVersion=published?.version??remote.version;
    const tasksModified=applyTaskSnapshot(state,merged.tasks);
    const stagesModified=applyRoleStages(state,roleMerge.stages);
    const modified=tasksModified||stagesModified;
    await api('cloud/tasks/baseline/save',{known:true,snapshot});
    if(modified){persist();await flushSave();if(saveError)throw Error('Не удалось сохранить согласованные роли на диск: '+saveError);if(!modal.open)render();}
    // Only unlock pending roster publication after the reconciled disk state is saved.
    await api('cloud/roles/sync-ready',{snapshotVersion});
    taskSyncError='';
    if(visible)toast('Поручения и этапы ролей синхронизированы с веб-студией.');
    return true;
  }catch(error){
    if(visible||error.message!==taskSyncError){
      if(visible||!/404|not found/i.test(error.message))toast('Синхронизация поручений: '+error.message,true);
    }
    taskSyncError=error.message;
    return false;
  }finally{taskSyncBusy=false;}
}
function persist(){
  state.updatedAt=new Date().toISOString();
  try{localStorage.setItem(STORAGE,JSON.stringify(state));if(!native)saveError='';}catch{if(!native){saveError='Хранилище браузера недоступно. Сохрани резервную копию в настройках.';toast(saveError,true);}}
  if(native){clearTimeout(saveTimer);saving=true;saveTimer=setTimeout(flushSave,220);scheduleTaskCloudSync();}updateSaveStatus();
}
function flushSave(){
  clearTimeout(saveTimer);const snapshot=JSON.stringify(state);saving=true;updateSaveStatus();
  saveChain=saveChain.catch(()=>{}).then(()=>api('state',JSON.parse(snapshot))).then(()=>{saving=false;saveError='';updateSaveStatus();}).catch(err=>{saving=false;saveError=err.message;updateSaveStatus();toast('Не удалось сохранить на диск. '+err.message,true);});return saveChain;
}
function touch(p){if(p)p.updatedAt=new Date().toISOString();persist();}
function saveUI(){try{localStorage.setItem(UIKEY,JSON.stringify({layout:ui.layout,sort:ui.sort,actorExpanded:ui.actorExpanded,taskPriority:ui.taskPriority,taskOrder:ui.taskOrder,myRoleOrder:ui.myRoleOrder,taskStatus:ui.taskStatus,taskLines:ui.taskLines,taskActor:ui.taskActor,taskProject:ui.taskProject,debtProject:ui.debtProject,actorRegistrationFilter:ui.actorRegistrationFilter,workloadIncludeArchive:ui.workloadIncludeArchive}));}catch{}}
function navigate(page){if(page==='recovery'&&native&&cloud.connected)api('cloud/recovery/requests',{}).then(data=>{recoveryRequests=data.requests||[];render();}).catch(err=>toast(err.message,true));if(page!=='mytasks')selectedTasks.clear();ui.page=page;ui.project=null;ui.query='';ui.filter='all';render();window.scrollTo(0,0);if(['vacations','review'].includes(page)&&native&&cloud.connected)api('cloud/vacations/refresh',{}).then(next=>{cloud=next;render();}).catch(err=>toast(err.message,true));}
function openProject(id,episode,tab='roles'){selectedTasks.clear();const p=getProject(id);if(!p)return;ui.page='detail';ui.project=id;ui.episode=episode||currentEpisode(p).id;ui.tab=tab;ui.roleFilter='all';ui.roleActor='all';ui.roleCharacter='all';ui.roleOrder='original';ui.query='';p.lastOpened=new Date().toISOString();touch(p);render();window.scrollTo(0,0);}

function render(){
  const focused=document.activeElement?.id==='search-input',caret=focused?document.activeElement.selectionStart:0;
  document.body.dataset.theme=state.settings.theme||'aurora';document.body.dataset.motion=state.settings.motion===false?'off':'on';
  const screen=[ui.siteMode,ui.page,ui.project,ui.episode,ui.tab].join('/'),enter=screen!==lastScreen;lastScreen=screen;
  const c=counts(),activePage=ui.siteMode==='cabinet'?'cabinet-home':ui.siteMode==='site'?'site-'+ui.sitePage:(ui.page==='detail'||ui.page==='archive'?'projects':ui.page);
  const sidebarNav=ui.siteMode==='cabinet'?[['cabinet-home','grid','Главная']]:ui.siteMode==='site'?[['site-releases','grid','Релизы'],['site-news','file','Новости'],['site-notifications','bell','Уведомления'],['site-ratings','star','Оценки'],['site-users','users','Пользователи']]:navs;
  const section=ui.siteMode==='cabinet'?'Роли актёров':ui.siteMode==='site'?({releases:'Релизы',news:'Новости',notifications:'Уведомления',ratings:'Оценки',users:'Пользователи'}[ui.sitePage]||'Сайт'):(navs.find(n=>n[0]===activePage)?.[2]||(ui.page==='vacations'?'Отпуска':ui.page==='review'?'Пересмотр':ui.page==='recovery'?'Сброс пароля':'Настройки'));
  app.innerHTML=`<div class="shell"><aside class="sidebar"><a class="brand" href="#" data-nav="projects" aria-label="Fundi Voice"><span class="brand-mark"><img src="brand-mark.png" alt=""></span><div class="brand-title">Fundi Voice<span class="lime">.</span></div></a><nav>${sidebarNav.map(([id,ic,label])=>`<button class="nav-item ${activePage===id?'active':''}" data-${ui.siteMode==='site'?'site-nav':ui.siteMode==='cabinet'?'cabinet':'nav'}="${ui.siteMode==='site'?id.slice(5):ui.siteMode==='cabinet'?'home':id}" title="${label}">${icon(ic)}<span>${label}</span>${['projects','actors','mytasks','debts'].includes(id)?`<span class="nav-count" aria-label="${id==='actors'?'Всего актёров':id==='mytasks'?'Моих ролей':id==='debts'?'Невыполненных записей':'Активных проектов'}: ${c[id]}">${c[id]}</span>`:''}</button>`).join('')}${ui.siteMode==='studio'&&native&&cloud.connected?`<button class="nav-item" data-action="studio-files" aria-haspopup="dialog">${icon('file')}<span>Мои файлы</span><span class="nav-count nav-file-count" data-file-unread-count ${cloud.unreadFiles?'':'hidden'}>${cloud.unreadFiles>99?'99+':cloud.unreadFiles||''}</span></button>`:''}${ui.siteMode==='studio'?`<button class="nav-item vacation-review-nav ${ui.page==='review'?'active':''} ${c.review?'has-items':''}" data-nav="review" title="Пересмотр назначений из-за отпусков">${icon('review')}<span>Пересмотр</span>${c.review?`<span class="nav-count" aria-label="Ролей на пересмотр: ${c.review}">${c.review>99?'99+':c.review}</span>`:''}</button>`:''}</nav><div class="sidebar-bottom">${ui.siteMode==='cabinet'?`<div class="nav-item" style="cursor:default;opacity:.7">${icon('eye')}<span>Режим просмотра</span></div>`:ui.siteMode==='site'?`<a class="nav-item" href="https://fundivoice-viewer-test.pages.dev/" target="_blank" rel="noopener noreferrer">${icon('external')}<span>Открыть сайт</span></a>`:`<button class="nav-item" data-action="help">${icon('help')}<span>Как пользоваться</span></button><button class="nav-item ${ui.page==='settings'?'active':''}" data-nav="settings">${icon('settings')}<span>Настройки</span></button><button class="nav-item studio-recovery-nav ${ui.page==='recovery'?'active':''}" data-nav="recovery" title="Сброс пароля" aria-label="Сброс пароля">${icon('password')}<span>Сброс пароля</span></button><button class="nav-item studio-vacation-nav ${ui.page==='vacations'?'active':''}" data-nav="vacations" title="Отпуска">${icon('vacation')}<span>Отпуска</span>${cloud.vacationUnread?`<b class="nav-count">${cloud.vacationUnread>99?'99+':cloud.vacationUnread}</b>`:''}</button>` }<div class="profile"><div class="avatar">${e(state.settings.name.slice(0,1).toUpperCase())}</div><div class="profile-name">${e(state.settings.name)}</div></div></div></aside><main class="main"><header class="topbar"><div class="site-topbar-group"><span class="topbar-title">${e(section)}</span><div class="site-mode-switch" role="group" aria-label="Рабочий режим"><button type="button" data-site-mode="studio" class="${ui.siteMode==='studio'?'active':''}" aria-pressed="${ui.siteMode==='studio'}">Студия</button><button type="button" data-site-mode="site" class="${ui.siteMode==='site'?'active':''}" aria-pressed="${ui.siteMode==='site'}">Сайт</button><button type="button" data-site-mode="cabinet" class="${ui.siteMode==='cabinet'?'active':''}" aria-pressed="${ui.siteMode==='cabinet'}">Роли актёров</button></div></div><div class="topbar-right">${ui.siteMode==='site'?`<span class="sm-toolbar-label">Управление зрительским сайтом</span>`:ui.siteMode==='cabinet'?`<span class="sm-toolbar-label">Проверка опубликованных назначений · только просмотр</span>`:`<button class="btn ghost studio-refresh-button" data-action="refresh-all" title="Проверить новые записи, уведомления и отпуска" aria-label="Обновить данные Studio" ${refreshing?'disabled':''}>${icon('refresh')}<span>${refreshing?'Обновляем…':'Обновить'}</span></button><button class="icon-btn notification-bell" data-action="studio-messages" title="Уведомления" aria-label="Уведомления">${icon('bell')}<b data-notification-count ${cloud.mailbox?.unread||cloud.mailbox?.failed?.length?'':'hidden'}>${cloud.mailbox?.unread||(cloud.mailbox?.failed?.length?'!':'')}</b></button><label class="search">${icon('search')}<span class="sr-only">Поиск</span><input id="search-input" placeholder="Поиск" value="${e(ui.query)}" autocomplete="off"><kbd>Ctrl K</kbd></label><div class="status-indicator" data-save-state="${saveStatusState()}"><span class="status-dot"></span><span id="save-status">${saveError?'Ошибка сохранения':saving?'Сохраняем…':'Сохранено'}</span></div><button class="icon-btn" data-action="help" title="Как пользоваться" aria-label="Как пользоваться">${icon('help')}</button><button class="icon-btn mobile-settings" data-nav="settings" title="Настройки" aria-label="Настройки">${icon('settings')}</button>`}</div></header>${saveError?`<div class="save-warning">${e(saveError)} <button class="text-button" data-action="export">Скачать копию</button></div>`:''}<div class="content ${enter?'screen-enter':''}">${renderPage(c)}</div></main></div>`;
  const selectAll=document.querySelector('#bulk-task-select-all');
  if(selectAll)selectAll.indeterminate=selectedTasks.size>0&&!selectAll.checked;
  if(focused){const input=document.querySelector('#search-input');input.focus();input.setSelectionRange(caret,caret);}
  quickViews.refresh();
  studioNavigation.record();
}
function renderPage(c){
  if(ui.siteMode==='cabinet')return actorCabinet.render();
  if(ui.siteMode==='site')return siteManager.render(ui.sitePage);
  if(ui.page==='detail')return renderDetail();if(ui.page==='actors')return renderActors();if(ui.page==='workload')return renderWorkload();if(ui.page==='mytasks')return renderMyTasks();if(ui.page==='debts')return renderDebts();if(ui.page==='vacations')return renderVacations();
  if(ui.page==='review')return renderVacationReview();if(ui.page==='recovery')return renderRecoveries();if(ui.page==='actorportal')return renderActorPortal();if(ui.page==='settings')return renderSettings();return renderProjects(c);
}
function heading(title,desc='',actions=''){return `<div class="page-head"><div><h1>${e(title)}</h1>${desc?`<span class="heading-meta">${e(desc)}</span>`:''}</div><div class="page-actions">${actions}</div></div>`;}
const modeSwitch=()=>`<div class="mode-switch"><button data-mode="studio" class="${state.settings.mode==='studio'?'active':''}">Все</button><button data-mode="actor" class="${state.settings.mode==='actor'?'active':''}">Мои</button></div>`;
const empty=(title,action='',label='Добавить',data='')=>`<div class="empty">${icon('plus')}<h3>${e(title)}</h3>${action?`<button class="btn primary" data-action="${action}" ${data}>${e(label)}</button>`:''}</div>`;
function renderProjects(c){
  const archived=ui.page==='archive',projects=selectProjects(state,{query:ui.query,filter:ui.filter,sort:ui.sort,archived});
  let html=heading(archived?'Архив':'Проекты','',`<button class="btn primary" data-action="new-project">${icon('plus')}Новый проект</button>`);
  html+=`<div class="section-bar"><div class="filter-tabs"><button class="filter-tab ${!archived&&ui.filter==='all'?'active':''}" data-nav="projects">Активные <span>${c.projects}</span></button><button class="filter-tab ${!archived&&ui.filter==='favorite'?'active':''}" data-filter="favorite">Избранное</button><button class="filter-tab ${archived?'active':''}" data-nav="archive">Архив</button></div><div class="view-tools"><select id="sort-select" aria-label="Сортировка">${options([['recent','Недавние'],['due','По сроку'],['name','По названию']],ui.sort)}</select><div class="view-switch"><button data-action="layout-grid" class="${ui.layout==='grid'?'active':''}" title="Карточки">${icon('grid')}</button><button data-action="layout-table" class="${ui.layout==='table'?'active':''}" title="Список">${icon('list')}</button></div></div></div>`;
  if(!projects.length)return html+empty(ui.query?'Ничего не найдено':archived?'Архив пуст':'Нет проектов',ui.query?'clear-search':archived?'':'new-project',ui.query?'Сбросить поиск':'Новый проект');
  if(ui.layout==='grid')return html+`<div class="projects-grid">${projects.map(renderCard).join('')}</div>`;
  return html+`<div class="table-wrap"><table><thead><tr><th>Проект</th><th>Серия</th><th>Этап</th><th>Срок</th><th>Возраст</th><th></th></tr></thead><tbody>${projects.map(p=>{const ep=currentEpisode(p);return `<tr><td class="table-title"><button data-action="open-project" data-id="${e(p.id)}">${e(p.title)}</button></td><td class="muted">${e(episodeLabel(p,ep))}</td><td>${badge(ep)}</td><td class="small ${dueClass(ep.due,ep.stage==='done')}">${ep.due?dueLabel(ep.due):'—'}</td><td>${ageBadge(p.createdAt,true)}</td><td><button class="btn ghost small" data-action="open-project" data-id="${e(p.id)}">Открыть</button></td></tr>`;}).join('')}</tbody></table></div>`;
}
function projectArt(p,large=false){return p.cover?`<img class="project-poster ${large?'large':''}" src="${e(p.cover)}" alt="Обложка ${e(p.title)}">`:`<span class="mini-emblem color-${e(p.color)}">${art(p)}</span>`;}
function renderCard(p){
  const {episode:ep,accepted,total,remaining,tone}=latestEpisodeRoleProgress(p);
  const progressLabel=total?'<span class="progress-text project-role-progress" data-progress="'+tone+'" title="'+e('Последняя серия: '+episodeLabel(p,ep)+' · принято '+accepted+' из '+total+' · осталось '+remaining)+'" aria-label="'+e('Принято '+accepted+' из '+total+'. Осталось '+remaining)+'"><strong class="project-accepted-count">'+accepted+'/'+total+'</strong><span>принято</span><span class="project-remaining-count">· осталось <b>'+remaining+'</b></span></span>':
    '<span class="progress-text project-role-progress" data-progress="none" title="Роли в последней серии пока не добавлены">0 ролей</span>';
  return `<article class="project-card compact-project" data-color="${e(p.color)}"><div class="project-card-main"><button class="project-picture" data-action="open-project" data-id="${e(p.id)}" aria-label="Открыть ${e(p.title)}">${projectArt(p)}</button><div class="project-card-name"><button class="card-title" data-action="open-project" data-id="${e(p.id)}">${e(p.title)}</button><div class="card-meta">${e(episodeLabel(p,ep))}${p.episodes.length>1?` · ${p.episodes.length} сер.`:''}</div></div><button class="icon-btn ${p.favorite?'faved':''}" data-action="favorite" data-id="${e(p.id)}" title="Избранное" aria-pressed="${p.favorite}">${icon('star')}</button></div><div class="card-stage">${badge(ep)}${ageBadge(p.createdAt)}${progressLabel}${ep.due?`<span class="small ${dueClass(ep.due,ep.stage==='done')}">${dueLabel(ep.due)}</span>`:''}</div><div class="compact-card-actions"><button class="btn ghost small" data-action="open-project" data-id="${e(p.id)}">Открыть${icon('arrow')}</button><div><button class="icon-btn" data-action="quick-reaper" data-id="${e(p.id)}" title="REAPER" aria-label="Открыть REAPER">${icon('reaper')}</button><button class="icon-btn" data-action="quick-folder" data-id="${e(p.id)}" title="Папка проекта" aria-label="Открыть папку">${icon('folder')}</button></div></div></article>`;
}
// Collapsible project strips, retaining all existing role cards and their project actions.
function myRoleSummaryHTML(p,items){
  const summary=summarizeMyRoleEpisodes(items);
  return `<span class="my-role-summary-episodes">${summary.episodes.map(({ep,items,total,unknown})=>
    `<span class="my-role-summary-episode"><span class="my-role-episode-heading">${e(episodeLabel(p,ep))} · ${unknown?'известно '+total+' репл.':total+' репл.'}${unknown?' · '+unknown+' без числа':''}</span>
    <span class="my-role-inline-list">${items.map(({r})=>{
      const n=myRoleLineCount(r.lineCount);
      return `<span class="my-role-inline-role ${isMyRoleAccepted(r)?'my-role-accepted':''}" title="${e(r.character+' · '+(n===null?'Количество реплик не указано':n+' реплик')+(isMyRoleAccepted(r)?' · Принято':''))}"><span class="my-role-inline-name">${e(r.character)}</span>${isMyRoleAccepted(r)?`<span class="my-role-accepted-mark" title="Принято" aria-label="Роль принята">${icon('check')}</span>`:''}<span class="my-role-lines-pill workload-${myRoleWorkloadColor(n)}">${n===null?'—':n}</span></span>`;
    }).join('')}</span></span>`).join('')}</span>`;
}

// One shortcut for every personal role/task. Always bind the series, never the project's current episode.
function reaperShortcutButton(p,ep,iconOnly=false){
  const linked=(ep.paths?.reaper||(ep.resources||[]).find(r=>r.kind==='reaper'&&r.path)?.path)||'';
  const multiple=!ep.paths?.reaper&&(ep.resources||[]).filter(r=>r.kind==='reaper'&&r.path).length>1;
  const verb=multiple?'Выбрать проект REAPER':linked?'Открыть проект REAPER':'Привязать проект REAPER';
  const title=verb+': '+p.title+' / '+episodeLabel(p,ep);
  return `<button type="button" class="${iconOnly?'icon-btn task-reaper-shortcut':'btn ghost small my-role-reaper-shortcut'}" data-action="quick-reaper" data-id="${e(p.id)}" data-ep="${e(ep.id)}" title="${e(title)}" aria-label="${e(title)}">${icon('reaper')}${iconOnly?'':'REAPER'}</button>`;
}

let myRolesExpanded=null;
function groupedMyRoles(roles){
  const groups=new Map();
  for(const entry of roles){
    if(!groups.has(entry.p.id))groups.set(entry.p.id,{p:entry.p,items:[]});
    groups.get(entry.p.id).items.push(entry);
  }
  return `<div class="my-role-project-groups">${sortMyRoleGroups([...groups.values()],ui.myRoleOrder).map(({p,items},index)=>{
    const summary=summarizeMyRoleEpisodes(items);
    const isOpen=myRolesExpanded!==null&&myRolesExpanded.has(p.id);
    return `<details class="my-role-project-group" data-my-role-group="${e(p.id)}" ${isOpen?'open':''}>
      <summary class="my-role-group-summary">${projectArt(p)}<span class="my-role-group-caption"><strong>${e(p.title)}</strong><small>${items.length} ${items.length===1?'роль':'ролей'}${p.archived?' · Архив':''} · Нажми, чтобы ${isOpen?'свернуть':'развернуть'}</small>${myRoleSummaryHTML(p,items)}</span><span class="my-role-summary-total workload-${summary.unknown?'unknown':myRoleWorkloadColor(summary.total)}" title="${summary.unknown?'Сумма неполная: некоторые роли без количества реплик':'Всего реплик во всех моих ролях этого аниме'}">${summary.unknown?'Известно: ':'Всего: '}${summary.total} <small>репл.</small>${summary.unknown?'<small> + ?</small>':''}</span><span class="my-role-group-count">${items.length}</span>${icon('chevron')}</summary>
      <div class="my-role-group-body"><div class="my-roles-grid">${items.map(({p,ep,r})=>`<article data-qv-context="role" data-qv-actor="${e(r.actorId||'')}" data-qv-project="${e(p.id)}" data-qv-episode="${e(ep.id)}" data-qv-role="${e(r.id)}" class="my-role-card ${p.archived?'my-role-archived':''} ${isMyRoleAccepted(r)?'my-role-accepted-card':''}"><div class="my-role-top"><span class="my-role-icon">${icon('mic')}</span><span class="my-role-status status-${e(r.status)}">${e(roleStageName(r.status))}</span></div><h3><button type="button" class="qv-inline-trigger" data-qv-open="role" data-qv-project="${e(p.id)}" data-qv-episode="${e(ep.id)}" data-qv-role="${e(r.id)}">${e(r.character)}</button></h3>${r.lineCount!==null&&Number.isInteger(r.lineCount)?`<span class="role-line-count">${r.lineCount} репл.</span>`:''}<button class="my-role-project" data-action="open-project" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-tab="roles">${e(p.title)} ${icon('external')}</button><div class="my-role-episode">${ageBadge(r.createdAt)} ${e(episodeLabel(p,ep))}${p.archived?' · Архив':''}${effectiveRoleDue(r,ep)?' · Срок '+e(dueLabel(effectiveRoleDue(r,ep))):''}</div>${r.notes?`<p class="my-role-notes" title="${e(r.notes)}">${e(r.notes)}</p>`:''}<div class="my-role-footer"><button class="btn ghost small" data-action="open-project" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-tab="roles">Открыть проект ${icon('arrow')}</button>${reaperShortcutButton(p,ep)}</div></article>`).join('')}</div></div>
    </details>`;
  }).join('')}</div>`;
}
function renderMyTasks(){
  const roles=myRoleRows(state,{query:ui.query});
  const allRoles=myRoleRows(state),allTasks=taskRows(state,{includeArchived:true});
  const taskProjects=[...new Map(allTasks.map(({p})=>[p.id,p])).values()].sort((a,b)=>a.title.localeCompare(b.title,'ru'));
  const taskActors=[...new Map(allTasks.map(({ep,t})=>{
    const linked=taskAssignment(state,ep,t);
    return linked.actorId?[linked.actorId,{id:linked.actorId,name:linked.actorName||'Актёр без профиля'}]:null;
  }).filter(Boolean)).values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  if(ui.taskProject!=='all'&&!taskProjects.some(p=>p.id===ui.taskProject))ui.taskProject='all';
  if(ui.taskActor!=='all'&&ui.taskActor!=='unassigned'&&!taskActors.some(a=>a.id===ui.taskActor))ui.taskActor='all';
  const hasUnassigned=allTasks.some(({ep,t})=>!taskAssignment(state,ep,t).actorId);
  const tasks=taskRows(state,{query:ui.query,includeArchived:true,priority:ui.taskPriority||'all',
    order:ui.taskOrder,status:ui.taskStatus,lines:ui.taskLines,actorId:ui.taskActor,projectId:ui.taskProject});
  retainVisibleTasks(selectedTasks,tasks);
  const activeTasks=allTasks.filter(({t})=>!t.done).length;
  const filtered=ui.taskPriority!=='all'||ui.taskStatus!=='all'||ui.taskLines!=='all'||ui.taskActor!=='all'||ui.taskProject!=='all';
  const handle=state.settings.myTelegram||'';
  let html=heading('Мои задачи',handle?`Мои роли и поручения · @${handle}`:'Мои роли и поручения',`<button class="btn ghost small" data-nav="settings">${icon('settings')}Настроить профиль</button>`);
  html+=`<div class="my-overview"><div class="my-overview-item"><span>${icon('mic')} Назначено ролей</span><strong>${allRoles.length}</strong></div><div class="my-overview-item"><span>${icon('tasks')} Задач в работе</span><strong>${activeTasks}</strong></div><div class="my-overview-item"><span>${icon('grid')} Проектов с ролями</span><strong>${new Set(allRoles.map(x=>x.p.id)).size}</strong></div></div>`;
  html+=`<div class="panel-head my-section-head"><h2>Мои роли <span class="my-section-count">${roles.length}</span></h2><span class="small muted">Назначения @${e(handle||'не указан')} · полностью принятые серии скрыты</span></div>`;
  if(!roles.length){
    html+=`<div class="my-empty">${icon('mic')}<strong>${ui.query?'Роли не найдены':'Нет незавершённых ролей'}</strong><p>${ui.query?'Попробуй другой запрос.':'Полностью принятые серии автоматически скрыты. Остальные роли появятся здесь при назначении.'}</p><button class="btn ghost small" data-nav="actors">${icon('users')}Открыть актёров</button></div>`;
  }else{
    html+=`<div class="my-role-sort-toolbar"><label for="my-role-order">Сортировка моих ролей</label><select id="my-role-order" aria-label="Сортировать аниме по общей сумме реплик">${options(MY_ROLE_ORDERS,ui.myRoleOrder)}</select><span class="small muted">${ui.myRoleOrder==='original'?'Порядок по названию': 'Сумма реплик во всех моих ролях аниме · неполные данные в конце'}</span></div>`;
    html+=groupedMyRoles(roles);
  }
  const projects=[['all','Все проекты'],...taskProjects.map(p=>[p.id,p.title])];
  const actors=[['all','Все актёры'],...(hasUnassigned?[['unassigned','Без актёра']]:[]),...taskActors.map(a=>[a.id,a.name+vacationOptionSuffix(a.id)])];
  const filterControl=(id,label,choices,value)=>`<div class="my-task-filter"><label for="${id}">${label}</label><select id="${id}" aria-label="${label} поручений">${options(choices,value)}</select></div>`;
  html+=`<div class="panel-head my-section-head my-task-toolbar"><div class="my-task-toolbar-head"><h2>Мои поручения <span class="my-section-count">${tasks.length}</span></h2><button class="btn primary small" data-action="new-task">${icon('plus')}Добавить задачу</button></div>
    <div class="my-task-filters">
      ${filterControl('task-priority-filter','Приоритет',[['all','Все приоритеты'],...TASK_PRIORITIES],ui.taskPriority)}
      ${filterControl('task-order-filter','Сортировка',TASK_ORDERS,ui.taskOrder)}
      ${filterControl('task-lines-filter','Количество реплик',TASK_LINE_FILTERS,ui.taskLines)}
      ${filterControl('task-status-filter','Состояние',TASK_STATUS_FILTERS,ui.taskStatus)}
      ${filterControl('task-project-filter','Проект',projects,ui.taskProject)}
      ${filterControl('task-actor-filter','Актёр',actors,ui.taskActor)}
    </div><div class="my-task-filter-footer"><span class="small muted">Показано ${tasks.length} из ${allTasks.length} поручений${ui.taskOrder==='linesAsc'||ui.taskOrder==='linesDesc'?' · Без количества реплик — в конце списка':''}</span>${filtered||ui.taskOrder!=='priority'?`<button class="btn ghost small" data-action="reset-task-filters">${icon('refresh')}Сбросить фильтры</button>`:''}</div>
    ${tasks.length?`<div class="my-task-bulk-bar" aria-live="polite"><label class="my-task-select-all"><input type="checkbox" id="bulk-task-select-all" ${selectedTasks.size===tasks.length?'checked':''} aria-label="Выбрать все показанные задачи"> Выбрать все показанные</label><span class="my-task-bulk-count">Выбрано: <strong>${selectedTasks.size}</strong></span><button type="button" class="btn ghost small" data-action="clear-task-selection" ${selectedTasks.size?'':'disabled'}>Снять выбор</button><button type="button" class="btn danger small" data-action="delete-selected-tasks" ${selectedTasks.size?'':'disabled'}>${icon('trash')}Удалить выбранные (${selectedTasks.size})</button></div>`:''}</div>`;
  html+='<div class="my-priority-table">'+(tasksTable(tasks,true)||`<div class="my-empty my-empty-small">${icon('check')}<strong>${ui.query||filtered?'Задачи не найдены':'Личных поручений пока нет'}</strong><p>${ui.query||filtered?'Попробуй изменить параметры фильтров или сбросить их.':'Здесь автоматически показываются все задачи из проектов, включая прежние и архивные.'}</p></div>`)+ '</div>';
  return html;
}
function renderDebts(){
  const allProjects=activeProjects().slice().sort((a,b)=>a.title.localeCompare(b.title,'ru')||String(a.season||'').localeCompare(String(b.season||''),'ru'));
  if(ui.debtProject!=='all'&&!allProjects.some(p=>p.id===ui.debtProject)){ui.debtProject='all';saveUI();}
  const projectId=ui.debtProject==='all'?'':ui.debtProject;
  const total=debtRows(state,{projectId}),allActors=new Map();
  for(const item of total){
    const entry=allActors.get(item.actorKey);
    if(entry)entry.count++;
    else allActors.set(item.actorKey,{name:item.actorLabel,actor:item.actor,count:1});
  }
  const actorOptions=[...allActors.entries()]
    .sort((a,b)=>(a[1].actor?.telegram||a[1].name).localeCompare(b[1].actor?.telegram||b[1].name,'ru'));
  const filterAvatar=(actor,name)=>actor?.avatar
    ?`<span class="debt-picker-avatar"><img src="${e(actor.avatar)}" alt="" draggable="false"></span>`
    :`<span class="debt-picker-avatar debt-picker-initials">${e((name||'?').slice(0,2).toUpperCase())}</span>`;
  const actorDisplay=(item)=>`<span class="debt-picker-identity"><strong>${e(item.actor?.telegram?'@'+item.actor.telegram:item.name)}</strong>${item.actor?.telegram?`<small>${e(item.name)}</small>`:'<small>Telegram не указан</small>'}${vacationTag(item.actor?.id)}</span>`;
  // Сброс фильтра, если актёр больше не имеет долгов.
  if(ui.debtActor&&!allActors.has(ui.debtActor))ui.debtActor='';
  const rows=debtRows(state,{projectId,actorKey:ui.debtActor,status:ui.debtStatus,query:ui.query});
  const retakes=total.filter(({r})=>r.status==='retake').length;
  const currentProject=allProjects.find(p=>p.id===projectId);
  const totalProjectDebts=new Map(debtRows(state).reduce((acc,{p})=>(acc.set(p.id,(acc.get(p.id)||0)+1),acc),new Map()));
  const projectOptions=[['all','Все аниме'],...allProjects.map(p=>{
    const count=totalProjectDebts.get(p.id)||0;
    return [p.id,p.title+(p.season?' · Сезон '+p.season:'')+' ('+count+')'];
  })];
  let html=heading('Долги',currentProject?'Долги по аниме: '+currentProject.title+(currentProject.season?' · Сезон '+currentProject.season:''):'Ожидающие записи и перезаписи по всем активным проектам');
  html+=`<div class="debts-overview"><div class="debts-stat"><span>Всего долгов</span><strong>${total.length}</strong></div><div class="debts-stat"><span>Жду запись</span><strong>${total.length-retakes}</strong></div><div class="debts-stat"><span>На перезапись</span><strong>${retakes}</strong></div><div class="debts-stat"><span>Актёров с долгами</span><strong>${allActors.size}</strong></div><div class="debts-stat"><span>Из них в отпуске</span><strong>${[...allActors.values()].filter(x=>activeVacation(x.actor?.id)).length}</strong></div></div>`;
  const selected=allActors.get(ui.debtActor);
  const selectedSummary=selected
    ?`${filterAvatar(selected.actor,selected.name)}${actorDisplay(selected)}`
    :`<span class="debt-picker-avatar debt-picker-all">${icon('users')}</span><span class="debt-picker-identity"><strong>Все актёры</strong><small>${allActors.size} с долгами</small></span>`;
  const actorMenu=`<details class="debt-actor-picker" id="debt-actor-picker"><summary aria-label="Выбрать актёра для фильтра долгов">${selectedSummary}${icon('chevron','debt-picker-chevron')}</summary><div class="debt-actor-menu" role="group" aria-label="Актёры с долгами"><button type="button" class="debt-picker-option ${!ui.debtActor?'selected':''}" data-action="choose-debt-actor" data-key=""><span class="debt-picker-avatar debt-picker-all">${icon('users')}</span><span class="debt-picker-identity"><strong>Все актёры</strong><small>Показать все долги</small></span><span class="debt-picker-count">${total.length}</span></button>${actorOptions.map(([key,item])=>`<button type="button" class="debt-picker-option ${ui.debtActor===key?'selected':''}" data-action="choose-debt-actor" data-key="${e(key)}" title="${e((item.actor?.telegram?'@'+item.actor.telegram+' · ':'')+item.name)}">${filterAvatar(item.actor,item.name)}${actorDisplay(item)}<span class="debt-picker-count">${item.count}</span></button>`).join('')}</div></details>`;
  html+=`<div class="debts-filters"><label class="debts-field">Аниме <select id="debt-project-filter" aria-label="Фильтр долгов по аниме">${options(projectOptions,ui.debtProject)}</select></label><label class="debts-field">Актёр ${actorMenu}</label><label class="debts-field">Состояние <select id="debt-status-filter" aria-label="Фильтр состояния">${options([['all','Все долги'],...ROLE_STAGES.filter(([key])=>DEBT_STAGES.includes(key))],ui.debtStatus)}</select></label><span class="debts-result">Показано: <strong>${rows.length}</strong>${ui.debtProject!=='all'||ui.debtActor||ui.debtStatus!=='all'||ui.query?` <button type="button" class="btn ghost small" data-action="reset-debt-filters">Сбросить фильтры</button>`:''}</span></div>`;
  if(!rows.length)return html+`<div class="my-empty debts-empty">${icon('check')}<strong>${total.length?'По выбранным фильтрам долгов нет':currentProject?'В этом аниме долгов пока нет':'Долгов пока нет'}</strong><p>${total.length?'Попробуй другого актёра, состояние или очисти поиск.':currentProject?'В выбранном аниме пока нет назначенных ролей, ожидающих записи или перезаписи.':'Когда у назначенного актёра появится статус «Жду запись» или «На перезапись», роль появится здесь автоматически.'}</p></div>`;
  html+=`<div class="debts-list">${rows.map(({p,ep,r,actor,actorLabel})=>`<article class="debt-card role-row status-${e(r.status)}" data-qv-context="role" data-qv-actor="${e(actor?.id||'')}" data-qv-project="${e(p.id)}" data-qv-episode="${e(ep.id)}" data-qv-role="${e(r.id)}"><div class="debt-card-actor">${actor?`<button type="button" class="qv-avatar-button" data-qv-open="actor" data-qv-actor="${e(actor.id)}" aria-label="Открыть кабинет ${e(actor.name)}">${actorPickAvatar(actor)}</button>`:`<span class="debt-no-avatar">${e(actorLabel.slice(0,1).toUpperCase())}</span>`}<span class="debt-actor-meta"><button type="button" class="qv-inline-trigger" data-qv-open="actor" data-qv-actor="${e(actor?.id||'')}">${e(actorLabel)}</button>${actor?.telegram?`<small>@${e(actor.telegram)}</small>`:''}${vacationTag(actor?.id)}</span></div><div class="debt-card-role"><button type="button" class="qv-inline-trigger" data-qv-open="role" data-qv-project="${e(p.id)}" data-qv-episode="${e(ep.id)}" data-qv-role="${e(r.id)}">${e(r.character)}</button><span class="debt-project-line">${e(p.title)} · ${e(episodeLabel(p,ep))}</span>${r.notes?`<span class="debt-note" title="${e(r.notes)}">${e(r.notes)}</span>`:''}</div><div class="debt-card-actions"><span class="debt-status">${e(roleStageName(r.status))}</span><button class="btn ghost small" data-action="open-project" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-tab="roles">Открыть проект ${icon('arrow')}</button></div></article>`).join('')}</div>`;
  return html;
}
function renderDetail(){
  const p=getProject();if(!p){ui.page='projects';return renderProjects(counts());}const ep=getEpisode(p);ui.episode=ep.id;if(ui.tab==='overview')ui.tab='roles';
  let html=`<button class="back-button" data-nav="${p.archived?'archive':'projects'}">${icon('back')}Проекты</button><div class="detail-head"><button class="project-emblem color-${e(p.color)}" data-action="project-section" data-section="cover" data-id="${e(p.id)}" title="Изменить картинку" aria-label="Изменить картинку">${p.cover?`<img class="detail-poster" src="${e(p.cover)}" alt="">`:art(p)}</button><div class="detail-copy"><h1>${e(p.title)}</h1><div class="fv-project-age">${ageBadge(p.createdAt,true)}</div>${p.season?`<p>Сезон ${e(p.season)}${p.archived?' · В архиве':''}</p>`:''}</div><div class="detail-buttons"><button class="btn ghost" data-action="quick-reaper" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('reaper')}REAPER</button><button class="icon-btn" data-action="edit-project" data-id="${e(p.id)}" title="Изменить проект" aria-label="Изменить проект">${icon('edit')}</button></div></div><div class="episode-bar"><select id="episode-select" aria-label="Серия">${p.episodes.map(x=>`<option value="${e(x.id)}" ${x.id===ep.id?'selected':''}>${e(episodeLabel(p,x))}${x.title&&x.number?' · '+e(x.title):''}</option>`).join('')}</select><button class="btn ghost small" data-action="new-episode" data-id="${e(p.id)}">${icon('plus')}Серия</button><button class="icon-btn" data-action="edit-episode" data-id="${e(p.id)}" data-ep="${e(ep.id)}" title="Изменить серию" aria-label="Изменить серию">${icon('edit')}</button><select class="row-select episode-stage" data-id="${e(p.id)}" data-ep="${e(ep.id)}" aria-label="Этап серии">${options(STAGES,ep.stage)}</select>${ep.due?`<span class="small ${dueClass(ep.due,ep.stage==='done')}">${icon('calendar')} ${dueLabel(ep.due)}</span>`:''}</div><div class="episode-tabs">${[['roles','Роли',ep.roles.length],['materials','Файлы'],['tasks','Задачи',ep.tasks.filter(t=>!t.done&&(state.settings.mode!=='actor'||t.mine)).length]].map(([id,label,c])=>`<button data-tab="${id}" class="${ui.tab===id?'active':''}">${label}${c?`<span>${c}</span>`:''}</button>`).join('')}</div>`;
  if(ui.tab==='materials')return html+episodeMaterials(p,ep);if(ui.tab==='tasks')return html+episodeTasks(p,ep);return html+episodeRoles(p,ep);
}
function episodeMaterials(p,ep){
  const paths=ep.paths||{},tiles=keys=>keys.map(key=>{const label=PATHS.find(x=>x[0]===key)[1];return `<button class="folder-tile ${paths[key]?'connected':''}" data-action="open-episode-path" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-key="${key}" title="${e(paths[key]||label)}"><span class="folder-tile-icon">${icon(key==='reaper'?'reaper':'folder')}</span><span><strong>${e(label)}</strong><small>${paths[key]?e(paths[key].split(/[\\/]/).filter(Boolean).pop()):'Не указано'}</small></span>${paths[key]?icon('external'):icon('plus')}</button>`;}).join('');
  return `<div class="panel-head"><h2>Папки серии</h2><div class="btn-row"><button class="btn ghost small" data-action="episode-paths" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('settings')}Настроить</button><button class="btn primary small" data-action="create-folder" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('plus')}Новая папка</button></div></div><div class="folder-map primary-folders">${tiles(['root','reaper','source','voices','render'])}</div><details class="disclosure"><summary>Видео, звук, субтитры и Premiere</summary><div class="folder-map">${tiles(['video','audio','subs','characterSubs','premiere'])}</div></details><div class="panel-head"><h2>Файлы</h2><div class="btn-row"><button class="btn ghost small" data-action="scan" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('search')}Найти в папке</button><button class="btn primary small" data-action="add-resource" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('plus')}Добавить</button></div></div>${ep.resources.length?`<div class="resource-list">${ep.resources.map(r=>resourceRow(p,ep,r)).join('')}</div>`:empty('Файлы не добавлены','add-resource','Добавить файл',`data-id="${e(p.id)}" data-ep="${e(ep.id)}"`)}${ep.notes?`<details class="disclosure"><summary>Заметки</summary><p class="notes-text">${e(ep.notes)}</p></details>`:''}`;
}

function resolveMaterial(p,ep,id){return materialRows({projects:[{...p,archived:false}]}).find(x=>x.ep.id===ep.id&&x.r.id===id)?.r||ep.resources.find(r=>r.id===id);}
function resourceRow(p,ep,r,global=false){return `<div class="resource-row"><div class="file-icon ${e(r.kind)}">${icon(r.folder?'folder':r.kind==='reaper'?'reaper':'file')}</div><div class="resource-copy"><div class="resource-title">${e(r.label)}</div><div class="resource-path" title="${e(r.path)}">${e(r.path)}</div>${global?`<button class="text-button tiny" data-action="open-project" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-tab="materials">${e(p.title)} · ${e(episodeLabel(p,ep))}</button>`:''}</div><div class="row-controls"><button class="btn ghost small" data-action="open-resource" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}">Открыть</button><button class="icon-btn" data-action="edit-resource" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}" title="Изменить файл" aria-label="Изменить файл">${icon('edit')}</button></div></div>`;}

function episodeUnassignedList(ep){
  const available=episodeUnassignedActors(state,ep);
  const cards=available.map(actor=>{
    const account=(cloud.actors||[]).find(row=>row.actorId===actor.id && row.registered);
    const actorUsername=String(account?.username||'').trim().replace(/^@/,'');
    const telegram=cleanTelegram(actor.telegram||'');
    const label=actorUsername?'Actor @'+actorUsername+(telegram&&telegram.toLocaleLowerCase('ru')!==actorUsername.toLocaleLowerCase('ru')?' · TG @'+telegram:''):telegram?'@'+telegram:'Юзернейм не указан';
    return `<div class="episode-unassigned-person ${vacationFor(actor.id)?'on-vacation':''}" role="listitem" data-unassigned-search="${e([actor.name,actorUsername,telegram].join(' ').toLocaleLowerCase('ru'))}">${actorPickAvatar(actor)}<span class="episode-unassigned-person-copy"><strong>${e(actor.name)}</strong><small>${e(label)}</small></span>${vacationTag(actor.id)}</div>`;
  }).join('');
  return `<details class="episode-unassigned-dropdown">
    <summary aria-label="Показать актёров без назначений в текущей серии">${icon('users')}<span>Не задействованы</span><b>${available.length}</b>${icon('chevron')}</summary>
    <div class="episode-unassigned-menu" role="group" aria-label="Актёры без ролей в этой серии">
      <div class="episode-unassigned-caption">Не назначены в этой серии · ${available.length} из ${(state.actors||[]).length}</div>
      ${available.length>5?'<input class="episode-unassigned-search" type="search" placeholder="Поиск по имени или @username" aria-label="Найти незадействованного актёра" autocomplete="off">':''}
      <div class="episode-unassigned-list" role="list">${cards||`<p class="episode-unassigned-empty">${state.actors?.length?'Все актёры уже задействованы в этой серии':'В базе пока нет актёров'}</p>`}</div>
      <p class="episode-unassigned-no-matches" hidden>Совпадений нет</p>
    </div>
  </details>`;
}
function acceptedEpisodeRolesForActors(p,ep){
  // Use review-adjusted stages, just like the episode table. Never change
  // Studio assignments, statuses, local files or published roster snapshots.
  const merged=withRoleReviews({projects:[p]},cloud.reviews||[]).projects[0].episodes.find(item=>item.id===ep.id);
  const hidden=new Set((cloud.hiddenRoles||[]).map(x=>x.actorId+'|'+x.roleId));
  const active=new Set((cloud.actors||[]).filter(x=>x.enabled).map(x=>x.actorId));
  const actorListKnown=cloud.connected&&(cloud.actors||[]).length>0;
  const seen=new Set();
  return (merged?.roles||[]).flatMap(r=>{
    const actor=actorForRole(state,r);
    if(r.status!=='done'||!actor?.id||(actorListKnown&&!active.has(actor.id))||hidden.has(actor.id+'|'+r.id)||seen.has(r.id))return [];
    seen.add(r.id);
    return [{actorId:actor.id,roleId:r.id}];
  });
}
function episodeRoles(p,ep){
  const mine=state.settings.mode==='actor';
  const viewEp=withRoleReviews({projects:[p]},cloud.reviews||[]).projects[0].episodes.find(item=>item.id===ep.id);
  const all=viewEp.roles.filter(r=>!mine||r.mine);
  const hideable=acceptedEpisodeRolesForActors(p,ep);
  const actorChoices=episodeRoleActorOptions(state,all);
  const characterChoices=episodeRoleCharacterOptions(all);
  const rows=filterEpisodeRoles(state,all,{status:ui.roleFilter||'all',actorKey:ui.roleActor||'all',characterKey:ui.roleCharacter||'all',order:ui.roleOrder||'original'}).map(r=>({p,ep,r}));
  const actorOptions=[['all','Все актёры'],...actorChoices.map(a=>[a.key,`${a.label}${vacationOptionSuffix(a.key.startsWith('id:')?a.key.slice(3):'')} (${a.count})`])];
  const characterOptions=[['all','Все персонажи'],...characterChoices.map(c=>[c.key,`${c.label} (${c.count})`])];
  return `<div class="panel-head"><div class="role-count">${ep.roles.length} ролей</div><div class="btn-row">${hideable.length?`<button type="button" class="btn ghost small episode-hide-accepted" data-action="hide-accepted-episode" data-id="${e(p.id)}" data-ep="${e(ep.id)}" title="Убрать принятые роли этой серии из активных списков актёров. Статусы, записи и таблица Studio останутся без изменений." ${!native||!cloud.connected?'disabled':''}>${icon('eye-off')}Скрыть принятые роли (${hideable.length})</button>`:''}<button class="btn ghost small" data-action="cast-preview" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('copy')}Состав для чата</button><button class="btn primary small" data-action="new-role" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('plus')}Роль</button></div></div><div class="role-toolbar"><select class="row-select" id="role-filter" aria-label="Фильтр по статусу">${options([['all','Все статусы'],...ROLE_STAGES],ui.roleFilter||'all')}</select><select class="row-select" id="role-actor-filter" aria-label="Фильтр по актёру">${options(actorOptions,ui.roleActor||'all')}</select><select class="row-select" id="role-order" aria-label="Сортировка ролей">${options([['original','По порядку'],['workload','Больше ролей сверху'],['actor','По имени актёра']],ui.roleOrder||'original')}</select><select class="row-select" id="role-character-filter" aria-label="Фильтр по персонажу">${options(characterOptions,ui.roleCharacter||'all')}</select>${episodeUnassignedList(ep)}<span class="role-filter-count">Показано ${rows.length} из ${all.length}</span><button class="text-button" data-action="import-roles" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('folder')}Импорт из озвучки</button></div>${rolesTable(rows)||empty(all.length?'Ничего не найдено. Измени фильтр персонажа, актёра или статуса.':'Добавь персонажей серии','new-role','Добавить роль',`data-id="${e(p.id)}" data-ep="${e(ep.id)}"`)}`;
}
const actorLabel=a=>a.name+(a.telegram?' @'+a.telegram:'');
// Встроенный визуальный выбор актёра: карточки загружаются в список только при открытии.
// И модальная форма новой роли, и таблица используют одни и те же карточки из базы актёров.
function actorPickAvatar(actor){
  const initials=(actor?.name||'?').slice(0,2).toLocaleUpperCase('ru');
  return `<span class="actor-pick-avatar ${actor?.voiceGroup?'voice-'+e(actor.voiceGroup):''}">${actor?.avatar?`<img src="${e(actor.avatar)}" alt="" loading="lazy">`:e(initials)}</span>`;
}
function actorPicker(role,{form=false,pid='',eid=''}={}){
  const actor=actorForRole(state,role),legacy=!actor&&!!role.actor;
  const selected=actor?.id|| (legacy?'__legacy__':'');
  const name=actor?.name||role.actor||'Не назначен';
  const extra=activeVacation(actor?.id)?'⛔ В отпуске — новые роли не назначать':vacationFor(actor?.id)?'◷ Отпуск запланирован':actor?.telegram?'@'+actor.telegram:legacy?'Старая запись':'Нажми, чтобы выбрать из базы';
  const id=role.id||'';
  const relatedEpisode=!form&&pid&&eid?getEpisode(getProject(pid),eid):null;
  const otherCount=relatedEpisode&&actor?episodeActorWorkload(relatedEpisode,actor.id,id).count:null;
  const extraWithLoad=extra+(otherCount===null?'':' · '+otherCount+' других ролей в серии');
  return `<div class="actor-picker ${form?'actor-picker-form':'actor-picker-table'}" data-picker-scope="${form?'form':'row'}" data-id="${e(pid)}" data-ep="${e(eid)}" data-item="${e(id)}">
    <button type="button" class="actor-picker-trigger" data-action="actor-picker-toggle" aria-haspopup="true" aria-expanded="false" title="Выбрать актёра из базы">
      ${actorPickAvatar(actor||{name:legacy?role.actor:'?'})}<span class="actor-picker-selected"><strong>${e(name)}</strong><small>${e(extraWithLoad)}</small></span>${icon('chevron')}
    </button>
    ${form?`<input type="hidden" name="actorId" value="${e(selected)}">`:''}
    <div class="actor-picker-menu" hidden>
      <input class="actor-picker-search" type="search" placeholder="Поиск по имени или @username" aria-label="Найти актёра" autocomplete="off">
      <label class="actor-picker-show-all"><input type="checkbox" class="actor-picker-show-all-input"> Показать всех актёров</label>
      <div class="actor-picker-options" role="group" aria-label="Актёры"></div>
    </div>
  </div>`;
}
function fillActorPicker(picker,query=''){
  const target=picker.querySelector('.actor-picker-options');if(!target)return;
  const q=query.trim().toLocaleLowerCase('ru');
  let found=(state.actors||[]).filter(a=>`${a.name} ${a.telegram||''}`.toLocaleLowerCase('ru').includes(q));
  const max=200;
  const isForm=picker.dataset.pickerScope==='form';
  let currentEp;
  if(isForm){try{currentEp=resolveTarget(modal.querySelector('[name=target]')?.value).ep;}catch{}}
  else currentEp=getEpisode(getProject(picker.dataset.id),picker.dataset.ep);
  const roleId=picker.dataset.item,role=currentEp?.roles.find(r=>r.id===roleId);
  const gender=isForm?validRoleVoice(modal.querySelector('[name=voiceGender]')?.value):roleVoiceFromActor(role,state.actors.find(a=>a.id===role?.actorId));
  const toggle=picker.querySelector('.actor-picker-show-all');
  if(toggle)toggle.hidden=!gender;
  const showAll=!!toggle?.querySelector('input')?.checked;
  if(gender&&!showAll)found=found.filter(a=>a.voiceGroup===gender);
  const load=a=>episodeActorWorkload(currentEp,a.id,roleId);
  found.sort((a,b)=>(gender?Number(a.voiceGroup!==gender)-Number(b.voiceGroup!==gender):0)||
    load(a).count-load(b).count||a.name.localeCompare(b.name,'ru'));
  const makeCard=a=>{
    const workload=load(a),mismatch=gender&&a.voiceGroup!==gender;
    const leave=activeVacation(a.id)?'⛔ В отпуске — недоступен':vacationFor(a.id)?'◷ Отпуск запланирован':a.telegram?'@'+a.telegram:'Без Telegram';
    return `<button type="button" class="actor-picker-option ${vacationFor(a.id)?'on-vacation':''}" data-action="actor-picker-select" data-actor-value="${e(a.id)}" ${activeVacation(a.id)?'disabled aria-disabled="true"':''} title="${e(a.name)}${a.telegram?' @'+e(a.telegram):''}${mismatch?' · Тип голоса отличается':''}">${actorPickAvatar(a)}<span class="actor-picker-option-text"><strong>${e(a.name)}</strong><small>${e(leave)}</small><small>${workload.count} других ролей в серии${mismatch?' · ⚠ другой тип голоса':''}</small></span></button>`;
  };
  const groups=CAST_GROUPS.map(([cast,label])=>{
    const members=found.filter(a=>(a.castGroup||'')===cast);
    if(!members.length)return '';
    return `<div class="actor-picker-group"><div class="actor-picker-group-title">${e(label)} <span>${members.length}</span></div><div class="actor-picker-grid">${members.slice(0,max).map(makeCard).join('')}</div></div>`;
  }).join('');
  target.innerHTML=`<div class="actor-picker-special"><button type="button" class="actor-picker-option" data-action="actor-picker-select" data-actor-value="">${actorPickAvatar({name:'—'})}<span class="actor-picker-option-text"><strong>Не назначен</strong><small>Убрать актёра</small></span></button>${picker.dataset.pickerScope==='form'?`<button type="button" class="actor-picker-option" data-action="actor-picker-select" data-actor-value="__new__">${actorPickAvatar({name:'+'})}<span class="actor-picker-option-text"><strong>+ Новый актёр</strong><small>Добавить в базу</small></span></button>`:''}</div>${groups||'<p class="actor-picker-no-results">По запросу актёры не найдены</p>'}${found.length>max?'<p class="actor-picker-limit">Если не видишь актёра, начни вводить его имя в поиске.</p>':''}`;
}
function closeActorPickers(except=null){
  document.querySelectorAll('.actor-picker-menu:not([hidden])').forEach(menu=>{
    const picker=menu.closest('.actor-picker');if(picker===except)return;
    menu.hidden=true;picker.querySelector('.actor-picker-trigger')?.setAttribute('aria-expanded','false');
  });
}
function updateActorPicker(picker,id){
  const a=state.actors.find(a=>a.id===id),isNew=id==='__new__';
  if(a&&activeVacation(a.id)){toast('Актёр сейчас в отпуске. Выбери другого исполнителя.',true);return;}
  if(picker.dataset.pickerScope==='form'){
    const field=picker.querySelector('[name=actorId]');field.value=id;
    const voice=modal.querySelector('[name=voiceGender]');if(a&&voice&&!validRoleVoice(voice.value))voice.value=validRoleVoice(a.voiceGroup);
    const row=modal.querySelector('#new-actor-inline'),input=modal.querySelector('[name=newActorName]');
    if(row&&input){row.hidden=!isNew;input.disabled=!isNew;input.required=isNew;if(isNew)input.focus();}
  }else{
    const p=getProject(picker.dataset.id),ep=getEpisode(p,picker.dataset.ep),r=ep?.roles.find(r=>r.id===picker.dataset.item);
    if(!p||!r)return;
    applyRoleVoiceFromActor(r,state.actors.find(x=>x.id===r.actorId));if(r.actorId!==(a?.id||'')){r.status='waiting';r.reviewSeen='';}r.actorId=a?.id||'';r.actor=a?.name||'';applyRoleVoiceFromActor(r,a);touch(p);
  }
  const legacy=id==='__legacy__';
  const name=a?.name||(isNew?'Новый актёр':legacy?'Старая запись':'Не назначен');
  const label=a&&vacationFor(a.id)?'◷ Отпуск запланирован':a?.telegram?'@'+a.telegram:isNew?'Впиши имя ниже':'Нажми, чтобы выбрать из базы';
  const trigger=picker.querySelector('.actor-picker-trigger');
  trigger.innerHTML=`${actorPickAvatar(a||{name:isNew?'+':'?'})}<span class="actor-picker-selected"><strong>${e(name)}</strong><small>${e(label)}</small></span>${icon('chevron')}`;
  closeActorPickers();
  if(picker.dataset.pickerScope==='form')updateCastingSuggestions();
  if(picker.dataset.pickerScope==='row')render();
}

function actorCabinetVisibilityButton(p,ep,r){
 const actor=actorForRole(state,r);
 if(!actor?.id)return '';
 const hidden=(cloud.hiddenRoles||[]).some(x=>x.actorId===actor.id&&x.roleId===r.id);
 if(r.status!=='done'&&!hidden)return '';
 const label=hidden?'Вернуть актёру':'Скрыть у актёра';
 const title=hidden?'Вернуть роль в кабинет актёра. Назначение в Studio не меняется.':'Скрыть принятую роль только из кабинета актёра. В Studio она останется.';
 return `<button type="button" class="icon-btn actor-cabinet-visibility ${hidden?'is-hidden':''}"
  data-action="actor-cabinet-visibility" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}"
  data-actor="${e(actor.id)}" data-hidden="${hidden?'false':'true'}"
  title="${e(title)}" aria-label="${label}: ${e(r.character)}"
  ${!native||!cloud.connected?'disabled':''}>${icon(hidden?'restore':'eye-off')}</button>${hidden?'<small class="role-actor-hidden-label">Скрыта у актёра</small>':''}`;
}
function roleImageThumb(role){const image=safeRoleImage(role?.image);return image?`<button type="button" class="role-character-image" data-role-image-open aria-label="Увеличить персонажа ${e(role.character)}"><img src="${e(image)}" alt="${e(role.character)}"></button>`:'';}
function rolesTable(rows,global=false){return !rows.length?'':`<div class="table-wrap"><table class="cast-table"><thead><tr><th>Персонаж</th><th>Актёр</th>${global?'<th>Проект</th>':''}<th>Обработка</th><th>Возраст</th><th></th></tr></thead><tbody>${rows.map(({p,ep,r})=>`<tr class="role-row status-${e(r.status)}" data-qv-context="role" data-qv-actor="${e(r.actorId||'')}" data-qv-project="${e(p.id)}" data-qv-episode="${e(ep.id)}" data-qv-role="${e(r.id)}"><td>${roleImageThumb(r)}<button type="button" class="character-name qv-inline-trigger" data-qv-open="role" data-qv-project="${e(p.id)}" data-qv-episode="${e(ep.id)}" data-qv-role="${e(r.id)}">${e(r.character)}</button>${r.lineCount!==null&&Number.isInteger(r.lineCount)?`<span class="role-line-count" title="Количество реплик персонажа">${r.lineCount} репл.</span>`:''}${validRoleVoice(r.voiceGender)?`<span class="role-voice-badge">${e(roleVoiceLabel(r.voiceGender))}</span>`:''}${reviewMarker(r)}${effectiveRoleDue(r,ep)?`<small class="role-due ${dueClass(effectiveRoleDue(r,ep),r.status==='done')}">${icon('calendar')} ${e(dueLabel(effectiveRoleDue(r,ep)))}</small>`:''}${r.mine?' <span class="pill">Моя</span>':''}${r.notes?`<span class="note-dot" title="${e(r.notes)}">•</span>`:''}</td><td>${actorPicker(r,{pid:p.id,eid:ep.id})}${vacationTag(r.actorId)}</td>${global?`<td><button class="text-button" data-action="open-project" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-tab="roles">${e(p.title)}</button><div class="table-sub">${e(episodeLabel(p,ep))}</div></td>`:''}<td><select class="row-select role-status status-${e(r.status)}" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}" aria-label="Обработка ${e(r.character)}">${options(ROLE_STAGES,r.status)}</select></td><td>${ageBadge(r.createdAt)}</td><td><div class="table-actions">${roleRecordingButton(p,ep,r)}${actorCabinetVisibilityButton(p,ep,r)}${native&&actorForRole(state,r)?.actorAccess?`<button class="icon-btn" data-action="review-role" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}" title="Ответить актёру" aria-label="Ответить актёру">${icon('chat')}</button>`:''}${r.folder?`<button class="icon-btn" data-action="role-folder" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}" title="Голос" aria-label="Папка голоса">${icon('folder')}</button>`:''}${r.subtitle?`<button class="icon-btn" data-action="role-subs" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}" title="Субтитры" aria-label="Субтитры персонажа">${icon('file')}</button>`:''}<button class="icon-btn" data-action="edit-role" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}" title="Изменить роль" aria-label="Изменить роль">${icon('edit')}</button></div></td></tr>`).join('')}</tbody></table></div>`;}

function episodeTasks(p,ep){return `<div class="panel-head"><h2>Задачи</h2><button class="btn primary small" data-action="new-task" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('plus')}Добавить</button></div>${tasksTable(ep.tasks.filter(t=>state.settings.mode!=='actor'||t.mine).map(t=>({p,ep,t})))||empty('Нет задач','new-task','Добавить задачу',`data-id="${e(p.id)}" data-ep="${e(ep.id)}"`)}`;}
// Compact visual identity cells for task assignments; always derive from live project/role/actor data.
function taskProjectVisual(p,ep){
  return `<button type="button" class="task-identity task-project-identity" data-action="open-project" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-tab="tasks" title="Открыть ${e(p.title)} · ${e(episodeLabel(p,ep))}">
    <span class="task-identity-image task-project-image">${projectArt(p)}</span>
    <span class="task-identity-copy"><strong>${e(p.title)}</strong><small>${e(episodeLabel(p,ep))}</small></span>
  </button>`;
}
function taskActorVisual(linked){
  const actor=linked.actor;
  const name=linked.actorName||'—';
  const image=actor&&safeCover(actor.avatar);
  const avatar=`<span class="task-identity-image task-actor-image">${image?`<img src="${e(image)}" alt="" loading="lazy">`:`<span class="task-actor-initials">${e((name==='—'?'?':name.trim().slice(0,2)).toLocaleUpperCase('ru'))}</span>`}</span>`;
  return actor?`<button type="button" class="task-identity task-actor-identity" data-qv-open="actor" data-qv-actor="${e(actor.id)}" title="Карточка актёра: ${e(name)}">${avatar}<span class="task-identity-copy"><strong>${e(name)}</strong></span></button>`:
    `<span class="task-identity task-identity-unlinked">${avatar}<span class="task-identity-copy"><strong>${e(name)}</strong></span></span>`;
}
function taskCharacterVisual(p,ep,linked,character){
  const role=linked.role;
  const image=safeRoleImage(role?.image);
  const photo=`<span class="task-identity-image task-character-image">${image?`<img src="${e(image)}" alt="" loading="lazy">`:`<span class="task-character-placeholder">${icon('mic')}</span>`}</span>`;
  return role?`<button type="button" class="task-identity task-character-identity" data-qv-open="role" data-qv-project="${e(p.id)}" data-qv-episode="${e(ep.id)}" data-qv-role="${e(role.id)}" title="Карточка персонажа: ${e(character)}">${photo}<span class="task-identity-copy"><strong>${e(character)}</strong></span></button>`:
    `<span class="task-identity task-identity-unlinked">${photo}<span class="task-identity-copy"><strong>${e(character)}</strong></span></span>`;
}

function tasksTable(rows,global=false){
  if(!rows.length)return '';
  const bulk=global&&ui.page==='mytasks';
  const body=rows.map(({p,ep,t})=>{
    const linked=taskAssignment(state,ep,t);
    const actor=linked.actorName||'—';
    const character=linked.role?.character||(t.roleId?'Роль удалена':'—');
    const workload=linked.role?(linked.lineCount===null?'Не указано':linked.lineCount+' репл.'):'—';
    const workloadClass=linked.lineCount===null?'task-workload-unknown':linked.lineCount<=50?'task-workload-low':linked.lineCount<=100?'task-workload-medium':'task-workload-high';
    const checked=bulk&&selectedTasks.has(bulkTaskKey(p.id,ep.id,t.id));
    return `<tr class="task-priority-row priority-${e(taskPriority(t.priority))} ${t.done?'task-done':''} ${checked?'task-bulk-selected':''}" data-priority="${e(taskPriority(t.priority))}">${bulk?`<td class="task-bulk-cell"><input type="checkbox" class="task-bulk-checkbox" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(t.id)}" aria-label="Выбрать задачу ${e(t.title)}" ${checked?'checked':''}></td>`:''}<td><button class="task-check ${t.done?'done':''}" data-action="toggle-task" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(t.id)}" title="${t.done?'Вернуть в работу':'Выполнено'}" aria-pressed="${t.done}">${t.done?icon('check'):''}</button></td><td class="${t.done?'done-text':''}"><strong class="task-row-title">${e(t.title)}</strong>${t.mine?' <span class="pill">Моя</span>':''}</td>${global?`<td class="task-project-cell">${taskProjectVisual(p,ep)}</td>`:''}<td class="task-actor-cell">${taskActorVisual(linked)}${vacationTag(linked.actorId)}</td><td class="task-character-cell">${taskCharacterVisual(p,ep,linked,character)}</td><td><span class="task-line-count ${workloadClass}" title="${linked.lineCount===null?'Количество реплик не указано':linked.lineCount<=50?'Мало реплик (0–50)':linked.lineCount<=100?'Средний объём (51–100)':'Много реплик (101+)'}">${e(workload)}</span></td><td><select class="task-priority-select" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(t.id)}" aria-label="Приоритет задачи ${e(t.title)}">${options(TASK_PRIORITIES,taskPriority(t.priority))}</select></td><td class="small ${dueClass(t.due,t.done)}">${t.due?dueLabel(t.due):'—'}</td><td>${reaperShortcutButton(p,ep,true)}<button class="icon-btn" data-action="edit-task" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(t.id)}" title="Изменить задачу" aria-label="Изменить задачу">${icon('edit')}</button></td></tr>`;
  }).join('');
  return `<div class="table-wrap task-table-wrap"><table class="tasks-priority-table"><thead><tr>${bulk?'<th class="task-bulk-cell">Выбор</th>':''}<th>Готово</th><th>Задача</th>${global?'<th>Проект</th>':''}<th>Актёр</th><th>Персонаж</th><th>Реплики</th><th>Приоритет</th><th>Срок</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function actorAvatar(a,large=false){return `<button type="button" class="actor-avatar ${large?'actor-avatar-large':''}" data-action="actor-avatar" data-actor="${e(a.id)}" title="Изменить аватар" aria-label="Аватар ${e(a.name)}">${a.avatar?`<img src="${e(a.avatar)}" alt="" draggable="false">`:e(a.name.slice(0,2).toUpperCase())}</button>`;}
function actorCard(a){return `<article class="actor-card actor-compact" data-voice="${e(a.voiceGroup||'')}" data-qv-context="actor" data-qv-actor="${e(a.id)}" draggable="true" data-drag-actor="${e(a.id)}"><span class="actor-drag-handle" title="Перетащить актёра" aria-hidden="true">${icon('grip')}</span>${actorAvatar(a)}<div class="actor-identity"><button class="actor-name" data-action="actor-details" data-actor="${e(a.id)}" title="${e(a.name)}">${e(a.name)}</button>${a.telegram?`<div class="actor-telegram" title="@${e(a.telegram)}">@${e(a.telegram)}</div>`:''}${vacationTag(a.id)}</div><div class="actor-row-actions"><button class="icon-btn" data-action="actor-details" data-actor="${e(a.id)}" title="Демки: ${a.demos.length}" aria-label="Демки ${e(a.name)}">${icon('play')}</button><button class="icon-btn" data-action="actor-roles" data-actor="${e(a.id)}" title="Роли: ${actorAssignments(state,a.id).length}" aria-label="Роли ${e(a.name)}">${icon('mic')}</button><button class="icon-btn" data-action="edit-actor" data-actor="${e(a.id)}" title="Изменить актёра" aria-label="Изменить ${e(a.name)}">${icon('edit')}</button></div></article>`;}
// Team-wide workload board. Every card is a read-only view of existing role assignments.
function renderWorkload(){
  const all=actorWorkloadRows(state,{includeArchived:ui.workloadIncludeArchive});
  const rows=actorWorkloadRows(state,{includeArchived:ui.workloadIncludeArchive,query:ui.query});
  const groups=actorWorkloadGroups(rows);
  const pending=all.reduce((sum,item)=>sum+item.pending,0);
  const knownLines=all.reduce((sum,item)=>sum+item.pendingLines,0);
  const view=(item)=>{
    const a=item.actor;
    const initial=e((a.name||'?').trim().slice(0,2).toUpperCase());
    const avatar=a.avatar?'<img src="'+e(a.avatar)+'" alt="" loading="lazy">':initial;
    const linesLabel=item.pendingUnknown?'известно '+item.pendingLines+' репл. · '+item.pendingUnknown+' без числа':item.pendingLines+' репл.';
    return '<article class="workload-actor-card" data-tier="'+item.tier+'" data-qv-context="actor" data-qv-actor="'+e(a.id)+'">'+
      '<div class="workload-actor-top"><button type="button" class="workload-actor-identity" data-qv-open="actor" data-qv-actor="'+e(a.id)+'" title="Открыть карточку актёра '+e(a.name)+'">'+
      '<span class="workload-actor-avatar">'+avatar+'</span><span class="workload-actor-name"><strong>'+e(a.name)+'</strong>'+
      (a.telegram?'<small>@'+e(a.telegram)+'</small>':'<small>Без Telegram</small>')+'</span></button>'+
      '<span class="workload-actor-score" title="Условный индекс: максимум из количества ролей на запись и реплик / 50">'+item.score+'</span></div>'+
      (vacationTag(a.id)?'<div class="workload-vacation">'+vacationTag(a.id)+'</div>':'')+
      '<div class="workload-actor-metrics">'+
      '<span><strong>'+item.pending+'</strong><small>На запись</small></span>'+
      '<span><strong>'+item.inReview+'</strong><small>На проверке</small></span>'+
      '<span><strong>'+item.total+'</strong><small>Всего ролей</small></span></div>'+
      '<div class="workload-actor-foot"><span>'+e(linesLabel)+'</span><span>'+item.projectsCount+' '+(item.projectsCount===1?'проект':'проектов')+'</span></div>'+
      '<button type="button" class="workload-actor-open" data-qv-open="actor" data-qv-actor="'+e(a.id)+'">Посмотреть роли '+icon('arrow')+'</button>'+
      '</article>';
  };
  const section=(key,title,explanation)=>{
    const items=groups[key];
    return '<section class="workload-section" data-tier="'+key+'"><div class="workload-section-heading"><div><h2>'+title+'</h2><p>'+explanation+'</p></div><span class="workload-section-count">'+items.length+'</span></div>'+
      (items.length?'<div class="workload-grid">'+items.map(view).join('')+'</div>':'<p class="workload-section-empty">Пока нет актёров в этой группе.</p>')+'</section>';
  };
  let html=heading('Нагрузка','Все назначения по актёрам — без ручного подсчёта.');
  html+='<div class="workload-dashboard-stats"><div><small>Актёров</small><strong>'+all.length+'</strong></div>'+
    '<div><small>Ролей на запись</small><strong>'+pending+'</strong></div>'+
    '<div><small>Известных реплик на запись</small><strong>'+knownLines+'</strong></div></div>';
  html+='<div class="workload-tools"><label class="workload-scope-toggle"><input type="checkbox" id="workload-include-archive" '+(ui.workloadIncludeArchive?'checked':'')+'> Учитывать архивные проекты</label>'+
    '<p>В расчёт нагрузки входят роли «Жду запись», «В записи» и «На перезапись». Ожидающие проверки и принятые роли показаны отдельно.</p></div>';
  if(!rows.length)return html+'<div class="workload-section-empty">По запросу актёры не найдены.</div>';
  html+=section('high','Высокая нагрузка','6 и более условных единиц нагрузки. Сюда стоит заглянуть перед новым назначением.');
  html+=section('medium','Средняя нагрузка','От 3 до 5 условных единиц. Можно распределять новые роли с учётом сроков.');
  html+=section('low','Низкая нагрузка','0–2 условные единицы. В первую очередь стоит проверить этих актёров для новых ролей.');
  return html+'<p class="workload-explainer">Для ориентировочной оценки одна роль = 1 единица, каждые 50 известных реплик = 1 единица. Используется большее из двух значений, чтобы одна большая роль не выглядела маленькой нагрузкой. Это подсказка, а не автоматическое решение о кастинге. Данные обновляются вместе с ролями Studio.</p>';
}
function renderActors(){
  const q=ui.query.trim().toLocaleLowerCase('ru');
  const actors=(state.actors||[]).filter(a=>`${a.name} ${a.telegram} ${a.notes}`.toLocaleLowerCase('ru').includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  const voices=[['male','Мужские актёры'],['female','Женские актёры'],['','Не указано']];
  const opened=(key,count)=>q&&count>0||ui.actorExpanded.includes(key)?' open':'';
  let html=heading('Актёры','',`<button class="btn primary" data-action="new-actor">${icon('plus')}Добавить актёра</button>`);
  if(q&&!actors.length)return html+empty('Ничего не найдено','clear-search','Сбросить поиск');
  return html+CAST_GROUPS.map(([cast,label])=>{
    const members=actors.filter(a=>(a.castGroup||'')===cast);if(!members.length&&!cast)return '';
    const castKey='cast:'+(cast||'unspecified');
    const sections=voices.map(([key,voice])=>{
      const group=members.filter(a=>(a.voiceGroup||'')===key);if(!group.length&&!key)return '';
      const voiceKey='voice:'+(cast||'unspecified')+':'+(key||'unspecified');
      return `<details class="actor-voice-fold" data-voice="${key}" data-actor-drop="voice" data-drop-cast="${cast}" data-drop-voice="${key}" data-actor-fold="${voiceKey}"${opened(voiceKey,group.length)}><summary>${icon('chevron','accordion-chevron')}<span>${e(voice)}</span><span class="accordion-count">${group.length}</span></summary><div class="actor-voice-content">${group.length?`<div class="actors-grid">${group.map(actorCard).join('')}</div>`:'<p class="empty-caption cast-empty">Актёры не добавлены</p>'}<button class="btn ghost small group-add-actor" data-action="new-actor" data-cast="${cast}" data-voice="${key}">${icon('plus')}Добавить актёра</button></div></details>`;
    }).join('');
    return `<details class="actor-cast-fold" data-actor-drop="cast" data-drop-cast="${cast}" data-actor-fold="${castKey}"${opened(castKey,members.length)}><summary>${icon('chevron','accordion-chevron')}<span>${e(label)}</span><span class="accordion-count">${members.length}</span></summary><div class="actor-cast-content">${sections}</div></details>`;
  }).join('');
}
function expandActorGroup(a){
  for(const key of ['cast:'+(a.castGroup||'unspecified'),'voice:'+(a.castGroup||'unspecified')+':'+(a.voiceGroup||'unspecified')])if(!ui.actorExpanded.includes(key))ui.actorExpanded.push(key);
  saveUI();
}
function actorDropZone(target){
  const zone=target?.closest?.('[data-actor-drop]');if(!zone||!['cast','voice'].includes(zone.dataset.actorDrop)||!CAST_GROUPS.some(([key])=>key===zone.dataset.dropCast))return null;
  if(zone.dataset.actorDrop==='voice'&&!ACTOR_GROUPS.some(([key])=>key===zone.dataset.dropVoice))return null;
  return zone;
}
function setActorDropTarget(zone){
  if(!actorDrag||actorDrag.target===zone)return;
  clearTimeout(actorDrag.hoverTimer);actorDrag.target?.classList.remove('actor-drop-active');actorDrag.target=zone;
  if(!zone)return;zone.classList.add('actor-drop-active');
  if(zone.open)return;const drag=actorDrag;
  drag.hoverTimer=setTimeout(()=>{if(actorDrag!==drag||drag.target!==zone)return;zone.open=true;const key=zone.dataset.actorFold;if(key&&!ui.actorExpanded.includes(key)){ui.actorExpanded.push(key);saveUI();}},550);
}
function endActorDrag(){
  if(!actorDrag)return;clearTimeout(actorDrag.hoverTimer);actorDrag.source.classList.remove('actor-dragging');actorDrag.target?.classList.remove('actor-drop-active');actorDrag=null;delete document.body.dataset.actorDragging;
}
function moveActorToGroup(id,cast,voice){
  const a=state.actors.find(a=>a.id===id);if(!a||!CAST_GROUPS.some(([key])=>key===cast)||voice!==undefined&&!ACTOR_GROUPS.some(([key])=>key===voice))return false;
  const nextVoice=voice===undefined?a.voiceGroup:voice;if(a.castGroup===cast&&a.voiceGroup===nextVoice)return false;
  a.castGroup=cast;a.voiceGroup=nextVoice;expandActorGroup(a);persist();render();
  const card=Array.from(app.querySelectorAll('[data-drag-actor]')).find(el=>el.dataset.dragActor===id);if(card){card.classList.add('actor-drop-flash');setTimeout(()=>card.classList.remove('actor-drop-flash'),700);}
  toast('Актёр перенесён');return true;
}
function renderRecoveries(){
 let html=heading('Запросы на сброс пароля','Актёр возвращается к прежнему аккаунту и всем ролям');
 if(!native||!cloud.connected)return html+'<div class="panel"><p class="muted">Подключи Studio к Cloud, чтобы принимать запросы.</p></div>';
 html+='<div class="panel"><p class="muted small">Перед одобрением обязательно подтверди личность актёра через известный тебе Telegram или другой привычный канал.</p><div class="btn-row"><button type="button" class="btn ghost small" data-action="recovery-refresh">Обновить заявки</button></div></div>';
 if(!recoveryRequests.length)return html+'<div class="panel"><p class="muted">Ожидающих запросов нет.</p></div>';
 html+='<div class="actor-cloud-grid">'+recoveryRequests.map(row=>{
  const actor=(state.actors||[]).find(a=>a.id===row.actorId);
  return `<article class="actor-cloud-card"><div class="actor-cloud-identity"><div>
  <strong>${e(actor?.name||row.profile?.name||row.username)}</strong>
  ${vacationTag(row.actorId)}
  <small>Логин: ${e(row.username)}</small>
  <small>ID: ${e(row.actorId)}</small>
  ${row.profile?.telegram?'<small>Telegram: @'+e(row.profile.telegram)+'</small>':''}
  <small>Запрос: ${e(new Date(row.requestedAt).toLocaleString('ru-RU'))}</small>
  </div></div><div class="btn-row">
  <button class="btn primary small" data-action="recovery-approve" data-actor="${e(row.actorId)}">Одобрить</button>
  <button class="btn ghost small" data-action="recovery-reject" data-actor="${e(row.actorId)}">Отклонить</button>
  </div></article>`;
 }).join('')+'</div>';
 return html;
}
function actorRegistrationInfo(account, connection){
  if(!connection.connected)return {state:'unknown',label:'Регистрация: неизвестна',hint:'Подключи Windows Studio к Fundi Voice Cloud, чтобы проверить регистрацию.'};
  if(connection.error)return {state:'unknown',label:'Регистрация: нет связи',hint:'Не удалось обновить данные с сервера. Повтори синхронизацию.'};
  if(!account)return {state:'unknown',label:'Регистрация: нет данных',hint:'Сначала опубликуй актёра на сервере и дождись синхронизации.'};
  return account.registered===true
    ? {state:'yes',label:'Зарегистрирован',hint:'Актёр создал учётную запись в Fundi Voice Actor.'}
    : {state:'no',label:'Не зарегистрирован',hint:'Актёр ещё не активировал приглашение в Fundi Voice Actor.'};
}
function renderActorPortal(){
  const actors=[...(state.actors||[])].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  const enabled=actors.filter(a=>a.actorAccess===true).length;
  const eligibleRoles=actors.filter(a=>a.actorAccess===true).reduce((n,a)=>n+(actorPublicFeed(state,a.id)?.roles.length||0),0);
  const q=ui.query.trim().toLocaleLowerCase('ru');
  const filtered=actors.filter(a=>{
    if(!`${a.name} ${a.telegram}`.toLocaleLowerCase('ru').includes(q))return false;
    if(ui.actorRegistrationFilter==='all')return true;
    const account=(cloud.actors||[]).find(x=>x.actorId===a.id);
    const reg=actorRegistrationInfo(account,{connected:native&&cloud.connected,error:cloud.error});
    return reg.state===ui.actorRegistrationFilter;
  });
  let html=heading('Доступ актёров','Fundi Voice Actor',native&&cloud.connected?'<button class="btn primary" data-action="studio-files">Записи актёров</button>':'');
  html+=renderCloudConnection();
  html+=`<div class="actor-cloud-stats"><div class="actor-cloud-stat"><span>Актёров в базе</span><strong>${actors.length}</strong></div><div class="actor-cloud-stat"><span>Разрешён доступ</span><strong>${enabled}</strong></div><div class="actor-cloud-stat"><span>Ролей для публикации</span><strong>${eligibleRoles}</strong></div></div>`;
  html+=`<div class="panel-head"><h2>Кому разрешить доступ</h2><div class="actor-registration-filter"><label for="actor-registration-filter">Регистрация</label><select id="actor-registration-filter" aria-label="Фильтр по регистрации Actor" ${!native||!cloud.connected||cloud.error?'disabled':''}><option value="all" ${ui.actorRegistrationFilter==='all'?'selected':''}>Все актёры</option><option value="yes" ${ui.actorRegistrationFilter==='yes'?'selected':''}>Зарегистрированные</option><option value="no" ${ui.actorRegistrationFilter==='no'?'selected':''}>Не зарегистрированные</option></select><span class="muted small">Показано: ${filtered.length} из ${actors.length}</span></div></div>`;
  if(!native||!cloud.connected||cloud.error)html+='<p class="muted small">Для точного статуса регистрации подключи Studio к облаку и обнови список.</p>';
  html+=`<div class="actor-cloud-grid">${filtered.map(a=>{
    const feed=actorPublicFeed(state,a.id,{preview:true});
    const account=(cloud.actors||[]).find(x=>x.actorId===a.id);
    const registration=actorRegistrationInfo(account,{connected:native&&cloud.connected,error:cloud.error});
    return `<article class="actor-cloud-card" data-qv-context="actor" data-qv-actor="${e(a.id)}"><div class="actor-cloud-identity">${actorPickAvatar(a)}<div><strong>${e(a.name)}</strong>${vacationTag(a.id)}${a.telegram?`<small>@${e(a.telegram)}</small>`:''}<span class="actor-registration actor-registration-${registration.state}" title="${e(registration.hint)}">${e(registration.label)}</span>${registration.state==='yes'&&account.username?`<small>Логин Actor: @${e(account.username)}</small>`:''}</div></div><div class="actor-cloud-card-bottom"><label class="actor-cloud-checkbox"><input type="checkbox" class="actor-access-toggle" data-actor="${e(a.id)}" ${a.actorAccess?'checked':''}><span>Доступ</span></label><button type="button" class="btn ghost small" data-qv-open="actor" data-qv-actor="${e(a.id)}">Быстрый кабинет</button><button class="btn ghost small" data-action="actor-access-preview" data-actor="${e(a.id)}">Роли · ${feed.roles.length}</button><button class="btn primary small" data-action="cloud-invite" data-actor="${e(a.id)}" ${!a.actorAccess||!cloud.connected?'disabled':''}>Пригласить</button></div></article>`;
  }).join('')||'<p class="muted">Актёры не найдены. Добавь актёра в базе или измени поиск.</p>'}</div>`;
  html+=`<p class="muted small">Актёр видит только свои роли. Выключение доступа вступит в силу после синхронизации.</p>`;
  return html;
}
function actorAccessPreview(id){
  const actor=state.actors.find(a=>a.id===id);if(!actor)return;
  const feed=actorPublicFeed(state,id,{preview:true});
  const rows=feed.roles.map(r=>`<div class="actor-cloud-preview-row"><strong>${e(r.character)}</strong><span>${e(r.projectTitle)} · ${e(r.season?'Сезон '+r.season+' · ':'')}${e(r.episodeNumber?'Серия '+r.episodeNumber:r.episodeTitle||'Серия')}</span><span class="my-role-status status-${e(r.status)}">${e(roleStageName(r.status))}</span><span class="muted small">${r.due?'Сдать до '+e(dueLabel(r.due)):'Срок не указан'}</span></div>`).join('')||'<p class="muted">Назначенных ролей в активных проектах нет.</p>';
  showModal('Что увидит актёр',actor.name+(actor.actorAccess?' · Доступ разрешён':' · Доступ выключен'),`<div class="actor-cloud-preview">${vacationTag(id)}${rows}</div>`);
}
function studioVacationForm(actorId=''){
  const current=actorId?vacationFor(actorId):null;
  const actor=current?state.actors.find(a=>a.id===actorId):null;
  const available=(state.actors||[]).filter(a=>!vacationFor(a.id));
  if(!current&&!available.length){toast('Все актёры уже отмечены или список актёров пуст.',true);return;}
  const selected=actor||available[0];
  const picker=current?`<div class="studio-vacation-picked">${actorPickAvatar(actor||{name:actorId})}<strong>${e(actor?.name||actorId)}</strong></div>`:
    `<select name="actorId" id="vacation-owner-actor" required aria-label="Выбери актёра">${available.map(a=>`<option value="${e(a.id)}">${e(a.name)}${a.telegram?' @'+e(a.telegram):''}</option>`).join('')}</select>`;
  const body=`<div class="form-grid">
    ${field('Актёр *',picker,'Выбирай из своей базы: регистрация в Actor не нужна.',true)}
    ${current?'':field('Первый день *',input('startDate',today(),'date',`required min="${today()}"`),'Сегодня или день начала будущего отпуска.')}
    ${field('Последний день',input('endDate',current?.endDate||'','date',current&&!current.endDate?'disabled':'required'),'Дата нужна только для отпуска с возвращением.')}
    <label class="check-label studio-indefinite-vacation"><input type="checkbox" name="indefinite" data-vacation-indefinite ${current&&!current.endDate?'checked':''}> Бессрочно — до ручного завершения отпуска</label>
    ${field('Причина или комментарий',`<textarea name="reason" maxlength="800" rows="4" placeholder="По желанию">${e(current?.reason||'')}</textarea>`,'Виден руководителю и самому актёру после регистрации.',true)}
  </div>`;
  showModal(current?'Изменить отпуск':'Назначить отпуск',current?actor?.name||actorId:'Для актёра без приложения или сайта',body,'Сохранить',async data=>{
    const id=current?actorId:data.actorId;
    if(!id||!(state.actors||[]).some(a=>a.id===id))throw new Error('Выбери актёра из базы.');
    if(!current&&!data.startDate)throw new Error('Укажи дату начала.');
    if(!data.indefinite&&!data.endDate)throw new Error('Выбери дату возвращения или отметь «Бессрочно».');
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Madrid';
    cloud=await api('cloud/vacations/manage',{
      action:current?'update':'start',actorId:id,
      startDate:current?'':data.startDate,endDate:data.indefinite?'':data.endDate,
      reason:data.reason||'',timeZone:zone
    });
    modal.close();render();toast(current?'Отпуск обновлён':'Отпуск актёра сохранён в облаке');
  });
}
async function studioVacationEnd(actorId){
  const current=vacationFor(actorId);
  if(!current)return;
  const actor=state.actors.find(a=>a.id===actorId);
  const text=current.status==='planned'?'Отменить будущий отпуск':'Завершить отпуск сейчас';
  if(!window.confirm(text+' для '+(actor?.name||actorId)+'?'))return;
  cloud=await api('cloud/vacations/manage',{action:'end',actorId});
  render();toast(current.status==='planned'?'Запланированный отпуск отменён':'Актёр возвращён к работе');
}
let vacationChangesExpanded=false;

function renderVacationReview(){
  const rows=vacationReviewRows(state,cloud.vacations||[]);
  const healthy=native&&cloud.connected&&cloud.vacationApiAvailable&&!cloud.vacationError&&!cloud.error;
  let html=heading('Пересмотр','Роли, которые стоит переназначить из-за отпуска актёров',
    native&&cloud.connected?`<button class="btn ghost small" data-action="refresh-all">${icon('refresh')}Обновить данные</button>`:'');
  if(!healthy)html+=`<div class="vacation-review-warning">${icon('vacation')}<div><strong>Не удалось подтвердить актуальные отпуска</strong><p>${e(!cloud.connected?'Подключи Fundi Voice Cloud во вкладке «Доступ актёров».':cloud.vacationError||cloud.error||'Данные об отпусках ещё загружаются. Нажми «Обновить данные».')} Передача ролей недоступна до обновления статусов.</p></div></div>`;
  if(!rows.length){
    return html+`<div class="vacation-review-empty">${icon('check')}<strong>${healthy?'Ролей на пересмотр нет':'Нет подтверждённых ролей на пересмотр'}</strong><p>${healthy?'Если у актёра появится отпуск, его ожидающие запись или перезапись роли автоматически появятся здесь.':'После получения статусов из Cloud здесь отобразятся незавершённые назначения актёров в отпуске.'}</p></div>`;
  }
  const actors=new Map();
  for(const row of rows){if(!actors.has(row.actor.id))actors.set(row.actor.id,[]);actors.get(row.actor.id).push(row);}
  const active=rows.filter(row=>row.vacation.status==='active').length;
  html+=`<div class="vacation-review-overview"><div><span>Требуют внимания</span><strong>${rows.length}</strong></div><div><span>Уже в отпуске</span><strong>${active}</strong></div><div><span>Актёров</span><strong>${actors.size}</strong></div></div>`;
  html+='<p class="vacation-review-help">Здесь только незавершённые записи: «Жду запись», «В записи», «На перезапись». Уже полученные и принятые записи не затрагиваются. Переназначение выполняется только вручную; исходные файлы остаются на месте.</p>';
  for(const [actorId,items] of actors){
    const a=items[0].actor,v=items[0].vacation;
    const dates=`${v.startDate?'С '+e(v.startDate):'Начало неизвестно'}${v.endDate?' по '+e(v.endDate):' · без даты окончания'}`;
    html+=`<section class="vacation-review-actor"><header class="vacation-review-person">${actorPickAvatar(a)}<div><strong>${e(a.name)}</strong><small>${a.telegram?'@'+e(a.telegram)+' · ':''}${dates}</small></div>${vacationTag(actorId)}<span class="vacation-review-count">${items.length} ${items.length===1?'роль':'ролей'}</span></header><div class="vacation-review-roles">`;
    for(const {p,ep,r,due} of items){
      const replacements=rankActorsForRole(state,ep,r,cloud.vacations||[],{excludeActorId:actorId,showAll:true}).length;
      html+=`<article class="vacation-review-role" data-qv-context="role" data-qv-actor="${e(r.actorId||'')}" data-qv-project="${e(p.id)}" data-qv-episode="${e(ep.id)}" data-qv-role="${e(r.id)}"><div class="vacation-review-role-main"><strong>${e(r.character)}</strong><small>${e(p.title)} · ${e(episodeLabel(p,ep))}</small><div class="vacation-review-meta"><span class="my-role-status status-${e(r.status)}">${e(roleStageName(r.status))}</span>${Number.isInteger(r.lineCount)?`<span>${r.lineCount} репл.</span>`:''}${due?`<span>Срок: ${e(dueLabel(due))}</span>`:''}</div></div><div class="vacation-review-actions"><button type="button" class="btn ghost small" data-qv-open="replace" data-qv-project="${e(p.id)}" data-qv-episode="${e(ep.id)}" data-qv-role="${e(r.id)}" ${!healthy||!replacements?'disabled':''}>Сравнить кандидатов</button><button class="btn ghost small" data-action="open-project" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-tab="roles">Открыть</button><button class="btn primary small" data-action="vacation-review-transfer" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}" ${!healthy||!replacements?'disabled':''} title="${!replacements?'Нет актёров вне отпуска':'Передать роль другому актёру'}">Передать роль ${icon('arrow')}</button></div></article>`;
    }
    html+='</div></section>';
  }
  return html;
}

function vacationReviewCandidateOptions(rows,preferred=''){
  return rows.length?rows.map(({actor:a,episodeCount,activeCount,characters},i)=>'<option value="'+e(a.id)+'" '+(preferred===a.id||!preferred&&i===0?'selected':'')+'>'+e(a.name)+' · '+episodeCount+' ролей в серии · '+activeCount+' активных'+(characters.length?' ('+e(characters.slice(0,3).join(', '))+')':'')+(a.actorAccess?'':' · без доступа Actor')+'</option>').join(''):
    '<option value="">Нет подходящих кандидатов — включи «Показать всех актёров»</option>';
}
function refreshVacationReviewCandidates(){
  const select=modal.querySelector('#review-next-actor');
  if(!select)return;
  const p=getProject(select.dataset.project),ep=getEpisode(p,select.dataset.episode),r=ep?.roles.find(r=>r.id===select.dataset.role);
  if(!r)return;
  const current=select.value,showAll=!!modal.querySelector('#review-show-all-actors')?.checked;
  const available=rankActorsForRole(state,ep,r,cloud.vacations||[],{excludeActorId:r.actorId,showAll});
  select.innerHTML=vacationReviewCandidateOptions(available,current);
}
function vacationReviewTransferForm(projectId,episodeId,roleId,preferredActorId='',showAllActors=false){
  if(!native||!cloud.connected||!cloud.vacationApiAvailable||cloud.vacationError||cloud.error)throw Error('Обнови данные об отпусках из Cloud.');
  const row=vacationReviewRows(state,cloud.vacations||[]).find(({p,ep,r})=>p.id===projectId&&ep.id===episodeId&&r.id===roleId);
  if(!row)throw Error('Роль уже не требует пересмотра.');
  const {p,ep,r,actor}=row,available=rankActorsForRole(state,ep,r,cloud.vacations||[],{excludeActorId:actor.id,showAll:showAllActors});
  if(!rankActorsForRole(state,ep,r,cloud.vacations||[],{excludeActorId:actor.id,showAll:true}).length)throw Error('Сейчас нет доступных актёров без действующего или запланированного отпуска.');
  const chooser=`<div class="vacation-review-transfer"><p>Сейчас роль <strong>${e(r.character)}</strong> назначена ${e(actor.name)}. Выбери другого актёра из базы, которому можно передать запись.${validRoleVoice(r.voiceGender)?' Тип голоса персонажа: <strong>'+e(roleVoiceLabel(r.voiceGender))+'</strong>.':''}</p>${validRoleVoice(r.voiceGender)?`<label class="casting-show-all"><input type="checkbox" name="showAllActors" id="review-show-all-actors" ${showAllActors?'checked':''}> Показать всех актёров</label>`:''}<label for="review-next-actor">Новый исполнитель</label><select id="review-next-actor" name="actorId" data-project="${e(p.id)}" data-episode="${e(ep.id)}" data-role="${e(r.id)}" required>${vacationReviewCandidateOptions(available,preferredActorId)}</select><p class="small muted">После передачи статус роли станет «Жду запись». Персонаж, количество реплик, срок, заметки и старые записи сохранятся; новый актёр получит назначение при синхронизации.</p></div>`;
  showModal('Переназначить роль',p.title+' · '+episodeLabel(p,ep),chooser,'Передать роль',async data=>{
    if(!native||!cloud.connected||cloud.error||cloud.vacationError)throw Error('Не удалось проверить доступность актёров. Обнови Cloud.');
    const transfer=reassignVacationRole(state,cloud.vacations||[],{
      projectId:p.id,episodeId:ep.id,roleId:r.id,previousActorId:actor.id,newActorId:data.actorId,showAllActors:data.showAllActors==='on'
    });
    touch(transfer.project);modal.close();render();
    toast('Роль «'+transfer.role.character+'» переназначена на '+transfer.newActor.name+'. Отправляем в Cloud…');
    try{
      await flushSave();
      if(saveError)throw Error(saveError);
      if(!await syncStudioTasks())throw Error('Согласование ролей с веб-студией не удалось.');
      await api('cloud/sync',{replace:false});
      await refreshCloud(true);
      toast('Назначение отправлено в Fundi Voice Cloud.');
    }catch(error){
      toast('Переназначение сохранено локально, но сервер пока не подтвердил его: '+error.message+' Используй «Обновить данные».',true);
    }
  });
}

function renderVacations(){
  const rows=cloud.vacations||[],events=cloud.vacationEvents||[];
  const active=rows.filter(v=>v.status==='active'),planned=rows.filter(v=>v.status==='planned');
  let html=heading('Отпуска','Доступность актёров · обновляется через Fundi Voice Cloud',cloud.connected?'<div class="btn-row"><button class="btn primary small" data-action="studio-vacation-new">+ Отметить отпуск</button><button class="btn ghost small" data-action="refresh-all">Обновить данные</button></div>':'');
  if(!native||!cloud.connected)return html+`<div class="studio-vacation-empty">Сначала подключи Studio к Fundi Voice Cloud во вкладке «Доступ актёров».</div>`;
  if(cloud.vacationError)html+=`<div class="cloud-error studio-vacation-error">${e(cloud.vacationError)}</div>`;
  if(!cloud.vacationApiAvailable)return html+`<div class="studio-vacation-empty">Функция отпусков недоступна. Проверь, что Fundi Voice Cloud обновлён до версии 0.6.0.</div>`;
  html+=`<div class="studio-vacation-stats"><div><strong>${active.length}</strong><span>В отпуске</span></div><div><strong>${planned.length}</strong><span>Запланировано</span></div><div><strong>${cloud.vacationUnread||0}</strong><span>Новых событий</span></div></div>`;
  const names={active:'В отпуске',planned:'Запланирован',completed:'Завершён',ended:'Досрочный возврат',cancelled:'Отменён'};
  const fmt=d=>d?new Date(d+'T12:00:00').toLocaleDateString('ru-RU'):'Срок неизвестен';
  const section=(title,items)=>`<section class="studio-vacation-section"><h2>${title}<span>${items.length}</span></h2>${items.length?`<div class="studio-vacation-list">${items.map(v=>{const actor=state.actors.find(a=>a.id===v.actorId);return `<article class="studio-vacation-card ${v.status}"><div><strong>${e(actor?.name||v.username||v.actorId)}</strong>${v.username?`<small>@${e(v.username)}</small>`:''}</div><span class="studio-vacation-tag ${e(v.status)}">${e(names[v.status]||v.status)}</span><p>С ${e(fmt(v.startDate))} ${v.endDate?'по '+e(fmt(v.endDate)):'· Бессрочно (до ручного завершения)'}</p>${v.reason?`<p class="studio-vacation-reason">Причина: ${e(v.reason)}</p>`:''}${['active','planned'].includes(v.status)?`<div class="studio-vacation-actions"><button class="btn ghost small" data-action="studio-vacation-edit" data-actor="${e(v.actorId)}">Изменить</button><button class="btn ghost small" data-action="studio-vacation-end" data-actor="${e(v.actorId)}">${v.status==='planned'?'Отменить':'Завершить'}</button></div>`:`<div class="studio-vacation-actions"><button type="button" class="btn ghost small studio-vacation-delete" data-action="studio-vacation-delete-history" data-vacation="${e(v.vacationId)}">Удалить из истории</button></div>`}</article>`;}).join('')}</div>`:'<p class="muted small">Пока никого нет.</p>'}</section>`;
  html+=section('Сейчас в отпуске',active)+section('Предстоящие отпуска',planned);
  const types={planned:'Отпуск запланирован',started:'Отпуск начался',updated:'Отпуск обновлён',cancelled:'Отпуск отменён',returned:'Отпуск завершён'};
  html+=`<details class="studio-vacation-section studio-vacation-changes" ${vacationChangesExpanded?'open':''}><summary class="studio-vacation-changes-summary"><h2>Изменения <span>${cloud.vacationUnread||0} новых</span></h2><span class="studio-vacation-changes-hint">${vacationChangesExpanded?'Скрыть':'Показать'}${events.length?' · '+events.length+' событий':''}</span>${icon('chevron')}</summary>${events.length?`<div class="studio-vacation-list">${events.slice(0,60).map(v=>{const actor=state.actors.find(a=>a.id===v.actorId);return `<article class="studio-vacation-card event"><div><strong>${e(actor?.name||v.username||v.actorId)}</strong><small>${e(new Date(v.createdAt).toLocaleString('ru-RU'))}</small></div><p>${e(types[v.kind]||v.kind)}</p>${!v.read?`<button class="btn ghost small" data-action="studio-vacation-read" data-event="${v.id}">Прочитано</button>`:''}<button type="button" class="btn ghost small studio-vacation-delete" data-action="studio-vacation-delete-event" data-event="${v.id}">Удалить событие</button></article>`;}).join('')}</div>`:'<p class="muted small">Событий пока нет.</p>'}</details>`;
  html+=section('История отпусков',rows.filter(v=>!['active','planned'].includes(v.status)).slice(0,50));
  html+='<p class="muted small">Причины видны только руководителю и самому актёру. Отпуск может назначить руководитель даже без регистрации актёра. После входа в Actor актёр увидит отпуск и сможет его изменить или завершить. Назначенные ранее роли не исчезают; актёров в отпуске нельзя выбрать для новых ролей.</p>';
  return html;
}
function renderCloudConnection(){
  const label=cloud.error?'Нужна проверка':cloud.busy?'Синхронизируем…':cloud.pending?'Есть изменения для отправки':cloud.connected?'Подключено':'Подключить облако';
  const last=cloud.lastSync?new Date(cloud.lastSync).toLocaleString('ru-RU'):'Ещё не отправляли';
  return `<section class="cloud-connection panel"><div><span class="cloud-label"><span class="status-dot"></span>${e(label)}</span><p class="small muted">${cloud.connected?e(cloud.server)+' · '+e(last):'Синхронизация ролей и аккаунты актёров'}</p>${cloud.error?`<p class="cloud-error">${e(cloud.error)}</p>`:''}</div><div class="btn-row">${cloud.connected?`<button class="btn ghost small" data-action="cloud-sync" ${cloud.busy?'disabled':''}>Обновить сейчас</button><button class="btn ghost small" data-action="cloud-setup">Подключение</button>`:`<button class="btn primary small" data-action="cloud-setup">Подключить</button>`}${cloud.conflict?'<button class="btn primary small" data-action="cloud-replace">Опубликовать эту Studio</button>':''}</div></section>`;
}
async function refreshCloud(renderPage=false){
  if(!native)return;
  try{
    const next=await api('cloud/status'),changed=JSON.stringify(next)!==JSON.stringify(cloud),reviewsChanged=JSON.stringify(next.reviews)!==JSON.stringify(cloud.reviews),vacationsChanged=JSON.stringify(next.vacations)!==JSON.stringify(cloud.vacations)||JSON.stringify(next.vacationEvents)!==JSON.stringify(cloud.vacationEvents);
    cloud=next;const appliedReviews=applyRoleReviews(state,next.reviews||[]);if(appliedReviews)persist();updateNotificationBadge();updateFileBadge();renderTransferNotice();
    if(changed&&modal.open&&modal.dataset.view==='recordings')renderStudioFiles();
    if(renderPage&&changed&&modal.open&&modal.querySelector('.studio-notification-list'))showStudioMessages();
    else if(renderPage&&(changed||appliedReviews)&&!modal.open&&(ui.page==='actorportal'||ui.page==='vacations'||ui.page==='actors'||ui.page==='detail'||ui.page==='debts'||ui.page==='review'||reviewsChanged||vacationsChanged||appliedReviews))render();
  }catch{}
}
async function refreshAllStudio(button){
  if(refreshing)return;
  if(!native){toast('Проверка сервера доступна в Windows Studio.');return;}
  if(!cloud.connected){toast('Сначала подключи Studio к Fundi Voice Cloud.',true);return;}
  refreshing=true;if(button)button.disabled=true;
  try{
    if(saving)await flushSave();
    if(!await syncStudioTasks(true))throw Error('Сначала устрани ошибку синхронизации ролей. Публикация старого списка остановлена.');
    await api('cloud/sync',{replace:false});
    await refreshCloud(true);
    manualRefreshAt=Date.now();render();
    toast('Новые записи, уведомления, статусы и отпуска проверены.');
  }catch(err){toast('Не удалось обновить данные: '+err.message,true);}
  finally{refreshing=false;render();}
}
let studioNotificationLimit=50,recordingContext=null,hiddenTransferId='';
function renderTransferNotice(){document.querySelector('#file-transfer-slot').innerHTML=transferPanel(cloud.transfer,'studio-',hiddenTransferId);}
function recordingRole(file){
  for(const p of state.projects)for(const ep of p.episodes){const r=ep.roles.find(item=>item.id===file.roleId);if(r)return {p,ep,r};}
  return null;
}
function roleRecordingButton(p,ep,r){
  const count=(cloud.files||[]).filter(f=>f.roleId===r.id&&f.actorId===r.actorId&&f.status==='ready').length;
  if(!native||(!actorForRole(state,r)?.actorAccess&&!count))return '';
  return `<button class="icon-btn" data-action="role-recordings" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}" title="Записи актёра${count?' · '+count:''}" aria-label="Записи ${e(r.character)}">${icon('download')}${count?`<span class="role-recording-count">${count}</span>`:''}</button>`;
}
async function showStudioFiles(context=null){
  if(!native||!cloud.connected)throw new Error('Сначала подключи Studio к серверу.');
  recordingContext=context;cloud=await api('cloud/files',{});updateFileBadge();renderStudioFiles();renderTransferNotice();
}
function renderStudioFiles(){
  const scroll=modal.querySelector('.recording-list')?.scrollTop||0;
  const context=recordingContext,items=(cloud.files||[]).filter(f=>!context||f.roleId===context.roleId&&f.actorId===context.actorId);
  showModal(context?'Записи роли':'Записи актёров',context?context.title:'Файлы, загруженные через Fundi Voice Actor',`${storageMeter(cloud.usedBytes,cloud.quotaBytes)}${cloud.fileError?`<p class="file-error">${e(cloud.fileError)}</p>`:''}<div class="file-toolbar"><button type="button" class="btn ghost small" data-action="studio-files-refresh">Обновить список</button><button type="button" class="text-button" data-action="studio-files-cleanup">Очистить просроченные</button></div><div class="recording-list">${items.map(f=>{
    const found=recordingRole(f),actor=state.actors.find(a=>a.id===f.actorId)?.name||(cloud.actors||[]).find(a=>a.actorId===f.actorId)?.username||'Актёр';
    const detail=found?`${actor} · ${found.r.character} · ${found.p.title} · ${episodeLabel(found.p,found.ep)}`:actor+' · Роль больше не отображается в Studio';
    return `<article class="recording-entry"><strong>${e(f.fileName)}</strong>${found?`<button type="button" class="btn ghost small" data-qv-open="role" data-qv-project="${e(found.p.id)}" data-qv-episode="${e(found.ep.id)}" data-qv-role="${e(found.r.id)}">Карточка роли</button>`:''}<div class="recording-context">${e(detail)} ${vacationTag(f.actorId)}</div><div class="recording-meta"><span>${e(formatBytes(f.size))}</span><span>${e(notificationDate(f.createdAt))}</span><span>${e(fileStatus(f.status))}</span></div><div class="recording-actions">${f.status==='ready'?`<button type="button" class="btn primary small" data-action="studio-file-download" data-file="${e(f.fileId)}" ${cloud.transfer?.state==='running'?'disabled':''}>${icon('download')}Скачать</button>${found?.r.folder?`<button type="button" class="btn ghost small" data-action="studio-file-download-as" data-file="${e(f.fileId)}">Выбрать папку</button>`:''}`:''}<button type="button" class="text-button" data-action="studio-file-delete" data-file="${e(f.fileId)}">Удалить из облака</button></div></article>`;
  }).join('')||'<div class="recording-empty">Записей пока нет. Актёр загружает запись в Actor 0.3.0 кнопкой «Сдать на проверку».</div>'}</div><p class="file-hint">После скачивания проверь запись на компьютере. Для освобождения места удали её из облака отдельной кнопкой.</p>`);
  modal.dataset.view='recordings';modal.querySelector('.recording-list').scrollTop=scroll;
}

function reviewForRole(role){return (cloud.reviews||[]).find(item=>item.actorId===role.actorId&&item.roleId===role.id);}
function reviewMarker(role){const review=reviewForRole(role),manuallyChanged=review?.state==='accepted'&&role.status!=='done'||review?.state==='retake'&&role.status!=='retake'||review?.state==='pending'&&['waiting','recording'].includes(role.status);const label=manuallyChanged?'':review?.state==='pending'?'На проверке':review?.state==='retake'?'Запрошена перезапись':review?.state==='accepted'?'Запись принята':'';return label?`<span class="review-marker" data-state="${e(review.state)}">${e(label)}</span>`:'';}
function notificationDate(value){return value?new Date(value).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';}
function notificationActor(item){return state.actors.find(actor=>actor.id===item.actorId)?.name||item.username||'Актёр';}
function updateFileBadge(){
  const node=document.querySelector('[data-file-unread-count]');if(!node)return;
  const count=Math.max(0,Number(cloud.unreadFiles)||0);
  node.textContent=count>99?'99+':count?String(count):'';node.hidden=count===0;
  node.closest('[data-action="studio-files"]')?.setAttribute('aria-label',count?'Мои файлы, новых записей: '+count:'Мои файлы');
}
function updateNotificationBadge(){const node=document.querySelector('[data-notification-count]');if(node){const failed=cloud.mailbox?.failed?.length||0;node.textContent=cloud.mailbox?.unread||(failed?'!':'');node.hidden=!cloud.mailbox?.unread&&!failed;}}
function findNotificationRole(item){
  for(const p of state.projects)for(const ep of p.episodes){const r=ep.roles.find(role=>role.id===item.role.roleId);if(r)return {p,ep,r,assigned:r.actorId===item.actorId};}
  return null;
}
function showStudioMessages(){
  const scroll=modal.querySelector('.studio-notification-list')?.scrollTop||0,messages=[...(cloud.mailbox?.messages||[])].sort((a,b)=>b.id-a.id),failed=cloud.mailbox?.failed||[];
  showModal('Уведомления',cloud.mailbox?.unread?cloud.mailbox.unread+' непрочитанных':'Сдача ролей',`${messages.length?'<div class="notification-toolbar"><span class="muted small">Удаление скрывает уведомления в этой Studio, но не отменяет сдачу роли.</span><button type="button" class="text-button" data-action="studio-clear-messages">Удалить все</button></div>':''}${!cloud.reviewApiAvailable?'<p class="setting-note">Для сдачи ролей обнови сервер до Cloud 0.3.0 и подключи Studio.</p>':''}${failed.length?`<p class="cloud-error">Не отправлено: ${e(failed.at(-1).error)} Текст сохранён ниже.</p><details class="failed-reviews"><summary>Сохранённые ответы</summary>${failed.map(item=>`<div class="failed-review"><strong>${e(item.error)}</strong><p>${e(item.body?.text||'Отметка прочтения')}</p></div>`).join('')}<button type="button" class="text-button" data-action="studio-dismiss-failed">Убрать ошибки</button></details>`:''}<div class="studio-notification-list">${messages.slice(0,studioNotificationLimit).map(item=>{const found=findNotificationRole(item);return `<article class="studio-notification ${item.read?'':'unread'}"><div class="studio-notification-head"><strong>${e(notificationActor(item))} сдал роль</strong>${vacationTag(item.actorId)}<time>${e(notificationDate(item.createdAt))}</time></div><div class="studio-notification-role"><strong>${e(item.role.character)}</strong><span>${e(item.role.projectTitle)} · ${item.role.season?'Сезон '+e(item.role.season)+' · ':''}${item.role.episodeNumber?'Серия '+e(item.role.episodeNumber):'Серия'}</span></div><div class="btn-row"><button type="button" class="btn ghost small" data-action="notification-recordings" data-message="${item.id}">Записи</button>${found?`<button type="button" class="btn ghost small" data-action="notification-open-role" data-message="${item.id}">Открыть роль</button>${found.assigned?`<button type="button" class="btn primary small" data-action="notification-reply" data-message="${item.id}">Ответить</button>`:'<span class="muted small">Роль переназначена</span>'}`:'<span class="muted small">Роль удалена из Studio</span>'}${!item.read?`<button type="button" class="text-button" data-action="studio-read-message" data-message="${item.id}">Прочитано</button>`:''}<button type="button" class="text-button notification-delete" data-action="studio-delete-message" data-message="${item.id}" title="Удалить уведомление только из этой Studio">${icon('trash')}Удалить</button></div></article>`;}).join('')||'<p class="muted small">Когда актёр сдаст роль, она появится здесь.</p>'}</div>${messages.length>studioNotificationLimit?'<button type="button" class="btn ghost small" data-action="studio-more-messages">Показать ещё</button>':''}`);
  modal.querySelector('.studio-notification-list').scrollTop=scroll;
}
function reviewRoleForm(pid,eid,rid){
  const p=getProject(pid),ep=getEpisode(p,eid),r=ep?.roles.find(role=>role.id===rid),actor=r&&actorForRole(state,r);
  if(!r||!actor)throw new Error('Сначала назначь актёра на эту роль.');
  if(!cloud.connected||!cloud.reviewApiAvailable)throw new Error('Подключи Studio и обнови сервер до Cloud 0.3.0.');
  if(!actor.actorAccess)throw new Error('Включи доступ этому актёру во вкладке «Доступ актёров».');
  const review=reviewForRole(r),submissionId=review?.submissionId||0;
  showModal('Ответ актёру',`${actor.name} · ${r.character} · ${p.title} · ${episodeLabel(p,ep)}`,`${vacationTag(actor.id)}<div class="form-grid">${field('Ответ',`<select name="kind">${options([['retake','На перезапись'],['note','Замечание'],['accepted','Принято']],'retake')}</select>`,'',true)}${field('Сообщение',`<textarea name="text" rows="4" maxlength="2000" placeholder="Что исправить и где">${e('')}</textarea>`,'При принятии роли сообщение необязательно.',true)}</div>`,'Отправить',async data=>{
    const text=(data.text||'').trim();if(data.kind!=='accepted'&&!text)throw new Error('Напиши, что нужно исправить.');
    await flushSave();if(saveError)throw new Error(saveError);
    cloud=await api('cloud/feedback',{actorId:actor.id,roleId:r.id,kind:data.kind,text,submissionId});
    modal.close();render();toast('Ответ сохранён. Отправляем актёру…');
  });
}
async function cloudSetup(step=0){
  if(!native)throw new Error('Запусти Windows-программу через FundiVoiceStudio.exe.');
  if(step===0){
    cloudWizard={server:cloud.server||'https://fundi-voice-cloud.onrender.com',code:''};
    showModal('Адрес сервера','Подключение · 1 из 3',`<div class="form-grid">${field('Сервер',input('server',cloudWizard.server,'url','required'),'Адрес, который выдал Render.',true)}</div>`,'Дальше',async data=>{
      cloudWizard.server=data.server.trim();const result=await api('cloud/setup-code',{});cloudWizard.code=result.code;await cloudSetup(1);
    });return;
  }
  if(step===1){
    showModal('Код подключения','Подключение · 2 из 3',`<p class="setting-note">В Render открой <strong>Environment → Edit</strong>. Добавь переменную:</p><label class="field"><span>Key</span><input value="STUDIO_SETUP_KEY" readonly></label><label class="field"><span>Value</span><textarea id="cloud-code" readonly rows="2">${e(cloudWizard.code)}</textarea></label><div class="btn-row"><button type="button" class="btn ghost small" data-action="cloud-copy-setup">Скопировать Value</button><button type="button" class="text-button" data-action="cloud-renew-setup">Создать новый код</button></div><p class="setting-note">Нажми <strong>Save and deploy</strong> и дождись <strong>Live</strong>. Код предназначен только для владельца Studio.</p>`,'Сервер обновлён',()=>cloudSetup(2));return;
  }
  showModal('Подключить Studio','Подключение · 3 из 3',`<p class="setting-note">${e(cloudWizard.server)}</p><p>После подключения Studio будет автоматически отправлять роли, статусы и сроки разрешённых актёров.</p>`,'Подключить',async()=>{
    await flushSave();if(saveError)throw new Error(saveError);await api('cloud/pair',{server:cloudWizard.server});
    await refreshCloud();modal.close();render();if(cloud.conflict){toast('Studio подключена. Проверь данные перед первой публикацией.');return;}toast('Studio подключена. Отправляем назначения…');await api('cloud/sync',{replace:false});await refreshCloud(true);
  });
}
async function cloudInvite(actorId){
  const actor=state.actors.find(a=>a.id===actorId);if(!actor?.actorAccess)throw new Error('Включи доступ этому актёру.');
  await flushSave();if(saveError)throw new Error(saveError);
  toast('Готовим приглашение…');const invite=await api('cloud/invite',{actorId});await refreshCloud();
  const text=`Fundi Voice Actor\nСервер: ${invite.server}\nКод: ${invite.code}\nДействует до: ${new Date(invite.expiresAt).toLocaleString('ru-RU')}\nОткрой приложение Actor → «По приглашению», задай свой логин и пароль.`;
  showModal('Приглашение',actor.name,`${vacationTag(actor.id)}<p class="setting-note">Каждый код действует 24 часа с момента выдачи. Повторная выдача не отменяет другие действующие приглашения. После успешной активации остальные коды станут недействительными. При сбросе существующего аккаунта пароль заменится и старые сеансы завершатся.</p><textarea name="text" class="cast-draft" readonly rows="7">${e(text)}</textarea>`,'Скопировать',async()=>{await copyText(text);toast('Приглашение скопировано');});
}
function renderSettings(){return heading('Настройки')+`<div class="settings-grid"><section class="panel full studio-root-setting"><h3>Папка студии</h3><div class="setting-line"><span class="resource-path">${e(state.settings.studioRoot||'Не выбрана')}</span><button class="btn ghost small" data-action="studio-folder">${icon('folder')}${state.settings.studioRoot?'Изменить':'Выбрать'}</button></div></section><section class="panel"><h3>Профиль</h3><div class="setting-line"><strong>Имя</strong><input id="profile-name" maxlength="80" value="${e(state.settings.name)}" aria-label="Имя"></div><div class="setting-line"><strong>Мой Telegram</strong><input id="profile-telegram" maxlength="80" value="${e(state.settings.myTelegram||'')}" placeholder="Discolter" aria-label="Telegram для моих ролей"></div><p class="setting-note">Вкладка «Мои задачи» находит роли по Telegram из карточки актёра (например, @Discolter), а также по отметке «Моя роль».</p><div class="setting-line"><strong>Показывать роли и задачи</strong>${modeSwitch()}</div></section><section class="panel"><h3>Данные <span class="muted small">${native?'На компьютере':'В этом браузере'}</span></h3><div class="btn-row"><button class="btn primary" data-action="export">${icon('download')}Скачать копию</button><button class="btn ghost" data-action="import">${icon('upload')}Загрузить копию</button></div><p class="setting-note">Копия содержит записи и пути. Медиафайлы хранятся отдельно.</p>${native?'<button class="text-button" data-action="data-folder">Открыть папку данных</button>':'<a class="text-button" href="Fundi-Voice-Windows.zip" download>Скачать приложение для Windows</a>'}</section><section class="panel appearance"><h3>Тема</h3><p class="setting-note">Однотонные темы — без цветных переливов. Градиентные — с мягкими цветовыми переходами. Анимированные — медленно переливаются на фоне. Анимацию можно отключить переключателем ниже.</p>${[['solid','Однотонные'],['gradient','Градиентные'],['animated','Анимированные градиенты']].map(([group,label])=>`<div class="theme-category"><h4>${label}</h4><div class="theme-grid">${THEMES.filter(x=>x[2]===group).map(([id,title])=>`<button class="theme-card ${state.settings.theme===id?'selected':''}" data-action="theme" data-theme="${id}" aria-pressed="${state.settings.theme===id}"><div class="theme-preview ${id}"></div><strong>${e(title)}</strong></button>`).join('')}</div></div>`).join('')}<label class="motion-line"><input id="motion-toggle" type="checkbox" ${state.settings.motion!==false?'checked':''}>Анимации</label></section><section class="panel full"><details><summary>Корзина · ${state.trash.length}</summary>${state.trash.map(p=>`<div class="setting-line"><strong>${e(p.title)}</strong><button class="btn ghost small" data-action="restore-project" data-id="${e(p.id)}">Восстановить</button></div>`).join('')||'<p class="muted small">Пусто</p>'}</details></section>${native?'<button class="btn ghost" data-action="shutdown">Завершить приложение</button>':''}</div>`;}

function showModal(title,subtitle,body,submitLabel,onSubmit,{danger=false,extra=''}={}){
  modal.dataset.view='';
  modal.className=/^(Новый проект|Новая серия|Подключение) · /.test(subtitle)?'wizard-modal':'';
  modalSubmit=onSubmit;
  modal.innerHTML=`<form id="modal-form"><div class="modal-head"><div><h2 id="modal-title">${e(title)}</h2>${subtitle?`<p>${e(subtitle)}</p>`:''}</div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрыть">${icon('close')}</button></div><div class="modal-body"><div id="form-error" hidden></div>${body}</div><div class="modal-foot">${extra}<button class="btn ghost" type="button" data-action="close-modal">${onSubmit?'Отмена':'Закрыть'}</button>${onSubmit?`<button class="btn ${danger?'danger':'primary'}" type="submit">${e(submitLabel)}</button>`:''}</div></form>`;
  if(!modal.open)modal.showModal();setTimeout(()=>modal.querySelector('input:not([type=hidden]),.fv-select-trigger,textarea')?.focus(),30);
}
function formError(err){const el=modal.querySelector('#form-error');if(el){el.hidden=false;el.className='form-error';el.textContent=err.message||String(err);}}
const field=(label,html,hint='',full=false)=>{const existing=html.match(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/),id=existing?.[1]||'f-'+uid();return `<div class="field ${full?'full':''}"><label for="${id}">${label}</label>${existing?html:html.replace(/<(input|select|textarea)\b/,`<$1 id="${id}"`)}${hint?`<div class="hint">${hint}</div>`:''}</div>`;};
const input=(name,value='',type='text',extra='')=>`<input name="${name}" type="${type}" value="${e(value)}" ${extra}>`;
const area=(name,value,placeholder='')=>`<textarea name="${name}" placeholder="${e(placeholder)}">${e(value)}</textarea>`;
const trimPath=v=>String(v||'').trim().replace(/^"(.*)"$/,'$1');
function pathField(name,value,type='folder') {return `<div class="input-action">${input(name,value,'text',`placeholder="Полный путь"`)}<button class="btn ghost" type="button" data-action="pick-path" data-field="${name}" data-type="${type}" title="Выбрать на компьютере">${icon('folder')}</button></div>`;}
function coverEditor(value,label='Картинка проекта',avatar=false){return `<div class="field full"><label>${e(label)}</label><div class="project-cover-editor"><div class="cover-preview ${avatar?'avatar-preview':''}" id="cover-preview">${value?`<img src="${e(value)}" alt="${avatar?'Аватар':'Выбранная обложка'}">`:icon('file')}</div><div class="btn-row"><button type="button" class="btn ghost small" data-action="choose-cover">Выбрать картинку</button><button type="button" class="text-button" data-action="remove-cover">Убрать</button></div></div>${input('cover',value,'hidden')}<input type="file" id="project-cover-input" data-kind="${avatar?'avatar':'cover'}" accept="image/png,image/jpeg,image/webp" hidden></div>`;}
async function loadProjectCover(file){
  if(!file)return;const uploadInput=modal.querySelector('#project-cover-input'),avatar=uploadInput?.dataset.kind==='avatar';if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error('Выбери PNG, JPG или WebP.');if(file.size>12*1024*1024)throw new Error('Картинка должна быть меньше 12 МБ.');
  const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Не удалось прочитать картинку.'));reader.readAsDataURL(file);});
  const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Не удалось открыть картинку.'));image.src=source;});
  const canvas=document.createElement('canvas');
  if(avatar){const side=Math.min(img.naturalWidth,img.naturalHeight);canvas.width=canvas.height=Math.min(256,side);canvas.getContext('2d').drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,canvas.width,canvas.height);}
  else{const scale=Math.min(1,640/img.naturalWidth,960/img.naturalHeight);canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);}
  let value=canvas.toDataURL('image/webp',.82);if(value.length>700000)value=canvas.toDataURL('image/jpeg',.7);if(!safeCover(value))throw new Error('Выбери картинку поменьше.');
  if(uploadInput!==modal.querySelector('#project-cover-input'))return;const target=modal.querySelector('[name=cover]');if(!target)return;target.value=value;modal.querySelector('#cover-preview').innerHTML=`<img src="${value}" alt="${avatar?'Аватар':'Выбранная обложка'}">`;
}
function roleImageEditor(value){
  const image=safeRoleImage(value);
  return `<div class="field full"><label>Изображение персонажа</label><div class="role-image-editor">
    <div class="role-image-editor-preview" id="role-image-preview">${image?`<img src="${e(image)}" alt="Предпросмотр персонажа">`:icon('file')}</div>
    <div class="role-image-editor-actions"><button class="btn ghost small" type="button" data-action="choose-role-image">${icon('upload')}Загрузить изображение</button>
    <button class="text-button" type="button" data-action="remove-role-image">Убрать</button>
    <small>JPG, PNG или WebP. Картинка синхронизируется с приложением и сайтом назначенного актёра.</small></div></div>
    <input type="hidden" name="image" value="${e(image)}"><input type="file" id="role-image-input" accept="image/png,image/jpeg,image/webp" hidden></div>`;
}
async function loadRoleImage(file){
  if(!file)return;
  const targetInput=modal.querySelector('#role-image-input');
  if(!/^image\/(?:png|jpeg|webp)$/.test(file.type)||file.size>12*1024*1024)
    throw new Error('Выбери изображение JPG, PNG или WebP размером до 12 МБ.');
  const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Не удалось прочитать картинку.'));reader.readAsDataURL(file);});
  const img=await new Promise((resolve,reject)=>{const element=new Image();element.onload=()=>resolve(element);element.onerror=()=>reject(new Error('Файл изображения повреждён.'));element.src=source;});
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Браузер не поддерживает обработку изображений.');
  let result='';
  for(const maxSize of [1280,1100,960,800,700,600]){
    const scale=Math.min(1,maxSize/img.naturalWidth,maxSize/img.naturalHeight);
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for(const quality of [.85,.74,.62,.50,.40]){
      const preview=canvas.toDataURL('image/webp',quality);
      if(preview.length<=140000 && safeRoleImage(preview)){result=preview;break;}
    }
    if(result)break;
  }
  if(!result)throw new Error('Не удалось уменьшить изображение до безопасного размера.');
  if(targetInput!==modal.querySelector('#role-image-input'))return;
  modal.querySelector('[name=image]').value=result;
  modal.querySelector('#role-image-preview').innerHTML=`<img src="${e(result)}" alt="Предпросмотр персонажа">`;
}
const defaultFolderKeys=()=>state.settings.folderTemplate||['source','voices','render','video','audio','subs','characterSubs','premiere'];
function episodeNumber(value){if(value===undefined||value===null||value==='')return '';const n=Number(value);if(!Number.isInteger(n)||n<1||n>9999)throw new Error('Номер серии — целое число от 1 до 9999.');return String(n);}
function windowsFeature(title){showModal(title,'Доступно в приложении для Windows.',`<a class="btn primary" href="Fundi-Voice-Windows.zip" download>Скачать для Windows</a>`);}
function wizardBack(step){
  const form=modal.querySelector('form');if(form&&projectWizard){const values=Object.fromEntries(new FormData(form));for(const key of ['parent','existingPath','title','season','number','folderName'])if(values[key]!==undefined)projectWizard[key]=values[key];}
  if(form&&projectWizard?.step===3&&projectWizard.mode==='new'){const data=Object.fromEntries(new FormData(form));projectWizard.keys=expandFolderKeys(PATHS.filter(([key])=>data['folder-'+key]).map(([key])=>key));}
  projectWizardStep(step);
}
function startProjectWizard(projectId){
  if(!projectId&&state.projects.length>=500){toast('Поддерживается до 500 проектов.',true);return;}
  const p=projectId?getProject(projectId):null;if(p&&p.episodes.length>=500){toast('В проекте уже 500 серий.',true);return;}
  const next=p?String(Math.max(0,...p.episodes.map(ep=>Number(ep.number)||0))+1):'1';
  projectWizard={step:0,projectId:projectId||'',mode:'',parent:p?.root||state.settings.studioRoot||'',existingPath:'',title:'',season:'',number:next,folderName:'',keys:defaultFolderKeys(),inspection:null};projectWizardStep(0);
}
function projectWizardStep(step){
  const w=projectWizard;if(!w)return;w.step=Number(step);const noun=w.projectId?'Новая серия':'Новый проект';const back=w.step?`<button type="button" class="btn ghost small wizard-back" data-action="wizard-back" data-step="${w.step===2&&w.mode==='none'?0:w.step-1}">${icon('back')}Назад</button>`:'';
  if(w.step===0){showModal(w.projectId?'Папка серии уже есть?':'Папка проекта уже есть?',noun+' · 1/4',`<div class="wizard-choices"><button type="button" data-action="wizard-choice" data-choice="existing">${icon('folder')}<strong>Да, привязать папку</strong></button><button type="button" data-action="wizard-choice" data-choice="new">${icon('plus')}<strong>Нет, создать новую</strong></button></div><button type="button" class="text-button wizard-skip-folder" data-action="wizard-choice" data-choice="none">Пока без папки</button>`);return;}
  if(w.step===1){
    const existing=w.mode==='existing';
    showModal(existing?(w.projectId?'Выбери папку серии':'Выбери папку проекта'):'Где создать папку?',noun+' · 2/4',`<div class="form-grid">${field(existing?(w.projectId?'Папка серии':'Папка аниме'):'Родительская папка',pathField(existing?'existingPath':'parent',existing?w.existingPath:w.parent),'',true)}</div>`,'Дальше',async data=>{
      if(existing){w.existingPath=trimPath(data.existingPath);if(!w.existingPath)throw new Error('Выбери папку.');
        if(native){if(w.projectId){const found=await api('detect',{path:w.existingPath}),name=w.existingPath.split(/[\\/]/).filter(Boolean).pop();w.inspection={root:getProject(w.projectId).root||w.existingPath.replace(/[\\/][^\\/]+$/,''),title:name,episodes:[{name,number:'',paths:found.paths}]};const n=name.match(/^(?:серия|episode|ep)[ ._-]*(\d+)/i);if(n)w.number=String(Number(n[1]));}else w.inspection=await api('inspect-project',{path:w.existingPath});}
        else w.inspection={root:w.existingPath,title:w.existingPath.split(/[\\/]/).filter(Boolean).pop(),episodes:[{name:'Серия',number:'',paths:{root:w.existingPath}}]};
        if(!w.title&&!w.projectId)w.title=w.inspection.title||'';
      }else{w.parent=trimPath(data.parent);if(!w.parent)throw new Error('Выбери, где создать проект.');if(native){const result=await api('check',{path:w.parent});if(!result.folder)throw new Error('Выбери папку.');}}
      projectWizardStep(2);
    },{extra:back});return;
  }
  if(w.step===2){
    const fields=w.projectId?field('Номер серии',input('number',w.number,'number','min="1" max="9999"'),'',true)+field('Название (необязательно)',input('title',w.title,'text','maxlength="120"'),'',true):field('Название *',input('title',w.title,'text','required maxlength="160"'),'',true)+field('Сезон',input('season',w.season,'number','min="1" max="9999"'),'',true)+(w.mode==='none'?field('Первая серия',input('number',w.number,'number','min="1" max="9999"'),'',true):'');
    showModal(w.projectId?'Какая серия?':'Как называется проект?',`${noun} · ${w.mode==='none'?'2/2':'3/4'}`,`<div class="form-grid">${fields}</div>`,w.mode==='none'?'Создать':'Дальше',async data=>{
      const oldDefault=w.projectId?episodeFolderName(w.number,w.title):projectFolderName(w.title,w.season),hadCustom=w.folderName&&w.folderName!==oldDefault;
      w.title=(data.title||'').trim();w.season=data.season||'';if(!w.projectId&&!w.title)throw new Error('Укажи название.');if(data.number!==undefined)w.number=episodeNumber(data.number);
      if(w.projectId&&w.number&&getProject(w.projectId).episodes.some(ep=>ep.number===w.number))throw new Error('Серия с таким номером уже есть.');
      if(w.mode==='none'){await finishProjectWizard({});return;}if(!hadCustom)w.folderName=w.projectId?episodeFolderName(w.number,w.title):projectFolderName(w.title,w.season);projectWizardStep(3);
    },{extra:back});return;
  }
  if(w.mode==='existing'){
    const list=w.inspection?.episodes||[];
    showModal(w.projectId?'Привязать эту папку?':'Какие серии привязать?',noun+' · 4/4',`<div class="wizard-series">${list.map((ep,i)=>`<label class="scan-item"><input type="checkbox" name="include-${i}" checked><span class="scan-copy"><b>${e(ep.number?'Серия '+ep.number:ep.name)}</b><small>${e(ep.paths.root)}</small></span></label>`).join('')}</div>${w.inspection?.truncated?'<p class="small muted">Показаны первые 100 серий.</p>':''}`,w.projectId?'Добавить серию':'Добавить проект',finishProjectWizard,{extra:back});return;
  }
  const main=['source','voices','render'],child=['video','audio','subs','characterSubs','premiere'];
  const boxes=keys=>keys.map(key=>`<label class="folder-checkbox"><input type="checkbox" class="wizard-folder" name="folder-${key}" data-key="${key}" ${w.keys.includes(key)?'checked':''}><span>${e(PATHS.find(p=>p[0]===key)[1])}</span></label>`).join('');
  showModal('Какие папки создать?',noun+' · 4/4',`<div class="form-grid">${field(w.projectId?'Имя папки серии':'Имя папки проекта',input('folderName',w.folderName,'text','required maxlength="90"'),'',true)}${w.projectId?'':field('Первая серия',input('number',w.number,'number','min="1" max="9999"'),'',true)}</div><div class="wizard-folder-tree">${boxes(main)}<details class="disclosure"><summary>Внутри исходников</summary><div class="folder-children">${boxes(child)}</div></details></div><div class="wizard-location" id="wizard-location">${e(w.parent+'\\'+w.folderName)}</div>`,w.projectId?'Создать серию':'Создать проект',finishProjectWizard,{extra:back});
}
async function finishProjectWizard(data){
  const w=projectWizard;if(!w)return;w.number=episodeNumber(data.number!==undefined?data.number:w.number);const target=w.projectId?getProject(w.projectId):null;if(target&&w.number&&target.episodes.some(ep=>ep.number===w.number))throw new Error('Серия с таким номером уже есть.');let episodes=[],root='';
  if(w.mode==='new'){
    if(!native){windowsFeature('Создание папок');return;}
    const folder=diskFolderName(data.folderName||w.folderName);if(!folder)throw new Error('Укажи имя папки.');if(folder!==(data.folderName||w.folderName).trim())throw new Error('В имени папки нельзя использовать <>:"/\\|?*.');
    w.keys=expandFolderKeys(PATHS.filter(([key])=>data['folder-'+key]).map(([key])=>key));
    const result=await api(target?'create-episode':'create-project',{parent:w.parent,name:folder,episode:episodeFolderName(w.number),folders:w.keys});root=result.root||w.parent;episodes=[newEpisode({number:w.number,title:target?w.title:'',paths:result.paths})];
    if(!state.settings.studioRoot&&!target)state.settings.studioRoot=w.parent;state.settings.folderTemplate=w.keys;
  }else if(w.mode==='existing'){
    const chosen=w.inspection.episodes.filter((ep,i)=>data['include-'+i]);if(!chosen.length)throw new Error('Выбери хотя бы одну серию.');
    episodes=chosen.map(ep=>newEpisode({number:target?w.number:ep.number||'',title:target?w.title:ep.number?'':ep.name,paths:ep.paths}));root=w.inspection.root;
    if(!state.settings.studioRoot&&w.inspection.studioRoot)state.settings.studioRoot=w.inspection.studioRoot;
  }else episodes=[newEpisode({number:w.number||'',title:target?w.title:''})];
  if(target){target.episodes.push(episodes[0]);if(!target.root&&root)target.root=root;touch(target);projectWizard=null;modal.close();openProject(target.id,episodes[0].id);toast('Серия создана');return;}
  const p=newProject({title:w.title,season:w.season,root,episodes});state.projects.push(p);touch(p);projectWizard=null;modal.close();openProject(p.id);toast('Проект создан');
}
function projectForm(id,section=''){
  if(!id){startProjectWizard();return;}const p=getProject(id);if(!p)return;
  if(!section){showModal('Проект',p.title,`<div class="project-edit-menu">${[['name','Название и сезон','edit'],['cover','Картинка','file'],['folder','Папка проекта','folder'],['other','Дополнительно','settings']].map(([key,label,ic])=>`<button type="button" data-action="project-section" data-id="${e(p.id)}" data-section="${key}">${icon(ic)}<span>${label}</span>${icon('chevron')}</button>`).join('')}<button type="button" data-action="archive-project" data-id="${e(p.id)}">${icon('archive')}<span>${p.archived?'Вернуть из архива':'В архив'}</span></button><button type="button" class="danger-text" data-action="delete-project" data-id="${e(p.id)}">${icon('trash')}<span>Удалить проект</span></button></div>`);return;}
  if(section==='folder'){attachRoot(p.id);return;}
  if(section==='cover'){showModal('Картинка проекта',p.title,`<div class="form-grid">${coverEditor(p.cover||'')}</div>`,'Сохранить',data=>{p.cover=safeCover(data.cover);touch(p);modal.close();render();toast('Сохранено');});return;}
  if(section==='name'){showModal('Название проекта','',`<div class="form-grid">${field('Название *',input('title',p.title,'text','required maxlength="160"'),'',true)}${field('Сезон',input('season',p.season,'number','min="1" max="9999"'),'',true)}</div>`,'Сохранить',data=>{if(!data.title.trim())throw new Error('Укажи название.');p.title=data.title.trim();p.season=data.season||'';touch(p);modal.close();render();toast('Сохранено');});return;}
  showModal('Дополнительно',p.title,`<div class="form-grid">${field('Другое название',input('alias',p.alias,'text','maxlength="300"'),'',true)}${field('Цвет',`<div class="color-picker">${COLORS.map(c=>`<button type="button" class="color-option color-${c} ${c===p.color?'selected':''}" data-action="color" data-color="${c}" title="${c}" aria-label="Цвет ${c}"></button>`).join('')}</div>${input('color',p.color,'hidden')}`)}${field('Приоритет',`<select name="priority">${options([['normal','Обычный'],['high','Высокий'],['low','Низкий']],p.priority)}</select>`)}${field('Заметки',area('notes',p.notes),'',true)}</div>`,'Сохранить',data=>{p.alias=(data.alias||'').trim();p.color=COLORS.includes(data.color)?data.color:'lime';p.priority=data.priority||'normal';p.notes=data.notes||'';touch(p);modal.close();render();});
}
function studioFolderForm(){showModal('Папка студии','',`<div class="form-grid">${field('Здесь хранятся проекты',pathField('studioRoot',state.settings.studioRoot||''),'',true)}</div>`,'Сохранить',async data=>{const path=trimPath(data.studioRoot);if(path&&native){const check=await api('check',{path});if(!check.folder)throw new Error('Выбери папку.');}state.settings.studioRoot=path;persist();modal.close();render();toast('Папка студии сохранена');});}
function createFolderForm(pid,epid){
  if(!native){windowsFeature('Создание папок');return;}const p=getProject(pid),ep=getEpisode(p,epid),parents=PATHS.filter(([key])=>key!=='reaper'&&ep.paths?.[key]&&!/\.prproj$/i.test(ep.paths[key])).map(([key,label])=>[ep.paths[key],label]);
  if(p.root&&!parents.some(x=>x[0]===p.root))parents.push([p.root,'Весь проект']);if(!parents.length&&state.settings.studioRoot)parents.push([state.settings.studioRoot,'Студия']);
  showModal('Создать папку',p.title,`<div class="form-grid">${field('Внутри',`<select name="folderParent" id="folder-parent-choice">${options([...parents,['__other__','Другая папка']],parents[0]?.[0]||'__other__')}</select>`,'',true)}<div id="folder-parent-custom" class="full" ${parents.length?'hidden':''}>${field('Родительская папка',pathField('customParent',''),' ',true)}</div>${field('Название *',input('folderName','','text','required maxlength="90"'),'',true)}</div>`,'Создать',async data=>{
    if(ep.resources.length>=2000)throw new Error('В серии уже 2000 материалов.');const parent=data.folderParent==='__other__'?trimPath(data.customParent):data.folderParent,name=(data.folderName||'').trim();if(!parent)throw new Error('Выбери родительскую папку.');if(!name)throw new Error('Укажи название.');
    const result=await api('create-folder',{parent,name});ep.resources.push({id:uid(),kind:parent===ep.paths?.voices?'voices':classifyFile(name,true),label:name,path:result.path,folder:true});touch(p);modal.close();ui.tab='materials';render();toast('Папка создана');
  });
}
function telegramEpisodeUrl(projectId,episodeId){
  return (cloud.sourceLinks||[]).find(x=>x.projectId===projectId&&x.episodeId===episodeId)?.url||'';
}
function validTelegramEpisodeUrl(value){
  return !value||/^https:\/\/(?:t\.me|telegram\.me)\/[A-Za-z0-9_+/-]+\/?$/.test(value);
}
function episodeForm(pid,epid){if(!epid){startProjectWizard(pid);return;}const p=getProject(pid);if(!p)return;const old=epid?p.episodes.find(x=>x.id===epid):null;const ep=old||newEpisode();showModal(old?'Настройки серии':'Новая серия',p.title,`<div class="form-grid">${field('Номер серии',input('number',ep.number,'number','min="1" max="9999" placeholder="Можно не указывать"'))}${field('Название серии',input('title',ep.title,'text','maxlength="120" placeholder="Необязательно"'))}${field('Текущий этап',`<select name="stage">${options(STAGES,ep.stage)}</select>`)}${field('Дедлайн',input('due',ep.due,'date'))}${field('Ссылка на исходники в Telegram',input('sourceUrl',telegramEpisodeUrl(p.id,ep.id),'url','maxlength="500" placeholder="https://t.me/channel/123"'),'Ссылка на сообщение или чат с исходниками для этой серии. Нажимая на название аниме, актёр откроет Telegram.',true)}${field('Заметки к серии',area('notes',ep.notes,'Правки, особенности сведения и режиссёрские пометки.'),'',true)}</div>`,'Сохранить',async data=>{if(!old&&p.episodes.length>=500)throw new Error('В проекте уже 500 серий.');const sourceUrl=(data.sourceUrl||'').trim();if(!validTelegramEpisodeUrl(sourceUrl))throw new Error('Вставь HTTPS-ссылку на t.me или telegram.me.');if(sourceUrl!==telegramEpisodeUrl(p.id,ep.id)){if(!cloud.connected)throw new Error('Сначала подключи Fundi Voice Cloud для сохранения ссылки.');cloud=await api('cloud/source-links/set',{projectId:p.id,episodeId:ep.id,url:sourceUrl});}if(data.number&&p.episodes.some(x=>x.id!==ep.id&&x.number===String(Number(data.number))))throw new Error('Серия с таким номером уже есть в проекте.');Object.assign(ep,{number:data.number?String(Number(data.number)):'',title:data.title.trim(),stage:data.stage,due:dateValue(data.due),notes:data.notes});if(!old)p.episodes.push(ep);touch(p);modal.close();if(ui.page==='detail')ui.episode=ep.id;render();toast(old?'Серия обновлена':'Серия добавлена');},{extra:old?`<button type="button" class="btn danger small" style="margin-right:auto" data-action="delete-episode" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('trash')}Удалить</button>`:''});}
function resourceForm(pid,epid,itemId,kind='source'){
  const p=getProject(pid),ep=getEpisode(p,epid);if(!ep)return;const old=ep.resources.find(r=>r.id===itemId),r=old||{id:uid(),kind,label:'',path:'',folder:kind==='folder'};
  showModal(old?'Изменить файл':'Добавить файл',p.title,`<div class="form-grid">${field('Название',input('label',r.label,'text','maxlength="200"'),'',true)}${field('Категория',`<select name="kind">${options(KINDS,r.kind)}</select>`)}${field('Тип',`<select name="folder">${options([['false','Файл'],['true','Папка']],String(r.folder))}</select>`)}${field('Путь *',pathField('path',r.path,r.folder?'folder':'file'),'',true)}</div>`,'Сохранить',async data=>{
    const path=trimPath(data.path);if(!path)throw new Error('Укажи путь.');if(native)await api('check',{path});if(data.kind==='reaper'&&!/\.rpp$/i.test(path))throw new Error('Для REAPER выбери .rpp.');if(!old&&ep.resources.length>=2000)throw new Error('В серии уже 2000 материалов.');
    Object.assign(r,{kind:data.kind,folder:data.folder==='true',path,label:(data.label||'').trim()||path.split(/[\\/]/).filter(Boolean).pop()||'Файл'});if(!old)ep.resources.push(r);if(r.kind==='reaper'){ep.paths=ep.paths||{};if(!ep.paths.reaper)ep.paths.reaper=r.path;}touch(p);modal.close();render();toast('Сохранено');
  },{extra:old?`<button type="button" class="btn danger small" style="margin-right:auto" data-action="delete-resource" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}">Убрать</button>`:''});
}

function targetField(pid,epid){if(pid){const p=getProject(pid),ep=getEpisode(p,epid);return input('target',ep.id,'hidden');}return field('Проект и серия *',`<select name="target" required><option value="">Выбери серию</option>${activeProjects().map(p=>`<optgroup label="${e(p.title)}">${p.episodes.map(ep=>`<option value="${e(ep.id)}">${e(episodeLabel(p,ep))}</option>`).join('')}</optgroup>`).join('')}</select>`,'',true);}
function resolveTarget(epid){for(const p of state.projects){const ep=p.episodes.find(x=>x.id===epid);if(ep)return {p,ep};}throw new Error('Выбери проект и серию.');}
function taskActorChoices(selected='') {
  const actors=[...(state.actors||[])].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  return '<option value="">Не указан</option>'+actors.map(a=>`<option value="${e(a.id)}" ${selected===a.id?'selected':''}>${e(a.name)}${a.telegram?' (@'+e(a.telegram)+')':''}${e(vacationOptionSuffix(a.id))}</option>`).join('');
}
function taskRoleChoices(ep,actorId='',selected='') {
  const roles=(ep?.roles||[]).filter(r=>!actorId||r.actorId===actorId||!r.actorId);
  return '<option value="">Не указан</option>'+roles.map(r=>`<option value="${e(r.id)}" ${selected===r.id?'selected':''}>${e(r.character)}${Number.isInteger(r.lineCount)?' · '+r.lineCount+' репл.':''}</option>`).join('');
}
function taskAssignmentFields(ep,t) {
  const actorId=ep?.roles.find(r=>r.id===t.roleId)?.actorId||t.actorId||'';
  return `<div class="field task-assignment-form"><label>Актёр</label><div id="task-actor-slot"><select name="actorId" aria-label="Актёр для задачи">${taskActorChoices(actorId)}</select></div><small class="task-assignment-help">Необязательно, из базы актёров студии.</small></div><div class="field"><label>Персонаж / роль</label><div id="task-role-slot"><select name="roleId" aria-label="Персонаж для задачи">${taskRoleChoices(ep,actorId,t.roleId||'')}</select></div><small class="task-assignment-help">Роли выбранной серии. Реплики берутся из карточки персонажа.</small></div>`;
}
function updateTaskAssignmentPickers(source) {
  const form=modal.querySelector('#modal-form');
  if(!form?.querySelector('.task-assignment-form'))return;
  let ep=null;
  try{ep=resolveTarget(form.querySelector('[name=target]')?.value).ep;}catch{}
  let actorId=form.querySelector('[name=actorId]')?.value||'';
  let roleId=form.querySelector('[name=roleId]')?.value||'';
  if(source==='target'){actorId='';roleId='';}
  if(source==='actorId')roleId='';
  const role=ep?.roles.find(r=>r.id===roleId);
  if(source==='roleId'&&role?.actorId)actorId=role.actorId;
  if(roleId&&(!role||(actorId&&role.actorId!==actorId)))roleId='';
  form.querySelector('#task-actor-slot').innerHTML=`<select name="actorId" aria-label="Актёр для задачи">${taskActorChoices(actorId)}</select>`;
  form.querySelector('#task-role-slot').innerHTML=`<select name="roleId" aria-label="Персонаж для задачи">${taskRoleChoices(ep,actorId,roleId)}</select>`;
}
function taskForm(pid,epid,itemId){
  const p=pid?getProject(pid):null,ep=getEpisode(p,epid),old=ep?.tasks.find(t=>t.id===itemId);
  const t=old||{id:uid(),title:'',due:'',mine:state.settings.mode==='actor',done:false,priority:'normal',actorId:'',roleId:''};
  if(!state.projects.length){projectForm();return;}
  showModal(old?'Изменить задачу':'Новая задача',pid?`${p.title} / ${episodeLabel(p,ep)}`:'Выбери серию и запиши следующий шаг.',
    `<div class="form-grid">${targetField(pid,epid)}${field('Что нужно сделать *',input('title',t.title,'text','required maxlength="500" placeholder="Например, проверить уровни голосов"'),'',true)}${taskAssignmentFields(ep,t)}${field('Дедлайн',input('due',t.due,'date'))}${field('Приоритет',`<select name="priority" aria-label="Приоритет задачи">${options(TASK_PRIORITIES,taskPriority(t.priority))}</select>`)}${state.settings.mode==='actor'?field('Ответственный',`<label class="check-label">${input('mine','1','checkbox',t.mine?'checked':'')}Моя задача</label>`):'<p class="task-sync-hint">Задача автоматически появится в разделе «Мои задачи» → «Мои поручения».</p>'}${old?field('Состояние',`<label class="check-label">${input('done','1','checkbox',t.done?'checked':'')}Выполнена</label>`):''}</div>`,
    'Сохранить',data=>{
      const {p,ep}=resolveTarget(data.target);
      if(!data.title.trim())throw new Error('Опиши задачу.');
      if(!old&&ep.tasks.length>=2000)throw new Error('В серии уже 2000 задач.');
      const role=data.roleId?ep.roles.find(r=>r.id===data.roleId):null;
      if(data.roleId&&!role)throw new Error('Выбери персонажа из этой серии.');
      if(data.actorId&&!state.actors.some(a=>a.id===data.actorId))throw new Error('Выбери актёра из базы.');
      if(role?.actorId&&data.actorId&&role.actorId!==data.actorId)throw new Error('Персонаж назначен другому актёру. Выбери соответствующего актёра.');
      Object.assign(t,{title:data.title.trim(),due:dateValue(data.due),priority:taskPriority(data.priority),
        actorId:role?.actorId||data.actorId||'',roleId:role?.id||'',
        mine:state.settings.mode==='actor'?!!data.mine:(old?!!old.mine:false),done:old?!!data.done:false});
      if(!old)ep.tasks.push(t);
      touch(p);modal.close();render();toast(old?'Задача обновлена':'Задача добавлена');
    },{extra:old?`<button type="button" class="btn danger small" style="margin-right:auto" data-action="delete-task" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(t.id)}">Удалить</button>`:''});
}

// Contextual assistant: counts always refer to this precise episode, not the anime total.
function castingCandidateLabel(row){
  return row.episodeCount+' ролей в серии · '+row.activeCount+' активных всего'+
    (row.unknownLines?' · '+row.unknownLines+' без числа реплик':'');
}
function updateCastingSuggestions(){
  const panel=modal.querySelector('#casting-suggestions');if(!panel)return;
  const targetId=modal.querySelector('[name=target]')?.value||'';
  let selection;try{selection=resolveTarget(targetId);}catch{
    panel.innerHTML='<p class="small muted">Выбери проект и серию, чтобы увидеть рекомендуемых актёров.</p>';return;
  }
  const {ep}=selection;
  const existing=ep.roles.find(r=>r.id===panel.dataset.roleId);
  const currentId=modal.querySelector('[name=actorId]')?.value||'';
  const gender=validRoleVoice(modal.querySelector('[name=voiceGender]')?.value);
  const showAll=!!panel.querySelector('#casting-suggestions-show-all')?.checked;
  const role={id:panel.dataset.roleId,voiceGender:gender};
  const rows=rankActorsForRole(state,ep,role,cloud.vacations||[],{excludeActorId:currentId&&currentId!=='__new__'&&currentId!=='__legacy__'?currentId:'',showAll});
  const picked=state.actors.find(a=>a.id===currentId);
  const currentLoad=picked?episodeActorWorkload(ep,picked.id,existing?.id||role.id):null;
  const mismatch=picked&&gender&&picked.voiceGroup!==gender;
  panel.innerHTML=(gender?'<label class="casting-show-all"><input type="checkbox" id="casting-suggestions-show-all" '+(showAll?'checked':'')+'> Показать всех актёров</label>':'')+
    '<div class="casting-suggestions-head"><strong>'+icon('users')+' Рекомендации по кастингу</strong><span class="small muted">Меньше повторов в серии — выше в списке</span></div>'+
    (picked?'<p class="casting-current">'+e(picked.name)+': '+currentLoad.count+' других ролей в этой серии'+(mismatch?' · ⚠ Тип голоса не совпадает с ролью':'')+'</p>':'')+
    '<div class="casting-suggestion-list">'+(rows.length?rows.slice(0,5).map((item,index)=>
      '<button type="button" class="casting-suggestion" data-action="casting-pick" data-actor="'+e(item.actor.id)+'">'+
      '<span class="casting-suggestion-rank">'+(index+1)+'</span><span class="casting-suggestion-content"><strong>'+e(item.actor.name)+'</strong>'+
      '<small>'+e(castingCandidateLabel(item))+'</small>'+
      (item.characters.length?'<small>В серии: '+e(item.characters.slice(0,3).join(', '))+(item.characters.length>3?'…':'')+'</small>':'')+
      (!item.hasAccess?'<small>Доступ в Actor пока выключен</small>':'')+'</span><span class="casting-suggestion-pick">Выбрать</span></button>'
    ).join(''):'<p class="small muted">Нет свободных кандидатов'+(gender?' с указанным типом голоса':'')+'. Проверь базу актёров и отпуска.</p>')+'</div>'+
    '<p class="small muted">Исключены действующие и запланированные отпуска. Тип голоса определяется по группе актёра в базе. Это подсказка, а не автоматическое назначение.</p>';
}
function castingModalCandidatesHTML(rows,preferredId=''){
  if(!rows.length)return '<p class="small muted">Подходящих актёров вне отпуска не найдено. Включи «Показать всех актёров» или проверь состав.</p>';
  const chosen=rows.some(x=>x.actor.id===preferredId)?preferredId:rows[0].actor.id;
  return '<div class="casting-modal-list">'+rows.map(item=>
    '<label class="casting-modal-option"><input type="radio" name="actorId" value="'+e(item.actor.id)+'" '+(item.actor.id===chosen?'checked':'')+'><span><strong>'+e(item.actor.name)+'</strong>'+
    '<small>'+e(castingCandidateLabel(item))+(item.episodeLines?' · '+item.episodeLines+' известных реплик':'')+'</small>'+
    (item.characters.length?'<small>Уже озвучивает: '+e(item.characters.slice(0,5).join(', '))+'</small>':'')+
    (!item.hasAccess?'<small>Доступ в Actor пока выключен</small>':'')+'</span></label>'
  ).join('')+'</div>';
}
function updateCastingModalCandidates(){
  const target=modal.querySelector('#casting-modal-candidates');
  if(!target)return;
  const p=getProject(target.dataset.project),ep=getEpisode(p,target.dataset.episode);
  const role=ep?.roles.find(r=>r.id===target.dataset.role);
  if(!role)return;
  const showAll=!!modal.querySelector('#casting-modal-show-all')?.checked;
  const chosen=modal.querySelector('input[name=actorId]:checked')?.value||'';
  target.innerHTML=castingModalCandidatesHTML(rankActorsForRole(state,ep,role,cloud.vacations||[],{excludeActorId:role.actorId,showAll}),chosen);
}
function castingAssistantForm(projectId,episodeId,roleId){
  const p=getProject(projectId),ep=getEpisode(p,episodeId),r=ep?.roles.find(x=>x.id===roleId);
  if(!p||!r)throw new Error('Роль не найдена. Обнови список.');
  const rows=rankActorsForRole(state,ep,r,cloud.vacations||[],{excludeActorId:r.actorId});
  const voice=validRoleVoice(r.voiceGender);
  const intro='<p class="casting-intro"><strong>'+e(r.character)+'</strong> · '+e(roleVoiceLabel(voice))+
    ' · '+e(episodeLabel(p,ep))+'</p><p class="small muted">Сначала исполнители без ролей в этой серии, затем с меньшей нагрузкой. В отпуске кандидаты исключены. Решение принимаешь ты.</p>';
  const list='<div id="casting-modal-candidates" data-project="'+e(p.id)+'" data-episode="'+e(ep.id)+'" data-role="'+e(r.id)+'">'+castingModalCandidatesHTML(rows)+'</div>';
  showModal('Подбор актёра',p.title, intro+(voice?'<label class="casting-show-all"><input type="checkbox" name="showAllActors" id="casting-modal-show-all"> Показать всех актёров</label>':'')+list,
    'Назначить выбранного',data=>{
      const candidate=rankActorsForRole(state,ep,r,cloud.vacations||[],{excludeActorId:r.actorId,showAll:data.showAllActors==='on'}).find(x=>x.actor.id===data.actorId);
      if(!candidate)throw new Error('Выбранный актёр больше недоступен. Обнови рекомендации.');
      applyRoleVoiceFromActor(r,state.actors.find(a=>a.id===r.actorId));
      const oldActorId=r.actorId;
      r.actorId=candidate.actor.id;r.actor=candidate.actor.name;applyRoleVoiceFromActor(r,candidate.actor);
      if(oldActorId!==r.actorId){r.status='waiting';r.reviewSeen='';}
      touch(p);modal.close();render();toast('Роль «'+r.character+'» назначена: '+candidate.actor.name);
    },{extra:'<button class="btn ghost small" type="button" data-action="edit-role" data-id="'+e(p.id)+'" data-ep="'+e(ep.id)+'" data-item="'+e(r.id)+'">Изменить роль</button>'});
}

function roleForm(pid,epid,itemId){
  const p=pid?getProject(pid):null,ep=getEpisode(p,epid),old=ep?.roles.find(r=>r.id===itemId),r=old||{id:uid(),createdAt:new Date().toISOString(),character:'',lineCount:null,actorId:'',actor:'',mine:state.settings.mode==='actor',status:'waiting',voiceGender:'',inProject:false,folder:'',subtitle:'',notes:'',due:'',image:''};
  if(!state.projects.length){projectForm();return;}
  showModal(old?'Изменить роль':'Новая роль',pid?p.title:'',`<div class="form-grid">${targetField(pid,epid)}${field('Персонаж *',input('character',r.character,'text','required maxlength="200"'),'',true)}${roleImageEditor(r.image||'')}${field('Количество реплик',input('lineCount',r.lineCount??'','number','min="0" max="1000000" step="1" inputmode="numeric" placeholder="Не указано"'),'Необязательно. 0 — реплик нет; пустое поле — количество неизвестно.',true)}${field('Тип голоса персонажа',`<select name="voiceGender" id="role-voice-gender">${options(ROLE_VOICE_OPTIONS,roleVoiceFromActor(r,state.actors.find(a=>a.id===r.actorId)))}</select>`,'Используется для рекомендаций: мужские или женские голоса.')}<div class="field full"><label>Актёр</label>${actorPicker(r,{form:true})}</div><div class="field full casting-suggestions" id="casting-suggestions" data-role-id="${e(r.id)}" aria-live="polite"></div><div class="field full new-actor-inline" id="new-actor-inline" hidden><label for="new-actor-name">Имя нового актёра *</label><input id="new-actor-name" name="newActorName" maxlength="160" disabled></div></div><details class="disclosure form-details"><summary>Обработка, голос и субтитры</summary><div class="form-grid">${field('Обработка',`<select name="status">${options(ROLE_STAGES,roleReviewStage(r,reviewForRole(r)))}</select>`)}${field('Срок для актёра',input('due',r.due||'','date'),'Если пусто — берём срок серии.')}${field('Отметки',`<label class="check-label">${input('mine','1','checkbox',r.mine?'checked':'')}Моя роль</label>`)}${field('Папка с голосом',pathField('folder',r.folder||'','folder'),'',true)}${field('SRT / ASS персонажа',pathField('subtitle',r.subtitle||'','file'),'',true)}${field('Заметки',area('notes',r.notes),'',true)}</div></details>`,'Сохранить',data=>{
    const {p,ep}=resolveTarget(data.target);if(!data.character.trim())throw new Error('Укажи персонажа.');const lineCountRaw=String(data.lineCount??'').trim();if(lineCountRaw&&!/^(?:0|[1-9][0-9]{0,6})$/.test(lineCountRaw))throw new Error('Количество реплик должно быть целым числом от 0 до 1 000 000.');const lineCount=lineCountRaw===''?null:Number(lineCountRaw);if(lineCount!==null&&lineCount>1000000)throw new Error('Максимум — 1 000 000 реплик.');if(!old&&ep.roles.length>=2000)throw new Error('В серии уже 2000 ролей.');
    let actor=(state.actors||[]).find(a=>a.id===data.actorId),legacy=data.actorId==='__legacy__'?r.actor:(data.actor||'').trim();
    if(data.actorId==='__new__'){const name=(data.newActorName||'').trim();if(!name)throw new Error('Укажи имя актёра.');if(state.actors.length>=2000)throw new Error('В списке уже 2000 актёров.');actor=newActor({name});state.actors.push(actor);}
    if(!actor&&data.mine&&!legacy){const matches=state.actors.filter(a=>a.name===state.settings.name);if(matches.length===1)actor=matches[0];else if(!matches.length){actor=newActor({name:state.settings.name});state.actors.push(actor);}}
    const newActorId=actor?.id||'',changedActor=!!old&&r.actorId!==newActorId;
    Object.assign(r,{character:data.character.trim(),voiceGender:roleVoiceFromActor({voiceGender:data.voiceGender},actor),image:safeRoleImage(data.image),lineCount,actorId:newActorId,actor:actor?.name||legacy||'',status:changedActor?'waiting':data.status||'waiting',reviewSeen:changedActor?'':r.reviewSeen,mine:!!data.mine,inProject:!!r.inProject,folder:trimPath(data.folder),subtitle:trimPath(data.subtitle),notes:data.notes||'',due:dateValue(data.due)});
    if(!old)ep.roles.push(r);touch(p);modal.close();render();toast('Сохранено');
  },{extra:old?`<button type="button" class="btn danger small" style="margin-right:auto" data-action="delete-role" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-item="${e(r.id)}">Удалить</button>`:''});
  updateCastingSuggestions();
}
function actorForm(id,castGroup='',voiceGroup=''){
  const old=state.actors.find(a=>a.id===id),a=old||newActor({voiceGroup,castGroup});
  showModal(old?'Изменить актёра':'Новый актёр','',`<div class="form-grid">${field('Имя / ник *',input('name',a.name,'text','required maxlength="160"'),'',true)}${field('Telegram',input('telegram',a.telegram?'@'+a.telegram:'','text','maxlength="100" placeholder="@username"'),'',true)}${field('Состав',`<select name="castGroup">${options([CAST_GROUPS[2],...CAST_GROUPS.slice(0,2)],a.castGroup||'')}</select>`)}${field('Голоса',`<select name="voiceGroup">${options([ACTOR_GROUPS[2],...ACTOR_GROUPS.slice(0,2)],a.voiceGroup||'')}</select>`)}</div><details class="disclosure form-details"><summary>Заметки</summary>${area('notes',a.notes)}</details>`,'Сохранить',data=>{
    const name=(data.name||'').trim(),telegram=cleanTelegram(data.telegram);if(!name)throw new Error('Укажи имя.');if(telegram&&!/^[A-Za-z0-9_]{1,64}$/.test(telegram))throw new Error('Впиши Telegram-юзернейм: @username.');if(!old&&state.actors.length>=2000)throw new Error('В списке уже 2000 актёров.');
    const voiceGroup=data.voiceGroup===undefined?(a.voiceGroup||''):data.voiceGroup;if(!ACTOR_GROUPS.some(([key])=>key===voiceGroup))throw new Error('Выбери группу актёра.');
    const cast=data.castGroup===undefined?(a.castGroup||''):data.castGroup;if(!CAST_GROUPS.some(([key])=>key===cast))throw new Error('Выбери состав.');
    Object.assign(a,{name,telegram,voiceGroup,castGroup:cast,notes:data.notes||''});if(!old)state.actors.push(a);
    for(const p of [...state.projects,...state.trash])for(const ep of p.episodes)for(const r of ep.roles)if(r.actorId===a.id)r.actor=a.name;
    expandActorGroup(a);persist();modal.close();render();toast('Актёр сохранён');
  },{extra:old?`<button type="button" class="btn danger small" style="margin-right:auto" data-action="delete-actor" data-actor="${e(a.id)}">Удалить</button>`:''});
}
// Browser-generated small avatar preview for owner-only Studio Web.
// Full local actor photos are never included in the shared cloud roster.
let avatarPreviewRunning=false;
function avatarSourceHash(source){
  let hash=2166136261,step=Math.max(1,Math.floor(source.length/128));
  for(let i=0;i<source.length;i+=step)hash=Math.imul(hash^source.charCodeAt(i),16777619);
  return source.length+':'+(hash>>>0).toString(16);
}
async function makeAvatarPreview(source){
  if(!source)return '';
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      try {
        const canvas=document.createElement('canvas');
        canvas.width=canvas.height=96;
        const context=canvas.getContext('2d');
        if(!context)throw Error('Canvas unavailable');
        const size=Math.min(img.naturalWidth,img.naturalHeight);
        context.drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,96,96);
        let preview=canvas.toDataURL('image/webp',0.68);
        if(preview.length>35000)preview=canvas.toDataURL('image/jpeg',0.62);
        resolve(preview.length<=35000?preview:'');
      }catch{resolve('');}
    };
    img.onerror=()=>resolve('');
    img.src=source;
  });
}
async function ensureActorPreviews(){
  if(avatarPreviewRunning)return;
  avatarPreviewRunning=true;
  let changed=false;
  try{
    for(const actor of state.actors||[]){
      const signature=actor.avatar?avatarSourceHash(actor.avatar):'';
      if(actor.avatarThumbSource===signature && (actor.avatarPreview || !signature))continue;
      const newPreview=await makeAvatarPreview(actor.avatar);
      if(actor.avatar!==undefined && (actor.avatarThumbSource!==signature||actor.avatarPreview!==newPreview)){
        actor.avatarPreview=newPreview;actor.avatarThumbSource=signature;changed=true;
      }
    }
    if(changed)persist();
  }finally{avatarPreviewRunning=false;}
}

function actorAvatarForm(id){
  const a=state.actors.find(a=>a.id===id);if(!a)return;
  showModal('Аватар актёра',a.name,`<div class="form-grid">${coverEditor(a.avatar||'','Аватар',true)}</div>`,'Сохранить',data=>{a.avatar=safeCover(data.cover);a.avatarPreview='';a.avatarThumbSource='';persist();modal.close();render();ensureActorPreviews().catch(()=>{});toast('Аватар сохранён');});
}
function actorDetails(id,tab='demos'){
  const a=state.actors.find(a=>a.id===id);if(!a)return;const rows=actorAssignments(state,id);
  const tabs=`<div class="actor-detail-tabs"><button type="button" class="${tab==='demos'?'active':''}" data-action="actor-details" data-actor="${e(id)}">Демки <span>${a.demos.length}</span></button><button type="button" class="${tab==='roles'?'active':''}" data-action="actor-roles" data-actor="${e(id)}">Роли <span>${rows.length}</span></button></div>`;
  const demos=`<div class="demo-list">${a.demos.map(d=>`<div class="demo-row"><div class="file-icon">${icon(d.folder?'folder':'file')}</div><div class="resource-copy"><div class="resource-title">${e(d.label)}</div><div class="resource-path" title="${e(d.path)}">${e(d.path)}</div></div><button type="button" class="btn ghost small" data-action="open-demo" data-actor="${e(id)}" data-demo="${e(d.id)}">${d.folder?'Открыть':'Смотреть'}</button><button type="button" class="icon-btn" data-action="edit-demo" data-actor="${e(id)}" data-demo="${e(d.id)}" title="Изменить демку" aria-label="Изменить демку">${icon('edit')}</button></div>`).join('')}</div>${a.demos.length?'':'<p class="empty-caption">Демки не добавлены</p>'}<button type="button" class="btn primary" data-action="new-demo" data-actor="${e(id)}">${icon('plus')}Добавить демку</button>`;
  const roles=rows.length?`<div class="actor-role-list">${rows.map(({p,ep,r})=>`<button type="button" class="actor-role-item" data-action="open-project" data-id="${e(p.id)}" data-ep="${e(ep.id)}" data-tab="roles"><span><strong>${e(r.character)}</strong><small>${e(p.title)} · ${e(episodeLabel(p,ep))}${p.archived?' · Архив':''}</small></span>${icon('chevron')}</button>`).join('')}</div>`:'<p class="empty-caption">Назначенных ролей пока нет</p>';
  showModal(a.name,[a.castGroup?CAST_GROUPS.find(([key])=>key===a.castGroup)?.[1]:'',a.voiceGroup?ACTOR_GROUPS.find(([key])=>key===a.voiceGroup)?.[1]:'',a.telegram?'@'+a.telegram:''].filter(Boolean).join(' · '),`<div class="actor-photo-row">${actorAvatar(a,true)}${vacationTag(a.id)}<button type="button" class="text-button" data-action="actor-avatar" data-actor="${e(a.id)}">Изменить аватар</button></div>`+tabs+(tab==='demos'?demos:roles)+(a.notes?`<details class="disclosure"><summary>Заметки</summary><p class="notes-text">${e(a.notes)}</p></details>`:''));
}
function demoForm(actorId,demoId){
  const a=state.actors.find(a=>a.id===actorId);if(!a)return;const old=a.demos.find(d=>d.id===demoId),d=old||{id:uid(),label:'',path:'',folder:false};
  showModal(old?'Изменить демку':'Новая демка',a.name,`<div class="form-grid">${field('Название',input('label',d.label,'text','maxlength="200" placeholder="Например, Комедия"'),'',true)}${field('Тип',`<select name="folder">${options([['false','Видеофайл'],['true','Папка с демками']],String(d.folder))}</select>`,'',true)}${field('Путь *',pathField('demoPath',d.path,d.folder?'folder':'file'),'',true)}</div>`,'Сохранить',async data=>{
    const path=trimPath(data.demoPath),folder=data.folder==='true';if(!path)throw new Error('Укажи путь к демке.');if(!old&&a.demos.length>=200)throw new Error('У актёра уже 200 демок.');
    if(native){const check=await api('check',{path});if(check.folder!==folder)throw new Error(folder?'Выбери папку.':'Выбери файл или переключи тип на «Папка с демками».');}
    Object.assign(d,{path,folder,label:(data.label||'').trim()||path.split(/[\\/]/).filter(Boolean).pop()||'Демка'});if(!old)a.demos.push(d);persist();render();actorDetails(a.id);toast('Демка добавлена');
  },{extra:old?`<button type="button" class="btn danger small" style="margin-right:auto" data-action="delete-demo" data-actor="${e(a.id)}" data-demo="${e(d.id)}">Убрать</button>`:''});
}
const castFromCurrentStatus=(projectId,episodeId)=>{
  const reviewed=withRoleReviews(state,cloud.reviews||[]);
  return castText(reviewed,reviewed.projects.find(p=>p.id===projectId),episodeId);
};
function castPreview(pid,epid,scope){
  const p=getProject(pid),ep=getEpisode(p,epid),selected=scope||ep.id;
  showModal('Состав для Telegram',p.title,`<div class="form-grid">${field('Серия',`<select id="cast-scope" data-id="${e(p.id)}">${p.episodes.map(x=>`<option value="${e(x.id)}" ${selected===x.id?'selected':''}>${e(episodeLabel(p,x))}</option>`).join('')}<option value="all" ${selected==='all'?'selected':''}>Все серии</option></select>`,'',true)}${field('Текст сообщения',`<textarea id="cast-draft" name="text" class="cast-draft">${e(castFromCurrentStatus(p.id,selected))}</textarea>`,'',true)}</div>`,'Скопировать',async data=>{await copyText(data.text);});
}

function episodePaths(pid,epid){
  const p=getProject(pid),ep=getEpisode(p,epid),paths=ep.paths||{},fields=keys=>keys.map(key=>field(PATHS.find(x=>x[0]===key)[1],pathField('p-'+key,paths[key]||'',key==='reaper'?'file':'folder'),'',true)).join('');
  showModal('Папки серии',`${p.title} · ${episodeLabel(p,ep)}`,`<div class="form-grid">${fields(['root'])}<div class="full auto-detect-line"><button type="button" class="btn ghost small" data-action="detect-structure" data-id="${e(p.id)}" data-ep="${e(ep.id)}">${icon('search')}Подобрать подпапки</button></div>${fields(['reaper','source','voices','render'])}</div><details class="disclosure form-details"><summary>Видео, звук, субтитры и Premiere</summary><div class="form-grid">${fields(['video','audio','subs','characterSubs','premiere'])}</div></details>`,'Сохранить',async data=>{
    const next=Object.fromEntries(PATHS.map(([key])=>[key,trimPath(data['p-'+key])]));if(native){for(const [key,path] of Object.entries(next)){if(!path)continue;const check=await api('check',{path});if(key==='reaper'&&!/\.rpp$/i.test(path))throw new Error('Для REAPER нужен файл .rpp.');if(key!=='reaper'&&key!=='premiere'&&!check.folder)throw new Error(`${PATHS.find(p=>p[0]===key)[1]}: выбери папку.`);}}ep.paths=next;touch(p);modal.close();render();toast('Папки сохранены');
  });
}

async function importRoles(pid,epid){
  const p=getProject(pid),ep=getEpisode(p,epid);
  if(!native){showModal('Персонажи из папки «Озвучка»','Импорт папок доступен в Windows-версии.',`<a class="btn primary" href="Fundi-Voice-Windows.zip" download>${icon('download')}Скачать для Windows</a>`);return;}
  if(!ep.paths?.voices){episodePaths(p.id,ep.id);toast('Укажи папку «Озвучка / персонажи» и сохрани структуру.');return;}
  showModal('Персонажи из папки озвучки','Ищем подпапки с именами персонажей.','<div class="loading-inline">Просматриваем папку…</div>');
  try{const data=await api('roles',{path:ep.paths.voices,subs:ep.paths.characterSubs||''});const candidates=data.items.filter(r=>!ep.roles.some(x=>x.character.trim().toLowerCase()===r.name.trim().toLowerCase()));if(!modal.open)return;
    showModal('Добавить персонажей из папок',`${p.title} / ${episodeLabel(p,ep)}`,`<p class="scan-info">${candidates.length} новых персонажей. Состояние обработки останется «Жду запись»: наличие файлов не означает, что голос готов.${data.truncated?' Показаны первые 400 папок.':''}</p><div class="scan-list">${candidates.map((r,i)=>`<label class="scan-item"><input type="checkbox" name="role-${i}" checked><span class="scan-copy"><b>${e(r.name)}</b><small>${e(r.folder)}${r.subtitle?' · SRT найден':''}</small></span></label>`).join('')||'<p class="muted small">Новых папок персонажей нет. Они уже добавлены или папка пуста.</p>'}</div>`,'Добавить выбранных',candidates.length?values=>{const chosen=candidates.filter((r,i)=>values['role-'+i]);if(!chosen.length)throw new Error('Отметь персонажей для добавления.');if(ep.roles.length+chosen.length>2000)throw new Error('В серии может быть до 2000 ролей.');chosen.forEach(r=>ep.roles.push({id:uid(),createdAt:new Date().toISOString(),character:r.name,actorId:'',actor:'',mine:false,status:'waiting',inProject:false,folder:r.folder,subtitle:r.subtitle||'',notes:''}));touch(p);modal.close();render();toast(`Добавлено персонажей: ${chosen.length}`);}:null);
  }catch(err){showModal('Не удалось прочитать персонажей','',`<p class="danger-note">${e(err.message)}</p>`);}
}
function confirmAction(title,body,label,fn){showModal(title,'',`<p class="danger-note">${body}</p>`,label,async()=>{await fn();modal.close();render();},{danger:true});}
function exportState(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Fundi-Voice-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Резервная копия подготовлена');}
async function copyText(value){try{await navigator.clipboard.writeText(value);toast('Скопировано');}catch{showModal('Скопировать','Выдели текст и нажми Ctrl+C.',`<textarea readonly>${e(value)}</textarea>`);}}
async function openPath(path){
  if(!native){showModal('Открыть файл','Локальные файлы открываются в Windows-версии.',`<p class="resource-path">${e(path)}</p><div class="btn-row"><button type="button" class="btn ghost" data-action="copy-path" data-path="${e(path)}">Скопировать путь</button><a class="btn primary" href="Fundi-Voice-Windows.zip" download>Скачать для Windows</a></div>`);return;}
  await api('open',{path});
}

function attachRoot(pid){const p=getProject(pid);if(!p)return;showModal('Рабочая папка проекта',p.title,`<div class="form-grid">${field('Полный путь к папке',pathField('root',p.root),'Открой папку в Проводнике и скопируй путь из адресной строки.','full')}</div>${!native?'<p class="small muted">Выбор через диалог и открытие Проводника доступны в Windows-версии. Путь можно сохранить и здесь.</p>':''}`,'Сохранить',async data=>{const path=trimPath(data.root);if(path&&native){const result=await api('check',{path});if(!result.folder)throw new Error('Выбери папку, а не файл.');}p.root=path;touch(p);modal.close();render();toast(path?'Рабочая папка подключена':'Папка отвязана');});}
async function scanFolder(pid,epid){
  const p=getProject(pid),ep=getEpisode(p,epid);if(!native){showModal('Подбор материалов из папки','Доступно в Windows-версии.',`<a class="btn primary" href="Fundi-Voice-Windows.zip" download>${icon('download')}Скачать для Windows</a>`);return;}
  if(!ep.paths?.root&&!p.root){episodePaths(p.id,ep.id);return;}
  showModal('Найти материалы',`${p.title} / ${episodeLabel(p,ep)}`,'<div class="loading-inline">Просматриваем папку проекта…</div>');
  try{const data=await api('scan',{path:ep.paths?.root||p.root});scanResults=data.items.filter(r=>!ep.resources.some(x=>x.path.toLowerCase()===r.path.toLowerCase()));if(!modal.open)return;
    const items=scanResults.map((r,i)=>`<div class="scan-item"><input type="checkbox" name="scan-${i}" id="scan-${i}" ${r.kind==='reaper'||r.kind==='subs'?'checked':''} aria-label="Добавить ${e(r.name)}"><label class="scan-copy" for="scan-${i}"><b>${e(r.name)}</b><small>${e(r.relative)}</small></label><select name="kind-${i}" aria-label="Категория ${e(r.name)}">${options(KINDS,r.kind)}</select></div>`).join('');
    showModal('Выбери материалы для серии',`${p.title} / ${episodeLabel(p,ep)}`,`<p class="scan-info">${scanResults.length?`Найдено ${scanResults.length} новых материалов. Отметь только то, что относится к этой серии.`:'Новых материалов не найдено.'} ${data.truncated?'Показаны первые 400 файлов и папок. Для остальных укажи путь вручную.':''}${data.skipped?' Некоторые вложенные папки недоступны.':''}</p>${scanResults.length?`<div class="selection-bar"><label class="check-label"><input type="checkbox" id="scan-all">Выбрать всё</label><span class="tiny muted">До 4 уровней вложенности</span></div><div class="scan-list">${items}</div>`:'<p class="small muted">Привяжи нужный путь вручную или выбери другую рабочую папку.</p>'}`,'Привязать выбранное',scanResults.length?data=>{const selected=scanResults.filter((r,i)=>data[`scan-${i}`]);if(!selected.length)throw new Error('Отметь хотя бы один материал.');if(ep.resources.length+selected.length>2000)throw new Error('Слишком много материалов для одной серии.');scanResults.forEach((r,i)=>{if(data[`scan-${i}`])ep.resources.push({id:uid(),path:r.path,label:r.name,kind:data[`kind-${i}`],folder:r.folder});});touch(p);modal.close();render();toast(`Привязано материалов: ${selected.length}`);}:null);
  }catch(err){if(modal.open)showModal('Не удалось просмотреть папку','',`<p class="danger-note">${e(err.message)}</p>`);}
}
function help(){guide(0);}
function guidePicture(step){
  const text=(x,y,value,size=16,cls='main-label')=>`<text x="${x}" y="${y}" font-size="${size}" class="${cls}">${e(value)}</text>`;
  const box=(x,y,w,h,fill='#18263c',stroke='#304967',rx=10)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
  const arrow=(x1,y1,x2,y2)=>`<path d="M${x1} ${y1}H${x2}V${y2}" fill="none" stroke="#52769d" stroke-width="2" marker-end="url(#guide-arrow)"/>`;
  const folder=(x,y,color='#88bfff')=>`<path d="M${x} ${y+7}v-7h18l7 7h28v32h-53z" fill="${color}" opacity=".18" stroke="${color}" stroke-width="1.5"/>`;
  let content='';
  if(step===0)content=box(25,24,222,202)+text(44,55,'ПРОЕКТ',11,'muted-label')+text(44,91,'Твоё аниме',21)+box(44,119,183,38,'#263b57')+text(58,144,'+ Новый проект',14,'blue')+text(44,193,'Открыть →',15,'orange')+arrow(254,121,320,121)+box(337,24,316,202)+text(357,56,'СЕРИЯ',11,'muted-label')+box(357,77,275,43,'#111d2e')+text(374,105,'Серия 1                 ▾',17)+text(361,161,'Роли',17,'orange')+text(445,161,'Файлы',17,'muted-label')+text(545,161,'Задачи',17,'muted-label')+'<path d="M358 173h48" stroke="#ffb16e" stroke-width="3"/>'+text(359,204,'+ Серия',14,'blue');
  if(step===1)content=box(213,17,254,49)+text(235,48,'Папка серии  ·  .rpp',18)+arrow(336,68,121,99)+arrow(336,68,336,99)+arrow(336,68,554,99)+box(23,111,201,116)+folder(40,126)+text(40,186,'Исходники',19)+text(40,210,'Видео · Звук · Сабы',13,'muted-label')+box(239,111,201,116)+folder(256,126,'#b4acff')+text(256,186,'Озвучка',19)+text(256,210,'Персонажи → голоса',13,'muted-label')+box(455,111,201,116)+folder(472,126,'#ffc18b')+text(472,186,'Готовое',19)+text(472,210,'Финальные рендеры',13,'muted-label');
  if(step===2)content=box(26,27,292,196)+box(46,46,48,48,'#29415e')+text(61,78,'А',24,'blue')+text(108,68,'Имя актёра',19)+text(108,91,'@username',14,'muted-label')+box(46,121,250,38,'#263b57')+text(67,146,'+ Добавить демку',15,'blue')+text(49,193,'Карточка актёра',13,'muted-label')+arrow(324,123,363,123)+box(382,27,272,86)+text(404,59,'▷  Видеодемка.mp4',17)+text(404,88,'Смотреть',14,'orange')+box(382,136,272,87)+text(404,169,'Папка с демками',17)+text(404,198,'Открыть папку',14,'blue');
  if(step===3)content=box(25,24,628,149)+text(45,54,'ПЕРСОНАЖ',11,'muted-label')+text(267,54,'АКТЁР',11,'muted-label')+text(517,54,'В REAPER',11,'muted-label')+'<path d="M26 68h626" stroke="#304967"/>'+text(45,100,'Персонаж 1',17)+text(267,100,'Актёр @username',16,'blue')+text(45,143,'Персонаж 2',17)+text(267,143,'Выбрать актёра ▾',16,'muted-label')+box(543,81,22,22,'#3976ac','#7bb5ed',4)+'<path d="m548 91 4 5 8-10" stroke="#dcf0ff" stroke-width="2" fill="none"/>'+box(543,123,22,22,'#142034','#476587',4)+box(384,190,269,42,'url(#guide-gradient)','#92b6e6')+'<text x="408" y="217" font-size="16" fill="#112039">Состав для чата → Копировать</text>';
  return `<svg class="guide-illustration" viewBox="0 0 680 250" role="img" aria-label="${['Проект и серии','Назначение папок серии','Актёры и видеодемки','Распределение ролей и состав для Telegram'][step]}"><defs><marker id="guide-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="m1 1 8 4-8 4" fill="none" stroke="#52769d" stroke-width="1.5"/></marker><linearGradient id="guide-gradient"><stop stop-color="#7bb7ff"/><stop offset="1" stop-color="#ffbe8a"/></linearGradient></defs>${content}</svg>`;
}
function guide(step=0){
  step=Math.max(0,Math.min(3,Number(step)||0));modalSubmit=null;modal.className='guide-modal';
  const pages=[['Проект → серия','Открой аниме и выбери серию. Кнопка «Новый проект» добавляет аниме, «+ Серия» — следующий эпизод.'],['Подключи папки','Файлы → Настроить. Укажи папку серии и нажми «Подобрать подпапки». В исходниках хранятся видео, дорожки UVR и сабы; в озвучке — голоса по персонажам.'],['Добавь актёров','Актёры → Добавить актёра. Впиши имя и Telegram. В карточке актёра прикрепи видеодемки или папку с ними.'],['Распредели роли','В проекте добавь персонажей и выбери актёров. Меняй обработку и отмечай «В REAPER». «Состав для чата» подготовит текст с Telegram-юзернеймами.']];
  modal.innerHTML=`<div class="guide-top"><span class="small">Быстрый старт · ${step+1}/4</span><div class="guide-dots">${pages.map((p,i)=>`<button type="button" class="${i===step?'active':''}" data-action="guide-step" data-step="${i}" aria-label="Шаг ${i+1}" ${i===step?'aria-current="step"':''}></button>`).join('')}</div></div><div class="guide-main"><h2 id="modal-title">${pages[step][0]}</h2>${guidePicture(step)}<p>${pages[step][1]}</p>${step===1&&!native?'<p class="guide-note">Папки и видео с компьютера открываются в Windows-версии.</p>':''}</div><div class="guide-foot"><button class="text-button" type="button" data-action="close-modal">Пропустить</button><div>${step?`<button class="btn ghost" type="button" data-action="guide-step" data-step="${step-1}">Назад</button>`:''}<button class="btn primary" id="guide-next" type="button" data-action="${step===3?'close-modal':'guide-step'}" data-step="${step+1}">${step===3?'Начать работу':'Дальше'}${icon('arrow')}</button></div></div>`;
  if(!modal.open)modal.showModal();setTimeout(()=>modal.querySelector('#guide-next')?.focus(),30);
}

async function action(a,d,el){
  if(a==='actor-picker-toggle'){
    const picker=el.closest('.actor-picker'),menu=picker.querySelector('.actor-picker-menu'),opening=menu.hidden;
    closeActorPickers(picker);
    menu.hidden=!opening;el.setAttribute('aria-expanded',String(opening));
    if(opening){
      if(picker.dataset.pickerScope==='row'){
        const rect=el.getBoundingClientRect(),width=Math.min(470,innerWidth-18);
        menu.style.position='fixed';menu.style.left=Math.max(9,Math.min(rect.left,innerWidth-width-9))+'px';menu.style.width=width+'px';
        if(innerHeight-rect.bottom<370&&rect.top>370){menu.style.top='auto';menu.style.bottom=(innerHeight-rect.top+6)+'px';}
        else{menu.style.bottom='auto';menu.style.top=(rect.bottom+6)+'px';}
      }
      const search=menu.querySelector('.actor-picker-search');search.value='';fillActorPicker(picker);search.focus();
    }
    return;
  }
  if(a==='actor-picker-select'){
    const picker=el.closest('.actor-picker');updateActorPicker(picker,d.actorValue);return;
  }
  const p=getProject(d.id),ep=getEpisode(p,d.ep);
  switch(a){
    case 'close-modal':modal.close();break;
    case 'studio-files':await showStudioFiles();break;
    case 'vacation-review-transfer':vacationReviewTransferForm(d.id,d.ep,d.item);break;
    case 'casting-assistant':castingAssistantForm(d.id,d.ep,d.item);break;
    case 'casting-pick':{const picker=modal.querySelector('.actor-picker-form');if(picker)updateActorPicker(picker,d.actor);break;}
    case 'refresh-all':await refreshAllStudio(el);break;
    case 'studio-vacation-new':studioVacationForm();break;
    case 'studio-vacation-edit':studioVacationForm(d.actor);break;
    case 'studio-vacation-end':await studioVacationEnd(d.actor);break;
    case 'studio-vacation-delete-event':{
      const event=(cloud.vacationEvents||[]).find(item=>String(item.id)===String(d.event));
      if(!event)break;
      confirmAction('Удалить событие отпуска?','Уведомление о событии исчезнет из облачной истории. Сам отпуск и доступность актёра не изменятся. Отменить удаление нельзя.','Удалить навсегда',async()=>{
        cloud=await api('cloud/vacations/delete',{kind:'event',value:String(event.id)});
        toast('Событие удалено с сервера');
      });
      break;
    }
    case 'studio-vacation-delete-history':{
      const item=(cloud.vacations||[]).find(v=>v.vacationId===d.vacation);
      if(!item||['active','planned'].includes(item.status)){toast('Сначала заверши действующий отпуск.',true);break;}
      const actor=state.actors.find(a=>a.id===item.actorId);
      confirmAction('Удалить историю отпуска?',`Запись об отпуске <strong>${e(actor?.name||item.username||'актёра')}</strong> и связанные с ней события будут навсегда удалены с сервера и из истории Actor. Действующие назначения ролей не изменятся.`,'Удалить навсегда',async()=>{
        cloud=await api('cloud/vacations/delete',{kind:'history',value:item.vacationId});
        toast('История отпуска удалена');
      });
      break;
    }
    case 'studio-vacation-read':cloud=await api('cloud/vacations/events/read',{ids:[Number(d.event)]});render();toast('Событие отмечено прочитанным');break;
    case 'role-recordings':{
      const role=ep?.roles.find(r=>r.id===d.item);if(role)await showStudioFiles({roleId:role.id,actorId:role.actorId,title:role.character+' · '+p.title+' · '+episodeLabel(p,ep)});break;
    }
    case 'notification-recordings':{
      const message=(cloud.mailbox?.messages||[]).find(item=>String(item.id)===d.message);
      if(message)await showStudioFiles({roleId:message.role.roleId,actorId:message.actorId,title:notificationActor(message)+' · '+message.role.character+' · '+message.role.projectTitle});break;
    }
    case 'studio-files-refresh':cloud=await api('cloud/files',{});updateFileBadge();renderStudioFiles();break;
    case 'studio-file-download':
    case 'studio-file-download-as':{
      el.disabled=true;try{
        const file=(cloud.files||[]).find(f=>f.fileId===d.file),found=file&&recordingRole(file);
        let folder=a==='studio-file-download'?found?.r.folder||'':'';
        if(!folder){
          const picked=await openFileBrowser(api,{mode:'folder',title:'Куда сохранить запись?',startPath:found?.r.folder||''});
          if(!picked)break;
          const chosen=picked.native?await api('pick',{type:'folder'}):picked;
          folder=chosen?.path||'';
          if(!folder)break;
        }
        const result=await api('cloud/files/download',{fileId:d.file,folder});
        if(!result.cancelled){cloud=result;modal.close();renderTransferNotice();}
      }finally{if(el.isConnected)el.disabled=false;}break;
    }
    case 'studio-file-delete':{
      const file=(cloud.files||[]).find(f=>f.fileId===d.file);if(!file)break;
      confirmAction('Удалить запись из облака?',e(file.fileName)+(file.status==='ready'?' будет удалён из облака. Восстановить файл будет нельзя.':' — незавершённая загрузка будет удалена, зарезервированное место освободится.'),'Удалить из облака',async()=>{cloud=await api('cloud/files/delete',{fileId:d.file});renderStudioFiles();toast('Запись удалена из облака');});break;
    }
    case 'studio-files-cleanup':confirmAction('Очистить незавершённые загрузки?','Будут удалены просроченные загрузки и записи, удаление которых прервалось. Готовые записи останутся.','Очистить',async()=>{cloud=await api('cloud/files/cleanup',{});renderStudioFiles();toast('Очистка завершена');});break;
    case 'studio-transfer-cancel':cloud=await api('cloud/transfer/cancel',{});renderTransferNotice();break;
    case 'studio-transfer-hide':hiddenTransferId=cloud.transfer?.id||'';renderTransferNotice();break;
    case 'studio-transfer-folder':await api('open',{path:d.path});break;
    case 'studio-messages':showStudioMessages();break;
    case 'studio-more-messages':studioNotificationLimit+=50;showStudioMessages();break;
    case 'studio-dismiss-failed':cloud=await api('cloud/messages/dismiss-failed',{});showStudioMessages();updateNotificationBadge();break;
    case 'studio-delete-message':cloud=await api('cloud/messages/delete',{id:Number(d.message)});showStudioMessages();updateNotificationBadge();break;
    case 'studio-clear-messages':confirmAction('Удалить все уведомления?','Уведомления исчезнут из истории этой Studio, включая непрочитанные. Отметки сдачи ролей и записи на сервере останутся.','Удалить все',async()=>{cloud=await api('cloud/messages/clear',{});updateNotificationBadge();});break;
    case 'review-role':reviewRoleForm(d.id,d.ep,d.item);break;
    case 'studio-read-message':cloud=await api('cloud/messages/read',{id:Number(d.message)});showStudioMessages();updateNotificationBadge();break;
    case 'notification-open-role':
    case 'notification-reply':{
      const message=(cloud.mailbox?.messages||[]).find(item=>String(item.id)===d.message);if(!message)break;
      const found=findNotificationRole(message);if(!found)throw new Error('Роль уже удалена из Studio.');
      cloud=await api('cloud/messages/read',{id:message.id});updateNotificationBadge();
      if(a==='notification-reply'){if(!found.assigned)throw new Error('Роль уже назначена другому актёру.');reviewRoleForm(found.p.id,found.ep.id,found.r.id);}
      else{modal.close();openProject(found.p.id,found.ep.id,'roles');}
      break;
    }
    case 'new-project':projectForm();break;
    case 'wizard-choice':if(d.choice==='new'&&!native){windowsFeature('Создание папок');break;}projectWizard.mode=d.choice;projectWizardStep(d.choice==='none'?2:1);break;
    case 'wizard-back':wizardBack(Number(d.step));break;
    case 'project-section':projectForm(d.id,d.section);break;
    case 'studio-folder':studioFolderForm();break;
    case 'create-folder':createFolderForm(p.id,ep.id);break;
    case 'choose-role-image':modal.querySelector('#role-image-input')?.click();break;
    case 'remove-role-image':modal.querySelector('[name=image]').value='';modal.querySelector('#role-image-preview').innerHTML=icon('file');break;
    case 'choose-cover':modal.querySelector('#project-cover-input').click();break;
    case 'remove-cover':modal.querySelector('[name=cover]').value='';modal.querySelector('#cover-preview').innerHTML=icon('file');break;
    case 'edit-project':projectForm(d.id);break;
    case 'open-project':if(modal.open)modal.close();openProject(d.id,d.ep,d.tab||'roles');break;
    case 'favorite':if(p){p.favorite=!p.favorite;touch(p);render();}break;
    case 'archive-project':if(p){if(modal.open)modal.close();p.archived=!p.archived;touch(p);navigate(p.archived?'archive':'projects');toast(p.archived?'Проект в архиве':'Проект возвращён в студию');}break;
    case 'delete-project':if(p)confirmAction('Удалить проект?',`Карточка <strong>${e(p.title)}</strong> и её серии будут перемещены в корзину. Восстановить их можно в настройках. Рабочие файлы останутся на диске.`,'Удалить проект',()=>{removeProject(state,p.id);persist();ui.page='projects';ui.project=null;toast('Проект перемещён в корзину');});break;
    case 'restore-project':restoreProject(state,d.id);persist();render();toast('Проект восстановлен');break;
    case 'new-episode':episodeForm(d.id);break;
    case 'edit-episode':episodeForm(d.id,d.ep);break;
    case 'delete-episode':if(p.episodes.length===1){toast('Оставь в проекте хотя бы одну серию.',true);break;}confirmAction('Удалить серию?',`<strong>${e(episodeLabel(p,ep))}</strong>, её роли, задачи и ссылки на материалы будут удалены из карточки. Файлы на диске останутся на месте.`,'Удалить серию',()=>{p.episodes=p.episodes.filter(x=>x.id!==ep.id);ui.episode=p.episodes[0].id;touch(p);toast('Серия удалена');});break;
    case 'stage':ep.stage=d.stage;touch(p);render();break;
    case 'quick-folder':{const target=ui.page==='detail'?ep:currentEpisode(p),path=d.scope==='project'?p.root:(target.paths?.root||p.root);if(path)await openPath(path);else attachRoot(p.id);break;}
    case 'attach-root':attachRoot(p.id);break;
    case 'quick-reaper':{const target=d.ep?ep:currentEpisode(p),files=target.resources.filter(r=>r.kind==='reaper');if(target.paths?.reaper)await openPath(target.paths.reaper);else if(files.length===1)await openPath(files[0].path);else if(files.length>1)openProject(p.id,target.id,'materials');else resourceForm(p.id,target.id,null,'reaper');break;}
    case 'tab-materials':ui.tab='materials';render();break;
    case 'add-resource':resourceForm(p.id,ep.id);break;
    case 'edit-resource':{const r=resolveMaterial(p,ep,d.item);if(r.virtual==='path')episodePaths(p.id,ep.id);else if(r.virtual==='project')attachRoot(p.id);else if(r.virtual==='role')roleForm(p.id,ep.id,d.item.slice(d.item.indexOf(':')+1));else resourceForm(p.id,ep.id,d.item);break;}
    case 'delete-resource':{const r=resolveMaterial(p,ep,d.item);confirmAction('Убрать материал?',`Ссылка <strong>${e(r.label)}</strong> будет убрана из серии. Файл останется на диске.`,'Убрать ссылку',()=>{if(r.virtual==='path')ep.paths[d.item.slice(5)]='';else if(r.virtual==='project')p.root='';else if(r.virtual==='role'){const rid=d.item.slice(d.item.indexOf(':')+1);ep.roles.find(x=>x.id===rid)[d.item.startsWith('role-folder:')?'folder':'subtitle']='';}else ep.resources=ep.resources.filter(x=>x.id!==d.item);touch(p);});break;}
    case 'copy-resource':await copyText(resolveMaterial(p,ep,d.item).path);break;
    case 'copy-path':await copyText(d.path);break;
    case 'open-resource':await openPath(resolveMaterial(p,ep,d.item).path);break;
    case 'scan':await scanFolder(p.id,ep.id);break;
    case 'episode-paths':episodePaths(p.id,ep.id);break;
    case 'open-episode-path':if(ep.paths?.[d.key])await openPath(ep.paths[d.key]);else episodePaths(p.id,ep.id);break;
    case 'detect-structure':{
      if(!native){toast('Подбор существующих папок доступен в Windows-версии.');break;}
      const root=trimPath(modal.querySelector('[name=p-root]').value);if(!root)throw new Error('Сначала укажи папку серии.');
      el.disabled=true;try{const data=await api('detect',{path:root});let count=0;for(const [key,path] of Object.entries(data.paths)){const input=modal.querySelector(`[name=p-${key}]`);if(input&&!input.value){input.value=path;count++;}}toast(`Подобрано путей: ${count}. Проверь и сохрани структуру.`);}finally{el.disabled=false;}break;
    }
    case 'import-roles':await importRoles(p.id,ep.id);break;
    case 'role-folder':{const r=ep.roles.find(r=>r.id===d.item);if(r.folder)await openPath(r.folder);else roleForm(p.id,ep.id,r.id);break;}
    case 'role-subs':{const r=ep.roles.find(r=>r.id===d.item);if(r.subtitle)await openPath(r.subtitle);else roleForm(p.id,ep.id,r.id);break;}
    case 'choose-debt-actor':ui.debtActor=d.key||'';render();break;
    case 'reset-debt-filters':ui.debtProject='all';ui.debtActor='';ui.debtStatus='all';ui.query='';saveUI();render();break;
    case 'clear-task-selection':selectedTasks.clear();render();break;
    case 'delete-selected-tasks':{
      if(!selectedTasks.size)break;
      const keys=new Set(selectedTasks),count=keys.size;
      confirmAction('Удалить выбранные задачи?',`Будут удалены <strong>${count}</strong> выбранных поручений из соответствующих проектов и серий. Остальные задачи, роли и файлы сохранятся. Удаление синхронизируется с Studio Web.`,'Удалить выбранные',()=>{
        const result=deleteBulkTasks(state,keys);
        selectedTasks.clear();
        if(result.removed){persist();toast('Удалено задач: '+result.removed);}
      });
      break;
    }
    case 'reset-task-filters':ui.taskPriority='all';ui.taskOrder='priority';ui.taskStatus='all';ui.taskLines='all';ui.taskActor='all';ui.taskProject='all';saveUI();render();break;
    case 'new-task':taskForm(p?.id,ep?.id);break;
    case 'edit-task':taskForm(p.id,ep.id,d.item);break;
    case 'toggle-task':{const t=ep.tasks.find(t=>t.id===d.item);t.done=!t.done;touch(p);render();break;}
    case 'delete-task':{const t=ep.tasks.find(t=>t.id===d.item);confirmAction('Удалить задачу?',e(t.title),'Удалить',()=>{ep.tasks=ep.tasks.filter(x=>x.id!==d.item);touch(p);});break;}
    case 'new-role':roleForm(p.id,ep.id);break;
    case 'edit-role':roleForm(p.id,ep.id,d.item);break;
    case 'hide-accepted-episode':{
      if(!native||!cloud.connected)throw Error('Подключи Studio к Fundi Voice Cloud.');
      if(!p||!ep)throw Error('Выбери конкретную серию.');
      const roles=acceptedEpisodeRolesForActors(p,ep);
      if(!roles.length){render();toast('Все принятые роли этой серии уже скрыты.');break;}
      el.disabled=true;
      try{
        cloud=await api('cloud/roles/hide-accepted-episode',{projectId:p.id,episodeId:ep.id,roles});
        render();
        toast('Принятые роли этой серии скрыты у актёров. В Studio они сохранены.');
      }finally{if(el.isConnected)el.disabled=false;}
      break;
    }
    case 'actor-cabinet-visibility':{
      if(!cloud.connected)throw Error('Подключи Studio к Fundi Voice Cloud.');
      const r=ep?.roles.find(x=>x.id===d.item);
      if(!r||r.actorId!==d.actor)throw Error('Назначение изменилось. Обнови таблицу ролей.');
      const hidden=d.hidden==='true';
      if(hidden&&roleReviewStage(r,reviewForRole(r))!=='done')throw Error('Скрыть можно только принятую роль.');
      cloud=await api('cloud/roles/visibility',{actorId:d.actor,roleId:d.item,hidden});
      render();toast(hidden?'Принятая роль скрыта из кабинета актёра. В таблице Studio она сохранена.':'Роль снова показана в кабинете актёра.');
      break;
    }
    case 'delete-role':{const r=ep.roles.find(r=>r.id===d.item);confirmAction('Удалить роль?',`<strong>${e(r.character)}</strong> будет убран из состава этой серии.`,'Удалить роль',()=>{ep.roles=ep.roles.filter(x=>x.id!==d.item);touch(p);});break;}
    case 'layout-grid':ui.layout='grid';saveUI();render();break;
    case 'layout-table':ui.layout='table';saveUI();render();break;
    case 'clear-search':ui.query='';ui.filter='all';render();break;
    case 'export':exportState();break;
    case 'import':document.querySelector('#import-file').value='';document.querySelector('#import-file').click();break;
    case 'help':help();break;
    case 'guide-step':guide(d.step);break;
    case 'theme':state.settings.theme=d.theme;persist();render();toast('Тема обновлена');break;
    case 'setup':{const first=activeProjects().find(p=>!p.root&&!p.episodes.some(ep=>ep.paths?.root));if(first){openProject(first.id,null,'materials');attachRoot(first.id);}else help();break;}
    case 'color':modal.querySelector('[name=color]').value=d.color;modal.querySelectorAll('.color-option').forEach(b=>{b.classList.toggle('selected',b.dataset.color===d.color);b.setAttribute('aria-pressed',String(b.dataset.color===d.color));});break;
    case 'pick-path':{
      if(!native){toast('Вставь путь вручную или запусти Windows-версию.');break;}
      let type=d.type;if(d.field==='path'||d.field==='demoPath')type=modal.querySelector('[name=folder]')?.value==='true'?'folder':'file';
      el.disabled=true;try{
        const picked=await openFileBrowser(api,{mode:type,title:type==='folder'?'Выбрать папку для материалов':'Найти материал на компьютере'});
        const result=picked?.native?await api('pick',{type}):picked;
        if(result?.path){modal.querySelector(`[name=${d.field}]`).value=result.path;if(d.field==='path'||d.field==='demoPath'){modal.querySelector('[name=folder]').value=String(result.folder);const kindSelect=modal.querySelector('[name=kind]');if(kindSelect&&kindSelect.value!=='reaper')kindSelect.value=classifyFile(result.path,result.folder);}}}finally{el.disabled=false;}break;
    }
    case 'new-actor':actorForm(undefined,d.cast||'',d.voice||'');break;
    case 'actor-avatar':actorAvatarForm(d.actor);break;
    case 'edit-actor':actorForm(d.actor);break;
    case 'actor-details':actorDetails(d.actor);break;
    case 'actor-roles':actorDetails(d.actor,'roles');break;
    case 'actor-access-preview':actorAccessPreview(d.actor);break;
    case 'cloud-setup':await cloudSetup();break;
    case 'cloud-copy-setup':await copyText(cloudWizard.code);toast('Код скопирован');break;
    case 'cloud-renew-setup':{const result=await api('cloud/setup-code',{renew:true});cloudWizard.code=result.code;await cloudSetup(1);break;}
    case 'cloud-sync':if(!await syncStudioTasks())throw Error('Не удалось согласовать этапы ролей с сайтом. Старые данные не отправлены.');await flushSave();await api('cloud/sync',{replace:false});await refreshCloud(true);toast(cloud.pending?'Синхронизация продолжается':'Изменения отправлены');break;
    case 'recovery-refresh':{const result=await api('cloud/recovery/requests',{});recoveryRequests=result.requests||[];render();break;}
    case 'recovery-copy':await copyText(recoveryCode);toast('Код скопирован');break;
    case 'recovery-approve':
    case 'recovery-reject':{
      const actorId=d.actor,record=recoveryRequests.find(r=>r.actorId===actorId);
      if(!record)throw new Error('Запрос уже обработан. Обнови список.');
      if(!confirm(a==='recovery-approve'
        ?'Ты лично подтвердил, что запрос принадлежит '+(record.profile?.name||record.username)+'? Старые сеансы будут отключены.'
        :'Отклонить запрос от '+record.username+'?'))break;
      el.disabled=true;
      try{
        const response=await api('cloud/recovery/decision',{actorId,action:a==='recovery-approve'?'approve':'reject'});
        const result=await api('cloud/recovery/requests',{});recoveryRequests=result.requests||[];
        render();
        if(response.approved){
          recoveryCode=response.code||'';
          showModal('Сброс пароля одобрен','Новый код для '+record.username,
            `<p class="muted">Передай код актёру лично. Он действует 24 часа и показывается только сейчас.</p>
            <p style="overflow-wrap:anywhere;font-family:monospace;user-select:all">${e(recoveryCode)}</p>
            <button type="button" class="btn primary" data-action="recovery-copy">Скопировать код</button>`);
        }else toast('Запрос отклонён.');
      }finally{if(el.isConnected)el.disabled=false;}
      break;
    }
    case 'cloud-invite':el.disabled=true;try{await cloudInvite(d.actor);}finally{if(el.isConnected)el.disabled=false;}break;
    case 'cloud-replace':confirmAction('Опубликовать данные этой Studio?','Списки ролей и разрешения на сервере будут заменены текущими данными этой программы.','Опубликовать',async()=>{await flushSave();await api('cloud/sync',{replace:true});await refreshCloud(true);toast('Назначения опубликованы');});break;
    case 'delete-actor':{const a=state.actors.find(a=>a.id===d.actor);if(!a)break;confirmAction('Удалить актёра?',`<strong>${e(a.name)}</strong>. Имя в ролях сохранится. Файлы демок останутся на диске.`,'Удалить',()=>{removeActor(state,a.id);if(ui.actorFilter===a.id)ui.actorFilter='';persist();});break;}
    case 'new-demo':demoForm(d.actor);break;
    case 'edit-demo':demoForm(d.actor,d.demo);break;
    case 'open-demo':{const a=state.actors.find(a=>a.id===d.actor);await openPath(a.demos.find(x=>x.id===d.demo).path);break;}
    case 'delete-demo':{const a=state.actors.find(a=>a.id===d.actor);confirmAction('Убрать демку?','Файл останется на диске.','Убрать',()=>{a.demos=a.demos.filter(x=>x.id!==d.demo);persist();});break;}
    case 'cast-preview':castPreview(p.id,ep.id);break;
    case 'data-folder':await api('data-folder',{});break;
    case 'shutdown':showModal('Завершить Fundi Voice?','Все изменения будут сохранены.',`<p class="danger-note">Чтобы открыть студию снова, запусти <strong>FundiVoiceStudio.exe</strong>.</p>`,'Сохранить и закрыть',async()=>{await flushSave();if(saveError)throw new Error(saveError);await api('shutdown',{});modal.close();app.innerHTML='<div class="boot"><span class="brand-mark"><img src="brand-mark.png" alt=""></span><p>Студия закрыта. Всё сохранено.</p><p class="small">Запусти FundiVoiceStudio.exe, когда будешь готов продолжить.</p></div>';});break;
  }
}
document.addEventListener('click',event=>{
  const changesSummary=event.target.closest('.studio-vacation-changes > summary');
  if(changesSummary)vacationChangesExpanded=!changesSummary.parentElement.open;
  const mySummary=event.target.closest('.my-role-project-group > summary');
  if(mySummary){if(myRolesExpanded===null)myRolesExpanded=new Set([...document.querySelectorAll('.my-role-project-group[open]')].map(group=>group.dataset.myRoleGroup));const id=mySummary.parentElement.dataset.myRoleGroup;if(myRolesExpanded.has(id))myRolesExpanded.delete(id);else myRolesExpanded.add(id);}
  const quick=event.target.closest?.('[data-qv-open]');
  if(quick){
    event.preventDefault();event.stopPropagation();
    if(modal.open)modal.close();
    const kind=quick.dataset.qvOpen;
    if(kind==='actor')quickViews.openActor(quick.dataset.qvActor);
    else if(kind==='role')quickViews.openRole(quick.dataset.qvProject,quick.dataset.qvEpisode,quick.dataset.qvRole);
    else if(kind==='replace')quickViews.openReplacement(quick.dataset.qvProject,quick.dataset.qvEpisode,quick.dataset.qvRole);
    else if(kind==='cloud')quickViews.openCloud(quick.dataset.qvProject,quick.dataset.qvEpisode,quick.dataset.qvRole,quick.dataset.qvActor);
    return;
  }
  if(!event.target.closest('.actor-picker'))closeActorPickers();
  const el=event.target.closest('[data-action],[data-nav],[data-mode],[data-filter],[data-tab],[data-site-mode],[data-site-nav],[data-cabinet]');if(!el)return;event.preventDefault();event.stopPropagation();
  if(el.dataset.siteMode){ui.siteMode=['studio','site','cabinet'].includes(el.dataset.siteMode)?el.dataset.siteMode:'studio';if(ui.siteMode==='site')siteManager.start();if(ui.siteMode==='cabinet')actorCabinet.start();render();return;}
  if(el.dataset.cabinet){actorCabinet.action(el.dataset);return;}
  if(el.dataset.siteNav){ui.sitePage=el.dataset.siteNav;siteManager.switchTab(ui.sitePage);return;}
  if(el.dataset.nav){navigate(el.dataset.nav);return;}
  if(el.dataset.mode){state.settings.mode=el.dataset.mode;persist();render();return;}
  if(el.dataset.filter){ui.filter=el.dataset.filter;render();return;}
  if(el.dataset.tab&&!el.dataset.action){ui.tab=el.dataset.tab;render();return;}
  Promise.resolve(action(el.dataset.action,el.dataset,el)).catch(err=>{if(modal.open)formError(err);else toast(err.message,true);});
});
// X1 (back, MouseEvent.button=3) and X2 (forward, button=4).
// Edge --app is Chromium: browser navigation also uses these buttons. We own
// them in the local app so a side click cannot leave the Studio or skip entries.
// Native browser Back/Forward and Alt+arrows still work via popstate.
window.addEventListener('mousedown',event=>{
  if(native&&(event.button===3||event.button===4))event.preventDefault();
},{capture:true});
window.addEventListener('auxclick',event=>{
  if(!native||(event.button!==3&&event.button!==4))return;
  event.preventDefault();event.stopPropagation();
  if(event.button===3)studioNavigation.back();
  else studioNavigation.forward();
},{capture:true});
document.addEventListener('contextmenu',event=>{
  if(modal.open||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
  const target=event.target.closest?.('[data-qv-context]');
  if(!target)return;
  quickViews.contextMenu(event,{
    actorId:target.dataset.qvActor||'',projectId:target.dataset.qvProject||'',
    episodeId:target.dataset.qvEpisode||'',roleId:target.dataset.qvRole||''
  });
});
document.addEventListener('dragstart',event=>{
  const card=event.target.closest?.('[data-drag-actor]');if(!card)return;
  const a=state.actors.find(a=>a.id===card.dataset.dragActor);if(ui.page!=='actors'||!a||!event.dataTransfer||modal.open){event.preventDefault();return;}
  endActorDrag();actorDrag={id:a.id,source:card,target:null,hoverTimer:null};event.dataTransfer.setData(ACTOR_DRAG_TYPE,a.id);event.dataTransfer.effectAllowed='move';card.classList.add('actor-dragging');document.body.dataset.actorDragging='true';
});
document.addEventListener('dragover',event=>{
  if(!actorDrag)return;const zone=actorDropZone(event.target);setActorDropTarget(zone);if(!zone)return;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';
});
document.addEventListener('drop',event=>{
  if(!actorDrag)return;const zone=actorDropZone(event.target),id=actorDrag.id,valid=event.dataTransfer?.getData(ACTOR_DRAG_TYPE)===id;
  if(zone){event.preventDefault();event.stopPropagation();}const cast=zone?.dataset.dropCast,voice=zone?.dataset.actorDrop==='voice'?zone.dataset.dropVoice:undefined;endActorDrag();if(valid&&zone)moveActorToGroup(id,cast,voice);
});
document.addEventListener('dragend',endActorDrag);
document.addEventListener('dragleave',event=>{if(actorDrag&&event.target===document.documentElement&&!event.relatedTarget)setActorDropTarget(null);});
document.addEventListener('pointerdown',event=>{const opened=document.querySelector('.episode-unassigned-dropdown[open]');if(opened&&!opened.contains(event.target))opened.open=false;});
document.addEventListener('pointerdown',event=>{const el=event.target.closest('button,.btn');if(!el||state?.settings.motion===false||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const rect=el.getBoundingClientRect(),ripple=document.createElement('span');ripple.className='click-ripple';ripple.style.left=(event.clientX-rect.left)+'px';ripple.style.top=(event.clientY-rect.top)+'px';el.append(ripple);setTimeout(()=>ripple.remove(),550);});
document.addEventListener('input',event=>{if(event.target.matches?.('[data-cabinet-search]')){
    const caret=event.target.selectionStart;
    actorCabinet.search(event.target.value);
    const next=document.querySelector('[data-cabinet-search]');
    if(next){next.focus();next.setSelectionRange(caret,caret);}
    return;
  }if(event.target.classList.contains('episode-unassigned-search')){const dropdown=event.target.closest('.episode-unassigned-dropdown');const q=event.target.value.trim().toLocaleLowerCase('ru');let visible=0;dropdown.querySelectorAll('.episode-unassigned-person').forEach(row=>{row.hidden=!row.dataset.unassignedSearch.includes(q);if(!row.hidden)visible++;});const empty=dropdown.querySelector('.episode-unassigned-no-matches');if(empty)empty.hidden=visible>0;return;}if(event.target.classList.contains('actor-picker-search')){fillActorPicker(event.target.closest('.actor-picker'),event.target.value);return;}if(event.target.name==='folderName'&&projectWizard?.step===3){const preview=modal.querySelector('#wizard-location');if(preview)preview.textContent=projectWizard.parent+'\\'+event.target.value;}if(event.target.id==='search-input'){ui.query=event.target.value;if(ui.page==='detail'||ui.page==='settings')ui.page='projects';render();}});
document.addEventListener('toggle',event=>{
  const el=event.target,key=el.dataset?.actorFold;if(el.tagName!=='DETAILS'||!key)return;
  if(el.open){if(!ui.actorExpanded.includes(key))ui.actorExpanded.push(key);}else ui.actorExpanded=ui.actorExpanded.filter(x=>x!==key);
  saveUI();
},true);
document.addEventListener('change',event=>{const el=event.target;
  if(el.id==='bulk-task-select-all'){
    const boxes=document.querySelectorAll('.task-bulk-checkbox');
    for(const box of boxes){const key=bulkTaskKey(box.dataset.id,box.dataset.ep,box.dataset.item);
      if(el.checked)selectedTasks.add(key);else selectedTasks.delete(key);
    }
    render();return;
  }
  if(el.classList.contains('task-bulk-checkbox')){
    const key=bulkTaskKey(el.dataset.id,el.dataset.ep,el.dataset.item);
    if(el.checked)selectedTasks.add(key);else selectedTasks.delete(key);
    render();return;
  }
  if(el.id==='project-cover-input'){loadProjectCover(el.files[0]).catch(formError);}
  if(el.id==='role-image-input'){loadRoleImage(el.files[0]).catch(formError);}
  if(el.id==='folder-parent-choice'){const row=modal.querySelector('#folder-parent-custom');if(row)row.hidden=el.value!=='__other__';}
  if(el.classList.contains('wizard-folder')){const deps={premiere:['video','source'],characterSubs:['subs','source'],video:['source'],audio:['source'],subs:['source']};if(el.checked){for(const key of deps[el.dataset.key]||[]){const parent=modal.querySelector('[name=folder-'+key+']');if(parent)parent.checked=true;}}else{for(const [child,parents] of Object.entries(deps))if(parents.includes(el.dataset.key)){const input=modal.querySelector('[name=folder-'+child+']');if(input)input.checked=false;}}}
  if(el.id==='sort-select'){ui.sort=el.value;saveUI();render();}
  if(el.id==='episode-select'){ui.episode=el.value;ui.roleFilter='all';ui.roleActor='all';ui.roleCharacter='all';render();}
  if(el.id==='cast-scope'){const p=getProject(el.dataset.id);modal.querySelector('#cast-draft').value=castFromCurrentStatus(p.id,el.value);}
  if(el.classList.contains('episode-stage')){const p=getProject(el.dataset.id),ep=getEpisode(p,el.dataset.ep);ep.stage=el.value;touch(p);}
  if(el.id==='actor-registration-filter'){ui.actorRegistrationFilter=['all','yes','no'].includes(el.value)?el.value:'all';saveUI();render();}
  if(el.id==='casting-suggestions-show-all'){updateCastingSuggestions();return;}
  if(el.id==='casting-modal-show-all'){updateCastingModalCandidates();return;}
  if(el.id==='review-show-all-actors'){refreshVacationReviewCandidates();return;}
  if(el.classList.contains('actor-picker-show-all-input')){const picker=el.closest('.actor-picker');fillActorPicker(picker,picker.querySelector('.actor-picker-search')?.value||'');return;}
  if(el.id==='workload-include-archive'){ui.workloadIncludeArchive=el.checked;saveUI();render();return;}
  if(el.id==='role-filter'){ui.roleFilter=el.value;render();}
  if(el.id==='role-actor-filter'){ui.roleActor=el.value;render();}
  if(el.id==='role-character-filter'){ui.roleCharacter=el.value;render();}
  if(el.id==='role-order'){ui.roleOrder=el.value;render();}
  if(modal.open&&modal.querySelector('#casting-suggestions')&&['target','voiceGender'].includes(el.name)){updateCastingSuggestions();return;}
  if(modal.open&&modal.querySelector('.task-assignment-form')&&['target','actorId','roleId'].includes(el.name)){updateTaskAssignmentPickers(el.name);return;}
  if(el.id==='task-priority-filter'){ui.taskPriority=el.value;saveUI();render();}
  if(el.id==='my-role-order'){ui.myRoleOrder=validMyRoleOrder(el.value);saveUI();render();}
  if(el.id==='task-order-filter'){ui.taskOrder=validTaskOrder(el.value);saveUI();render();}
  if(el.id==='task-lines-filter'){ui.taskLines=validTaskLineFilter(el.value);saveUI();render();}
  if(el.id==='task-status-filter'){ui.taskStatus=validTaskStatusFilter(el.value);saveUI();render();}
  if(el.id==='task-project-filter'){ui.taskProject=el.value;saveUI();render();}
  if(el.id==='task-actor-filter'){ui.taskActor=el.value;saveUI();render();}
  if(el.classList.contains('task-priority-select')){const p=getProject(el.dataset.id),ep=getEpisode(p,el.dataset.ep),t=ep?.tasks.find(x=>x.id===el.dataset.item);if(!t)return;t.priority=taskPriority(el.value);touch(p);render();}
  if(el.id==='debt-project-filter'){ui.debtProject=el.value;ui.debtActor='';saveUI();render();}
  if(el.id==='debt-status-filter'){ui.debtStatus=el.value;render();}

  if(el.id==='motion-toggle'){state.settings.motion=el.checked;persist();render();}
  if(el.id==='profile-name'){state.settings.name=el.value.trim()||'Студия';persist();render();}
  if(el.classList.contains('actor-access-toggle')){const a=state.actors.find(x=>x.id===el.dataset.actor);if(!a)return;a.actorAccess=el.checked;persist();render();toast(a.actorAccess?'Доступ включён. Изменение будет отправлено.':'Доступ выключен. Изменение будет отправлено.');return;}
  if(el.id==='profile-telegram'){state.settings.myTelegram=cleanTelegram(el.value).replace(/[^a-zA-Z0-9_]/g,'').slice(0,80);persist();render();}
  if(el.classList.contains('role-status')){const p=getProject(el.dataset.id),ep=getEpisode(p,el.dataset.ep),r=ep.roles.find(x=>x.id===el.dataset.item),review=reviewForRole(r);r.status=el.value;if(review)r.reviewSeen=reviewVersion(review);touch(p);render();}
  if(el.id==='scan-all')modal.querySelectorAll('[name^=scan-]').forEach(input=>input.checked=el.checked);
});
document.addEventListener('change',event=>{
  const checkbox=event.target.closest?.('input[data-vacation-indefinite]');if(!checkbox)return;
  const date=checkbox.closest('form')?.querySelector('input[name=endDate]');if(!date)return;
  date.disabled=checkbox.checked;date.required=!checkbox.checked;
});
modal.addEventListener('submit',async event=>{event.preventDefault();if(!modalSubmit)return;const form=event.target,data=Object.fromEntries(new FormData(form)),submit=form.querySelector('[type=submit]'),handler=modalSubmit;submit.disabled=true;try{await handler(data);}catch(err){formError(err);}finally{if(submit.isConnected)submit.disabled=false;}});
modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)modal.close();}});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&(event.key.toLowerCase()==='k'||event.code==='KeyK')){event.preventDefault();document.querySelector('#search-input')?.focus();document.querySelector('#search-input')?.select();}if((event.key.toLowerCase()==='n'||event.code==='KeyN')&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!modal.open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();projectForm();}});
document.querySelector('#import-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>8*1024*1024)throw new Error('Резервная копия должна быть меньше 8 МБ.');const imported=normalizeState(JSON.parse(await file.text()));showModal('Загрузить резервную копию?',`${imported.projects.length} проектов · ${imported.trash.length} в корзине`,`<p class="danger-note">Карточки в текущем рабочем пространстве будут заменены данными из <strong>${e(file.name)}</strong>. Перед заменой скачай текущую копию, если она нужна.</p><button type="button" class="btn ghost" data-action="export">${icon('download')}Скачать текущую копию</button>`,'Загрузить копию',async()=>{if(native)await api('state',imported);state=imported;persist();ui.page='projects';ui.query='';ui.filter='all';ui.actorFilter='';ui.actorExpanded=[];saveUI();modal.close();render();toast('Рабочее пространство восстановлено');});}catch(err){toast(err instanceof SyntaxError?'Не удалось прочитать JSON. Выбери резервную копию Fundi Voice.':err.message,true);}});
window.addEventListener('beforeunload',event=>{if(native&&saving){event.preventDefault();event.returnValue='';}});
window.addEventListener('storage',event=>{if(!native&&event.key===STORAGE&&event.newValue){try{state=normalizeState(JSON.parse(event.newValue));if(!modal.open)render();else toast('Данные обновлены в другой вкладке. Закрой форму, чтобы увидеть изменения.');}catch{}}});

// Opening the local workspace must never wait for a sleeping or unreachable Cloud server.
// StudioCloud keeps roster publication locked until syncStudioTasks confirms reconciliation.
async function finishStartupCloud(){
  await refreshCloud();
  if(!modal.open)render();
  const startupReconciled=!native||!cloud.connected||await syncStudioTasks();
  if(!startupReconciled){
    toast('Проверка веб-изменений не удалась. Локальная студия доступна, но публикация ролей остановлена до успешной синхронизации.',true);
    return;
  }
  if(!saveError){persist();if(!state.settings.onboardingSeen){state.settings.onboardingSeen=true;persist();guide(0);}}
}
async function boot(){
  try{let raw=null;try{raw=localStorage.getItem(STORAGE);}catch{}state=raw?normalizeState(JSON.parse(raw)):seedState();
    if(location.hostname==='127.0.0.1'){
      const params=new URLSearchParams(location.hash.slice(1));token=params.get('key')||sessionStorage.getItem('fundi-key')||'';
      if(token){sessionStorage.setItem('fundi-key',token);history.replaceState(null,'',location.pathname);native=true;try{info=await api('info');const data=await api('state');if(data.state)state=normalizeState(data.state);else state=seedState();}catch(err){saveError=err.message;}}
    }
    render();ensureActorPreviews().catch(()=>{});
    // Cloud fetches and web role reconciliation continue independently of the startup screen.
    void finishStartupCloud().catch(err=>toast('Не удалось проверить облачную синхронизацию: '+err.message,true));
    if(native){
      scheduleTaskCloudSync();setInterval(()=>syncStudioTasks().catch(()=>{}),45000);
      startUpdateNotice({api,label:'Studio',beforeRestart:async()=>{
        if(cloud.transfer?.state==='running'){toast('Дождись завершения передачи файлов перед обновлением.',true);return false;}
        if(saving)await flushSave();
        if(saveError){toast('Не удалось сохранить Studio: '+saveError,true);return false;}
        return true;
      }});
      setInterval(()=>refreshCloud(true),1500);
    }
  }catch(err){app.innerHTML=`<div class="boot"><span class="brand-mark"><img src="brand-mark.png" alt=""></span><p>Не удалось загрузить данные студии.</p><p class="small muted">${e(err.message)}</p><div class="btn-row"><button class="btn ghost" id="download-broken">Скачать сохранённые данные</button><button class="btn primary" id="recover-start">Открыть пустую студию</button></div><p class="small muted">Перед новым стартом сохрани текущие данные.</p></div>`;document.querySelector('#download-broken').onclick=()=>{const blob=new Blob([localStorage.getItem(STORAGE)||'{}'],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Fundi-Voice-recovery.json';a.click();};document.querySelector('#recover-start').onclick=()=>{state=seedState();saveError='';render();persist();};}
}
installVisualSelects({
  getActors:()=>state?.actors||[],
  getVacation:vacationFor,
  getCharacterImage:key=>episodeRoleCharacterImage(
    getEpisode(getProject(ui.project),ui.episode)?.roles||[],key),
  actorAvatar:actorPickAvatar,icon
});
boot();
