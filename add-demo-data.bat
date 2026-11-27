@echo off
title Infodesk Attendance - demo data
cd /d "%~dp0"
if not exist node_modules call npm install --omit=dev --no-audit --no-fund
call npm run seed-demo
echo.
echo Done. Now double-click start.bat
pause
