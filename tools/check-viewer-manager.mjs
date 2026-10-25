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
assert.ok(host.includes("connect-src 'self' https://xsbeatjomlcegxmqnapw.supabase.co;"));
assert.ok(host.includes("img-src 'self' data: https://xsbeatjomlcegxmqnapw.supabase.co;"));
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
assert.match(manager.render('ratings'),/Оценки зрителей/);
assert.match(manager.render('ratings'),/Пока никто не оценил/);
assert.match(root,/site-ratings/);

assert.ok(typeof events.click==='function'&&typeof events.submit==='function');
console.log('PASS: Viewer manager module, Studio modes, routes and local host assets.');
