using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

namespace FundiVoice {
    // Local owner history is independent of Cloud's active-task snapshot.
    public static class TaskHistoryStore {
        static JavaScriptSerializer Json() { return new JavaScriptSerializer { MaxJsonLength=32*1024*1024, RecursionLimit=150 }; }
        static Dictionary<string,object> D(object value) { return value as Dictionary<string,object> ?? new Dictionary<string,object>(); }
        static object V(Dictionary<string,object> value,string key) { object found; return value.TryGetValue(key,out found)?found:null; }
        static string S(Dictionary<string,object> value,string key) { return Convert.ToString(V(value,key))??""; }
        static IEnumerable<Dictionary<string,object>> A(Dictionary<string,object> value,string key) {
            var items=V(value,key) as IEnumerable;
            if(items==null||items is string)yield break;
            foreach(var item in items)if(item is Dictionary<string,object>)yield return (Dictionary<string,object>)item;
        }
        static Dictionary<string,object> Read(string path) { return D(Json().DeserializeObject(File.ReadAllText(path,Encoding.UTF8))); }
        static Dictionary<string,object> TryRead(string path) { try { return Read(path); } catch { return null; } }
        static string Stamp(Dictionary<string,object> entry) { return new[]{S(entry,"deletedAt"),S(entry,"recoveredAt"),S(entry,"restoredAt")}.OrderByDescending(s=>s,StringComparer.Ordinal).First(); }
        static string Key(string project,string episode,string task) { return Json().Serialize(new[]{project,episode,task}); }
        static Dictionary<string,Dictionary<string,object>> Store(string root) {
            string path=Path.Combine(root,"task-history.json");
            var history=new Dictionary<string,Dictionary<string,object>>(StringComparer.Ordinal);
            if(!File.Exists(path))return history;
            var saved=TryRead(path)??TryRead(Path.Combine(root,"task-history.previous.json"));
            if(saved==null)throw new IOException("Не удалось прочитать историю поручений. Сохранённые файлы истории не изменены.");
            Merge(history,A(saved,"entries"));return history;
        }
        static void Merge(Dictionary<string,Dictionary<string,object>> history,IEnumerable<Dictionary<string,object>> entries) {
            foreach(var entry in entries) {
                var task=D(V(entry,"task"));string taskId=S(task,"id");
                if(taskId.Length==0||S(task,"title").Trim().Length==0)continue;
                string id=Key(S(entry,"projectId"),S(entry,"episodeId"),taskId);entry["id"]=id;
                Dictionary<string,object> old;
                if(!history.TryGetValue(id,out old)||String.CompareOrdinal(Stamp(entry),Stamp(old))>=0)history[id]=entry;
            }
        }
        static IEnumerable<Dictionary<string,object>> Projects(Dictionary<string,object> state) {
            return A(state,"projects").Concat(A(state,"trash"));
        }
        static HashSet<string> Active(Dictionary<string,object> state) {
            return new HashSet<string>(Projects(state).SelectMany(p=>A(p,"episodes").SelectMany(ep=>A(ep,"tasks").Select(t=>Key(S(p,"id"),S(ep,"id"),S(t,"id"))))),StringComparer.Ordinal);
        }
        static Dictionary<string,object> Entry(Dictionary<string,object> state,Dictionary<string,object> p,Dictionary<string,object> ep,Dictionary<string,object> task,string source,string file) {
            var selection=V(task,"roleIds") as IList;
            var roleIds=(selection==null?new[]{S(task,"roleId")}:selection.Cast<object>().OfType<string>()).Where(id=>id.Length>0).Distinct(StringComparer.Ordinal).ToList();
            var episodeRoles=A(ep,"roles").ToLookup(r=>S(r,"id"),StringComparer.Ordinal);
            var roles=roleIds.Select(id=>episodeRoles[id].FirstOrDefault()).Where(r=>r!=null).ToList();
            var role=roles.FirstOrDefault()??new Dictionary<string,object>();
            string actorId=roleIds.Count>1?"":S(role,"actorId");if(actorId.Length==0)actorId=S(task,"actorId");
            var actor=A(state,"actors").FirstOrDefault(a=>S(a,"id")==actorId)??new Dictionary<string,object>();
            long? lines=roles.Count>0&&roles.Count==roleIds.Count&&roles.All(r=>V(r,"lineCount") is int&&(int)V(r,"lineCount")>=0)?
                (long?)roles.Sum(r=>(long)(int)V(r,"lineCount")):null;
            string now=DateTime.UtcNow.ToString("o");
            var copy=new Dictionary<string,object>();
            foreach(string key in new[]{"id","title","due","priority","done","mine","actorId","roleId","roleIds"})if(task.ContainsKey(key))copy[key]=task[key];
            return new Dictionary<string,object> {
                {"id",Key(S(p,"id"),S(ep,"id"),S(task,"id"))},{"projectId",S(p,"id")},{"projectTitle",S(p,"title")},{"season",S(p,"season")},
                {"episodeId",S(ep,"id")},{"episodeNumber",S(ep,"number")},{"episodeTitle",S(ep,"title")},
                {"actorName",S(actor,"name").Length>0?S(actor,"name"):S(role,"actor")},{"character",string.Join(", ",roles.Select(r=>S(r,"character")))},
                {"lineCount",lines},{"task",copy},{"source",source},{"recoveredFrom",file},
                {"deletedAt",source=="backup"?"":now},{"recoveredAt",source=="backup"?now:""}
            };
        }
        static void Collect(Dictionary<string,Dictionary<string,object>> history,Dictionary<string,object> state,HashSet<string> active,string source,string file) {
            foreach(var p in Projects(state))foreach(var ep in A(p,"episodes"))foreach(var task in A(ep,"tasks")) {
                string id=Key(S(p,"id"),S(ep,"id"),S(task,"id"));
                if(S(task,"id").Length==0||active.Contains(id)||(source=="backup"&&history.ContainsKey(id)))continue;
                Merge(history,new[]{Entry(state,p,ep,task,source,file)});
            }
            // Cloud stores flattened tasks separately from its project/role catalog.
            foreach(var task in A(state,"tasks")) {
                string id=Key(S(task,"projectId"),S(task,"episodeId"),S(task,"id"));if(S(task,"id").Length==0||active.Contains(id)||history.ContainsKey(id))continue;
                var p=A(state,"projects").FirstOrDefault(x=>S(x,"id")==S(task,"projectId"))??new Dictionary<string,object>{{"id",S(task,"projectId")}};
                var ep=A(p,"episodes").FirstOrDefault(x=>S(x,"id")==S(task,"episodeId"))??new Dictionary<string,object>{{"id",S(task,"episodeId")}};
                Merge(history,new[]{Entry(state,p,ep,task,source,file)});
            }
        }
        static List<Dictionary<string,object>> Save(string root,Dictionary<string,Dictionary<string,object>> history,HashSet<string> active) {
            foreach(string id in active) {
                Dictionary<string,object> entry;
                if(history.TryGetValue(id,out entry)&&S(entry,"restoredAt").Length==0)entry["restoredAt"]=DateTime.UtcNow.ToString("o");
            }
            var entries=history.Values.OrderByDescending(Stamp,StringComparer.Ordinal).ThenBy(e=>S(e,"id"),StringComparer.Ordinal).ToList();
            string path=Path.Combine(root,"task-history.json"),raw=Json().Serialize(new{version=1,entries=entries});
            if(!File.Exists(path)||File.ReadAllText(path,Encoding.UTF8)!=raw) {
                string temp=path+".tmp";File.WriteAllText(temp,raw,new UTF8Encoding(false));
                if(File.Exists(path))File.Replace(temp,path,Path.Combine(root,"task-history.previous.json"),true);
                else File.Move(temp,path);
            }
            return entries;
        }
        public static List<Dictionary<string,object>> Recover(string root,Dictionary<string,object> state) {
            var history=Store(root);Merge(history,A(state,"taskHistory"));var active=Active(state);
            var files=Directory.GetFiles(root).Where(path=> {
                string name=Path.GetFileName(path);
                return (name.StartsWith("workspace",StringComparison.OrdinalIgnoreCase)&&name.EndsWith(".json",StringComparison.OrdinalIgnoreCase)&&name!="workspace.json")||name.StartsWith("cloud.tasks.baseline.json",StringComparison.OrdinalIgnoreCase);
            }).OrderByDescending(File.GetLastWriteTimeUtc);
            foreach(string path in files) {
                var old=TryRead(path);if(old==null)continue;
                Merge(history,A(old,"taskHistory"));
                var snapshot=D(V(old,"snapshot"));
                Collect(history,snapshot.Count>0?snapshot:old,active,"backup",Path.GetFileName(path));
            }
            return Save(root,history,active);
        }
        // Persist history BEFORE the workspace save can overwrite the previous snapshot.
        public static List<Dictionary<string,object>> BeforeSave(string root,Dictionary<string,object> previous,Dictionary<string,object> next) {
            var history=Store(root);Merge(history,A(previous,"taskHistory"));Merge(history,A(next,"taskHistory"));
            var active=Active(next);Collect(history,previous,active,"deleted","");
            return Save(root,history,active);
        }
    }
}
