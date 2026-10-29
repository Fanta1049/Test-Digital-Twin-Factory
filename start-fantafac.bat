@echo off
title FantaFac MES - Smart Production Assistant + Digital Twin
cd /d "c:\Users\ACER\Desktop\FantaFac"

echo ============================================================================
echo   FantaFac MES ^& 3D Digital Twin Launcher
echo   Starting server at http://localhost:3000 ...
echo ============================================================================
echo.

if not exist ".next\BUILD_ID" (
    echo Building production bundle for first run...
    call npm run build
)

start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000/dashboard"
call npm run start
pause
