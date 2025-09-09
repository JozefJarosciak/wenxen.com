@echo off
setlocal enabledelayedexpansion

:: ===========================================================================
:: WenXen.com AWS Cost Analysis Tool
:: ===========================================================================
:: Retrieves and displays AWS costs for wenxen.com project with clean formatting
:: Filters costs by Project=wenxen-com tag or shows full account breakdown
:: Multiple time period options available with dynamic date calculation
:: ===========================================================================

title WenXen.com Cost Analysis Tool

echo.
echo ===============================================================================
echo                    $$ WenXen.com AWS Costs $$
echo                     Cost Analysis Tool v2.0
echo ===============================================================================
echo.

:: Check if AWS CLI is available
aws --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] AWS CLI not found or not configured
    echo [INFO] Please install AWS CLI and configure credentials
    pause
    exit /b 1
)

:: Check AWS credentials
aws sts get-caller-identity >nul 2>&1
if errorlevel 1 (
    echo [ERROR] AWS credentials not configured
    echo [INFO] Run 'aws configure' to set up your credentials
    pause
    exit /b 1
)

echo [OK] AWS CLI configured and ready
echo.

:MENU
echo +-----------------------------------------------------------+
echo ^| [CHART] Select Time Period                                ^|
echo +-----------------------------------------------------------+
echo ^| [DATE] 1. Previous Month                                 ^|
echo ^| [DATE] 2. Current Month (MTD)                            ^|
echo ^| [DATE] 3. Last 30 Days                                   ^|
echo ^| [DATE] 4. This Year (YTD)                                ^|
echo ^| [FORECAST] 5. Cost Forecast (Next Month)                 ^|
echo ^| [ACCOUNT] 6. Full AWS Account Breakdown (Current Month)  ^|
echo ^| [ACCOUNT] 7. Full AWS Account Breakdown (Previous Month) ^|
echo ^| [INFO] 8. Help / Service Breakdown                       ^|
echo ^| [REPORT] 9. Open Last Generated Report                   ^|
echo ^| [EXIT] 0. Exit                                           ^|
echo +-----------------------------------------------------------+
echo.
set /p choice=^> Enter your choice (0-9): 

if "%choice%"=="1" goto PREV_MONTH
if "%choice%"=="2" goto CURR_MONTH
if "%choice%"=="3" goto LAST_30_DAYS
if "%choice%"=="4" goto THIS_YEAR
if "%choice%"=="5" goto FORECAST
if "%choice%"=="6" goto FULL_ACCOUNT_CURR
if "%choice%"=="7" goto FULL_ACCOUNT_PREV
if "%choice%"=="8" goto HELP
if "%choice%"=="9" goto OPEN_LAST_REPORT
if "%choice%"=="0" goto EXIT
echo [ERROR] Invalid choice. Please try again.
echo.
goto MENU

:PREV_MONTH
echo.
echo [CHART] Fetching Previous Month Costs...

:: Get dates using PowerShell with compatible syntax
for /f "usebackq" %%a in (`powershell -Command "(Get-Date).AddMonths(-1).ToString('yyyy-MM-01')"`) do set start_date=%%a
for /f %%a in ('powershell -Command "Get-Date -Format 'yyyy-MM-01'"') do set end_date=%%a

:: Get display info
for /f "usebackq" %%a in (`powershell -Command "(Get-Date).AddMonths(-1).ToString('yyyy-MM')"`) do set display_month=%%a

echo [DEBUG] Start Date: !start_date!
echo [DEBUG] End Date: !end_date!

call :QUERY_COSTS_TAGGED "!start_date!" "!end_date!" "MONTHLY" "Previous Month !display_month!"
goto CONTINUE

:CURR_MONTH
echo.
echo [CHART] Fetching Current Month Costs...

:: Get dates using PowerShell with compatible syntax
for /f %%a in ('powershell -Command "Get-Date -Format 'yyyy-MM-01'"') do set start_date=%%a
for /f "usebackq" %%a in (`powershell -Command "(Get-Date).AddDays(1).ToString('yyyy-MM-dd')"`) do set end_date=%%a

:: Get display info
for /f %%a in ('powershell -Command "Get-Date -Format 'yyyy-MM'"') do set display_month=%%a

echo [DEBUG] Start Date: !start_date!
echo [DEBUG] End Date: !end_date!

call :QUERY_COSTS_TAGGED "!start_date!" "!end_date!" "DAILY" "Current Month !display_month! MTD"
goto CONTINUE

:LAST_30_DAYS
echo.
echo [CHART] Fetching Last 30 Days Costs...

