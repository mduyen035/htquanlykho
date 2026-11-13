@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\vite\bin\vite.js" (
  echo Chua cai dependency. Hay chay install.cmd truoc.
  exit /b 1
)
call npm.cmd run dev
