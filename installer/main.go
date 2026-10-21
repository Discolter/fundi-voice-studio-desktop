//go:build windows
// Fundi Voice Studio self-contained, per-user Windows setup/upgrade executable.
package main

import (
    "archive/zip"
    "bytes"
    _ "embed"
    "fmt"
    "io"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
    "syscall"
    "unsafe"
)

//go:embed payload.zip
var payload []byte

var version = "1.6.3" // Set at build time from package/VERSION.txt
const appName = "Fundi Voice Studio"
const uninstallKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\FundiVoiceStudio`
const createNoWindow = 0x08000000
const mbYesNoInfo = 0x00000004 | 0x00000040 | 0x00010000
const mbRetryCancelWarning = 0x00000005 | 0x00000030 | 0x00010000
const mbError = 0x00000010
const mbInformation = 0x00000040

func dialog(title, message string, flags uintptr) uintptr {
    pTitle, _ := syscall.UTF16PtrFromString(title)
    pMsg, _ := syscall.UTF16PtrFromString(message)
    r, _, _ := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(pMsg)), uintptr(unsafe.Pointer(pTitle)), flags)
    return r
}
func psQuote(v string) string { return "'" + strings.ReplaceAll(v, "'", "''") + "'" }
func runQuiet(path string, args ...string) error {
    cmd := exec.Command(path, args...)
    cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow:true, CreationFlags:createNoWindow}
    output, err := cmd.CombinedOutput()
    if err != nil {return fmt.Errorf("%s: %w (%s)",filepath.Base(path),err,strings.TrimSpace(string(output)))}
    return nil
}
func powershell() string {return filepath.Join(os.Getenv("SystemRoot"),"System32","WindowsPowerShell","v1.0","powershell.exe")}
func isStudioRunning() bool {
    name, _ := syscall.UTF16PtrFromString(`Local\FundiVoiceStudio-` + os.Getenv("USERNAME"))
    proc := syscall.NewLazyDLL("kernel32.dll").NewProc("OpenMutexW")
    handle, _, _ := proc.Call(0x00100000,0,uintptr(unsafe.Pointer(name)))
    if handle == 0 {return false}
    syscall.NewLazyDLL("kernel32.dll").NewProc("CloseHandle").Call(handle)
    return true
}
func extractInto(dest string) error {
    z,err:=zip.NewReader(bytes.NewReader(payload),int64(len(payload)))
    if err!=nil{return fmt.Errorf("Не удалось прочитать файлы установщика: %w",err)}
    for _,f:=range z.File {
        if f.FileInfo().IsDir() {continue}
        // Reject any absolute or traversal paths even if someone replaces the embedded ZIP.
        name:=filepath.FromSlash(f.Name)
        if filepath.IsAbs(name)||name==".."||strings.HasPrefix(name,".."+string(filepath.Separator))||strings.Contains(name,":") {
            return fmt.Errorf("Недопустимый путь в установщике: %q",f.Name)
        }
        target:=filepath.Join(dest,name)
        if err:=os.MkdirAll(filepath.Dir(target),0755);err!=nil{return err}
        read,err:=f.Open();if err!=nil{return err}
        out,err:=os.OpenFile(target,os.O_CREATE|os.O_TRUNC|os.O_WRONLY,0644)
        if err!=nil {_=read.Close();return err}
        _,copyErr:=io.Copy(out,read)
        closeErr:=out.Close()
        _=read.Close()
        if copyErr!=nil{return copyErr}
        if closeErr!=nil{return closeErr}
    }
    return nil
}
func installFiles(dest string) error {
    parent:=filepath.Dir(dest)
    if err:=os.MkdirAll(parent,0755);err!=nil{return err}
    stage,err:=os.MkdirTemp(parent,".FundiVoiceStudio-new-")
    if err!=nil{return err}
    defer os.RemoveAll(stage)
    if err=extractInto(stage);err!=nil{return err}
    _,err=os.Stat(dest)
    wasInstalled:=err==nil
    if err!=nil&&!os.IsNotExist(err){return err}
    backup:=""
    if wasInstalled {
        // Protect folders not originally created by this installer.
        if _,err=os.Stat(filepath.Join(dest,"FundiVoiceStudio.exe"));err!=nil {
            return fmt.Errorf("В папке установки уже находятся другие файлы: %s. Переименуйте папку вручную и повторите установку",dest)
        }
        backup,err=os.MkdirTemp(parent,".FundiVoiceStudio-old-")
        if err!=nil{return err}
        _=os.Remove(backup)
        if err=os.Rename(dest,backup);err!=nil{return fmt.Errorf("Не удалось закрыть старую версию или переименовать её папку: %w",err)}
    }
    if err=os.Rename(stage,dest);err!=nil {
        if backup!="" {_=os.Rename(backup,dest)}
        return fmt.Errorf("Не удалось установить новые файлы (старая версия восстановлена, если была): %w",err)
    }
    if backup!="" {_=os.RemoveAll(backup)}
    return nil
}
func makeShortcuts(dest string) error {
    target:=filepath.Join(dest,"FundiVoiceStudio.exe")
    icon:=filepath.Join(dest,"web","FundiVoiceStudio-1.7.0.ico")
    script:=fmt.Sprintf(`$ErrorActionPreference = 'Stop'
