import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync('package/web/app.js','utf8');
const css=readFileSync('package/web/compact.css','utf8');
const start=app.indexOf('function actorRegistrationInfo(');
const end=app.indexOf('\nfunction renderActorPortal()',start);
assert.ok(start>=0&&end>start,'registration helper must precede access screen');
const registration=runInNewContext('('+app.slice(start,end)+')');
const info=(account,connection={connected:true,error:''})=>registration(account,connection);

assert.equal(info({registered:true,username:'test'}).state,'yes');
assert.equal(info({registered:true,username:'test'}).label,'Зарегистрирован');
assert.equal(info({registered:false,username:''}).state,'no');
assert.equal(info({registered:false,username:''}).label,'Не зарегистрирован');
assert.equal(info(null).state,'unknown');
assert.equal(info(null,{connected:false}).state,'unknown');
assert.equal(info({registered:true,username:'test'},{connected:true,error:'offline'}).state,'unknown');
assert.ok(app.includes('actor-registration-${registration.state}'),'actor cards must display registration state');
assert.ok(app.includes('Логин Actor: @${e(account.username)}'),'registered username must remain visible');
assert.ok(app.includes('<small>@${e(a.telegram)}</small>'),'Telegram must remain visible independently');
for(const variant of ['yes','no'])assert.ok(css.includes('.actor-registration-'+variant),'missing '+variant+' styling');
console.log('Desktop actor registration indicators: OK');
