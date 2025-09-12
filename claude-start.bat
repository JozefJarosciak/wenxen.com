@echo off
echo Claude Code Launcher with Memory Fix
echo =====================================
echo.

REM Kill existing processes
echo Cleaning up existing processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM claude.exe 2>nul
timeout /t 2 >nul

REM Set environment variables
echo Setting optimized memory configuration...
set NODE_OPTIONS=--max-old-space-size=16384 --max-semi-space-size=256
set NODE_NO_WARNINGS=1
set UV_THREADPOOL_SIZE=32

echo.
echo Configuration:
echo - Heap Size: 16GB
echo - Thread Pool: 32
echo - System RAM: 64GB
echo.

REM Start Claude Code in same window to see output
echo Starting Claude Code...
echo =====================================
"C:\Users\jaros\AppData\Roaming\npm\claude.cmd"

REM This will only show if Claude exits
echo.
echo Claude Code has exited.
pause