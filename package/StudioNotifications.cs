using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace FundiVoice {
    public sealed class StudioNotifications : IDisposable {
        Control dispatcher;
        NotifyIcon tray;
        readonly ManualResetEvent ready=new ManualResetEvent(false);
        volatile bool disposed;
        public StudioNotifications(string icon,Action open,Action exit){
            var thread=new Thread(delegate(){
                try{
                    dispatcher=new Control();dispatcher.CreateControl();
                    tray=new NotifyIcon{Text="Fundi Voice Studio",Icon=SystemIcons.Information,Visible=true};
                    if(File.Exists(icon)){try{tray.Icon=new Icon(icon);}catch{}}
                    var menu=new ContextMenuStrip();
                    menu.Items.Add("Открыть Fundi Voice Studio",null,delegate{open();});
                    menu.Items.Add("Выход",null,delegate{exit();});
                    tray.ContextMenuStrip=menu;tray.DoubleClick+=delegate{open();};tray.BalloonTipClicked+=delegate{open();};
                    ready.Set();if(!disposed)Application.Run();
                }catch{ready.Set();}
                finally{if(tray!=null){tray.Visible=false;tray.Dispose();}if(dispatcher!=null)dispatcher.Dispose();}
            });
            thread.IsBackground=true;thread.SetApartmentState(ApartmentState.STA);thread.Start();ready.WaitOne(5000);
        }
        public void Show(string title,string text){
            if(disposed||dispatcher==null||dispatcher.IsDisposed)return;
            if(title.Length>60)title=title.Substring(0,57)+"…";
            if(text.Length>250)text=text.Substring(0,247)+"…";
            try{dispatcher.BeginInvoke((Action)delegate{if(tray!=null)tray.ShowBalloonTip(7000,title,text,ToolTipIcon.Info);});}catch{}
        }
        public void Dispose(){
            disposed=true;
            if(dispatcher!=null&&!dispatcher.IsDisposed){try{dispatcher.BeginInvoke((Action)delegate{Application.ExitThread();});}catch{}}
        }
    }
}
