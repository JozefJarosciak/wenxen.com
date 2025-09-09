try {
    $json = Get-Content 'costs_output.json' | ConvertFrom-Json
    $total = 0
    $hasData = $false
    
    foreach($period in $json.ResultsByTime) {
        if($period.Groups -and $period.Groups.Count -gt 0) {
            foreach($group in $period.Groups) {
                $service = $group.Keys[0]
                $cost = [double]$group.Metrics.BlendedCost.Amount
                $total += $cost
                $hasData = $true
                if($cost -gt 0.001) {
                    Write-Host ("  COST {0,-30} `${1:F2}" -f $service, $cost)
                }
            }
        }
    }
    
    if($hasData) {
        Write-Host ""
        Write-Host ("  [TOTAL] TOTAL COST: `${0:F2}" -f $total)
    } else {
        Write-Host "  [WARN] No cost data available for this period"
        Write-Host "  [INFO] This might be due to recent tagging (data takes 24hrs)"
    }
} catch {
    Write-Host "  [ERROR] Error parsing cost data: $_"
}