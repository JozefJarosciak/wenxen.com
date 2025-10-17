// UI Management Module - handles UI updates, progress indicators, and chain-specific labeling
// Extracted from main_app.js for modular architecture

// ===== Chain-Specific UI Updates =====

// Update UI labels based on current chain
function updateChainSpecificLabels() {
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  const chainName = currentChain === 'BASE' ? 'Base' : 'Ethereum';
  const explorerName = currentChain === 'BASE' ? 'BaseScan' : 'Etherscan';

  if (!window.__rpcLastValuesByChain) {
    window.__rpcLastValuesByChain = {};
  }
  if (!window.__setRpcLastValueForChain) {
    window.__setRpcLastValueForChain = (chain, value) => {
      if (!chain) return;
      window.__rpcLastValuesByChain[chain] = value;
    };
  }

  // Update Settings tab labels
  const addressLabel = document.querySelector('#field-ethAddress label[for="ethAddress"]');
  if (addressLabel) addressLabel.textContent = `${chainName} Addresses (one per line)`;

  const addressNote = document.querySelector('.settings-note');
  if (addressNote && addressNote.textContent.includes('address')) {
    addressNote.textContent = `Paste one ${chainName} address per line.`;
  }

  const addressError = document.querySelector('#field-ethAddress .error-message');
  if (addressError) addressError.textContent = `At least one ${chainName} address is required.`;

  const apiKeyLabel = document.querySelector('label[for="etherscanApiKey"]');
  if (apiKeyLabel) apiKeyLabel.textContent = `${explorerName} API Key`;

  const apiKeyInput = document.getElementById('etherscanApiKey');
  if (apiKeyInput) apiKeyInput.placeholder = `Your ${explorerName} API Key`;

  // Update RPC label to be chain-specific
  const rpcLabel = document.querySelector('label[for="customRPC"]');
  if (rpcLabel) rpcLabel.textContent = `Custom ${chainName} RPCs (one per line)`;

  const rpcTextarea = document.getElementById('customRPC');
  if (rpcTextarea && window.chainManager) {
    const actualChain = window.chainManager.getCurrentChain();
    const chainRPCs = window.chainManager.getRPCEndpoints();
    const rpcString = chainRPCs.join('\n');
    rpcTextarea.value = rpcString;
    window.__setRpcLastValueForChain(actualChain, rpcString);
  }

  // Update Mint tab platform selector label if present
  const platformLabel = document.querySelector('label[for="mintPlatform"]');
  if (platformLabel) platformLabel.textContent = `Minting Platform`;

  // Update stake tab labels
  const stakeTitle = document.querySelector('#stakeControls h3');
  if (stakeTitle) stakeTitle.textContent = `Stake XEN`;
}

// ===== Theme Menu UI Management =====

// Keep header theme menu UI in sync with current setting
function updateThemeMenuUI() {
  const cur = window.getStoredTheme?.() || 'dark';
  const txt = (cur === 'light') ? 'Light' : 'Dark';
  const curEl = document.getElementById('themeMenuCurrent');
  if (curEl) curEl.textContent = txt;
  const items = document.querySelectorAll('#headerMenu .menu-item[data-theme]');
  items.forEach(btn => {
    const on = (btn.getAttribute('data-theme') === cur);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

// ===== About Tab Management =====

// About tab loading state
let _aboutLoaded = false;

// Ensure About tab content is loaded
async function ensureAboutLoaded() {
  if (_aboutLoaded) return;
  _aboutLoaded = true;

  // Setup About subtabs
  setupAboutSubtabs();
}

// Setup About subtab navigation
function setupAboutSubtabs() {
  const subtabButtons = document.querySelectorAll('.about-subtab-btn');
  const aboutPanels = document.querySelectorAll('.about-panel');

  // Sync iframe themes on load
  syncIframeThemes();

  subtabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const targetSubtab = e.target.dataset.subtab;

      // Update button states
      subtabButtons.forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');

      // Update panel visibility
      aboutPanels.forEach(panel => panel.classList.remove('active'));

      // Show the selected panel
      const targetPanel = document.getElementById(`about-${targetSubtab}`);
      if (targetPanel) {
        targetPanel.classList.add('active');

        // Sync theme for the iframe
        const iframe = targetPanel.querySelector('iframe');
        if (iframe) {
          syncIframeTheme(iframe);
        }

        // Initialize Mermaid diagrams if showing design tab
        if (targetSubtab === 'design' && iframe && iframe.contentWindow && iframe.contentWindow.mermaid) {
          setTimeout(() => {
            iframe.contentWindow.mermaid.init();
          }, 500);
        }
      }

      // Dispatch subtab changed event for router integration
      document.dispatchEvent(new CustomEvent('subtabChanged', {
        detail: { tabId: 'tab-about', subtabId: targetSubtab }
      }));
    });
  });
}

