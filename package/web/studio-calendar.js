import {element} from './software-library.js';
import {CALENDAR_LINK_TYPES} from './core.js';

const eventLabels = {manual: 'Запись', episode: 'Дедлайн серии', task: 'Поручение', vacation: 'Отпуск'};
const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthFormat = new Intl.DateTimeFormat('ru-RU', {month: 'long', year: 'numeric'});
const dayFormat = new Intl.DateTimeFormat('ru-RU', {weekday: 'long', day: 'numeric', month: 'long'});
const shortDateFormat = new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'short', year: 'numeric'});
const eventPlural = new Intl.PluralRules('ru-RU');
const capitalize = text => text[0].toLocaleUpperCase('ru-RU') + text.slice(1);
const calendarDate = (year, month, day) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month, day);
  return date;
};
const dateKey = date => [
  String(date.getFullYear()).padStart(4, '0'),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0')
].join('-');

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T12:00:00');
  return Number.isFinite(date.getTime()) && dateKey(date) === value ? date : null;
}

function seriesLabel(project, episode) {
  return [
    project.season && 'Сезон ' + project.season,
    episode.number && 'Серия ' + episode.number,
    episode.title
  ].filter(Boolean).join(' · ') || 'Серия';
}

function schedule({entries = [], projects = [], tasks, vacations = [], actorName = () => ''}) {
  const dated = new Map(), breaks = [];
  const episodeKey = (projectId, episodeId) => JSON.stringify([projectId, episodeId]);
  const tasksByEpisode = new Map();
  for (const task of tasks || []) {
    const key = episodeKey(task.projectId, task.episodeId);
    if (!tasksByEpisode.has(key)) tasksByEpisode.set(key, []);
    tasksByEpisode.get(key).push(task);
  }

  function addDated(date, event) {
    if (!parseDay(date)) return;
    if (!dated.has(date)) dated.set(date, []);
    dated.get(date).push(event);
  }

  for (const entry of [...entries].sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title, 'ru'))) {
    addDated(entry.date, {kind: 'manual', title: entry.title, entry});
  }
  for (const project of projects) {
    if (project.hidden || project.archived) continue;
    for (const episode of project.episodes || []) {
      const context = {projectId: project.id, episodeId: episode.id};
      const series = seriesLabel(project, episode);
      if (episode.stage !== 'done')
        addDated(episode.due, {...context, kind: 'episode', title: project.title, detail: series});
      const entries = tasks ? tasksByEpisode.get(episodeKey(project.id, episode.id)) : episode.tasks;
      for (const task of entries || []) {
        if (!task.done && task.title) addDated(task.due, {
          ...context, kind: 'task', title: task.title, detail: project.title + ' · ' + series
        });
      }
    }
  }
  for (const vacation of vacations) {
    if (!['active', 'planned'].includes(vacation.status)) continue;
    const start = parseDay(vacation.startDate);
    const end = parseDay(vacation.endDate);
    if (!start || (vacation.endDate && (!end || end < start))) continue;
    const period = end ? shortDateFormat.format(start) + ' — ' + shortDateFormat.format(end) :
      'С ' + shortDateFormat.format(start) + ' · бессрочно';
    breaks.push({
      kind: 'vacation', title: actorName(vacation.actorId) || (vacation.username ? '@' + vacation.username : 'Актёр'),
      detail: period, start: vacation.startDate, end: vacation.endDate
    });
  }
  return day => [
    ...(dated.get(day) || []),
    ...breaks.filter(vacation => vacation.start <= day && (!vacation.end || day <= vacation.end))
  ];
}

function button(parent, className, label, run) {
  const control = element(parent, 'button', className, label);
  control.type = 'button';
  control.addEventListener('click', run);
  return control;
}

