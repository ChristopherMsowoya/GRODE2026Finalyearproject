@echo off
echo ============================================================
echo  GRODE - Grid Rainfall Onset Detection Engine
echo  Starting Backend (FastAPI) + Frontend (Next.js)
echo ============================================================

echo.
echo [1/2] Starting FastAPI backend on http://127.0.0.1:8000 ...
start "GRODE Backend" cmd /k "cd /d %~dp0 && python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000 --reload"

echo Waiting 3 seconds for backend to initialize...
timeout /t 3 /nobreak >nul

echo.
echo [2/2] Starting Next.js frontend on http://localhost:3000 ...
start "GRODE Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================================
echo  GRODE is starting up:
echo    Backend API:  http://127.0.0.1:8000
echo    Frontend:     http://localhost:3000
echo    API Docs:     http://127.0.0.1:8000/docs
echo ============================================================
echo.
pause
