<#
.SYNOPSIS
  Runs the unit/integration tests, builds the production bundle and previews it locally (with the native-viewer companion).
  The preview serves the same repository sub-path as GitHub Pages: http://127.0.0.1:5185/Certificate-Flow-Lab/
#>
[CmdletBinding()]
param(
    [int]$PreviewPort = 5185,
    [int]$CompanionPort = 5184,
    [switch]$SkipTests,
    [switch]$NoBrowser,
    [int]$SmokeSeconds = 0
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')

$preview = $null; $companion = $null
try {
    $root = Get-ProjectRoot
    Write-Info "Project root: $root"
    $nodePath = Assert-NodeNpm
    Install-DependenciesIfMissing $root
    Push-Location $root
    try {
        if (-not $SkipTests) {
            Write-Info 'Running unit and integration tests...'
            & $nodePath (Join-Path $root 'node_modules\vitest\vitest.mjs') run
            if ($LASTEXITCODE -ne 0) { throw 'Tests failed; not previewing.' }
        }
        Write-Info 'Building production bundle...'
        & $nodePath (Join-Path $root 'node_modules\vite\bin\vite.js') build
        if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
    } finally { Pop-Location }

    $url = "http://127.0.0.1:$PreviewPort/Certificate-Flow-Lab/"
    $null = Assert-PortFreeOrOurs $PreviewPort { Test-OurVite $url } 'production preview'
    $compState = Assert-PortFreeOrOurs $CompanionPort { Test-OurCompanion $CompanionPort } 'native-viewer companion'
    $token = New-SessionToken
    if ($compState -eq 'free') { $companion = Start-Companion $nodePath $root $CompanionPort $token }
    else { Write-Info 'A companion from an earlier session is running; native viewing is off this session.'; $token = $null }
    if (-not (Get-Listener $PreviewPort)) {
        $preview = Start-HiddenNode $nodePath @("`"$(Join-Path $root 'node_modules\vite\bin\vite.js')`"", 'preview', '--port', $PreviewPort, '--strictPort', '--host', '127.0.0.1') $root 'preview'
    }
    Wait-Until { Test-OurVite $url } 60 'The preview server' $preview
    Write-Info "Ready: $url"
    if (-not $NoBrowser) { if ($token) { Start-Process "$url#nt=$token" } else { Start-Process $url } }
    Write-Info 'Press Ctrl+C to stop.'
    $started = Get-Date
    while ($true) {
        if ($preview -and $preview.HasExited) { break }
        if ($SmokeSeconds -gt 0 -and ((Get-Date) - $started).TotalSeconds -ge $SmokeSeconds) { break }
        Start-Sleep -Seconds 1
    }
} finally {
    foreach ($p in @($companion, $preview)) { if ($p -and -not $p.HasExited) { Stop-ProcessTree $p.Id } }
}
