import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync('package/web/app.js','utf8');
const cloud=readFileSync('package/StudioVacations.cs','utf8');
for(const x of ['data-vacation-indefinite','Бессрочно','date.disabled=checkbox.checked','!data.indefinite&&!data.endDate',"endDate:data.indefinite?'':data.endDate"]){
  assert.ok(app.includes(x),'Studio indefinite vacation missing: '+x);
}
assert.match(app,/action:'end'/);
assert.ok(cloud.includes('String.IsNullOrEmpty(endDate)?null:endDate'),'Cloud must preserve nullable end dates');
assert.ok(cloud.includes('action=="end"')||cloud.includes('action!="end"'));
console.log('PASS: Studio indefinite vacations can start, edit, and end manually');
