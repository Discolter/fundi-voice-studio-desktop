import {dateValue, effectiveRoleDue, episodeLabel, episodeRoleActorKey, today as localDay} from './core.js';
import {actorWorkloadRows, IN_REVIEW_STAGES} from './actor-workload.js';
import {roleVoiceFromActor} from './casting-assistant.js';
import {currentVacations} from './vacation-review.js';
import {normalizeAssCharacter} from './ass-role-import.js';

const POST_EPISODE_STAGES = new Set(['edit', 'mix', 'review']);

export const RECOMMENDATION_FILTERS = [
  {key: 'all', label: 'Все серии', matches: () => true},
  {key: 'quick', label: 'До двух ролей', matches: item => item.nearFinish},
  {key: 'single-actor', label: 'Ждём одного актёра', matches: item => !!item.onlyActor},
  {key: 'casting', label: 'Нужен актёр', matches: item => item.recording.some(row => row.needsActor)},
  {key: 'post', label: 'Проверка и обработка', matches: item =>
    item.post.length > 0 || POST_EPISODE_STAGES.has(item.episode.stage)}
];

export function validRecommendationFilter(value) {
  return RECOMMENDATION_FILTERS.some(filter => filter.key === value) ? value : 'all';
}

const PRIORITY = {high: 0, normal: 1, low: 2};
const names = new Intl.Collator('ru', {sensitivity: 'base', numeric: true});
const dateOrder = (a, b) => (a || '9999-12-31').localeCompare(b || '9999-12-31');
const nextDate = values => values.map(dateValue).filter(Boolean).sort()[0] || '';

function activeProjects(state) {
  return (state.projects || []).filter(project => !project.archived && !project.hidden)
    .map(project => ({
      ...project,
      episodes: (project.episodes || []).filter(episode => episode.stage !== 'done')
    }));
}

function recordingRole(state, project, episode, row, context) {
  const {role, actor} = row;
  const {day, vacations, workloads, roster, pools, assignedByCharacter, reservesForRole} = context;
  const vacation = vacations.get(actor?.id);
  const due = effectiveRoleDue(role, episode);
  const vacationConflict = vacation?.status === 'active' ||
    (vacation?.startDate && vacation.startDate <= (due && due > day ? due : day));
  const missingActor = !!role.actorId && !actor;
  const actorKey = missingActor || actor?.retiredAt ? '' :
    actor ? 'id:' + actor.id : episodeRoleActorKey(state, role);
  const needsActor = !!(actorKey === 'unassigned' || !actorKey || vacationConflict);
  const voice = roleVoiceFromActor(role, actor);
  const reserves = reservesForRole(project.id, episode.id, role.id)
    .filter(entry => entry.id && entry.actorId !== role.actorId)
    .map(entry => ({
      id: entry.id,
      name: roster.get(entry.actorId)?.name || entry.actorName || 'Актёр',
      actorId: entry.actorId,
      confirmed: entry.confirmed === true
    }));
  reserves.sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || names.compare(a.name, b.name));

  const candidates = [];
  if (needsActor) {
    const assigned = assignedByCharacter.get(normalizeAssCharacter(role.character)) || new Set();
    const reserved = new Set(reserves.map(entry => entry.actorId));
    // Use existing workload metrics to rank the roster once for the whole dashboard.
    for (const candidate of pools[voice] || pools.all) {
      if (assigned.has(candidate.actor.id) || reserved.has(candidate.actor.id)) continue;
      candidates.push(candidate);
      if (candidates.length === 3) break;
    }
  }

  return {
    ...row, actorKey, needsActor, missingActor, voice, reserves, candidates,
    vacation: vacationConflict ? vacation : null, workload: workloads.get(actor?.id)
  };
}