// Sync iframe themes with parent document
function syncIframeThemes() {
  const iframes = document.querySelectorAll('.about-iframe');
  iframes.forEach(iframe => {
    iframe.addEventListener('load', () => {
      syncIframeTheme(iframe);
    });
  });
}

// Sync individual iframe theme
function syncIframeTheme(iframe) {
  try {
    const currentTheme = document.body.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light';
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'theme-change', theme: currentTheme }, '*');
      // Also try direct access
      if (iframe.contentDocument && iframe.contentDocument.body) {
        iframe.contentDocument.body.className = currentTheme;
      }
    }
  } catch (e) {
    console.debug('Could not sync iframe theme:', e);
  }
}

// ===== Progress UI Management =====

// Helper function for short addresses
function shortAddr(addr) {
  if (!addr) return '';
  if (addr.length <= 10) return addr;
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

// Progress UI controls for scanning operations
const progressUI = {
  shortAddr,

  setType(label) {
    const el = document.getElementById('scanTypeText');
    if (el) el.textContent = label ? `Scanning: ${label}` : '';
  },

  setAddress(i, total, addr, suffix) {
    const el = document.getElementById('addressProgressText');
    if (!el) return;
    const sfx = suffix ? ` — ${suffix}` : '';
    el.textContent = `Scanning address ${i}/${total}: ${shortAddr(addr)}${sfx}`;
  },

  setStage(label, done, total, extra) {
    const bar = document.getElementById('tokenProgressBar');
    const txt = document.getElementById('tokenProgressText');
    if (bar && Number.isFinite(total) && total > 0) {
      bar.max = total;
      bar.value = Math.min(done, total);
    }
    const pct = (Number.isFinite(done) && Number.isFinite(total) && total > 0)
      ? ` (${Math.floor((done/total)*100)}%)` : '';
    if (txt) txt.textContent = `${label} ${Number.isFinite(done)?done:''}${Number.isFinite(total)?`/${total}`:''}${pct}${extra?` — ${extra}`:''}`.trim();
  },

  setEta(sec) {
    const etr = document.getElementById('etrText');
    if (!etr) return;
    etr.textContent = (sec && sec > 2) ? `ETA: ${window.formatSeconds?.(sec) || sec + 's'}` : '';
  },

  show(show = true) {
    const pc = document.getElementById('progressContainer');
    if (!pc) return;
    if (show) {
      pc.classList.add('visible');
      // Ensure inline display can't keep it hidden
      try { pc.style.display = 'block'; } catch {}
    } else {
      pc.classList.remove('visible');
      try { pc.style.display = 'none'; } catch {}
    }
  },

  hide() {
    this.show(false);
  },

  setText(txt) {
    const pt = document.getElementById('progressText');
    if (pt) pt.textContent = txt;
  },

  setPercent(pct) {
    const pb = document.getElementById('progressBar');
    if (pb) pb.style.width = `${Math.max(0, Math.min(100, pct))}%`;

    const pp = document.getElementById('progressPercent');
    if (pp) pp.textContent = `${Math.round(pct)}%`;
  }
};

// ===== Import Status Management =====

// Show import status messages
function showImportStatus(msg, kind = "info") {
  const el = document.getElementById('importStatus');
  if (!el) return;

  el.textContent = msg;
  el.className = `import-status ${kind}`;
  el.style.display = 'block';
}

// Show import progress indicator
function showImportProgress() {
  const el = document.getElementById('importProgress');
  if (el) el.style.display = 'block';
}

// Hide import progress indicator
function hideImportProgress() {
  const el = document.getElementById('importProgress');
  if (el) el.style.display = 'none';
}

// ===== XEN Total Badge Management =====

// Throttle wallet balance updates to prevent spam
let lastWalletBalanceUpdate = 0;
const WALLET_BALANCE_THROTTLE_MS = 30000; // Only update every 30 seconds

// Update XEN total badge with current data
async function updateXENTotalBadge(includeWalletBalances = true) {
  const badge = document.getElementById("estXenTotal");
  if (!badge || typeof cointoolTable === 'undefined' || !cointoolTable) return;

  const activeData = cointoolTable.getData(); // Use all data, not just filtered
  console.log(`[XEN Badge] Updating with ${activeData.length} total rows (all data), includeWalletBalances: ${includeWalletBalances}`);
  let total = 0n;
  const addressBreakdown = {};

  // Process mint/stake data first - ONLY count Maturing rows
  let maturingCount = 0;
  let skippedCount = 0;
  activeData.forEach((rowData, index) => {
    // CRITICAL FIX: Only include Maturing mints in the total
    // Claimed, Claimable, and other statuses should NOT be counted
    const status = rowData.Status || rowData.status || '';
    if (status !== 'Maturing') {
      skippedCount++;
      return; // Skip non-maturing rows
    }

    maturingCount++;
    const xenValue = window.estimateXENForRow?.(rowData) || 0;
    if (index < 3) { // Log first 3 rows for debugging
      console.log(`[XEN Badge] Row ${index}: XEN value = ${xenValue}, ID = ${rowData.ID}`);
    }
    total += BigInt(xenValue);

    // Collect breakdown by address - try multiple possible field names
    let address = rowData.Address || rowData.address || rowData.Owner || rowData.owner || rowData.User || rowData.user;

    // If still not found, check if there's an address in the ID or other fields
    if (!address && rowData.ID && rowData.ID.includes('_')) {
      // ID format might be "address_mintId"
      const parts = rowData.ID.split('_');
      if (parts[0] && parts[0].startsWith('0x')) {
        address = parts[0];
      }
    }

    // Normalize address
    if (address && typeof address === 'string') {
      address = address.toLowerCase();
      if (!addressBreakdown[address]) {
        addressBreakdown[address] = { address, xenFromMints: 0n, walletBalance: 0n, usdValue: 0 };
      }
      addressBreakdown[address].xenFromMints += BigInt(xenValue);
    }
  });

  // Add wallet balances if enabled and not throttled
  if (includeWalletBalances) {
    const now = Date.now();
    if (now - lastWalletBalanceUpdate > WALLET_BALANCE_THROTTLE_MS) {
      lastWalletBalanceUpdate = now;

      try {
        const balances = await window.fetchAllWalletBalances?.() || {};
        Object.entries(balances).forEach(([address, balance]) => {
          const balanceWei = BigInt(balance || '0');
          // Convert from wei to tokens (divide by 10^18)
          const balanceTokens = balanceWei / BigInt('1000000000000000000');
          total += balanceTokens;

          const normalizedAddress = address.toLowerCase();
          if (!addressBreakdown[normalizedAddress]) {
            addressBreakdown[normalizedAddress] = { address: normalizedAddress, xenFromMints: 0n, walletBalance: 0n, usdValue: 0 };
          }
          addressBreakdown[normalizedAddress].walletBalance += balanceTokens;
        });
      } catch (e) {
        console.debug('Failed to fetch wallet balances:', e);
      }
    }
  }

  console.log(`[XEN Badge - uiManager.js] Calculated total: ${total.toString()} XEN from ${maturingCount} maturing mints (skipped ${skippedCount} non-maturing)`);
  console.log(`[XEN Badge] Final total: ${total.toString()} (formatted: ${window.formatNumberForMobile?.(Number(total)) || Number(total).toLocaleString()})`);

  badge.textContent = window.formatNumberForMobile?.(Number(total)) || Number(total).toLocaleString();

  // Render USD estimate if dataProcessor is available
  if (window.renderXenUsdEstimate) {
    window.renderXenUsdEstimate(total);
  }

  // Store breakdown data for tooltip
  // Note: xen-breakdown.js expects 'xen' and 'walletBalance' properties
  badge.dataset.breakdown = JSON.stringify(
    Object.entries(addressBreakdown).map(([address, data]) => ({
      address,
      xen: data.xenFromMints.toString(),
      walletBalance: data.walletBalance.toString(),
      usdValue: data.usdValue
    }))
  );

  // Add click handler for detailed breakdown tooltip
  badge.onclick = (e) => showXENTotalTooltip(e, addressBreakdown);

  // Refresh XEN breakdown display if available
  if (typeof window._xenTooltipRefresh === 'function') {
    window._xenTooltipRefresh();
  }
}

// Show detailed XEN total breakdown tooltip
function showXENTotalTooltip(event, addressBreakdown) {
  try {
    // Remove existing tooltips
    document.querySelectorAll('.xen-breakdown-tooltip').forEach(el => el.remove());

    const tooltip = document.createElement('div');
    tooltip.className = 'xen-breakdown-tooltip';

    // Calculate position
    const rect = event.target.getBoundingClientRect();
    const tooltipLeft = Math.min(rect.left, window.innerWidth - 320);
    const tooltipTop = rect.bottom + 5;

    tooltip.style.cssText = `
      position: fixed;
      left: ${tooltipLeft}px;
      top: ${tooltipTop}px;
      background: var(--modal-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
      font-size: 13px;
      line-height: 1.4;
    `;

    let html = '<div style="font-weight: bold; margin-bottom: 8px; color: var(--text-primary);">XEN Total Breakdown</div>';

    // Sort by XEN amount descending
    const sortedEntries = Object.entries(addressBreakdown).sort((a, b) => b[1].xenTokens - a[1].xenTokens);

    let totalUsd = 0;
    let isExpanded = false;

    // Show top 3 addresses initially, with expand option if more exist
    const displayCount = isExpanded ? sortedEntries.length : Math.min(3, sortedEntries.length);

    html += '<table style="width: 100%; border-spacing: 0;">';

    for (let i = 0; i < displayCount; i++) {
      const [address, item] = sortedEntries[i];
      let xenTokens = item.xenTokens;

      // Format XEN amount
      let xenFormatted;
      if (xenTokens >= 1000000) {
        xenFormatted = (xenTokens / 1000000).toFixed(2) + 'M';
      } else if (xenTokens >= 1000) {
        xenFormatted = (xenTokens / 1000).toFixed(2) + 'K';
      } else {
        xenFormatted = xenTokens.toFixed(2);
      }

      // Calculate USD value using current XEN price
      const xenPrice = window.xenUsdPrice;
      const usdValue = (typeof xenPrice === 'number' && xenPrice > 0)
        ? xenTokens * xenPrice
        : 0;
      totalUsd += usdValue;

      // Format USD with exactly 2 decimals
      const usdFormatted = usdValue > 0
        ? '$' + usdValue.toFixed(2)
        : '-';

      html += '<tr>';
      html += `<td style="padding: 2px 8px; color: #9ca3af;">${window.formatAddress?.(item.address) || item.address}</td>`;
      html += `<td style="padding: 2px 8px; text-align: right; color: #e5e7eb;">${xenFormatted}</td>`;
      html += `<td style="padding: 2px 8px; text-align: right;" class="usd-value">${usdFormatted}</td>`;
      html += '</tr>';
    }

    // Show expand/collapse if there are more addresses
    if (sortedEntries.length > 3) {
      html += `<tr><td colspan="3" style="padding: 4px 8px; text-align: center;">`;
      if (!isExpanded) {
        html += `<button onclick="showXENTotalTooltip(event, ${JSON.stringify(addressBreakdown).replace(/"/g, '&quot;')}, true)" style="background: none; border: none; color: var(--link-color); cursor: pointer; font-size: 12px;">Show all ${sortedEntries.length} addresses</button>`;
      }
      html += `</td></tr>`;
    }

    html += '</table>';

    // Add total row
    if (sortedEntries.length > 1) {
      const totalXen = Object.values(addressBreakdown).reduce((sum, item) => sum + item.xenTokens, 0);
      let totalXenFormatted;
      if (totalXen >= 1000000) {
        totalXenFormatted = (totalXen / 1000000).toFixed(2) + 'M';
      } else if (totalXen >= 1000) {
        totalXenFormatted = (totalXen / 1000).toFixed(2) + 'K';
      } else {
        totalXenFormatted = totalXen.toFixed(2);
      }

      const totalUsdFormatted = totalUsd > 0 ? '$' + totalUsd.toFixed(2) : '-';

      html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color); font-weight: bold; color: var(--text-primary);">`;
      html += `Total: ${totalXenFormatted} XEN (${totalUsdFormatted})`;
      html += `</div>`;
    }

    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);

    // Hide on click outside or scroll
    const hideTooltip = (e) => {
      if (!tooltip.contains(e.target) && e.target !== event.target) {
        tooltip.remove();
        document.removeEventListener('click', hideTooltip);
        document.removeEventListener('scroll', hideTooltip);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', hideTooltip);
      document.addEventListener('scroll', hideTooltip);
    }, 100);

  } catch (e) {
    console.error('Error showing XEN total tooltip:', e);
  }
}

