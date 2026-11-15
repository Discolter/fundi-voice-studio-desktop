using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;
using System.Threading;
using FundiVoice;
using FundiVoice.Desktop;

public static class PublicationChecks {
    static int checks;
    static Dictionary<string,object> roster,workspace,sent;
    static long revision;
    static bool race,staleSnapshot,legacyServer;
    static readonly List<string> calls=new List<string>();
    static Dictionary<string,object> Parse(string json){return JsonData.D(JsonData.Json().DeserializeObject(json));}
    static void Check(bool ok,string message){if(!ok)throw new Exception(message);checks++;}
    static object[] Rows(Dictionary<string,object> actor){return JsonData.A(JsonData.D(actor["feed"]),"roles");}
    static Dictionary<string,object> Actor(string id){return JsonData.A(sent,"actors").Select(JsonData.D).Single(a=>JsonData.S(a,"actorId")==id);}
    static void Reset(){
        calls.Clear();sent=null;race=false;staleSnapshot=false;legacyServer=false;revision=12;
        workspace=Parse(@"{""actors"":[{""id"":""a"",""name"":""Actor A"",""actorAccess"":true},{""id"":""b"",""name"":""Actor B"",""actorAccess"":true}],""projects"":[{""id"":""p"",""title"":""Project"",""episodes"":[{""id"":""e"",""roles"":[{""id"":""r"",""actorId"":""b"",""character"":""Hero"",""status"":""waiting"",""roleTier"":""extras""},{""id"":""r2"",""actorId"":""a"",""character"":""Hero"",""status"":""waiting""}]},{""id"":""other"",""roles"":[{""id"":""other-role"",""actorId"":""b"",""character"":""Unpublished draft"",""status"":""waiting""}]}]}]}");
        roster=Parse(@"{""actors"":[{""actorId"":""a"",""enabled"":true,""profile"":{""name"":""Published A""},""feed"":{""version"":1,""actorId"":""a"",""roles"":[{""roleId"":""r"",""projectId"":""p"",""episodeId"":""e"",""character"":""Hero"",""status"":""done"",""roleTier"":""main""},{""roleId"":""other-role"",""projectId"":""p"",""episodeId"":""other"",""character"":""Published character"",""status"":""recording""}]}},{""actorId"":""b"",""enabled"":true,""profile"":{""name"":""Published B""},""feed"":{""version"":1,""actorId"":""b"",""roles"":[]}},{""actorId"":""disabled"",""enabled"":false,""profile"":{""name"":""Disabled""},""feed"":{""version"":1,""actorId"":""disabled"",""roles"":[]}}]}");
    }
    static Dictionary<string,object> Request(string server,string path,string method,object body,string token){
        calls.Add(path+" "+method);
        if(path=="/v1/studio/tasks")return Parse("{\"version\":"+(staleSnapshot?8:7)+"}");
        if(path=="/v1/studio/sync-status")return Parse("{\"revision\":"+revision+",\"publicationSnapshotGuard\":"+(legacyServer?"false":"true")+"}");
        if(path=="/v1/studio/web/roster"){
            var copy=Parse(JsonData.Json().Serialize(roster));
            if(race)revision++; // An actor submits after this roster was read.
            return copy;
        }
        if(path=="/v1/studio/roster"&&method=="PUT"){
            var candidate=Parse(JsonData.Json().Serialize(body));
            if(JsonData.N(candidate,"baseRevision")!=revision)throw new CloudFault(409,"revision_conflict","Changed concurrently");
            foreach(var actor in JsonData.A(candidate,"actors").Select(JsonData.D))
                if(!JsonData.B(actor,"enabled")&&actor["feed"]!=null)
                    throw new CloudFault(400,"invalid_roster","Disabled actors require a null feed");
            sent=candidate;
            return Parse("{\"revision\":"+(++revision)+"}");
        }
        throw new Exception("Unexpected network request "+path);
    }
    static void ExpectFault(StudioCloud cloud,string code){
        try{cloud.PublishEpisodeRoles(workspace,"p","e",7);throw new Exception("Expected "+code);}
        catch(CloudFault fault){Check(fault.Code==code,"Wrong error: "+fault.Code+" instead of "+code);}
        Check(sent==null,"A rejected publication must not write any roster");
    }
    public static int Main(string[] args){
        try{
            var directory=Path.Combine(args[0],"state");Directory.CreateDirectory(directory);
            using(var cloud=new StudioCloud(directory)){
                var fields=BindingFlags.Instance|BindingFlags.NonPublic;
                ((Timer)typeof(StudioCloud).GetField("timer",fields).GetValue(cloud)).Change(Timeout.Infinite,Timeout.Infinite);
                typeof(StudioCloud).GetField("connection",fields).SetValue(cloud,Parse(@"{""server"":""https://fixture.example"",""token"":""fixture-only""}"));
                CloudHttp.Handler=Request;
                Reset();
                cloud.PublishEpisodeRoles(workspace,"p","e",7);
                Check(sent!=null,"Expected a successful publication with an unrelated disabled actor");
                Check(Actor("disabled")["feed"]==null&&!JsonData.B(Actor("disabled"),"enabled"),"Unrelated disabled actor stays disabled");
                Check(JsonData.N(sent,"baseSnapshotVersion")==7,"Approved snapshot version must reach the server's atomic guard");
                var moved=Rows(Actor("b")).Select(JsonData.D).Single();
                Check(JsonData.S(moved,"roleId")=="r"&&JsonData.S(moved,"status")=="done"&&JsonData.S(moved,"roleTier")=="main","Transfer preserves live status and category");
                var kept=Rows(Actor("a")).Select(JsonData.D).ToArray();
                Check(kept.Length==2&&kept.Any(r=>JsonData.S(r,"roleId")=="r2"),"Another performer can receive a separate role for the same character");
                Check(kept.Any(r=>JsonData.S(r,"episodeId")=="other"&&JsonData.S(r,"character")=="Published character"&&JsonData.S(r,"status")=="recording"),"Other episodes keep their published cast and metadata");
                Check(!kept.Any(r=>JsonData.S(r,"roleId")=="r"),"The old performer loses the transferred assignment");
                Reset();JsonData.D(JsonData.A(roster,"actors")[1])["enabled"]=false;
                cloud.PublishEpisodeRoles(workspace,"p","e",7);
                Check(JsonData.B(Actor("b"),"enabled")&&Rows(Actor("b")).Length==1,"Explicitly approved assignments can re-enable an allowed actor");
                Reset();legacyServer=true;cloud.PublishEpisodeRoles(workspace,"p","e",7);
                Check(!sent.ContainsKey("baseSnapshotVersion"),"Older servers receive only supported request fields");
                Reset();race=true;ExpectFault(cloud,"revision_conflict");
                Check(calls.IndexOf("/v1/studio/sync-status GET")<calls.IndexOf("/v1/studio/web/roster GET"),"Read the revision before the roster it protects");
                Reset();staleSnapshot=true;ExpectFault(cloud,"task_version_conflict");
                Reset();JsonData.D(JsonData.A(workspace,"actors")[1])["actorAccess"]=false;
                ExpectFault(cloud,"actor_access_disabled");
                Reset();
                var project=JsonData.D(JsonData.A(workspace,"projects")[0]);
                JsonData.D(JsonData.A(project,"episodes")[0])["roles"]=new object[0];
                var result=Parse(JsonData.Json().Serialize(cloud.PublishEpisodeRoles(workspace,"p","e",7)));
                Check(JsonData.N(result,"publishedRoles")==0,"An empty episode removes its published assignments");
                Check(JsonData.N(result,"affectedActors")>=1,"Removed assignments count their previous performers");
                Check(Rows(Actor("a")).Length==1&&Rows(Actor("b")).Length==0,"Clearing an episode preserves other episodes");
            }
            Console.WriteLine("PASS: "+checks+" native publication behavior checks");return 0;
        }catch(Exception error){Console.Error.WriteLine(error);return 1;}
    }
}
