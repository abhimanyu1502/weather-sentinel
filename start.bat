@echo off
setlocal enabledelayedexpansion

title StormSentinel Launcher (AntiGravity v3.0.0)

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo ====================================================================
echo  * StormSentinel (AntiGravity v3.0.0) -- Platform Launcher
echo  * Severe Convective Storm Nowcasting ^& Mission Control
echo ====================================================================
echo.

:: ----------------------------------------------------------------------------
:: STEP 1: Database & Cache (PostgreSQL / PostGIS + Redis)
:: ----------------------------------------------------------------------------
echo [Step 1/3] Checking Database and Cache Services...

docker info >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Docker daemon detected. Starting Redis and PostGIS containers...
    docker compose up -d redis postgres >nul 2>&1 || docker-compose up -d redis postgres >nul 2>&1
    echo [OK] Database and Cache containers running.
) else (
    echo [INFO] Docker daemon is not active or not installed.
    echo        FastAPI backend will run in self-contained in-memory streaming mode.
)

echo.

:: ----------------------------------------------------------------------------
:: STEP 2: Python Environment & FastAPI Backend
:: ----------------------------------------------------------------------------
echo [Step 2/3] Checking Python Environment and Starting FastAPI Backend...

set "PYTHON_EXEC="

if exist "%ROOT_DIR%backend\.venv\Scripts\python.exe" (
    set "PYTHON_EXEC=%ROOT_DIR%backend\.venv\Scripts\python.exe"
) else if exist "%ROOT_DIR%.venv\Scripts\python.exe" (
    set "PYTHON_EXEC=%ROOT_DIR%.venv\Scripts\python.exe"
) else (
    where python >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set "PYTHON_EXEC=python"
    ) else (
        where py >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            set "PYTHON_EXEC=py"
        )
    )
)

if "%PYTHON_EXEC%"=="" (
    echo [ERROR] Python was not found on your system!
    echo         Please install Python 3.10+ and add it to PATH.
    echo.
    pause
    exit /b 1
)

echo [OK] Using Python: %PYTHON_EXEC%

:: Start Backend in a separate window
start "StormSentinel Backend Engine (FastAPI)" cmd /k "title StormSentinel Backend Engine && cd /d "%ROOT_DIR%backend" && "%PYTHON_EXEC%" main.py"

echo [OK] Backend server launched on http://localhost:8000
timeout /t 2 /nobreak >nul 2>&1

echo.

:: ----------------------------------------------------------------------------
:: STEP 3: Frontend Dashboard (Vite + React)
:: ----------------------------------------------------------------------------
echo [Step 3/3] Preparing Frontend Dashboard...

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js or npm was not found on your system!
    echo         Please install Node.js from https://nodejs.org/ and add it to PATH.
    echo.
    pause
    exit /b 1
)

cd /d "%ROOT_DIR%frontend"

if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies via npm install...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
)

echo.
echo ====================================================================
echo  * AntiGravity StormSentinel Platform Running Successfully!
echo ====================================================================
echo   - Frontend Dashboard : http://localhost:5173
echo   - REST API Root      : http://localhost:8000/api
echo   - Live WebSocket     : ws://localhost:8000/ws/live-stream
echo   - Swagger API Docs   : http://localhost:8000/docs
echo ====================================================================
echo.

:: Open default browser
start "" "http://localhost:5173"

:: Start Vite dev server in this window
call npm run dev

pause
