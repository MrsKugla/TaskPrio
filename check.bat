@echo off
rem Controlli completi: tipi TypeScript, colori CSS (tema scuro), test delle regole e test Rust del backup.
rem Si lancia dopo che l'agente ha finito un ticket e prima del commit.
cd /d "%~dp0"
call npm run check
if errorlevel 1 (
  echo.
  echo CONTROLLI FALLITI: incolla all'agente le righe sopra, dal primo errore in giu.
  exit /b 1
)
echo.
echo Tutto ok: puoi fare il commit.
exit /b 0
