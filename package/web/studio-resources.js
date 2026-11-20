import {action, element, openResourceFile, requirements, selectOptions, showScreenshots} from './software-library.js';

const fields = [
  ['name', 'Название', 160], ['version', 'Версия', 70],
  ['category', 'Категория', 90], ['platform', 'Платформа', 100],
  ['website', 'Официальная ссылка', 2048, 'url'], ['telegram', 'Ссылка Telegram', 2048, 'url'],
  ['description', 'Описание и возможности', 4000, 'textarea'],
  ['instructions', 'Инструкция по установке', 8000, 'textarea'],
  ['changes', 'Что изменилось в этой версии', 4000, 'textarea']
];

function field(parent, label, name, type, value = '', max = 0) {
  const wrap = element(parent, 'label', type === 'checkbox' ? 'fvr-check' : '');
  element(wrap, 'span', '', label);
  const input = element(wrap, type === 'textarea' || type === 'select' ? type : 'input');
  input.name = name;
  if (input.tagName === 'INPUT') input.type = type;
  if (type === 'textarea') input.rows = 3;
  if (type === 'checkbox') input.checked = Boolean(value);
  else if (type !== 'select') input.value = value || '';
  if (max) input.maxLength = max;
  return input;
}

function illustratedField(parent, label, name) {
  const field = element(parent, 'div', 'fvr-picture-field');
  const caption = element(field, 'span', '', label);
  caption.id = 'fvr-reserve-' + name + '-label';
  const select = element(field, 'select', 'fvr-picture-native');
  select.name = name;
  select.required = true;
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.dataset.fvVisualized = 'true';

  const trigger = element(field, 'button', 'fvr-button fvr-picture-trigger');
  trigger.type = 'button';
  const current = element(trigger, 'span', 'fvr-picture-value');
  current.id = 'fvr-reserve-' + name + '-value';
  element(trigger, 'span', 'fvr-picture-arrow', '⌄').setAttribute('aria-hidden', 'true');
  trigger.setAttribute('aria-labelledby', caption.id + ' ' + current.id);
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const menu = element(field, 'div', 'fvr-picture-menu');
  menu.id = 'fvr-reserve-' + name + '-options';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-labelledby', caption.id);
  trigger.setAttribute('aria-controls', menu.id);
  menu.hidden = true;
  let options = [];

  function renderChoice(node, option) {
    node.replaceChildren();
    if (option?.[2]) {
      const image = element(node, 'img', 'fvr-picture-thumb');
      image.alt = '';
      image.decoding = 'async';
      if (node !== current) image.loading = 'lazy';
      image.addEventListener('error', () => { image.remove(); }, {once: true});
      image.src = option[2];
    }
    element(node, 'span', '', option?.[1] || label);
  }
  function close() {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }
  function refreshValue() {
    renderChoice(current, options[select.selectedIndex]);
    trigger.removeAttribute('aria-invalid');
  }
  function open() {
    if (select.disabled) return;
    menu.replaceChildren();
    for (const option of options) {
      const row = element(menu, 'button', 'fvr-picture-option');
      row.type = 'button';
      row.tabIndex = -1;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(option[0] === select.value));
      renderChoice(row, option);
      row.addEventListener('click', () => {
        close();
        if (select.value !== option[0]) {
          select.value = option[0];
          select.dispatchEvent(new Event('change', {bubbles: true}));
        }
        trigger.focus();
      });
    }
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    (menu.querySelector('[aria-selected="true"]') || menu.firstElementChild)?.focus();
  }

  trigger.addEventListener('click', () => { if (menu.hidden) open(); else close(); });
  select.addEventListener('change', refreshValue);
  select.addEventListener('invalid', event => {
    event.preventDefault();
    trigger.setAttribute('aria-invalid', 'true');
    if (select.form.querySelector(':invalid:not(form)') === select) trigger.focus();
  });
  field.addEventListener('focusout', event => { if (!field.contains(event.relatedTarget)) close(); });
  field.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault();
      close();
      trigger.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (menu.hidden) { open(); return; }
    const items = Array.from(menu.children);
    const index = items.indexOf(document.activeElement);
    items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  });

  return {
    select,
    setOptions(next, desired) {
      close();
      options = next;
      selectOptions(select, next, next.some(option => option[0] === desired) ? desired : '');
      refreshValue();
    }
  };
}

