# Fundi Voice Studio updater bootstrap installer (Windows x64)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot
if (-not (Get-Command go -ErrorAction SilentlyContinue)) { throw 'Нужен Go 1.23+ на компьютере сборки.' }
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw 'Нужен Python 3 на компьютере сборки.' }
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File '.\Validate-Source.ps1'
if ($LASTEXITCODE -ne 0) { throw 'Ошибка компиляции C#.' }
& go test ./launcher ./tools/...
if ($LASTEXITCODE -ne 0) { throw 'Ошибка тестов обновления.' }
$version=(Get-Content '.\package\VERSION.txt' -TotalCount 1).Trim()
if($version -notmatch '^\d+\.\d+\.\d+$'){throw 'Неверный VERSION.txt'}
New-Item -Type Directory -Force -Path '.\dist' | Out-Null
& go build -trimpath -ldflags '-s -w -H=windowsgui' -o '.\package\FundiVoiceStudio.exe' ./launcher
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать launcher' }
& py -3 '.\Embed-Icon.py' '.\package\FundiVoiceStudio.exe' '.\package\web\favicon.ico'
if ($LASTEXITCODE -ne 0) { throw 'Не удалось вшить иконку лаунчера' }
& go build -trimpath -ldflags '-s -w -H=windowsgui' -o '.\package\Uninstall.exe' ./uninstaller
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать деинсталлятор' }
if (Test-Path '.\installer\payload.zip') { Remove-Item '.\installer\payload.zip' -Force }
Compress-Archive -Path '.\package\*' -DestinationPath '.\installer\payload.zip' -CompressionLevel Optimal
$output=".\dist\FundiVoiceStudio-Launcher-Setup-$version.exe"
& go build -trimpath -ldflags "-s -w -H=windowsgui -X main.version=$version" -o $output ./installer
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать установщик' }
& py -3 '.\Embed-Icon.py' $output '.\package\web\favicon.ico'
if ($LASTEXITCODE -ne 0) { throw 'Не удалось вшить иконку установщика' }
Write-Host "Готово: $output" -ForegroundColor Green
