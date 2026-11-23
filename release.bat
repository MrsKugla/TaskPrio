@echo off
rem Uso: release.bat -Version 0.2.0
rem Imposta la versione in package.json e crea l'installer TaskPrio_<versione>_x64-setup.exe
if /i not "%~1"=="-Version" goto uso
if "%~2"=="" goto uso
cd /d "%~dp0"
call npm version %~2 || exit /b 1
echo.
echo Installer: src-tauri\target\release\bundle\nsis\TaskPrio_%~2_x64-setup.exe
exit /b 0

:uso
echo Uso: release.bat -Version ^<versione^>   es. release.bat -Version 0.2.0
exit /b 1
