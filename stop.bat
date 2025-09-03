@echo off
echo Stopping FlashCard App servers...
echo.

REM Kill all Node.js processes (this will stop both backend and frontend)
taskkill /f /im node.exe 2>nul
if %errorlevel% equ 0 (
    echo Node.js processes stopped.
) else (
    echo No Node.js processes found.
)

REM Kill any remaining npm processes
taskkill /f /im npm.cmd 2>nul

REM Close all cmd windows with "Backend Server" or "Frontend Server" titles
taskkill /f /fi "WINDOWTITLE eq Backend Server*" 2>nul
taskkill /f /fi "WINDOWTITLE eq Frontend Server*" 2>nul

echo.
echo All FlashCard App processes have been stopped.
timeout /t 2 /nobreak > nul