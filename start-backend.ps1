$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$projectRoot = if ($root) { $PSScriptRoot } else { (Get-Location).Path }
$backendDir = Join-Path $projectRoot 'backend'

if (-not (Test-Path (Join-Path $backendDir 'package.json'))) {
  Write-Host 'backend folder was not found.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

Set-Location $backendDir

if (-not (Test-Path (Join-Path $backendDir 'node_modules'))) {
  Write-Host 'backend dependencies were not found. Running npm install...' -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'backend dependency install failed.' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit $LASTEXITCODE
  }
}

Write-Host ''
Write-Host 'BoAi Backend is starting at http://localhost:3000' -ForegroundColor Cyan
Write-Host ''

npm run start

Read-Host 'backend exited. Press Enter to close this window'
