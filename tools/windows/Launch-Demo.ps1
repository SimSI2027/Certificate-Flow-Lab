<#
.SYNOPSIS
  Starts Certificate Flow Lab locally (simulator + native-viewer companion) and opens it in the default browser.
  Windows PowerShell 5.1 compatible; no Administrator rights; execution policy is never changed permanently.
.DESCRIPTION
  - Starts Vite on 127.0.0.1:5183 and the loopback-only companion on 127.0.0.1:5184 (enables "Open in Windows Certificate Viewer").
  - Reuses Vite only when it is conclusively this project's server; rejects unrelated processes on either port.
  - Stops both child process trees on Ctrl+C or normal exit (try/finally). Forcibly killing the launcher can bypass cleanup;
    the companion exits on its own when the launcher is gone, and the next launch reuses or (-StopStale) stops a leftover Vite.
.PARAMETER StopStale
  Stop leftover Vite/companion processes from this project (verified by command line) before starting.
.PARAMETER NoBrowser
  Do not open a browser.
.PARAMETER SmokeSeconds
  Exit normally after N seconds once ready (used by automated cleanup checks).
#>
[CmdletBinding()]
param(
    [int]$Port = 5183,
    [int]$CompanionPort = 5184,
    [switch]$StopStale,
    [switch]$NoBrowser,
    [int]$SmokeSeconds = 0
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')

$vite = $null; $companion = $null
try {
    $root = Get-ProjectRoot
    Write-Info "Project root: $root"
    $nodePath = Assert-NodeNpm
    $url = "http://127.0.0.1:$Port/"

    if ($StopStale) {
        if (Get-Listener $Port) { Stop-StaleProjectListener $Port $root }
        if (Get-Listener $CompanionPort) { Stop-StaleProjectListener $CompanionPort $root }
    }

    $viteState = Assert-PortFreeOrOurs $Port { Test-OurVite $url } 'simulator'
    $compState = Assert-PortFreeOrOurs $CompanionPort { Test-OurCompanion $CompanionPort } 'native-viewer companion'

    if ($viteState -eq 'free' -or $compState -eq 'free') { Install-DependenciesIfMissing $root }
    $token = New-SessionToken

    if ($compState -eq 'free') {
        Write-Info "Starting the native-viewer companion on 127.0.0.1:$CompanionPort ..."
        $companion = Start-Companion $nodePath $root $CompanionPort $token
    } else {
        Write-Info 'A companion from an earlier session is running; its token is unknown, so native viewing is off this session. Use -StopStale to replace it.'
        $token = $null
    }
    if ($viteState -eq 'free') {
        Write-Info "Starting the simulator on $url ..."
        $vite = Start-HiddenNode $nodePath @("`"$(Join-Path $root 'node_modules\vite\bin\vite.js')`"", '--port', $Port, '--strictPort', '--host', '127.0.0.1') $root 'vite'
    } else {
        Write-Info "A Certificate Flow Lab simulator is already running on port $Port; reusing it."
    }

    Wait-Until { Test-OurVite $url } 60 'The simulator' $vite
    if ($companion) { Wait-Until { Test-OurCompanion $CompanionPort } 30 'The companion' $companion }
    Write-Info "Ready: $url"
    if ($token) { Write-Info 'Native Windows certificate viewing is enabled for this session.' }
    if (-not $NoBrowser) { if ($token) { Start-Process "$url#nt=$token" } else { Start-Process $url } }
    Write-Info 'Press Ctrl+C to stop.'

    $started = Get-Date
    while ($true) {
        if ($vite -and $vite.HasExited) { Write-Info 'The simulator stopped.'; break }
        if ($SmokeSeconds -gt 0 -and ((Get-Date) - $started).TotalSeconds -ge $SmokeSeconds) { Write-Info 'Smoke time elapsed; shutting down.'; break }
        Start-Sleep -Seconds 1
    }
} finally {
    foreach ($p in @($companion, $vite)) {
        if ($p -and -not $p.HasExited) { Write-Info "Stopping process tree $($p.Id)..."; Stop-ProcessTree $p.Id }
    }
}
