<#
  AuraStudy (StudentAssist) - start the full local demo.

  Usage (from the repository root, in PowerShell):
      .\scripts\start-demo.ps1            # start everything; seed demo data on first run
      .\scripts\start-demo.ps1 -Reset     # rebuild the demo data from scratch first (backs up the old DB)
      .\scripts\start-demo.ps1 -NoBrowser

  Starts: Ollama (local LLM) -> Django API on :8000 -> Vite web app on :5173.
#>
param(
  [switch]$Reset,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$server = Join-Path $root 'server'
$src    = Join-Path $server 'src'
$client = Join-Path $root 'client'
$python = Join-Path $server '.venv\Scripts\python.exe'
$model  = if ($env:OLLAMA_LLM_MODEL) { $env:OLLAMA_LLM_MODEL } else { 'llama3.2' }

function Step($msg) { Write-Host "`n> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  [ok] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

function Test-Port($port) {
  foreach ($h in '127.0.0.1', '::1') {
    try { $c = New-Object Net.Sockets.TcpClient($h, $port); $c.Close(); return $true } catch { }
  }
  return $false
}

# -- Prerequisites -----------------------------------------------------------
Step 'Checking prerequisites'
if (-not (Test-Path $python)) {
  Write-Host "  Python virtualenv not found. Create it with:" -ForegroundColor Red
  Write-Host "    cd server; python -m venv .venv; .venv\Scripts\pip install -r requirements\dev.txt"
  exit 1
}
Ok 'Python virtualenv'
if (-not (Test-Path (Join-Path $server '.env'))) {
  Copy-Item (Join-Path $server '.env.example') (Join-Path $server '.env')
  Warn 'Created server\.env from .env.example - set DJANGO_SECRET_KEY before deploying anywhere.'
}
if (-not (Test-Path (Join-Path $client 'node_modules'))) {
  Step 'Installing web app dependencies (first run)'
  Push-Location $client; npm install; Pop-Location
}
Ok 'Web app dependencies'

# -- Ollama -------------------------------------------------------------------
Step "Local language model (Ollama - $model)"
$ollama = (Get-Command ollama -ErrorAction SilentlyContinue).Source
if (-not $ollama) { $ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe' }
if (-not (Test-Path $ollama)) {
  Warn 'Ollama is not installed - the assistant will show matching passages instead of written answers.'
  Warn 'Install it from https://ollama.com/download, then run: ollama pull llama3.2'
} else {
  if (-not (Test-Port 11434)) {
    Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden
    for ($i = 0; $i -lt 20 -and -not (Test-Port 11434); $i++) { Start-Sleep -Milliseconds 500 }
  }
  if (Test-Port 11434) { Ok 'Ollama is running' } else { Warn 'Ollama did not start.' }
  $models = & $ollama list 2>$null
  if (-not ($models -match "^$model")) {
    Step "Downloading $model (one-time, ~2 GB)"
    & $ollama pull $model
  }
  Ok "$model is available"
}

# -- Database -----------------------------------------------------------------
Step 'Database migrations'
Push-Location $src
& $python manage.py migrate --noinput | Out-Null
Ok 'Schema up to date'

$hasDemo = & $python -c "import os,django;os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings.development');django.setup();from apps.accounts.models import User;print(User.objects.filter(email='admin@aurastudy.demo').exists())" 2>$null | Select-Object -Last 1
if ($Reset -or $hasDemo -ne 'True') {
  Step 'Building the demo environment (accounts, course library, AI history) - a few minutes'
  $env:PYTHONIOENCODING = 'utf-8'
  if ($Reset) { & $python manage.py seed_demo --reset --yes } else { & $python manage.py seed_demo }
} else {
  Ok 'Demo data present (use -Reset to rebuild)'
}
Pop-Location

# -- Servers ------------------------------------------------------------------
Step 'Starting servers'
if (Test-Port 8000) { Warn 'Port 8000 is already in use - assuming the API is running.' }
else {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$src'; `$host.UI.RawUI.WindowTitle='AuraStudy API :8000'; & '$python' manage.py runserver 8000"
  Ok 'API -> http://localhost:8000'
}
if (Test-Port 5173) { Warn 'Port 5173 is already in use - assuming the web app is running.' }
else {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$client'; `$host.UI.RawUI.WindowTitle='AuraStudy Web :5173'; npm run dev -- --port 5173 --strictPort"
  Ok 'Web app -> http://localhost:5173'
}

for ($i = 0; $i -lt 40 -and -not ((Test-Port 8000) -and (Test-Port 5173)); $i++) { Start-Sleep -Milliseconds 500 }
if (-not $NoBrowser) { Start-Process 'http://localhost:5173' }

Write-Host "`nAuraStudy is running. Demo accounts:" -ForegroundColor Cyan
Write-Host '  Admin    admin@aurastudy.demo     AuraAdmin#2026'
Write-Host '  Teacher  teacher@aurastudy.demo   AuraTeach#2026'
Write-Host '  Student  student@aurastudy.demo   AuraStudy#2026'
