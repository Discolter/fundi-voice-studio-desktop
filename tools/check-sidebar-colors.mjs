import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../package/',import.meta.url);
const css=readFileSync(new URL('web/sidebar-colors.css',base),'utf8');
const html=readFileSync(new URL('web/index.html',base),'utf8');
const host=readFileSync(new URL('LocalServer.cs',base),'utf8');
const app=readFileSync(new URL('web/app.js',base),'utf8');
const items=['projects','mytasks','debts','casting','actors','workload','actorportal',
  'review','recommendations','settings','recovery','vacations'];
for(const name of items){
  assert.ok(app.includes(name),name+' must exist in the Studio UI');
  assert.ok(css.includes('[data-nav="'+name+'"]'),name+' needs an explicit nav color');
}
for(const name of ['studio-files','help'])
  assert.ok(css.includes('[data-action="'+name+'"]'));
for(const name of ['releases','news','notifications','ratings','users'])
  assert.ok(css.includes('[data-site-nav="'+name+'"]'));
for(const part of [':hover',':focus-visible','.nav-item.active','.nav-count',
  'prefers-reduced-motion','body[data-theme="light"]','body[data-theme="silver"]',
  'var(--nav-accent)','var(--nav-ink)'])
  assert.ok(css.includes(part),'Missing adaptive navigation styling: '+part);
const colors=items.map(name=>css.match(new RegExp('\\[data-nav="'+name+'"\\]\\{--nav-accent:(#[0-9a-f]+)'))?.[1]);
assert.ok(colors.every(Boolean),'Every Studio section needs a valid color');
assert.equal(new Set(colors).size,colors.length,'Studio sections should have distinct colors');
assert.ok(css.includes('[data-nav="projects"]{--nav-accent:#78dea9'),'Projects should be green');
assert.ok(css.includes('[data-nav="debts"]{--nav-accent:#ff8a95'),'Debts should be red');
assert.ok(html.includes('<link rel="stylesheet" href="sidebar-colors.css">'));
assert.ok(html.indexOf('href="sidebar-colors.css"')>html.indexOf('href="casting.css"'),
  'Sidebar color stylesheet must load last to override standard nav themes');
assert.ok(host.includes('"/sidebar-colors.css"'),'Native host must serve sidebar styles');
console.log('PASS: every Studio sidebar destination has distinct, responsive, accessible active/hover colors');