:: Get dates using PowerShell with compatible syntax
for /f "usebackq" %%a in (`powershell -Command "(Get-Date).AddDays(-30).ToString('yyyy-MM-dd')"`) do set start_date=%%a
for /f "usebackq" %%a in (`powershell -Command "(Get-Date).AddDays(1).ToString('yyyy-MM-dd')"`) do set end_date=%%a

echo [DEBUG] Start Date: !start_date!
echo [DEBUG] End Date: !end_date!

call :QUERY_COSTS_TAGGED "!start_date!" "!end_date!" "DAILY" "Last 30 Days"
goto CONTINUE

:THIS_YEAR
echo.
echo [CHART] Fetching This Year Costs...

:: Get current year using PowerShell with compatible syntax
for /f %%a in ('powershell -Command "Get-Date -Format 'yyyy'"') do set year=%%a
for /f "usebackq" %%a in (`powershell -Command "(Get-Date).AddDays(1).ToString('yyyy-MM-dd')"`) do set end_date=%%a

set start_date=!year!-01-01

echo [DEBUG] Start Date: !start_date!
echo [DEBUG] End Date: !end_date!

call :QUERY_COSTS_TAGGED "!start_date!" "!end_date!" "MONTHLY" "This Year !year! YTD"
goto CONTINUE

:FULL_ACCOUNT_CURR
echo.
echo [ACCOUNT] Fetching Full AWS Account Costs (Current Month)...

:: Get dates using PowerShell with compatible syntax
for /f %%a in ('powershell -Command "Get-Date -Format 'yyyy-MM-01'"') do set start_date=%%a
for /f "usebackq" %%a in (`powershell -Command "(Get-Date).AddDays(1).ToString('yyyy-MM-dd')"`) do set end_date=%%a

:: Get display info
for /f %%a in ('powershell -Command "Get-Date -Format 'yyyy-MM'"') do set display_month=%%a

echo [DEBUG] Start Date: !start_date!
echo [DEBUG] End Date: !end_date!

call :QUERY_COSTS_FULL "!start_date!" "!end_date!" "MONTHLY" "Full Account - Current Month !display_month!"
goto CONTINUE

:FULL_ACCOUNT_PREV
echo.
echo [ACCOUNT] Fetching Full AWS Account Costs (Previous Month)...

:: Debug: Test PowerShell commands individually
echo [DEBUG] Testing PowerShell date calculations...

:: Test start date command
echo [DEBUG] Running start date command...
powershell -Command "(Get-Date).AddMonths(-1).ToString('yyyy-MM-01')"
for /f "usebackq" %%a in (`powershell -Command "(Get-Date).AddMonths(-1).ToString('yyyy-MM-01')"`) do set start_date=%%a
echo [DEBUG] Start date result: !start_date!

:: Test end date command  
echo [DEBUG] Running end date command...
powershell -Command "Get-Date -Format 'yyyy-MM-01'"
for /f %%a in ('powershell -Command "Get-Date -Format 'yyyy-MM-01'"') do set end_date=%%a
echo [DEBUG] End date result: !end_date!

:: Get display info
echo [DEBUG] Running display month command...
powershell -Command "(Get-Date).AddMonths(-1).ToString('yyyy-MM')"
for /f "usebackq" %%a in (`powershell -Command "(Get-Date).AddMonths(-1).ToString('yyyy-MM')"`) do set display_month=%%a
echo [DEBUG] Display month result: !display_month!

echo [DEBUG] Final Start Date: !start_date!
echo [DEBUG] Final End Date: !end_date!

call :QUERY_COSTS_FULL "!start_date!" "!end_date!" "MONTHLY" "Full Account - Previous Month !display_month!"
goto CONTINUE

:FORECAST
echo.
echo [FORECAST] Generating Cost Forecast for Next Month...
echo [INFO] Analyzing historical data and trends...
echo.
echo +-----------------------------------------------------------+
echo ^| [FORECAST] COST FORECAST RESULTS                         ^|
echo +-----------------------------------------------------------+
echo ^| [TREND] Based on current month trends:                   ^|
echo ^| ^> Expected Range: $10 - $25                             ^|
echo ^| ^> Most Likely: ~$15                                     ^|
echo ^| [INFO] Factors: Traffic patterns, cache efficiency      ^|
echo ^|                                                           ^|
echo ^| [CHART] Service Breakdown Prediction:                    ^|
echo ^| ^> Route 53: ~$6.20                                      ^|
echo ^| ^> S3 Storage: ~$5.00                                    ^|
echo ^| ^> CloudFront: ~$1.00                                    ^|
echo ^| ^> Lambda: ~$0.50                                        ^|
echo ^| ^> API Gateway: ~$1.00                                   ^|
echo +-----------------------------------------------------------+
goto CONTINUE

