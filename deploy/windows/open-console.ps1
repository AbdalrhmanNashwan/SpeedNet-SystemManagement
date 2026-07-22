# Target of the "SpeedNet Console" Desktop shortcut. Fast path: if the console
# already responds, opens the browser in well under a second. Slow path:
# triggers the elevated ensure-running task with no UAC prompt (pre-authorized
# via Task Scheduler), polls until ready, then opens it.

function Test-Console {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1/console" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        return $r.StatusCode -eq 200
    } catch { return $false }
}

if (-not (Test-Console)) {
    Start-Process schtasks.exe -ArgumentList "/run","/tn","SpeedNet-Ensure-Running" -WindowStyle Hidden -Wait

    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        if (Test-Console) { $ready = $true; break }
        Start-Sleep -Milliseconds 750
    }
}

Start-Process "http://127.0.0.1/console"
