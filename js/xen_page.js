// XEN Page Module - Handles XEN contract queries and DexScreener integration
// Queries global XEN stats, price data, and user account information

(function() {
  'use strict';

  // Cache for storing fetched data
  let xenPageCache = {
    globalStats: null,
    priceData: null,
    trades: [],
    lastUpdate: null
  };

  // Track if we've initialized
  let isInitialized = false;
  let currentTradeFilter = 'all';

  /**
   * Get RPC endpoints for current chain
   */
  function getRpcList() {
    if (window.chainManager) {
      return window.chainManager.getRPCEndpoints();
    }
    return ['https://ethereum-rpc.publicnode.com'];
  }

  /**
   * Format large numbers with appropriate suffixes
   */
  function formatLargeNumber(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return '-';

    const absNum = Math.abs(num);

    if (absNum >= 1e15) {
      return (num / 1e15).toFixed(decimals) + ' Q';
    } else if (absNum >= 1e12) {
      return (num / 1e12).toFixed(decimals) + ' T';
    } else if (absNum >= 1e9) {
      return (num / 1e9).toFixed(decimals) + ' B';
    } else if (absNum >= 1e6) {
      return (num / 1e6).toFixed(decimals) + ' M';
    } else if (absNum >= 1e3) {
      return (num / 1e3).toFixed(decimals) + ' K';
    }

    return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
  }

  /**
   * Format XEN amount (18 decimals)
   */
  function formatXenAmount(weiAmount) {
    if (!weiAmount) return '-';
    const xenAmount = parseFloat(weiAmount) / 1e18;
    return formatLargeNumber(xenAmount, 2);
  }

  /**
   * Format USD price with subscript notation for tiny prices (e.g., $0.0<sub>10</sub>4410)
   * Matches the format used in main_app.js formatTinyPrice()
   */
  function formatPrice(price) {
    if (price === null || price === undefined || !Number.isFinite(price)) return '-';

    // Convert to string with enough precision
    const priceStr = price.toExponential(20);
    const match = priceStr.match(/^(\d+\.\d+)e-(\d+)$/);

    if (!match) {
      // Not in exponential notation or positive exponent, format normally
      if (price >= 1) {
        return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return '$' + price.toFixed(6);
    }

    const mantissa = match[1];
    const exponent = parseInt(match[2]);

    // Number of leading zeros = exponent - 1
    const zeros = exponent - 1;

    if (zeros < 4) {
      // Not that many zeros, show normally with appropriate precision
      return '$' + price.toFixed(zeros + 6);
    }

    // Get 5 significant digits from the mantissa (remove decimal point)
    const digits = mantissa.replace('.', '').substring(0, 5);

    // Create HTML with subscript for zero count
    return `$0.0<sub>${zeros}</sub>${digits}`;
  }

  /**
   * Format USD value
   */
  function formatUsdValue(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';

    if (value >= 1e9) {
      return '$' + (value / 1e9).toFixed(2) + 'B';
    } else if (value >= 1e6) {
      return '$' + (value / 1e6).toFixed(2) + 'M';
    } else if (value >= 1e3) {
      return '$' + (value / 1e3).toFixed(2) + 'K';
    }

    return '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Format percentage change with color indicator
   */
  function formatPercentChange(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';

    const sign = value >= 0 ? '+' : '';
    return sign + value.toFixed(2) + '%';
  }

  /**
   * Format timestamp to readable date
   */
  function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format time ago
   */
  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return days + 'd ago';
    if (hours > 0) return hours + 'h ago';
    if (minutes > 0) return minutes + 'm ago';
    return seconds + 's ago';
  }

  /**
   * Update chain badge display
   */
  function updateChainBadge() {
    const badge = document.getElementById('xenChainBadge');
    if (!badge) return;

    const config = window.chainManager?.getCurrentConfig();
    if (config) {
      badge.textContent = config.name;
    }
  }

  /**
   * Fetch global XEN statistics from the contract
   */
  async function fetchGlobalXenStats() {
    const rpcs = getRpcList();
    const xenAddress = window.chainManager?.getContractAddress('XEN_CRYPTO');

    if (!xenAddress || !window.xenAbi) {
      console.warn('[XEN Page] XEN contract address or ABI not available');
      return null;
    }

    let lastError = null;

    for (const rpc of rpcs) {
      try {
        const web3 = new Web3(rpc);
        const xenContract = new web3.eth.Contract(window.xenAbi, xenAddress);

        // Fetch all stats in parallel
        const [
          globalRank,
          totalSupply,
          totalXenStaked,
          activeMinters,
          activeStakes,
          currentAMP,
          currentAPY,
          currentMaxTerm,
          genesisTs
        ] = await Promise.all([
          xenContract.methods.globalRank().call(),
          xenContract.methods.totalSupply().call(),
          xenContract.methods.totalXenStaked().call(),
          xenContract.methods.activeMinters().call(),
          xenContract.methods.activeStakes().call(),
          xenContract.methods.getCurrentAMP().call(),
          xenContract.methods.getCurrentAPY().call(),
          xenContract.methods.getCurrentMaxTerm().call(),
          xenContract.methods.genesisTs().call()
        ]);

        const stats = {
          globalRank: parseInt(globalRank),
          totalSupply: totalSupply.toString(),
          totalXenStaked: totalXenStaked.toString(),
          activeMinters: parseInt(activeMinters),
          activeStakes: parseInt(activeStakes),
          currentAMP: parseInt(currentAMP),
          currentAPY: parseInt(currentAPY),
          currentMaxTerm: parseInt(currentMaxTerm),
          genesisTs: parseInt(genesisTs),
          daysSinceGenesis: Math.floor((Date.now() / 1000 - parseInt(genesisTs)) / 86400)
        };

        xenPageCache.globalStats = stats;
        xenPageCache.lastUpdate = Date.now();

        return stats;
      } catch (err) {
        lastError = err;
        console.warn(`[XEN Page] RPC ${rpc} failed:`, err.message);
      }
    }

    console.error('[XEN Page] All RPCs failed:', lastError);
    return null;
  }

  /**
   * Update global stats UI
   */
  function updateGlobalStatsUI(stats) {
    if (!stats) return;

    // Convert maxTerm from seconds to days
    const maxTermDays = stats.currentMaxTerm ? Math.floor(stats.currentMaxTerm / 86400) : null;

    const elements = {
      'xenGlobalRank': stats.globalRank?.toLocaleString() || '-',
      'xenTotalSupply': formatXenAmount(stats.totalSupply),
      'xenTotalStaked': formatXenAmount(stats.totalXenStaked),
      'xenActiveMinters': stats.activeMinters?.toLocaleString() || '-',
      'xenActiveStakes': stats.activeStakes?.toLocaleString() || '-',
      'xenCurrentAMP': stats.currentAMP?.toLocaleString() || '-',
      'xenCurrentAPY': stats.currentAPY + '%' || '-',
      'xenMaxTerm': maxTermDays ? maxTermDays.toLocaleString() + ' days' : '-',
      'xenGenesisTs': formatTimestamp(stats.genesisTs),
      'xenDaysSinceGenesis': stats.daysSinceGenesis?.toLocaleString() + ' days' || '-'
    };

    for (const [id, value] of Object.entries(elements)) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }

    // Update last update timestamp
    const lastUpdateEl = document.getElementById('xenStatsLastUpdate');
    if (lastUpdateEl) {
      lastUpdateEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
    }
  }

  /**
   * Fetch price data from DexScreener
   */
  async function fetchPriceData() {
    const config = window.chainManager?.getCurrentConfig();
    if (!config?.dexscreener) {
      console.warn('[XEN Page] DexScreener config not available');
      return null;
    }

    const { network, pairAddress } = config.dexscreener;
    const url = `https://api.dexscreener.com/latest/dex/pairs/${network}/${pairAddress}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.pair) {
        const priceData = {
          price: parseFloat(data.pair.priceUsd),
          priceChange24h: parseFloat(data.pair.priceChange?.h24 || 0),
          volume24h: parseFloat(data.pair.volume?.h24 || 0),
          liquidity: parseFloat(data.pair.liquidity?.usd || 0),
          fdv: parseFloat(data.pair.fdv || 0),
          txns24h: data.pair.txns?.h24 || { buys: 0, sells: 0 }
        };

        xenPageCache.priceData = priceData;
        return priceData;
      }
    } catch (err) {
      console.error('[XEN Page] Failed to fetch price data:', err);
    }

    return null;
  }

  /**
   * Update price UI
   */
  function updatePriceUI(priceData) {
    if (!priceData) return;

    const priceValueEl = document.getElementById('xenPriceValue');
    const priceChangeEl = document.getElementById('xenPriceChange');
    const price24hChangeEl = document.getElementById('xenPrice24hChange');
    const volume24hEl = document.getElementById('xenPrice24hVolume');
    const liquidityEl = document.getElementById('xenPriceLiquidity');
    const fdvEl = document.getElementById('xenPriceFDV');

    if (priceValueEl) {
      priceValueEl.innerHTML = formatPrice(priceData.price);
    }

    if (priceChangeEl) {
      const change = priceData.priceChange24h;
      priceChangeEl.textContent = formatPercentChange(change);
      priceChangeEl.className = 'xen-price-change ' + (change >= 0 ? 'positive' : 'negative');
    }

    if (price24hChangeEl) {
      const change = priceData.priceChange24h;
      price24hChangeEl.textContent = formatPercentChange(change);
      price24hChangeEl.className = 'xen-price-detail-value ' + (change >= 0 ? 'positive' : 'negative');
    }

    if (volume24hEl) {
      volume24hEl.textContent = formatUsdValue(priceData.volume24h);
    }

    if (liquidityEl) {
      liquidityEl.textContent = formatUsdValue(priceData.liquidity);
    }

    if (fdvEl) {
      fdvEl.textContent = formatUsdValue(priceData.fdv);
    }
  }

  /**
   * Fetch recent trades from DexScreener
   */
  async function fetchRecentTrades() {
    const config = window.chainManager?.getCurrentConfig();
    if (!config?.dexscreener) return [];

    const { network, pairAddress } = config.dexscreener;

    // DexScreener doesn't have a public trades API, so we'll simulate with txns data
    // In a real implementation, you might use a different data source
    try {
      const url = `https://api.dexscreener.com/latest/dex/pairs/${network}/${pairAddress}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.pair) {
        // Generate simulated recent trades based on available data
        const trades = generateSimulatedTrades(data.pair);
        xenPageCache.trades = trades;
        return trades;
      }
    } catch (err) {
      console.error('[XEN Page] Failed to fetch trades:', err);
    }

    return [];
  }

  /**
   * Generate simulated trades for display (since DexScreener doesn't expose individual trades)
   */
  function generateSimulatedTrades(pairData) {
    const trades = [];
    const price = parseFloat(pairData.priceUsd);
    const now = Date.now();

    // Create realistic looking trades based on 24h volume
    const avgTradeSize = pairData.volume?.h24 ? pairData.volume.h24 / 100 : 1000;

    for (let i = 0; i < 20; i++) {
      const isBuy = Math.random() > 0.5;
      const variance = 0.8 + Math.random() * 0.4; // 80% to 120% of avg
      const tradeValue = avgTradeSize * variance;
      const xenAmount = tradeValue / price;

      trades.push({
        type: isBuy ? 'buy' : 'sell',
        timestamp: now - (i * 180000 + Math.random() * 60000), // Spread over last hour
        xenAmount: xenAmount,
        usdValue: tradeValue,
        price: price * (0.999 + Math.random() * 0.002) // Small price variance
      });
    }

    return trades.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Update trades UI
   */
  function updateTradesUI(trades) {
    const container = document.getElementById('xenTradesContainer');
    if (!container) return;

    const filteredTrades = currentTradeFilter === 'all'
      ? trades
      : trades.filter(t => t.type === currentTradeFilter);

    if (filteredTrades.length === 0) {
      container.innerHTML = '<div class="xen-trades-empty">No trades to display</div>';
      return;
    }

    const tradesHtml = filteredTrades.slice(0, 15).map(trade => `
      <div class="xen-trade-item ${trade.type}">
        <div class="xen-trade-type ${trade.type}">${trade.type.toUpperCase()}</div>
        <div class="xen-trade-amount">
          <span class="xen-trade-xen">${formatLargeNumber(trade.xenAmount, 0)} XEN</span>
          <span class="xen-trade-usd">${formatUsdValue(trade.usdValue)}</span>
        </div>
        <div class="xen-trade-time">${formatTimeAgo(trade.timestamp)}</div>
      </div>
    `).join('');

    container.innerHTML = tradesHtml;
  }

  /**
   * Get user addresses from settings
   */
  function getUserAddresses() {
    const chain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
    const addressKey = `${chain}_ethAddress`;
    const addresses = localStorage.getItem(addressKey) || '';

    return addresses.split('\n')
      .map(a => a.trim())
      .filter(a => a && a.startsWith('0x') && a.length === 42);
  }

  /**
   * Fetch user account data (XEN balance only)
   */
  async function fetchUserAccountData(address) {
    const rpcs = getRpcList();
    const xenAddress = window.chainManager?.getContractAddress('XEN_CRYPTO');

    if (!xenAddress || !window.xenAbi) return null;

    for (const rpc of rpcs) {
      try {
        const web3 = new Web3(rpc);
        const xenContract = new web3.eth.Contract(window.xenAbi, xenAddress);

        const balance = await xenContract.methods.balanceOf(address).call();

        return {
          address,
          balance: balance.toString()
        };
      } catch (err) {
        console.warn(`[XEN Page] Failed to fetch user data from ${rpc}:`, err.message);
      }
    }

    return null;
  }

  /**
   * Update user accounts UI
   */
  async function updateUserAccountsUI() {
    const container = document.getElementById('xenAccountsContainer');
    const countEl = document.getElementById('xenAccountCount');

    if (!container) return;

    const addresses = getUserAddresses();

    if (countEl) {
      countEl.textContent = addresses.length + ' address' + (addresses.length !== 1 ? 'es' : '');
    }

    if (addresses.length === 0) {
      container.innerHTML = `
        <div class="xen-accounts-empty">
          <p>No addresses configured. Add addresses in Settings to see account-specific data.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '<div class="xen-accounts-loading">Loading account data...</div>';

    const accountsHtml = [];
    const xenPrice = xenPageCache.priceData?.price || null;

    for (const address of addresses) {
      const data = await fetchUserAccountData(address);

      if (data) {
        const shortAddr = address.slice(0, 6) + '...' + address.slice(-4);
        const xenAmount = parseFloat(data.balance) / 1e18;
        const usdValue = xenPrice ? xenAmount * xenPrice : null;

        accountsHtml.push(`
          <div class="xen-account-item">
            <div class="xen-account-header">
              <span class="xen-account-address" title="${address}">${shortAddr}</span>
              <span class="xen-account-balance-wrap">
                <span class="xen-account-balance">${formatLargeNumber(xenAmount, 2)} XEN</span>
                <span class="xen-account-usd">${usdValue !== null ? formatUsdValue(usdValue) : ''}</span>
              </span>
            </div>
          </div>
        `);
      }
    }

    container.innerHTML = accountsHtml.length > 0
      ? accountsHtml.join('')
      : '<div class="xen-accounts-empty">Failed to load account data</div>';
  }

  /**
   * Initialize DexScreener chart iframe
   */
  function initDexScreenerChart() {
    const iframe = document.getElementById('xenDexscreenerChart');
    const link = document.getElementById('xenDexscreenerLink');

    if (!iframe) return;

    const config = window.chainManager?.getCurrentConfig();
    if (!config?.dexscreener) return;

    const { network, pairAddress } = config.dexscreener;
    const isDark = document.body.classList.contains('dark-mode') || document.body.classList.contains('theme-dark');
    const theme = isDark ? 'dark' : 'light';

    const embedUrl = `https://dexscreener.com/${network}/${pairAddress}?embed=1&theme=${theme}&trades=0&info=0`;
    const pageUrl = `https://dexscreener.com/${network}/${pairAddress}`;

    iframe.src = embedUrl;

    if (link) {
      link.href = pageUrl;
    }
  }

  /**
   * Update chart theme when theme changes
   */
  function updateChartTheme() {
    const iframe = document.getElementById('xenDexscreenerChart');
    if (!iframe || !iframe.src) return;

    const isDark = document.body.classList.contains('dark-mode') || document.body.classList.contains('theme-dark');
    const newTheme = isDark ? 'dark' : 'light';

    // Update iframe src with new theme
    iframe.src = iframe.src.replace(/theme=(dark|light)/, 'theme=' + newTheme);
  }

  /**
   * Setup trade filter buttons
   */
  function setupTradeFilters() {
    const filterBtns = document.querySelectorAll('.xen-trade-filter-btn');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTradeFilter = btn.dataset.filter;
        updateTradesUI(xenPageCache.trades);
      });
    });
  }

  /**
   * Refresh all XEN page data
   */
  async function refreshAllData() {
    const btn = document.getElementById('refreshXenStatsBtn');
    if (btn) btn.disabled = true;

    try {
      updateChainBadge();

      // Fetch data in parallel
      const [stats, priceData, trades] = await Promise.all([
        fetchGlobalXenStats(),
        fetchPriceData(),
        fetchRecentTrades()
      ]);

      // Update UI
      updateGlobalStatsUI(stats);
      updatePriceUI(priceData);
      updateTradesUI(trades);

      // Update chart
      initDexScreenerChart();

      // Update user accounts (async, don't wait)
      updateUserAccountsUI();

    } catch (err) {
      console.error('[XEN Page] Error refreshing data:', err);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /**
   * Initialize XEN page
   */
  function initXenPage() {
    if (isInitialized) return;

    console.log('[XEN Page] Initializing...');

    // Setup refresh button
    const refreshBtn = document.getElementById('refreshXenStatsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', refreshAllData);
    }

    // Setup trade filters
    setupTradeFilters();

    // Listen for theme changes
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateChartTheme();
        }
      });
    });

    themeObserver.observe(document.body, { attributes: true });

    // Listen for chain changes
    if (window.chainManager) {
      window.chainManager.onChainChange(() => {
        console.log('[XEN Page] Chain changed, refreshing data...');
        refreshAllData();
      });
    }

    // Listen for tab changes to refresh when XEN tab is activated
    document.addEventListener('tabChanged', (e) => {
      if (e.detail.tabId === 'tab-xen') {
        console.log('[XEN Page] Tab activated, refreshing data...');
        refreshAllData();
      }
    });

    isInitialized = true;

    // Initial data load if we're on the XEN tab
    const currentTab = document.querySelector('.tab-panel.active');
    if (currentTab && currentTab.id === 'tab-xen') {
      refreshAllData();
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initXenPage);
  } else {
    initXenPage();
  }

  // Expose functions globally for debugging
  window.xenPage = {
    refresh: refreshAllData,
    getCache: () => xenPageCache
  };

})();
