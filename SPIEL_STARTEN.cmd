@echo off
setlocal
title Rune Deep Starter
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
)

where node >nul 2>nul
if errorlevel 1 (
  echo [FEHLER] Node.js wurde nicht gefunden.
  echo Bitte installiere Node.js LTS und starte diese Datei erneut.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installiere die Spielkomponenten. Das kann einen Moment dauern...
  call npm install
  if errorlevel 1 (
    echo.
    echo [FEHLER] Die Installation ist fehlgeschlagen.
    pause
    exit /b 1
  )
)

echo Starte Rune Deep...
start "Rune Deep Server" cmd /k "cd /d ""%~dp0"" && npm run dev -- --host 127.0.0.1 --port 4173"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173"
exit /b 0
