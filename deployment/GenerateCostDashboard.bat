@echo off
echo.
echo Generating AWS Cost Dashboard...
echo This will fetch all cost data and create an interactive HTML dashboard.
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0Get-AWSCostsDashboard.ps1"
pause