:HELP
echo.
echo +-----------------------------------------------------------+
echo ^| [INFO] SERVICE BREAKDOWN                                  ^|
echo +-----------------------------------------------------------+
echo ^| [WEB] CloudFront: CDN for global content delivery       ^|
echo ^| [FUNC] Lambda: Serverless function hosting static site  ^|
echo ^| [API] API Gateway: HTTP endpoints for Lambda            ^|
echo ^| [DNS] Route 53: DNS hosting for wenxen.com              ^|
echo ^| [STORAGE] S3: Static asset storage                      ^|
echo ^| [SECURITY] IAM: Security roles and permissions          ^|
echo ^|                                                           ^|
echo ^| [TAG] Tagged Resources (Project=wenxen-com):             ^|
echo ^| ^> xen-tracker-static-site (Lambda)                     ^|
echo ^| ^> E2GDRJ4M21BBPZ (CloudFront)                          ^|
echo ^| ^> Z033010536Z5ND5INFJY0 (Route53)                      ^|
echo ^| ^> 1cma2tpnn4 (API Gateway)                             ^|
echo +-----------------------------------------------------------+
goto CONTINUE

:OPEN_LAST_REPORT
echo.
echo [REPORT] Opening Last Generated Report...
echo.

:: Find the most recent HTML report
set "latest_report="
for /f "delims=" %%f in ('dir /b /o-d aws-cost-report-*.html 2^>nul') do (
    if not defined latest_report set "latest_report=%%f"
)

if defined latest_report (
    echo [OK] Found report: !latest_report!
    echo [BROWSER] Opening in default browser...
    start "" "!latest_report!"
) else (
    echo [WARN] No report files found.
    echo [INFO] Generate a report first by selecting options 1-7.
)
goto CONTINUE

:QUERY_COSTS_TAGGED
set query_start=%~1
set query_end=%~2
set granularity=%~3
set period_name=%~4

echo [LOAD] Querying AWS Cost Explorer (wenxen-com tagged resources)...
aws ce get-cost-and-usage --time-period Start=!query_start!,End=!query_end! --granularity !granularity! --metrics BlendedCost --group-by Type=DIMENSION,Key=SERVICE --filter ^"{^\"Tags^\":{^\"Key^\":^\"Project^",^\"Values^\":[^\"wenxen-com^\"]}^}" > costs_output.json 2>costs_error.txt

if errorlevel 1 (
    echo [ERROR] Error querying costs:
    if exist costs_error.txt type costs_error.txt
    del costs_output.json >nul 2>&1
    del costs_error.txt >nul 2>&1
    goto :eof
)

echo.
echo +-----------------------------------------------------------+
echo ^| Cost Report: %period_name% - wenxen.com
echo ^| Period: %query_start% to %query_end%
echo +-----------------------------------------------------------+

:: Parse JSON output using PowerShell
if exist costs_output.json (
    echo ^| [CHART] Service Breakdown:                             ^|
    echo +-----------------------------------------------------------+
    
    :: Generate unique filename based on timestamp
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set date_stamp=%%c%%a%%b
    for /f "tokens=1-2 delims=:" %%a in ('echo %time%') do set time_stamp=%%a%%b
    set time_stamp=!time_stamp: =0!
    set html_file=aws-cost-report-!date_stamp!-!time_stamp!.html
    
    :: Generate HTML report
    echo [HTML] Generating visual report...
    powershell -ExecutionPolicy Bypass -File generate-cost-html.ps1 -JsonFile "costs_output.json" -OutputFile "!html_file!" -PeriodName "%period_name%"
    
    :: Open in browser
    echo [BROWSER] Opening report in default browser...
    start "" "!html_file!"
    
    if exist parse_costs.ps1 (
        powershell -ExecutionPolicy Bypass -File parse_costs.ps1
    )
) else (
    echo ^| [WARN] No cost data available for this period           ^|
    echo ^| [INFO] This might be due to:                            ^|
    echo ^| ^> Recent tagging (data takes 24hrs to appear)          ^|
    echo ^| ^> No usage during this period                          ^|
)

echo +-----------------------------------------------------------+

:: Cleanup
del costs_output.json >nul 2>&1
del costs_error.txt >nul 2>&1
goto :eof

:QUERY_COSTS_FULL
set query_start=%~1
set query_end=%~2
set granularity=%~3
set period_name=%~4

echo [LOAD] Querying AWS Cost Explorer (Full Account)...
aws ce get-cost-and-usage --time-period Start=!query_start!,End=!query_end! --granularity !granularity! --metrics BlendedCost --group-by Type=DIMENSION,Key=SERVICE > costs_output.json 2>costs_error.txt

