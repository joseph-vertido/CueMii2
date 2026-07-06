@echo off
REM ============================================
REM BADDIXX CueMii App - Update Script
REM Downloads latest version from GitHub and
REM replaces files in current directory
REM ============================================

echo.
echo ========================================
echo   BADDIXX CueMii App Updater
echo ========================================
echo.

set REPO_URL=https://github.com/joseph-vertido/CueMii/archive/refs/heads/main.zip
set TEMP_ZIP=%TEMP%\cuemii-update.zip
set TEMP_DIR=%TEMP%\cuemii-update

echo [1/5] Preparing update...
if exist "%TEMP_ZIP%" del "%TEMP_ZIP%"
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"

echo [2/5] Downloading latest version from GitHub...
echo       %REPO_URL%
echo.

REM Try curl first (Windows 10+), fall back to PowerShell
where curl >nul 2>nul
if %errorlevel% equ 0 (
    curl -L -o "%TEMP_ZIP%" "%REPO_URL%"
) else (
    powershell -Command "Invoke-WebRequest -Uri '%REPO_URL%' -OutFile '%TEMP_ZIP%'"
)

if not exist "%TEMP_ZIP%" (
    echo.
    echo ERROR: Failed to download update. Please check your internet connection.
    echo.
    pause
    exit /b 1
)

echo [3/5] Extracting files...
mkdir "%TEMP_DIR%" 2>nul
powershell -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%TEMP_DIR%' -Force"

if not exist "%TEMP_DIR%\CueMii-main" (
    echo.
    echo ERROR: Failed to extract update. The downloaded file may be corrupted.
    echo.
    pause
    exit /b 1
)

echo [4/5] Updating files...
REM Copy all files from the extracted folder to current directory
REM Note: node_modules is excluded from the repo, so it won't be downloaded
xcopy /s /e /y "%TEMP_DIR%\CueMii-main\*" "." >nul

echo [5/5] Cleaning up...
del "%TEMP_ZIP%" 2>nul
rmdir /s /q "%TEMP_DIR%" 2>nul

echo.
echo ========================================
echo   Update Complete!
echo ========================================
echo.
echo Please run the following commands to finish:
echo   1. npm install
echo   2. npm start
echo.
pause
