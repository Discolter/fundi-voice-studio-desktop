using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;

namespace FundiVoice.Desktop {
    // Durable review outbox and notification cache. Cloud tokens never enter these payloads.
    public sealed class ReviewMailbox {
        readonly string path;
        readonly object gate=new object();
        Dictionary<string,object> data;
        public ReviewMailbox(string directory){
            path=Path.Combine(directory,"reviews.bin");
            data=PrivateFile.Read(path);
        }
        void Save(){PrivateFile.Save(path,data);}
        public bool HasOutbox{get{lock(gate)return JsonData.A(data,"outbox").Length>0;}}
        public void Bind(string server,string user){
            if(server==""||user=="")return;
            lock(gate){if(JsonData.S(data,"identity")!=server+"|"+user){data=new Dictionary<string,object>{{"identity",server+"|"+user}};Save();}}
        }
        public void Clear(){lock(gate){data=new Dictionary<string,object>();if(File.Exists(path))File.Delete(path);}}
        public void DismissFailures(){lock(gate){data["failed"]=new object[0];Save();}}
        public object View(){
            lock(gate)return new{unread=JsonData.N(data,"unread"),messages=JsonData.A(data,"messages"),
                pending=JsonData.A(data,"outbox"),failed=JsonData.A(data,"failed")};
        }
        // A deletion hides a notification only in this Windows profile.  The server is
        // still told it has been read, and tombstones prevent future syncs restoring it.
        public int DeleteNotifications(IEnumerable<long> notificationIds){
            lock(gate){
                var ids=new HashSet<long>(notificationIds.Where(id=>id>0));
                if(ids.Count==0)return 0;
                var deleted=new HashSet<long>(JsonData.A(data,"deletedIds").Select(value=>Convert.ToInt64(value)));
                ids.ExceptWith(deleted);
                if(ids.Count==0)return 0;
                var messages=JsonData.A(data,"messages").Select(JsonData.D).ToArray();
                var toRead=messages.Where(item=>ids.Contains(JsonData.N(item,"id"))&&!JsonData.B(item,"read"))
                    .Select(item=>JsonData.N(item,"id")).Distinct().ToArray();
                if(toRead.Length>0&&JsonData.A(data,"outbox").Length>=100)
                    throw new CloudFault(409,"outbox_full","Дождись отправки сообщений, чтобы удалить непрочитанные уведомления.");
                deleted.UnionWith(ids);
                data["deletedIds"]=deleted.OrderBy(id=>id).Select(id=>(object)id).ToArray();
                data["messages"]=messages.Where(item=>!deleted.Contains(JsonData.N(item,"id"))).Select(item=>(object)item).ToArray();
                data["unread"]=Math.Max(0,JsonData.N(data,"unread")-toRead.Length);
                if(toRead.Length>0){
                    var rows=JsonData.A(data,"outbox").ToList();
                    rows.Add(new Dictionary<string,object>{{"operation","read"},
                        {"body",new Dictionary<string,object>{{"ids",toRead}}},
                        {"queuedAt",DateTime.UtcNow.ToString("o")}});
                    data["outbox"]=rows.ToArray();
                }
                Save();return ids.Count;
            }
        }
        public int DeleteAllNotifications(){
            long[] ids;
            lock(gate)ids=JsonData.A(data,"messages").Select(item=>JsonData.N(JsonData.D(item),"id")).ToArray();
            return DeleteNotifications(ids);
        }
        public bool HasPendingRole(string roleId){
            lock(gate)return JsonData.A(data,"outbox").Any(raw=>{
                var item=JsonData.D(raw);object body;item.TryGetValue("body",out body);
                return JsonData.S(item,"operation")=="submit"&&JsonData.S(JsonData.D(body),"roleId")==roleId;
            });
        }
        public void Queue(string operation,Dictionary<string,object> body){
            lock(gate){
                var rows=JsonData.A(data,"outbox").ToList();
                if(rows.Count>=100)throw new CloudFault(409,"outbox_full","Сначала дождись отправки накопившихся сообщений.");
                if(operation=="submit"||operation=="feedback")data["failed"]=JsonData.A(data,"failed").Where(raw=>{
                    var item=JsonData.D(raw);object previous;item.TryGetValue("body",out previous);var prior=JsonData.D(previous);
                    return JsonData.S(item,"operation")!=operation||JsonData.S(prior,"roleId")!=JsonData.S(body,"roleId")||JsonData.S(prior,"actorId")!=JsonData.S(body,"actorId");
                }).ToArray();
                rows.Add(new Dictionary<string,object>{{"operation",operation},{"body",body},{"queuedAt",DateTime.UtcNow.ToString("o")}});
                data["outbox"]=rows.ToArray();Save();
            }
        }
        public void MarkRead(long id){
            if(id<=0)return;
            lock(gate){
                bool changed=false;
                data["messages"]=JsonData.A(data,"messages").Select(raw=>{
                    var item=JsonData.D(raw);
                    if(JsonData.N(item,"id")!=id||JsonData.B(item,"read"))return raw;
                    changed=true;var copy=new Dictionary<string,object>(item);copy["read"]=true;return (object)copy;
                }).ToArray();
                if(changed)data["unread"]=Math.Max(0,JsonData.N(data,"unread")-1);
                var rows=JsonData.A(data,"outbox").ToList();
                if(rows.Count>=100)throw new CloudFault(409,"outbox_full","Сначала дождись отправки накопившихся сообщений.");
                rows.Add(new Dictionary<string,object>{{"operation","read"},{"body",new Dictionary<string,object>{{"ids",new long[]{id}}}},
                    {"queuedAt",DateTime.UtcNow.ToString("o")}});
                data["outbox"]=rows.ToArray();Save();
            }
        }
        public int Drain(Func<string,string,object,Dictionary<string,object>> send,bool studio){
            int sent=0;
            for(int index=0;index<10;index++){
                object first;
                lock(gate){var items=JsonData.A(data,"outbox");if(items.Length==0)break;first=items[0];}
                var row=JsonData.D(first);string operation=JsonData.S(row,"operation");object body;row.TryGetValue("body",out body);
                try{send((studio?"/v1/studio/":"/v1/actor/")+(operation=="read"?"notifications/read":operation),"POST",body);}
                catch(CloudFault problem){
                    if(problem.Code=="server_outdated"||problem.Status==401||problem.Status==403||problem.Status>=500||problem.Status==429||problem.Status==0)throw;
                    lock(gate){
                        var failed=JsonData.A(data,"failed").ToList();var copy=new Dictionary<string,object>(row);copy["error"]=problem.Message;
                        failed.Add(copy);data["failed"]=failed.Skip(Math.Max(0,failed.Count-20)).ToArray();
                    }
                }
                lock(gate){
                    var items=JsonData.A(data,"outbox").ToList();
                    if(items.Count>0&&Object.ReferenceEquals(items[0],first))items.RemoveAt(0);
                    data["outbox"]=items.ToArray();Save();
                }
                sent++;
            }
            return sent;
        }
        public Dictionary<string,object> Fetch(Func<string,string,object,Dictionary<string,object>> send,bool studio){
            Dictionary<string,object> latest=null;
            int added=0;
            for(int page=0;page<5;page++){
                long cursor;lock(gate)cursor=JsonData.N(data,"cursor");
                var response=send((studio?"/v1/studio/notifications?after=":"/v1/actor/notifications?after=")+cursor,"GET",null);
                lock(gate){
                    var deleted=new HashSet<long>(JsonData.A(data,"deletedIds").Select(value=>Convert.ToInt64(value)));
                    var messages=JsonData.A(data,"messages").Select(JsonData.D).ToDictionary(item=>JsonData.N(item,"id"));
                    foreach(var raw in JsonData.A(response,"messages")){
                        var item=JsonData.D(raw);long id=JsonData.N(item,"id");
                        if(deleted.Contains(id))continue;
                        if(id>cursor&&!messages.ContainsKey(id)&&!JsonData.B(item,"read")){latest=item;added++;}
                        messages[id]=item;
                    }
                    var readIds=new HashSet<long>();
                    foreach(var raw in JsonData.A(data,"outbox")){
                        var row=JsonData.D(raw);object body;row.TryGetValue("body",out body);
                        if(JsonData.S(row,"operation")=="read")foreach(var id in JsonData.A(JsonData.D(body),"ids")){long parsed;if(Int64.TryParse(Convert.ToString(id),out parsed))readIds.Add(parsed);}
                    }
                    var unreadIds=new HashSet<long>(JsonData.A(response,"unreadIds").Select(id=>Convert.ToInt64(id)));
                    bool authoritative=response.ContainsKey("unreadIds");
                    data["messages"]=messages.Values.Select(item=>{
                        long id=JsonData.N(item,"id");
                        if(!authoritative&&!readIds.Contains(id))return item;
                        var copy=new Dictionary<string,object>(item);copy["read"]=readIds.Contains(id)||!unreadIds.Contains(id);return copy;
                    }).Where(item=>!JsonData.B(item,"read")||JsonData.N(item,"id")>=Math.Max(0,JsonData.N(response,"after")-2000))
                        .OrderBy(item=>JsonData.N(item,"id")).Select(item=>(object)item).ToArray();
                    data["cursor"]=JsonData.N(response,"after");
                    data["unread"]=Math.Max(0,JsonData.N(response,"unread")-readIds.Union(deleted).Count(id=>unreadIds.Contains(id)));Save();
                }
                if(!JsonData.B(response,"hasMore"))break;
            }
            if(latest!=null){var copy=new Dictionary<string,object>(latest);copy["newCount"]=added;return copy;}
            return null;
        }
    }
}
