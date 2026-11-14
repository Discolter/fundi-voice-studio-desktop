using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
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
        bool conflict=false,busy=false,requestConflict=false;
        object[] hiddenRoles=new object[0];
        bool roleSyncReady=false; // Never publish a stale startup roster before web edits are reconciled.
        DateTime nextTry=DateTime.MinValue,lastStatus=DateTime.MinValue;
        object[] accounts=new object[0];
        object[] sourceLinks=new object[0];
        public StudioCloud(string dataRoot){
            root=dataRoot;connectionFile=Path.Combine(root,"cloud.connection.bin");pendingFile=Path.Combine(root,"cloud.pending.json");setupFile=Path.Combine(root,"cloud.setup.bin");
            try{connection=PrivateFile.Read(connectionFile);}catch(CloudFault problem){error=problem.Message;}
            // Migrate old automatic publish queues: the owner must now opt in
            // explicitly for each episode. Never flush a pre-update draft on startup.
            pending=new Dictionary<string,object>();
            try{if(File.Exists(pendingFile))File.Delete(pendingFile);}catch{}
            LoadVacations();
            LoadFileAlerts();
            LoadDownloadNotifications();
            mailbox=new ReviewMailbox(dataRoot);mailbox.Bind(JsonData.S(connection,"server"),"studio");
            timer=new Timer(delegate{try{Sync(false);RetryDownloadNotifications();}catch{}},null,5000,5000);
        }
        bool Connected(){return JsonData.S(connection,"token")!=""&&JsonData.S(connection,"server")!="";}
        public object Status(){
            lock(gate)return new{connected=Connected(),server=JsonData.S(connection,"server"),lastSync=JsonData.S(connection,"lastSync"),lastStatus=lastStatus==DateTime.MinValue?"":lastStatus.ToString("o"),roleSyncReady=roleSyncReady,
                pending=pending.Count>0,busy=busy,error=error,conflict=conflict,revision=JsonData.N(connection,"revision"),actors=accounts,
                reviewApiAvailable=reviewApiAvailable,reviews=reviews,hiddenRoles=hiddenRoles,mailbox=mailbox.View(),
                fileApiAvailable=fileApiAvailable,files=recordingFiles,usedBytes=usedBytes,quotaBytes=quotaBytes,fileError=fileError,unreadFiles=unreadFiles,transfer=transfers.View(),
                vacations=vacationRows,vacationEvents=vacationEvents,vacationUnread=vacationUnread,
                vacationApiAvailable=vacationApiAvailable,vacationError=vacationError,sourceLinks=sourceLinks};
        }
        // Owner-only read of the roster actually published for Actor Desktop/Web.
        // Never use an actor's credentials or impersonate an actor session.
        public object ActorRoster(){
            string server,token;
            lock(gate){
                if(!Connected())throw new CloudFault(409,"not_connected","Сначала подключи Studio к Fundi Voice Cloud.");
                server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
            }
            var roster=CloudHttp.Request(server,"/v1/studio/web/roster","GET",null,token);
            var links=CloudHttp.Request(server,"/v1/studio/source-links","GET",null,token);
            return new { actors=JsonData.A(roster,"actors"),sourceLinks=JsonData.A(links,"links"),
                checkedAt=DateTime.UtcNow.ToString("o") };
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
        // Publish only one explicitly approved episode. Preserve the published
        // cast of every other episode, including actors with no local draft changes.
        public object PublishEpisodeRoles(Dictionary<string,object> workspace,
            string projectId,string episodeId,long expectedSnapshotVersion)
        {
            if(!System.Text.RegularExpressions.Regex.IsMatch(projectId??"",@"^[A-Za-z0-9_-]{1,128}$")||
               !System.Text.RegularExpressions.Regex.IsMatch(episodeId??"",@"^[A-Za-z0-9_-]{1,128}$"))
                throw new CloudFault(400,"invalid_episode","Выбери проект и серию.");
            if(expectedSnapshotVersion<0)
                throw new CloudFault(400,"invalid_snapshot_version","Сначала синхронизируй локальный черновик.");
            lock(syncGate)
            {
                string server,token;
                lock(gate){
                    if(!Connected())throw new CloudFault(409,"not_connected","Подключи Fundi Voice Cloud.");
                    if(requestConflict)throw new CloudFault(409,"request_conflict","Сначала разреши предыдущий конфликт публикации.");
                    server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
                }
                bool projectExists=false,episodeExists=false,projectArchived=false;
                foreach(var rawProject in JsonData.A(workspace,"projects"))
                {
                    var project=JsonData.D(rawProject);
                    if(JsonData.S(project,"id")!=projectId)continue;
                    projectExists=true;projectArchived=JsonData.B(project,"archived");
                    foreach(var rawEpisode in JsonData.A(project,"episodes"))
                    {
                        var ep=JsonData.D(rawEpisode);
                        if(JsonData.S(ep,"id")==episodeId){episodeExists=true;break;}
                    }
                    break;
                }
                if(!projectExists||!episodeExists||projectArchived)
                    throw new CloudFault(409,"missing_episode","Серия не найдена или находится в архиве.");
                var latest=CloudHttp.Request(server,"/v1/studio/tasks","GET",null,token);
                if(JsonData.N(latest,"version")!=expectedSnapshotVersion)
                    throw new CloudFault(409,"task_version_conflict","Черновик изменился на сайте или в другой Studio. Сначала обнови и проверь роли.");
                var roster=CloudHttp.Request(server,"/v1/studio/web/roster","GET",null,token);
                var state=CloudHttp.Request(server,"/v1/studio/sync-status","GET",null,token);
                var localProjection=ActorProjection.Build(workspace);
                var local=new Dictionary<string,Dictionary<string,object>>(StringComparer.Ordinal);
                foreach(var raw in localProjection)
                {
                    var actor=JsonData.D(raw);
                    var id=JsonData.S(actor,"actorId");
                    if(id!="")local[id]=actor;
                }
                // Fail visibly if an assigned actor cannot receive roles.
                foreach(var rawProject in JsonData.A(workspace,"projects"))
                {
                    var project=JsonData.D(rawProject);
                    if(JsonData.S(project,"id")!=projectId)continue;
                    foreach(var rawEpisode in JsonData.A(project,"episodes"))
                    {
                        var episode=JsonData.D(rawEpisode);
                        if(JsonData.S(episode,"id")!=episodeId)continue;
                        foreach(var rawRole in JsonData.A(episode,"roles"))
                        {
                            var role=JsonData.D(rawRole);string actorId=JsonData.S(role,"actorId");
                            if(actorId==""&&JsonData.S(role,"actor")!="")
                                throw new CloudFault(409,"unlinked_actor","Есть роль с именем актёра без привязки к аккаунту. Исправь её перед публикацией.");
                            if(actorId!=""&&(!local.ContainsKey(actorId)||!JsonData.B(local[actorId],"enabled")))
                                throw new CloudFault(409,"actor_access_disabled","Назначенный актёр не имеет доступа к Actor. Включи доступ или сними назначение.");
                        }
                    }
                }
                // The role table is a draft, but status/category are live fields.
                // Preserve their latest published values when the director approves
                // assignments. A concurrent Web/Actor update must never be rolled back
                // by an otherwise valid roster publication.
                var liveRoleMetadata=new Dictionary<string,Dictionary<string,object>>(StringComparer.Ordinal);
                foreach(var remoteActor in JsonData.A(roster,"actors"))
                {
                    var remote=JsonData.D(remoteActor);
                    var feed=JsonData.D(remote.ContainsKey("feed")?remote["feed"]:null);
                    foreach(var rawRole in JsonData.A(feed,"roles"))
                    {
                        var role=JsonData.D(rawRole);
                        if(JsonData.S(role,"projectId")!=projectId||JsonData.S(role,"episodeId")!=episodeId)continue;
                        var roleId=JsonData.S(role,"roleId");
                        if(roleId!=""&&!liveRoleMetadata.ContainsKey(roleId))
                            liveRoleMetadata.Add(roleId,role);
                    }
                }
                Func<Dictionary<string,object>,List<object>> selectedRoles=delegate(Dictionary<string,object> actor){
                    var feed=JsonData.D(actor.ContainsKey("feed")?actor["feed"]:null);
                    var result=new List<object>();
                    foreach(var rawRole in JsonData.A(feed,"roles"))
                    {
                        var role=JsonData.D(rawRole);
                        if(JsonData.S(role,"projectId")==projectId&&JsonData.S(role,"episodeId")==episodeId)
                        {
                            // Only cast changes are being approved. Use the server's
                            // current processing stage and category, even when a role
                            // is moved to another actor. Keep existing image handling.
                            Dictionary<string,object> live;
                            if(liveRoleMetadata.TryGetValue(JsonData.S(role,"roleId"),out live))
                            {
                                if(live.ContainsKey("status"))role["status"]=live["status"];
                                if(live.ContainsKey("roleTier"))role["roleTier"]=live["roleTier"];
                            }
                            result.Add(role);
                        }
                    }
                    return result;
                };
                var published=new List<object>();
                var updatedActors=new HashSet<string>(StringComparer.Ordinal);
                int publishedRoles=0;
                foreach(var raw in JsonData.A(roster,"actors"))
                {
                    var actor=JsonData.D(raw);string id=JsonData.S(actor,"actorId");
                    if(id=="")continue;
                    var originalFeed=JsonData.D(actor.ContainsKey("feed")?actor["feed"]:null);
                    var roles=new List<object>();
                    foreach(var rawRole in JsonData.A(originalFeed,"roles"))
                    {
                        var role=JsonData.D(rawRole);
                        if(JsonData.S(role,"projectId")==projectId&&JsonData.S(role,"episodeId")==episodeId)continue;
                        roles.Add(role);
                    }
                    Dictionary<string,object> draft;
                    if(local.TryGetValue(id,out draft))
                    {
                        var specific=selectedRoles(draft);
                        if(specific.Count>0)updatedActors.Add(id);
                        publishedRoles+=specific.Count;roles.AddRange(specific);
                    }
                    var feed=new Dictionary<string,object>{{"version",1},{"actorId",id},{"roles",roles.ToArray()}};
                    var profile=actor.ContainsKey("profile")?actor["profile"]:null;
                    // Publishing one episode must not update unrelated account access
                    // or other actors' profile data.
                    published.Add(new Dictionary<string,object>{
                        {"actorId",id},{"enabled",JsonData.B(actor,"enabled")},
                        {"profile",profile},{"feed",feed}
                    });
                }
                var existingIds=new HashSet<string>(published.Select(raw=>JsonData.S(JsonData.D(raw),"actorId")),StringComparer.Ordinal);
                foreach(var entry in local)
                {
                    if(existingIds.Contains(entry.Key))continue;
                    var specific=selectedRoles(entry.Value);
                    if(specific.Count==0)continue;
                    updatedActors.Add(entry.Key);publishedRoles+=specific.Count;
                    published.Add(new Dictionary<string,object>{
                        {"actorId",entry.Key},{"enabled",true},
                        {"profile",entry.Value.ContainsKey("profile")?entry.Value["profile"]:null},
                        {"feed",new Dictionary<string,object>{{"version",1},{"actorId",entry.Key},{"roles",specific.ToArray()}}}
                    });
                }
                // New assignments to a previously published but disabled actor
                // require explicitly enabling the account in the same approval.
                for(var i=0;i<published.Count;i++)
                {
                    var actor=JsonData.D(published[i]);string id=JsonData.S(actor,"actorId");
                    if(!updatedActors.Contains(id))continue;
                    Dictionary<string,object> localActor;
                    if(local.TryGetValue(id,out localActor)&&JsonData.B(localActor,"enabled"))
                    {
                        actor["enabled"]=true;
                        actor["profile"]=localActor.ContainsKey("profile")?localActor["profile"]:actor["profile"];
                    }
                }
                var response=CloudHttp.Request(server,"/v1/studio/roster","PUT",new{
                    baseRevision=JsonData.N(state,"revision"),
                    requestId=Guid.NewGuid().ToString("D"),
                    actors=published.ToArray()
                },token);
                lock(gate)
                {
                    connection["revision"]=JsonData.N(response,"revision");
                    connection["lastSync"]=DateTime.UtcNow.ToString("o");
                    PrivateFile.Save(connectionFile,connection);
                    conflict=false;error="";requestConflict=false;
                }
                // The published roster may adjust the owner snapshot version;
                // the normal task sync will refresh its baseline afterwards.
                return new {published=true,projectId=projectId,episodeId=episodeId,
                    publishedRoles=publishedRoles,affectedActors=updatedActors.Count,
                    revision=JsonData.N(response,"revision")};
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
        // Owner web and local role stages must be reconciled before rebasing the roster
        // revision. Merely refreshing the revision after a 409 would overwrite actor
        // recording status changes. A matching task-snapshot version is required.
        public object FinishRoleSync(long expectedSnapshotVersion){
            if(expectedSnapshotVersion<0)throw new CloudFault(400,"invalid_snapshot_version","Неверная версия списка ролей.");
            long serverRevision;
            lock(syncGate){
                string server,token;
                lock(gate){
                    if(!Connected())throw new CloudFault(409,"not_connected","Сначала подключи Studio к облаку.");
                    if(requestConflict)throw new CloudFault(409,"request_conflict","Конфликт идентификатора публикации. Проверь список ролей перед повторной отправкой.");
                    server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
                }
                // Read the roster revision first. If an actor changes recording status
                // after that, the optimistic revision on PUT will reject stale content.
                var remoteStatus=CloudHttp.Request(server,"/v1/studio/sync-status","GET",null,token);
                serverRevision=JsonData.N(remoteStatus,"revision");
                var latestSnapshot=CloudHttp.Request(server,"/v1/studio/tasks","GET",null,token);
                if(JsonData.N(latestSnapshot,"version")!=expectedSnapshotVersion)
                    throw new CloudFault(409,"task_version_conflict",
                        "Пока синхронизировали Studio, роли изменились в облаке. Нажми «Обновить», чтобы согласовать новые статусы.");
                lock(gate){
                    connection["revision"]=serverRevision;
                    PrivateFile.Save(connectionFile,connection);
                    roleSyncReady=true;
                    conflict=false;
                    error="";
                    nextTry=DateTime.MinValue;
                }
            }
            ThreadPool.QueueUserWorkItem(delegate{try{Sync(false);}catch{}});
            return new {ready=true,revision=serverRevision};
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
                    conflict=JsonData.N(remote,"revision")>0;requestConflict=false;
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
                        connection["revision"]=revision;conflict=false;requestConflict=false;
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
                lock(gate){accounts=JsonData.A(remote,"actors");reviews=JsonData.A(remote,"reviews");hiddenRoles=JsonData.A(remote,"hiddenRoles");reviewApiAvailable=JsonData.B(remote,"reviewApiAvailable");lastStatus=DateTime.UtcNow;error="";requestConflict=false;nextTry=DateTime.MinValue;}
                RefreshFiles(false);
                RefreshVacations(force);
                try{RefreshSourceLinks();}catch(CloudFault){}
                if(notification!=null&&Notify!=null)Notify(notification);
            }
            catch(CloudFault problem){
                lock(gate){error=problem.Message;conflict=problem.Code=="revision_conflict"||problem.Code=="request_conflict";requestConflict=problem.Code=="request_conflict";nextTry=DateTime.UtcNow.AddSeconds(30);}
            }
            catch{lock(gate){error="Не удалось завершить синхронизацию. Локальные данные сохранены.";nextTry=DateTime.UtcNow.AddSeconds(30);}}
            finally{lock(gate)busy=false;Monitor.Exit(syncGate);}
        }
        // Personal Actor cabinet visibility. No roster queue, status change, or file
        // deletion: a director-only command changes a separate Cloud preference.
        public object SetActorRoleVisibility(string actorId,string roleId,bool hidden){
            lock(syncGate){
                string server,token;
                lock(gate){
                    if(!Connected())throw new CloudFault(409,"not_connected","Подключи Studio к Cloud.");
                    server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
                }
                CloudHttp.Request(server,"/v1/studio/actor-roles/visibility","POST",
                    new{actorId=actorId,roleId=roleId,hidden=hidden},token);
                var fresh=CloudHttp.Request(server,"/v1/studio/sync-status","GET",null,token);
                lock(gate){
                    hiddenRoles=JsonData.A(fresh,"hiddenRoles");
                    accounts=JsonData.A(fresh,"actors");
                    reviews=JsonData.A(fresh,"reviews");
                    lastStatus=DateTime.UtcNow;
                }
                return Status();
            }
        }
        public object HideAcceptedEpisodeRoles(Dictionary<string,object> body){
            lock(syncGate){
                string server,token;
                lock(gate){
                    if(!Connected())throw new CloudFault(409,"not_connected","Подключи Studio к Cloud.");
                    server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
                }
                var projectId=JsonData.S(body,"projectId");
                var episodeId=JsonData.S(body,"episodeId");
                var roles=JsonData.A(body,"roles");
                if(roles.Length==0||roles.Length>2000)
                    throw new CloudFault(400,"invalid_episode_roles","В серии нет доступных для скрытия принятых ролей.");
                CloudHttp.Request(server,"/v1/studio/actor-roles/hide-episode","POST",
                    new{projectId=projectId,episodeId=episodeId,roles=roles},token);
                var fresh=CloudHttp.Request(server,"/v1/studio/sync-status","GET",null,token);
                lock(gate){
                    hiddenRoles=JsonData.A(fresh,"hiddenRoles");
                    accounts=JsonData.A(fresh,"actors");
                    reviews=JsonData.A(fresh,"reviews");
                    lastStatus=DateTime.UtcNow;
                }
                return Status();
            }
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
                if((kind!="note"&&kind!="retake"&&kind!="pickup"&&kind!="accepted")||text.Length>2000||((kind=="note"||kind=="retake"||kind=="pickup")&&text==""))
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
        public object Disconnect(){lock(syncGate)lock(gate){if(transfers.Busy)throw new CloudFault(409,"transfer_busy","Дождись завершения скачивания или отмени его.");recordingFiles=new object[0];fileApiAvailable=false;fileError="";usedBytes=0;connection=new Dictionary<string,object>();File.Delete(connectionFile);error="";conflict=false;requestConflict=false;roleSyncReady=false;accounts=new object[0];reviews=new object[0];reviewApiAvailable=false;vacationRows=new object[0];vacationEvents=new object[0];vacationUnread=0;vacationApiAvailable=false;vacationError="";sourceLinks=new object[0];return Status();}}
        public void Dispose(){if(timer!=null)timer.Dispose();transfers.Dispose();}
    }
}
