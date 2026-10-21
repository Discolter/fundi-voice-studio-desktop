using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using FundiVoice.Desktop;

namespace FundiVoice {
    public sealed partial class StudioCloud {
        readonly FileJobs transfers=new FileJobs();
        object[] recordingFiles=new object[0];
        long usedBytes,quotaBytes=9L*1024*1024*1024;
        bool fileApiAvailable;
        string fileError="";
        string fileAlertPath;
        readonly HashSet<string> knownReadyFiles = new HashSet<string>(StringComparer.Ordinal);
        readonly HashSet<string> seenReadyFiles = new HashSet<string>(StringComparer.Ordinal);
        bool fileAlertInitialized;
        int unreadFiles;
        readonly HashSet<string> pendingDownloadNotifications = new HashSet<string>(StringComparer.Ordinal);
        string downloadNotificationPath;
        DateTime nextDownloadNotificationTry=DateTime.MinValue;
        // Local durable outbox: if Render is sleeping when a download finishes,
        // keep the acknowledgement and retry later, instead of losing it.
        void LoadDownloadNotifications(){
            downloadNotificationPath=Path.Combine(root,"cloud.download-notifications.json");
            try{
                if(!File.Exists(downloadNotificationPath))return;
                var saved=JsonData.Read(downloadNotificationPath);
                foreach(var raw in JsonData.A(saved,"fileIds")){
                    string id=raw as string;
                    Guid parsed;
                    if(id!=null&&Guid.TryParseExact(id,"D",out parsed))pendingDownloadNotifications.Add(id);
                }
            }catch{/* Never block Studio startup on a corrupted retry journal. */}
        }
        void SaveDownloadNotifications(){
            JsonData.AtomicText(downloadNotificationPath,JsonData.Json().Serialize(new{
                fileIds=pendingDownloadNotifications.OrderBy(x=>x).ToArray()
            }));
        }
        void QueueDownloadNotification(string fileId){
            lock(gate){
                // Persist first. A crash immediately after saving the audio cannot
                // permanently lose the notification.
                if(pendingDownloadNotifications.Add(fileId))SaveDownloadNotifications();
                nextDownloadNotificationTry=DateTime.MinValue;
            }
            RetryDownloadNotifications();
        }
        public void RetryDownloadNotifications(){
            string fileId;
            lock(gate){
                if(!Connected()||pendingDownloadNotifications.Count==0||DateTime.UtcNow<nextDownloadNotificationTry)return;
                fileId=pendingDownloadNotifications.OrderBy(x=>x).First();
                nextDownloadNotificationTry=DateTime.UtcNow.AddSeconds(60);
            }
            try{
                var receipt=FileRequest("/v1/studio/files/downloaded","POST",new{fileId=fileId});
                lock(gate){
                    if(pendingDownloadNotifications.Remove(fileId))SaveDownloadNotifications();
                    nextDownloadNotificationTry=DateTime.MinValue;
                }
            }catch(CloudFault issue){
                // A recording can be removed before a delayed acknowledgement;
                // its actor must not receive an invented notice for missing media.
                if(issue.Code=="file_missing"||issue.Code=="file_not_ready"){
                    lock(gate){
                        if(pendingDownloadNotifications.Remove(fileId))SaveDownloadNotifications();
                        nextDownloadNotificationTry=DateTime.MinValue;
                    }
                }
                // All other failures remain in the durable queue.
            }catch{/* Reattempt later; never mark a saved audio file as failed. */}
        }
        // Separate from the role-submission mailbox: uploading an audio file is not
        // the same action as clicking "Сдать на проверку".
        public Action<int,string> FileNotify;

