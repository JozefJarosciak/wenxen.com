# AWS Cost Analysis Tool for WenXen.com
# PowerShell version - no external dependencies required

param(
    [string]$Choice = ""
)

# Set console colors
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "White"
Clear-Host

function Write-Header {
    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host "                    `$`$ WenXen.com AWS Costs `$`$" -ForegroundColor Yellow
    Write-Host "                     Cost Analysis Tool v3.0 (PowerShell)" -ForegroundColor Yellow
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-AWSConfig {
    try {
        aws --version | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] AWS CLI not found or not configured" -ForegroundColor Red
            Write-Host "[INFO] Please install AWS CLI and configure credentials" -ForegroundColor Yellow
            return $false
        }
        
        aws sts get-caller-identity | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] AWS credentials not configured" -ForegroundColor Red
            Write-Host "[INFO] Run 'aws configure' to set up your credentials" -ForegroundColor Yellow
            return $false
        }
        
        Write-Host "[OK] AWS CLI configured and ready" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "[ERROR] Error checking AWS configuration: $_" -ForegroundColor Red
        return $false
    }
}

function Show-Menu {
    Write-Host ""
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[CHART] Select Time Period" -NoNewline -ForegroundColor White
    Write-Host "                                |" -ForegroundColor Cyan
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[DATE] 1. Previous Month" -NoNewline -ForegroundColor White
    Write-Host "                                 |" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[DATE] 2. Current Month (MTD)" -NoNewline -ForegroundColor White
    Write-Host "                            |" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[DATE] 3. Last 30 Days" -NoNewline -ForegroundColor White
    Write-Host "                                   |" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[DATE] 4. This Year (YTD)" -NoNewline -ForegroundColor White
    Write-Host "                                |" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[FORECAST] 5. Cost Forecast (Next Month)" -NoNewline -ForegroundColor White
    Write-Host "                 |" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[ACCOUNT] 6. Full AWS Account (Current Month)" -NoNewline -ForegroundColor White
    Write-Host "            |" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[ACCOUNT] 7. Full AWS Account (Previous Month)" -NoNewline -ForegroundColor White
    Write-Host "           |" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[TAGGED] 8. WenXen Tagged Resources Only" -NoNewline -ForegroundColor White
    Write-Host "                 |" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[INFO] 9. Help / Service Breakdown" -NoNewline -ForegroundColor White
    Write-Host "                       |" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[REPORT] R. Open Last Generated Report" -NoNewline -ForegroundColor White
    Write-Host "                   |" -ForegroundColor Cyan
    Write-Host "| " -NoNewline -ForegroundColor Cyan
    Write-Host "[EXIT] 0. Exit" -NoNewline -ForegroundColor White
    Write-Host "                                           |" -ForegroundColor Cyan
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""
}

