import {dateValue, episodeLabel, escapeHTML as e, roleStageName, safeCover, safeRoleImage, stageName} from './core.js';
import {roleVoiceLabel} from './casting-assistant.js';
import {RECOMMENDATION_FILTERS, searchRecommendationEpisodes} from './recommendations.js';

const plural = new Intl.PluralRules('ru');
const dateFormat = new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'short'});
const quantity = (count, one, few, many) =>
  count + ' ' + ({one, few, many}[plural.select(count)] || many);
const rolesCount = count => quantity(count, 'роль', 'роли', 'ролей');
const recordsCount = count => quantity(count, 'запись', 'записи', 'записей');
const linesCount = count => quantity(count, 'реплика', 'реплики', 'реплик');
const tasksCount = count => quantity(count, 'поручение', 'поручения', 'поручений');

function actorLink(actor, name = '') {
  if (!actor) return e(name);
  return `<button type="button" class="rec-text-link" data-qv-open="actor" data-qv-actor="${e(actor.id)}">${e(actor.name)}</button>`;
}

function episodeLink(project, episode, label, tab = 'roles') {
  return `<button type="button" class="btn ghost small" data-action="recommend-open-episode"
    data-project="${e(project.id)}" data-episode="${e(episode.id)}" data-tab="${tab}">${label}</button>`;
}

function dateTag(value, day, label = '') {
  const due = dateValue(value);
  if (!due) return '';
  return `<time class="rec-date${due < day ? ' due-over' : ''}" datetime="${e(due)}">${e(label)}
    ${e(dateFormat.format(new Date(due + 'T12:00:00')))}</time>`;
}

function recordingStatus(row) {
  if (row.actor?.retiredAt) return 'Актёр выбыл · нужна замена';
  if (row.missingActor) return 'Профиль актёра не найден';
  if (row.vacation) return row.vacation.status === 'active' ? 'В отпуске' : 'Отпуск до дедлайна';
  if (row.needsActor) return 'Актёр не назначен';
  return roleStageName(row.role.status);
}

function roleRow(item, row, recording, day) {
  const {role, actor, actorName, voice, workload} = row;
  const image = safeRoleImage(role.image);
  const status = recording ? recordingStatus(row) : roleStageName(role.status);
  const work = recording && workload?.pending
    ? recordsCount(workload.pending) + ' в работе' +
      (workload.pendingLines ? ' · ' + linesCount(workload.pendingLines) : '')
    : '';
  const voiceLabel = row.needsActor && voice ? roleVoiceLabel(voice) + ' голос' : '';
  const reserves = recording ? row.reserves.map(reserve =>
    `<button type="button" class="rec-reserve" data-action="reserve-open" data-id="${e(reserve.id)}">
      Запас · ${e(reserve.name)} <small>${reserve.confirmed ? 'Согласие получено' : 'Ожидает согласия'}</small>
    </button>`).join('') : '';
  const candidates = recording ? row.candidates.map(candidate =>
    `<span>${actorLink(candidate.actor)} <small>${recordsCount(candidate.pending)} в работе</small></span>`).join('') : '';
  const meta = [status, voiceLabel, Number.isInteger(role.lineCount) ? linesCount(role.lineCount) : '']
    .filter(Boolean).map(e).join(' · ');
  return `<li class="rec-role">
    <div class="rec-role-top">
      ${image ? `<img class="rec-role-image" src="${e(image)}" alt="" loading="lazy">` : ''}
      <div class="rec-role-info">
        <button type="button" class="rec-text-link rec-character" data-qv-open="role"
          data-qv-project="${e(item.project.id)}" data-qv-episode="${e(item.episode.id)}"
          data-qv-role="${e(role.id)}">${e(role.character)}</button>
        ${actorName ? `<span class="rec-actor">${actorLink(actor, actorName)}</span>` : ''}
        <div class="rec-role-meta${row.needsActor ? ' needs-actor' : ''}">
          <span>${meta}</span>${dateTag(role.due, day, 'до')}
        </div>
        ${work ? `<small class="rec-load">У актёра ${e(work)}</small>` : ''}
      </div>
    </div>
    ${reserves ? `<div class="rec-options">${reserves}</div>` : ''}
    ${candidates ? `<div class="rec-candidates"><small>Кого спросить</small><div class="rec-options">${candidates}</div></div>` : ''}
  </li>`;
}

function workSection(title, rows, label, renderRow, key, expanded) {
  if (!rows.length) return '';
  const first = rows.slice(0, 3);
  const rest = rows.slice(3);
  return `<section class="rec-work">
    <h3>${title} <span>${e(label(rows.length))}</span></h3>
    <ul>${first.map(renderRow).join('')}</ul>
    ${rest.length ? `<details data-recommendation-group="${e(key)}"${expanded.has(key) ? ' open' : ''}><summary>Ещё ${e(label(rest.length))}</summary>
      <ul>${rest.map(renderRow).join('')}</ul></details>` : ''}
  </section>`;
}

