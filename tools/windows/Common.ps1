# Shared helpers for the Certificate Flow Lab Windows scripts. Dot-source this file; do not run it directly.
# Windows PowerShell 5.1 compatible. No Administrator rights, no permanent execution-policy change.

$script:Marker = 'cfl-project" content="certificate-flow-lab'
$script:CompanionName = 'certificate-flow-lab-companion'

function Write-Info([string]$Message) { Write-Host "[Certificate Flow Lab] $Message" }

function Get-ProjectRoot {
    $root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $pkgPath = Join-Path $root 'package.json'
    if (-not (Test-Path $pkgPath)) { throw "package.json not found at $root. Run this script from inside the Certificate Flow Lab project." }
    $pkg = Get-Content -Raw -Path $pkgPath | ConvertFrom-Json
    if ($pkg.name -ne 'certificate-flow-lab') { throw "Unexpected project at $root (package name '$($pkg.name)')." }
    return $root
}

function Assert-NodeNpm {
    $node = Get-Command node -ErrorAction SilentlyContinue
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Node.js was not found on PATH. Install Node.js 18 or newer from https://nodejs.org/ and try again.' }
    if (-not $npm) { throw 'npm was not found on PATH. Reinstall Node.js (npm is included) and try again.' }
    Write-Info ("Node {0}, npm {1}" -f (& node --version), (& npm.cmd --version))
    return $node.Source
}

function Install-DependenciesIfMissing([string]$Root) {
    if (-not (Test-Path (Join-Path $Root 'node_modules\vite'))) {
        Write-Info 'Installing dependencies (npm install)...'
        Push-Location $Root
        try { & npm.cmd install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" } } finally { Pop-Location }
    }
}

# Session token: random, held in memory, passed to the companion through its environment and to the browser through the URL fragment.
function New-SessionToken {
    $bytes = New-Object byte[] 24
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([Convert]::ToBase64String($bytes)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-Listener([int]$Port) {
    return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Get-ProcessCommandLine([int]$ProcessId) {
    try { return (Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId").CommandLine } catch { return $null }
}

function Test-OurVite([string]$Url) {
    try { return ((Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3).Content -like "*$script:Marker*") } catch { return $false }
}

function Test-OurCompanion([int]$Port) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -UseBasicParsing -TimeoutSec 3
        return (($r.Content | ConvertFrom-Json).service -eq $script:CompanionName)
    } catch { return $false }
}

# Stops a process and its children. Uses taskkill /T (works without elevation for our own processes).
function Stop-ProcessTree([int]$ProcessId) {
    if ($ProcessId -le 0) { return }
    & taskkill.exe /PID $ProcessId /T /F 2>&1 | Out-Null
}

# Stops the listener on a port only when its command line proves it belongs to this project.
function Stop-StaleProjectListener([int]$Port, [string]$Root) {
    $l = Get-Listener $Port
    if (-not $l) { return }
    $cl = Get-ProcessCommandLine $l.OwningProcess
    if ($cl -and $cl.IndexOf($Root, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Write-Info "Stopping stale project process on port $Port (PID $($l.OwningProcess))."
        Stop-ProcessTree $l.OwningProcess
        Start-Sleep -Milliseconds 800
    } else {
        throw "Port $Port is held by a process that is not provably this project's. Not stopping it."
    }
}

function Assert-PortFreeOrOurs([int]$Port, [scriptblock]$IsOurs, [string]$What) {
    $l = Get-Listener $Port
    if (-not $l) { return 'free' }
    if (& $IsOurs) { return 'ours' }
    $owner = Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue
    $name = if ($owner) { "$($owner.ProcessName) (PID $($owner.Id))" } else { "PID $($l.OwningProcess)" }
    throw "Port $Port ($What) is in use by an unrelated process: $name. Stop it or choose another port."
}

function Wait-Until([scriptblock]$Condition, [int]$Seconds, [string]$What, $Child) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if ($Child -and $Child.HasExited) { throw "$What exited early (code $($Child.ExitCode))." }
        if (& $Condition) { return }
        Start-Sleep -Milliseconds 400
    }
    throw "$What did not become ready within $Seconds seconds."
}

# Starts a hidden child with output redirected to the temp log folder; returns the Process object.
function Start-HiddenNode([string]$NodePath, [string[]]$NodeArgs, [string]$Root, [string]$LogName) {
    $logDir = Join-Path $env:TEMP 'certificate-flow-lab'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    return Start-Process -FilePath $NodePath -ArgumentList $NodeArgs -WorkingDirectory $Root -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDir "$LogName.out.log") -RedirectStandardError (Join-Path $logDir "$LogName.err.log")
}

function Start-Companion([string]$NodePath, [string]$Root, [int]$Port, [string]$Token) {
    $env:CFL_TOKEN = $Token
    try {
        return Start-HiddenNode $NodePath @("`"$(Join-Path $Root 'tools\companion\server.mjs')`"", '--port', $Port, '--parent', $PID) $Root 'companion'
    } finally { Remove-Item Env:\CFL_TOKEN -ErrorAction SilentlyContinue }
}
