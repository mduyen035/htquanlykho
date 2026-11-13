@echo off
setlocal
cd /d "%~dp0"
call npm.cmd ci
if errorlevel 1 exit /b %errorlevel%
echo.
echo Cai dat thanh cong. Chay start.cmd de mo ung dung.
