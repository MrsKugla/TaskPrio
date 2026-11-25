@echo off
rem Uso: release.bat -Version 1.2.3   (oppure -Version patch / minor / major)
rem Imposta la versione in package.json (Semantic Versioning, https://semver.org) e crea l'installer
rem TaskPrio_<versione>_x64-setup.exe, firmato per l'aggiornamento automatico (file .sig accanto).
if /i not "%~1"=="-Version" goto uso
if "%~2"=="" goto uso
cd /d "%~dp0"

rem Chiave privata dell'updater, fuori dalla repo. Se si perde se ne genera una nuova: le app gia' installate
rem vanno reinstallate a mano una volta, poi si aggiornano di nuovo da sole (vedi pubblica_github.ps1).
set "TAURI_SIGNING_PRIVATE_KEY=%USERPROFILE%\.tauri\taskprio-updater.key"
set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD="
if not exist "%TAURI_SIGNING_PRIVATE_KEY%" (
  echo MANCA la chiave dell'updater: %TAURI_SIGNING_PRIVATE_KEY%
  echo Generane una nuova e copia il contenuto del .pub in "pubkey" di src-tauri\tauri.conf.json:
  echo   node node_modules\@tauri-apps\cli\tauri.js signer generate --ci -p "" -w "%TAURI_SIGNING_PRIVATE_KEY%"
  exit /b 1
)

rem npm version rifiuta i numeri che non sono semver; poi «postversion» lancia tauri build.
call npm version %~2 || exit /b 1
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "VERSIONE=%%v"
echo.
echo Installer: src-tauri\target\release\bundle\nsis\TaskPrio_%VERSIONE%_x64-setup.exe
echo Ora: git add -A, git commit -m "%VERSIONE%: ...", poi pubblica_github.
exit /b 0

:uso
echo Uso: release.bat -Version ^<versione^>   es. release.bat -Version 1.2.3  oppure  -Version minor
exit /b 1
