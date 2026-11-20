import {CALENDAR_LINK_TYPES, calendarLinkKey, normalizeCalendarLink} from './core.js';
import {element} from './software-library.js';

function button(parent, className, label, run) {
  const control = element(parent, 'button', className, label);
  control.type = 'button';
  control.addEventListener('click', run);
  return control;
}

export function mountCalendarLinkPicker(root, {links, loadTargets, describeLink}) {
  const selected = [...links];
  let request = 0;
  let refreshTargets = () => {};
  const heading = element(root, 'h3', '', 'Привязки');
  heading.id = 'calendar-link-heading';
  const attached = element(root, 'div', 'calendar-link-attached');
  const categoryField = element(root, 'div', 'field calendar-link-category');
  const categoryLabel = element(categoryField, 'label', '', 'Тип привязки');
  const category = element(categoryField, 'select');
  category.id = 'calendar-link-kind';
  categoryLabel.htmlFor = category.id;
  for (const [type, label] of Object.entries(CALENDAR_LINK_TYPES))
    element(category, 'option', '', label).value = type;
  const controls = element(root, 'div', 'calendar-link-controls');

  function updateAttached() {
    attached.replaceChildren();
    for (const link of selected) {
      const {label, detail, available} = describeLink(link);
      const chip = element(attached, 'div', 'calendar-link-chip');
      const text = element(chip, 'div');
      element(text, 'small', '', CALENDAR_LINK_TYPES[link.kind]);
      element(text, 'strong', '', label);
      if (detail) text.title = detail;
      if (available === false) element(text, 'small', '', 'Связь сейчас недоступна');
      const remove = button(chip, 'icon-btn calendar-link-remove', '×', () => {
        selected.splice(selected.indexOf(link), 1);
        updateAttached();
        refreshTargets();
        category.focus();
      });
      remove.setAttribute('aria-label', 'Убрать привязку ' + label);
    }
  }

  function addLink(link) {
    const normalized = normalizeCalendarLink(link);
    if (!normalized) return false;
    const key = calendarLinkKey(normalized);
    if (selected.some(item => calendarLinkKey(item) === key)) return false;
    selected.push(normalized);
    updateAttached();
    return true;
  }

  function labeledInput(parent, caption, type) {
    const label = element(parent, 'label', 'field', caption);
    const input = element(label, 'input');
    input.type = type;
    input.autocomplete = 'off';
    return input;
  }

  function openUrlFields() {
    const url = labeledInput(controls, 'Адрес веб-ссылки', 'text');
    url.inputMode = 'url';
    url.maxLength = 2048;
    url.placeholder = 'https://';
    const name = labeledInput(controls, 'Название ссылки (необязательно)', 'text');
    name.maxLength = 200;
    const status = element(controls, 'p', 'small muted calendar-link-status');
    status.setAttribute('role', 'status');
    function attachUrl() {
      const link = normalizeCalendarLink({kind: 'url', url: url.value, label: name.value});
      if (!link) {
        status.textContent = 'Введи адрес, который начинается с https:// или http://.';
        url.focus();
      } else if (!addLink(link)) {
        status.textContent = 'Эта ссылка уже привязана.';
      } else {
        url.value = name.value = '';
        status.textContent = '';
        url.focus();
      }
    }
    button(controls, 'btn ghost small', 'Добавить ссылку', attachUrl);
    for (const field of [url, name]) field.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); attachUrl(); }
    });
  }

  async function openTargets(kind) {
    const sequence = ++request;
    refreshTargets = () => {};
    controls.replaceChildren();
    if (kind === 'url') { openUrlFields(); return; }
    const search = labeledInput(controls, 'Поиск по названию', 'search');
    search.placeholder = kind === 'actor' ? 'Имя или @ник' : 'Название или проект';
    const status = element(controls, 'p', 'small muted calendar-link-status', 'Загружаем список…');
    status.setAttribute('role', 'status');
    const list = element(controls, 'div', 'calendar-link-results');
    let targets = [];
    let loaded = false;
    function refresh() {
      if (!loaded) return;
      list.replaceChildren();
      const keys = new Set(selected.map(calendarLinkKey));
      const words = search.value.trim().toLocaleLowerCase('ru-RU').split(/\s+/).filter(Boolean);
      const matches = targets.filter(item => {
        if (keys.has(calendarLinkKey(item))) return false;
        const text = [item.label, item.detail].join(' ').toLocaleLowerCase('ru-RU');
        return words.every(word => text.includes(word));
      });
      status.textContent = matches.length === 0 ? 'Нет доступных результатов.' :
        matches.length > 8 ? 'Уточни поиск, чтобы увидеть нужную привязку.' : '';
      for (const item of matches.slice(0, 8)) {
        const pick = button(list, 'calendar-link-result', '', () => {
          if (addLink(item)) refresh();
          search.focus();
        });
        pick.setAttribute('aria-label', 'Привязать ' + [item.label,item.detail].filter(Boolean).join(' · '));
        const copy = element(pick, 'span', 'calendar-link-result-name');
        element(copy, 'strong', '', item.label);
        if (item.detail) element(copy, 'small', '', item.detail);
        element(pick, 'span', 'calendar-link-plus', '+').setAttribute('aria-hidden','true');
      }
    }
    search.addEventListener('input', refresh);
    search.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); list.querySelector('button')?.focus(); }
    });
    refreshTargets = refresh;
    try {
      const items = await loadTargets(kind);
      if (sequence !== request || !root.isConnected) return;
      targets = items.sort((a,b)=>a.label.localeCompare(b.label,'ru')||
        (a.detail||'').localeCompare(b.detail||'','ru'));
      loaded = true;
      refresh();
    } catch (error) {
      if (sequence === request && root.isConnected)
        status.textContent = error.message || 'Список привязок временно недоступен.';
    }
  }

  const chooseType = () => { void openTargets(category.value); };
  category.addEventListener('change', chooseType);
  updateAttached();
  chooseType();
  return () => selected;
}
