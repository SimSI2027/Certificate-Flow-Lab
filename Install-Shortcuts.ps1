<#
.SYNOPSIS
  Creates "Certificate Flow Lab.lnk" in the project root. The shortcut is machine-specific and is ignored by Git.
  Windows PowerShell 5.1 compatible; no Administrator rights needed.
.PARAMETER Desktop
  Also place a copy of the shortcut on the current user's Desktop.
#>
[CmdletBinding()]
param([switch]$Desktop)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$launcher = Join-Path $root 'tools\windows\Launch-Demo.ps1'
if (-not (Test-Path $launcher)) { Write-Error "Launcher not found: $launcher" }

function New-Shortcut([string]$Path) {
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($Path)
    $lnk.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
    $lnk.WorkingDirectory = $root
    $lnk.Description = 'Certificate Flow Lab: interactive certificate issuance, deployment and trust visualization'
    $lnk.IconLocation = (Join-Path $env:SystemRoot 'System32\certmgr.dll') + ',0'
    $lnk.Save()
    Write-Host "Created: $Path"
}

New-Shortcut (Join-Path $root 'Certificate Flow Lab.lnk')
if ($Desktop) { New-Shortcut (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Certificate Flow Lab.lnk') }
