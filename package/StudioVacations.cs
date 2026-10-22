// Actor vacations are server-owned; do not write them into workspace.json or roster revisions.
using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using FundiVoice.Desktop;

namespace FundiVoice {
    public sealed partial class StudioCloud {
        object[] vacationRows=new object[0],vacationEvents=new object[0];
        long vacationUnread=0, lastVacationEventId=0;
        bool vacationApiAvailable=false, vacationMarkerLoaded=false;
        string vacationError="";
        DateTime lastVacationPoll=DateTime.MinValue;
        string vacationMarkerFile;
        public Action<string,string> VacationNotify;
        void LoadVacations(){
            vacationMarkerFile=Path.Combine(root,"cloud.vacation-marker.json");
            try{
                if(File.Exists(vacationMarkerFile)){
                    var saved=JsonData.Read(vacationMarkerFile);
                    lastVacationEventId=JsonData.N(saved,"lastEventId");vacationMarkerLoaded=true;
                }
            }catch{/* Do not lose a workspace because of an old notification marker. */}
        }
        void SaveVacationMarker(){
            try{JsonData.AtomicText(vacationMarkerFile,JsonData.Json().Serialize(new{lastEventId=lastVacationEventId}));}
            catch{/* Notification markers must never block a successful sync. */}
        }
        public void RefreshVacations(bool required){
            string server,token;
            lock(gate){
                if(!Connected())return;
                server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
                if(!required&&DateTime.UtcNow-lastVacationPoll<TimeSpan.FromSeconds(55))return;
            }
            Dictionary<string,object> remote;
            try{remote=CloudHttp.Request(server,"/v1/studio/vacations","GET",null,token);}
            catch(CloudFault problem){
                lock(gate){vacationError=problem.Message;vacationApiAvailable=problem.Status!=404;lastVacationPoll=DateTime.UtcNow;}
                if(required)throw;
                return;
            }
            long newest=0;
            var alerts=new List<Dictionary<string,object>>();
            foreach(var raw in JsonData.A(remote,"events")){
                var item=JsonData.D(raw);var id=JsonData.N(item,"id");
                if(id>newest)newest=id;
                if(vacationMarkerLoaded&&id>lastVacationEventId)alerts.Add(item);
            }
            lock(gate){
                vacationRows=JsonData.A(remote,"vacations");vacationEvents=JsonData.A(remote,"events");
                vacationUnread=JsonData.N(remote,"unread");vacationApiAvailable=true;vacationError="";
                lastVacationPoll=DateTime.UtcNow;
                if(newest>lastVacationEventId){lastVacationEventId=newest;SaveVacationMarker();}
                vacationMarkerLoaded=true;
            }
            if(alerts.Count>0&&VacationNotify!=null){
                var recent=alerts.OrderByDescending(item=>JsonData.N(item,"id")).First();
                string kind=JsonData.S(recent,"kind"),actor=JsonData.S(recent,"username");
                string action=kind=="started"?"отпуск начался":kind=="planned"?"отпуск запланирован":
                    kind=="updated"?"даты отпуска изменены":kind=="returned"?"отпуск завершён":"отпуск отменён";
                VacationNotify("Изменение отпуска",(actor==""?"Актёр":"@"+actor)+" · "+action+
                    (alerts.Count>1?". Ещё событий: "+(alerts.Count-1):""));
            }
        }
        public object ManageVacation(string action, string actorId, string startDate, string endDate, string reason, string timeZone){
            if(String.IsNullOrWhiteSpace(actorId)||actorId.Length>128||
                !System.Text.RegularExpressions.Regex.IsMatch(actorId,@"^[A-Za-z0-9_-]+$"))
                throw new CloudFault(400,"invalid_actor","Выбери актёра из базы Studio.");
            if(action!="start"&&action!="update"&&action!="end")
                throw new CloudFault(400,"invalid_action","Неизвестное действие с отпуском.");
            string server,token;
            lock(gate){
                if(!Connected())throw new CloudFault(409,"not_connected","Подключи Studio к Fundi Voice Cloud.");
                server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
            }
            // Send any locally queued actor profiles first; no Actor account is necessary.
            SyncNow(false);
            string path="/v1/studio/actors/"+Uri.EscapeDataString(actorId)+"/vacation/"+action;
            object body=action=="start"?
                (object)new{startDate=startDate,endDate=String.IsNullOrEmpty(endDate)?null:endDate,
                    reason=reason??"",timeZone=String.IsNullOrWhiteSpace(timeZone)?"Europe/Madrid":timeZone}:
                action=="update"?
                (object)new{endDate=String.IsNullOrEmpty(endDate)?null:endDate,reason=reason??""}:
                new{};
            CloudHttp.Request(server,path,"POST",body,token);
            RefreshVacations(true);
            return Status();
        }
        public object ReadVacationEvents(object[] rawIds){
            if(rawIds==null||rawIds.Length==0||rawIds.Length>100)
                throw new CloudFault(400,"invalid_ids","Выбери от 1 до 100 событий.");
            var ids=new List<long>();
            foreach(var raw in rawIds){
                long value;
                if(!Int64.TryParse(Convert.ToString(raw),out value)||value<=0)
                    throw new CloudFault(400,"invalid_ids","Некорректный идентификатор уведомления.");
                ids.Add(value);
            }
            string server,token;
            lock(gate){
                if(!Connected())throw new CloudFault(409,"not_connected","Сначала подключи Studio к облаку.");
                server=JsonData.S(connection,"server");token=JsonData.S(connection,"token");
            }
            CloudHttp.Request(server,"/v1/studio/vacations/events/read","POST",new{ids=ids.ToArray()},token);
            RefreshVacations(true);
            return Status();
        }
    }
}
