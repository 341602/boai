$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$projectRoot = if ($root) { $PSScriptRoot } else { (Get-Location).Path }
$frontendDir = Join-Path $projectRoot 'frontend'

if (-not (Test-Path (Join-Path $frontendDir 'package.json'))) {
  Write-Host 'frontend folder was not found.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

Set-Location $frontendDir

if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
  Write-Host 'frontend dependencies were not found. Running npm install...' -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'frontend dependency install failed.' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit $LASTEXITCODE
  }
}

Write-Host ''
Write-Host 'Vue Frontend is starting at http://localhost:5173' -ForegroundColor Cyan
Write-Host ''

npm run dev -- --host 0.0.0.0

Read-Host 'frontend exited. Press Enter to close this window'
