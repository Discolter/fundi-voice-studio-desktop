using System;
using System.IO;
using System.Collections.Generic;
using System.Threading;
using FundiVoice.Desktop;

namespace FundiVoice {
    public sealed partial class StudioCloud : IDisposable {
        readonly string root,connectionFile,pendingFile,setupFile;
        readonly object gate=new object(),syncGate=new object();
        Dictionary<string,object> connection=new Dictionary<string,object>(),pending=new Dictionary<string,object>();
        Timer timer;
        readonly ReviewMailbox mailbox;
        object[] reviews=new object[0];
        bool reviewApiAvailable=false;
        public Action<Dictionary<string,object>> Notify;
        string error="";
        bool conflict=false,busy=false;
        bool roleSyncReady=false; // Never publish a stale startup roster before web edits are reconciled.
        DateTime nextTry=DateTime.MinValue,lastStatus=DateTime.MinValue;
        object[] accounts=new object[0];
        object[] sourceLinks=new object[0];
        public StudioCloud(string dataRoot){
            root=dataRoot;connectionFile=Path.Combine(root,"cloud.connection.bin");pendingFile=Path.Combine(root,"cloud.pending.json");setupFile=Path.Combine(root,"cloud.setup.bin");
            try{connection=PrivateFile.Read(connectionFile);}catch(CloudFault problem){error=problem.Message;}
            try{pending=JsonData.Read(pendingFile);}catch{pending=new Dictionary<string,object>();error="Очередь облака повреждена. Сохрани любое изменение в Studio для повторной публикации.";}
            LoadVacations();
            LoadFileAlerts();
            LoadDownloadNotifications();
            mailbox=new ReviewMailbox(dataRoot);mailbox.Bind(JsonData.S(connection,"server"),"studio");
            timer=new Timer(delegate{try{Sync(false);RetryDownloadNotifications();}catch{}},null,5000,5000);
        }
        bool Connected(){return JsonData.S(connection,"token")!=""&&JsonData.S(connection,"server")!="";}
        public object Status(){
            lock(gate)return new{connected=Connected(),server=JsonData.S(connection,"server"),lastSync=JsonData.S(connection,"lastSync"),
                pending=pending.Count>0,busy=busy,error=error,conflict=conflict,revision=JsonData.N(connection,"revision"),actors=accounts,
                reviewApiAvailable=reviewApiAvailable,reviews=reviews,mailbox=mailbox.View(),
                fileApiAvailable=fileApiAvailable,files=recordingFiles,usedBytes=usedBytes,quotaBytes=quotaBytes,fileError=fileError,unreadFiles=unreadFiles,transfer=transfers.View(),
                vacations=vacationRows,vacationEvents=vacationEvents,vacationUnread=vacationUnread,
                vacationApiAvailable=vacationApiAvailable,vacationError=vacationError,sourceLinks=sourceLinks};
        }
        public void Queue(Dictionary<string,object> state){
            var actors=ActorProjection.Build(state);string digest=JsonData.Digest(JsonData.Json().Serialize(actors));
            lock(gate){
                if(pending.Count>0&&JsonData.S(pending,"digest")==digest)return;
                if(pending.Count==0&&JsonData.S(connection,"publishedDigest")==digest)return;
                pending=new Dictionary<string,object>{{"requestId",Guid.NewGuid().ToString("D")},{"digest",digest},{"actors",actors}};
                JsonData.AtomicText(pendingFile,JsonData.Json().Serialize(pending));nextTry=DateTime.MinValue;
            }
        }
        void RefreshSourceLinks(){
            string server,token;
            lock(gate){if(!Connected())return;server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");}
            var data=CloudHttp.Request(server,"/v1/studio/source-links","GET",null,token);
            lock(gate)sourceLinks=JsonData.A(data,"links");
        }
        public object EditSourceLink(string projectId,string episodeId,string url){
            if(!System.Text.RegularExpressions.Regex.IsMatch(projectId??"",@"^[A-Za-z0-9_-]{1,128}$")||
               !System.Text.RegularExpressions.Regex.IsMatch(episodeId??"",@"^[A-Za-z0-9_-]{1,128}$"))
               throw new CloudFault(400,"invalid_episode","Выбери серию.");
            string server,token;
            lock(gate){if(!Connected())throw new CloudFault(409,"not_connected","Сначала подключи Fundi Voice Cloud.");server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");}
            CloudHttp.Request(server,"/v1/studio/source-links/set","POST",new{projectId=projectId,episodeId=episodeId,url=url??""},token);
            RefreshSourceLinks();
            return Status();
        }
        // Task snapshots are owner-only, separate from actor feeds and roster revisions.
        public object FinishRoleSync(){
            lock(gate){roleSyncReady=true;nextTry=DateTime.MinValue;}
            ThreadPool.QueueUserWorkItem(delegate{try{Sync(false);}catch{}});
            return new {ready=true};
        }
        public object TasksBaseline(){
            string path=Path.Combine(root,"cloud.tasks.baseline.json");
            try {return File.Exists(path)?(object)JsonData.Read(path):new {known=false};}
            catch{return new {known=false};}
        }
        public object SaveTasksBaseline(Dictionary<string,object> data){
            if(JsonData.Json().Serialize(data).Length>2600000)throw new CloudFault(413,"too_large","Слишком большой список поручений.");
            JsonData.AtomicText(Path.Combine(root,"cloud.tasks.baseline.json"),JsonData.Json().Serialize(data));
            return new {saved=true};
        }
        public object TasksNow(){
            string server,token;
            lock(gate){if(!Connected())throw new CloudFault(409,"not_connected","Сначала подключи Fundi Voice Cloud.");
                server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");}
            return CloudHttp.Request(server,"/v1/studio/tasks","GET",null,token);
        }
        public object SaveTasks(Dictionary<string,object> body){
            string server,token;
            lock(gate){if(!Connected())throw new CloudFault(409,"not_connected","Сначала подключи Fundi Voice Cloud.");
                server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");}
            return CloudHttp.Request(server,"/v1/studio/tasks","POST",body,token);
        }
        public object SourceLinksNow(){RefreshSourceLinks();return Status();}
        public object NewSetupCode(bool renew){
            lock(gate){
                if(renew)File.Delete(setupFile);
                if(File.Exists(setupFile)){
                    try{var existing=PrivateFile.Read(setupFile);return new{code=JsonData.S(existing,"pairingCode"),variable="STUDIO_SETUP_KEY"};}
                    catch(CloudFault){File.Delete(setupFile);}
                }
            }
            var setup=new Dictionary<string,object>{{"pairingCode",JsonData.RandomToken()},{"deviceId",Guid.NewGuid().ToString("D")},{"deviceToken",JsonData.RandomToken()}};
            lock(gate)PrivateFile.Save(setupFile,setup);
            return new{code=JsonData.S(setup,"pairingCode"),variable="STUDIO_SETUP_KEY"};
        }
        public object Pair(string server){
            server=CloudHttp.Server(server);
            lock(syncGate){
                var setup=PrivateFile.Read(setupFile);
                if(JsonData.S(setup,"pairingCode")=="")throw new CloudFault(400,"missing_setup","Сначала создай код подключения в Studio.");
                CloudHttp.Request(server,"/v1/studio/pair","POST",new{
                    pairingCode=JsonData.S(setup,"pairingCode"),deviceId=JsonData.S(setup,"deviceId"),deviceToken=JsonData.S(setup,"deviceToken")},null);
                var remote=CloudHttp.Request(server,"/v1/studio/sync-status","GET",null,JsonData.S(setup,"deviceToken"));
                lock(gate){
                    conflict=JsonData.N(remote,"revision")>0;
                    connection=new Dictionary<string,object>{{"server",server},{"token",JsonData.S(setup,"deviceToken")},
                        {"revision",0L},{"lastSync",""},{"publishedDigest",""}};
                    PrivateFile.Save(connectionFile,connection);accounts=JsonData.A(remote,"actors");
                    reviewApiAvailable=JsonData.B(remote,"reviewApiAvailable");reviews=JsonData.A(remote,"reviews");mailbox.Bind(server,"studio");
                    error=conflict?"На сервере уже есть публикация. Проверь назначения этой Studio и подтверди их публикацию.":"";
                    nextTry=DateTime.MinValue;
                }
                try{File.Delete(setupFile);}catch{}
            }
            return Status();
        }
        public object SyncNow(bool replace){
            lock(gate){nextTry=DateTime.MinValue;}
            Sync(replace,true);
            var status=Status();
            lock(gate){if(error!="")throw new CloudFault(conflict?409:503,conflict?"revision_conflict":"sync_failed",error);}
            return status;
        }
        void Sync(bool replace,bool force=false){
            if(!Monitor.TryEnter(syncGate,force?15000:0)){
                if(force)throw new CloudFault(409,"sync_busy","Сервер уже проверяется. Повтори обновление.");
                return;
            }
            try{
                string server,token,requestId="",digest="";
                long revision;
                object[] actors;
                lock(gate){
                    if(!Connected()||(!replace&&(conflict||DateTime.UtcNow<nextTry)))return;
                    server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");revision=JsonData.N(connection,"revision");
                    if(!force&&pending.Count==0&&!mailbox.HasOutbox&&DateTime.UtcNow-lastStatus<TimeSpan.FromSeconds(60))return;
                    busy=true;
                    requestId=JsonData.S(pending,"requestId");digest=JsonData.S(pending,"digest");actors=JsonData.A(pending,"actors");
                }
                if(replace){
                    var current=CloudHttp.Request(server,"/v1/studio/sync-status","GET",null,token);
                    revision=JsonData.N(current,"revision");
                    lock(gate){
                        connection["revision"]=revision;conflict=false;
                        if(pending.Count>0){
                            pending["requestId"]=Guid.NewGuid().ToString("D");requestId=JsonData.S(pending,"requestId");
                            actors=JsonData.A(pending,"actors");digest=JsonData.S(pending,"digest");
                            JsonData.AtomicText(pendingFile,JsonData.Json().Serialize(pending));
                        }
                    }
                }
                if(requestId!=""&&roleSyncReady){
                    var response=CloudHttp.Request(server,"/v1/studio/roster","PUT",
                        new{baseRevision=revision,requestId=requestId,actors=actors},token);
                    lock(gate){
                        connection["revision"]=JsonData.N(response,"revision");connection["lastSync"]=DateTime.UtcNow.ToString("o");
                        connection["publishedDigest"]=digest;PrivateFile.Save(connectionFile,connection);
                        if(JsonData.S(pending,"requestId")==requestId){pending=new Dictionary<string,object>();File.Delete(pendingFile);}
                    }
                }
                var remote=CloudHttp.Request(server,"/v1/studio/sync-status","GET",null,token);
                Dictionary<string,object> notification=null;
                if(JsonData.B(remote,"reviewApiAvailable")){
                    Func<string,string,object,Dictionary<string,object>> send=delegate(string path,string method,object body){return CloudHttp.Request(server,path,method,body,token);};
                    if(mailbox.Drain(send,true)>0)remote=CloudHttp.Request(server,"/v1/studio/sync-status","GET",null,token);
                    notification=mailbox.Fetch(send,true);
                }
                lock(gate){accounts=JsonData.A(remote,"actors");reviews=JsonData.A(remote,"reviews");reviewApiAvailable=JsonData.B(remote,"reviewApiAvailable");lastStatus=DateTime.UtcNow;error="";nextTry=DateTime.MinValue;}
                RefreshFiles(false);
                RefreshVacations(force);
                try{RefreshSourceLinks();}catch(CloudFault){}
                if(notification!=null&&Notify!=null)Notify(notification);
            }
            catch(CloudFault problem){
                lock(gate){error=problem.Message;conflict=problem.Code=="revision_conflict"||problem.Code=="request_conflict";nextTry=DateTime.UtcNow.AddSeconds(30);}
            }
            catch{lock(gate){error="Не удалось завершить синхронизацию. Локальные данные сохранены.";nextTry=DateTime.UtcNow.AddSeconds(30);}}
            finally{lock(gate)busy=false;Monitor.Exit(syncGate);}
        }
        public object Invite(string actorId){
            lock(syncGate){
                SyncNow(false);
                string server,token;
                lock(gate){
                    if(!Connected())throw new CloudFault(400,"not_connected","Сначала подключи Studio.");
                    if(pending.Count>0)throw new CloudFault(409,"pending","Дождись публикации последних изменений.");
                    server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
                }
                var invite=CloudHttp.Request(server,"/v1/studio/actors/"+Uri.EscapeDataString(actorId)+"/invite","POST",new{},token);
                invite["server"]=server;return invite;
            }
        }
        public object Feedback(Dictionary<string,object> body){
            lock(gate){
                if(!Connected()||!reviewApiAvailable)throw new CloudFault(409,"server_outdated","Подключи Studio и обнови сервер до Cloud 0.3.0.");
                string kind=JsonData.S(body,"kind"),text=JsonData.S(body,"text").Trim();
                if((kind!="note"&&kind!="retake"&&kind!="accepted")||text.Length>2000||((kind=="note"||kind=="retake")&&text==""))
                    throw new CloudFault(400,"invalid_review","Напиши замечание до 2000 символов.");
                var message=new Dictionary<string,object>{{"actorId",JsonData.S(body,"actorId")},{"roleId",JsonData.S(body,"roleId")},
                    {"kind",kind},{"text",text},{"requestId",Guid.NewGuid().ToString("D")},{"submissionId",JsonData.N(body,"submissionId")}};
                mailbox.Queue("feedback",message);nextTry=DateTime.MinValue;
            }
            ThreadPool.QueueUserWorkItem(delegate{Sync(false);});return Status();
        }
        public object ReadMessage(long id){mailbox.MarkRead(id);ThreadPool.QueueUserWorkItem(delegate{Sync(false);});return Status();}
        public object DeleteMessage(long id){mailbox.DeleteNotifications(new long[]{id});ThreadPool.QueueUserWorkItem(delegate{Sync(false);});return Status();}
        public object ClearMessages(){mailbox.DeleteAllNotifications();ThreadPool.QueueUserWorkItem(delegate{Sync(false);});return Status();}
        public object DismissFailures(){mailbox.DismissFailures();return Status();}
        public object Disconnect(){lock(syncGate)lock(gate){if(transfers.Busy)throw new CloudFault(409,"transfer_busy","Дождись завершения скачивания или отмени его.");recordingFiles=new object[0];fileApiAvailable=false;fileError="";usedBytes=0;connection=new Dictionary<string,object>();File.Delete(connectionFile);error="";conflict=false;accounts=new object[0];reviews=new object[0];reviewApiAvailable=false;vacationRows=new object[0];vacationEvents=new object[0];vacationUnread=0;vacationApiAvailable=false;vacationError="";sourceLinks=new object[0];return Status();}}
        public void Dispose(){if(timer!=null)timer.Dispose();transfers.Dispose();}
    }
}
