@echo off
setlocal
REM ============================================================================
REM  Creates a "CueMii" shortcut on your Desktop that launches start-cuemii.bat
REM  using the Baddixx logo (baddixx.ico) as its icon.
REM  (A .bat file can't hold its own icon, so we brand the shortcut instead.)
REM ============================================================================
pushd "%~dp0"

if not exist "%~dp0baddixx.ico" (
    echo   [X] baddixx.ico not found next to this script.
    goto done
)
if not exist "%~dp0start-cuemii.bat" (
    echo   [X] start-cuemii.bat not found next to this script.
    goto done
)

powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell; $p=$w.SpecialFolders('Desktop')+'\CueMii.lnk'; $s=$w.CreateShortcut($p); $s.TargetPath='%~dp0start-cuemii.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0baddixx.ico'; $s.Description='Start CueMii'; $s.Save()"

if errorlevel 1 (
    echo   [!] Could not create the shortcut.
) else (
    echo   [OK] Created a "CueMii" shortcut on your Desktop with the Baddixx icon.
)

:done
popd
echo.
pause
endlocal
