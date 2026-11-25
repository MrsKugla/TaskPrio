@echo off
rem Pubblica su GitHub la release dell'ultimo commit (dettagli in pubblica_github.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pubblica_github.ps1"
exit /b %errorlevel%
