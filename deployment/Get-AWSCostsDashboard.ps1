# AWS Cost Analysis Dashboard Generator
# Pulls all data once and creates an interactive HTML dashboard

param(
    [switch]$OpenBrowser = $true
)

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "           AWS Cost Analysis Dashboard Generator" -ForegroundColor Yellow
Write-Host "           Fetching all cost data - this may take a moment..." -ForegroundColor Yellow  
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

# Test AWS CLI availability
try {
    aws --version | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI not available"
    }
    aws sts get-caller-identity | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "AWS credentials not configured"
    }
    Write-Host "[OK] AWS CLI configured and ready" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] AWS CLI not found or credentials not configured" -ForegroundColor Red
    Write-Host "[INFO] Please install AWS CLI and run 'aws configure'" -ForegroundColor Yellow
    exit 1
}

# Initialize data collection
$allData = @{
    generatedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    previousMonth = @{}
    currentMonth = @{}
    last30Days = @{}
    last90Days = @{}
    yearToDate = @{}
    taggedResources = @{}
    lastYear = @{}
    forecast = @{}
}

# Helper function to get cost data
function Get-CostData {
    param(
        [string]$StartDate,
        [string]$EndDate,
        [string]$Granularity,
        [string]$DataKey,
        [bool]$TaggedOnly = $false
    )
    
    Write-Host "[FETCH] Getting $DataKey data..." -ForegroundColor Yellow
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    
    try {
        if ($TaggedOnly) {
            $filter = '{"Tags":{"Key":"Project","Values":["wenxen-com"]}}'
            aws ce get-cost-and-usage `
                --time-period Start=$StartDate,End=$EndDate `
                --granularity $Granularity `
                --metrics BlendedCost `
                --group-by Type=DIMENSION,Key=SERVICE `
                --filter $filter `
                --output json > $tempFile 2>$null
        }
        else {
            aws ce get-cost-and-usage `
                --time-period Start=$StartDate,End=$EndDate `
                --granularity $Granularity `
                --metrics BlendedCost `
                --group-by Type=DIMENSION,Key=SERVICE `
                --output json > $tempFile 2>$null
        }
        
        if ($LASTEXITCODE -eq 0) {
            $jsonContent = Get-Content $tempFile -Raw
            $allData[$DataKey] = $jsonContent | ConvertFrom-Json
            Write-Host "[OK] $DataKey data retrieved" -ForegroundColor Green
        }
        else {
            Write-Host "[SKIP] $DataKey data not available (might be due to recent tagging)" -ForegroundColor Yellow
            $allData[$DataKey] = @{ Error = "Data not available"; ResultsByTime = @() }
        }
    }
    catch {
        Write-Host "[ERROR] Failed to get $DataKey data: $_" -ForegroundColor Red
        $allData[$DataKey] = @{ Error = $_.ToString(); ResultsByTime = @() }
    }
    finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}

# Collect all data
Write-Host ""
Write-Host "Collecting comprehensive cost data..." -ForegroundColor Cyan
Write-Host ""

# Previous Month
$prevMonthStart = (Get-Date).AddMonths(-1).ToString("yyyy-MM-01")
$prevMonthEnd = Get-Date -Format "yyyy-MM-01"
Get-CostData -StartDate $prevMonthStart -EndDate $prevMonthEnd -Granularity "MONTHLY" -DataKey "previousMonth"

# Current Month
$currMonthStart = Get-Date -Format "yyyy-MM-01"
$currMonthEnd = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
Get-CostData -StartDate $currMonthStart -EndDate $currMonthEnd -Granularity "DAILY" -DataKey "currentMonth"

# Last 30 Days
$last30Start = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
$last30End = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
Get-CostData -StartDate $last30Start -EndDate $last30End -Granularity "DAILY" -DataKey "last30Days"

# Last 90 Days
$last90Start = (Get-Date).AddDays(-90).ToString("yyyy-MM-dd")
$last90End = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
Get-CostData -StartDate $last90Start -EndDate $last90End -Granularity "DAILY" -DataKey "last90Days"

# Year to Date
$ytdStart = (Get-Date).ToString("yyyy-01-01")
$ytdEnd = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
Get-CostData -StartDate $ytdStart -EndDate $ytdEnd -Granularity "MONTHLY" -DataKey "yearToDate"

# Last Year (for comparison)
$lastYearStart = (Get-Date).AddYears(-1).ToString("yyyy-01-01")
$lastYearEnd = (Get-Date).ToString("yyyy-01-01")
Get-CostData -StartDate $lastYearStart -EndDate $lastYearEnd -Granularity "MONTHLY" -DataKey "lastYear"

# Tagged Resources (Previous Month) - This might fail if tags are new
Get-CostData -StartDate $prevMonthStart -EndDate $prevMonthEnd -Granularity "MONTHLY" -DataKey "taggedResources" -TaggedOnly $true

# Get forecast
Write-Host "[FETCH] Getting cost forecast..." -ForegroundColor Yellow
$forecastStart = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$forecastEnd = (Get-Date).AddMonths(1).ToString("yyyy-MM-01")
$tempFile = [System.IO.Path]::GetTempFileName()

try {
    aws ce get-cost-forecast `
        --time-period Start=$forecastStart,End=$forecastEnd `
        --metric BLENDED_COST `
        --granularity MONTHLY `
        --output json > $tempFile 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        $jsonContent = Get-Content $tempFile -Raw
        $allData.forecast = $jsonContent | ConvertFrom-Json
        Write-Host "[OK] Forecast data retrieved" -ForegroundColor Green
    }
    else {
        Write-Host "[SKIP] Forecast not available" -ForegroundColor Yellow
        $allData.forecast = @{ Error = "Forecast not available" }
    }
}
catch {
    Write-Host "[ERROR] Failed to get forecast: $_" -ForegroundColor Red
    $allData.forecast = @{ Error = $_.ToString() }
}
finally {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

# Convert all data to JSON for JavaScript
$jsonData = $allData | ConvertTo-Json -Depth 10 -Compress
# Convert to base64 to avoid escaping issues
$jsonDataBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($jsonData))

# Generate HTML Dashboard
Write-Host ""
Write-Host "Generating interactive dashboard..." -ForegroundColor Cyan

# Build HTML content - part 1 (before JavaScript data)
$htmlPart1 = @'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AWS Cost Analysis Dashboard - WenXen.com</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/date-fns@2.29.3/index.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .header {
            background: rgba(255,255,255,0.95);
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            color: #333;
            font-size: 2rem;
            margin-bottom: 10px;
        }
        
        .header .subtitle {
            color: #666;
            font-size: 1rem;
        }
        
        .nav-tabs {
            background: white;
            padding: 0 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            padding-top: 10px;
        }
        
        .nav-tab {
            padding: 12px 24px;
            background: #f5f5f5;
            border: none;
            cursor: pointer;
            border-radius: 8px 8px 0 0;
            font-weight: 600;
            color: #666;
            transition: all 0.3s ease;
            position: relative;
        }
        
        .nav-tab:hover {
            background: #e0e0e0;
        }
        
        .nav-tab.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .nav-tab .badge {
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(255,255,255,0.3);
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.7rem;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .tab-content {
            display: none;
            animation: fadeIn 0.5s;
        }
        
        .tab-content.active {
            display: block;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        
        .stat-card.primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .stat-card.success {
            background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
            color: white;
        }
        
        .stat-card.warning {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            color: white;
        }
        
        .stat-label {
            font-size: 0.85rem;
            text-transform: uppercase;
            opacity: 0.8;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .stat-change {
            font-size: 0.9rem;
            opacity: 0.9;
        }
        
        .charts-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        @media (max-width: 968px) {
            .charts-row {
                grid-template-columns: 1fr;
            }
        }
        
        .chart-container {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .chart-title {
            font-size: 1.2rem;
            margin-bottom: 20px;
            color: #333;
            font-weight: 600;
        }
        
        .table-container {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            overflow-x: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
        }
        
        tr:hover {
            background: #f8f8f8;
        }
        
        .amount {
            font-weight: 600;
            color: #667eea;
        }
        
        .percentage-bar {
            background: #e0e0e0;
            height: 20px;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
        }
        
        .percentage-fill {
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            height: 100%;
            transition: width 1s ease;
            display: flex;
            align-items: center;
            padding-left: 5px;
        }
        
        .percentage-text {
            color: white;
            font-size: 0.8rem;
            font-weight: 600;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        
        .error-message {
            background: #ff6b6b;
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        
        .info-message {
            background: #4ecdc4;
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        
        .date-selector {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .date-selector label {
            font-weight: 600;
            color: #666;
        }
        
        .date-selector select {
            padding: 8px 12px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
        }
        
        .trend-indicator {
            display: inline-block;
            margin-left: 5px;
        }
        
        .trend-up {
            color: #ff6b6b;
        }
        
        .trend-down {
            color: #51cf66;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            color: white;
            margin-top: 40px;
        }
        
        .comparison-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .comparison-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .comparison-card h3 {
            margin-bottom: 15px;
            color: #333;
        }
        
        .comparison-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .comparison-item:last-child {
            border-bottom: none;
        }
        
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>AWS Cost Analysis Dashboard</h1>
        <div class="subtitle">WenXen.com Infrastructure Costs - Generated: <span id="generatedTime"></span></div>
    </div>
    
    <div class="nav-tabs">
        <button class="nav-tab active" onclick="switchTab('overview')">Overview</button>
        <button class="nav-tab" onclick="switchTab('previousMonth')">Previous Month</button>
        <button class="nav-tab" onclick="switchTab('currentMonth')">Current Month</button>
        <button class="nav-tab" onclick="switchTab('last30')">Last 30 Days</button>
        <button class="nav-tab" onclick="switchTab('last90')">Last 90 Days</button>
        <button class="nav-tab" onclick="switchTab('ytd')">Year to Date</button>
        <button class="nav-tab" onclick="switchTab('comparison')">Comparisons</button>
        <button class="nav-tab" onclick="switchTab('forecast')">Forecast</button>
        <button class="nav-tab" onclick="switchTab('tagged')">Tagged Resources</button>
    </div>
    
    <div class="container">
        <!-- Overview Tab -->
        <div id="overview" class="tab-content active">
            <div class="stats-grid" id="overviewStats"></div>
            <div class="charts-row">
                <div class="chart-container">
                    <h2 class="chart-title">Cost Trend (Last 90 Days)</h2>
                    <canvas id="trendChart"></canvas>
                </div>
                <div class="chart-container">
                    <h2 class="chart-title">Service Distribution (Current Month)</h2>
                    <canvas id="overviewPieChart"></canvas>
                </div>
            </div>
        </div>
        
        <!-- Previous Month Tab -->
        <div id="previousMonth" class="tab-content">
            <div class="stats-grid" id="prevMonthStats"></div>
            <div class="charts-row">
                <div class="chart-container">
                    <h2 class="chart-title">Service Distribution</h2>
                    <canvas id="prevMonthPieChart"></canvas>
                </div>
                <div class="chart-container">
                    <h2 class="chart-title">Cost by Service</h2>
                    <canvas id="prevMonthBarChart"></canvas>
                </div>
            </div>
            <div class="table-container">
                <h2 class="chart-title">Detailed Breakdown</h2>
                <table id="prevMonthTable"></table>
            </div>
        </div>
        
        <!-- Current Month Tab -->
        <div id="currentMonth" class="tab-content">
            <div class="stats-grid" id="currMonthStats"></div>
            <div class="charts-row">
                <div class="chart-container">
                    <h2 class="chart-title">Daily Cost Trend</h2>
                    <canvas id="currMonthLineChart"></canvas>
                </div>
                <div class="chart-container">
                    <h2 class="chart-title">Service Distribution</h2>
                    <canvas id="currMonthPieChart"></canvas>
                </div>
            </div>
            <div class="table-container">
                <h2 class="chart-title">Service Details</h2>
                <table id="currMonthTable"></table>
            </div>
        </div>
        
        <!-- Last 30 Days Tab -->
        <div id="last30" class="tab-content">
            <div class="stats-grid" id="last30Stats"></div>
            <div class="chart-container">
                <h2 class="chart-title">Daily Cost Trend</h2>
                <canvas id="last30LineChart"></canvas>
            </div>
            <div class="table-container">
                <h2 class="chart-title">Service Breakdown</h2>
                <table id="last30Table"></table>
            </div>
        </div>
        
        <!-- Last 90 Days Tab -->
        <div id="last90" class="tab-content">
            <div class="stats-grid" id="last90Stats"></div>
            <div class="chart-container">
                <h2 class="chart-title">Daily Cost Trend</h2>
                <canvas id="last90LineChart"></canvas>
            </div>
            <div class="table-container">
                <h2 class="chart-title">Service Summary</h2>
                <table id="last90Table"></table>
            </div>
        </div>
        
        <!-- Year to Date Tab -->
        <div id="ytd" class="tab-content">
            <div class="stats-grid" id="ytdStats"></div>
            <div class="chart-container">
                <h2 class="chart-title">Monthly Cost Trend</h2>
                <canvas id="ytdBarChart"></canvas>
            </div>
            <div class="table-container">
                <h2 class="chart-title">Monthly Breakdown</h2>
                <table id="ytdTable"></table>
            </div>
        </div>
        
        <!-- Comparison Tab -->
        <div id="comparison" class="tab-content">
            <div class="comparison-grid" id="comparisonGrid"></div>
            <div class="charts-row">
                <div class="chart-container">
                    <h2 class="chart-title">Month-over-Month Comparison</h2>
                    <canvas id="comparisonChart"></canvas>
                </div>
                <div class="chart-container">
                    <h2 class="chart-title">Service Cost Changes</h2>
                    <canvas id="changeChart"></canvas>
                </div>
            </div>
        </div>
        
        <!-- Forecast Tab -->
        <div id="forecast" class="tab-content">
            <div class="stats-grid" id="forecastStats"></div>
            <div class="chart-container">
                <h2 class="chart-title">Cost Projection</h2>
                <canvas id="forecastChart"></canvas>
            </div>
            <div id="forecastDetails"></div>
        </div>
        
        <!-- Tagged Resources Tab -->
        <div id="tagged" class="tab-content">
            <div id="taggedContent"></div>
        </div>
    </div>
    
    <div class="footer">
        <p>AWS Cost Analysis Dashboard - Updated automatically</p>
        <p>Data refreshes when you regenerate the dashboard</p>
    </div>
    
    <script>
        // Decode base64 and parse JSON
        const base64Data = "PLACEHOLDER_FOR_DATA";
        const jsonString = atob(base64Data);
        const allData = JSON.parse(jsonString);
        
        // Global chart instances
        let charts = {};
        
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('generatedTime').textContent = allData.generatedAt;
            renderOverview();
        });
        
        // Tab switching
        function switchTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Remove active class from all nav tabs
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName).classList.add('active');
            
            // Add active class to clicked nav tab
            event.target.classList.add('active');
            
            // Render tab content
            switch(tabName) {
                case 'overview':
                    renderOverview();
                    break;
                case 'previousMonth':
                    renderPreviousMonth();
                    break;
                case 'currentMonth':
                    renderCurrentMonth();
                    break;
                case 'last30':
                    renderLast30Days();
                    break;
                case 'last90':
                    renderLast90Days();
                    break;
                case 'ytd':
                    renderYearToDate();
                    break;
                case 'comparison':
                    renderComparison();
                    break;
                case 'forecast':
                    renderForecast();
                    break;
                case 'tagged':
                    renderTagged();
                    break;
            }
        }
        
        // Helper function to process cost data
        function processCostData(data) {
            if (!data || !data.ResultsByTime) return { services: {}, total: 0, daily: [] };
            
            const services = {};
            let total = 0;
            const daily = [];
            
            data.ResultsByTime.forEach(period => {
                let periodTotal = 0;
                if (period.Groups) {
                    period.Groups.forEach(group => {
                        const service = group.Keys[0];
                        const cost = parseFloat(group.Metrics.BlendedCost.Amount);
                        services[service] = (services[service] || 0) + cost;
                        total += cost;
                        periodTotal += cost;
                    });
                }
                daily.push({
                    date: period.TimePeriod.Start,
                    cost: periodTotal
                });
            });
            
            return { services, total, daily };
        }
        
        // Render Overview
        function renderOverview() {
            const prevMonth = processCostData(allData.previousMonth);
            const currMonth = processCostData(allData.currentMonth);
            const last30 = processCostData(allData.last30Days);
            const ytd = processCostData(allData.yearToDate);
            
            // Stats cards
            const statsHtml = `
                <div class="stat-card primary">
                    <div class="stat-label">Current Month (MTD)</div>
                    <div class="stat-value">`$`${currMonth.total.toFixed(2)}</div>
                    <div class="stat-change">Daily avg: `$`${(currMonth.total / currMonth.daily.length).toFixed(2)}</div>
                </div>
                <div class="stat-card success">
                    <div class="stat-label">Previous Month</div>
                    <div class="stat-value">`$`${prevMonth.total.toFixed(2)}</div>
                    <div class="stat-change">${getChangeIndicator(prevMonth.total, currMonth.total)}</div>
                </div>
                <div class="stat-card warning">
                    <div class="stat-label">Last 30 Days</div>
                    <div class="stat-value">`$`${last30.total.toFixed(2)}</div>
                    <div class="stat-change">Daily avg: `$`${(last30.total / 30).toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Year to Date</div>
                    <div class="stat-value">`$`${ytd.total.toFixed(2)}</div>
                    <div class="stat-change">Monthly avg: `$`${(ytd.total / new Date().getMonth() + 1).toFixed(2)}</div>
                </div>
            `;
            document.getElementById('overviewStats').innerHTML = statsHtml;
            
            // Trend chart
            const last90 = processCostData(allData.last90Days);
            renderLineChart('trendChart', last90.daily, 'Daily Costs');
            
            // Pie chart for current month
            renderPieChart('overviewPieChart', currMonth.services);
        }
        
        // Render Previous Month
        function renderPreviousMonth() {
            const data = processCostData(allData.previousMonth);
            
            // Stats
            const statsHtml = `
                <div class="stat-card primary">
                    <div class="stat-label">Total Cost</div>
                    <div class="stat-value">`$`${data.total.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Services Used</div>
                    <div class="stat-value">${Object.keys(data.services).length}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Highest Service</div>
                    <div class="stat-value">${getTopService(data.services)}</div>
                </div>
            `;
            document.getElementById('prevMonthStats').innerHTML = statsHtml;
            
            // Charts
            renderPieChart('prevMonthPieChart', data.services);
            renderBarChart('prevMonthBarChart', data.services);
            
            // Table
            renderTable('prevMonthTable', data.services, data.total);
        }
        
        // Render Current Month
        function renderCurrentMonth() {
            const data = processCostData(allData.currentMonth);
            
            // Stats
            const daysInMonth = new Date().getDate();
            const projection = (data.total / daysInMonth) * 30;
            
            const statsHtml = `
                <div class="stat-card primary">
                    <div class="stat-label">Month to Date</div>
                    <div class="stat-value">`$`${data.total.toFixed(2)}</div>
                </div>
                <div class="stat-card warning">
                    <div class="stat-label">Projected Total</div>
                    <div class="stat-value">`$`${projection.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Daily Average</div>
                    <div class="stat-value">`$`${(data.total / daysInMonth).toFixed(2)}</div>
                </div>
            `;
            document.getElementById('currMonthStats').innerHTML = statsHtml;
            
            // Charts
            renderLineChart('currMonthLineChart', data.daily, 'Daily Costs');
            renderPieChart('currMonthPieChart', data.services);
            
            // Table
            renderTable('currMonthTable', data.services, data.total);
        }
        
        // Render Last 30 Days
        function renderLast30Days() {
            const data = processCostData(allData.last30Days);
            
            // Stats
            const statsHtml = `
                <div class="stat-card primary">
                    <div class="stat-label">Total (30 Days)</div>
                    <div class="stat-value">`$`${data.total.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Daily Average</div>
                    <div class="stat-value">`$`${(data.total / 30).toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Peak Day</div>
                    <div class="stat-value">`$`${Math.max(...data.daily.map(d => d.cost)).toFixed(2)}</div>
                </div>
            `;
            document.getElementById('last30Stats').innerHTML = statsHtml;
            
            // Chart
            renderLineChart('last30LineChart', data.daily, 'Daily Costs');
            
            // Table
            renderTable('last30Table', data.services, data.total);
        }
        
        // Render Last 90 Days
        function renderLast90Days() {
            const data = processCostData(allData.last90Days);
            
            // Stats
            const statsHtml = `
                <div class="stat-card primary">
                    <div class="stat-label">Total (90 Days)</div>
                    <div class="stat-value">`$`${data.total.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Daily Average</div>
                    <div class="stat-value">`$`${(data.total / 90).toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Monthly Average</div>
                    <div class="stat-value">`$`${(data.total / 3).toFixed(2)}</div>
                </div>
            `;
            document.getElementById('last90Stats').innerHTML = statsHtml;
            
            // Chart
            renderLineChart('last90LineChart', data.daily, 'Daily Costs');
            
            // Table
            renderTable('last90Table', data.services, data.total);
        }
        
        // Render Year to Date
        function renderYearToDate() {
            const data = processCostData(allData.yearToDate);
            
            // Stats
            const monthsElapsed = new Date().getMonth() + 1;
            const statsHtml = `
                <div class="stat-card primary">
                    <div class="stat-label">Year to Date</div>
                    <div class="stat-value">`$`${data.total.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Monthly Average</div>
                    <div class="stat-value">`$`${(data.total / monthsElapsed).toFixed(2)}</div>
                </div>
                <div class="stat-card warning">
                    <div class="stat-label">Projected Annual</div>
                    <div class="stat-value">`$`${((data.total / monthsElapsed) * 12).toFixed(2)}</div>
                </div>
            `;
            document.getElementById('ytdStats').innerHTML = statsHtml;
            
            // Monthly bar chart
            const monthlyData = {};
            if (allData.yearToDate.ResultsByTime) {
                allData.yearToDate.ResultsByTime.forEach(period => {
                    const month = new Date(period.TimePeriod.Start).toLocaleString('default', { month: 'short' });
                    let total = 0;
                    if (period.Groups) {
                        period.Groups.forEach(group => {
                            total += parseFloat(group.Metrics.BlendedCost.Amount);
                        });
                    }
                    monthlyData[month] = total;
                });
            }
            renderBarChart('ytdBarChart', monthlyData);
            
            // Table
            renderTable('ytdTable', data.services, data.total);
        }
        
        // Render Comparison
        function renderComparison() {
            const prevMonth = processCostData(allData.previousMonth);
            const currMonth = processCostData(allData.currentMonth);
            const lastYear = processCostData(allData.lastYear);
            const ytd = processCostData(allData.yearToDate);
            
            // Comparison cards
            const comparisonHtml = `
                <div class="comparison-card">
                    <h3>Month-over-Month</h3>
                    <div class="comparison-item">
                        <span>Previous Month</span>
                        <span class="amount">`$`${prevMonth.total.toFixed(2)}</span>
                    </div>
                    <div class="comparison-item">
                        <span>Current Month (MTD)</span>
                        <span class="amount">`$`${currMonth.total.toFixed(2)}</span>
                    </div>
                    <div class="comparison-item">
                        <span>Change</span>
                        <span class="amount">${getChangeIndicator(prevMonth.total, currMonth.total)}</span>
                    </div>
                </div>
                <div class="comparison-card">
                    <h3>Year-over-Year</h3>
                    <div class="comparison-item">
                        <span>Last Year Total</span>
                        <span class="amount">`$`${lastYear.total.toFixed(2)}</span>
                    </div>
                    <div class="comparison-item">
                        <span>This Year (YTD)</span>
                        <span class="amount">`$`${ytd.total.toFixed(2)}</span>
                    </div>
                    <div class="comparison-item">
                        <span>Projected This Year</span>
                        <span class="amount">`$`${((ytd.total / (new Date().getMonth() + 1)) * 12).toFixed(2)}</span>
                    </div>
                </div>
            `;
            document.getElementById('comparisonGrid').innerHTML = comparisonHtml;
            
            // Comparison chart
            renderComparisonChart('comparisonChart', prevMonth.services, currMonth.services);
            
            // Change chart
            renderChangeChart('changeChart', prevMonth.services, currMonth.services);
        }
        
        // Render Forecast
        function renderForecast() {
            if (allData.forecast && allData.forecast.Total) {
                const forecastAmount = parseFloat(allData.forecast.Total.Amount);
                const currMonth = processCostData(allData.currentMonth);
                
                const statsHtml = `
                    <div class="stat-card primary">
                        <div class="stat-label">Next Month Forecast</div>
                        <div class="stat-value">`$`${forecastAmount.toFixed(2)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Current Month (MTD)</div>
                        <div class="stat-value">`$`${currMonth.total.toFixed(2)}</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-label">Expected Change</div>
                        <div class="stat-value">${getChangeIndicator(currMonth.total, forecastAmount)}</div>
                    </div>
                `;
                document.getElementById('forecastStats').innerHTML = statsHtml;
                
                // Details
                const detailsHtml = `
                    <div class="info-message">
                        <h3>Forecast Details</h3>
                        <p>Based on your historical usage patterns, AWS predicts your costs for next month.</p>
                        <p>This forecast considers seasonal trends, growth patterns, and recent usage.</p>
                    </div>
                `;
                document.getElementById('forecastDetails').innerHTML = detailsHtml;
            } else {
                document.getElementById('forecastStats').innerHTML = `
                    <div class="error-message">
                        Forecast data is not available. You need at least 3 months of historical data for AWS to generate forecasts.
                    </div>
                `;
            }
        }
        
        // Render Tagged Resources
        function renderTagged() {
            if (allData.taggedResources && allData.taggedResources.ResultsByTime) {
                const data = processCostData(allData.taggedResources);
                
                let html = `
                    <div class="stats-grid">
                        <div class="stat-card primary">
                            <div class="stat-label">Tagged Resources Total</div>
                            <div class="stat-value">`$`${data.total.toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="table-container">
                        <h2 class="chart-title">WenXen.com Tagged Services</h2>
                        <table id="taggedTable"></table>
                    </div>
                `;
                document.getElementById('taggedContent').innerHTML = html;
                renderTable('taggedTable', data.services, data.total);
            } else {
                document.getElementById('taggedContent').innerHTML = `
                    <div class="info-message">
                        <h3>Tagged Resources Not Available</h3>
                        <p>Tagged resource data is not available yet. This could be because:</p>
                        <ul style="margin-top: 10px; margin-left: 20px;">
                            <li>Tags were applied less than 24 hours ago (AWS needs time to process)</li>
                            <li>No resources are tagged with Project=wenxen-com</li>
                            <li>There were no costs for tagged resources in the selected period</li>
                        </ul>
                        <p style="margin-top: 10px;">Please check back in 24-48 hours after tagging your resources.</p>
                    </div>
                `;
            }
        }
        
        // Chart rendering functions
        function renderPieChart(canvasId, services) {
            if (charts[canvasId]) {
                charts[canvasId].destroy();
            }
            
            const sortedServices = Object.entries(services)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            
            const ctx = document.getElementById(canvasId).getContext('2d');
            charts[canvasId] = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: sortedServices.map(s => s[0]),
                    datasets: [{
                        data: sortedServices.map(s => s[1]),
                        backgroundColor: [
                            '#667eea', '#764ba2', '#f093fb', '#f5576c',
                            '#4facfe', '#43e97b', '#fa709a', '#30cfd0',
                            '#ffd93d', '#6bcf7f'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 10,
                                font: { size: 11 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.parsed;
                                    return context.label + ': `$' + value.toFixed(2);
                                }
                            }
                        }
                    }
                }
            });
        }
        
        function renderBarChart(canvasId, services) {
            if (charts[canvasId]) {
                charts[canvasId].destroy();
            }
            
            const sortedServices = Object.entries(services)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            
            const ctx = document.getElementById(canvasId).getContext('2d');
            charts[canvasId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: sortedServices.map(s => s[0]),
                    datasets: [{
                        label: 'Cost (USD)',
                        data: sortedServices.map(s => s[1]),
                        backgroundColor: 'rgba(102, 126, 234, 0.8)',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '`$' + value.toFixed(2);
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return 'Cost: `$' + context.parsed.y.toFixed(2);
                                }
                            }
                        }
                    }
                }
            });
        }
        
        function renderLineChart(canvasId, dailyData, label) {
            if (charts[canvasId]) {
                charts[canvasId].destroy();
            }
            
            const ctx = document.getElementById(canvasId).getContext('2d');
            charts[canvasId] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dailyData.map(d => d.date),
                    datasets: [{
                        label: label,
                        data: dailyData.map(d => d.cost),
                        borderColor: 'rgba(102, 126, 234, 1)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '`$' + value.toFixed(2);
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return 'Cost: `$' + context.parsed.y.toFixed(2);
                                }
                            }
                        }
                    }
                }
            });
        }
        
        function renderComparisonChart(canvasId, prevServices, currServices) {
            if (charts[canvasId]) {
                charts[canvasId].destroy();
            }
            
            const allServices = new Set([...Object.keys(prevServices), ...Object.keys(currServices)]);
            const labels = Array.from(allServices).sort();
            
            const ctx = document.getElementById(canvasId).getContext('2d');
            charts[canvasId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Previous Month',
                        data: labels.map(s => prevServices[s] || 0),
                        backgroundColor: 'rgba(102, 126, 234, 0.6)'
                    }, {
                        label: 'Current Month',
                        data: labels.map(s => currServices[s] || 0),
                        backgroundColor: 'rgba(118, 75, 162, 0.6)'
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '`$' + value.toFixed(2);
                                }
                            }
                        }
                    }
                }
            });
        }
        
        function renderChangeChart(canvasId, prevServices, currServices) {
            if (charts[canvasId]) {
                charts[canvasId].destroy();
            }
            
            const changes = {};
            const allServices = new Set([...Object.keys(prevServices), ...Object.keys(currServices)]);
            
            allServices.forEach(service => {
                const prev = prevServices[service] || 0;
                const curr = currServices[service] || 0;
                changes[service] = curr - prev;
            });
            
            const sortedChanges = Object.entries(changes)
                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                .slice(0, 10);
            
            const ctx = document.getElementById(canvasId).getContext('2d');
            charts[canvasId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: sortedChanges.map(s => s[0]),
                    datasets: [{
                        label: 'Change (`$)',
                        data: sortedChanges.map(s => s[1]),
                        backgroundColor: sortedChanges.map(s => s[1] >= 0 ? 'rgba(255, 107, 107, 0.6)' : 'rgba(81, 207, 102, 0.6)')
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return '`$' + value.toFixed(2);
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
        
        function renderTable(tableId, services, total) {
            const sortedServices = Object.entries(services)
                .sort((a, b) => b[1] - a[1]);
            
            let html = `
                <thead>
                    <tr>
                        <th>Service</th>
                        <th>Amount (USD)</th>
                        <th>Percentage</th>
                        <th>Visual</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            sortedServices.forEach(([service, cost]) => {
                if (cost > 0.001) {
                    const percentage = (cost / total * 100).toFixed(1);
                    html += `
                        <tr>
                            <td>${service}</td>
                            <td class="amount">`$`${cost.toFixed(4)}</td>
                            <td>${percentage}%</td>
                            <td>
                                <div class="percentage-bar">
                                    <div class="percentage-fill" style="width: ${percentage}%">
                                        <span class="percentage-text">${percentage}%</span>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
                }
            });
            
            html += `
                <tr style="font-weight: bold; background: #f8f8f8;">
                    <td>TOTAL</td>
                    <td class="amount">`$`${total.toFixed(2)}</td>
                    <td>100%</td>
                    <td></td>
                </tr>
            </tbody>
            `;
            
            document.getElementById(tableId).innerHTML = html;
        }
        
        // Helper functions
        function getChangeIndicator(oldValue, newValue) {
            const change = newValue - oldValue;
            const changePercent = (change / oldValue * 100).toFixed(1);
            const arrow = change >= 0 ? '↑' : '↓';
            const colorClass = change >= 0 ? 'trend-up' : 'trend-down';
            return `<span class="${colorClass}">${arrow} `$`${Math.abs(change).toFixed(2)} (${changePercent}%)</span>`;
        }
        
        function getTopService(services) {
            if (Object.keys(services).length === 0) return 'N/A';
            const sorted = Object.entries(services).sort((a, b) => b[1] - a[1]);
            return sorted[0][0];
        }
    </script>
</body>
</html>
'@

# Insert the base64 encoded JSON data
$htmlContent = $htmlPart1.Replace('PLACEHOLDER_FOR_DATA', $jsonDataBase64)

# Save HTML file
$outputFile = "AWS-Cost-Dashboard-$(Get-Date -Format 'yyyyMMdd-HHmmss').html"
$htmlContent | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] Dashboard generated successfully!" -ForegroundColor Green
Write-Host "File: $outputFile" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Cyan

# Open in browser
if ($OpenBrowser) {
    Write-Host "[BROWSER] Opening dashboard in default browser..." -ForegroundColor Green
    Start-Process $outputFile
}

Write-Host ""
Write-Host "Dashboard includes:" -ForegroundColor Cyan
Write-Host "  • Overview with key metrics and trends" -ForegroundColor White
Write-Host "  • Previous Month detailed analysis" -ForegroundColor White
Write-Host "  • Current Month with projections" -ForegroundColor White
Write-Host "  • Last 30/90 days trends" -ForegroundColor White
Write-Host "  • Year-to-date analysis" -ForegroundColor White
Write-Host "  • Month-over-month comparisons" -ForegroundColor White
Write-Host "  • Cost forecasts (if available)" -ForegroundColor White
Write-Host "  • Tagged resources breakdown (if available)" -ForegroundColor White
Write-Host ""