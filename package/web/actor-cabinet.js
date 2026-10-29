// Director-only, read-only Actor Desktop/Web cabinet preview.
// The Cloud roster is fetched with the Studio device token by the local server:
// no actor passwords, sessions, or impersonation are required.
const stageNames={waiting:'Жду запись',recording:'В записи',received:'Получено',
  processing:'Обрабатываю',processed:'Обрабатываю',retake:'На перезапись',done:'Принято'};
const safeSource=value=>typeof value==='string'&&/^https:\/\/(?:t\.me|telegram\.me)\/[A-Za-z0-9_+/-]+\/?$/.test(value)?value:'';
const validImage=value=>typeof value==='string'&&value.length<=150000&&
  /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value)?value:'';
const isDebt=role=>role.status==='waiting'||role.status==='retake';
const dateLabel=value=>value?new Date(value+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'Без срока';
const reviewRole=(role,reviews)=> {
  const review=(reviews||[]).find(r=>r.roleId===role.roleId);
  const status=review?.state==='pending'?'received':review?.state==='accepted'?'done':
    role.status==='recording'?'recording':review?.state==='retake'?'retake':
    role.status==='processed'?'processing':role.status;
  return {...role,status,review,reviewLabel:review?.state==='pending'?'На проверке':stageNames[status]||'Статус не указан'};
};
export function actorCabinetSnapshot(actor, localFeed, roster, hiddenRoles=[], reviews=[], sourceLinks=[]) {
  const local=Array.isArray(localFeed?.roles)?localFeed.roles:[];
  const verified=roster!==null;
  const server=verified?(roster.actors||[]).find(item=>item.actorId===actor.id):null;
  const enabled=!!server?.enabled;
  const published=Array.isArray(server?.feed?.roles)?server.feed.roles:[];
  const cloudIds=new Set(published.map(role=>role.roleId));
  const localIds=new Set(local.map(role=>role.roleId));
  const missing=verified?local.filter(role=>!cloudIds.has(role.roleId)):[];
  const unexpected=verified?published.filter(role=>!localIds.has(role.roleId)):[];
  // When offline, the local list is a PREVIEW only, never a claim of publication.
  const roles=(verified?(enabled?published:[]):local).map(role=>{
    const review=reviews.filter(item=>item.actorId===actor.id);
    const linked=sourceLinks.find(item=>item.projectId===role.projectId&&item.episodeId===role.episodeId);
    return reviewRole({...role,sourceUrl:safeSource(linked?.url||role.sourceUrl||'')},review);
  });
  const hiddenIds=new Set(hiddenRoles.filter(item=>item.actorId===actor.id).map(item=>item.roleId));
  const active=roles.filter(role=>!(role.status==='done'&&hiddenIds.has(role.roleId)));
  const history=roles.filter(role=>role.status==='done'&&hiddenIds.has(role.roleId));
  return {verified,enabled,server,local,published,missing,unexpected,roles,active,history,
    debts:active.filter(isDebt)};
}
function groupProjects(roles) {
  const projects=new Map();
  for(const r of roles){
    if(!projects.has(r.projectId))projects.set(r.projectId,{id:r.projectId,title:r.projectTitle,season:r.season,roles:[],episodes:new Map()});
    const p=projects.get(r.projectId);p.roles.push(r);
    if(!p.episodes.has(r.episodeId))p.episodes.set(r.episodeId,{id:r.episodeId,number:r.episodeNumber,title:r.episodeTitle,roles:[]});
    p.episodes.get(r.episodeId).roles.push(r);
  }
  return [...projects.values()].sort((a,b)=>String(a.title).localeCompare(String(b.title),'ru'));
}
const matches=(role,term)=>term.toLocaleLowerCase('ru').trim().split(/\s+/).every(part=>
  [role.projectTitle,role.character,role.episodeNumber,role.episodeTitle].join(' ').toLocaleLowerCase('ru').includes(part));
export function createActorCabinet({getActors,getCloud,getLocalFeed,actorAvatar,icon,escapeHTML,rerender,api}) {
  const e=escapeHTML;
  let selected='',section='projects',query='',roster=null,sourceLinks=[],checkedAt='',loading=false,error='';
  const actors=()=>[...(getActors()||[])].sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));
  const cloud=()=>getCloud()||{};
  const localFeed=id=>getLocalFeed(id);
  const account=id=>(cloud().actors||[]).find(a=>a.actorId===id);
  const snapshot=actor=>actorCabinetSnapshot(actor,localFeed(actor.id),roster,cloud().hiddenRoles||[],cloud().reviews||[],sourceLinks);
  const safeAvatar=a=>actorAvatar(a);
  const fmtTime=v=>v?new Date(v).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
  const telegram=a=>{
    const username=String(a.telegram||'').replace(/^@/,'');
    return /^[a-zA-Z0-9_]{5,32}$/.test(username)?
      '<a href="https://t.me/'+e(username)+'" target="_blank" rel="noopener noreferrer">@'+e(username)+'</a>':
      (username?'@'+e(username):'Telegram не указан');
  };
  const note=()=>'<p class="ac-owner-note">Режим руководителя · только просмотр. Здесь показаны назначения, а не личная сессия актёра. Факт прочтения или открытия программы актёром не отслеживается.</p>';
  function status(){
    if(!cloud().connected)return '<div class="ac-alert">Cloud не подключён. Показывается только локальный предварительный просмотр; подтвердить видимость актёру нельзя.</div>';
    if(error)return '<div class="ac-alert ac-alert-error">Не удалось проверить опубликованные роли: '+e(error)+'. Локальные назначения не считаются подтверждёнными.</div>';
    if(loading)return '<div class="ac-alert">Проверяем персональные списки ролей на сервере…</div>';
    if(!roster)return '<div class="ac-alert">Для подтверждения списка ролей нажми «Проверить Cloud».</div>';
    const pending=cloud().pending||cloud().error||cloud().conflict;
    return '<div class="ac-cloud-status">'+icon('check')+' Роли получены с сервера · '+e(fmtTime(checkedAt))+
      (pending?'<span class="ac-alert-inline">Есть несинхронизированные изменения Studio — проверь различия.</span>':'')+'</div>';
  }
  function home(){
    const all=actors(),term=query.toLocaleLowerCase('ru').trim();
    const visible=all.filter(a=>[a.name,a.telegram,account(a.id)?.username].join(' ').toLocaleLowerCase('ru').includes(term));
    return '<div class="ac-home"><div class="ac-heading"><div><span class="ac-eyebrow">Fundi Voice Actor · контроль состава</span><h1>Роли актёров</h1><p>Выбери аккаунт, чтобы увидеть опубликованные проекты и роли так, как они организованы в Actor.</p></div>'+
      '<button type="button" class="btn ghost" data-cabinet="refresh">'+icon('refresh')+' Проверить Cloud</button></div>'+
      status()+note()+
      '<div class="ac-home-bar"><label>'+icon('search')+'<input data-cabinet-search aria-label="Поиск актёров" placeholder="Найти актёра или @username" value="'+e(query)+'"></label><span>Актёров: '+visible.length+' из '+all.length+'</span></div>'+
      '<div class="ac-grid">'+visible.map(a=>{
        const view=snapshot(a),user=account(a.id),stateTag=!roster?'Ожидает проверки':
          !view.enabled?'Нет доступа в Cloud':user?.registered?'Аккаунт активирован':'Приглашение не активировано';
        const count=roster?view.published.length:view.local.length;
        return '<button type="button" class="ac-person" data-cabinet="actor" data-id="'+e(a.id)+'">'+
          '<span class="ac-person-head">'+safeAvatar(a)+'<span class="ac-person-text"><strong>'+e(a.name)+'</strong><small>'+telegram(a).replace(/<a[^>]*>|<\/a>/g,'')+'</small></span></span>'+
          '<span class="ac-person-bottom"><span>'+count+' рол. · '+e(stateTag)+'</span>'+icon('chevron')+'</span></button>';
      }).join('')+'</div>'+
      (!visible.length?'<div class="ac-empty">Актёры не найдены.</div>':'')+'</div>';
  }
  function roleImage(role){
    const src=validImage(role.image);
    return src?'<button type="button" class="ac-role-image" data-role-image-open aria-label="Увеличить персонажа '+e(role.character)+'"><img src="'+e(src)+'" alt="'+e(role.character)+'"></button>':
      '<span class="ac-role-image ac-role-no-image">'+icon('star')+'</span>';
  }
  function roleCard(role){
    const feedback=role.review?.messageText||'';
    const accepted=role.status==='done';
    return '<article class="ac-role" data-stage="'+e(role.status)+'"><div class="ac-role-identity">'+roleImage(role)+
      '<span><strong>'+e(role.character)+'</strong><small>'+
      (Number.isInteger(role.lineCount)?'Реплик: '+role.lineCount+' · ':'')+
      (role.episodeNumber?'Серия '+e(role.episodeNumber):e(role.episodeTitle||'Серия'))+
      '</small></span></div><button type="button" class="btn ghost small" data-qv-open="role" data-qv-project="'+e(role.projectId)+'" data-qv-episode="'+e(role.episodeId)+'" data-qv-role="'+e(role.roleId)+'">Карточка в Studio</button><span class="ac-stage" data-stage="'+e(role.status)+'">'+e(role.reviewLabel)+'</span>'+
      '<span class="ac-role-due">'+e(dateLabel(role.due))+'</span>'+
      '<button type="button" class="ac-disabled-action" disabled title="Доступно только актёру в его аккаунте">'+
      (accepted?'Принято':role.review?.state==='pending'?'На проверке':'Сдать на проверку')+'</button>'+
      (feedback?'<div class="ac-feedback">'+e(feedback)+'</div>':'')+'</article>';
  }
  function projectList(roles){
    const rows=groupProjects(roles.filter(r=>matches(r,query)));
    if(!rows.length)return '<div class="ac-empty">'+(query?'По запросу ничего не найдено.':'Ролей в этом разделе нет.')+'</div>';
    return '<div class="ac-projects">'+rows.map(p=>{
      const debts=p.roles.filter(isDebt).length,known=p.roles.filter(r=>Number.isInteger(r.lineCount));
      const sum=known.reduce((n,r)=>n+r.lineCount,0);
      return '<details class="ac-project" open><summary><span class="ac-project-symbol">'+e((p.title||'?').slice(0,1))+'</span>'+
        '<span class="ac-project-name"><strong>'+e(p.title)+'</strong><small>'+
        (p.season?'Сезон '+e(p.season)+' · ':'')+p.episodes.size+' сер. · '+p.roles.length+' рол. · '+
        (known.length?'Σ '+sum+' репл.':'Реплики не указаны')+'</small></span>'+
        (debts?'<span class="ac-debt-pill">'+debts+' к записи</span>':'<span class="ac-done-pill">В работе / принято</span>')+
        icon('chevron')+'</summary><div class="ac-episodes">'+
        [...p.episodes.values()].sort((a,b)=>Number(a.number||0)-Number(b.number||0)).map(ep=>{
          const source=ep.roles.map(r=>safeSource(r.sourceUrl)).find(Boolean);
          return '<section class="ac-episode"><h3>Серия '+e(ep.number||ep.title||'?')+
            (ep.title&&ep.number?' · '+e(ep.title):'')+
            (source?' <a href="'+e(source)+'" target="_blank" rel="noopener noreferrer">Исходники в Telegram ↗</a>':'')+
            '</h3><div class="ac-roles">'+ep.roles.map(roleCard).join('')+'</div></section>';
        }).join('')+'</div></details>';
    }).join('')+'</div>';
  }
  function actorView(){
    const actor=actors().find(a=>a.id===selected);
    if(!actor){selected='';return home();}
    const view=snapshot(actor),user=account(actor.id);
    const projects=groupProjects(view.active).length;
    const label=section==='debts'?'Мои долги':section==='history'?'История ролей':'Твои проекты';
    const links=roster?.actors||[];
    const localOnly=view.missing.length;
    let diagnostic='';
    if(view.verified){
      if(!view.enabled)diagnostic='<div class="ac-alert ac-alert-error">На сервере доступ этому актёру выключен или он отсутствует в опубликованном составе. Актёр не получит роли, даже если они назначены локально.</div>';
      if(localOnly)diagnostic+='<details class="ac-diagnostic"><summary>Есть в Studio, но отсутствуют в опубликованном списке: '+localOnly+'</summary>'+
        '<div>'+view.missing.map(r=>'<p><strong>'+e(r.character)+'</strong> · '+e(r.projectTitle)+' · '+e(r.episodeNumber)+' серия</p>').join('')+'</div><p>Проверь доступ актёра, сохранение роли и синхронизацию Cloud.</p></details>';
      if(view.unexpected.length)diagnostic+='<details class="ac-diagnostic"><summary>В Cloud есть роли, отличающиеся от локального списка: '+view.unexpected.length+'</summary>'+
        '<div>'+view.unexpected.map(r=>'<p>'+e(r.character)+' · '+e(r.projectTitle)+'</p>').join('')+'</div></details>';
    }
    if(view.verified&&!user?.registered)diagnostic+='<div class="ac-alert">Аккаунт Actor ещё не активирован. Назначения могут быть опубликованы, но актёр не сможет войти до регистрации.</div>';
    return '<div class="ac-view"><div class="ac-heading"><div><button type="button" class="ac-back" data-cabinet="home">'+icon('back')+' Все актёры</button>'+
      '<h1>'+e(actor.name)+'</h1><p>Персональный кабинет Actor · '+(view.verified?'опубликованные назначения':'локальный предварительный просмотр')+'</p></div>'+
      '<button type="button" class="btn ghost" data-cabinet="refresh">'+icon('refresh')+' Проверить Cloud</button></div>'+
      status()+diagnostic+note()+
      '<div class="ac-actor-shell"><aside class="ac-actor-sidebar"><div class="ac-actor-brand">'+icon('users')+' Fundi Voice <small>Actor · просмотр</small></div>'+
      '<nav><button type="button" class="'+(section==='projects'?'active':'')+'" data-cabinet="section" data-section="projects">'+icon('folder')+' Проекты <b>'+projects+'</b></button>'+
      '<button type="button" class="'+(section==='debts'?'active':'')+'" data-cabinet="section" data-section="debts">'+icon('debts')+' Мои долги <b>'+view.debts.length+'</b></button>'+
      '<button type="button" class="'+(section==='history'?'active':'')+'" data-cabinet="section" data-section="history">'+icon('archive')+' История <b>'+view.history.length+'</b></button></nav>'+
      '<div class="ac-actor-profile">'+safeAvatar(actor)+'<span><strong>'+e(actor.name)+'</strong><small>'+telegram(actor)+'</small></span></div></aside>'+
      '<div class="ac-actor-body"><div class="ac-actor-top"><span>ЛИЧНОЕ ПРОСТРАНСТВО</span><h2>'+label+'</h2>'+
      '<label class="ac-role-search">'+icon('search')+'<input data-cabinet-search placeholder="Найти роль или проект" value="'+e(query)+'"></label></div>'+
      '<div class="ac-actor-sync">'+(view.verified?'<span class="ac-synced">●</span> Опубликовано в Cloud':'<span class="ac-unsynced">●</span> Локальные данные')+
      (checkedAt?' · '+e(fmtTime(checkedAt)):'')+'</div>'+
      (section==='projects'?projectList(view.active):section==='debts'?projectList(view.debts):projectList(view.history))+
      '</div></div></div>';
  }
  async function refresh(){
    if(loading)return;
    if(!cloud().connected){roster=null;sourceLinks=[];error='Cloud не подключён';rerender();return;}
    loading=true;error='';rerender();
    try{
      const data=await api('cloud/actor-roster',{});
      if(!Array.isArray(data.actors))throw Error('Сервер не вернул список актёров.');
      roster={actors:data.actors};sourceLinks=Array.isArray(data.sourceLinks)?data.sourceLinks:[];
      checkedAt=data.checkedAt||new Date().toISOString();error='';
    }catch(err){roster=null;sourceLinks=[];checkedAt='';error=String(err.message||err);}
    finally{loading=false;rerender();}
  }
  function action(data){
    if(data.cabinet==='home'){selected='';section='projects';query='';rerender();window.scrollTo(0,0);}
    if(data.cabinet==='actor'){if(!actors().some(a=>a.id===data.id))return;selected=data.id;section='projects';query='';rerender();window.scrollTo(0,0);}
    if(data.cabinet==='section'){if(!['projects','debts','history'].includes(data.section))return;section=data.section;query='';rerender();}
    if(data.cabinet==='refresh')refresh();
  }
  function search(value){query=value;rerender();}
  return {render:()=>selected?actorView():home(),start:()=>{selected='';section='projects';query='';refresh();},
    navigationState:()=>({actorId:selected,section}),
    restoreNavigation:route=>{const candidate=String(route?.actorId||'');selected=actors().some(a=>a.id===candidate)?candidate:'';section=['projects','debts','history'].includes(route?.section)?route.section:'projects';query='';},
    action,search,refresh};
}
