<#
.SYNOPSIS
  Single Windows setup entry point: creates three local shortcuts in the project root (git-ignored, machine-specific).
    Certificate Flow Lab.lnk
    Build and Preview Certificate Flow Lab.lnk
    Export Certificate Flow Lab Video.lnk
  Windows PowerShell 5.1 compatible; no Administrator rights. Existing shortcuts are replaced safely.
.PARAMETER Desktop
  Also place copies on the current user's Desktop.
#>
[CmdletBinding()]
param([switch]$Desktop)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

$shortcuts = @(
    @{ Name = 'Certificate Flow Lab'; Script = 'tools\windows\Launch-Demo.ps1'; Desc = 'Start Certificate Flow Lab locally (with native Windows certificate viewing)' },
    @{ Name = 'Build and Preview Certificate Flow Lab'; Script = 'tools\windows\Build-And-Preview.ps1'; Desc = 'Test, build and preview the production bundle locally' },
    @{ Name = 'Export Certificate Flow Lab Video'; Script = 'tools\windows\Export-Video.ps1'; Desc = 'Render the deterministic MP4 and contact sheet' }
)

function New-Shortcut([string]$Path, [string]$ScriptPath, [string]$Description) {
    if (-not (Test-Path $ScriptPath)) { throw "Script not found: $ScriptPath" }
    $tmp = "$Path.tmp.lnk"
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($tmp)
    $lnk.TargetPath = $ps
    $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
    $lnk.WorkingDirectory = $root
    $lnk.WindowStyle = 1
    $lnk.Description = $Description
    $lnk.IconLocation = (Join-Path $env:SystemRoot 'System32\certmgr.dll') + ',0'
    $lnk.Save()
    Move-Item -LiteralPath $tmp -Destination $Path -Force   # replace atomically-ish
    Write-Host "Created: $Path"
}

foreach ($s in $shortcuts) {
    $script = Join-Path $root $s.Script
    New-Shortcut (Join-Path $root "$($s.Name).lnk") $script $s.Desc
    if ($Desktop) { New-Shortcut (Join-Path ([Environment]::GetFolderPath('Desktop')) "$($s.Name).lnk") $script $s.Desc }
}
