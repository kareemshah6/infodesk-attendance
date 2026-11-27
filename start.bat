@echo off
title Infodesk Attendance
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode
node -e "process.exit(+process.versions.node.split('.')[0] >= 22 ? 0 : 1)"
if errorlevel 1 goto oldnode

if exist node_modules goto run
echo Installing - please wait, first time only...
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 goto installfail

:run
echo.
echo ================================================
echo   Infodesk Attendance is starting...
echo   Open in browser:  http://localhost:3000
echo   First login:      admin / admin123
echo.
echo   Keep this window open. Close it to stop the app.
echo ================================================
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
call npm start
pause
exit /b

:nonode
echo Node.js is not installed.
echo Download the LTS version from https://nodejs.org , install it,
echo then RESTART the computer and double-click start.bat again.
pause
exit /b 1

:oldnode
echo Your Node.js version is too old. You have:
node -v
echo Install the latest LTS version from https://nodejs.org and try again.
pause
exit /b 1

:installfail
echo.
echo Install failed. Please take a screenshot of this window and send it.
pause
exit /b 1