function episodeCard(item, day, icon, expanded) {
  const {project, episode, recording, post, tasks, onlyActor, dates, total, accepted, remaining, nearFinish} = item;
  const cover = safeCover(project.cover);
  const priority = {high: 'Высокий приоритет', low: 'Низкий приоритет'}[project.priority];
  const deadlineTags = [
    dateTag(dates.episode, day, 'Серия до'),
    dateTag(dates.recording, day, 'Запись до'),
    dateTag(dates.post, day, 'Обработка до'),
    dateTag(dates.tasks, day, 'Поручения до')
  ].filter(Boolean).join('');
  const progress = total ? `<div class="rec-progress">
      <span>${remaining ? (plural.select(remaining) === 'one' ? 'Осталась ' : 'Осталось ') + e(rolesCount(remaining)) : 'Все роли приняты'}</span>
      <progress max="${total}" value="${accepted}" aria-label="Роли приняты"></progress>
      <span>${accepted} / ${total}</span>
    </div>` : '';
  const waiting = onlyActor ? `<p class="rec-waiting">Ждём одного актёра · ${actorLink(onlyActor.actor, onlyActor.actorName)}</p>` : '';
  const taskContent = task => `<li class="rec-task"><span>${e(task.title)}</span>${dateTag(task.due, day, 'до')}</li>`;
  const sections = [
    workSection('Запись', recording, rolesCount, row => roleRow(item, row, true, day), episode.id + '|recording', expanded),
    workSection('Проверка и обработка', post, rolesCount, row => roleRow(item, row, false, day), episode.id + '|post', expanded),
    workSection('Поручения', tasks, tasksCount, taskContent, episode.id + '|tasks', expanded)
  ].join('');
  return `<article class="rec-card" data-recommendation-episode="${e(episode.id)}" data-near-finish="${nearFinish}">
    <header class="rec-card-head">
      ${cover ? `<img class="rec-poster" src="${e(cover)}" alt="" loading="lazy">` :
        `<span class="rec-poster rec-placeholder" aria-hidden="true">${icon('folder')}</span>`}
      <div class="rec-identity">
        <h2>${e(project.title)}</h2>
        <div class="rec-episode">${e(episodeLabel(project, episode))}${episode.number && episode.title ? ' · ' + e(episode.title) : ''}</div>
        <div class="rec-stage">${e(stageName(episode.stage))}${priority ? ' · ' + e(priority) : ''}</div>
      </div>
      <div class="rec-card-actions">
        ${episodeLink(project, episode, 'Открыть серию')}
        ${tasks.length ? episodeLink(project, episode, 'Поручения', 'tasks') : ''}
      </div>
    </header>
    ${progress}
    ${deadlineTags ? `<div class="rec-dates">${deadlineTags}</div>` : ''}
    ${waiting}
    ${sections ? `<div class="rec-work-grid">${sections}</div>` : ''}
  </article>`;
}

function freeActorsSection(actors, expanded) {
  if (!actors.length) return '';
  return `<details class="rec-free" data-recommendation-group="free-actors"${expanded.has('free-actors') ? ' open' : ''}>
    <summary>Актёры без ожидающих записей <span>${actors.length}</span></summary>
    <ul>${actors.map(({actor}) => `<li>${actorLink(actor)}${actor.voiceGroup
      ? ` <small>${e(roleVoiceLabel(actor.voiceGroup))} голос</small>` : ''}</li>`).join('')}</ul>
  </details>`;
}

export function renderRecommendationPage({day, episodes, freeActors}, {filter = 'all', query = '', icon, expanded = new Set()} = {}) {
  const found = searchRecommendationEpisodes(episodes, query);
  const activeFilter = RECOMMENDATION_FILTERS.find(option => option.key === filter) || RECOMMENDATION_FILTERS[0];
  const visible = found.filter(activeFilter.matches);
  const emptyText = !episodes.length ? 'В активных сериях пока нет ролей или открытых поручений.' :
    query.trim() ? 'По этому запросу серии не найдены.' : 'По выбранному фильтру серий нет.';
  return `<section class="rec-page">
    <div class="page-head"><h1>Рекомендации</h1></div>
    <div class="rec-filters" role="group" aria-label="Фильтр серий">
      ${RECOMMENDATION_FILTERS.map(option => `<button type="button" class="rec-filter"
        aria-pressed="${activeFilter === option}" data-action="recommend-filter" data-filter-value="${option.key}">
        ${option.label} <span>${found.filter(option.matches).length}</span>
      </button>`).join('')}
    </div>
    ${visible.length ? `<div class="rec-list">${visible.map(item => episodeCard(item, day, icon, expanded)).join('')}</div>`
      : `<div class="rec-empty">${e(emptyText)}</div>`}
    ${freeActorsSection(freeActors, expanded)}
  </section>`;
}
