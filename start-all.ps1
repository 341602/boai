$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$backendScript = Join-Path $projectRoot 'start-backend.ps1'
$frontendScript = Join-Path $projectRoot 'start-frontend.ps1'

if (-not (Test-Path $backendScript)) {
  Write-Host 'start-backend.ps1 was not found.' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $frontendScript)) {
  Write-Host 'start-frontend.ps1 was not found.' -ForegroundColor Red
  exit 1
}

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-ExecutionPolicy', 'Bypass',
  '-File', $backendScript
)

Start-Sleep -Milliseconds 800

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-ExecutionPolicy', 'Bypass',
  '-File', $frontendScript
)
