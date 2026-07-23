# Pull production database dumps from the server to this laptop over Tailscale.
#
# The server writes nightly pg_dumps to E:\deploy\pgdumps, but that's a second
# disk in the SAME machine — useless against fire, theft, ransomware or a PSU
# that takes the drives with it. This is the step that actually makes the
# backups offsite.
#
# Run it manually any time, or schedule it (see SetupScheduledTask below).
# Safe to run repeatedly: it only copies dumps it doesn't already have.
#
#   .\deploy\pull-backups.ps1
#   .\deploy\pull-backups.ps1 -Dest D:\speednet-backups -Keep 30

[CmdletBinding()]
param(
    # Where to store the pulled dumps on this laptop.
    [string]$Dest = "$env:USERPROFILE\SpeedNet-Backups",
    # Server's Tailscale address (user@host).
    [string]$Server = "MSR@100.95.52.74",
    # Remote directory, in Windows form — the server's OpenSSH serves the
    # Windows filesystem, so E:\deploy\pgdumps, not the WSL /mnt/e path.
    [string]$RemoteDir = "E:/deploy/pgdumps",
    # How many dumps to keep locally.
    [int]$Keep = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Dest)) {
    New-Item -ItemType Directory -Path $Dest -Force | Out-Null
    Write-Host "Created $Dest"
}

Write-Host "Listing dumps on $Server ..."
$remote = & ssh -o BatchMode=yes -o ConnectTimeout=15 $Server "dir /b `"$($RemoteDir -replace '/','\')`"" 2>$null
if ($LASTEXITCODE -ne 0 -or -not $remote) {
    Write-Warning "Could not list $RemoteDir on $Server. Is the server up and Tailscale connected?"
    exit 1
}

$dumps = @($remote | Where-Object { $_ -match '^speednet_.*\.sql\.gz$' })
if ($dumps.Count -eq 0) {
    Write-Warning "No dumps found in $RemoteDir. Has the nightly backup run yet?"
    exit 1
}

$copied = 0
foreach ($name in $dumps) {
    $local = Join-Path $Dest $name
    if (Test-Path $local) { continue }          # already have it
    Write-Host "  pulling $name"
    & scp -o BatchMode=yes -q "${Server}:$RemoteDir/$name" $local
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "  failed to copy $name"
        if (Test-Path $local) { Remove-Item $local -Force }   # no partial files
        continue
    }
    $copied++
}

# Prune oldest local copies beyond -Keep.
$all = Get-ChildItem $Dest -Filter 'speednet_*.sql.gz' | Sort-Object Name -Descending
if ($all.Count -gt $Keep) {
    $all | Select-Object -Skip $Keep | ForEach-Object {
        Write-Host "  pruning $($_.Name)"
        Remove-Item $_.FullName -Force
    }
}

$total = (Get-ChildItem $Dest -Filter 'speednet_*.sql.gz').Count
$newest = (Get-ChildItem $Dest -Filter 'speednet_*.sql.gz' | Sort-Object Name -Descending | Select-Object -First 1)
Write-Host ""
Write-Host "Done. Copied $copied new dump(s); $total held locally in $Dest"
if ($newest) { Write-Host "Newest: $($newest.Name)  ($([math]::Round($newest.Length/1MB,2)) MB)" }

# --- To run this automatically every day at 20:00, once, in an admin PowerShell:
#
#   $a = New-ScheduledTaskAction -Execute 'powershell.exe' `
#          -Argument '-NoProfile -ExecutionPolicy Bypass -File "E:\speednet-console\speednet-console\deploy\pull-backups.ps1"'
#   $t = New-ScheduledTaskTrigger -Daily -At 20:00
#   Register-ScheduledTask -TaskName 'SpeedNet-Pull-Backups' -Action $a -Trigger $t `
#          -Description 'Pull production DB dumps from the server over Tailscale'
#
# It simply does nothing if the laptop is off or off-tailnet, and catches up
# on the next run.
