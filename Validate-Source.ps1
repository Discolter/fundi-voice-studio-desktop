# Validate Studio's startup C# sources using the actual Windows PowerShell compiler.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot
try {
    Add-Type -AssemblyName System.Windows.Forms
    $files = @('LocalServer.cs','ReaperLaunch.cs','CloudCommon.cs','StudioCloud.cs','StudioRecovery.cs','StudioVacations.cs','StudioFiles.cs',
               'FileTransfers.cs','ReviewMailbox.cs','StudioNotifications.cs','UpdateNotice.cs') |
        ForEach-Object { Join-Path (Join-Path $PSScriptRoot 'package') $_ }
    Add-Type -Path $files -ReferencedAssemblies 'System.dll','System.Core.dll',
        'System.Security.dll','System.Web.Extensions.dll','System.Windows.Forms.dll','System.Drawing.dll' -ErrorAction Stop
    Write-Host 'PASS: Studio C# startup sources compile with Windows PowerShell.'
    exit 0
}
catch {
    Write-Error ('Studio C# compile error: ' + $_.Exception.Message)
    exit 1
}
