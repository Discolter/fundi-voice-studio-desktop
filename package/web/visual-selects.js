// Studio-wide visual dropdowns. The original <select> remains the single source
// of truth for FormData, validation, existing change handlers and stored IDs.
// Only presentation is enhanced; Actor Desktop and the web portal are untouched.
export function installVisualSelects({getActors, actorAvatar, icon}) {
  const roleStages = new Set(['waiting','recording','received','processing','processed','retake','done']);
  const stageIcons = {
    waiting:'clock', recording:'mic', received:'download', processing:'settings',
    processed:'check', retake:'refresh', done:'check', all:'grid',
    'not-in-project':'reaper', prep:'folder', edit:'edit', mix:'settings',
    review:'search', accepted:'check', note:'chat'
  };
  const sortIcons = {original:'list',workload:'users',actor:'users',
    recent:'clock',due:'calendar',name:'list'};
  const detailText = {
    waiting:'Ожидаем запись актёра',recording:'Актёр работает над ролью',
    received:'Запись отправлена в студию',processing:'Идёт обработка аудио',
    processed:'Обработка завершена',retake:'Нужна новая запись',
    done:'Работа принята',accepted:'Работа принята',note:'Замечание актёру',
    all:'Показать все варианты','not-in-project':'Не добавлено в проект REAPER',
    original:'Исходная последовательность',workload:'Сначала самые загруженные',
    actor:'Сортировка по алфавиту',recent:'Недавно открытые проекты',
    due:'Ближайшие сроки первыми',name:'По алфавиту'
  };
  let openDropdown = null;
  let nextId = 0;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if(className) node.className = className;
    if(text !== undefined) node.textContent = text;
    return node;
  };
  function kind(select) {
    if(select.id === 'role-actor-filter' || /actor/i.test(select.name || '')) return 'actor';
    if(select.id === 'role-order' || select.id === 'sort-select') return 'sort';
    if(select.id === 'role-filter' || select.id === 'debt-status-filter' ||
      select.classList.contains('role-status') || select.classList.contains('episode-stage') ||
      ['status','stage'].includes(select.name)) return 'status';
    return 'normal';
  }
  function findActor(value, label) {
    const actors = getActors() || [];
    if(value.startsWith('id:')) return actors.find(a=>a.id === value.slice(3)) || null;
    const direct = actors.find(a=>a.id === value);
    if(direct) return direct;
    if(value === 'all' || value === 'unassigned' || value === '') return null;
    const name = value.startsWith('name:') ? value.slice(5) : label;
    const matches = actors.filter(a=>a.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'));
    return matches.length === 1 ? matches[0] : null;
  }
  function detailsFor(option, type) {
    const value = option.value;
    const label = option.textContent.trim();
    if(type === 'actor') {
      const name = label.replace(/\s+\(\d+\)$/, '');
      const count = label.match(/\((\d+)\)$/);
      const actor = findActor(value, name);
      return {
        label:actor?.name || name,subtitle:actor?.telegram ? '@' + actor.telegram :
          (value === 'all' ? 'Показать все назначения' :
          value === 'unassigned' ? 'Без назначенного актёра' :
          actor ? 'Telegram не указан' : 'Старая запись / без профиля'),
        count:count?.[1] || '', actor, value
      };
    }
    return {label,subtitle:detailText[value] || '',count:'',actor:null,value};
  }
  function artFor(detail, type) {
    const art = element('span','fv-option-art');
    if(type === 'actor') {
      art.classList.add('fv-actor-art');
      if(detail.actor) art.innerHTML = actorAvatar(detail.actor);
      else art.innerHTML = icon(detail.value === 'all' || detail.value === 'unassigned' ? 'users' : 'users');
    } else if(type === 'status' || roleStages.has(detail.value)) {
      art.classList.add('fv-status-art');
      art.dataset.status = detail.value;
      art.innerHTML = icon(stageIcons[detail.value] || 'check');
    } else {
      art.innerHTML = icon(type === 'sort' ? (sortIcons[detail.value] || 'list') : 'file');
    }
    return art;
  }
  function choiceContent(option, type, condensed=false) {
    const d = detailsFor(option,type);
    const content = element('span','fv-choice');
    content.append(artFor(d,type));
    const words = element('span','fv-option-words');
    words.append(element('strong','fv-option-name',d.label));
    if(!condensed && (type === 'actor' || type === 'status' || type === 'sort') && d.subtitle)
      words.append(element('small','fv-option-subtitle',d.subtitle));
    if(condensed && type === 'actor' && d.subtitle)
      words.append(element('small','fv-option-subtitle',d.subtitle));
    content.append(words);
    if(d.count && !condensed) content.append(element('span','fv-choice-count',d.count));
    return content;
  }

  function dismiss(restoreFocus=false) {
    if(!openDropdown) return;
    const current = openDropdown;
    openDropdown = null;
    current.button.setAttribute('aria-expanded','false');
    if(current.menu.matches(':popover-open')) current.menu.hidePopover();
    current.menu.remove();
    if(restoreFocus && current.button.isConnected) current.button.focus();
  }
  function enhance(select) {
    if(select.dataset.fvVisualized || select.multiple || select.size > 1) return;
    select.dataset.fvVisualized = 'true';
    const type = kind(select);
    const wrapper = element('span','fv-select fv-type-' + type);
    if(select.classList.contains('row-select')) wrapper.classList.add('fv-row');
    if(select.classList.contains('role-status')) wrapper.classList.add('fv-role-status');
    if(select.id === 'episode-select') wrapper.classList.add('fv-episode-select');
    if(select.id === 'role-actor-filter') wrapper.classList.add('fv-role-actor-filter');
    if(select.id === 'role-order') wrapper.classList.add('fv-role-order');
    const button = element('button','fv-select-trigger');
    button.type = 'button';
    button.setAttribute('aria-haspopup','dialog');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label',select.getAttribute('aria-label') ||
      (select.labels?.[0]?.textContent || 'Выбрать значение').trim());
    const popupId = 'fv-dropdown-' + (++nextId);
    button.setAttribute('aria-controls',popupId);
    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select, button);
    select.classList.add('fv-native-select');
    select.setAttribute('aria-hidden','true');
    select.tabIndex = -1;

    const redraw = () => {
      const option = select.selectedOptions[0] || select.options[0];
      button.replaceChildren();
      if(option) button.append(choiceContent(option,type,true));
      button.insertAdjacentHTML('beforeend',icon('chevron'));
      button.disabled = select.disabled;
      if(type === 'status') button.dataset.status = option?.value || '';
    };
    redraw();
    select.addEventListener('change',redraw);
    select.addEventListener('focus',()=>button.focus());
    for(const label of select.labels || []) {
      label.addEventListener('click',event=>{
        if(event.target.closest('.fv-select')) return;
        event.preventDefault();
        button.click();
      });
    }
    function choose(option) {
      dismiss(false);
      if(select.value === option.value) {button.focus();return;}
      select.value = option.value;
      redraw();
      // Keep all existing listeners and form submission unchanged.
      select.dispatchEvent(new Event('input',{bubbles:true}));
      select.dispatchEvent(new Event('change',{bubbles:true}));
      if(button.isConnected) button.focus();
    }
    function show(moveFocus=false) {
      if(button.disabled) return;
      if(openDropdown?.button === button) {dismiss(true);return;}
      dismiss(false);
      const menu = element('div','fv-dropdown fv-dropdown-' + type);
      menu.id = popupId;
      menu.setAttribute('role','dialog');
      menu.setAttribute('aria-label',button.getAttribute('aria-label'));
      menu.setAttribute('popover','manual');
      const list = element('div','fv-dropdown-list');
      menu.append(list);
      const selectOptions = Array.from(select.options);
      let searchField = null;
      function drawItems(query='') {
        list.replaceChildren();
        let lastGroup = null, matches = 0;
        for(const option of selectOptions) {
          const d = detailsFor(option,type);
          if(query && !(d.label + ' ' + d.subtitle).toLocaleLowerCase('ru')
            .includes(query.trim().toLocaleLowerCase('ru'))) continue;
          const group = option.parentElement?.tagName === 'OPTGROUP'
            ? option.parentElement.label : '';
          if(group && group !== lastGroup) list.append(element('div','fv-option-group',group));
          lastGroup = group;
          const item = element('button','fv-dropdown-option');
          item.type = 'button';
          item.setAttribute('role','option');
          item.setAttribute('aria-selected',String(option.value === select.value));
          if(option.value === select.value) item.classList.add('selected');
          item.disabled = option.disabled;
          item.append(choiceContent(option,type));
          if(option.value === select.value) item.insertAdjacentHTML('beforeend',icon('check'));
          item.addEventListener('click',()=>choose(option));
          list.append(item);
          matches++;
        }
        if(!matches) list.append(element('p','fv-no-matches','Ничего не найдено'));
      }
      if(type === 'actor' && selectOptions.length > 5) {
        const searchBox = element('div','fv-dropdown-search');
        searchBox.innerHTML = icon('search');
        searchField = element('input','fv-search-input');
        searchField.type = 'search';
        searchField.placeholder = 'Поиск по нику или @username';
        searchField.setAttribute('aria-label','Поиск актёра');
        searchField.addEventListener('input',()=>drawItems(searchField.value));
        searchBox.append(searchField);
        menu.insertBefore(searchBox,list);
      }
      drawItems();
      const host = select.closest('dialog') || document.body;
      host.append(menu);
      try { if(typeof menu.showPopover === 'function') menu.showPopover(); } catch {}
      const rect = button.getBoundingClientRect();
      const width = Math.min(window.innerWidth - 16,
        Math.max(rect.width,type === 'actor' ? 340 : 260));
      const left = Math.max(8,Math.min(rect.left,window.innerWidth - width - 8));
      const roomBelow = window.innerHeight - rect.bottom - 10;
      const above = roomBelow < 260 && rect.top > roomBelow;
      const room = Math.max(110,above ? rect.top - 10 : roomBelow);
      menu.style.width = width + 'px';
      menu.style.left = left + 'px';
      menu.style.maxHeight = Math.min(420,room) + 'px';
      menu.style.top = (above ? Math.max(8,rect.top - Math.min(menu.scrollHeight,Math.min(420,room)) - 6)
        : rect.bottom + 6) + 'px';
      button.setAttribute('aria-expanded','true');
      openDropdown = {button,menu};
      if(searchField && moveFocus) searchField.focus();
      else if(moveFocus) (list.querySelector('.selected') || list.querySelector('button:not(:disabled)'))?.focus();
      menu.addEventListener('keydown',event=>{
        if(event.key === 'Escape') {event.preventDefault();event.stopPropagation();dismiss(true);return;}
        if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const items = Array.from(list.querySelectorAll('button:not(:disabled)'));
        if(!items.length) return;
        const current = items.indexOf(document.activeElement);
        let next = 0;
        if(event.key === 'End') next = items.length-1;
        else if(event.key === 'Home') next = 0;
        else if(event.key === 'ArrowDown') next = (current+1)%items.length;
        else next = current < 0 ? items.length-1 : (current-1+items.length)%items.length;
        items[next].focus();
      });
    }
    button.addEventListener('click',()=>show(false));
    button.addEventListener('keydown',event=>{
      if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();show(true);
      }
    });
  }
  function scan() {
    document.querySelectorAll('#app select:not([data-fv-visualized]), #modal select:not([data-fv-visualized])')
      .forEach(enhance);
  }
  document.addEventListener('pointerdown',event=>{
    if(openDropdown && !openDropdown.menu.contains(event.target) &&
      !openDropdown.button.contains(event.target)) dismiss();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key === 'Escape' && openDropdown) {
      event.preventDefault();event.stopPropagation();dismiss(true);
    }
  },true);
  document.addEventListener('scroll',event=>{
    if(openDropdown && !openDropdown.menu.contains(event.target)) dismiss();
  },true);
  window.addEventListener('resize',()=>dismiss());
  const observer = new MutationObserver(records=>{
    if(records.some(r=>r.addedNodes.length)) scan();
    if(openDropdown && !openDropdown.button.isConnected) dismiss();
  });
  observer.observe(document.body,{subtree:true,childList:true});
  scan();
}