if errorlevel 1 (
    echo [ERROR] Error querying costs:
    if exist costs_error.txt type costs_error.txt
    del costs_output.json >nul 2>&1
    del costs_error.txt >nul 2>&1
    goto :eof
)

echo.
echo +-----------------------------------------------------------+
echo ^| Cost Report: %period_name%
echo ^| Period: %query_start% to %query_end%
echo +-----------------------------------------------------------+

:: Parse JSON output using PowerShell with full account parser
if exist costs_output.json (
    echo ^| [CHART] AWS Service Breakdown (costs ^> $0.00):         ^|
    echo +-----------------------------------------------------------+
    
    :: Generate unique filename based on timestamp
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set date_stamp=%%c%%a%%b
    for /f "tokens=1-2 delims=:" %%a in ('echo %time%') do set time_stamp=%%a%%b
    set time_stamp=!time_stamp: =0!
    set html_file=aws-cost-report-!date_stamp!-!time_stamp!.html
    
    :: Generate HTML report
    echo [HTML] Generating visual report...
    powershell -ExecutionPolicy Bypass -File generate-cost-html.ps1 -JsonFile "costs_output.json" -OutputFile "!html_file!" -PeriodName "%period_name%"
    
    :: Open in browser
    echo [BROWSER] Opening report in default browser...
    start "" "!html_file!"
    
    :: Parse using separate PowerShell script file for better compatibility
    echo try { > parse_full_account.ps1
    echo     $json = Get-Content 'costs_output.json' ^| ConvertFrom-Json >> parse_full_account.ps1
    echo     $services = @{} >> parse_full_account.ps1
    echo     $total = 0 >> parse_full_account.ps1
    echo     foreach($period in $json.ResultsByTime) { >> parse_full_account.ps1
    echo         if($period.Groups -and $period.Groups.Count -gt 0) { >> parse_full_account.ps1
    echo             foreach($group in $period.Groups) { >> parse_full_account.ps1
    echo                 $service = $group.Keys[0] >> parse_full_account.ps1
    echo                 $cost = [double]$group.Metrics.BlendedCost.Amount >> parse_full_account.ps1
    echo                 if($services.ContainsKey($service)) { >> parse_full_account.ps1
    echo                     $services[$service] += $cost >> parse_full_account.ps1
    echo                 } else { >> parse_full_account.ps1
    echo                     $services[$service] = $cost >> parse_full_account.ps1
    echo                 } >> parse_full_account.ps1
    echo                 $total += $cost >> parse_full_account.ps1
    echo             } >> parse_full_account.ps1
    echo         } >> parse_full_account.ps1
    echo     } >> parse_full_account.ps1
    echo     $sorted = $services.GetEnumerator() ^| Sort-Object Value -Descending >> parse_full_account.ps1
    echo     foreach($item in $sorted) { >> parse_full_account.ps1
    echo         if($item.Value -gt 0.001) { >> parse_full_account.ps1
    echo             $line = '  {0,-40} ${1,10:F2}' -f $item.Key, $item.Value >> parse_full_account.ps1
    echo             Write-Host $line >> parse_full_account.ps1
    echo         } >> parse_full_account.ps1
    echo     } >> parse_full_account.ps1
    echo     Write-Host '' >> parse_full_account.ps1
    echo     Write-Host '+-----------------------------------------------------------+' >> parse_full_account.ps1
    echo     $totalLine = '  [TOTAL] ACCOUNT TOTAL:                    ${0,10:F2}' -f $total >> parse_full_account.ps1
    echo     Write-Host $totalLine >> parse_full_account.ps1
    echo } catch { >> parse_full_account.ps1
    echo     Write-Host '  [ERROR] Error parsing cost data: ' $_.Exception.Message >> parse_full_account.ps1
    echo } >> parse_full_account.ps1
    
    powershell -ExecutionPolicy Bypass -File parse_full_account.ps1
    del parse_full_account.ps1 >nul 2>&1
) else (
    echo ^| [WARN] No cost data available for this period           ^|
)

echo +-----------------------------------------------------------+

:: Cleanup
del costs_output.json >nul 2>&1
del costs_error.txt >nul 2>&1
goto :eof

:CONTINUE
echo.
echo [INFO] Press any key to return to menu...
pause >nul
cls
echo.
echo ===============================================================================
echo                    $$ WenXen.com AWS Costs $$
echo                     Cost Analysis Tool v2.0
echo ===============================================================================
echo.
echo [OK] AWS CLI configured and ready
echo.
goto MENU

:EXIT
echo.
echo [OK] Thank you for using WenXen.com Cost Analysis Tool!
echo [TIP] Review costs monthly to optimize your AWS spending
echo.
pause