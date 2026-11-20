import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectRecommendations, RECOMMENDATION_FILTERS, validRecommendationFilter} from '../package/web/recommendations.js';
import {renderRecommendationPage} from '../package/web/recommendations-view.js';
import {withRoleReviews} from '../package/web/core.js';

const actor = (id, name, voiceGroup = 'male', extra = {}) => ({id, name, voiceGroup, ...extra});
const actors = [
  actor('lead', 'Алексей', 'male', {telegram: 'alexey_actor'}),
  actor('free', 'Борис'),
  actor('backup', 'Василий'),
  actor('on-leave', 'Дмитрий'),
  actor('planned', 'Илья'),
  actor('retired', 'Константин', 'male', {retiredAt: '2026-11-04'}),
  actor('another-take', 'Матвей'),
  actor('female', 'Кира', 'female')
];
const role = (id, status, actorId = '', extra = {}) => ({id, character: id, status, actorId, ...extra});
const episode = (id, roles, extra = {}) => ({
  id, number: '1', stage: 'record', roles, tasks: [], ...extra
});
const project = (id, episodes, extra = {}) => ({id, title: id, episodes, ...extra});

const wide = episode('wide', [
  role('Рэй', 'waiting', '', {voiceGender: 'male', due: '2026-11-15'}),
  role('double', 'done', 'another-take', {character: 'РЭЙ'}),
  role('talk', 'recording', 'lead', {lineCount: 70}),
  role('look', 'pickup', 'lead', {lineCount: 15}),
  role('check', 'received', 'retired', {due: '2026-11-16'}),
  role('stop', 'retake', 'retired')
], {due: '2026-11-20', tasks: [{id: 'task1', title: 'Свести звук', due: '2026-11-18'}]});
const short = episode('short', [
  role('finished', 'done', 'lead', {due: '2026-10-01'}),
  role('last', 'retake', 'on-leave', {voiceGender: 'male', lineCount: 0})
]);
const post = episode('post', [
  role('processing', 'processed', 'lead'),
  role('one-more', 'recording', 'lead', {due: '2026-11-12'})
]);
const legacy = episode('legacy', [
  role('old1', 'waiting', '', {actor: 'Игорь'}),
  role('old2', 'retake', '', {actor: 'игорь'})
]);
const allAccepted = episode('all-accepted', [role('done1', 'done', 'female')], {stage: 'edit'});
const lateVacation = episode('planned', [role('soon', 'waiting', 'planned', {due: '2026-11-09'})]);
const state = {actors, projects: [
  project('<Ночной проект>', [wide, post], {priority: 'high', alias: 'Псевдоним'}),
  project('Быстрый', [short, legacy, allAccepted, lateVacation], {priority: 'low'}),
  project('Скрытый', [episode('hidden', [role('hidden-role', 'waiting', 'free')])], {hidden: true}),
  project('Архив', [episode('archived', [role('archived-role', 'waiting', 'free')])], {archived: true}),
  project('Завершённый', [episode('done', [role('done-role', 'waiting', 'free')], {stage: 'done'})]),
  project('Новый', [episode('blank', [])])
]};
const cloud = {vacations: [
  {actorId: 'on-leave', status: 'active'},
  {actorId: 'planned', status: 'planned', startDate: '2026-11-13'}
]};
const reserves = [
  {id: 'backup-open', actorId: 'on-leave', confirmed: true},
  {id: 'backup-yes', actorId: 'backup', confirmed: true},
  {id: 'backup-later', actorId: 'planned', confirmed: false}
];
const options = {now: '2026-11-10', reservesForRole: (_pid, eid, rid) =>
  eid === 'short' && rid === 'last' ? reserves : []};

const original = JSON.stringify({state, cloud, reserves});
const dashboard = collectRecommendations(state, cloud, options);
const {episodes, freeActors} = dashboard;
const byId = id => episodes.find(item => item.episode.id === id);
const filter = key => episodes.filter(RECOMMENDATION_FILTERS.find(item => item.key === key).matches);

