@echo off
:: Khoi dong Kitchen Listener + Print Server cho Ca Mau Quan
:: File nay tu dong chay khi Windows bat

set SCRIPT_DIR=%~dp0

:: Kiem tra Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Node.js.
    echo Tai va cai tai: https://nodejs.org
    pause
    exit /b 1
)

:: Kiem tra firebase-admin
if not exist "%SCRIPT_DIR%..\node_modules\firebase-admin" (
    echo [*] Cai firebase-admin lan dau...
    cd "%SCRIPT_DIR%.."
    npm install firebase-admin --save-dev
)

:: Kiem tra service account key
if not exist "%SCRIPT_DIR%serviceAccountKey.json" (
    echo [CANH BAO] Khong tim thay serviceAccountKey.json
    echo In hoa don van chay, nhung phieu bep se khong in tu dong.
    echo.
)

:: Khoi dong Print Server (hoa don khach - may in 192.168.123.100)
echo [*] Dang khoi dong Print Server (hoa don)...
start "PrintServer-HoaDon" /min node "%SCRIPT_DIR%print-server.mjs"

:: Cho 2 giay
timeout /t 2 /nobreak >nul

:: Khoi dong Kitchen Listener (phieu bep - may in 192.168.1.234)
if exist "%SCRIPT_DIR%serviceAccountKey.json" (
    echo [*] Dang khoi dong Kitchen Listener (phieu bep)...
    start "KitchenListener-Bep" /min node "%SCRIPT_DIR%kitchen-listener.mjs"
)

echo.
echo [OK] He thong in da san sang!
echo  - Hoa don khach: may in 192.168.123.100
echo  - Phieu bep: may in 192.168.1.234
echo.
echo Cac cua so dang chay an tren taskbar.
timeout /t 5 /nobreak >nul
