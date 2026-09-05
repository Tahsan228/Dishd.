$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$nextCli = Join-Path $projectRoot 'node_modules\next\dist\bin\next'
if (-not (Test-Path -LiteralPath $nextCli)) { throw 'Dependencies are missing. Run npm install first.' }

try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/health' -TimeoutSec 2
  if ($health.app -eq 'dishd-rebuild') { Write-Output 'Dishd preview is already running: http://localhost:4173'; exit 0 }
} catch { }

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $runtime = $nodeCommand.Source
} else {
  $runtime = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\Code.exe'
  if (-not (Test-Path -LiteralPath $runtime)) { throw 'Install Node.js 22 or newer, then run npm run dev.' }
  $env:ELECTRON_RUN_AS_NODE = '1'
}

$previewFolder = Join-Path $projectRoot '.preview'
New-Item -ItemType Directory -Path $previewFolder -Force | Out-Null
$arguments = @('"' + $nextCli + '"', 'dev', '--hostname', '127.0.0.1', '--port', '4173')
$server = Start-Process -FilePath $runtime -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $previewFolder 'server.log') -RedirectStandardError (Join-Path $previewFolder 'server-error.log') -PassThru
$server.Id | Set-Content -LiteralPath (Join-Path $previewFolder 'launcher.pid')
Write-Output 'Starting Dishd at http://localhost:4173. Preview logs are in .preview/.'
