/* Site management panel for FundiVoice Studio.
   Viewer data lives in a separate Supabase project, NOT in Studio/Actor's DB.
   Uses a signed-in Viewer admin JWT with RLS. No service-role credentials. */
export function createSiteManager({toast, escapeHTML, rerender}) {
  const esc = escapeHTML;
  const CFG = 'fundivoice-viewer-admin-config-v1';
  const TOKEN = 'fundivoice-viewer-admin-session-v1';
  const state = {tab:'releases',releases:[],episodes:[],news:[],users:[],usersError:'',userQuery:'',notifications:[],notificationsError:'',selectedNotice:'',ratingEpisodes:[],ratingProjects:[],ratingsError:'',selectedRelease:'',selectedEpisode:0,selectedNews:'',loading:false,loaded:false,error:'',configOpen:false};
  let config = {};
  let session = null;
  try {config = JSON.parse(localStorage.getItem(CFG)||'{}');} catch {}
  try {session = JSON.parse(sessionStorage.getItem(TOKEN)||'null');} catch {}

  const field = (label,name,value='',type='text',attrs='') =>
    '<label class="sm-field"><span>'+esc(label)+'</span><input class="sm-input" name="'+esc(name)+'" type="'+type+'" value="'+esc(value??'')+'" '+attrs+'></label>';
  const area = (label,name,value='') =>
    '<label class="sm-field sm-wide"><span>'+esc(label)+'</span><textarea class="sm-input" name="'+esc(name)+'" rows="4">'+esc(value||'')+'</textarea></label>';
  const checkbox = (label,name,on=false) => '<label class="sm-check"><input type="checkbox" name="'+esc(name)+'" '+(on?'checked':'')+'><span>'+esc(label)+'</span></label>';
  const currentRelease = () => state.releases.find(x=>x.id===state.selectedRelease);
  const currentEpisode = () => state.episodes.find(x=>x.release_id===state.selectedRelease && x.episode_number===state.selectedEpisode);
  const currentNews = () => state.news.find(x=>x.id===state.selectedNews);
  const currentNotice = () => state.notifications.find(x=>x.id===state.selectedNotice);
  const date = d => d?new Date(d).toLocaleDateString('ru-RU'):'—';
  const cleanUrl = str => {
    const url = new URL(String(str||'').trim());
    if(url.protocol!=='https:' || !!url.username || !!url.password || url.searchParams.has('apikey')) throw Error('Нужен безопасный HTTPS-адрес Supabase.');
    return url.origin;
  };
  const validPlayer = v => {
    if(!v)return true;
    try {const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&['kodik.info','kodik.to','kodikonline.com','kodik.biz','kodik.cc'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}
    catch{return false;}
  };
  function credentials(){
    if(!config.url||!config.key||!session?.access_token) throw Error('Войди в аккаунт администратора зрительского сайта.');
    if(session.expires_at && Date.now()/1000>session.expires_at) throw Error('Сессия истекла. Войди снова.');
  }
  async function request(endpoint,method='GET',body,headers={}){
    if(!config.url||!config.key)throw Error('Укажи адрес и публичный ключ Supabase для зрителей.');
    const opts = {
      method,
      headers: {
        apikey:config.key,
        ...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{}),
        Accept:'application/json',
        ...(body===undefined?{}:{'Content-Type':'application/json'}),
        ...headers
      }
    };
    if(body!==undefined)opts.body=JSON.stringify(body);
    let response;
    try { response=await fetch(config.url+endpoint,opts); }
    catch(err){
      if(err instanceof TypeError)throw Error('Не удалось связаться с Supabase. Проверь подключение к интернету, URL проекта и разрешения сети приложения.');
      throw err;
    }
    const raw=await response.text();
    let data;
    try {data=raw?JSON.parse(raw):null;}catch{data=raw;}
    if(!response.ok)throw Error((typeof data==='object' && data?.message) || (typeof data==='object'&&data?.error_description) || 'Ошибка сервера ('+response.status+')');
    return data;
  }
  const table = (name,filter='') => request('/rest/v1/'+name+'?select=*'+filter);
  async function signIn(fd){
    const url=cleanUrl(fd.get('url')),key=String(fd.get('key')||'').trim();
    const email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||'');
    if(!url.includes('supabase.co') && !confirm('Домен Supabase нестандартный. Продолжить подключение?'))return;
    if(!key||!email||!password)throw Error('Заполни адрес, публичный ключ, email и пароль.');
    // Reject privileged/secret keys even if accidentally pasted by the operator.
    const isPublishable=key.startsWith('sb_publishable_')||(()=>{
      try{
        const encoded=key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
        return JSON.parse(atob(encoded)).role==='anon';
      }catch{return false;}
    })();
    if(!isPublishable)throw Error('Вводи только публичный publishable/anon key. Secret/service_role запрещён.');

    config={url,key}; // Never persist the password.
    const login=await request('/auth/v1/token?grant_type=password','POST',{email,password});
    if(!login?.access_token)throw Error('Supabase не выдал токен для входа.');
    session={access_token:login.access_token,expires_at:Math.floor(Date.now()/1000)+(login.expires_in||3600),user:login.user?.id};
    const admins=await request('/rest/v1/viewer_admins?select=user_id&user_id=eq.'+encodeURIComponent(session.user));
    if(!admins?.length){session=null;throw Error('Этот аккаунт не добавлен в viewer_admins. Включи права через SQL Editor отдельной базы Viewer.');}
    localStorage.setItem(CFG,JSON.stringify(config));
    sessionStorage.setItem(TOKEN,JSON.stringify(session));
    state.configOpen=false;await refresh();
    toast('Режим сайта подключён. Публикации синхронизируются с Viewer Supabase.');
  }
  async function refresh(){
    if(!session?.access_token)return;
    state.loading=true;state.error='';rerender();
    try{
      credentials();
      const admins=await request('/rest/v1/viewer_admins?select=user_id&user_id=eq.'+encodeURIComponent(session.user));
      if(!admins?.length)throw Error('Недостаточно прав администратора.');
      const [releases,episodes,news,users]=await Promise.all([
        table('viewer_releases','&order=created_at.desc'),
        table('viewer_episodes','&order=release_id.asc,episode_number.asc'),
        table('viewer_news','&order=created_at.desc'),
        table('viewer_profiles','&order=created_at.desc&limit=100')
      ]);
      state.releases=releases||[];state.episodes=episodes||[];state.news=news||[];state.users=users||[];
      // Read private contact email ONLY via the administrator-gated RPC.
      // Public profiles never contain email addresses.
      const [directory,notices]=await Promise.allSettled([
        request('/rest/v1/rpc/viewer_admin_user_directory','POST',{}),
        table('viewer_notifications','&order=created_at.desc&limit=100')
      ]);
      if(directory.status==='fulfilled'){
        state.users=directory.value||[];state.usersError='';
      }else{
        state.usersError='Email и расширенная информация недоступны. Выполни миграцию уведомлений и контактов в Supabase Viewer.';
      }
      if(notices.status==='fulfilled'){
        state.notifications=notices.value||[];state.notificationsError='';
      }else{
        state.notifications=[];state.notificationsError='Таблица уведомлений пока не создана. Выполни SQL-миграцию в Supabase Viewer.';
      }
      const [epStats,projectStats]=await Promise.allSettled([
        request('/rest/v1/rpc/viewer_episode_rating_stats','POST',{}),
        request('/rest/v1/rpc/viewer_project_rating_stats','POST',{})
      ]);
      state.ratingEpisodes=epStats.status==='fulfilled'?(epStats.value||[]):[];
      state.ratingProjects=projectStats.status==='fulfilled'?(projectStats.value||[]):[];
      state.ratingsError=epStats.status==='rejected'||projectStats.status==='rejected'?'Статистика пока недоступна. Выполни SQL-миграцию профилей и оценок в отдельном Supabase Viewer.':'';
      state.loaded=true;
    }catch(err){state.error=err.message||String(err);toast('Сайт: '+state.error,true);}
    finally{state.loading=false;rerender();}
  }
  async function save(name,id,data){
    const method=id?'PATCH':'POST';
    const query=id?'?id=eq.'+encodeURIComponent(id):'';
    await request('/rest/v1/'+name+query,method,data,{'Prefer':'return=minimal'});
    await refresh();
  }
  async function storeCover(file,id){
    if(!file)return '';
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3*1024*1024)throw Error('Обложка: JPEG, PNG или WebP, не более 3 МБ.');
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const path=encodeURIComponent(id)+'-'+Date.now()+'.'+ext;
    const res=await fetch(config.url+'/storage/v1/object/viewer-covers/'+path,{
      method:'POST',
      headers:{apikey:config.key,Authorization:'Bearer '+session.access_token,'Content-Type':file.type,'x-upsert':'false'},
      body:file
    });
    if(!res.ok){const data=await res.json().catch(()=>null);throw Error('Ошибка загрузки обложки: '+(data?.message||res.status));}
    return config.url+'/storage/v1/object/public/viewer-covers/'+path;
  }
  function authForm(){
    return '<div class="sm-intro"><h2>Подключение сайта</h2><p>Для публикаций нужна отдельная база Supabase зрительского сайта. Данные Studio и Actor не используются.</p></div>'+
      '<form class="sm-form sm-connect" data-sm-form="connect">'+
      field('Supabase Project URL','url',config.url||'','url','required placeholder="https://...supabase.co"')+
      field('Publishable / anon key (не service_role)','key',config.key||'','text','required autocomplete="off"')+
      field('Email администратора','email','','email','required autocomplete="username"')+
      field('Пароль администратора','password','','password','required autocomplete="current-password"')+
      '<div class="sm-actions"><button class="btn primary" type="submit">Подключить сайт</button></div></form>'+
      '<p class="sm-note">Администратор должен иметь запись в таблице <code>viewer_admins</code>. Ключ service_role вводить сюда запрещено; пароль не сохраняется.</p>';
  }
  const status=(yes)=>'<span class="sm-status '+(yes?'live':'draft')+'">'+(yes?'Опубликовано':'Черновик')+'</span>';
  function releaseList(){
    return '<div class="sm-toolbar"><h2>Релизы <span class="sm-counter">'+state.releases.length+'</span></h2><button type="button" class="btn primary" data-sm-action="new-release">+ Новое аниме</button></div>'+
      '<div class="sm-items">'+(state.releases.length?state.releases.map(x=>'<button type="button" class="sm-item '+(state.selectedRelease===x.id?'current':'')+'" data-sm-action="select-release" data-id="'+esc(x.id)+'"><span class="sm-item-title">'+esc(x.title)+'</span><small>'+esc(x.season)+' · '+esc(x.episode_count)+' серий</small>'+status(x.published)+'</button>').join(''):'<div class="sm-empty">Публикаций пока нет. Создай первую карточку.</div>')+'</div>';
  }
  function releaseForm(){
    const x=currentRelease(),id=x?.id||'';
    return '<div class="sm-editor"><h2>'+(x?'Редактирование релиза':'Новая карточка аниме')+'</h2><form class="sm-form" data-sm-form="release">'+
      field('ID латиницей (не изменяется после создания)','id',id,'text','required maxlength="80" pattern="[a-z0-9][a-z0-9-]{1,79}" '+(x?'readonly':''))+
      field('Название аниме','title',x?.title||'','text','required maxlength="160"')+
      field('Сезон','season',x?.season||'Сезон 1','text','required')+
      field('Жанр','genre',x?.genre||'Аниме')+
      field('Год','year',x?.year||new Date().getFullYear(),'number','min="1900" max="2200"')+
      field('Количество серий','episode_count',x?.episode_count||1,'number','min="1" max="5000" required')+
      field('Статус','status',x?.status||'Релиз')+
      field('Подзаголовок','subtitle',x?.subtitle||'')+
      field('Ссылка на обложку HTTPS','cover_url',x?.cover_url||'','url','placeholder="https://..."')+
      '<label class="sm-field"><span>Или загрузи обложку с компьютера (до 3 МБ)</span><input type="file" name="cover_file" accept="image/png,image/jpeg,image/webp"></label>'+
      area('Описание','description',x?.description||'')+
      checkbox('Опубликовать карточку на сайте', 'published',!!x?.published)+
      '<div class="sm-actions"><button class="btn primary" type="submit">Сохранить релиз</button>'+(x?'<button type="button" class="btn ghost" data-sm-action="delete-release">Удалить</button>':'')+'</div></form>'+
      (x?episodeEditor():'<p class="sm-note">После сохранения карточки появится редактор серий и ссылок на плеер.</p>')+'</div>';
  }
  function episodeEditor(){
    const eps=state.episodes.filter(x=>x.release_id===state.selectedRelease);
    const x=currentEpisode();
    return '<div class="sm-episodes"><div class="sm-toolbar"><h3>Серии</h3><button class="btn ghost" type="button" data-sm-action="new-episode">+ Серия</button></div>'+
      '<div class="sm-chips">'+eps.map(ep=>'<button type="button" class="sm-chip '+(state.selectedEpisode===ep.episode_number?'active':'')+'" data-sm-action="select-episode" data-number="'+ep.episode_number+'">№'+ep.episode_number+' '+(ep.published?'●':'○')+'</button>').join('')+'</div>'+
      (state.selectedEpisode?'<form class="sm-form" data-sm-form="episode">'+
        field('Номер серии','episode_number',x?.episode_number||state.selectedEpisode,'number','min="1" max="5000" required '+(x?'readonly':''))+
        field('Название серии','title',x?.title||'')+
        field('HTTPS iframe Kodik','player_url',x?.player_url||'','url','placeholder="https://kodik..."')+
        field('Длительность, секунд','duration_seconds',x?.duration_seconds||0,'number','min="0" max="86400"')+
        checkbox('Опубликовать серию', 'published',!!x?.published)+
        '<div class="sm-actions"><button class="btn primary" type="submit">Сохранить серию</button>'+(x?'<button type="button" class="btn ghost" data-sm-action="delete-episode">Удалить серию</button>':'')+'</div></form>':'<p class="sm-note">Выбери существующую серию или нажми «+ Серия».</p>')+'</div>';
  }
  function newsTab(){
    const x=currentNews();
    return '<div class="sm-columns"><section class="sm-list">'+
      '<div class="sm-toolbar"><h2>Новости</h2><button class="btn primary" type="button" data-sm-action="new-news">+ Новость</button></div>'+
      '<div class="sm-items">'+(state.news.length?state.news.map(n=>'<button class="sm-item '+(state.selectedNews===n.id?'current':'')+'" type="button" data-sm-action="select-news" data-id="'+esc(n.id)+'"><span class="sm-item-title">'+esc(n.title)+'</span><small>'+date(n.created_at)+'</small>'+status(n.published)+'</button>').join(''):'<div class="sm-empty">Новостей пока нет.</div>')+'</div></section>'+
      '<section class="sm-editor"><h2>'+(x?'Редактирование новости':'Новая новость')+'</h2><form class="sm-form" data-sm-form="news">'+
      field('Заголовок','title',x?.title||'','text','required maxlength="160"')+
      field('Категория','category',x?.category||'Новости')+
      area('Текст','body',x?.body||'')+
      checkbox('Опубликовать на сайте', 'published',!!x?.published)+
      '<div class="sm-actions"><button class="btn primary" type="submit">Сохранить новость</button>'+(x?'<button type="button" class="btn ghost" data-sm-action="delete-news">Удалить</button>':'')+'</div></form></section></div>';
  }
  function usersTab(){
    const q=state.userQuery.trim().toLocaleLowerCase('ru');
    const users=state.users.filter(x=>!q||[x.display_name,x.username,x.email,x.user_id].some(v=>String(v||'').toLocaleLowerCase('ru').includes(q)));
    const prefix=config.url+'/storage/v1/object/public/viewer-avatars/';
    const avatar=x=>{
      const url=String(x.avatar_url||'');
      return url.startsWith(prefix)&&url.length>prefix.length
        ?'<img src="'+esc(url)+'" alt="" loading="lazy" referrerpolicy="no-referrer">'
        :'<span>'+esc(String(x.display_name||'З').slice(0,1).toUpperCase())+'</span>';
    };
    return '<div class="sm-toolbar"><h2>Зарегистрированные зрители</h2><span class="sm-counter">Показано: '+users.length+' из '+state.users.length+'</span></div>'+
      '<p class="sm-note">Данные аккаунтов из Supabase Viewer. Email виден только администратору в Studio, не публикуется в профиле зрителя. История и пароли пользователей недоступны.</p>'+
      (state.usersError?'<div class="sm-error">'+esc(state.usersError)+'</div>':'')+
      '<form data-sm-form="user-search" class="sm-user-search"><input type="search" class="sm-input" name="query" placeholder="Имя, @username или email" aria-label="Поиск зрителей" value="'+esc(state.userQuery)+'"><button class="btn ghost" type="submit">Найти</button><button class="btn ghost" type="button" data-sm-action="clear-user-search">Сбросить</button></form>'+
      '<div class="sm-user-table"><div class="sm-user-row sm-user-header"><span>Зритель</span><span>Email и связь</span><span>Регистрация</span></div>'+
      (users.length?users.map(x=>{
        const email=String(x.email||'').trim();
        const name=esc(x.display_name||'Зритель');
        const username=x.username?'<small>@'+esc(x.username)+'</small>':'<small>Юзернейм не указан</small>';
        const emailCell=email?'<span class="sm-user-email">'+esc(email)+'</span><a class="sm-user-contact" href="mailto:'+encodeURIComponent(email)+'" title="Написать письмо зрителю">Написать письмо ↗</a>':'<span class="sm-muted">Почта недоступна</span>';
        return '<div class="sm-user-row"><div class="sm-user-info"><div class="sm-user-avatar">'+avatar(x)+'</div><div><strong>'+name+'</strong>'+username+'</div></div><div class="sm-user-mail">'+emailCell+'</div><span>'+date(x.registered_at||x.created_at)+'</span></div>';
      }).join(''):'<div class="sm-empty">Зрителей с такими данными пока нет.</div>')+'</div>';
  }
  function notificationsTab(){
    const x=currentNotice();
    const cards=state.notifications.map(n=>
      '<button type="button" class="sm-item '+(state.selectedNotice===n.id?'current':'')+'" data-sm-action="select-notice" data-id="'+esc(n.id)+'">'+
      '<span class="sm-item-title">'+esc(n.title)+'</span><small>'+date(n.published_at||n.created_at)+'</small>'+status(n.published)+'</button>'
    ).join('');
    return '<div class="sm-columns"><section class="sm-list">'+
      '<div class="sm-toolbar"><h2>Уведомления</h2><button type="button" class="btn primary" data-sm-action="new-notice">+ Новое</button></div>'+
      '<p class="sm-note">Одно объявление для всех посетителей сайта, включая гостей. Появится в колокольчике сверху после публикации.</p>'+
      (state.notificationsError?'<div class="sm-error">'+esc(state.notificationsError)+'</div>':'')+
      '<div class="sm-items">'+(cards||'<div class="sm-empty">Уведомлений пока нет.</div>')+'</div></section>'+
      '<section class="sm-editor"><h2>'+(x?'Редактирование объявления':'Новое объявление')+'</h2><form class="sm-form" data-sm-form="notice">'+
      field('Заголовок','title',x?.title||'','text','required maxlength="140"')+
      area('Текст уведомления','body',x?.body||'')+
      checkbox('Опубликовать всем пользователям', 'published',!!x?.published)+
      '<div class="sm-actions"><button type="submit" class="btn primary">Сохранить уведомление</button>'+(x?'<button type="button" data-sm-action="delete-notice" class="btn ghost">Удалить</button>':'')+'</div></form>'+
      '<p class="sm-note">Отображается на сайте без перезагрузки при активном соединении. При недоступности Realtime сайт проверяет новые объявления примерно раз в 30 секунд. Это уведомление внутри сайта, не системный push.</p></section></div>';
  }
  function ratingsTab(){
    const rated=state.ratingProjects.filter(p=>Number(p.rating_count)>0).sort((a,b)=>Number(b.average_stars)-Number(a.average_stars)||Number(b.rating_count)-Number(a.rating_count));
    const totalVotes=state.ratingProjects.reduce((sum,p)=>sum+Number(p.rating_count||0),0);
    const globalAvg=totalVotes?state.ratingProjects.reduce((sum,p)=>sum+Number(p.average_stars||0)*Number(p.rating_count||0),0)/totalVotes:null;
    const summary='<div class="sm-rating-summary"><div><small>Оценок зрителей</small><strong>'+totalVotes+'</strong></div><div><small>Оценены проекты</small><strong>'+rated.length+'</strong></div><div><small>Средняя оценка</small><strong>'+(globalAvg===null?'—':globalAvg.toFixed(2)+' / 10')+'</strong></div></div>';
    const card=p=>{
      const r=state.releases.find(x=>x.id===p.release_id);
      const episodes=state.ratingEpisodes.filter(x=>x.release_id===p.release_id).sort((a,b)=>a.episode_number-b.episode_number);
      return '<section class="sm-rating-project"><div class="sm-rating-project-head"><div><h3>'+esc(r?.title||p.release_id)+'</h3><small>'+esc(r?.season||'')+' · '+Number(p.episode_count)+' опубликованных серий</small></div><div class="sm-rating-average"><strong>★ '+Number(p.average_stars).toFixed(2)+'</strong><small>'+Number(p.rating_count)+' оценок</small></div></div><div class="sm-rating-episodes">'+
        episodes.map(e=>'<div class="sm-rating-episode"><span>Серия '+Number(e.episode_number)+'</span><span class="sm-rating-stars">★ '+(Number(e.rating_count)>0?Number(e.average_stars).toFixed(2):'—')+'</span><small>'+Number(e.rating_count)+' оценок</small></div>').join('')+'</div></section>';
    };
    return '<div class="sm-toolbar"><h2>Оценки зрителей</h2><span class="sm-counter">Шкала: 1–10 звёзд · одна оценка от зрителя на серию</span></div>'+
      (state.ratingsError?'<div class="sm-error">'+esc(state.ratingsError)+'</div>':'')+summary+
      '<p class="sm-note">Средняя оценка аниме учитывает все голоса за опубликованные серии. При изменении оценки зрителем статистика пересчитывается в Supabase.</p>'+
      (rated.length?'<div class="sm-rating-list">'+rated.map(card).join('')+'</div>':'<div class="sm-empty">Пока никто не оценил опубликованные серии.</div>');
  }
  function render(tab){
    if(tab)state.tab=tab;
    const top='<div class="sm-top"><div><h1>Управление сайтом</h1><p>Релизы, новости и зрители · отдельная база FundiVoice Viewer</p></div><div class="sm-top-actions">'+
      '<a class="btn ghost" href="https://fundivoice-viewer-test.pages.dev/" target="_blank" rel="noopener noreferrer">Открыть сайт ↗</a>'+
      (session?'<button type="button" class="btn ghost" data-sm-action="refresh">'+(state.loading?'Обновление…':'Обновить')+'</button><button type="button" class="btn ghost" data-sm-action="logout">Выйти</button>':'')+'</div></div>';
    if(!session||state.configOpen)return '<div class="sm-root">'+top+authForm()+'</div>';
    if(state.error&&!state.loaded)return '<div class="sm-root">'+top+'<div class="sm-error">'+esc(state.error)+'</div>'+authForm()+'</div>';
    return '<div class="sm-root">'+top+(state.error?'<div class="sm-error">'+esc(state.error)+'</div>':'')+
      (state.tab==='releases'?'<div class="sm-columns"><section class="sm-list">'+releaseList()+'</section><section>'+releaseForm()+'</section></div>':
        state.tab==='news'?newsTab():state.tab==='notifications'?notificationsTab():state.tab==='ratings'?ratingsTab():usersTab())+'</div>';
  }
  function switchTab(tab){state.tab=tab;rerender();if(session&&!state.loaded&&!state.loading)refresh();}
  function start(){if(session&&!state.loaded&&!state.loading)refresh();}
  document.addEventListener('click',async event=>{
    const btn=event.target.closest('[data-sm-action]');if(!btn)return;
    event.preventDefault();const action=btn.dataset.smAction;
    try {
      if(action==='refresh')return await refresh();
      if(action==='logout'){session=null;sessionStorage.removeItem(TOKEN);state.loaded=false;state.error='';rerender();return;}
      if(action==='new-release'){state.selectedRelease='';state.selectedEpisode=0;rerender();return;}
      if(action==='select-release'){state.selectedRelease=btn.dataset.id;state.selectedEpisode=0;rerender();return;}
      if(action==='new-episode'){const taken=state.episodes.filter(x=>x.release_id===state.selectedRelease).map(x=>x.episode_number);let n=1;while(taken.includes(n))n++;state.selectedEpisode=n;rerender();return;}
      if(action==='select-episode'){state.selectedEpisode=Number(btn.dataset.number);rerender();return;}
      if(action==='clear-user-search'){state.userQuery='';rerender();return;}
      if(action==='new-notice'){state.selectedNotice='';rerender();return;}
      if(action==='select-notice'){state.selectedNotice=btn.dataset.id;rerender();return;}
      if(action==='new-news'){state.selectedNews='';rerender();return;}
      if(action==='select-news'){state.selectedNews=btn.dataset.id;rerender();return;}
      if(action.startsWith('delete-')){
        credentials();
        if(!confirm('Удалить выбранный элемент? Это изменение увидят зрители.'))return;
        const name=action==='delete-release'?'viewer_releases':action==='delete-episode'?'viewer_episodes':action==='delete-notice'?'viewer_notifications':'viewer_news';
        const filter=action==='delete-release'?'id=eq.'+encodeURIComponent(state.selectedRelease):action==='delete-episode'?'release_id=eq.'+encodeURIComponent(state.selectedRelease)+'&episode_number=eq.'+state.selectedEpisode:'id=eq.'+encodeURIComponent(action==='delete-notice'?state.selectedNotice:state.selectedNews);
        await request('/rest/v1/'+name+'?'+filter,'DELETE',undefined,{'Prefer':'return=minimal'});
        if(action==='delete-release')state.selectedRelease='';
        if(action==='delete-episode')state.selectedEpisode=0;
        if(action==='delete-news')state.selectedNews='';
        if(action==='delete-notice')state.selectedNotice='';
        await refresh();toast('Удалено из базы зрительского сайта.');
      }
    }catch(err){toast('Сайт: '+err.message,true);}
  });
  document.addEventListener('submit',async event=>{
    const form=event.target.closest('[data-sm-form]');if(!form)return;
    event.preventDefault();
    const fd=new FormData(form),kind=form.dataset.smForm,btn=form.querySelector('[type="submit"]');
    if(btn)btn.disabled=true;
    try {
      if(kind==='connect'){await signIn(fd);return;}
      if(kind==='user-search'){state.userQuery=String(fd.get('query')||'').trim();rerender();return;}
      credentials();
      if(kind==='release'){
        const current=currentRelease(),id=current?.id||String(fd.get('id')||'').trim();
        if(!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id))throw Error('ID: только латинские строчные буквы, цифры и дефисы.');
        let cover=String(fd.get('cover_url')||'').trim();
        const file=fd.get('cover_file');if(file?.size)cover=await storeCover(file,id);
        if(cover&&cleanUrl(cover)!==new URL(cover).origin)throw Error('Ошибка адреса обложки.');
        const published=fd.has('published');
        const data={
          id,title:String(fd.get('title')||'').trim(),season:String(fd.get('season')||'').trim(),genre:String(fd.get('genre')||'').trim(),
          year:Number(fd.get('year')),episode_count:Number(fd.get('episode_count')),status:String(fd.get('status')||'Релиз'),
          subtitle:String(fd.get('subtitle')||''),description:String(fd.get('description')||''),cover_url:cover,
          published,published_at:published?(current?.published_at||new Date().toISOString()):null,updated_at:new Date().toISOString()
        };
        if(!data.title)throw Error('Название обязательно.');
        if(current){const {id:ignore,...patch}=data;await save('viewer_releases',id,patch);}
        else await save('viewer_releases',null,data);
        state.selectedRelease=id;
      }
      if(kind==='episode'){
        if(!state.selectedRelease)throw Error('Сначала сохрани карточку аниме.');
        const current=currentEpisode(),number=Number(fd.get('episode_number'));
        const player=String(fd.get('player_url')||'').trim();
        if(!validPlayer(player))throw Error('Для плеера разрешены только HTTPS-ссылки Kodik.');
        const published=fd.has('published');
        if(published&&!player)throw Error('Нельзя опубликовать серию без действующего плеера Kodik.');
        const data={release_id:state.selectedRelease,episode_number:number,title:String(fd.get('title')||'').trim(),
          player_url:player,duration_seconds:Number(fd.get('duration_seconds'))||0,published,
          published_at:published?(current?.published_at||new Date().toISOString()):null,updated_at:new Date().toISOString()};
        if(current){
          await request('/rest/v1/viewer_episodes?release_id=eq.'+encodeURIComponent(state.selectedRelease)+'&episode_number=eq.'+number,'PATCH',data,{'Prefer':'return=minimal'});
        }else await request('/rest/v1/viewer_episodes','POST',data,{'Prefer':'return=minimal'});
        await refresh();
      }
      if(kind==='notice'){
        const current=currentNotice(),published=fd.has('published');
        const title=String(fd.get('title')||'').trim(),body=String(fd.get('body')||'').trim();
        if(!title||title.length>140||body.length>2000)throw Error('Заголовок обязателен (до 140 символов), текст до 2000.');
        await save('viewer_notifications',current?.id||null,{
          title,body,published,
          published_at:published?(current?.published_at||new Date().toISOString()):null,
          updated_at:new Date().toISOString()
        });
        if(!current)state.selectedNotice='';
      }
      if(kind==='news'){
        const current=currentNews(),published=fd.has('published'),data={title:String(fd.get('title')||'').trim(),body:String(fd.get('body')||''),
          category:String(fd.get('category')||'Новости'),published,published_at:published?(current?.published_at||new Date().toISOString()):null,updated_at:new Date().toISOString()};
        if(!data.title)throw Error('Укажи заголовок.');
        await save('viewer_news',current?.id||null,data);
        if(!current)state.selectedNews='';
      }
      toast('Сохранено в Supabase. Изменения доступны на зрительском сайте.');
      rerender();
    }catch(err){toast('Сайт: '+(err.message||err),true);}
    finally{if(btn)btn.disabled=false;}
  });
  return {render,switchTab,start};
}