// ===== Crank Status Management =====

// Update crank/scan status UI
function updateCrankStatus() {
  const statusDiv = document.getElementById('crankStatus');
  if (!statusDiv) return;

  let hasActiveCrank = false;
  let statusText = '';

  // Check for active scanners
  if (window.cointoolScanManager?.isScanning()) {
    hasActiveCrank = true;
    statusText += 'Scanning Cointool... ';
  }

  if (window.xenftScanManager?.isScanning()) {
    hasActiveCrank = true;
    statusText += 'Scanning XENFT... ';
  }

  if (window.xenftStakeScanManager?.isScanning()) {
    hasActiveCrank = true;
    statusText += 'Scanning Stakes... ';
  }

  if (window.xenScanManager?.isScanning()) {
    hasActiveCrank = true;
    statusText += 'Scanning XEN... ';
  }

  // Update UI based on status
  if (hasActiveCrank) {
    statusDiv.textContent = statusText.trim();
    statusDiv.style.display = 'block';
    statusDiv.classList.add('scanning');
  } else {
    statusDiv.style.display = 'none';
    statusDiv.classList.remove('scanning');
  }
}

// ===== Chart Management =====
// Chart functionality now provided by js/core/chartManager.js module

function updateVmuChart() {
  // Delegate to chartManager module
  if (window.updateVmuChart) {
    return window.updateVmuChart();
  }
}

