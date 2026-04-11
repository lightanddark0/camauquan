@echo off
:: Cai dat tu dong khoi dong khi Windows bat
:: Double-click file nay de cai dat (chi can lam 1 lan)

set BAT_FILE=%~dp0start-all.bat
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT=%STARTUP_DIR%\CaMauQuan-PrintSystem.bat

echo ===================================
echo   Ca Mau Quan - Print System Setup
echo ===================================
echo.

:: Copy file vao Startup folder
copy "%BAT_FILE%" "%SHORTCUT%" >nul
if errorlevel 1 (
    echo [LOI] Khong the sao chep vao Startup folder.
    pause
    exit /b 1
)

echo [OK] Da them vao Windows Startup:
echo      %SHORTCUT%
echo.
echo [*] Dang chay ngay bay gio...
echo.

:: Chay luon khong can kho dong may
call "%BAT_FILE%"
