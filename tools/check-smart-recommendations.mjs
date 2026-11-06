import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=async(path)=>{
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
};
const engine=await load('../package/web/recommendations.js');
const view=await load('../package/web/recommendations-view.js');
const date=new Date('2026-11-06T12:00:00');
const actorA={id:'A',name:'Алексей',telegram:'alexey_actor'},
      actorB={id:'B',name:'Борис',telegram:'boris_actor'},
      actorC={id:'C',name:'Кира',telegram:'kira_actor'},
      retired={id:'R',name:'Удалённый',retiredAt:'2026-11-01T00:00:00Z'};
const role=(id,status,actorId,extras={})=>({id,character:'Персонаж '+id,status,actorId,...extras});
const ep={id:'E',number:'01',stage:'record',due:'2026-11-07',roles:[
  role('received','received','A',{lineCount:10}),
  role('edit','processing','A',{lineCount:40}),
  role('waiting','waiting','A',{createdAt:'2026-10-20T10:00:00Z',due:''}),
  role('vacation','waiting','B',{createdAt:'2026-10-10T10:00:00Z',due:''}),
  role('unassigned','waiting',''),
  role('removed','waiting','R'),
  ...Array.from({length:7},(_,i)=>role('load-'+i,'waiting','C'))
],tasks:[{id:'T',title:'Проверка качества',done:false,due:'2026-11-05'}]};
const ready={id:'E2',number:'02',stage:'review',roles:[role('done','done','A')]};
const s={actors:[actorA,actorB,actorC,retired],projects:[{id:'P',title:'Наш сериал',archived:false,episodes:[ep,ready]}]};
const cloud={connected:true,vacations:[{actorId:'B',status:'active',startDate:'2026-10-30',endDate:'2026-11-08'}]};
let items=engine.collectRecommendations(s,cloud,{now:date});
const byType=type=>items.filter(x=>x.type===type);
for(const type of ['received','processing','assign','reassign','remind','workload','vacation-return','finish-episode','task','deadline-risk']){
  assert.ok(byType(type).length>0, 'missing '+type);
}
assert.equal(byType('remind').some(x=>x.actor.id==='B'),false,'No reminder while actor on vacation');
assert.ok(byType('remind').some(x=>x.actor.id==='A'));
assert.ok(byType('workload').some(x=>x.actor.id==='C'));
assert.ok(byType('finish-episode').some(x=>x.episode.id==='E2'));
assert.equal(byType('received').length,1);
const storageMap=new Map();
const storage={getItem:key=>storageMap.get(key)||null,setItem:(key,value)=>storageMap.set(key,value)};
const chosen=byType('received')[0];
engine.muteRecommendation(chosen,{storage,now:1});
assert.ok(!engine.visibleRecommendations(items,storage,2).includes(chosen),'hidden recommendation');
ep.roles[0].status='done';
const newItems=engine.collectRecommendations(s,cloud,{now:date});
assert.equal(newItems.some(x=>x.id===chosen.id),false,'completed role no longer recommended');
ep.roles[0].status='received';
ep.roles[0].due='2026-11-06';
const updated=engine.collectRecommendations(s,cloud,{now:date});
assert.ok(engine.visibleRecommendations(updated,storage,2).some(x=>x.id===chosen.id),'changed due date unmutes');
const another=byType('processing')[0];
engine.muteRecommendation(another,{storage,now:100,hours:24});
assert.ok(!engine.visibleRecommendations(items,storage,200).includes(another));
assert.ok(engine.visibleRecommendations(items,storage,100+24*3600000+1).includes(another));
assert.ok(engine.sortRecommendations(items,'easy').every((x,i,a)=>i===0||a[i-1].effort<=x.effort));
assert.ok(engine.sortRecommendations(items,'urgent').every((x,i,a)=>i===0||a[i-1].priority>=x.priority));
assert.match(engine.recommendationMessage(byType('remind')[0]),/Наш сериал/);
const escapeHTML=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>'<svg data-icon="'+name+'"></svg>';
s.projects[0].title='<script>alert("oops")</script>';
const safe=view.renderRecommendationPage(engine.collectRecommendations(s,cloud,{now:date}),{icon,escapeHTML});
assert.ok(safe.includes('&lt;script&gt;'));
assert.ok(!safe.includes('<script>'));
assert.match(safe,/data-action="recommend-remind"/);
assert.match(safe,/data-qv-open="role"/);
const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../package/web/index.html',import.meta.url),'utf8');
assert.ok(app.includes("if(ui.page==='recommendations')return renderRecommendations()"));
assert.ok(app.includes('data-nav="recommendations"'));
assert.ok(app.includes("case 'recommend-hide':"));
assert.ok(html.includes('recommendations.css'));
console.log('Smart recommendations: all checks passed');