$exe = %s
$cwd = %s
$ico = %s
$ws = New-Object -ComObject WScript.Shell
$paths = @([IO.Path]::Combine([Environment]::GetFolderPath('Desktop'),'Fundi Voice Studio.lnk'),[IO.Path]::Combine([Environment]::GetFolderPath('Programs'),'Fundi Voice Studio.lnk'))
foreach ($p in $paths) {
  $shortcut = $ws.CreateShortcut($p)
  $shortcut.TargetPath = $exe
  $shortcut.WorkingDirectory = $cwd
  $shortcut.IconLocation = $ico
  $shortcut.Description = 'Fundi Voice Studio'
  $shortcut.Save()
}
`,psQuote(target),psQuote(dest),psQuote(icon))
    tmp,err:=os.CreateTemp("","fundi-shortcuts-*.ps1");if err!=nil{return err}
    defer os.Remove(tmp.Name())
    if _,err=tmp.WriteString(script);err!=nil{_=tmp.Close();return err}
    if err=tmp.Close();err!=nil{return err}
    return runQuiet(powershell(),"-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-WindowStyle","Hidden","-File",tmp.Name())
}
func writeRegistry(dest string) error {
    values:=[][3]string{
        {"DisplayName","REG_SZ",appName},
        {"DisplayVersion","REG_SZ",version},
        {"Publisher","REG_SZ","FundiVoice"},
        {"DisplayIcon","REG_SZ",filepath.Join(dest,"web","FundiVoiceStudio-1.7.0.ico")},
        {"InstallLocation","REG_SZ",dest},
        {"UninstallString","REG_SZ",`"`+filepath.Join(dest,"Uninstall.exe")+`"`},
        {"NoModify","REG_DWORD","1"},
        {"NoRepair","REG_DWORD","1"},
    }
    for _,v:=range values {
        if err:=runQuiet("reg.exe","ADD",uninstallKey,"/v",v[0],"/t",v[1],"/d",v[2],"/f");err!=nil{return err}
    }
    return nil
}
func main() {
    title:=fmt.Sprintf("%s — установка %s",appName,version)
    localAppData:=os.Getenv("LOCALAPPDATA")
    if localAppData=="" {dialog(title,"Не удалось определить LOCALAPPDATA текущего пользователя Windows.",mbError);return}
    dest:=filepath.Join(localAppData,"Programs","Fundi Voice Studio")
    installed:=false
    if _,err:=os.Stat(filepath.Join(dest,"FundiVoiceStudio.exe"));err==nil {installed=true}
    question:=fmt.Sprintf("Установить Fundi Voice Studio %s?\n\nПапка: %s\n\nПосле установки программа запускается с ярлыка или FundiVoiceStudio.exe. Все личные данные останутся в %%LOCALAPPDATA%%\\FundiVoice.\n\nПродолжить?",version,dest)
    if installed {question=fmt.Sprintf("Обновить Fundi Voice Studio до версии %s поверх установленной программы?\n\nПапка: %s\n\nПроекты, актёры, настройки и облачные ключи сохранятся. Удалять прежнюю версию не нужно.\n\nПродолжить?",version,dest)}
    if dialog(title,question,mbYesNoInfo)!=6 {return}
    for isStudioRunning() {
        if dialog(title,"Studio сейчас работает, возможно, свёрнута в трей.\n\nВ программе выберите Настройки → Завершить приложение либо нажмите правой кнопкой на значке у часов и выберите Выход.\n\nЗатем нажмите «Повторить». Данные должны быть сохранены до обновления.",mbRetryCancelWarning)!=4 {return}
    }
    if err:=installFiles(dest);err!=nil {dialog(title,"Установка не удалась:\n\n"+err.Error(),mbError);return}
    var warnings []string
    if err:=makeShortcuts(dest);err!=nil {warnings=append(warnings,"Не удалось создать ярлыки: "+err.Error())}
    if err:=writeRegistry(dest);err!=nil {warnings=append(warnings,"Не удалось добавить программу в список приложений: "+err.Error())}
    if len(warnings)>0 {
        dialog(title,"Программа установлена, но есть замечания:\n\n"+strings.Join(warnings,"\n\n")+"\n\nВы можете запустить FundiVoiceStudio.exe из папки установки.",0x30)
    }
    done:="Fundi Voice Studio "+version+" успешно установлена!\n\nЯрлык добавлен на рабочий стол и в меню Пуск.\n\nДля следующего обновления достаточно запустить новый установщик.\n\nЗапустить программу сейчас?"
    if len(warnings)>0 {done="Файлы Studio установлены.\n\nЗапустить FundiVoiceStudio.exe сейчас?"}
    if dialog(title,done,mbYesNoInfo)==6 {
        launcher:=exec.Command(filepath.Join(dest,"FundiVoiceStudio.exe"))
        launcher.Dir=dest
        if err:=launcher.Start();err!=nil {dialog(title,"Не удалось открыть Studio: "+err.Error(),mbError)} else {_=launcher.Process.Release()}
    }
}