assert.equal(JSON.stringify({state, cloud, reserves}), original, 'Recommendations are read-only');
assert.equal(episodes.length, 6);
assert.equal(episodes[0].episode.id, 'all-accepted');
assert.equal(episodes.at(-1).episode.id, 'wide', 'Quick finishes outrank high-priority projects');
assert.equal(byId('wide').remaining, 5);
assert.equal(byId('wide').accepted, 1);
assert.equal(byId('wide').onlyActor, null);
assert.equal(byId('wide').post[0].role.id, 'check', 'Received material still goes to post after an actor leaves');
assert.equal(byId('wide').recording.find(row => row.role.id === 'stop').needsActor, true);
assert.deepEqual(byId('wide').dates, {
  episode: '2026-11-20', recording: '2026-11-15', post: '2026-11-16', tasks: '2026-11-18'
});
assert.equal(byId('post').onlyActor.actor.id, 'lead', 'Separate post work does not add a recording actor');
assert.equal(byId('post').onlyActor.workload.pendingLines, 85);
assert.equal(byId('legacy').onlyActor.actorKey, 'name:игорь');
assert.equal(byId('planned').recording[0].needsActor, false, 'Planned leave after delivery is not a blocker');
assert.ok(filter('quick').every(item => item.remaining <= 2));
assert.ok(filter('single-actor').includes(byId('short')));
assert.ok(filter('casting').includes(byId('wide')));
assert.ok(filter('post').includes(byId('all-accepted')), 'An episode in montage stays in the post-production view');
assert.ok(filter('casting').includes(byId('short')));
assert.ok(!filter('casting').includes(byId('planned')));

const blocked = byId('short').recording[0];
assert.equal(blocked.vacation.status, 'active');
assert.deepEqual(blocked.reserves.map(item => [item.id, item.confirmed]), [
  ['backup-yes', true], ['backup-later', false]
]);
assert.equal(blocked.candidates[0].actor.id, 'free');
assert.ok(blocked.candidates.every(({actor}) => !['on-leave', 'planned', 'retired', 'backup', 'female'].includes(actor.id)));
const unstaffed = byId('wide').recording.find(row => row.role.id === 'Рэй');
assert.ok(unstaffed.candidates.every(({actor}) => actor.id !== 'another-take'));
assert.ok(freeActors.some(({actor}) => actor.id === 'free'), 'Hidden, archived and finished jobs do not occupy the roster');
assert.ok(!freeActors.some(({actor}) => ['lead', 'on-leave', 'retired', 'planned'].includes(actor.id)));

const reviewed = withRoleReviews(state, [{actorId: 'on-leave', roleId: 'last', state: 'accepted', submissionId: 42}]);
const updated = collectRecommendations(reviewed, cloud, options).episodes.find(item => item.episode.id === 'short');
assert.equal(updated.remaining, 0);
assert.equal(updated.onlyActor, null);

const icon = name => '<svg data-icon="' + name + '"></svg>';
const safe = renderRecommendationPage(dashboard, {icon});
assert.match(safe, /&lt;Ночной проект&gt;/);
assert.match(safe, /data-qv-open="role"/);
assert.match(safe, /data-qv-actor="lead"/);
assert.match(safe, /data-action="reserve-open" data-id="backup-yes"/);
assert.match(safe, /data-action="recommend-open-episode"\s+data-project="&lt;Ночной проект&gt;"/);
assert.match(safe, /Согласие получено/);
assert.doesNotMatch(safe, /recommend-(?:hide|snooze|remind)/);
const filtered = renderRecommendationPage(dashboard, {icon, filter: 'quick'});
assert.doesNotMatch(filtered, /data-recommendation-episode="wide"/);
assert.match(filtered, /data-recommendation-episode="short"/);
const searched = renderRecommendationPage(dashboard, {icon, query: 'Псевдоним @alexey_actor'});
assert.match(searched, /data-recommendation-episode="post"/);
assert.doesNotMatch(searched, /data-recommendation-episode="short"/);
assert.equal(validRecommendationFilter('urgent'), 'all');

const app = readFileSync(new URL('../package/web/app.js', import.meta.url), 'utf8');
assert.match(app, /if\(ui\.page==='recommendations'\)return renderRecommendations\(\)/);
assert.match(app, /reservesForRole:studioResources\.forRole/);
assert.match(app, /'detail','recommendations'\]\.includes\(ui\.page\)/);
console.log('PASS: episode-first recommendations, finish order, casting, workload, leave, reserves and navigation');
