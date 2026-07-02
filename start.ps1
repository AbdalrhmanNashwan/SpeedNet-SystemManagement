# SPEEDNeT Console launcher
# Run from the project root with:   .\start.ps1
# Starts: PostgreSQL (Docker), backend (FastAPI) and frontend (Vite),
# each in its own window, then opens the app in your browser.

$root = $PSScriptRoot
Write-Host "Starting SPEEDNeT Console..." -ForegroundColor Cyan

# 1. Database
Write-Host "-> Starting PostgreSQL (docker compose)..." -ForegroundColor Yellow
try {
    docker compose -f "$root\docker-compose.yml" up -d postgres | Out-Null
} catch {
    Write-Host "   Could not start Docker postgres (is Docker running?). Continuing..." -ForegroundColor Red
}

# 2. Backend
Write-Host "-> Starting backend on http://localhost:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit","-Command",
    "cd '$root\backend'; if (Test-Path .venv\Scripts\Activate.ps1) { .\.venv\Scripts\Activate.ps1 }; uvicorn app.main:app --reload --port 8000"
)

# 3. Frontend
Write-Host "-> Starting frontend on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit","-Command",
    "cd '$root\frontend'; npm run dev"
)

# 4. Open browser
Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "All services launching in separate windows." -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "  Backend : http://localhost:8000  (docs: /docs)" -ForegroundColor Green
