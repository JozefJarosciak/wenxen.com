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
        // ONLY count maturing mints, NOT wallet balances
        const xenAmount = BigInt(item.xen);
        totalXen += xenAmount;
        const usdValue = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0)
          ? Number(xenAmount) * xenUsdPrice
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
    const tableClass = `xen-breakdown-table xen-breakdown-table--compact${isDesktop ? ' is-desktop' : ''}`;
    
    return `
      <table class="${tableClass}">
        <tr>
          <td class="xen-breakdown-cell">Total</td>
          <td class="xen-breakdown-cell xen-breakdown-align-right">${totals.totalXenFormatted}</td>
          <td class="xen-breakdown-cell xen-breakdown-align-right usd-value">${totals.totalUsdFormatted}</td>
          <td class="xen-breakdown-actions">
            <button id="refreshXenBtn" class="refresh-btn xen-breakdown-button" title="Refresh XEN price & balances">⟳</button>
            <button id="toggleXenBreakdown" class="toggle-btn xen-breakdown-button" title="Show breakdown by address">+</button>
          </td>
        </tr>
      </table>
    `;
  }
  
  // Build expanded view (full breakdown table)
  function buildExpandedView() {
    const badge = document.getElementById("estXenTotal");
    if (!badge || !badge.dataset.breakdown) {
      return '<p class="xen-breakdown-placeholder">No data available</p>';
    }
    
    try {
      const breakdown = JSON.parse(badge.dataset.breakdown);
      if (!breakdown || breakdown.length === 0) {
        return '<p class="xen-breakdown-placeholder">No data available</p>';
      }
      
      // Sort by XEN amount descending (maturing mints only)
      breakdown.sort((a, b) => {
        const xenA = BigInt(a.xen);
        const xenB = BigInt(b.xen);
        return xenB > xenA ? 1 : xenB < xenA ? -1 : 0;
      });
      
      // Build table (auto width)
      let html = '<table class="xen-breakdown-table xen-breakdown-table--expanded">';
      html += '<thead><tr>';
      html += '<th class="xen-breakdown-align-left">Address</th>';
      html += '<th class="xen-breakdown-align-right">Total</th>';
      html += '<th class="xen-breakdown-align-right">Value</th>';
      html += '<th class="xen-breakdown-actions"></th>'; // Space for buttons
      html += '</tr></thead><tbody>';
      
      let totalXen = 0n;
      let totalUsd = 0;
      
      breakdown.forEach(item => {
        // ONLY count maturing mints, NOT wallet balances
        const xenAmount = BigInt(item.xen);
        totalXen += xenAmount;

        // Format amounts with thousand separators (no decimals)
        const xenTokens = Number(xenAmount);

        const xenFormatted = xenTokens > 0 ? xenTokens.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }) : '-';

        // Calculate USD value based on maturing mints only
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
        html += `<td class="xen-breakdown-muted">${formatAddress(item.address)}</td>`;
        html += `<td class="xen-breakdown-align-right xen-breakdown-bold">${xenFormatted}</td>`;
        html += `<td class="xen-breakdown-align-right usd-value">${usdFormatted}</td>`;
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
      
      html += '<tr class="xen-breakdown-total-row">';
      html += '<td class="xen-breakdown-bold">Total</td>';
      html += `<td class="xen-breakdown-align-right xen-breakdown-bold">${totalXenFormatted}</td>`; // Total column
      html += `<td class="xen-breakdown-align-right xen-breakdown-bold usd-value">${totalUsdFormatted}</td>`;
      html += '<td class="xen-breakdown-actions">';
      html += '<button id="refreshXenBtn2" class="refresh-btn xen-breakdown-button" title="Refresh XEN price & balances">⟳</button>';
      html += '<button id="toggleXenBreakdown2" class="toggle-btn active xen-breakdown-button" title="Hide breakdown">−</button>';
      html += '</td>';
      html += '</tr>';
      
      html += '</tbody></table>';
      
      return html;
      
    } catch (e) {
      console.error('Error building breakdown:', e);
      return '<p class="xen-breakdown-placeholder">Error loading breakdown</p>';
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
          // Refresh XEN price, crank data, and wallet balances
          await Promise.all([
            Promise.all([
              typeof fetchXenUsdPrice === 'function' ? fetchXenUsdPrice() : Promise.resolve(),
              typeof fetchXenGlobalRank === 'function' ? fetchXenGlobalRank() : Promise.resolve(),
              typeof updateXENTotalBadge === 'function' ? updateXENTotalBadge(true) : Promise.resolve()
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

  // DO NOT auto-initialize - wait for data to be ready
  // This prevents showing empty/wrong data during page load
}

// Export initialization function for manual triggering
window._initializeXenTotalBreakdown = () => {
  const compactDiv = document.getElementById("xenTotalCompact");
  const expandedDiv = document.getElementById("xenTotalExpanded");

  if (!compactDiv || !expandedDiv) return;

  // Check if already initialized
  if (window._xenBreakdownInitialized) return;
  window._xenBreakdownInitialized = true;

  console.log('[XEN Breakdown] Initializing breakdown display');

  // Initialize the breakdown manager
  initializeXenTotalBreakdown();

  // Show initial view based on saved state
  const isExpanded = localStorage.getItem('xenBreakdownExpanded') === 'true';
  if (isExpanded && typeof window._xenTooltipRefresh === 'function') {
    // Show expanded view
    const refreshView = window._xenTooltipRefresh;
    refreshView();
  } else if (typeof window._xenTooltipRefresh === 'function') {
    // Show collapsed view
    const refreshView = window._xenTooltipRefresh;
    refreshView();
  }
};