export function createStudioCalendar({openEvent, editEntry, describeLink, openLink}) {
  let selected = '';

  function mount(root, data) {
    const eventsOn = schedule(data);
    const section = element(null, 'section', 'studio-calendar');
    section.setAttribute('aria-label', 'Календарь студии');
    root.replaceChildren(section);

    function select(day, focus) {
      const key = dateKey(day);
      if (!parseDay(key)) return;
      selected = key;
      draw();
      section.querySelector(focus)?.focus({preventScroll: true});
    }

    function drawEntry(parent, entry) {
      const card = element(parent, 'article', 'studio-calendar-event studio-calendar-entry');
      card.dataset.eventKind = 'manual';
      card.dataset.calendarEntry = entry.id;
      const header = element(card, 'div', 'studio-calendar-entry-header');
      element(header, 'span', 'studio-calendar-type', entry.time || 'Весь день');
      button(header, 'btn ghost small studio-calendar-edit', 'Изменить', () => editEntry(entry.date, entry.id));
      element(card, 'strong', '', entry.title);
      if (entry.notes) element(card, 'p', 'studio-calendar-notes', entry.notes);
      if (!entry.links.length) return;
      const links = element(card, 'div', 'studio-calendar-entry-links');
      for (const link of entry.links) {
        const display = describeLink(link);
        const target = button(links, 'studio-calendar-link', '', () => openLink(link));
        target.disabled = display.available === false;
        target.title = target.disabled ? 'Связь сейчас недоступна' : (display.detail || '');
        element(target, 'small', '', CALENDAR_LINK_TYPES[link.kind]);
        element(target, 'span', '', display.label);
      }
    }

    function draw() {
      const now = new Date();
      const today = dateKey(now);
      if (!selected) selected = today;
      const current = parseDay(selected);
      const year = current.getFullYear(), month = current.getMonth();
      const first = calendarDate(year, month, 1);
      const daysInMonth = calendarDate(year, month + 1, 0).getDate();
      const leading = (first.getDay() + 6) % 7;
      const cellCount = 7 * Math.ceil((leading + daysInMonth) / 7);

      section.replaceChildren();
      const layout = element(section, 'div', 'studio-calendar-layout');
      const calendar = element(layout, 'div', 'studio-calendar-panel');
      const toolbar = element(calendar, 'div', 'studio-calendar-toolbar');
      element(toolbar, 'h2', '', capitalize(monthFormat.format(current)));
      const controls = element(toolbar, 'div', 'studio-calendar-controls');
      const moveMonth = (offset, control) => {
        const last = calendarDate(year, month + offset + 1, 0).getDate();
        select(calendarDate(year, month + offset, Math.min(current.getDate(), last)),
          '[data-calendar-control="' + control + '"]');
      };
      button(controls, 'studio-calendar-control', 'Сегодня', () => select(now, '[data-calendar-control="today"]'))
        .dataset.calendarControl = 'today';
      for (const [key, label, glyph, offset] of [
        ['previous', 'Предыдущий месяц', '‹', -1], ['next', 'Следующий месяц', '›', 1]
      ]) {
        const control = button(controls, 'studio-calendar-control studio-calendar-arrow', glyph, () => moveMonth(offset, key));
        control.dataset.calendarControl = key;
        control.setAttribute('aria-label', label);
      }

      const grid = element(calendar, 'div', 'studio-calendar-grid');
      for (const name of weekdayLabels) element(grid, 'span', 'studio-calendar-weekday', name).setAttribute('aria-hidden', 'true');
      for (let i = 0; i < cellCount; i++) {
        const date = calendarDate(year, month, i - leading + 1), key = dateKey(date);
        const events = eventsOn(key);
        const focusDay = next => select(next, '[data-calendar-day="' + dateKey(next) + '"]');
        const cell = button(grid, 'studio-calendar-day', '', () => focusDay(date));
        cell.dataset.calendarDay = key;
        cell.dataset.outside = String(date.getMonth() !== month);
        cell.setAttribute('aria-pressed', String(key === selected));
        cell.tabIndex = key === selected ? 0 : -1;
        if (key === today) cell.setAttribute('aria-current', 'date');
        const eventCount = {one:'событие', few:'события', many:'событий', other:'события'}[eventPlural.select(events.length)];
        cell.setAttribute('aria-label', dayFormat.format(date) + (events.length ? ' · ' + events.length + ' ' + eventCount : ''));
        cell.addEventListener('keydown', event => {
          const offset = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7}[event.key];
          if (!offset) return;
          event.preventDefault();
          focusDay(calendarDate(date.getFullYear(), date.getMonth(), date.getDate() + offset));
        });
        element(cell, 'span', 'studio-calendar-number', date.getDate());
        const markers = element(cell, 'span', 'studio-calendar-markers');
        markers.setAttribute('aria-hidden', 'true');
        for (const item of events.slice(0, 2)) {
          const marker = element(markers, 'span', 'studio-calendar-marker');
          marker.dataset.eventKind = item.kind;
          element(marker, 'span', '', [item.entry?.time, item.title].filter(Boolean).join(' '));
        }
        if (events.length > 2) element(markers, 'span', 'studio-calendar-more', '+' + (events.length - 2));
      }
      const legend = element(calendar, 'div', 'studio-calendar-legend');
      for (const [kind, label] of Object.entries(eventLabels))
        element(legend, 'span', 'studio-calendar-key', label).dataset.eventKind = kind;

      const agenda = element(layout, 'aside', 'studio-calendar-panel studio-calendar-agenda');
      element(agenda, 'h2', '', capitalize(dayFormat.format(current)));
      button(agenda, 'btn primary small studio-calendar-add', 'Добавить запись', () => editEntry(selected));
      const events = eventsOn(selected);
      if (!events.length) element(agenda, 'p', 'studio-calendar-empty', 'На этот день ничего не запланировано.');
      for (const event of events) {
        if (event.kind === 'manual') { drawEntry(agenda, event.entry); continue; }
        const item = button(agenda, 'studio-calendar-event', '', () => openEvent(event));
        item.dataset.eventKind = event.kind;
        element(item, 'span', 'studio-calendar-type', eventLabels[event.kind]);
        element(item, 'strong', '', event.title);
        element(item, 'span', 'studio-calendar-detail', event.detail);
      }
    }
    draw();
  }
  return {mount,selectDate: date => { if (parseDay(date)) selected = date; }};
}
