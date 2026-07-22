# Elevated, on-demand + runs automatically every 5 minutes via the
# "SpeedNet-Ensure-Running" scheduled task. Same portproxy-refresh idea as
# wsl-start-and-refresh-portproxy.ps1, but also health-checks that the app is
# actually answering (not just that WSL2 booted) before deciding it's done.
# This is the main self-heal loop.

$logDir = "C:\SpeedNet\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$log = "$logDir\ensure-running.log"
"$(Get-Date -Format o)  ensure-running: start" | Add-Content $log

$anchor = Get-CimInstance Win32_Process -Filter "Name='wsl.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'sleep infinity' }
if (-not $anchor) {
    Start-Process wsl.exe -ArgumentList "-d","Ubuntu","-e","sleep","infinity" -WindowStyle Hidden
}

wsl.exe -d Ubuntu -e true

$ok = $false
for ($i = 0; $i -lt 20; $i++) {
    try {
        $wslIpCheck = (wsl.exe -d Ubuntu -e bash -c "hostname -I").Trim().Split(" ")[0]
        if ($wslIpCheck) {
            $resp = Invoke-WebRequest -Uri "http://$wslIpCheck/" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -eq 200) { $ok = $true; break }
        }
    } catch {}
    Start-Sleep -Seconds 1
}

$wslIp = (wsl.exe -d Ubuntu -e bash -c "hostname -I").Trim().Split(" ")[0]
if ($wslIp) {
    foreach ($port in 80, 443) {
        $current = (netsh interface portproxy show v4tov4 | Select-String "0\.0\.0\.0\s+$port\s+(\S+)")
        $currentTarget = if ($current) { $current.Matches[0].Groups[1].Value } else { $null }
        if ($currentTarget -ne $wslIp) {
            netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null
            netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp | Out-Null
            "$(Get-Date -Format o)  portproxy $port refreshed -> $wslIp" | Add-Content $log
        }
    }
}

"$(Get-Date -Format o)  ensure-running: done (app_ready=$ok, wsl_ip=$wslIp)" | Add-Content $log
