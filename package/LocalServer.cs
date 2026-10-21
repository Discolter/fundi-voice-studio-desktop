// Fundi Voice local companion. Builds with the .NET Framework bundled with Windows PowerShell.
// No external packages, network services, file uploads, or administrator rights required.
using System;
using System.IO;
using System.Text;
using System.Net;
using System.Net.Sockets;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Diagnostics;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace FundiVoice {
    public static class LocalHost {
        static TcpListener Listener;
        static string WebRoot, DataRoot, DataFile, Key, Origin;
        static int Port;
        static volatile bool Running;
        static StudioCloud Cloud;
        static StudioNotifications Notifications;
        static readonly object SaveLock = new object();
        static readonly object PickLock = new object();
        static readonly object FolderLock = new object();
        static readonly HashSet<string> OpenExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            ".rpp", ".rtracktemplate", ".prproj", ".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".aif", ".aiff",
            ".mp4", ".mkv", ".mov", ".webm", ".avi", ".srt", ".ass", ".ssa", ".vtt", ".txt", ".pdf", ".png", ".jpg", ".jpeg"
        };
        static readonly HashSet<string> StaticFiles = new HashSet<string>(StringComparer.Ordinal) {
            "/", "/index.html", "/app.js", "/core.js", "/file-tools.js", "/file-tools.css", "/styles.css", "/themes.css", "/compact.css", "/icon.svg", "/brand-mark.png", "/favicon.ico"
        };
        static JavaScriptSerializer Json() { return new JavaScriptSerializer { MaxJsonLength = 9 * 1024 * 1024, RecursionLimit = 150 }; }
        static string S(Dictionary<string, object> d, string key) { object v; return d.TryGetValue(key, out v) && v != null ? Convert.ToString(v) : ""; }
        static Dictionary<string, object> Body(string body) {
            if (String.IsNullOrEmpty(body)) return new Dictionary<string, object>();
            var data = Json().DeserializeObject(body) as Dictionary<string, object>;
            if (data == null) throw new ArgumentException("Неверный формат данных.");
            return data;
        }
        public static void Run(string directory) {
            WebRoot = Path.Combine(Path.GetFullPath(directory), "web");
            if (!File.Exists(Path.Combine(WebRoot, "index.html"))) throw new FileNotFoundException("Не найдена папка web. Распакуй весь архив перед запуском.");
            DataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FundiVoice");
            Directory.CreateDirectory(DataRoot);
            DataFile = Path.Combine(DataRoot, "workspace.json");
            bool created;
            using (var mutex = new Mutex(true, "Local\\FundiVoiceStudio-" + Environment.UserName, out created)) {
                if (!created) {
                    string runningFile = Path.Combine(DataRoot, "running.url");
                    if (File.Exists(runningFile)) {
                        string url = File.ReadAllText(runningFile).Trim();
                        if (url.StartsWith("http://127.0.0.1:", StringComparison.Ordinal)) OpenBrowser(url);
                    } else MessageBox.Show("Fundi Voice уже запускается. Подожди несколько секунд.", "Fundi Voice");
                    return;
                }
                try {
                    Key = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
                    for (int candidate = 43827; candidate < 43847; candidate++) {
                        try { Listener = new TcpListener(IPAddress.Loopback, candidate); Listener.Start(32); Port = candidate; break; }
                        catch (SocketException) { if (Listener != null) Listener.Stop(); }
                    }
                    if (Port == 0) throw new IOException("Не удалось открыть локальное приложение. Перезапусти компьютер и попробуй снова.");
                    Origin = "http://127.0.0.1:" + Port;
                    string launchUrl = Origin + "/#key=" + Key;
                    File.WriteAllText(Path.Combine(DataRoot, "running.url"), launchUrl);
                    Running = true;
                    Cloud = new StudioCloud(DataRoot);
                    Notifications=new StudioNotifications(Path.Combine(WebRoot,"favicon.ico"),delegate{OpenBrowser(launchUrl);},delegate{Running=false;Listener.Stop();});
                    Cloud.Notify=delegate(Dictionary<string,object> message){
                        string actor=S(message,"username");
                        try{lock(SaveLock){var workspace=Body(File.ReadAllText(DataFile,Encoding.UTF8));
                            foreach(var rawActor in FundiVoice.Desktop.JsonData.A(workspace,"actors")){
                                var item=FundiVoice.Desktop.JsonData.D(rawActor);if(S(item,"id")==S(message,"actorId")){actor=S(item,"name");break;}
                            }
                        }}catch{}
                        object rawRole;message.TryGetValue("role",out rawRole);var role=FundiVoice.Desktop.JsonData.D(rawRole);
                        string detail=S(role,"projectTitle")+" · "+(S(role,"episodeNumber")!=""?"Серия "+S(role,"episodeNumber")+" · ":"")+S(role,"character");
                        if(detail.Length>220)detail=detail.Substring(0,217)+"…";
                        if(FundiVoice.Desktop.JsonData.N(message,"newCount")>1)detail+="\nЕщё сдач: "+(FundiVoice.Desktop.JsonData.N(message,"newCount")-1);
                        Notifications.Show((actor==""?"Актёр":actor)+" сдал роль",detail);
                    };
                    Cloud.VacationNotify=delegate(string title,string detail){Notifications.Show(title,detail);};
                    Cloud.FileNotify=delegate(int count,string fileName){
                        var title=count==1?"Новая запись актёра":"Новые записи актёров: "+count;
                        var body=count==1?fileName:"Последняя запись: "+fileName;
                        Notifications.Show(title,body+"\nОткрой «Мои файлы» в Studio.");
                    };
                    if(File.Exists(DataFile)){
                        try{Cloud.Queue(Body(File.ReadAllText(DataFile,Encoding.UTF8)));}catch{}
                    }
                    OpenBrowser(launchUrl);
                    while (Running) {
                        try { var client = Listener.AcceptTcpClient(); ThreadPool.QueueUserWorkItem(delegate { Handle(client); }); }
                        catch (SocketException) { if (Running) throw; }
                        catch (ObjectDisposedException) { if (Running) throw; }
                    }
                } finally {
                    Running = false;
                    if(Cloud!=null)Cloud.Dispose();
                    if(Notifications!=null)Notifications.Dispose();
                    if (Listener != null) Listener.Stop();
                    try { File.Delete(Path.Combine(DataRoot, "running.url")); } catch { }
                    mutex.ReleaseMutex();
                }
            }
        }
        static void OpenBrowser(string url) {
            string[] edge = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe")
            };
            foreach (string exe in edge) if (File.Exists(exe)) {
                Process.Start(new ProcessStartInfo(exe, "--app=\"" + url + "\" --window-size=1480,960") { UseShellExecute = false });
                return;
            }
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        static void Handle(TcpClient client) {
            using (client) {
                client.ReceiveTimeout = 10000; client.SendTimeout = 15000;
                using (var stream = client.GetStream()) {
                    try {
                        var headerBytes = new List<byte>(); int b;
                        while ((b = stream.ReadByte()) != -1) {
                            headerBytes.Add((byte)b); int n = headerBytes.Count;
                            if (n > 16384) { SendJson(stream, 413, new { error = "Слишком большой запрос." }); return; }
                            if (n >= 4 && headerBytes[n-4] == 13 && headerBytes[n-3] == 10 && headerBytes[n-2] == 13 && headerBytes[n-1] == 10) break;
                        }
                        if (headerBytes.Count == 0) return;
                        string[] lines = Encoding.ASCII.GetString(headerBytes.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None);
                        string[] first = lines[0].Split(' ');
                        if (first.Length != 3) { SendJson(stream, 400, new { error = "Некорректный запрос." }); return; }
                        string method = first[0], path = first[1].Split('?')[0];
                        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        foreach (string line in lines.Skip(1)) { int colon = line.IndexOf(':'); if (colon > 0) headers[line.Substring(0,colon).Trim()] = line.Substring(colon+1).Trim(); }
                        string host;
                        if (!headers.TryGetValue("Host", out host) || host != "127.0.0.1:" + Port) { SendJson(stream, 403, new { error = "Неверный локальный адрес." }); return; }
                        if (headers.ContainsKey("Transfer-Encoding")) { SendJson(stream, 400, new { error = "Неподдерживаемый формат запроса." }); return; }
                        if (path.StartsWith("/api/", StringComparison.Ordinal)) {
                            string key, origin;
                            if (!headers.TryGetValue("X-Fundi-Key", out key) || key != Key || (headers.TryGetValue("Origin", out origin) && origin != Origin)) { SendJson(stream, 403, new { error = "Сеанс завершён. Запусти START-FUNDI.cmd заново." }); return; }
                            int length = 0;
                            if (headers.ContainsKey("Content-Length") && !Int32.TryParse(headers["Content-Length"], out length)) throw new ArgumentException("Неверная длина данных.");
                            if (length < 0 || length > 8 * 1024 * 1024) { SendJson(stream, 413, new { error = "Рабочее пространство должно быть меньше 8 МБ." }); return; }
                            byte[] body = new byte[length]; int read = 0;
                            while (read < length) { int count = stream.Read(body, read, length-read); if (count == 0) throw new IOException("Передача данных прервалась."); read += count; }
                            Route(stream, method, path.Substring(5), Encoding.UTF8.GetString(body));
                        } else if (method == "GET" && StaticFiles.Contains(path)) {
                            string name = path == "/" ? "index.html" : path.Substring(1);
                            string file = Path.Combine(WebRoot, name);
                            if (!File.Exists(file)) { SendJson(stream, 404, new { error = "Файл приложения не найден." }); return; }
                            string ext = Path.GetExtension(file).ToLowerInvariant();
                            string mime = ext == ".js" ? "text/javascript; charset=utf-8" : ext == ".css" ? "text/css; charset=utf-8" : ext == ".svg" ? "image/svg+xml" : ext == ".png" ? "image/png" : ext == ".ico" ? "image/x-icon" : "text/html; charset=utf-8";
                            Send(stream, 200, File.ReadAllBytes(file), mime);
                        } else SendJson(stream, 404, new { error = "Действие не найдено." });
                    } catch (ArgumentException ex) { TryError(stream, 400, ex.Message); }
                    catch (UnauthorizedAccessException) { TryError(stream, 400, "Нет доступа к выбранной папке или файлу."); }
                    catch (FileNotFoundException) { TryError(stream, 400, "Файл перемещён или удалён. Обнови путь в карточке."); }
                    catch (DirectoryNotFoundException) { TryError(stream, 400, "Папка не найдена. Проверь диск и путь в карточке."); }
                    catch (System.ComponentModel.Win32Exception) { TryError(stream, 400, "Windows не смогла открыть файл. Назначь приложение для этого расширения (для .rpp — REAPER)."); }
                    catch (IOException) { TryError(stream, 400, "Не удалось прочитать или сохранить данные. Проверь доступ к диску и повтори действие."); }
                    catch (Exception) { TryError(stream, 500, "Не удалось выполнить действие. Попробуй снова или перезапусти приложение."); }
                }
            }
        }
        static void Route(NetworkStream stream, string method, string route, string raw) {
            if (method == "GET" && route == "info") { SendJson(stream,200,new { name="Fundi Voice", version="1.8.0", local=true }); return; }
            if (method == "GET" && route == "cloud/status") { SendJson(stream,200,Cloud.Status());return; }
            if (method == "GET" && route == "state") {
                lock (SaveLock) {
                    object data = null;
                    if (File.Exists(DataFile)) {
                        try { data = Json().DeserializeObject(File.ReadAllText(DataFile,Encoding.UTF8)); }
                        catch { throw new ArgumentException("Сохранённый workspace.json повреждён. Восстанови резервную копию через настройки. Исходный файл не перезаписан."); }
                    }
                    SendJson(stream,200,new { state=data }); return;
                }
            }
            if (method != "POST") { SendJson(stream,405,new { error="Неподдерживаемое действие." }); return; }
            var dataBody = Body(raw);
            if(route.StartsWith("cloud/",StringComparison.Ordinal)){
                try{
                    object result;
                    if(route=="cloud/setup-code")result=Cloud.NewSetupCode(S(dataBody,"renew")=="True");
                    else if(route=="cloud/pair"){
                        result=Cloud.Pair(S(dataBody,"server"));
                        if(File.Exists(DataFile))Cloud.Queue(Body(File.ReadAllText(DataFile,Encoding.UTF8)));
                    }
                    else if(route=="cloud/sync")result=Cloud.SyncNow(S(dataBody,"replace")=="True");
                    else if(route=="cloud/invite")result=Cloud.Invite(S(dataBody,"actorId"));
                    else if(route=="cloud/feedback")result=Cloud.Feedback(dataBody);
                    else if(route=="cloud/messages/read")result=Cloud.ReadMessage(FundiVoice.Desktop.JsonData.N(dataBody,"id"));
                    else if(route=="cloud/messages/delete")result=Cloud.DeleteMessage(FundiVoice.Desktop.JsonData.N(dataBody,"id"));
                    else if(route=="cloud/messages/clear")result=Cloud.ClearMessages();
                    else if(route=="cloud/messages/dismiss-failed")result=Cloud.DismissFailures();
                    else if(route=="cloud/vacations/refresh"){Cloud.RefreshVacations(true);result=Cloud.Status();}
                    else if(route=="cloud/vacations/events/read")result=Cloud.ReadVacationEvents(FundiVoice.Desktop.JsonData.A(dataBody,"ids"));
                    else if(route=="cloud/files")result=Cloud.FilesNow();
                    else if(route=="cloud/files/download"){
                        string folder=S(dataBody,"folder");
                        if(folder=="")folder=FundiVoice.Desktop.NativeFileDialogs.Pick(true);
                        if(folder==""){SendJson(stream,200,new{cancelled=true});return;}
                        result=Cloud.DownloadRecording(S(dataBody,"fileId"),ExistingDirectory(folder));
                    }
                    else if(route=="cloud/files/delete")result=Cloud.DeleteRecording(S(dataBody,"fileId"));
                    else if(route=="cloud/files/cleanup")result=Cloud.CleanupRecordings();
                    else if(route=="cloud/transfer/cancel")result=Cloud.CancelTransfer();
                    else if(route=="cloud/disconnect")result=Cloud.Disconnect();
                    else throw new ArgumentException("Неизвестное действие облака.");
                    SendJson(stream,200,result);return;
                }catch(FundiVoice.Desktop.CloudFault problem){SendJson(stream,400,new{error=problem.Message,code=problem.Code});return;}
            }
            if (route == "state") {
                object projects;
                if (S(dataBody,"schema") != "1" || !dataBody.TryGetValue("projects",out projects) || !(projects is object[])) throw new ArgumentException("Неверный формат рабочего пространства.");
                lock (SaveLock) {
                    string temp = DataFile + ".tmp";
                    File.WriteAllText(temp,raw,new UTF8Encoding(false));
                    if (File.Exists(DataFile)) File.Replace(temp,DataFile,Path.Combine(DataRoot,"workspace.previous.json"),true);
                    else File.Move(temp,DataFile);
                }
                try{Cloud.Queue(dataBody);}catch{}
                SendJson(stream,200,new { saved=true }); return;
            }
            if (route == "check") { string path = ExistingPath(S(dataBody,"path")); SendJson(stream,200,new { path=path, folder=Directory.Exists(path) }); return; }
            if (route == "open") { OpenPath(ExistingPath(S(dataBody,"path"))); SendJson(stream,200,new { opened=true }); return; }
            if (route == "pick") { SendJson(stream,200,Pick(S(dataBody,"type") == "folder")); return; }
            if (route == "scan") { SendJson(stream,200,Scan(ExistingDirectory(S(dataBody,"path")))); return; }
            if (route == "detect") { SendJson(stream,200,new { paths=Detect(ExistingDirectory(S(dataBody,"path"))) }); return; }
            if (route == "roles") { SendJson(stream,200,Roles(ExistingDirectory(S(dataBody,"path")),S(dataBody,"subs"))); return; }
            if (route == "inspect-project") { SendJson(stream,200,InspectProject(ExistingDirectory(S(dataBody,"path")))); return; }
            if (route == "create-project") { SendJson(stream,200,CreateProject(ExistingDirectory(S(dataBody,"parent")),S(dataBody,"name"),S(dataBody,"episode"),FolderKeys(dataBody))); return; }
            if (route == "create-episode") { SendJson(stream,200,CreateEpisode(ExistingDirectory(S(dataBody,"parent")),S(dataBody,"name"),FolderKeys(dataBody))); return; }
            if (route == "create-folder") { SendJson(stream,200,CreateFolder(ExistingDirectory(S(dataBody,"parent")),S(dataBody,"name"))); return; }
            if (route == "data-folder") { OpenPath(DataRoot); SendJson(stream,200,new { opened=true }); return; }
            if (route == "shutdown") { SendJson(stream,200,new { saved=true }); Running=false; Listener.Stop(); return; }
            SendJson(stream,404,new { error="Действие не найдено." });
        }
        static string ExistingPath(string raw) {
            if (String.IsNullOrWhiteSpace(raw) || raw.Length > 2000 || raw.IndexOf('\0') >= 0) throw new ArgumentException("Укажи полный путь к файлу или папке.");
            raw = raw.Trim().Trim('"');
            // Drive paths only: no URI schemes, device paths, UNC shares, or shell commands.
            if (raw.Length < 3 || !Char.IsLetter(raw[0]) || raw[1] != ':' || (raw[2] != '\\' && raw[2] != '/') || raw.Substring(2).Contains(":")) throw new ArgumentException("Нужен локальный путь вида D:\\Озвучка\\Проект. Сетевые папки можно подключить как диск Windows.");
            string path = Path.GetFullPath(raw);
            if (!File.Exists(path) && !Directory.Exists(path)) throw new FileNotFoundException();
            return path;
        }
        static string ExistingDirectory(string raw) { string path = ExistingPath(raw); if (!Directory.Exists(path)) throw new ArgumentException("Выбери папку, а не файл."); return path; }
        static string ChildPath(string parent,string name) {
            if (String.IsNullOrWhiteSpace(name) || name.Length>100 || name!=name.Trim() || name=="." || name==".." || name.EndsWith(".") || name.IndexOfAny(Path.GetInvalidFileNameChars())>=0 || name.IndexOf('\\')>=0 || name.IndexOf('/')>=0 || name.Any(c=>c<32)) throw new ArgumentException("Укажи допустимое имя папки без символов <>:\"/\\|?*.");
            string baseName=name.Split('.')[0].ToUpperInvariant();
            if(new[]{"CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9","LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"}.Contains(baseName)) throw new ArgumentException("Это имя зарезервировано Windows. Выбери другое.");
            string path=Path.GetFullPath(Path.Combine(parent,name));
            if(!path.StartsWith(parent.TrimEnd('\\')+"\\",StringComparison.OrdinalIgnoreCase))throw new ArgumentException("Новая папка должна находиться внутри выбранной директории.");
            if(path.Length>240)throw new ArgumentException("Слишком длинный путь. Сократи название или выбери папку ближе к корню диска.");return path;
        }
        static void RequireNewFolder(string path){if(Directory.Exists(path)||File.Exists(path))throw new ArgumentException("Папка с таким именем уже существует. Измени имя или привяжи существующую папку.");}
        static string[] FolderKeys(Dictionary<string,object> data){
            object value; if(!data.TryGetValue("folders",out value))return new[]{"source","voices","render","video","audio","subs","characterSubs","premiere"};
            var list=value as object[];if(list==null||list.Length>8)throw new ArgumentException("Неверный список папок.");return list.Select(v=>Convert.ToString(v)).ToArray();
        }
        static Dictionary<string,string> EpisodeTree(string root,string[] selected){
            var paths=new Dictionary<string,string>();paths["root"]=root;
            paths["source"]=Path.Combine(root,"Исходники");paths["voices"]=Path.Combine(root,"Озвучка");paths["render"]=Path.Combine(root,"Готовое");
            paths["video"]=Path.Combine(paths["source"],"Видео");paths["audio"]=Path.Combine(paths["source"],"Звук");paths["subs"]=Path.Combine(paths["source"],"Сабы");
            paths["characterSubs"]=Path.Combine(paths["subs"],"Персонажи");paths["premiere"]=Path.Combine(paths["video"],"Premiere");
            var keys=new HashSet<string>(selected);foreach(string key in keys.ToArray())if(!paths.ContainsKey(key)||key=="root")throw new ArgumentException("Неизвестная папка.");
            if(keys.Contains("premiere"))keys.Add("video");if(keys.Contains("characterSubs"))keys.Add("subs");if(keys.Overlaps(new[]{"video","audio","subs"}))keys.Add("source");keys.Add("root");
            paths=paths.Where(kv=>keys.Contains(kv.Key)).ToDictionary(kv=>kv.Key,kv=>kv.Value);
            if(paths.Values.Any(p=>p.Length>248))throw new ArgumentException("Путь к подпапкам слишком длинный. Выбери более короткое название.");return paths;
        }
        static object CreateProject(string parent,string name,string episode,string[] folders){
            lock(FolderLock){string root=ChildPath(parent,name);RequireNewFolder(root);string epRoot=ChildPath(root,episode);var paths=EpisodeTree(epRoot,folders);
                foreach(string dir in paths.Values)Directory.CreateDirectory(dir);
                return new {root=root,paths=paths};}
        }
        static object CreateEpisode(string parent,string name,string[] folders){
            lock(FolderLock){string root=ChildPath(parent,name);RequireNewFolder(root);var paths=EpisodeTree(root,folders);foreach(string dir in paths.Values)Directory.CreateDirectory(dir);return new {paths=paths};}
        }
        static object CreateFolder(string parent,string name){
            lock(FolderLock){string path=ChildPath(parent,name);RequireNewFolder(path);Directory.CreateDirectory(path);return new {path=path};}
        }
        static string SeriesNumber(string name){
            var match=System.Text.RegularExpressions.Regex.Match(name,@"^(?:серия|эпизод|episode|ep)[\s_.-]*(\d{1,4})(?:\D|$)|^(\d{1,4})(?:[\s_.-]*(?:серия|эпизод))?$",System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            return match.Success?(match.Groups[1].Success?match.Groups[1].Value:match.Groups[2].Value).TrimStart('0'):"";
        }
        static object InspectProject(string root){
            var episodes=new List<object>();string title=new DirectoryInfo(root).Name,projectRoot=root;
            var children=new DirectoryInfo(root).GetDirectories().Where(Visible).Where(d=>SeriesNumber(d.Name)!="").OrderBy(d=>Int32.Parse(SeriesNumber(d.Name))).ThenBy(d=>d.Name).Take(101).ToList();
            foreach(var child in children.Take(100)){episodes.Add(new {name=child.Name,number=SeriesNumber(child.Name),paths=Detect(child.FullName)});}
            if(episodes.Count==0){string number=SeriesNumber(title);episodes.Add(new {name=title,number=number,paths=Detect(root)});if(number!=""){var parent=Directory.GetParent(root);if(parent!=null){title=parent.Name;projectRoot=parent.FullName;}}}
            var studio=Directory.GetParent(projectRoot);return new {title=title,root=projectRoot,studioRoot=studio!=null?studio.FullName:"",episodes=episodes,truncated=children.Count>100};
        }
        static void OpenPath(string path) {
            if (!Directory.Exists(path) && !OpenExtensions.Contains(Path.GetExtension(path))) throw new ArgumentException("Этот тип файла нельзя открыть из панели. Открой его вручную в Проводнике.");

            if (String.Equals(Path.GetExtension(path), ".rpp", StringComparison.OrdinalIgnoreCase)) {
                // Если REAPER установлен не в стандартную папку, укажи здесь полный путь к reaper.exe.
                // Например: string customReaperExe = @"D:\Audio\REAPER\reaper.exe";
                string customReaperExe = @"";
                string[] candidates = {
                    customReaperExe,
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "REAPER (x64)", "reaper.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "REAPER", "reaper.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "REAPER", "reaper.exe")
                };
                string reaperExe = candidates.FirstOrDefault(candidate => !String.IsNullOrWhiteSpace(candidate) && File.Exists(candidate));
                if (String.IsNullOrEmpty(reaperExe))
                    throw new ArgumentException("REAPER не найден. Укажи путь к reaper.exe в файле LocalServer.cs, переменная customReaperExe.");

                Process.Start(new ProcessStartInfo(reaperExe, "\"" + path + "\"") { UseShellExecute = false });
                return;
            }

            Process.Start(new ProcessStartInfo(path) { UseShellExecute=true, Verb="open" });
        }
        static object Pick(bool folder) {
            lock (PickLock) {
                string selected=""; Exception failure=null;
                var thread = new Thread(delegate() {
                    try {
                        using (var owner = new Form { TopMost=true, ShowInTaskbar=false, Opacity=0, Width=1, Height=1, StartPosition=FormStartPosition.CenterScreen }) {
                            owner.Show(); owner.Activate();
                            if (folder) using (var dialog = new FolderBrowserDialog { Description="Fundi Voice — выбери рабочую папку", ShowNewFolderButton=false, RootFolder=Environment.SpecialFolder.MyComputer }) { if (dialog.ShowDialog(owner)==DialogResult.OK) selected=dialog.SelectedPath; }
                            else using (var dialog = new OpenFileDialog { Title="Fundi Voice — выбери материал", CheckFileExists=true, Multiselect=false, Filter="Материалы озвучки|*.rpp;*.prproj;*.wav;*.mp3;*.flac;*.mp4;*.mkv;*.srt;*.ass;*.vtt|Все файлы|*.*" }) { if (dialog.ShowDialog(owner)==DialogResult.OK) selected=dialog.FileName; }
                        }
                    } catch(Exception ex) { failure=ex; }
                });
                thread.SetApartmentState(ApartmentState.STA); thread.Start(); thread.Join();
                if(failure!=null)throw failure;
                return new { path=selected, folder=folder };
            }
        }
        static string Kind(string name, bool dir) {
            name=name.ToLowerInvariant();
            if(dir) { if(Has(name,"готов","render","export","финал","final","output"))return "render"; if(Has(name,"голос","voice","озвуч","actor","record","запис"))return "voices"; if(Has(name,"саб","суб","subs","subtitle"))return "subs";return "source"; }
            string ext=Path.GetExtension(name);
            if(ext==".rpp")return "reaper";
            if(new[]{".srt",".ass",".ssa",".vtt"}.Contains(ext))return "subs";
            if(new[]{".wav",".mp3",".flac",".ogg",".m4a",".aac",".aif",".aiff"}.Contains(ext))return "voices";
            return "source";
        }
        static bool Has(string text, params string[] words) { return words.Any(w=>text.IndexOf(w,StringComparison.OrdinalIgnoreCase)>=0); }
        static bool Visible(FileSystemInfo item) { return (item.Attributes & (FileAttributes.Hidden | FileAttributes.System | FileAttributes.ReparsePoint)) == 0; }
        static object Scan(string root) {
            var items=new List<object>(); bool truncated=false,skipped=false; int visited=0;
            var queue=new Queue<KeyValuePair<string,int>>(); queue.Enqueue(new KeyValuePair<string,int>(root,0));
            while(queue.Count>0 && !truncated) {
                var current=queue.Dequeue();
                try {
                    foreach(var item in new DirectoryInfo(current.Key).EnumerateFileSystemInfos()) {
                        if(++visited>10000){truncated=true;break;}
                        if(!Visible(item))continue;
                        bool dir=(item.Attributes&FileAttributes.Directory)!=0;
                        if(dir || OpenExtensions.Contains(item.Extension)) {
                            if(items.Count>=400){truncated=true;break;}
                            items.Add(new { name=item.Name,path=item.FullName,relative=item.FullName.Substring(root.TrimEnd('\\','/').Length).TrimStart('\\','/'),folder=dir,kind=Kind(item.Name,dir) });
                        }
                        if(dir && current.Value<3)queue.Enqueue(new KeyValuePair<string,int>(item.FullName,current.Value+1));
                    }
                } catch(UnauthorizedAccessException){skipped=true;}catch(IOException){skipped=true;}
            }
            return new { items=items, truncated=truncated, skipped=skipped };
        }
        static string FindDir(string parent, params string[] names) {
            if(String.IsNullOrEmpty(parent)||!Directory.Exists(parent))return "";
            return new DirectoryInfo(parent).GetDirectories().Where(Visible).OrderBy(d=>d.Name).Where(d=>names.Any(n=>String.Equals(d.Name,n,StringComparison.OrdinalIgnoreCase))).Select(d=>d.FullName).FirstOrDefault()??"";
        }
        static Dictionary<string,string> Detect(string root) {
            var paths=new Dictionary<string,string>(); paths["root"]=root;
            paths["source"]=FindDir(root,"Исходники","Исходник","Source","Sources");
            paths["voices"]=FindDir(root,"Озвучка","Голоса","Voice","Voices","Dubbing");
            paths["render"]=FindDir(root,"Готовое","Готово","Готовые","Render","Renders","Final","Export");
            paths["video"]=FindDir(paths["source"],"Видео","Video");
            paths["audio"]=FindDir(paths["source"],"Звук","Аудио","Audio","Sound","UVR");
            paths["subs"]=FindDir(paths["source"],"Сабы","Субтитры","Subs","Subtitles");
            paths["characterSubs"]=FindDir(paths["subs"],"Персонажи","Персонаж","Characters","Character");
            paths["premiere"]=FindDir(paths["video"],"Premiere","Premiere Pro","Проект Premiere");
            if(paths["premiere"]=="")paths["premiere"]=FindDir(paths["source"],"Premiere","Premiere Pro");
            string[] rpp=Directory.GetFiles(root,"*.rpp",SearchOption.TopDirectoryOnly);
            if(rpp.Length==1)paths["reaper"]=rpp[0];
            return paths.Where(kv=>!String.IsNullOrEmpty(kv.Value)).ToDictionary(kv=>kv.Key,kv=>kv.Value);
        }
        static object Roles(string root,string subs) {
            var folders=new DirectoryInfo(root).GetDirectories().Where(Visible).OrderBy(d=>d.Name).Take(401).ToList();
            var subtitles=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
            if(!String.IsNullOrEmpty(subs)) {
                subs=ExistingDirectory(subs);
                foreach(var f in new DirectoryInfo(subs).GetFiles().Where(Visible).Where(f=>new[]{".srt",".ass"}.Contains(f.Extension.ToLowerInvariant())).OrderBy(f=>f.Extension==".srt"?0:1).Take(2000)) {
                    string name=Path.GetFileNameWithoutExtension(f.Name).Trim(); if(!subtitles.ContainsKey(name))subtitles[name]=f.FullName;
                }
            }
            return new { items=folders.Take(400).Select(d=>new { name=d.Name,folder=d.FullName,subtitle=subtitles.ContainsKey(d.Name.Trim())?subtitles[d.Name.Trim()]:"" }).ToList(),truncated=folders.Count>400 };
        }
        static void TryError(NetworkStream stream,int status,string message){try{SendJson(stream,status,new {error=message});}catch{}}
        static void SendJson(NetworkStream stream,int status,object value){Send(stream,status,Encoding.UTF8.GetBytes(Json().Serialize(value)),"application/json; charset=utf-8");}
        static void Send(NetworkStream stream,int status,byte[] body,string mime){
            string label=status==200?"OK":status==404?"Not Found":status==403?"Forbidden":status==413?"Payload Too Large":"Bad Request";
            string header="HTTP/1.1 "+status+" "+label+"\r\nContent-Type: "+mime+"\r\nContent-Length: "+body.Length+"\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\r\n\r\n";
            byte[] bytes=Encoding.ASCII.GetBytes(header);stream.Write(bytes,0,bytes.Length);stream.Write(body,0,body.Length);stream.Flush();
        }
    }
}
