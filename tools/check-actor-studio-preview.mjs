import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTaskSnapshot,addStudioMirrorToSnapshot,verifyStudioMirrorImages,mergeTaskCatalog,addRoleStagesToCatalog} from '../package/web/task-cloud-sync.js';
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

// Exercise non-empty artwork and encoder failures; empty strings alone never
// proved that the visual sync path worked.
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp1sAAAAASUVORK5CYII=';
const originalImage=globalThis.Image,originalDocument=globalThis.document;
let failDecode=false,jpegFallbacks=0;
globalThis.Image=class {
  naturalWidth=640;naturalHeight=960;
  set src(value){queueMicrotask(()=>{if(failDecode){failDecode=false;this.onerror();}else this.onload();});}
};
globalThis.document={createElement:()=>({width:0,height:0,
  getContext:()=>({drawImage(){}}),
  toDataURL(format,quality){
    if(format==='image/webp')return 'data:,'; // Unsupported or blocked WebP encoder.
    jpegFallbacks++;
    const length=Math.ceil(Math.max(64,this.width*this.height*4*quality)/4)*4;
    return 'data:image/jpeg;base64,'+'A'.repeat(length);
  }
})};
try{
  const artwork=structuredClone(state);
  artwork.projects[0].cover=pixel;
  artwork.projects[0].episodes[0].roles[0].image=pixel;
  artwork.actors[0].avatar=pixel;
  const prepared=await addStudioMirrorToSnapshot(artwork,buildTaskSnapshot(artwork));
  assert.deepEqual(verifyStudioMirrorImages(prepared,structuredClone(prepared)),{projects:1,characters:1,actors:1});
  assert.ok(jpegFallbacks>0,'JPEG fallback retains images when WebP is unavailable');
  const merged=addRoleStagesToCatalog(mergeTaskCatalog(prepared,{projects:[],actors:[]}),[]);
  assert.deepEqual(verifyStudioMirrorImages(prepared,merged),{projects:1,characters:1,actors:1});
  const stripped=structuredClone(prepared);
  stripped.projects[0].episodes[0].roles[0].image='';
  assert.throws(()=>verifyStudioMirrorImages(prepared,stripped),/не подтвердило/);
  const large=structuredClone(artwork);
  large.projects[0].episodes[0].roles=Array.from({length:600},(_,i)=>({id:'r'+i,character:'Персонаж '+i,image:pixel}));
  const catalog=await addStudioMirrorToSnapshot(large,buildTaskSnapshot(large));
  assert.equal(verifyStudioMirrorImages(catalog,catalog).characters,600,'Large casts retain every image');
  const allImages=[catalog.projects[0].cover,catalog.actors[0].avatar,...catalog.projects[0].episodes[0].roles.map(r=>r.image)];
  assert.ok(allImages.reduce((sum,s)=>sum+s.length,0)<=1150000);
  const retry=structuredClone(artwork);
  failDecode=true;
  await assert.rejects(addStudioMirrorToSnapshot(retry,buildTaskSnapshot(retry)),/прочитать/);
  const recovered=await addStudioMirrorToSnapshot(retry,buildTaskSnapshot(retry));
  assert.equal(verifyStudioMirrorImages(recovered,recovered).projects,1,'Failed decoding can be retried');
  const cleared=structuredClone(prepared);cleared.projects[0].cover='';
  assert.throws(()=>verifyStudioMirrorImages(cleared,prepared),/не подтвердило/,'Image removals need confirmation too');
}finally{
  if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
}
assert.ok(app.indexOf('verifyStudioMirrorImages(snapshot,confirmed.snapshot)')<app.indexOf("await api('cloud/tasks/baseline/save'"));
console.log('Non-empty images, adaptive compression, retry and server readback checks passed');
