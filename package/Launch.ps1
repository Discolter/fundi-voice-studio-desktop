$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -Path @((Join-Path $PSScriptRoot 'LocalServer.cs'), (Join-Path $PSScriptRoot 'ReaperLaunch.cs'), (Join-Path $PSScriptRoot 'CloudCommon.cs'), (Join-Path $PSScriptRoot 'StudioCloud.cs'), (Join-Path $PSScriptRoot 'StudioVacations.cs'), (Join-Path $PSScriptRoot 'StudioFiles.cs'), (Join-Path $PSScriptRoot 'FileTransfers.cs'), (Join-Path $PSScriptRoot 'ReviewMailbox.cs'), (Join-Path $PSScriptRoot 'StudioNotifications.cs'), (Join-Path $PSScriptRoot 'UpdateNotice.cs')) -ReferencedAssemblies 'System.dll','System.Core.dll','System.Security.dll','System.Web.Extensions.dll','System.Windows.Forms.dll','System.Drawing.dll'
    [FundiVoice.LocalHost]::Run($PSScriptRoot)
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Fundi Voice - startup error') | Out-Null
}