        void LoadFileAlerts(){
            fileAlertPath = Path.Combine(root, "cloud.file-alerts.json");
            try{
                if(!File.Exists(fileAlertPath))return;
                var saved=JsonData.Read(fileAlertPath);
                foreach(var raw in JsonData.A(saved,"known"))if(raw is string)knownReadyFiles.Add((string)raw);
                foreach(var raw in JsonData.A(saved,"seen"))if(raw is string)seenReadyFiles.Add((string)raw);
                fileAlertInitialized=JsonData.B(saved,"initialized");
            }catch{
                // A corrupt local tracker must never block Cloud sync or delete audio.
                knownReadyFiles.Clear();seenReadyFiles.Clear();fileAlertInitialized=false;
            }
        }
        void SaveFileAlerts(){
            try{JsonData.AtomicText(fileAlertPath,JsonData.Json().Serialize(new {
                initialized=fileAlertInitialized,known=knownReadyFiles.OrderBy(x=>x).ToArray(),
                seen=seenReadyFiles.OrderBy(x=>x).ToArray()
            }));}catch{}
        }
        void UpdateFileAlerts(){
            // Caller holds gate; only fully completed recordings are counted.
            var ready=new List<Dictionary<string,object>>();
            var ids=new HashSet<string>(StringComparer.Ordinal);
            foreach(var raw in recordingFiles){
                var file = JsonData.D(raw);
                string id = JsonData.S(file,"fileId");
                if(id!=""&&JsonData.S(file,"status")=="ready"&&ids.Add(id))ready.Add(file);
            }
            var fresh=new List<Dictionary<string,object>>();
            if(fileAlertInitialized){
                foreach(var item in ready)if(!knownReadyFiles.Contains(JsonData.S(item,"fileId")))fresh.Add(item);
            }
            // Prune removed recordings; avoid unbounded growth of the local tracker.
            knownReadyFiles.IntersectWith(ids);
            seenReadyFiles.IntersectWith(ids);
            foreach(var id in ids)knownReadyFiles.Add(id);
            fileAlertInitialized=true;
            unreadFiles=ids.Count(id=>!seenReadyFiles.Contains(id));
            SaveFileAlerts();
            if(fresh.Count>0&&FileNotify!=null){
                // Caller invokes the callback after releasing gate (see RefreshFiles).
                lastNewFiles=fresh.Count;
                lastNewFileName=JsonData.S(fresh[0],"fileName");
            }
        }
        int lastNewFiles;
        string lastNewFileName="";
        void MarkFilesSeen(){
            lock(gate){
                foreach(var raw in recordingFiles){
                    var file=JsonData.D(raw);
                    if(JsonData.S(file,"status")=="ready")seenReadyFiles.Add(JsonData.S(file,"fileId"));
                }
                unreadFiles=0;
                SaveFileAlerts();
            }
        }
        Dictionary<string,object> FileRequest(string path,string method,object body){
            lock(syncGate){
                string server,token;
                lock(gate){
                    if(!Connected())throw new CloudFault(409,"not_connected","Сначала подключи Studio к серверу.");
                    server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
                }
                return CloudHttp.Request(server,path,method,body,token);
            }
        }
        void RefreshFiles(bool required){
            try{
                var result=FileRequest("/v1/studio/files","GET",null);
                int count;string name;
                lock(gate){
                    recordingFiles=JsonData.A(result,"files");usedBytes=JsonData.N(result,"usedBytes");
                    quotaBytes=JsonData.N(result,"quotaBytes");fileApiAvailable=true;fileError="";
                    lastNewFiles=0;lastNewFileName="";
                    UpdateFileAlerts();count=lastNewFiles;name=lastNewFileName;
                }
                if(count>0&&!required&&FileNotify!=null)FileNotify(count,name);
            }catch(CloudFault problem){
                lock(gate){if(problem.Status==404)fileApiAvailable=false;
                    fileError=problem.Status==404?"Для записей нужен Fundi Voice Cloud 0.4.0.":problem.Message;}
                if(required)throw;
            }
        }
        public object FilesNow(){RefreshFiles(true);MarkFilesSeen();return Status();}
        Dictionary<string,object> Recording(string id){
            Guid parsed;if(!Guid.TryParseExact(id,"D",out parsed))throw new CloudFault(400,"invalid_file_id","Файл не найден. Обнови список записей.");
            lock(gate){foreach(var raw in recordingFiles){var item=JsonData.D(raw);if(JsonData.S(item,"fileId")==id)return item;}}
            throw new CloudFault(404,"file_missing","Файл не найден. Обнови список записей.");
        }
        public object DownloadRecording(string fileId,string folder){
            var item=Recording(fileId);
            if(JsonData.S(item,"status")!="ready")throw new CloudFault(409,"file_not_ready","Актёр ещё не закончил загрузку.");
            string name=R2Transfer.SafeName(JsonData.S(item,"fileName"));long size=JsonData.N(item,"size");
            folder=Path.GetFullPath(folder);
            if(!Directory.Exists(folder))throw new DirectoryNotFoundException();
            string destination=folder;
            transfers.Start("download",name,size,JsonData.S(item,"roleId"),delegate(TransferJob job){
                job.SetFileId(fileId);job.Check();
                var response=FileRequest("/v1/studio/files/download","POST",new{fileId=fileId});
                job.Check();R2Transfer.Download(JsonData.S(response,"downloadUrl"),destination,name,size,job);
                // Only a verified, fully saved file can trigger the actor alert.
                try{QueueDownloadNotification(fileId);}catch{/* Audio is saved; notification retries are best-effort. */}
            });
            return Status();
        }
        public object DeleteRecording(string fileId){
            if(transfers.Busy)throw new CloudFault(409,"transfer_busy","Дождись завершения скачивания перед удалением записи.");
            FileRequest("/v1/studio/files/delete","POST",new{fileId=fileId});RefreshFiles(false);return Status();
        }
        public object CleanupRecordings(){
            FileRequest("/v1/studio/files/cleanup","POST",new{});RefreshFiles(false);return Status();
        }
        public object CancelTransfer(){transfers.Cancel();return Status();}
    }
}