export function createStudioResources({identity, context, episodeTitle=()=>'', request, put, resolveUrl, reservesChanged}) {
  let owner = null;
  let generation = 0;
  let lastWarm = 0;
  let warmPending = null;
  const pages = {};

  function reset() {
    ++generation;
    owner = null;
    lastWarm = 0;
    warmPending = null;
    for (const key of Object.keys(pages)) delete pages[key];
  }

  function page(kind) {
    const active = identity();
    if (active !== owner) { reset(); owner = active; }
    pages[kind] ||= {panel: null, items: [], selection: '', busy: false, loaded: false, message: ''};
    return pages[kind];
  }

  function announce(view, message) {
    view.message = message || '';
    const status = view.panel?.querySelector('.fvr-status');
    if (status) status.textContent = view.message;
  }

  function reserveEpisodeTitle(reserve) {
    return episodeTitle(reserve.projectId, reserve.episodeId) || reserve.episodeTitle;
  }

  async function load(kind, view) {
    const captured = generation;
    const sequence = view.sequence = (view.sequence || 0) + 1;
    const result = await request(kind);
    if (captured !== generation || owner !== identity() || sequence !== view.sequence) return;
    const items = result[kind] || [];
    const changed = kind === 'reserves' && JSON.stringify(items) !== JSON.stringify(view.items);
    view.items = items;
    view.loaded = true;
    if (kind === 'reserves') lastWarm = Date.now();
    draw(kind, view);
    if (changed) reservesChanged();
  }

  function warm() {
    const view = page('reserves');
    if (!owner || view.busy || warmPending || Date.now() - lastWarm < 45000) return;
    lastWarm = Date.now();
    const pending = load('reserves', view).catch(error => {
      if (view.panel && !view.loaded) announce(view, error.message);
    }).finally(() => { if (warmPending === pending) warmPending = null; });
    warmPending = pending;
  }

  async function run(kind, view, operation) {
    if (view.busy || !owner) return;
    const active = owner;
    const captured = generation;
    const current = () => active === identity() && captured === generation;
    view.busy = true;
    for (const node of view.panel.querySelectorAll('button,input,select,textarea')) node.disabled = true;
    announce(view, 'Подожди…');
    try {
      const message = await operation(current);
      if (current()) announce(view, message);
    } catch (error) {
      if (current()) announce(view, error.message || 'Действие не выполнено.');
    } finally {
      view.busy = false;
      if (current()) draw(kind, view);
    }
  }

  function changeSelection(kind, view, selection) {
    view.selection = selection;
    view.newId = selection === 'new' ? crypto.randomUUID() : null;
    view.edits = null;
    view.message = '';
    draw(kind, view);
  }

  function draw(kind, view) {
    const panel = view.panel;
    if (!panel || view.busy) return;
    panel.replaceChildren();
    const reserve = kind === 'reserves';
    const toolbar = element(panel, 'div', 'fvr-toolbar');
    element(toolbar, 'h1', '', reserve ? 'Запас' : 'Студийное ПО');
    if (owner) {
      action(toolbar, 'Обновить', () => run(kind, view, async () => { await load(kind, view); return ''; }));
      if (view.selection) action(toolbar, 'К списку', () => changeSelection(kind, view, ''));
      else action(toolbar, reserve ? 'Добавить в запас' : 'Добавить программу',
        () => changeSelection(kind, view, 'new'), true);
    }
    const status = element(panel, 'p', 'fvr-status', view.message);
    status.setAttribute('role', 'status');
    if (!owner) {
      announce(view, 'Подключи Fundi Voice Cloud, чтобы открыть вкладку.');
      return;
    }
    const item = view.items.find(entry => entry.id === view.selection);
    if (item || view.selection === 'new') {
      const target = element(panel, 'article', 'fvr-card');
      if (reserve) reserveForm(view, target, item);
      else softwareForm(view, target, item);
      if (item) fileManager(kind, view, target, item);
      return;
    }
    if (!view.loaded) return;
    if (!view.items.length) element(panel, 'p', 'fvr-muted',
      reserve ? 'Резервных назначений пока нет.' : 'Программы ещё не добавлены.');
    const search = element(panel, 'input');
    search.type = 'search';
    search.placeholder = reserve ? 'Найти актёра, проект или персонажа' : 'Найти программу';
    search.setAttribute('aria-label', search.placeholder);
    search.value = view.query || '';
    const grid = element(panel, 'div', 'fvr-grid');
    function showRows() {
      grid.replaceChildren();
      const needle = search.value.trim().toLocaleLowerCase('ru-RU');
      for (const entry of view.items) {
        const labels = reserve ? [entry.character, entry.actorName, entry.projectTitle, reserveEpisodeTitle(entry)] :
          [entry.draft.name, entry.draft.category, entry.draft.platform, entry.draft.version];
        if (!labels.join(' ').toLocaleLowerCase('ru-RU').includes(needle)) continue;
        const card = element(grid, 'article', 'fvr-card');
        element(card, 'h2', '', labels[0]);
        const summary = labels.slice(1).filter(Boolean).join(' · ');
        if (summary) element(card, 'p', 'fvr-muted', summary);
        element(card, 'span', 'fvr-muted', reserve ?
          (entry.confirmed ? 'Актёр подтвердил замену' : 'Ожидает согласия') :
          (entry.published ? 'Опубликовано · ' + entry.published.version : 'Черновик'));
        action(card, 'Открыть', () => changeSelection(kind, view, entry.id));
      }
      if (view.items.length && !grid.children.length)
        element(grid, 'p', 'fvr-muted', 'По этому запросу ничего не найдено.');
    }
    search.addEventListener('input', () => { view.query = search.value; showRows(); });
    showRows();
  }

  function reserveForm(view, target, item) {
    const form = element(target, 'form', 'fvr-form');
    element(form, 'h2', '', item ? item.character + ' · ' + item.actorName : 'Резервное назначение');
    let project, episode, role, actor;
    const {projects, actors} = context();
    if (item) element(form, 'p', 'fvr-muted', [item.projectTitle, reserveEpisodeTitle(item)].filter(Boolean).join(' · '));
    else {
      const group = element(form, 'div', 'fvr-fields');
      const projectsPicker = illustratedField(group, 'Проект', 'project');
      project = projectsPicker.select;
      episode = field(group, 'Серия', 'episode', 'select');
      episode.dataset.fvVisualized = 'true';
      const rolesPicker = illustratedField(group, 'Персонаж', 'role');
      role = rolesPicker.select;
      actor = field(group, 'Резервный актёр', 'actor', 'select');
      episode.required = actor.required = true;
      projectsPicker.setOptions([['', 'Выбери проект'], ...projects.map(p => [p.id, p.title, p.cover])], view.edits?.project);
      function chooseEpisode() {
        const p = projects.find(p => p.id === project.value);
        selectOptions(episode, [['', 'Выбери серию'], ...(p?.episodes || []).map(e => [e.id, e.title])], view.edits?.episode);
        chooseRole();
      }
      function chooseRole() {
        const ep = projects.find(p => p.id === project.value)?.episodes.find(e => e.id === episode.value);
        const options = (ep?.roles || []).map(r => [r.id, r.primaryName ? r.character + ' · ' + r.primaryName : r.character, r.image]);
        rolesPicker.setOptions([['', 'Выбери персонажа'], ...options], view.edits?.role);
        chooseActor();
      }
      function chooseActor() {
        const r = projects.find(p => p.id === project.value)?.episodes.find(e => e.id === episode.value)
          ?.roles.find(r => r.id === role.value);
        selectOptions(actor, [['', 'Выбери актёра'], ...actors.filter(a => !r?.primaryIds.includes(a.id))
          .map(a => [a.id, a.name])], view.edits?.actor);
        actor.dispatchEvent(new Event('change'));
      }
      project.addEventListener('change', chooseEpisode);
      episode.addEventListener('change', chooseRole);
      role.addEventListener('change', chooseActor);
      chooseEpisode();
    }
    const confirmed = field(form, 'Актёр согласился подменить исполнителя', 'confirmed', 'checkbox',
      view.edits?.confirmed ?? item?.confirmed);
    const notes = field(form, 'Заметки', 'notes', 'textarea', view.edits?.notes ?? item?.notes, 2000);
    function remember() {
      view.edits = {project: project?.value, episode: episode?.value, role: role?.value,
        actor: actor?.value, confirmed: confirmed.checked, notes: notes.value};
    }
    form.addEventListener('input', remember);
    form.addEventListener('change', remember);
    const controls = element(form, 'div', 'fvr-actions');
    element(controls, 'button', 'fvr-button fvr-primary', 'Сохранить').type = 'submit';
    if (item) action(controls, 'Удалить запись', () => removeRecord('reserves', view, item));
    form.addEventListener('submit', event => {
      event.preventDefault();
      remember();
      const id = item?.id || view.newId;
      const p = projects.find(p => p.id === project?.value);
      const ep = p?.episodes.find(ep => ep.id === episode?.value);
      const r = ep?.roles.find(r => r.id === role?.value);
      const a = actors.find(a => a.id === actor?.value);
      if (!item && (!r || !a)) return announce(view, 'Выбери персонажа и резервного актёра.');
      const saved = item || {projectId: p.id, episodeId: ep.id, roleId: r.id, actorId: a.id,
        projectTitle: p.title, episodeTitle: ep.title, character: r.character, actorName: a.name};
      const {projectId, episodeId, roleId, actorId, projectTitle, character, actorName} = saved;
      void run('reserves', view, async current => {
        await request('reserves/save', {id, revision: item?.revision || 0,
          details: {projectId, episodeId, roleId, actorId, projectTitle, episodeTitle: reserveEpisodeTitle(saved), character, actorName,
            confirmed: view.edits.confirmed, notes: view.edits.notes}});
        if (current()) {
          view.selection = id;
          view.edits = null;
          await load('reserves', view);
        }
        return 'Резерв сохранён.';
      });
    });
  }

  function softwareForm(view, target, item) {
    const currentDraft = view.edits || item?.draft || {};
    const form = element(target, 'form', 'fvr-form');
    element(form, 'h2', '', item?.draft.name || 'Новая программа');
    if (item?.published) {
      const pending = JSON.stringify(item.draft) !== JSON.stringify(item.published) ||
        item.files.some(file => file.ready && file.listed !== file.published);
      element(form, 'p', 'fvr-muted', 'Опубликована версия ' + item.published.version +
        (pending ? ' · Есть неопубликованные изменения' : '') +
        ' · Скачиваний из каталога: ' + item.downloads);
    } else if (item) element(form, 'p', 'fvr-muted', 'Черновик');
    const grid = element(form, 'div', 'fvr-fields');
    for (const [key, label, max, type = 'text'] of fields) {
      const input = field(type === 'textarea' ? form : grid, label, key, type, currentDraft[key], max);
      if (key === 'name') input.required = true;
    }
    const requirement = field(grid, 'Назначение', 'requirement', 'select');
    selectOptions(requirement, Object.entries(requirements), currentDraft.requirement || 'optional');
    const internal = field(form, 'Наши разработки', 'inHouse', 'checkbox', currentDraft.inHouse);
    const controls = element(form, 'div', 'fvr-actions');
    element(controls, 'button', 'fvr-button fvr-primary', 'Сохранить черновик').type = 'submit';
    function remember() {
      const data = new FormData(form);
      view.edits = Object.fromEntries(fields.map(([key]) => [key, String(data.get(key) || '')]));
      view.edits.requirement = requirement.value;
      view.edits.inHouse = internal.checked;
    }
    form.addEventListener('input', remember);
    form.addEventListener('change', remember);
    function save(publish) {
      if (!form.reportValidity()) return;
      remember();
      const id = item?.id || view.newId;
      const details = view.edits;
      void run('software', view, async current => {
        const receipt = await request('software/save', {id, revision: item?.revision || 0, details});
        if (!current()) return '';
        view.selection = id;
        view.edits = null;
        await load('software', view);
        if (publish && current()) {
          await request('software/publish', {id, revision: receipt.revision});
          await load('software', view);
        }
        return publish ? 'Программа опубликована.' : 'Черновик сохранён.';
      });
    }
    form.addEventListener('submit', event => { event.preventDefault(); save(false); });
    action(controls, 'Опубликовать', () => save(true));
    if (item?.published) action(controls, 'Снять с публикации', () => {
      if (!confirm('Скрыть эту программу из каталога актёров?')) return;
      void run('software', view, async () => {
        await request('software/unpublish', {id: item.id, revision: item.revision});
        await load('software', view);
        return 'Публикация снята.';
      });
    });
    else if (item) action(controls, 'Удалить черновик', () => removeRecord('software', view, item));
    if (item?.history.length) {
      const history = element(target, 'details');
      element(history, 'summary', '', 'История версий');
      for (const row of item.history) {
        element(history, 'strong', '', row.version);
        if (row.changes) element(history, 'p', 'fvr-text', row.changes);
      }
    }
  }

  function removeRecord(kind, view, item) {
    if (!confirm(kind === 'reserves' ? 'Удалить резервное назначение?' : 'Удалить этот черновик?')) return;
    void run(kind, view, async current => {
      await request(kind + '/remove', {id: item.id, revision: item.revision});
      if (current()) {
        view.selection = '';
        view.edits = null;
        await load(kind, view);
      }
      return 'Запись удалена.';
    });
  }

  function fileManager(kind, view, target, item) {
    const reserve = kind === 'reserves';
    element(target, 'h3', '', reserve ? 'Резервные записи и файлы' : 'Файлы программы');
    const list = element(target, 'div', 'fvr-files');
    for (const file of item.files) {
      const row = element(list, 'div', 'fvr-file');
      element(row, 'strong', '', file.name);
      if (!file.ready) element(row, 'span', 'fvr-muted', 'Загрузка прервана');
      else if (file.ready && !file.screenshot) action(row, 'Скачать', () =>
        openResourceFile(file, resolveUrl, row, message => announce(view, message)));
      if (file.published && !file.listed) element(row, 'span', 'fvr-muted', 'Удалится из каталога после публикации черновика');
      else action(row, file.published ? 'Убрать из черновика' : 'Удалить', () => {
        if (!confirm(file.published ? 'Убрать файл из следующей публикации?' : 'Удалить файл из облака?')) return;
        void run(kind, view, async () => {
          const result = await request('resources/files/remove', {id: file.id});
          await load(kind, view);
          return result.removed ? 'Файл удалён.' : 'Файл убран из черновика.';
        });
      });
    }
    showScreenshots(target, item.files.filter(file => file.ready && file.screenshot && file.listed), resolveUrl);
    const picks = element(target, 'div', 'fvr-actions');
    function choose(screenshot) {
      const input = element(picks, 'input');
      input.type = 'file';
      input.hidden = true;
      if (screenshot) input.accept = '.png,.jpg,.jpeg,.gif,.webp';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return;
        void run(kind, view, async current => {
          const id = crypto.randomUUID();
          try {
            const session = await request('resources/files/begin', {id, parentId: item.id,
              kind: reserve ? 'reserve' : 'software', name: file.name, size: file.size, screenshot});
            for (let start = 0, number = 1; start < file.size && !session.ready; start += session.partSize, number++) {
              if (!current()) return '';
              if (!session.completedParts.includes(number)) {
                const part = file.slice(start, start + session.partSize);
                await put(id, number, part);
              }
              announce(view, 'Загрузка ' + Math.min(100, Math.round((start + session.partSize) / file.size * 100)) + '%');
            }
            if (!current()) return '';
            await request('resources/files/complete', {id});
            await load(kind, view);
            return 'Файл загружен.';
          } catch (error) {
            if (current()) await load(kind, view).catch(() => {});
            throw error;
          }
        });
      }, {once: true});
      input.addEventListener('cancel', () => input.remove(), {once: true});
      input.click();
    }
    action(picks, reserve ? 'Загрузить запись или файл' : 'Загрузить файл', () => choose(false));
    if (!reserve) action(picks, 'Загрузить скриншот', () => choose(true));
  }

  return {
    mount(root, kind) {
      if (!root) return;
      const view = page(kind);
      const fresh = !view.panel;
      if (fresh) view.panel = element(null, 'section', 'fv-resources');
      root.replaceChildren(view.panel);
      if (!fresh) return;
      draw(kind, view);
    if (owner && !view.loaded && (kind !== 'reserves' || !warmPending))
        void run(kind, view, async () => { await load(kind, view); return ''; });
    },
    openReserve(id) {
      const view = page('reserves');
      changeSelection('reserves', view, id);
    },
    forRole(projectId, episodeId, roleId) {
      return page('reserves').items.filter(r => r.projectId === projectId && r.episodeId === episodeId && r.roleId === roleId);
    },
    warm,
    reset
  };
}
