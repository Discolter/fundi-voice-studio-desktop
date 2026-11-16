using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;

namespace FundiVoice {
    public static class TaskHistoryChecks {
        static JavaScriptSerializer Json() { return new JavaScriptSerializer(); }
        static Dictionary<string,object> State(string tasks) {
            return Json().Deserialize<Dictionary<string,object>>("{\"projects\":[{\"id\":\"p\",\"title\":\"Project\",\"episodes\":[{\"id\":\"ep\",\"number\":\"1\",\"roles\":[{\"id\":\"r\",\"character\":\"Character\",\"actorId\":\"a\",\"lineCount\":42}],\"tasks\":["+tasks+"]}]}],\"actors\":[{\"id\":\"a\",\"name\":\"Actor\"}]}");
        }
        static string Task(string id) { return "{\"id\":\""+id+"\",\"title\":\"Record voice\",\"due\":\"2026-12-01\",\"priority\":\"high\",\"done\":true,\"actorId\":\"a\",\"roleId\":\"r\"}"; }
        static void Check(bool value,string message) { if(!value)throw new Exception(message); }
        public static void Run(string root) {
            var current=State(Task("active"));
            File.WriteAllText(Path.Combine(root,"workspace.previous.json"),Json().Serialize(State(Task("active")+","+Task("old"))));
            File.WriteAllText(Path.Combine(root,"workspace-before-import.json"),Json().Serialize(State(Task("old"))));
            File.WriteAllText(Path.Combine(root,"workspace-invalid.json"),"not JSON");
            File.WriteAllText(Path.Combine(root,"cloud.tasks.baseline.json.abcd.tmp"),"{\"snapshot\":{\"projects\":[],\"tasks\":[{\"id\":\"web-old\",\"projectId\":\"p\",\"episodeId\":\"ep\",\"title\":\"Web task\"}]}}");
            var recovered=TaskHistoryStore.Recover(root,current);
            Check(recovered.Count(e=>!e.ContainsKey("restoredAt"))==2,"Recover missing workspace and Cloud .tmp tasks; exclude active tasks and deduplicate");
            var old=recovered.First(e=>((Dictionary<string,object>)e["task"])["id"].ToString()=="old");
            Check(old["actorName"].ToString()=="Actor"&&old["character"].ToString()=="Character","Preserve old actor and role labels");
            Check(old["deletedAt"].ToString()=="","Do not invent a historical deletion date");
            Check(TaskHistoryStore.Recover(root,current).Count==2,"Repeated startup must not duplicate history");
            var empty=State("");
            var deleted=TaskHistoryStore.BeforeSave(root,current,empty);
            Check(deleted.Count==3,"Archive a deletion before workspace overwrite");
            Check(deleted.Any(e=>e["deletedAt"].ToString().Length>0),"Capture new deletion timestamps");
            current["taskHistory"]=deleted;
            var restored=TaskHistoryStore.BeforeSave(root,empty,current);
            Check(restored.Count(e=>!e.ContainsKey("restoredAt"))==2,"Restored active task is suppressed");
            Check(TaskHistoryStore.Recover(root,current).Count(e=>!e.ContainsKey("restoredAt"))==2,"Backups cannot resurrect restored active tasks");
            old["restoredAt"]=DateTime.UtcNow.ToString("o");
            current["taskHistory"]=new[]{old};TaskHistoryStore.BeforeSave(root,current,current);
            Check(TaskHistoryStore.Recover(root,current).Count(e=>!e.ContainsKey("restoredAt"))==1,"Preserve explicit moved-restore markers across older workspace saves");
            File.WriteAllText(Path.Combine(root,"task-history.json"),"broken");
            Check(TaskHistoryStore.Recover(root,current).Count>0,"Recover damaged history from its previous copy");
            var broken=Path.Combine(root,"broken");Directory.CreateDirectory(broken);File.WriteAllText(Path.Combine(broken,"task-history.json"),"broken");
            bool refused=false;try{TaskHistoryStore.Recover(broken,current);}catch(IOException){refused=true;}
            Check(refused&&File.ReadAllText(Path.Combine(broken,"task-history.json"))=="broken","Never overwrite an unreadable history store without a valid fallback");
            Console.WriteLine("PASS native history: durable capture, previous/legacy/tmp recovery, deduplication, restore markers and corruption fallback");
        }
    }
}
