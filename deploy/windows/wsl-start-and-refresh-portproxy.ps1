# Runs at every Windows logon via the "SpeedNet-WSL-AutoStart" scheduled task.
# Boots WSL2/Docker, waits, re-points the port 80+443 `netsh portproxy` rules
# at WSL2's current internal IP (which changes on every WSL2 restart), then
# keeps the distro alive so it doesn't idle-shutdown.

wsl.exe -d Ubuntu -e true
Start-Sleep -Seconds 15

$wslIp = (wsl.exe -d Ubuntu -e bash -c "hostname -I").Trim().Split(" ")[0]

if ($wslIp) {
    $logDir = "C:\SpeedNet\logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    foreach ($port in 80, 443) {
        netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null
        netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp | Out-Null
        "$(Get-Date -Format o)  portproxy $port -> $wslIp" | Add-Content "$logDir\portproxy-refresh.log"
    }
}

wsl.exe -d Ubuntu -e sleep infinity
