import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSiteManager} from '../package/web/site-manager.js';

const root=fs.readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const host=fs.readFileSync(new URL('../package/LocalServer.cs',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../package/web/index.html',import.meta.url),'utf8');
assert.match(root,/Студия<\/button>.*?Сайт<\/button>/);
assert.match(root,/siteManager\.render/);
assert.match(root,/site-manager\.js/);
assert.match(host,/\/site-manager\.js/);
assert.match(host,/\/site-manager\.css/);
assert.match(html,/site-manager\.css/);
// Keep the allowlist strict: viewer uses Supabase, software uploads/previews use private R2.
const directives=Object.fromEntries(host.match(/Content-Security-Policy: ([^\\]+)/)[1].split(';').map(d=>d.trim().split(/\s+/)).filter(parts=>parts[0]).map(([name,...values])=>[name,values.sort()]));
assert.deepEqual(directives['connect-src'],["'self'","https://xsbeatjomlcegxmqnapw.supabase.co","https://*.r2.cloudflarestorage.com"].sort());
assert.deepEqual(directives['img-src'],["'self'","data:","https://xsbeatjomlcegxmqnapw.supabase.co","https://*.r2.cloudflarestorage.com"].sort());
assert.deepEqual(directives['script-src'],["'self'"]);
assert.deepEqual(directives['object-src'],["'none'"]);
assert.deepEqual(directives['frame-ancestors'],["'none'"]);
assert.match(host,/\/software-catalog\.js/);
assert.match(host,/\/software-catalog\.css/);
assert.match(root,/cloud\/software/);
assert.match(html,/software-catalog\.css/);
const managerJS=fs.readFileSync(new URL('../package/web/site-manager.js',import.meta.url),'utf8');
assert.ok(managerJS.includes("...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{}),"));
assert.ok(!managerJS.includes("Authorization:'Bearer '+(session?.access_token||config.key)"));


const store=new Map(),events={};
globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
globalThis.document={addEventListener:(type,fn)=>events[type]=fn};
const manager=createSiteManager({toast:()=>{},escapeHTML:x=>String(x),rerender:()=>{}});
assert.match(manager.render('releases'),/Подключение сайта/);
assert.match(manager.render('users'),/viewer_admins/);
assert.match(root,/site-ratings/);
assert.match(managerJS,/function ratingsTab\(\)/);
assert.match(managerJS,/viewer_episode_rating_stats/);
assert.match(managerJS,/viewer_project_rating_stats/);
assert.match(managerJS,/Оценки зрителей/);

assert.match(root,/site-notifications/);
assert.match(managerJS,/viewer_admin_user_directory/);
assert.match(managerJS,/viewer_notifications/);
assert.match(managerJS,/function notificationsTab\(\)/);
assert.match(managerJS,/function usersTab\(\)/);
assert.match(managerJS,/mailto:/);
assert.match(managerJS,/Уведомления/);
assert.match(managerJS,/Email виден только администратору/);
assert.ok(!managerJS.includes('/auth/v1/admin/users'),'must never use Supabase service_role from Studio');

assert.ok(typeof events.click==='function'&&typeof events.submit==='function');
console.log('PASS: Viewer manager module, Studio modes, routes and local host assets.');
