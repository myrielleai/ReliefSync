@echo off
title ReliefSync Launcher

echo ========================================================
echo        STARTING RELIEFSYNC FOR LIVE DEMO
echo ========================================================
echo.

echo [1/3] Starting Machine Learning Backend (Flask)...
start "ReliefSync Backend" cmd /k "python backend/app.py"

echo [2/3] Starting Frontend Operations Server...
start "ReliefSync Frontend" cmd /k "npx serve frontend"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak > nul

echo Launching ReliefSync in your default web browser...
start http://localhost:3000

echo.
echo All systems go! Good luck with the pitch!
echo (You can close this window now. Leave the other two running.)
pause > nul