// ===== Export Module Functions =====
export const uiManager = {
  // Chain management
  updateChainSpecificLabels,

  // Theme management
  updateThemeMenuUI,

  // About tab management
  ensureAboutLoaded,
  setupAboutSubtabs,
  syncIframeThemes,
  syncIframeTheme,

  // Progress UI
  progressUI,

  // Import status
  showImportStatus,
  showImportProgress,
  hideImportProgress,

  // XEN total badge
  updateXENTotalBadge,
  showXENTotalTooltip,

  // Crank status
  updateCrankStatus,

  // Chart management
  updateVmuChart
};

// ===== Global Function Exports for Backward Compatibility =====
window.updateChainSpecificLabels = updateChainSpecificLabels;
window.updateThemeMenuUI = updateThemeMenuUI;
window.ensureAboutLoaded = ensureAboutLoaded;
window.setupAboutSubtabs = setupAboutSubtabs;
window.syncIframeThemes = syncIframeThemes;
window.syncIframeTheme = syncIframeTheme;
window.progressUI = progressUI;
window.showImportStatus = showImportStatus;
window.showImportProgress = showImportProgress;
window.hideImportProgress = hideImportProgress;
window.updateXENTotalBadge = updateXENTotalBadge;
window.showXENTotalTooltip = showXENTotalTooltip;
window.updateCrankStatus = updateCrankStatus;
window.updateVmuChart = updateVmuChart;
window.shortAddr = shortAddr;

export default uiManager;
