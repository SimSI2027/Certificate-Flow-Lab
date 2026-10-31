<#
.SYNOPSIS
  Starts Certificate Flow Lab locally and opens it in the default browser. Windows PowerShell 5.1 compatible; no Administrator rights needed.
.DESCRIPTION
  - Discovers the project root from this script's location.
  - Verifies Node.js and npm, installs dependencies if node_modules is missing.
  - Reuses an already running server for THIS project, rejects an unrelated process on the port.
  - Waits for HTTP readiness, opens the browser, then stays open until Ctrl+C (stopping the server it started).
.PARAMETER Port
  TCP port for the local server (default 5183, matching vite.config.js).
.PARAMETER NoBrowser
  Do not open a browser (used for automated checks).
#>
[CmdletBinding()]
param(
    [int]$Port = 5183,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$ProjectMarker = 'cfl-project" content="certificate-flow-lab'

function Write-Info([string]$Message) { Write-Host "[Certificate Flow Lab] $Message" }

# --- discover project root -------------------------------------------------
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pkgPath = Join-Path $root 'package.json'
if (-not (Test-Path $pkgPath)) { Write-Error "package.json not found at $root. Run this script from inside the Certificate Flow Lab project." }
$pkg = Get-Content -Raw -Path $pkgPath | ConvertFrom-Json
if ($pkg.name -ne 'certificate-flow-lab') { Write-Error "Unexpected project at $root (package name '$($pkg.name)')." }
$url = "http://127.0.0.1:$Port/"
Write-Info "Project root: $root"

# --- verify node and npm -----------------------------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $node) { Write-Error 'Node.js was not found on PATH. Install Node.js 18 or newer from https://nodejs.org/ and try again.' }
if (-not $npm) { Write-Error 'npm was not found on PATH. Reinstall Node.js (npm is included) and try again.' }
Write-Info ("Node {0}, npm {1}" -f (& node --version), (& npm.cmd --version))

function Test-OurServer {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        return ($r.Content -like "*$ProjectMarker*")
    } catch { return $false }
}

# --- reuse or reject an existing listener ---------------------------------------
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$serverProcess = $null
if ($listener) {
    if (Test-OurServer) {
        Write-Info "A Certificate Flow Lab server is already running on port $Port; reusing it."
    } else {
        $owner = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        $name = if ($owner) { "$($owner.ProcessName) (PID $($owner.Id))" } else { "PID $($listener.OwningProcess)" }
        Write-Error "Port $Port is in use by an unrelated process: $name. Stop it or run with -Port <other> (then also pass --port to vite)."
    }
} else {
    # --- install dependencies if missing ---------------------------------------------
    if (-not (Test-Path (Join-Path $root 'node_modules\vite'))) {
        Write-Info 'Installing dependencies (npm install)...'
        Push-Location $root
        try { & npm.cmd install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" } } finally { Pop-Location }
    }
    $viteJs = Join-Path $root 'node_modules\vite\bin\vite.js'
    $logDir = Join-Path $env:TEMP 'certificate-flow-lab'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $out = Join-Path $logDir 'server.out.log'; $err = Join-Path $logDir 'server.err.log'
    Write-Info "Starting the local server on $url ..."
    $serverProcess = Start-Process -FilePath $node.Source -ArgumentList @("`"$viteJs`"", '--port', $Port, '--strictPort', '--host', '127.0.0.1') `
        -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
}

try {
    # --- wait for HTTP readiness -----------------------------------------------------
    $deadline = (Get-Date).AddSeconds(60)
    $ready = $false
    while ((Get-Date) -lt $deadline) {
        if ($serverProcess -and $serverProcess.HasExited) { Write-Error "The server exited early (code $($serverProcess.ExitCode)). See $logDir for logs." }
        if (Test-OurServer) { $ready = $true; break }
        Start-Sleep -Milliseconds 400
    }
    if (-not $ready) { Write-Error "The server did not become ready within 60 seconds." }
    Write-Info "Ready: $url"
    if (-not $NoBrowser) { Start-Process $url }
    Write-Info 'Press Ctrl+C to stop.'
    while ($true) {
        if ($serverProcess -and $serverProcess.HasExited) { Write-Info 'Server stopped.'; break }
        Start-Sleep -Seconds 1
    }
} finally {
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Write-Info 'Stopping the server...'
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
