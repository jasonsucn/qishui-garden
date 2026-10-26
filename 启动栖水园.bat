@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。你也可以使用 VS Code 的 Live Server 打开 index.html。
  pause
  exit /b 1
)
start "栖水园本地服务" /min cmd /c "node server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8080"
echo 栖水园已开园。关闭“栖水园本地服务”窗口即可停止。
timeout /t 5 >nul
