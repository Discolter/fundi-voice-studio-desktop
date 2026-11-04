// Regression tests for task title quick templates shared by episode and My Tasks forms.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {seedState,normalizeState,normalizeTaskTemplates,addTaskTemplate,removeTaskTemplate,DEFAULT_TASK_TEMPLATES}
  from '../package/web/core.js';

const defaults=['Записать','Дописать','Обработать','Проверить уровни голосов'];
assert.deepEqual(DEFAULT_TASK_TEMPLATES,defaults);
assert.deepEqual(seedState().settings.taskTemplates,defaults);
assert.deepEqual(normalizeTaskTemplates(undefined),defaults,'Old workspaces receive starter phrases');
assert.deepEqual(normalizeTaskTemplates([]),[],'An intentionally emptied list stays empty');
assert.deepEqual(normalizeTaskTemplates([' Обработать ', 'обработать',' Проверить  уровни голосов ',null,15,'']),
  ['Обработать','Проверить уровни голосов'],'Trim, deduplicate and reject non-strings');
const added=addTaskTemplate(['Записать'],'Проверить уровни голосов');
assert.deepEqual(added,['Записать','Проверить уровни голосов']);
assert.deepEqual(removeTaskTemplate(added,0),['Проверить уровни голосов']);
assert.deepEqual(removeTaskTemplate(added,500),added);
assert.throws(()=>addTaskTemplate(added,'  '),/впиши текст/);
assert.throws(()=>addTaskTemplate(added,' проверить уровни голосов '),/уже сохранена/);
assert.throws(()=>addTaskTemplate(added,'a'.repeat(501)),/500/);
assert.throws(()=>addTaskTemplate(Array.from({length:60},(_,i)=>'Шаблон '+i),'Ещё один'),/60/);
const oldWorkspace=seedState();delete oldWorkspace.settings.taskTemplates;
assert.deepEqual(normalizeState(oldWorkspace).settings.taskTemplates,defaults);
const customized=seedState();customized.settings.taskTemplates=['Записать реплики','Миксовать голоса'];
assert.deepEqual(normalizeState(customized).settings.taskTemplates,customized.settings.taskTemplates,
  'Templates survive normalizing/restoring Studio state');
customized.settings.taskTemplates=[];
assert.deepEqual(normalizeState(customized).settings.taskTemplates,[],
  'Deleting all templates stays deleted after restart');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=readFileSync(resolve(root,'package/web/app.js'),'utf8');
const css=readFileSync(resolve(root,'package/web/compact.css'),'utf8');
const form=app.slice(app.indexOf('function taskForm('),app.indexOf('function roleForm('));
assert.ok(form.includes('taskTemplateField(t.title)'), 'Both task entry points must use the shared template picker');
for(const fragment of [
  'function taskTemplateMenuHTML(){','function taskTemplateField(title){','input(\'title\',title',
  'id="task-title-input"','data-action="task-template-add"','data-action="task-template-toggle"',
  'data-action="task-template-use"','data-action="task-template-remove"',
  'case \'task-template-add\':','case \'task-template-toggle\':',
  'case \'task-template-use\':','case \'task-template-remove\':',
  'state.settings.taskTemplates=addTaskTemplate(','persist();updateTaskTemplateMenu()'
])assert.ok(app.includes(fragment),'Missing task template UI/action: '+fragment);
assert.ok(app.includes("case 'new-task':taskForm(p?.id,ep?.id);break;"));
assert.ok(app.includes("case 'edit-task':taskForm(p.id,ep.id,d.item);break;"));
for(const fragment of ['.task-template-line','.task-template-menu[hidden]','.task-template-option',
  '.task-template-button:focus-visible','.task-template-remove:hover'])
  assert.ok(css.includes(fragment),'Missing template styling: '+fragment);
console.log('PASS: saved task phrase templates, legacy workspaces, duplicate guard and shared form UI');
