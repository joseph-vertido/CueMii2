@echo off
setlocal enabledelayedexpansion
REM ============================================================================
REM  CueMii - Start everything
REM  1) Frees port 9001 if a stale service is holding it
REM  2) Launches the fingerprint service in its own window
REM  3) Waits for it to come online - but launches the app anyway if it fails
REM ============================================================================

pushd "%~dp0"

echo ============================================================
echo   Starting CueMii (fingerprint service + app)
echo ============================================================
echo.

REM --- 1. Free port 9001 if something is already using it ---
echo [1/3] Checking port 9001...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":9001" ^| findstr "LISTENING"') do (
    echo   Port 9001 in use by PID %%p - stopping it...
    taskkill /PID %%p /F >nul 2>nul
)
echo   Done.
echo.

REM --- 2. Launch the fingerprint service in its own window ---
echo [2/3] Starting fingerprint service in a new window...
if not exist "%~dp0fingerprint-service" (
    echo   [X] fingerprint-service folder not found next to this script.
    echo       Launching the app anyway.
    goto startapp
)
start "CueMii Fingerprint Service" /D "%~dp0fingerprint-service" cmd /k "dotnet run"
echo.

REM --- 3. Give the service a short head start, then launch the app regardless ---
echo   Giving the fingerprint service a few seconds to start...
timeout /t 8 /nobreak >nul

REM One quick, bounded status check - this NEVER blocks the app launch.
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:9001/health' -UseBasicParsing -TimeoutSec 2 | Out-Null; Write-Host '  [OK] Fingerprint service is online.' } catch { Write-Host '  [i] Reader not up yet - the app will connect on its own once the service is ready (or run without the reader).' }"
echo.

:startapp
echo [3/3] Starting the CueMii app (npm start)...
echo   The app runs in THIS window. Press Ctrl+C to stop it.
echo   Close the "CueMii Fingerprint Service" window when you're done.
echo.
call npm start

popd
endlocal
