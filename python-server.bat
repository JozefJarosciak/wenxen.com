@echo off
cd "C:\code\wenxen.com"
echo Starting Python HTTP server on port 8001...

rem Start the server and browser opener in parallel
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8001"
python -m http.server 8001