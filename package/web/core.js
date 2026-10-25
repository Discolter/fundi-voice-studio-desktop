export const SCHEMA = 1;
export const STAGES = [
  ['unset', 'Этап не указан'], ['prep', 'Подготовка'], ['record', 'Запись'],
  ['edit', 'Монтаж'], ['mix', 'Сведение'], ['review', 'Проверка'], ['done', 'Готово']
];
export const ROLE_STAGES = [['waiting','Жду запись'],['recording','В записи'],['received','Получено'],['processing','Обрабатываю'],['retake','На перезапись'],['done','Принято']];
export const TASK_PRIORITIES = [['urgent','Срочно'],['high','Высокий'],['normal','Обычный'],['low','Низкий']];
export const taskPriority = value => TASK_PRIORITIES.some(([key])=>key===value)?value:'normal';
export const taskPriorityName = value => TASK_PRIORITIES.find(([key])=>key===taskPriority(value))[1];
export const TASK_ORDERS = [
  ['priority','По приоритету'], ['linesAsc','Сначала меньше реплик'],
  ['linesDesc','Сначала больше реплик'], ['dueAsc','Ближайший дедлайн'],
  ['dueDesc','Поздний дедлайн'], ['actor','По актёру (А–Я)'],
  ['project','По проекту (А–Я)'], ['character','По персонажу (А–Я)']
];
export const TASK_LINE_FILTERS = [
  ['all','Все объёмы'], ['small','0–20 реплик'], ['medium','21–100 реплик'],
  ['large','Более 100 реплик'], ['unknown','Реплики не указаны']
];
export const TASK_STATUS_FILTERS = [
  ['all','Все задачи'], ['open','В работе'], ['done','Выполненные'],
  ['overdue','Просроченные'], ['noDue','Без дедлайна']
];
export const validTaskOrder = order => TASK_ORDERS.some(([key])=>key===order)?order:'priority';
export const validTaskLineFilter = value => TASK_LINE_FILTERS.some(([key])=>key===value)?value:'all';
export const validTaskStatusFilter = value => TASK_STATUS_FILTERS.some(([key])=>key===value)?value:'all';
export const DEBT_STAGES = ['waiting','retake'];
// Associate the last applied cloud review with the stored status. A director's manual
// selection is authoritative until a NEW review/submission arrives from the server.
// messageId changes for a new submission/feedback, but updatedAt can change merely
// because the same roster was republished, so do not use updatedAt as a version.
export const reviewVersion=review=>review?`${review.actorId||''}|${review.roleId||''}|${review.state||''}|${review.submissionId||0}|${review.messageId||0}`:'';
export const roleReviewStage=(role,review)=>{
  if(!review||role.reviewSeen===reviewVersion(review))return role.status;
  return review.state==='accepted'?'done':review.state==='retake'?'retake':review.state==='pending'&&!['processing','processed'].includes(role.status)?'received':role.status;
};
export function applyRoleReviews(state,reviews=[]){
  const byRole=new Map(reviews.map(item=>[item.actorId+'|'+item.roleId,item]));
  let changed=false;
  for(const p of state.projects||[])for(const ep of p.episodes||[])for(const role of ep.roles||[]){
    const review=byRole.get(role.actorId+'|'+role.id),version=reviewVersion(review);
    if(!version||role.reviewSeen===version)continue;
    role.status=roleReviewStage(role,review);
    role.reviewSeen=version;
    p.updatedAt=new Date().toISOString();
    changed=true;
  }
  return changed;
}
export function withRoleReviews(state,reviews=[]){
  const byRole=new Map(reviews.map(item=>[item.actorId+'|'+item.roleId,item]));
  return {...state,projects:state.projects.map(p=>({...p,episodes:p.episodes.map(ep=>({...ep,roles:ep.roles.map(role=>{
    const review=byRole.get(role.actorId+'|'+role.id);
    const status=roleReviewStage(role,review);
    return status===role.status?role:{...role,status};
  })}))}))};
}
// Две группы оформления: нейтральные однотонные и цветные градиенты.
export const THEMES = [
  ['slate','Серый','solid'],['graphite','Графит','solid'],['silver','Серебро','solid'],
  ['forest','Лесной','solid'],['plum','Сливовый','solid'],['ocean','Океан','solid'],
  ['aurora','Fundi Original','gradient'],['midnight','Полночь','gradient'],
  ['gold','Золотой час','gradient'],['light','Светлая','solid'],
  ['sunset','Закат','gradient'],['mintwave','Мятный градиент','gradient'],
  ['twilight','Сумерки','gradient'],['rose','Розовый градиент','gradient'],
  ['living-sunset', 'Живой сине-оранжевый', 'animated'],
  ['living-aurora', 'Живое сияние', 'animated'],
  ['living-ocean', 'Живой океан', 'animated'],
  ['living-plum', 'Живая плазма', 'animated']
];
export const ACTOR_GROUPS = [['female','Женские голоса'],['male','Мужские голоса'],['','Не указано']];
export const CAST_GROUPS = [['main','Основной состав'],['support','Вспомогательный состав'],['','Состав не указан']];
export const PATHS = [['root','Папка серии'],['reaper','Проект REAPER'],['source','Исходники'],['voices','Озвучка'],['render','Готовое'],['video','Видео'],['audio','Звук / UVR'],['subs','Сабы'],['characterSubs','SRT персонажей'],['premiere','Premiere']];
export const KINDS = [['folder','Рабочая папка'],['reaper','Проект REAPER'],['source','Исходники'],['voices','Голоса'],['subs','Субтитры'],['render','Готовый материал'],['reference','Референс']];
export const COLORS = ['lime','violet','orange','cyan','pink','blue'];
export const uid = () => globalThis.crypto?.randomUUID?.() || `fv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const str = (v, max = 1000) => typeof v === 'string' ? v.slice(0,max) : '';
const num = v => v === '' || v === null || v === undefined ? '' : (/^\d{1,4}$/.test(String(v)) ? String(Number(v)) : '');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const validDate = v => {if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;};
export const dateValue = v => validDate(v) ? v : '';
export const stageName = id => STAGES.find(s=>s[0]===id)?.[1] || STAGES[0][1];
export const roleStageName = id => ROLE_STAGES.find(s=>s[0]===(id==='processed'?'processing':id))?.[1] || ROLE_STAGES[0][1];
export const kindName = id => KINDS.find(s=>s[0]===id)?.[1] || 'Материал';
export function diskFolderName(value){let name=String(value||'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().replace(/[ .]+$/,'').slice(0,90).replace(/[ .]+$/,'');if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='_'+name;return name;}
export const projectFolderName = (title,season='') => diskFolderName(title+(season?' '+season:''));
export const episodeFolderName = (number='',title='') => diskFolderName((number?'Серия '+number:'Серия')+(title?' - '+title:''));
export function expandFolderKeys(keys){const all=new Set(keys.filter(k=>PATHS.some(p=>p[0]===k)&&!['root','reaper'].includes(k)));if(all.has('premiere'))all.add('video');if(all.has('characterSubs'))all.add('subs');if(['video','audio','subs'].some(k=>all.has(k)))all.add('source');return [...all];}
export const cleanTelegram = v => str(v,150).trim().replace(/^https?:\/\/(?:www\.)?t\.me\//i,'').replace(/^t\.me\//i,'').replace(/^@/,'').replace(/\/$/,'');
export function newActor(input={}) { return {id:uid(),name:'',telegram:'',voiceGroup:'',castGroup:'',avatar:'',avatarPreview:'',avatarThumbSource:'',notes:'',demos:[],actorAccess:false,...input}; }
export const actorForRole = (state,r) => (state.actors||[]).find(a=>a.id===r.actorId) || null;
export const actorName = (state,r) => actorForRole(state,r)?.name || r.actor || '';
// Episode-only actor filtering and workload order. Does not mutate actor assignments.
export function episodeRoleActorKey(state, role) {
  const actor=actorForRole(state,role);
  if(actor)return 'id:'+actor.id;
  const name=String(role.actor||'').trim();
  return name?'name:'+name.toLocaleLowerCase('ru'):'unassigned';
}
export function episodeRoleActorOptions(state, roles) {
  const actors=new Map();
  for(const role of roles){
    const key=episodeRoleActorKey(state,role);
    const actor=actorForRole(state,role);
    const label=actor?.name||String(role.actor||'').trim()||'Без актёра';
    if(!actors.has(key))actors.set(key,{key,label,count:0});
    actors.get(key).count++;
  }
  return [...actors.values()].sort((a,b)=>(a.key==='unassigned'?1:0)-(b.key==='unassigned'?1:0)||b.count-a.count||a.label.localeCompare(b.label,'ru'));
}
// Actors without any assigned role in the *current episode*, regardless of role status,
// visible filters, REAPER state, or assignments in other episodes.
export function episodeUnassignedActors(state, episode) {
  const actors=state.actors||[];
  const uniqueNames=new Map();
  for(const actor of actors) {
    const name=String(actor.name||'').trim().toLocaleLowerCase('ru');
    if(name)uniqueNames.set(name,(uniqueNames.get(name)||0)+1);
  }
  const assigned=new Set();
  for(const role of episode?.roles||[]) {
    if(role.actorId) { assigned.add(role.actorId); continue; }
    // Legacy projects can have actor text without an actorId. Match only an
    // unambiguous profile to avoid marking two equal names as assigned.
    const legacy=String(role.actor||'').trim().toLocaleLowerCase('ru');
    if(!legacy || uniqueNames.get(legacy)!==1)continue;
    const match=actors.find(actor=>String(actor.name||'').trim().toLocaleLowerCase('ru')===legacy);
    if(match)assigned.add(match.id);
  }
  return actors.filter(actor=>!assigned.has(actor.id))
    .sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base',numeric:true}));
}
// Character filter parallels actor filtering. Keys are case/whitespace normalized,
// but display labels preserve the original character spelling.
export const episodeRoleCharacterKey = role =>
  'character:'+String(role.character||'').trim().toLocaleLowerCase('ru');
export function episodeRoleCharacterOptions(roles) {
  const characters=new Map();
  for(const role of roles){
    const label=String(role.character||'').trim();
    if(!label)continue;
    const key=episodeRoleCharacterKey(role);
    if(!characters.has(key))characters.set(key,{key,label,count:0});
    characters.get(key).count++;
  }
  return [...characters.values()].sort((a,b)=>a.label.localeCompare(b.label,'ru',{sensitivity:'base',numeric:true}));
}
export function filterEpisodeRoles(state, roles, {status='all', actorKey='all', characterKey='all', order='original'}={}) {
  const all=episodeRoleActorOptions(state,roles);
  const counts=new Map(all.map(actor=>[actor.key,actor.count]));
  const rows=roles.filter(role=>(status==='all'||
      (status==='not-in-project'?!role.inProject:role.status===status))&&
      (actorKey==='all'||episodeRoleActorKey(state,role)===actorKey)&&
      (characterKey==='all'||episodeRoleCharacterKey(role)===characterKey));
  if(order==='workload'||order==='actor'){
    rows.sort((a,b)=>{
      const keyA=episodeRoleActorKey(state,a),keyB=episodeRoleActorKey(state,b);
      const countOrder=order==='workload'?(counts.get(keyB)||0)-(counts.get(keyA)||0):0;
      const labelA=actorName(state,a)||'Без актёра';
      const labelB=actorName(state,b)||'Без актёра';
      return countOrder||labelA.localeCompare(labelB,'ru')||a.character.localeCompare(b.character,'ru');
    });
  }
  return rows;
}
export function actorAssignments(state,id) {
  return state.projects.flatMap(p=>p.episodes.flatMap(ep=>ep.roles.filter(r=>r.actorId===id).map(r=>({p,ep,r}))));
}
export function removeActor(state,id) {
  const actor=(state.actors||[]).find(a=>a.id===id);if(!actor)return;
  for(const p of [...state.projects,...state.trash])for(const ep of p.episodes)for(const r of ep.roles)if(r.actorId===id){r.actor=actor.name;r.actorId='';}
  state.actors=state.actors.filter(a=>a.id!==id);
}
export function castText(state,p,episodeId='all') {
  const episodes=episodeId==='all'?p.episodes:p.episodes.filter(ep=>ep.id===episodeId);
  const lines=[p.title+(p.season?` · Сезон ${p.season}`:''),''];
  for(const ep of episodes){
    lines.push(ep.number?`Серия ${ep.number}`:ep.title||'Распределение ролей');
    // Для чата только Telegram и персонаж: без внутреннего имени/ника актёра.
    for(const r of ep.roles){
      const actor=actorForRole(state,r);
      const username=cleanTelegram(actor?.telegram||'').replace(/[^A-Za-z0-9_]/g,'');
      const character=String(r.character||'').replace(/[\r\n]+/g,' ').trim();
      const who=username?'@'+username:(actor||r.actorId||r.actor?'Без @username':'Не назначен');
      lines.push(`${who} — ${character}`);
    }
    if(!ep.roles.length)lines.push('Роли не добавлены');
    lines.push('');
  }
  return lines.join('\n').trim();
}
export function episodeLabel(p, ep) { return `${p.season ? `Сезон ${p.season} · ` : ''}${ep?.number ? `Серия ${String(ep.number).padStart(2,'0')}` : (ep?.title || 'Серия не указана')}`; }
export function newEpisode(input={}) {
  return { id: uid(), number:num(input.number), title:str(input.title,120), stage:'unset', due:'', notes:'', paths:{}, resources:[], tasks:[], roles:[], ...input };
}
export function newProject(input={}) {
  return {id:uid(), title:'Новый проект', alias:'', season:'', color:'lime', symbol:'spark', cover:'',priority:'normal', root:'', notes:'', favorite:false, archived:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), lastOpened:'', episodes:[newEpisode()], ...input};
}
export function seedState() {
  return {schema:SCHEMA,projects:[],actors:[],trash:[],settings:{mode:'studio',name:'Студия',myTelegram:'Discolter',studioRoot:'',folderTemplate:['source','voices','render','video','audio','subs','characterSubs','premiere'],theme:'aurora',motion:true,onboardingSeen:false,workspaceVersion:2},updatedAt:new Date().toISOString()};
}
export const safeCover = value => typeof value==='string'&&value.length<=700000&&/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value)?value:'';
// Retire only untouched bundled cards from v1. User-created cards use symbol "spark".
function untouchedStarter(p){
  const defaults=[['Re:Zero','hourglass','violet','','6'],['Ателье колдовских колпаков','witch','lime','','1'],['DAN DA DAN','bolt','orange','','2'],['Меч и жезл Вистории','swords','cyan','2',''],['Моб Психо 100','orbit','pink','1',''],['Токийские мстители','flower','blue','4','1']];
  const d=defaults.find(x=>p.title===x[0]&&p.symbol===x[1]&&p.color===x[2]&&p.season===x[3]);
  const aliases=['Re:Zero — жизнь с нуля в альтернативном мире','Witch Hat Atelier','DanDanDan · Дандадан','Wistoria: Wand and Sword','Mob Psycho 100','Tokyo Revengers'];
  if(d&&p.alias!==aliases[defaults.indexOf(d)])return false;
  if(!d||p.archived||p.cover||p.favorite||p.root||p.notes||p.priority!=='normal'||p.episodes.length!==1)return false;
  const ep=p.episodes[0];return ep.number===d[4]&&!ep.title&&ep.stage==='unset'&&!ep.due&&!ep.notes&&!ep.roles.length&&!ep.tasks.length&&!ep.resources.length&&!Object.values(ep.paths).some(Boolean);
}
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || raw.schema !== SCHEMA || !Array.isArray(raw.projects)) throw new Error('Это не резервная копия Fundi Voice или версия файла не поддерживается.');
  if (raw.projects.length > 500 || (raw.trash?.length||0)>500) throw new Error('В одном рабочем пространстве поддерживается до 500 проектов.');
  const ids = new Set();
  function id(v) { const x=str(v,80); if(!x || ids.has(x)){ const n=uid(); ids.add(n); return n; } ids.add(x); return x; }
  if(raw.actors!==undefined&&(!Array.isArray(raw.actors)||raw.actors.length>2000))throw new Error('Некорректный список актёров.');
  const actorIdMap=new Map();
  const actors=(raw.actors||[]).map(a=>{
    if(!a||!str(a.name,160).trim())throw new Error('У актёра должно быть имя.');
    if(a.demos&&(!Array.isArray(a.demos)||a.demos.length>200))throw new Error('У одного актёра может быть до 200 демок.');
    const actor=newActor({id:id(a.id),name:str(a.name,160).trim(),telegram:cleanTelegram(a.telegram).replace(/[^a-zA-Z0-9_]/g,''),voiceGroup:ACTOR_GROUPS.some(([key])=>key===a.voiceGroup)?a.voiceGroup:'',castGroup:CAST_GROUPS.some(([key])=>key===a.castGroup)?a.castGroup:'',avatar:safeCover(a.avatar),avatarPreview:safeCover(a.avatarPreview),avatarThumbSource:str(a.avatarThumbSource,64),notes:str(a.notes,4000),demos:(a.demos||[]).map(d=>({id:id(d.id),label:str(d.label,200)||'Демка',path:str(d.path,2000),folder:!!d.folder})).filter(d=>d.path),actorAccess:a.actorAccess===true});
    if(a.id&&!actorIdMap.has(a.id))actorIdMap.set(a.id,actor.id);return actor;
  });
  function normalizeRole(r){
    const name=str(r.actor,200).trim();let linked=actors.find(a=>a.id===actorIdMap.get(r.actorId));
    if(!linked&&name){const matches=actors.filter(a=>a.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru'));
      if(matches.length===1)linked=matches[0];
      else if(matches.length===0&&raw.actors===undefined){linked=newActor({id:id(''),name});actors.push(linked);}
    }
    return {id:id(r.id),character:str(r.character,200),lineCount:Number.isInteger(r.lineCount)&&r.lineCount>=0&&r.lineCount<=1000000?r.lineCount:null,actorId:linked?.id||'',actor:linked?.name||name,mine:!!r.mine,status:ROLE_STAGES.some(s=>s[0]===r.status)?r.status:r.status==='processed'?'processing':'waiting',inProject:!!r.inProject,folder:str(r.folder,2000),subtitle:str(r.subtitle,2000),notes:str(r.notes,2000),due:dateValue(r.due),createdAt:str(r.createdAt,50),reviewSeen:str(r.reviewSeen,260)};
  }
  function normalizeProject(p) {
    if (!p || typeof p !== 'object' || !str(p.title,160).trim()) throw new Error('У проекта должно быть название.');
    if (!Array.isArray(p.episodes) || !p.episodes.length || p.episodes.length>500) throw new Error('В проекте должна быть хотя бы одна серия (не более 500).');
    return {id:id(p.id),title:str(p.title,160).trim(),alias:str(p.alias,300),season:num(p.season),color:COLORS.includes(p.color)?p.color:'lime',symbol:['spark','hourglass','witch','bolt','swords','orbit','flower'].includes(p.symbol)?p.symbol:'spark',cover:safeCover(p.cover),priority:['normal','high','low'].includes(p.priority)?p.priority:'normal',root:str(p.root,2000),notes:str(p.notes,12000),favorite:!!p.favorite,archived:!!p.archived,createdAt:str(p.createdAt,50),updatedAt:str(p.updatedAt,50),lastOpened:str(p.lastOpened,50),episodes:p.episodes.map(ep=>{
      if(!ep || typeof ep!=='object') throw new Error('Некорректная серия.');
      for(const key of ['resources','tasks','roles']) if(ep[key] && (!Array.isArray(ep[key]) || ep[key].length>2000)) throw new Error('Слишком много записей в серии.');
      return {id:id(ep.id),number:num(ep.number),title:str(ep.title,120),stage:STAGES.some(s=>s[0]===ep.stage)?ep.stage:'unset',due:dateValue(ep.due),notes:str(ep.notes,12000),paths:Object.fromEntries(PATHS.map(([key])=>[key,str(ep.paths?.[key],2000)])),
        resources:(ep.resources||[]).map(r=>({id:id(r.id),kind:KINDS.some(k=>k[0]===r.kind)?r.kind:'source',label:str(r.label,200)||'Материал',path:str(r.path,2000),folder:!!r.folder})),
        tasks:(ep.tasks||[]).map(t=>({id:id(t.id),title:str(t.title,500),done:!!t.done,mine:!!t.mine,due:dateValue(t.due),priority:taskPriority(t.priority),actorId:actorIdMap.get(t.actorId)||str(t.actorId,80),roleId:str(t.roleId,80)})).filter(t=>t.title.trim()),
        roles:(ep.roles||[]).map(normalizeRole).filter(r=>r.character.trim())};
    })};
  }
  const projects=raw.projects.map(normalizeProject).filter(p=>raw.settings?.workspaceVersion===2||!untouchedStarter(p)),trash=(Array.isArray(raw.trash)?raw.trash:[]).map(normalizeProject);
  return {schema:SCHEMA,projects,actors,trash,settings:{mode:raw.settings?.mode==='actor'?'actor':'studio',name:str(raw.settings?.name,80)||'Студия',myTelegram:cleanTelegram(raw.settings?.myTelegram===undefined?'Discolter':raw.settings.myTelegram).replace(/[^a-zA-Z0-9_]/g,'').slice(0,80),studioRoot:str(raw.settings?.studioRoot,2000),folderTemplate:Array.isArray(raw.settings?.folderTemplate)?expandFolderKeys(raw.settings.folderTemplate):['source','voices','render','video','audio','subs','characterSubs','premiere'],theme:THEMES.some(([key])=>key===raw.settings?.theme)?raw.settings.theme:'aurora',motion:raw.settings?.motion!==false,onboardingSeen:raw.settings?.onboardingSeen===true,workspaceVersion:2},updatedAt:str(raw.updatedAt,50)};
}
export function projectProgress(p) {
  const steps = ['prep','record','edit','mix','review','done'];
  return Math.round(p.episodes.reduce((n,ep)=>n+Math.max(0,steps.indexOf(ep.stage)+1)/steps.length,0)/Math.max(1,p.episodes.length)*100);
}
export function currentEpisode(p) { return p.episodes.find(ep=>ep.stage!=='done') || p.episodes[p.episodes.length-1]; }
export function nearestDue(p) { return p.episodes.filter(e=>e.stage!=='done' && e.due).map(e=>e.due).sort()[0] || ''; }
export function projectMatches(p,q) {
  const text = [p.title,p.alias,p.season,p.root,p.notes,...p.episodes.flatMap(e=>[e.title,e.number,e.notes,...Object.values(e.paths||{}),...e.resources.flatMap(r=>[r.path,r.label]),...e.tasks.map(t=>t.title),...e.roles.flatMap(r=>[r.character,r.actor,r.notes,r.folder,r.subtitle])])].join(' ').toLocaleLowerCase('ru');
  return q.toLocaleLowerCase('ru').trim().split(/\s+/).every(w=>text.includes(w));
}
export function selectProjects(state,{query='',filter='all',sort='recent',archived=false}={}) {
  return state.projects.filter(p=>p.archived===archived && projectMatches(p,query) && (filter==='all' || (filter==='favorite'&&p.favorite) || (filter==='attention'&&((!p.root&&!p.episodes.some(ep=>ep.paths?.root)) || p.episodes.some(e=>e.stage==='unset'||(e.due&&e.due<today()&&e.stage!=='done')))) || p.episodes.some(e=>e.stage===filter))).sort((a,b)=>{
    if(a.favorite!==b.favorite) return a.favorite?-1:1;
    if(sort==='name') return a.title.localeCompare(b.title,'ru');
    if(sort==='due') return (nearestDue(a)||'9999').localeCompare(nearestDue(b)||'9999');
    return (b.lastOpened||b.createdAt||'').localeCompare(a.lastOpened||a.createdAt||'');
  });
}
// Назначения в личном кабинете: привязка по Telegram из карточки актёра
// плюс роли, которые вручную отмечены как «Моя роль».
export function myRoleRows(state,{query=''}={}) {
  const handle=cleanTelegram(state.settings?.myTelegram||'').toLocaleLowerCase('ru');
  const profile=(state.settings?.name||'').trim().toLocaleLowerCase('ru');
  const q=query.trim().toLocaleLowerCase('ru');
  return state.projects.flatMap(p=>p.episodes.flatMap(ep=>ep.roles.map(r=>({p,ep,r})))).filter(({p,ep,r})=>{
    const a=actorForRole(state,r),telegram=cleanTelegram(a?.telegram||'').toLocaleLowerCase('ru');
    const name=(a?.name||r.actor||'').trim().replace(/^@/,'').toLocaleLowerCase('ru');
    const isMine=!!r.mine||(!!handle&&(telegram===handle||(!telegram&&name===handle)))||(!a&&!!profile&&name===profile);
    if(!isMine)return false;
    return !q||`${p.title} ${p.alias} ${episodeLabel(p,ep)} ${r.character} ${actorName(state,r)} ${r.notes} ${roleStageName(r.status)}`.toLocaleLowerCase('ru').includes(q);
  }).sort((a,b)=>Number(a.p.archived)-Number(b.p.archived)||a.p.title.localeCompare(b.p.title,'ru')||Number(a.ep.number||0)-Number(b.ep.number||0)||a.r.character.localeCompare(b.r.character,'ru'));
}
// Невыполненные назначения: только роли с указанным актёром в активных проектах.
// Статусы «Жду запись» и «На перезапись» пересчитываются из текущих ролей,
// поэтому никакой дублирующей базы долгов или миграции workspace.json нет.
export function debtRows(state,{actorKey='',status='all',projectId='',query=''}={}) {
  const q=query.trim().toLocaleLowerCase('ru');
  return state.projects.filter(p=>!p.archived&&(!projectId||projectId==='all'||p.id===projectId))
    .flatMap(p=>p.episodes.flatMap(ep=>ep.roles.map(r=>{
      const actor=actorForRole(state,r),name=(actor?.name||r.actor||'').trim();
      return {p,ep,r,actor,actorLabel:name,actorKey:actor?'id:'+actor.id:'name:'+name.toLocaleLowerCase('ru')};
    })))
    .filter(({p,ep,r,actor,actorLabel,actorKey:key})=>
      DEBT_STAGES.includes(r.status)&&!!actorLabel&&
      (!actorKey||actorKey===key)&&(status==='all'||status===r.status)&&
      (!q||[p.title,p.alias,episodeLabel(p,ep),r.character,actorLabel,actor?.telegram||'',r.notes,roleStageName(r.status)].join(' ').toLocaleLowerCase('ru').includes(q))
    )
    .sort((a,b)=>(a.r.status==='retake'?0:1)-(b.r.status==='retake'?0:1)||
      a.actorLabel.localeCompare(b.actorLabel,'ru')||a.p.title.localeCompare(b.p.title,'ru')||
      Number(a.ep.number||0)-Number(b.ep.number||0)||a.r.character.localeCompare(b.r.character,'ru'));
}
// Actor Cloud contract v1. Only this explicit allowlist may be published.
// `preview` is only for the Studio owner. The cloud server must still authorize
// every request by an authenticated internal actor ID, NEVER by @username.
export function effectiveRoleDue(role, episode) { return dateValue(role.due) || dateValue(episode.due) || ''; }
export function actorPublicFeed(state, actorId, {preview=false}={}) {
  const actor=(state.actors||[]).find(a=>a.id===actorId);
  if(!actor || (!preview && actor.actorAccess!==true))return null;
  const roles=(state.projects||[]).filter(p=>!p.archived).flatMap(p=>(p.episodes||[]).flatMap(ep=>(ep.roles||[])
    .filter(r=>r.actorId===actorId).map(r=>({
      roleId:r.id,
      projectId:p.id, projectTitle:p.title, season:p.season,
      episodeId:ep.id, episodeNumber:ep.number, episodeTitle:ep.title,
      character:r.character, lineCount:Number.isInteger(r.lineCount)&&r.lineCount>=0?r.lineCount:null, status:r.status,
      createdAt:r.createdAt||'',projectCreatedAt:p.createdAt||'',
      due:effectiveRoleDue(r,ep)
    }))));
  // Do not include actor name, Telegram, email, notes, avatars or local paths.
  roles.sort((a,b)=>(a.due||'9999-99-99').localeCompare(b.due||'9999-99-99')||a.projectTitle.localeCompare(b.projectTitle,'ru')||a.character.localeCompare(b.character,'ru'));
  return {version:1,actorId:actor.id,roles};
}
// Optional task links point to the existing actor and role from this episode.
// Workload is read from the role itself, so changes to line counts update all tasks.
export function taskAssignment(state,ep,t) {
  const role=(ep?.roles||[]).find(r=>r.id===t.roleId)||null;
  const actorId=role?.actorId||t.actorId||'';
  const actor=(state.actors||[]).find(a=>a.id===actorId)||null;
  const actorName=actor?.name||role?.actor||'';
  return {role,actor,actorId,actorName,character:role?.character||'',lineCount:Number.isInteger(role?.lineCount)&&role.lineCount>=0?role.lineCount:null};
}
// Common task projection: original episode records only; no duplicate rows or migrations.
// includeArchived is enabled by the Studio personal dashboard to include every project.
export function taskRows(state,{mine=false,query='',includeArchived=false,priority='all',order='due',status='all',lines='all',actorId='all',projectId='all'}={}) {
  const q=query.trim().toLocaleLowerCase('ru');
  const safeOrder=order==='due'?'dueAsc':validTaskOrder(order);
  const safeStatus=validTaskStatusFilter(status),safeLines=validTaskLineFilter(lines);
  const priorityRank=t=>TASK_PRIORITIES.findIndex(([key])=>key===taskPriority(t.priority));
  const nullLast=(av,bv,desc=false)=>{
    if(av===null&&bv===null)return 0;
    if(av===null)return 1;
    if(bv===null)return -1;
    return (av-bv)*(desc?-1:1);
  };
  const dated=(a,b,descending=false)=>{
    const ad=a.t.due||null,bd=b.t.due||null;
    if(!ad&&!bd)return 0;
    if(!ad)return 1;
    if(!bd)return -1;
    return (descending?bd.localeCompare(ad):ad.localeCompare(bd));
  };
  return state.projects.filter(p=>includeArchived||!p.archived)
    .flatMap(p=>p.episodes.flatMap(ep=>ep.tasks.map(t=>({p,ep,t}))))
    .filter(({p,ep,t})=>{
      const linked=taskAssignment(state,ep,t),n=linked.lineCount;
      const matchesLines=safeLines==='all'||(safeLines==='unknown'?n===null:
        n!==null&&(safeLines==='small'?n<=20:safeLines==='medium'?n>20&&n<=100:n>100));
      const matchesStatus=safeStatus==='all'||(safeStatus==='open'?!t.done:
        safeStatus==='done'?!!t.done:safeStatus==='overdue'?!t.done&&!!t.due&&t.due<today():!t.due);
      const matchesActor=actorId==='all'||(actorId==='unassigned'?!linked.actorId:linked.actorId===actorId);
      return (!mine||t.mine)&&(priority==='all'||taskPriority(t.priority)===priority)&&matchesLines&&matchesStatus&&
        matchesActor&&(projectId==='all'||p.id===projectId)&&
        `${p.title} ${episodeLabel(p,ep)} ${t.title} ${linked.actorName} ${linked.actor?.telegram||''} ${linked.character}`.toLocaleLowerCase('ru').includes(q);
    })
    .sort((a,b)=>{
      const done=Number(a.t.done)-Number(b.t.done);
      if(done)return done; // Completed tasks remain at the bottom for every sort.
      let result=0;
      if(safeOrder==='priority')result=priorityRank(a.t)-priorityRank(b.t);
      else if(safeOrder==='linesAsc'||safeOrder==='linesDesc')
        result=nullLast(taskAssignment(state,a.ep,a.t).lineCount,taskAssignment(state,b.ep,b.t).lineCount,safeOrder==='linesDesc');
      else if(safeOrder==='dueAsc'||safeOrder==='dueDesc')result=dated(a,b,safeOrder==='dueDesc');
      else if(safeOrder==='actor')result=(taskAssignment(state,a.ep,a.t).actorName||'яяяяяя').localeCompare(taskAssignment(state,b.ep,b.t).actorName||'яяяяяя','ru');
      else if(safeOrder==='project')result=a.p.title.localeCompare(b.p.title,'ru');
      else if(safeOrder==='character')result=(taskAssignment(state,a.ep,a.t).character||'яяяяяя').localeCompare(taskAssignment(state,b.ep,b.t).character||'яяяяяя','ru');
      return result||Number(a.p.archived)-Number(b.p.archived)||dated(a,b)||a.t.title.localeCompare(b.t.title,'ru')||a.t.id.localeCompare(b.t.id,'ru');
    });
}
export function roleRows(state,{mine=false,query=''}={}) {
  return state.projects.filter(p=>!p.archived).flatMap(p=>p.episodes.flatMap(ep=>ep.roles.map(r=>({p,ep,r})))).filter(({p,r})=>(!mine||r.mine)&&(`${p.title} ${r.character} ${r.actor}`.toLowerCase().includes(query.toLowerCase())));
}
export function materialRows(state) {
  return state.projects.filter(p=>!p.archived).flatMap(p=>p.episodes.flatMap((ep,index)=>{
    const rows=ep.resources.map(r=>({p,ep,r}));
    for(const [key,label] of PATHS)if(ep.paths?.[key])rows.push({p,ep,r:{id:'path:'+key,label,path:ep.paths[key],folder:key!=='reaper'&&key!=='premiere',kind:key==='reaper'?'reaper':key==='voices'?'voices':['subs','characterSubs'].includes(key)?'subs':key==='render'?'render':'folder',virtual:'path'}});
    for(const role of ep.roles){if(role.folder)rows.push({p,ep,r:{id:'role-folder:'+role.id,label:role.character+' · голос',path:role.folder,folder:true,kind:'voices',virtual:'role'}});if(role.subtitle)rows.push({p,ep,r:{id:'role-subs:'+role.id,label:role.character+' · субтитры',path:role.subtitle,folder:false,kind:'subs',virtual:'role'}});}
    if(index===0&&p.root)rows.push({p,ep,r:{id:'project-root',label:'Папка проекта',path:p.root,folder:true,kind:'folder',virtual:'project'}});
    const seen=new Set();return rows.filter(({r})=>{const path=r.path.toLowerCase();if(seen.has(path))return false;seen.add(path);return true;});
  }));
}
export function removeProject(state,id) { const i=state.projects.findIndex(p=>p.id===id); if(i<0)return; state.trash.unshift(state.projects.splice(i,1)[0]); state.trash=state.trash.slice(0,500); }
export function restoreProject(state,id) { const i=state.trash.findIndex(p=>p.id===id); if(i<0)return; if(state.projects.length>=500)throw new Error('Достигнут лимит проектов.');state.projects.push(state.trash.splice(i,1)[0]); }
export function classifyFile(name,isDirectory=false) {
  if(isDirectory){ if(/готов|render|export|финал|final|output/i.test(name))return 'render';if(/голос|voice|дубл|actor|record|запис/i.test(name))return 'voices';if(/саб|суб|subs|subtitle/i.test(name))return 'subs'; return 'source'; }
  if(/\.rpp$/i.test(name))return 'reaper';if(/\.(srt|ass|ssa|vtt)$/i.test(name))return 'subs';if(/\.(wav|mp3|flac|ogg|m4a|aac)$/i.test(name))return 'voices';return 'source';
}
export const escapeHTML = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
