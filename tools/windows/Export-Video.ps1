<#
.SYNOPSIS
  Renders the deterministic film (MP4 + contact sheet) into the git-ignored output folder.
  The file names carry the version from package.json (output\certificate-flow-lab-v<version>.mp4).
  Stays open at the end so results can be read when started from a shortcut.
#>
[CmdletBinding()]
param([switch]$NoPause, [double]$Seconds = 0)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$code = 0
try {
    $root = Get-ProjectRoot
    Write-Info "Project root: $root"
    $nodePath = Assert-NodeNpm
    foreach ($tool in 'ffmpeg', 'ffprobe') {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool was not found on PATH. Install FFmpeg (https://ffmpeg.org/) and try again." }
    }
    Install-DependenciesIfMissing $root
    Push-Location $root
    try {
        $nodeArgs = @((Join-Path $root 'scripts\video\export-video.mjs'))
        if ($Seconds -gt 0) { $nodeArgs += @('--seconds', $Seconds) }
        & $nodePath @nodeArgs
        if ($LASTEXITCODE -ne 0) { throw "Video export failed (exit code $LASTEXITCODE)." }
    } finally { Pop-Location }
    $version = (Get-Content -Raw -Path (Join-Path $root 'package.json') | ConvertFrom-Json).version
    $mp4 = Join-Path $root ("output\certificate-flow-lab-v{0}.mp4" -f $version)
    $sheet = Join-Path $root ("output\certificate-flow-lab-v{0}-contact-sheet.jpg" -f $version)
    foreach ($f in $mp4, $sheet) { $i = Get-Item $f; Write-Info ("{0}  ({1:N1} MB)" -f $i.FullName, ($i.Length / 1MB)) }
    & ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of default=nw=1 $mp4
} catch {
    Write-Host "[Certificate Flow Lab] ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $code = 1
}
if (-not $NoPause) { Read-Host 'Press Enter to close' | Out-Null }
exit $code