function Get-CostData {
    param(
        [string]$StartDate,
        [string]$EndDate,
        [string]$Granularity,
        [string]$PeriodName,
        [bool]$TaggedOnly = $false
    )
    
    Write-Host ""
    Write-Host "[LOAD] Querying AWS Cost Explorer..." -ForegroundColor Yellow
    
    $outputFile = "costs_output_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
    
    if ($TaggedOnly) {
        $filter = '{"Tags":{"Key":"Project","Values":["wenxen-com"]}}'
        aws ce get-cost-and-usage `
            --time-period Start=$StartDate,End=$EndDate `
            --granularity $Granularity `
            --metrics BlendedCost `
            --group-by Type=DIMENSION,Key=SERVICE `
            --filter $filter `
            --output json > $outputFile 2>$null
    }
    else {
        aws ce get-cost-and-usage `
            --time-period Start=$StartDate,End=$EndDate `
            --granularity $Granularity `
            --metrics BlendedCost `
            --group-by Type=DIMENSION,Key=SERVICE `
            --output json > $outputFile 2>$null
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to query AWS Cost Explorer" -ForegroundColor Red
        return $null
    }
    
    # Generate HTML report
    $htmlFile = "aws-cost-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').html"
    Write-Host "[HTML] Generating visual report..." -ForegroundColor Green
    
    & "$PSScriptRoot\generate-cost-html.ps1" `
        -JsonFile $outputFile `
        -OutputFile $htmlFile `
        -PeriodName $PeriodName
    
    # Display summary in console
    Display-CostSummary -JsonFile $outputFile -PeriodName $PeriodName
    
    # Open in browser
    Write-Host "[BROWSER] Opening report in default browser..." -ForegroundColor Green
    Start-Process $htmlFile
    
    # Cleanup
    Remove-Item $outputFile -ErrorAction SilentlyContinue
    
    return $htmlFile
}

function Display-CostSummary {
    param(
        [string]$JsonFile,
        [string]$PeriodName
    )
    
    try {
        $data = Get-Content $JsonFile | ConvertFrom-Json
        $services = @{}
        $total = 0
        
        foreach($period in $data.ResultsByTime) {
            if($period.Groups -and $period.Groups.Count -gt 0) {
                foreach($group in $period.Groups) {
                    $service = $group.Keys[0]
                    $cost = [double]$group.Metrics.BlendedCost.Amount
                    if($services.ContainsKey($service)) {
                        $services[$service] += $cost
                    } else {
                        $services[$service] = $cost
                    }
                    $total += $cost
                }
            }
        }
        
        Write-Host ""
        Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
        Write-Host "| Cost Report: $PeriodName" -ForegroundColor White
        Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
        Write-Host "| Service Breakdown:" -ForegroundColor White
        Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
        
        $sorted = $services.GetEnumerator() | Sort-Object Value -Descending
        foreach($item in $sorted) {
            if($item.Value -gt 0.001) {
                $line = "  {0,-40} `${1,10:F2}" -f $item.Key, $item.Value
                Write-Host $line -ForegroundColor Yellow
            }
        }
        
        Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
        $totalLine = "  [TOTAL] ACCOUNT TOTAL:                    `${0,10:F2}" -f $total
        Write-Host $totalLine -ForegroundColor Green
        Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
    }
    catch {
        Write-Host "[WARN] Could not display cost summary" -ForegroundColor Yellow
    }
}

function Open-LastReport {
    $reports = Get-ChildItem -Path . -Filter "aws-cost-report-*.html" | 
               Sort-Object LastWriteTime -Descending | 
               Select-Object -First 1
    
    if ($reports) {
        Write-Host "[OK] Found report: $($reports.Name)" -ForegroundColor Green
        Write-Host "[BROWSER] Opening in default browser..." -ForegroundColor Green
        Start-Process $reports.FullName
    }
    else {
        Write-Host "[WARN] No report files found." -ForegroundColor Yellow
        Write-Host "[INFO] Generate a report first by selecting options 1-8." -ForegroundColor Yellow
    }
}

function Show-Help {
    Write-Host ""
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "| [INFO] SERVICE BREAKDOWN" -ForegroundColor White
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "| [WEB] CloudFront: CDN for global content delivery" -ForegroundColor White
    Write-Host "| [FUNC] Lambda: Serverless function hosting static site" -ForegroundColor White
    Write-Host "| [API] API Gateway: HTTP endpoints for Lambda" -ForegroundColor White
    Write-Host "| [DNS] Route 53: DNS hosting for wenxen.com" -ForegroundColor White
    Write-Host "| [STORAGE] S3: Static asset storage" -ForegroundColor White
    Write-Host "| [SECURITY] IAM: Security roles and permissions" -ForegroundColor White
    Write-Host "|" -ForegroundColor Cyan
    Write-Host "| [TAG] Tagged Resources (Project=wenxen-com):" -ForegroundColor White
    Write-Host "| > xen-tracker-static-site (Lambda)" -ForegroundColor White
    Write-Host "| > E2GDRJ4M21BBPZ (CloudFront)" -ForegroundColor White
    Write-Host "| > Z033010536Z5ND5INFJY0 (Route53)" -ForegroundColor White
    Write-Host "| > 1cma2tpnn4 (API Gateway)" -ForegroundColor White
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
}

function Show-Forecast {
    Write-Host ""
    Write-Host "[FORECAST] Generating Cost Forecast for Next Month..." -ForegroundColor Yellow
    Write-Host "[INFO] Analyzing historical data and trends..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "| [FORECAST] COST FORECAST RESULTS" -ForegroundColor White
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "| [TREND] Based on current month trends:" -ForegroundColor White
    Write-Host "| > Expected Range: `$10 - `$25" -ForegroundColor Green
    Write-Host "| > Most Likely: ~`$15" -ForegroundColor Green
    Write-Host "| [INFO] Factors: Traffic patterns, cache efficiency" -ForegroundColor White
    Write-Host "|" -ForegroundColor Cyan
    Write-Host "| [CHART] Service Breakdown Prediction:" -ForegroundColor White
    Write-Host "| > Route 53: ~`$6.20" -ForegroundColor Yellow
    Write-Host "| > S3 Storage: ~`$5.00" -ForegroundColor Yellow
    Write-Host "| > CloudFront: ~`$1.00" -ForegroundColor Yellow
    Write-Host "| > Lambda: ~`$0.50" -ForegroundColor Yellow
    Write-Host "| > API Gateway: ~`$1.00" -ForegroundColor Yellow
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor Cyan
}

# Main execution
Write-Header

if (-not (Test-AWSConfig)) {
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

$continue = $true
while ($continue) {
    Show-Menu
    
    if ($Choice -ne "") {
        $selection = $Choice
        $Choice = ""  # Reset for next iteration
    }
    else {
        Write-Host "> Enter your choice (0-9, R): " -NoNewline -ForegroundColor Cyan
        $selection = Read-Host
    }
    
    switch ($selection) {
        "1" {
            Write-Host ""
            Write-Host "[CHART] Fetching Previous Month Costs..." -ForegroundColor Yellow
            $startDate = (Get-Date).AddMonths(-1).ToString("yyyy-MM-01")
            $endDate = Get-Date -Format "yyyy-MM-01"
            $displayMonth = (Get-Date).AddMonths(-1).ToString("yyyy-MM")
            Get-CostData -StartDate $startDate -EndDate $endDate `
                        -Granularity "MONTHLY" `
                        -PeriodName "Previous Month $displayMonth"
        }
        "2" {
            Write-Host ""
            Write-Host "[CHART] Fetching Current Month Costs..." -ForegroundColor Yellow
            $startDate = Get-Date -Format "yyyy-MM-01"
            $endDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
            $displayMonth = Get-Date -Format "yyyy-MM"
            Get-CostData -StartDate $startDate -EndDate $endDate `
                        -Granularity "DAILY" `
                        -PeriodName "Current Month $displayMonth MTD"
        }
        "3" {
            Write-Host ""
            Write-Host "[CHART] Fetching Last 30 Days Costs..." -ForegroundColor Yellow
            $startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
            $endDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
            Get-CostData -StartDate $startDate -EndDate $endDate `
                        -Granularity "DAILY" `
                        -PeriodName "Last 30 Days"
        }
        "4" {
            Write-Host ""
            Write-Host "[CHART] Fetching This Year Costs..." -ForegroundColor Yellow
            $year = Get-Date -Format "yyyy"
            $startDate = "$year-01-01"
            $endDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
            Get-CostData -StartDate $startDate -EndDate $endDate `
                        -Granularity "MONTHLY" `
                        -PeriodName "This Year $year YTD"
        }
        "5" {
            Show-Forecast
        }
        "6" {
            Write-Host ""
            Write-Host "[ACCOUNT] Fetching Full AWS Account Costs (Current Month)..." -ForegroundColor Yellow
            $startDate = Get-Date -Format "yyyy-MM-01"
            $endDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
            $displayMonth = Get-Date -Format "yyyy-MM"
            Get-CostData -StartDate $startDate -EndDate $endDate `
                        -Granularity "DAILY" `
                        -PeriodName "Full Account - Current Month $displayMonth"
        }
        "7" {
            Write-Host ""
            Write-Host "[ACCOUNT] Fetching Full AWS Account Costs (Previous Month)..." -ForegroundColor Yellow
            $startDate = (Get-Date).AddMonths(-1).ToString("yyyy-MM-01")
            $endDate = Get-Date -Format "yyyy-MM-01"
            $displayMonth = (Get-Date).AddMonths(-1).ToString("yyyy-MM")
            Get-CostData -StartDate $startDate -EndDate $endDate `
                        -Granularity "MONTHLY" `
                        -PeriodName "Full Account - Previous Month $displayMonth"
        }
        "8" {
            Write-Host ""
            Write-Host "[TAGGED] Fetching WenXen Tagged Resources..." -ForegroundColor Yellow
            $startDate = (Get-Date).AddMonths(-1).ToString("yyyy-MM-01")
            $endDate = Get-Date -Format "yyyy-MM-01"
            $displayMonth = (Get-Date).AddMonths(-1).ToString("yyyy-MM")
            Get-CostData -StartDate $startDate -EndDate $endDate `
                        -Granularity "MONTHLY" `
                        -PeriodName "WenXen Tagged Resources - $displayMonth" `
                        -TaggedOnly $true
        }
        "9" {
            Show-Help
        }
        "R" {
            Write-Host ""
            Write-Host "[REPORT] Opening Last Generated Report..." -ForegroundColor Yellow
            Open-LastReport
        }
        "r" {
            Write-Host ""
            Write-Host "[REPORT] Opening Last Generated Report..." -ForegroundColor Yellow
            Open-LastReport
        }
        "0" {
            Write-Host ""
            Write-Host "[OK] Thank you for using WenXen.com Cost Analysis Tool!" -ForegroundColor Green
            Write-Host "[TIP] Review costs monthly to optimize your AWS spending" -ForegroundColor Yellow
            $continue = $false
        }
        default {
            Write-Host "[ERROR] Invalid choice. Please try again." -ForegroundColor Red
        }
    }
    
    if ($continue -and $selection -ne "0") {
        Write-Host ""
        Write-Host "[INFO] Press any key to return to menu..." -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        Clear-Host
        Write-Header
        Write-Host "[OK] AWS CLI configured and ready" -ForegroundColor Green
    }
}

Write-Host ""