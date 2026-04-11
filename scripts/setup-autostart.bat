@echo off
:: Dang ky tu dong khoi dong khi Windows bat (dung Task Scheduler)
:: Double-click file nay de cai dat (chi can lam 1 lan)
:: Phai chay voi quyen Administrator

set SCRIPT_DIR=%~dp0
set NODE_CMD=node
set KITCHEN_MJS=%SCRIPT_DIR%kitchen-listener.mjs
set PRINT_MJS=%SCRIPT_DIR%print-server.mjs

echo ===================================
echo   Ca Mau Quan - Print System Setup
echo ===================================
echo.

:: Kiem tra quyen Administrator
net session >nul 2>&1
if errorlevel 1 (
    echo [LOI] Can chay voi quyen Administrator!
    echo Chuot phai vao file nay, chon "Run as administrator"
    pause
    exit /b 1
)

:: Kiem tra Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Node.js.
    echo Tai va cai tai: https://nodejs.org
    pause
    exit /b 1
)

:: Lay duong dan day du cua node.exe
for /f "delims=" %%i in ('where node') do set NODE_EXE=%%i

:: Dang ky task: Kitchen Listener
schtasks /create /tn "CaMauQuan-KitchenListener" ^
  /tr "\"%NODE_EXE%\" \"%KITCHEN_MJS%\"" ^
  /sc onlogon /rl highest /f >nul
if errorlevel 1 (
    echo [LOI] Khong dang ky duoc task KitchenListener.
    pause
    exit /b 1
)
echo [OK] Da dang ky task: CaMauQuan-KitchenListener

:: Dang ky task: Print Server
schtasks /create /tn "CaMauQuan-PrintServer" ^
  /tr "\"%NODE_EXE%\" \"%PRINT_MJS%\"" ^
  /sc onlogon /rl highest /f >nul
if errorlevel 1 (
    echo [LOI] Khong dang ky duoc task PrintServer.
    pause
    exit /b 1
)
echo [OK] Da dang ky task: CaMauQuan-PrintServer

echo.
echo He thong se tu dong chay moi khi ban dang nhap vao Windows.
echo De tat tu dong chay: mo "Task Scheduler" va xoa 2 task "CaMauQuan-*"
echo.
echo [*] Dang chay ngay bay gio...
echo.

:: Chay luon ngay
start "KitchenListener-Bep" /min "%NODE_EXE%" "%KITCHEN_MJS%"
timeout /t 2 /nobreak >nul
start "PrintServer-HoaDon" /min "%NODE_EXE%" "%PRINT_MJS%"

echo [OK] He thong dang chay!
pause
