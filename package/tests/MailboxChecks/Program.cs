using System.Collections;
using System.Globalization;
using System.Text.Json;
using FundiVoice.Desktop;
int passed=0;
void Check(bool condition,string text){if(!condition)throw new Exception(text);passed++;Console.WriteLine("PASS: "+text);}
Dictionary<string,object> Map(object value)=>value as Dictionary<string,object> ?? JsonData.D(PrivateFile.ConvertJson(JsonDocument.Parse(JsonSerializer.Serialize(value)).RootElement));
var directory=Path.Combine(Path.GetTempPath(),"fundi-mailbox-"+Guid.NewGuid());Directory.CreateDirectory(directory);
try{
 var mailbox=new ReviewMailbox(directory);mailbox.Bind("https://test.example.com","actor_a");
 var body=new Dictionary<string,object>{{"roleId","role-a"},{"requestId",Guid.NewGuid().ToString("D")}};
 mailbox.Queue("submit",body);
 var restored=new ReviewMailbox(directory);
 Check(restored.HasPendingRole("role-a"),"Submission survives a mailbox restart before sending");
 try{restored.Drain((p,m,b)=>throw new CloudFault(503,"temporarily_unavailable","Server sleeping"),false);}catch(CloudFault){}
 Check(new ReviewMailbox(directory).HasPendingRole("role-a"),"A sleeping server retains the submission on disk");
 string requestId="";
 var count=restored.Drain((p,m,b)=>{
  Check(new ReviewMailbox(directory).HasPendingRole("role-a"),"Outbox is durable before the network request");
  Check(p=="/v1/actor/submit"&&m=="POST","Submission uses the authenticated actor endpoint");
  requestId=JsonData.S(Map(b),"requestId");return new Dictionary<string,object>();
 },false);
 Check(count==1&&!new ReviewMailbox(directory).HasPendingRole("role-a")&&requestId==JsonData.S(body,"requestId"),"Acknowledged submissions leave the persistent queue");
 var message=new Dictionary<string,object>{{"id",20L},{"read",false},{"text","Private note"}};
 var response=new Dictionary<string,object>{{"messages",new object[]{message}},{"after",20L},{"hasMore",false},{"unread",1L},{"unreadIds",new long[]{20}}};
 Check(restored.Fetch((p,m,b)=>response,false)!=null,"New unread feedback requests a Windows notification");
 restored.MarkRead(20);
 restored.Fetch((p,m,b)=>response,false);
 var view=Map(restored.View());
 Check(JsonData.N(view,"unread")==0&&JsonData.B(Map(JsonData.A(view,"messages")[0]),"read"),"Offline read acknowledgement does not flicker back to unread");
 restored.Drain((p,m,b)=>new Dictionary<string,object>(),false);
 var restarted=new ReviewMailbox(directory);
 var noNew=new Dictionary<string,object>{{"messages",new object[0]},{"after",20L},{"hasMore",false},{"unread",0L},{"unreadIds",new long[0]}};
 Check(restarted.Fetch((p,m,b)=>{Check(p.EndsWith("after=20"),"Notification cursor survives restart");return noNew;},false)==null,"Cached messages do not notify again after restart");
 restarted.Queue("feedback",new Dictionary<string,object>{{"roleId","role-old"},{"text","KEEP THIS REVIEW"}});
 restarted.Drain((p,m,b)=>throw new CloudFault(409,"review_changed","A new recording arrived"),true);
 var failedView=Map(new ReviewMailbox(directory).View());
 Check(JsonData.A(failedView,"pending").Length==0&&JsonData.S(Map(Map(JsonData.A(failedView,"failed")[0])["body"]),"text")=="KEEP THIS REVIEW",
  "A stale review preserves its text for the owner instead of blocking all later messages");
 var anotherMessage=new Dictionary<string,object>{{"id",21L},{"read",false},{"text","Another review"}};
 var thirdMessage=new Dictionary<string,object>{{"id",22L},{"read",false},{"text","Final review"}};
 var twoMessages=new Dictionary<string,object>{{"messages",new object[]{anotherMessage,thirdMessage}},
  {"after",22L},{"hasMore",false},{"unread",2L},{"unreadIds",new long[]{21,22}}};
 restarted.Fetch((p,m,b)=>twoMessages,false);
 Check(restarted.DeleteNotifications(new long[]{21})==1,"Delete one notification");
 var afterDelete=Map(new ReviewMailbox(directory).View());
 Check(JsonData.N(afterDelete,"unread")==1&&JsonData.A(afterDelete,"messages").Length==2,
  "Deleted notification is absent from persisted mailbox and unread count decreases");
 restarted.Fetch((p,m,b)=>twoMessages,false);
 var afterRefetch=Map(new ReviewMailbox(directory).View());
 Check(JsonData.A(afterRefetch,"messages").Length==2&&JsonData.N(afterRefetch,"unread")==1,
  "A server sync cannot resurrect a locally deleted notification or its unread badge");
 Check(restarted.DeleteAllNotifications()==2,"Delete all cached notifications");
 restarted.Fetch((p,m,b)=>twoMessages,false);
 var empty=Map(new ReviewMailbox(directory).View());
 Check(JsonData.A(empty,"messages").Length==0&&JsonData.N(empty,"unread")==0,
  "Clear all notifications remains effective after sync and app restart");
 restarted.Bind("https://test.example.com","actor_b");
 var switched=Map(restarted.View());
 Check(JsonData.A(switched,"messages").Length==0&&JsonData.A(switched,"failed").Length==0,"Switching accounts clears previous private messages and pending work");
 Console.WriteLine(passed+" durable mailbox checks passed.");
}finally{Directory.Delete(directory,true);}

namespace FundiVoice.Desktop{
 // Portable storage adapter for queue tests; production uses Windows DPAPI.
 public class CloudFault(int status,string code,string text):Exception(text){public int Status=status;public string Code=code;}
 public static class JsonData{
  public static Dictionary<string,object> D(object value)=>value as Dictionary<string,object>??new();
  public static string S(Dictionary<string,object> d,string key)=>d.TryGetValue(key,out var v)&&v!=null?Convert.ToString(v,CultureInfo.InvariantCulture):"";
  public static long N(Dictionary<string,object> d,string key)=>long.TryParse(S(d,key),out var value)?value:0;
  public static bool B(Dictionary<string,object> d,string key)=>d.TryGetValue(key,out var value)&&value is true;
  public static object[] A(Dictionary<string,object> d,string key)=>d.TryGetValue(key,out var value)&&value is IEnumerable items&&value is not string?items.Cast<object>().ToArray():[];
 }
 public static class PrivateFile{
  public static object ConvertJson(JsonElement e)=>e.ValueKind switch{
   JsonValueKind.Object=>e.EnumerateObject().ToDictionary(p=>p.Name,p=>ConvertJson(p.Value)),
   JsonValueKind.Array=>e.EnumerateArray().Select(ConvertJson).ToArray(),JsonValueKind.String=>e.GetString(),
   JsonValueKind.Number=>e.GetInt64(),JsonValueKind.True=>true,JsonValueKind.False=>false,_=>null};
  public static Dictionary<string,object> Read(string path)=>File.Exists(path)?JsonData.D(ConvertJson(JsonDocument.Parse(File.ReadAllText(path)).RootElement)):new();
  public static void Save(string path,Dictionary<string,object> value)=>File.WriteAllText(path,JsonSerializer.Serialize(value));
 }
}
