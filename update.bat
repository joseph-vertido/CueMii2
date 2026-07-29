@echo off
setlocal enabledelayedexpansion
REM ============================================================================
REM  BADDIXX CueMii App - Update Script
REM  Downloads the latest version from GitHub and replaces the app files.
REM
REM  IMPORTANT: this always updates the folder this script lives in, no matter
REM  which directory the console happens to be in. (Without this, running the
REM  script as administrator or from a shortcut copied the files somewhere
REM  else entirely, so the app appeared not to update.)
REM ============================================================================

pushd "%~dp0"

echo.
echo ========================================
echo   BADDIXX CueMii App Updater
echo ========================================
echo.
echo   Updating: %CD%
echo.

REM --- Safety check: make sure this really is the app folder -----------------
if not exist "package.json" (
    echo   [X] package.json not found in this folder.
    echo       Put update.bat inside your CueMii folder and run it from there.
    echo.
    pause
    popd
    exit /b 1
)

REM --- Show the version we're starting from ----------------------------------
set "CURVER=unknown"
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "try { (Get-Content 'package.json' -Raw ^| ConvertFrom-Json).version } catch { 'unknown' }"`) do set "CURVER=%%v"
echo   Installed version: !CURVER!
echo.

REM --- Warn if the app is still running (files can be locked) ----------------
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if !errorlevel! equ 0 (
    echo   [!] CueMii appears to be RUNNING on port 3000.
    echo       Close the app window first, or the update may not take effect.
    echo.
    choice /c YN /m "Continue anyway"
    if errorlevel 2 goto :cancelled
    echo.
)

set "TEMP_ZIP=%TEMP%\cuemii-update.zip"
set "TEMP_DIR=%TEMP%\cuemii-update"

echo [1/5] Preparing update...
if exist "%TEMP_ZIP%" del /q "%TEMP_ZIP%"
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"

echo [2/5] Downloading latest version from GitHub...
set "BRANCH=main"
call :download %BRANCH%
if not exist "%TEMP_ZIP%" (
    echo       'main' not found - trying 'master'...
    set "BRANCH=master"
    call :download master
)

if not exist "%TEMP_ZIP%" (
    echo.
    echo   [X] Download failed. Check your internet connection.
    goto :fail
)

REM Reject an empty or tiny file (a failed download can still create one)
for %%A in ("%TEMP_ZIP%") do if %%~zA LSS 10000 (
    echo.
    echo   [X] The downloaded file looks invalid ^(too small^).
    goto :fail
)

echo [3/5] Extracting files...
mkdir "%TEMP_DIR%" 2>nul
powershell -NoProfile -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%TEMP_DIR%' -Force"

set "SRC=%TEMP_DIR%\CueMii2-!BRANCH!"
if not exist "!SRC!" (
    echo.
    echo   [X] Extraction failed - expected folder not found:
    echo       !SRC!
    goto :fail
)

echo [4/5] Updating files...
REM node_modules isn't in the repo, so it is left untouched.
xcopy /s /e /y /q "!SRC!\*" "." >nul
if errorlevel 1 (
    echo.
    echo   [X] Copy failed. Is the app still running, or a file open?
    goto :fail
)

echo [5/5] Cleaning up...
del /q "%TEMP_ZIP%" 2>nul
rmdir /s /q "%TEMP_DIR%" 2>nul

REM --- Show the version we ended up with -------------------------------------
set "NEWVER=unknown"
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "try { (Get-Content 'package.json' -Raw ^| ConvertFrom-Json).version } catch { 'unknown' }"`) do set "NEWVER=%%v"

echo.
echo ========================================
if "!NEWVER!"=="!CURVER!" (
    echo   Already up to date - version !NEWVER!
    echo.
    echo   If you expected a newer version, make sure the
    echo   changes have been committed and pushed to GitHub.
) else (
    echo   Updated: !CURVER!  ^-^->  !NEWVER!
)
echo ========================================
echo.

echo Installing dependencies ^(this may take a minute^)...
call npm install --no-audit --no-fund
echo.
echo Done. Start the app with start-cuemii.bat
echo.
pause
popd
exit /b 0

:download
REM %1 = branch name
set "URL=https://github.com/joseph-vertido/CueMii2/archive/refs/heads/%1.zip"
echo       %URL%
where curl >nul 2>nul
if %errorlevel% equ 0 (
    curl -L -f -s -o "%TEMP_ZIP%" "%URL%"
) else (
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%URL%' -OutFile '%TEMP_ZIP%' -UseBasicParsing } catch { }"
)
exit /b 0

:cancelled
echo.
echo   Update cancelled.
echo.
pause
popd
exit /b 1

:fail
echo.
del /q "%TEMP_ZIP%" 2>nul
rmdir /s /q "%TEMP_DIR%" 2>nul
pause
popd
exit /b 1