function episodeRecommendation(state, project, episode, context) {
  const roles = episode.roles || [];
  const tasks = (episode.tasks || []).filter(task => !task.done);
  if (!roles.length && !tasks.length && !POST_EPISODE_STAGES.has(episode.stage)) return null;

  const assignedByCharacter = new Map();
  for (const role of roles) {
    const key = normalizeAssCharacter(role.character);
    if (!key || !role.actorId) continue;
    if (!assignedByCharacter.has(key)) assignedByCharacter.set(key, new Set());
    assignedByCharacter.get(key).add(role.actorId);
  }

  const recording = [];
  const post = [];
  const recordingContext = {...context, assignedByCharacter};
  for (const role of roles) {
    if (role.status === 'done') continue;
    const actor = context.roster.get(role.actorId);
    const row = {role, actor, actorName: actor?.name || role.actor || ''};
    if (IN_REVIEW_STAGES.includes(role.status)) post.push(row);
    else recording.push(recordingRole(state, project, episode, row, recordingContext));
  }
  recording.sort((a, b) => Number(b.needsActor) - Number(a.needsActor) ||
    dateOrder(a.role.due, b.role.due) || names.compare(a.role.character, b.role.character));
  post.sort((a, b) => dateOrder(a.role.due, b.role.due) || names.compare(a.role.character, b.role.character));
  tasks.sort((a, b) => dateOrder(a.due, b.due) || names.compare(a.title, b.title));

  const first = recording[0];
  const onlyActor = first?.actorKey && first.actorKey !== 'unassigned' &&
    recording.every(row => row.actorKey === first.actorKey) ? first : null;
  const remaining = recording.length + post.length;
  const dates = {
    episode: dateValue(episode.due),
    recording: nextDate(recording.map(row => row.role.due)),
    post: nextDate(post.map(row => row.role.due)),
    tasks: nextDate(tasks.map(task => task.due))
  };
  return {
    project, episode, recording, post, tasks, onlyActor, dates,
    due: nextDate(Object.values(dates)),
    total: roles.length, accepted: roles.length - remaining, remaining,
    nearFinish: roles.length > 0 && remaining <= 2
  };
}

export function collectRecommendations(state, cloud = {}, {
  now = localDay(), reservesForRole = () => []
} = {}) {
  const day = now instanceof Date
    ? [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
    : dateValue(now) || localDay();
  const projects = activeProjects(state);
  const vacations = currentVacations(cloud.vacations);
  const roster = new Map((state.actors || []).map(actor => [actor.id, actor]));
  const workloads = new Map(actorWorkloadRows({...state, projects}).map(item => [item.actor.id, item]));
  const available = [...workloads.values()].filter(item => !vacations.has(item.actor.id))
    .sort((a, b) => a.score - b.score || a.pending - b.pending ||
      a.pendingLines - b.pendingLines || a.pendingUnknown - b.pendingUnknown ||
      names.compare(a.actor.name, b.actor.name));
  const pools = {
    all: available,
    male: available.filter(item => item.actor.voiceGroup === 'male'),
    female: available.filter(item => item.actor.voiceGroup === 'female')
  };
  const context = {day, vacations, roster, workloads, pools, reservesForRole};
  const episodes = projects.flatMap(project => project.episodes.map(episode =>
    episodeRecommendation(state, project, episode, context))).filter(Boolean);

  episodes.sort((a, b) => Number(b.nearFinish) - Number(a.nearFinish) ||
    (a.nearFinish ? a.remaining - b.remaining : 0) ||
    (PRIORITY[a.project.priority] ?? PRIORITY.normal) - (PRIORITY[b.project.priority] ?? PRIORITY.normal) ||
    dateOrder(a.due, b.due) || names.compare(a.project.title, b.project.title) ||
    names.compare(a.episode.number || a.episode.title, b.episode.number || b.episode.title));

  return {day, episodes, freeActors: available.filter(item => item.pending === 0)};
}

export function searchRecommendationEpisodes(episodes, query) {
  const words = query.trim().toLocaleLowerCase('ru').replace(/@/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) return episodes;
  return episodes.filter(item => {
    const {project, episode, recording, post, tasks} = item;
    const terms = [project.title, project.alias, episodeLabel(project, episode), episode.title,
      ...[...recording, ...post].flatMap(row => [row.role.character, row.actorName, row.actor?.telegram]),
      ...tasks.map(task => task.title)].join(' ').toLocaleLowerCase('ru');
    return words.every(word => terms.includes(word));
  });
}
