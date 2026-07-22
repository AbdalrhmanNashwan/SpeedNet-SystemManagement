# Runs every 5 minutes via the "SpeedNet-DuckDNS-Update" scheduled task. Keeps
# speednetiq.duckdns.org pointed at this server's current public IP.
#
# SECURITY: the DuckDNS account token is NOT stored in this script (it's a live
# credential and this file is version-controlled). It is read from a host-only
# file OUTSIDE the repo:
#     C:\SpeedNet\secrets\duckdns.token     (single line: the token, nothing else)
# Create that file once by hand. If it's missing, this script logs and exits.

$logDir = "C:\SpeedNet\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$log = "$logDir\duckdns-update.log"

$tokenFile = "C:\SpeedNet\secrets\duckdns.token"
if (-not (Test-Path $tokenFile)) {
    "$(Get-Date -Format o)  SKIPPED: token file not found at $tokenFile" | Add-Content $log
    exit 1
}
$token = (Get-Content $tokenFile -TotalCount 1).Trim()
if (-not $token) {
    "$(Get-Date -Format o)  SKIPPED: token file is empty" | Add-Content $log
    exit 1
}

try {
    $r = Invoke-WebRequest -Uri "https://www.duckdns.org/update?domains=speednetiq&token=$token&verbose=true" -UseBasicParsing -TimeoutSec 15
    $bytes = $r.RawContentStream.ToArray()
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $flat = $text -replace '\r?\n', ' | '
    "$(Get-Date -Format o)  $flat" | Add-Content $log
} catch {
    "$(Get-Date -Format o)  FAILED: $_" | Add-Content $log
}
