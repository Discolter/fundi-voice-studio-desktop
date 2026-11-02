import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTaskSnapshot,addStudioMirrorToSnapshot} from '../package/web/task-cloud-sync.js';
const p={id:'p',title:'Проект',season:'1',archived:false,color:'blue',favorite:true,cover:'',
 createdAt:'2026-10-01',episodes:[{id:'e',number:'1',stage:'record',due:'2026-11-10',roles:[
 {id:'r',character:'Момо',actorId:'a',actor:'Актёр',lineCount:5,status:'waiting',image:'',voiceGender:'female'}
 ]}]};
const state={projects:[p],actors:[{id:'a',name:'Актёр',avatar:''}]};
const snapshot=await addStudioMirrorToSnapshot(state,buildTaskSnapshot(state));
assert.equal(snapshot.projects[0].color,'blue');
assert.equal(snapshot.projects[0].favorite,true);
assert.equal(snapshot.projects[0].episodes[0].stage,'record');
assert.equal(snapshot.projects[0].episodes[0].due,'2026-11-10');
assert.equal(snapshot.projects[0].episodes[0].roles[0].voiceGender,'female');
assert.equal(snapshot.projects[0].episodes[0].roles[0].status,'waiting');
assert.ok(!JSON.stringify(snapshot).includes('root'));
assert.ok(!JSON.stringify(snapshot).includes('subtitle'));
const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
assert.match(app,/await addStudioMirrorToSnapshot\(state,buildTaskSnapshot\(state\)\)/);
console.log('Studio actor mirror sync metadata preserves existing owner task source');
