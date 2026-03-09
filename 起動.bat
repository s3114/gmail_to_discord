@echo off
cd /d %~dp0
chcp 65001 >nul

if not exist "%~dp0node_modules" (
  echo [INFO] node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

node "%~dp0index.js"
@REM powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList '\"%~dp0server.js\"' -WorkingDirectory '%~dp0'"
pause
