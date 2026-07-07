@echo off
setlocal enabledelayedexpansion
REM ============================================================================
REM  CueMii - Fingerprint Reader Setup (DIRECT CAPTURE)
REM  The local service owns the reader; the browser polls it. No WebSDK agent.
REM ============================================================================

pushd "%~dp0"

echo.
echo ============================================================
echo   CueMii Fingerprint Reader - Setup (direct capture)
echo ============================================================
echo.

set "MISSING=0"

echo [1/4] Checking prerequisites...
echo.
where node >nul 2>nul
if errorlevel 1 ( echo   [X] Node.js not found: https://nodejs.org/ & set "MISSING=1" ) else ( for /f "delims=" %%v in ('node -v') do echo   [OK] Node.js %%v )
where npm >nul 2>nul
if errorlevel 1 ( echo   [X] npm not found & set "MISSING=1" ) else ( for /f "delims=" %%v in ('npm -v') do echo   [OK] npm %%v )
where dotnet >nul 2>nul
if errorlevel 1 ( echo   [X] .NET SDK not found: https://dotnet.microsoft.com/download & set "MISSING=1" ) else ( for /f "delims=" %%v in ('dotnet --version') do echo   [OK] .NET SDK %%v )
echo.
if "%MISSING%"=="1" ( echo Install the missing items above, then run again. & goto :end )

echo [2/4] Installing app dependencies (npm install)...
echo.
call npm install
if errorlevel 1 ( echo   [X] npm install failed. & goto :end )
echo   [OK] Dependencies installed.
echo.

echo [3/4] Preparing folder for the matching-service SDK file...
echo.
if not exist "fingerprint-service\libs" mkdir "fingerprint-service\libs"
echo   [OK] fingerprint-service\libs\   (place DPUruNet.dll here)
echo.

echo [4/4] Building the matching service...
echo.
if exist "fingerprint-service\libs\DPUruNet.dll" (
    pushd "fingerprint-service"
    call dotnet build -c Release
    popd
    if errorlevel 1 ( echo   [!] Service build reported an issue - see output above. ) else ( echo   [OK] Matching service built. )
) else (
    echo   [ ] Skipping build - DPUruNet.dll not in fingerprint-service\libs yet.
)
echo.

echo ============================================================
echo   Setup complete. Remaining MANUAL steps:
echo ============================================================
echo.
echo   1. Install the DigitalPersona U.are.U SDK, then copy from it:
echo        DPUruNet.dll  ->  fingerprint-service\libs\
echo      (from C:\Program Files\DigitalPersona\U.are.U SDK\Windows\Lib\.NET\)
echo   2. Install the DigitalPersona 4500 WBF device driver so Windows sees the reader.
echo.
echo   NOTE: No Authentication Device Client / WebSDK agent is needed anymore.
echo.
echo   To run:
echo        Terminal 1:  cd fingerprint-service  ^&^&  dotnet run
echo        Terminal 2:  npm start
echo.

:end
popd
echo.
pause
endlocal
