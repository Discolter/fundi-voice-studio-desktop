import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStudioNavigation} from '../package/web/navigation-history.js';

function fakeWindow(){
  const listeners=new Map();
  const entries=[{state:null,url:'/'}];let pos=0;
  const win={
    location:{pathname:'/',search:''},
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    history:{
      get state(){return entries[pos].state;},
      replaceState(state,_title,url){entries[pos]={state,url};},
      pushState(state,_title,url){entries.splice(pos+1);entries.push({state,url});pos=entries.length-1;},
      go(diff){const next=pos+diff;if(next<0||next>=entries.length)return;pos=next;for(const fn of listeners.get('popstate')||[])fn({state:entries[pos].state});}
    },
    get __entries(){return entries;},
    get __index(){return pos;}
  };
  return win;
}
const win=fakeWindow();
const current={siteMode:'studio',sitePage:'releases',page:'projects',project:null,episode:null,tab:'roles'};
const view=()=>({...current});
const saved=[];
let blocked=false;
const nav=createStudioNavigation({
  win,read:view,restore:route=>{Object.assign(current,route);saved.push(route);nav.record();},
  canNavigate:()=>!blocked
});
nav.record();
assert.deepEqual(nav.status(),{index:0,max:0,canBack:false,canForward:false});
assert.equal(nav.back(),false,'Do not escape the Studio app before first navigation');
assert.equal(win.__entries.length,1,'The initial route replaces, not adds, a browser entry');
Object.assign(current,{page:'mytasks'});nav.record();
Object.assign(current,{page:'detail',project:'anime',episode:'ep1',tab:'roles'});nav.record();
Object.assign(current,{episode:'ep2',tab:'materials'});nav.record();
assert.equal(win.__entries.length,4);
nav.record();assert.equal(win.__entries.length,4,'Repeated redraw must not create duplicate history');
assert.equal(nav.back(),true);assert.equal(current.episode,'ep1');assert.equal(current.tab,'roles');
assert.equal(nav.back(),true);assert.equal(current.page,'mytasks');
assert.equal(nav.forward(),true);assert.equal(current.page,'detail');assert.equal(current.episode,'ep1');
assert.deepEqual(nav.status(),{index:2,max:3,canBack:true,canForward:true});
nav.back();assert.equal(current.page,'mytasks');
Object.assign(current,{page:'actors',project:null,episode:null,tab:'roles'});nav.record();
assert.equal(nav.forward(),false,'A new page after Back must discard the Forward branch');
assert.equal(win.__entries.length,3);
nav.back();assert.equal(current.page,'mytasks');
blocked=true;nav.forward();assert.equal(current.page,'mytasks','Unsaved dialog blocks mouse/keyboard app navigation');
assert.equal(win.__index,1,'Browser history position is restored when an edit dialog is open');
blocked=false;assert.equal(nav.forward(),true);assert.equal(current.page,'actors');
const n=saved.length;nav.dispose();win.history.go(-1);assert.equal(saved.length,n,'Dispose removes popstate listener');

// Ensure navigation is hooked up to the actual Studio route transitions and local mouse buttons.
const app=readFileSync('package/web/app.js','utf8');
const localHost=readFileSync('package/LocalServer.cs','utf8');
const actorCabinet=readFileSync('package/web/actor-cabinet.js','utf8');
assert.match(app,/import \{createStudioNavigation\} from '\.\/navigation-history\.js'/);
assert.match(app,/studioNavigation\.record\(\)/);
assert.match(app,/siteMode:ui\.siteMode,sitePage:ui\.sitePage,page:ui\.page/);
assert.match(app,/project:ui\.project,episode:ui\.episode,tab:ui\.tab/);
assert.match(app,/studioNavigation\.back\(\)/);
assert.match(app,/studioNavigation\.forward\(\)/);
assert.match(app,/event\.button===3\|\|event\.button===4/);
assert.match(app,/window\.addEventListener\('auxclick'/);
assert.match(app,/canNavigate:\(\)=>!modal\.open/);
assert.match(app,/actorCabinet\.restoreNavigation\(route\.cabinet\)/);
assert.match(actorCabinet,/navigationState:\(\)=>/);
assert.match(localHost,/"\/navigation-history\.js"/);
console.log('PASS: desktop mouse Back/Forward, project/episode tabs, browser history, guards and branch reset');
