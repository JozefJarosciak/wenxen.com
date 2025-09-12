// Inline expandable breakdown for XEN total
function initializeXenTotalBreakdown() {
  const compactDiv = document.getElementById("xenTotalCompact");
  const expandedDiv = document.getElementById("xenTotalExpanded");
  
  if (!compactDiv || !expandedDiv) return;
  
  // Load saved state from localStorage
  let isExpanded = localStorage.getItem('xenBreakdownExpanded') === 'true';
  
  // Format address with ellipsis
  function formatAddress(address) {
    if (address === 'Unknown' || address === 'unknown') return 'Unknown';
    if (address.length <= 10) return address;
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  // Calculate totals from breakdown data
  function calculateTotals() {
    const badge = document.getElementById("estXenTotal");
    if (!badge || !badge.dataset.breakdown) {
      return { totalXen: 0, totalUsd: 0, totalXenFormatted: '0', totalUsdFormatted: '-' };
    }
    
    try {
      const breakdown = JSON.parse(badge.dataset.breakdown);
      if (!breakdown || breakdown.length === 0) {
        return { totalXen: 0, totalUsd: 0, totalXenFormatted: '0', totalUsdFormatted: '-' };
      }
      
      let totalXen = 0n;
      let totalUsd = 0;
      
      breakdown.forEach(item => {
        const xenAmount = BigInt(item.xen);
        totalXen += xenAmount;
        const xenTokens = Number(xenAmount);
        const usdValue = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0) 
          ? xenTokens * xenUsdPrice 
          : 0;
        totalUsd += usdValue;
      });
      
      // Format totals with T/B/M/K notation
      const totalXenNum = Number(totalXen);
      let totalXenFormatted;
      if (totalXenNum >= 1000000000000) {
        totalXenFormatted = (totalXenNum / 1000000000000).toFixed(2) + 'T';
      } else if (totalXenNum >= 1000000000) {
        totalXenFormatted = (totalXenNum / 1000000000).toFixed(2) + 'B';
      } else if (totalXenNum >= 1000000) {
        totalXenFormatted = (totalXenNum / 1000000).toFixed(2) + 'M';
      } else if (totalXenNum >= 1000) {
        totalXenFormatted = (totalXenNum / 1000).toFixed(2) + 'K';
      } else {
        totalXenFormatted = totalXenNum.toFixed(2);
      }
      
      const totalUsdFormatted = totalUsd > 0 
        ? totalUsd.toLocaleString(undefined, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        : '-';
      
      return { totalXen: totalXenNum, totalUsd, totalXenFormatted, totalUsdFormatted };
    } catch (e) {
      console.error('Error calculating totals:', e);
      return { totalXen: 0, totalUsd: 0, totalXenFormatted: '0', totalUsdFormatted: '-' };
    }
  }
  
  // Build collapsed view (larger fonts for both desktop and mobile)
  function buildCollapsedView() {
    const totals = calculateTotals();
    
    // Check if desktop (screen width > 768px)
    const isDesktop = window.innerWidth > 768;
    const fontSize = isDesktop ? '16px' : '15px';  // Mobile: 12px -> 15px (25% larger)
    const buttonSize = isDesktop ? '15px' : '14px';  // Mobile: 12px -> 15px (25% larger)
    const padding = isDesktop ? '4px 8px' : '3px 7px';
    const buttonPadding = isDesktop ? '3px 8px' : '3px 7px';
    
    return `
      <table style="width: auto; border-collapse: collapse; font-size: ${fontSize};">
        <tr>
          <td style="padding: ${padding}; font-weight: bold;">Total</td>
          <td style="padding: ${padding}; text-align: right; font-weight: bold;">${totals.totalXenFormatted}</td>
          <td style="padding: ${padding}; text-align: right; font-weight: bold;" class="usd-value">${totals.totalUsdFormatted}</td>
          <td style="padding: 2px 4px; text-align: right; white-space: nowrap;">
            <button id="refreshXenBtn" class="refresh-btn" title="Refresh XEN price & cRank" style="padding: ${buttonPadding}; font-size: ${buttonSize};">⟳</button>
            <button id="toggleXenBreakdown" class="toggle-btn" title="Show breakdown by address" style="padding: ${buttonPadding}; font-size: ${buttonSize};">+</button>
          </td>
        </tr>
      </table>
    `;
  }
  
  // Build expanded view (full breakdown table)
  function buildExpandedView() {
    const badge = document.getElementById("estXenTotal");
    if (!badge || !badge.dataset.breakdown) {
      return '<p style="padding: 10px;">No data available</p>';
    }
    
    try {
      const breakdown = JSON.parse(badge.dataset.breakdown);
      if (!breakdown || breakdown.length === 0) {
        return '<p style="padding: 10px;">No data available</p>';
      }
      
      // Sort by XEN amount descending
      breakdown.sort((a, b) => {
        const xenA = BigInt(a.xen);
        const xenB = BigInt(b.xen);
        return xenB > xenA ? 1 : xenB < xenA ? -1 : 0;
      });
      
      // Build table (auto width)
      let html = '<table style="border-collapse: collapse; font-size: 12px;">';
      html += '<thead><tr>';
      html += '<th style="text-align: left; padding: 2px 6px; border-bottom: 1px solid rgba(128,128,128,0.3);">Address</th>';
      html += '<th style="text-align: right; padding: 2px 6px; border-bottom: 1px solid rgba(128,128,128,0.3);">XEN</th>';
      html += '<th style="text-align: right; padding: 2px 6px; border-bottom: 1px solid rgba(128,128,128,0.3);">Value</th>';
      html += '<th style="width: 50px;"></th>'; // Space for buttons
      html += '</tr></thead><tbody>';
      
      let totalXen = 0n;
      let totalUsd = 0;
      
      breakdown.forEach(item => {
        const xenAmount = BigInt(item.xen);
        totalXen += xenAmount;
        
        // Format XEN amount with thousand separators (no decimals)
        const xenTokens = Number(xenAmount);
        const xenFormatted = xenTokens.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        });
        
        // Calculate USD value
        const usdValue = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0) 
          ? xenTokens * xenUsdPrice 
          : 0;
        totalUsd += usdValue;
        
        // Format USD
        const usdFormatted = usdValue > 0 
          ? usdValue.toLocaleString(undefined, {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })
          : '-';
        
        html += '<tr>';
        html += `<td style="padding: 2px 6px; opacity: 0.8;">${formatAddress(item.address)}</td>`;
        html += `<td style="padding: 2px 6px; text-align: right;">${xenFormatted}</td>`;
        html += `<td style="padding: 2px 6px; text-align: right;" class="usd-value">${usdFormatted}</td>`;
        html += '<td></td>';
        html += '</tr>';
      });
      
      // Total row - use full formatting with thousand separators (no decimals)
      const totalXenNum = Number(totalXen);
      const totalXenFormatted = totalXenNum.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
      
      const totalUsdFormatted = totalUsd > 0 
        ? totalUsd.toLocaleString(undefined, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        : '-';
      
      html += '<tr style="border-top: 1px solid rgba(128,128,128,0.3);">';
      html += '<td style="padding: 2px 6px; font-weight: bold;">Total</td>';
      html += `<td style="padding: 2px 6px; text-align: right; font-weight: bold;">${totalXenFormatted}</td>`;
      html += `<td style="padding: 2px 6px; text-align: right; font-weight: bold;" class="usd-value">${totalUsdFormatted}</td>`;
      html += '<td style="padding: 2px 4px; text-align: right;">';
      html += '<button id="refreshXenBtn2" class="refresh-btn" title="Refresh XEN price & cRank" style="padding: 2px 6px; font-size: 12px;">⟳</button>';
      html += '<button id="toggleXenBreakdown2" class="toggle-btn active" title="Hide breakdown" style="padding: 2px 6px; font-size: 12px;">−</button>';
      html += '</td>';
      html += '</tr>';
      
      html += '</tbody></table>';
      
      return html;
      
    } catch (e) {
      console.error('Error building breakdown:', e);
      return '<p style="padding: 10px;">Error loading breakdown</p>';
    }
  }
  
  // Show collapsed view
  function showCollapsed() {
    const html = buildCollapsedView();
    compactDiv.innerHTML = html;
    compactDiv.style.display = 'block';
    expandedDiv.style.display = 'none';
    isExpanded = false;
    localStorage.setItem('xenBreakdownExpanded', 'false');
    
    // Wire up buttons
    const toggleBtn = document.getElementById('toggleXenBreakdown');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', showExpanded);
    }
    
    const refreshBtn = document.getElementById('refreshXenBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        refreshBtn.disabled = true;
        refreshBtn.classList.add('refreshing');
        
        try {
          // Refresh both XEN price and crank data
          await Promise.all([
            Promise.all([
              typeof fetchXenUsdPrice === 'function' ? fetchXenUsdPrice() : Promise.resolve(),
              typeof fetchXenGlobalRank === 'function' ? fetchXenGlobalRank() : Promise.resolve()
            ]),
            new Promise(resolve => setTimeout(resolve, 1000))
          ]);
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.classList.remove('refreshing');
        }
      });
    }
  }
  
  // Show expanded view
  function showExpanded() {
    const html = buildExpandedView();
    expandedDiv.innerHTML = html;
    expandedDiv.style.display = 'block';
    compactDiv.style.display = 'none';
    isExpanded = true;
    localStorage.setItem('xenBreakdownExpanded', 'true');
    
    // Wire up buttons in expanded view
    const toggleBtn2 = document.getElementById('toggleXenBreakdown2');
    if (toggleBtn2) {
      toggleBtn2.addEventListener('click', showCollapsed);
    }
    
    const refreshBtn2 = document.getElementById('refreshXenBtn2');
    if (refreshBtn2) {
      refreshBtn2.addEventListener('click', async (e) => {
        e.preventDefault();
        const refreshBtn = document.getElementById('refreshXenBtn');
        if (refreshBtn) refreshBtn.click();
      });
    }
  }
  
  // Refresh current view
  function refreshView() {
    if (isExpanded) {
      showExpanded();
    } else {
      showCollapsed();
    }
  }
  
  // Register global refresh
  window._xenTooltipRefresh = refreshView;
  
  // Initialize with saved state
  if (isExpanded) {
    showExpanded();
  } else {
    showCollapsed();
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeXenTotalBreakdown);
} else {
  setTimeout(initializeXenTotalBreakdown, 100); // Small delay to ensure data is ready
}