@echo off
echo [Puma] Limpando processos anteriores nas portas 3001/3002/5173...
powershell -Command "& { Get-NetTCPConnection -LocalPort 3001,3002,5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { taskkill /F /PID $_ } }" 2>nul
timeout /t 2 /nobreak >nul
echo [Puma] Iniciando Daemon...
start "Puma Daemon" cmd /k "npm run daemon"
timeout /t 3 /nobreak >nul
echo [Puma] Iniciando WS Proxy...
start "Puma WS Proxy" cmd /k "npm run wsproxy"
timeout /t 3 /nobreak >nul
