import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import * as taskSync from '../package/web/task-cloud-sync.js';

const root=resolve(import.meta.dirname,'..');
const source=readFileSync(join(root,'package/web/app.js'),'utf8');
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const state={actors:[],projects:[{id:'p',title:'Project',episodes:[{
  id:'ep',number:'1',roles:[],tasks:[{id:'t',title:'Before',priority:'normal'}]
}]}]};
const baseline=taskSync.buildTaskSnapshot(state),remote=structuredClone(baseline);
remote.tasks[0].title='Changed on the website';
const button={disabled:false,title:'',label:{textContent:''},querySelector(){return this.label;}};
const context=vm.createContext({...taskSync,state,native:true,cloud:{connected:true},
  taskSyncBusy:false,rolePublishBusy:false,refreshing:false,modal:{open:false},saving:false,
  localEditRevision:0,saveError:'',taskSyncError:'',roleSyncConflicts:[],roleSyncDecisions:[],
  taskSyncConflicts:[],taskSyncChoices:[],JSON,console,
  document:{querySelector:()=>null,querySelectorAll:()=>[button]},
  icon:()=>'<svg></svg>',e:x=>x,updateRoleSyncBanner(){},toast(){},
  isActorPickerOpen:()=>false,scheduleTaskCloudSync(){},flushSave:async()=>{},
  persist(){context.localEditRevision++;},
  render(){button.disabled=/\sdisabled(?:[\s>])/.test(context.buttonHTML());},
  addStudioMirrorToSnapshot:async(s,snapshot)=>snapshot,
  verifyStudioMirrorImages:()=>({}),
  async api(path,body){
    if(path==='cloud/tasks/read')return {version:1,snapshot:remote};
    if(path==='cloud/tasks/baseline')return {known:true,snapshot:baseline};
    if(path==='cloud/tasks/write')return {version:1};
    if(path==='cloud/tasks/baseline/save'||path==='cloud/roles/sync-ready')return {};
    throw Error('Unexpected request '+path);
  }
});
vm.runInContext(between('function updateCloudIndicator(){','\nfunction roleSyncBannerHTML(){')+
  between('const episodePublishButton=','\nfunction episodeRoles(')+
  between('async function syncStudioTasks(','\nfunction persist(){')+
  '\nglobalThis.buttonHTML=()=>episodePublishButton({id:"p"},{id:"ep"});'+
  '\nglobalThis.runSync=syncStudioTasks;globalThis.updateButtons=updateCloudIndicator;',context);
assert.equal(await context.runSync(),true);
assert.equal(state.projects[0].episodes[0].tasks[0].title,'Changed on the website');
assert.equal(button.disabled,false,'A render during synchronization must not leave Publish disabled afterwards');
context.cloud.connected=false;context.updateButtons();
assert.equal(button.disabled,true,'A lost connection disables publication immediately');
assert.match(button.title,/подключ/i,'The disabled control explains how to reconnect');
context.cloud.connected=true;context.updateButtons();
assert.equal(button.disabled,false,'Reconnecting re-enables the existing button without a full page render');
context.taskSyncBusy=true;context.updateButtons();
assert.equal(button.disabled,true);assert.match(button.label.textContent,/синхрониз/i);
context.taskSyncBusy=false;context.rolePublishBusy=true;context.updateButtons();
assert.equal(button.disabled,true,'Double clicks cannot prepare two concurrent publications');
context.rolePublishBusy=false;context.updateButtons();assert.equal(button.disabled,false);
console.log('PASS: publication button recovers after background synchronization and reconnecting');

if(process.platform==='win32'){
  const temp=mkdtempSync(join(tmpdir(),'fundi-publication-check-'));
  try{
    const common=readFileSync(join(root,'package/CloudCommon.cs'),'utf8');
    // Replace only the transport in the test assembly. Exercise the real native
    // publication method and ActorProjection, with no production network access.
    const begin=common.indexOf('    public static class CloudHttp {');
    const end=common.indexOf('    public static class ActorProjection {',begin);
    assert.ok(begin>=0&&end>begin);
    writeFileSync(join(temp,'CloudCommon.cs'),common.slice(0,begin)+`
    public static class CloudHttp {
      public const string DefaultServer="https://fixture.example";
      public static System.Func<string,string,string,object,string,Dictionary<string,object>> Handler;
      public static string Server(string value){return value;}
      public static Dictionary<string,object> Request(string server,string path,string method,object body,string token){
        return Handler(server,path,method,body,token);
      }
    }
`+common.slice(end));
    const sources=['LocalServer.cs','ReaperLaunch.cs','StudioCloud.cs','StudioRecovery.cs','StudioVacations.cs',
      'StudioFiles.cs','FileTransfers.cs','ReviewMailbox.cs','StudioNotifications.cs','UpdateNotice.cs']
      .map(name=>join(root,'package',name));
    const exe=join(temp,'PublicationChecks.exe');
    const compiler=join(process.env.WINDIR||'C:\\Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
    const compile=spawnSync(compiler,['/nologo','/target:exe','/main:PublicationChecks',`/out:${exe}`,
      '/r:System.dll','/r:System.Core.dll','/r:System.Security.dll','/r:System.Web.Extensions.dll',
      '/r:System.Windows.Forms.dll','/r:System.Drawing.dll',join(temp,'CloudCommon.cs'),
      ...sources,join(root,'tools/fixtures/PublicationChecks.cs')],{encoding:'utf8'});
    assert.equal(compile.status,0,'Native publication fixture must compile: '+compile.stdout+compile.stderr);
    const run=spawnSync(exe,[temp],{encoding:'utf8',timeout:30000});
    assert.equal(run.status,0,'Native publication checks: '+run.stdout+run.stderr);
    console.log(run.stdout.trim());
  }finally{
    const safeRoot=resolve(tmpdir())+sep;
    assert.ok(resolve(temp).startsWith(safeRoot)&&temp.includes('fundi-publication-check-'));
    rmSync(temp,{recursive:true,force:true});
  }
}
