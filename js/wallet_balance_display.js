// Wallet Balance Display for Mint/Stake Page
// Shows native token (ETH/AVAX/etc) and XEN balances with USD values

// Currency symbols for each chain
const CHAIN_CURRENCY_SYMBOLS = {
  ETHEREUM: 'ETH',
  BASE: 'ETH',
  AVALANCHE: 'AVAX',
  BSC: 'BNB',
  MOONBEAM: 'GLMR',
  POLYGON: 'MATIC',
  OPTIMISM: 'ETH'
};

// Get chain-specific helpers (prefixed to avoid conflicts)
const getXenAddressForBalance = () => window.chainManager?.getContractAddress('XEN_CRYPTO') || '0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8';
const getDefaultRPCForBalance = () => window.chainManager?.getCurrentConfig()?.rpcUrls?.default || 'https://ethereum-rpc.publicnode.com';

// Cache for native token prices (to avoid rate limiting)
const nativePriceCache = {
  price: 0,
  timestamp: 0,
  chain: null,
  CACHE_DURATION: 5 * 60 * 1000 // 5 minutes
};

// Fetch price from CryptoCompare (fallback #1)
async function fetchPriceFromCryptoCompare(symbol) {
  const url = `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`;
  console.log('[WALLET-BALANCE] Trying CryptoCompare:', url);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`CryptoCompare HTTP ${response.status}`);

  const data = await response.json();
  console.log('[WALLET-BALANCE] CryptoCompare response:', data);

  if (data.Response === 'Error') throw new Error(data.Message || 'CryptoCompare error');

  const price = parseFloat(data.USD);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid price from CryptoCompare');

  return price;
}

// Fetch price from Binance (fallback #2)
async function fetchPriceFromBinance(symbol) {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`;
  console.log('[WALLET-BALANCE] Trying Binance:', url);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);

  const data = await response.json();
  console.log('[WALLET-BALANCE] Binance response:', data);

  const price = parseFloat(data.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid price from Binance');

  return price;
}

// Fetch price from CoinGecko (primary)
async function fetchPriceFromCoinGecko(coinId) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
  console.log('[WALLET-BALANCE] Trying CoinGecko:', url);

  const response = await fetch(url);
  console.log('[WALLET-BALANCE] CoinGecko response status:', response.status);

  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);

  const data = await response.json();
  console.log('[WALLET-BALANCE] CoinGecko data:', data);

  const price = data[coinId]?.usd || 0;
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid price from CoinGecko');

  return price;
}

// Get current native token price with multi-source fallback and caching
async function fetchNativeTokenPrice() {
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  const now = Date.now();

  // Check if we have a valid cached price for this chain
  if (nativePriceCache.chain === currentChain &&
      nativePriceCache.timestamp > 0 &&
      (now - nativePriceCache.timestamp) < nativePriceCache.CACHE_DURATION) {
    console.log('[WALLET-BALANCE] Using cached price for', currentChain, ':', nativePriceCache.price,
                '(age:', Math.round((now - nativePriceCache.timestamp) / 1000), 'seconds)');
    return nativePriceCache.price;
  }

  // Map chains to different API identifiers
  const coinGeckoIds = {
    ETHEREUM: 'ethereum',
    BASE: 'ethereum',
    AVALANCHE: 'avalanche-2',
    BSC: 'binancecoin',
    MOONBEAM: 'moonbeam',
    POLYGON: 'matic-network',
    OPTIMISM: 'ethereum'
  };

  const cryptoCompareSymbols = {
    ETHEREUM: 'ETH',
    BASE: 'ETH',
    AVALANCHE: 'AVAX',
    BSC: 'BNB',
    MOONBEAM: 'GLMR',
    POLYGON: 'MATIC',
    OPTIMISM: 'ETH'
  };

  const binanceSymbols = {
    ETHEREUM: 'ETH',
    BASE: 'ETH',
    AVALANCHE: 'AVAX',
    BSC: 'BNB',
    MOONBEAM: 'GLMR',
    POLYGON: 'MATIC',
    OPTIMISM: 'ETH'
  };

  const coinGeckoId = coinGeckoIds[currentChain] || 'ethereum';
  const cryptoCompareSymbol = cryptoCompareSymbols[currentChain] || 'ETH';
  const binanceSymbol = binanceSymbols[currentChain] || 'ETH';

  console.log('[WALLET-BALANCE] Fetching price for chain:', currentChain);

  let price = 0;
  let source = '';

  // Try CoinGecko first
  try {
    price = await fetchPriceFromCoinGecko(coinGeckoId);
    source = 'CoinGecko';
    console.log('[WALLET-BALANCE] Successfully fetched from CoinGecko:', price);
  } catch (error1) {
    console.warn('[WALLET-BALANCE] CoinGecko failed:', error1.message);

    // Try CryptoCompare as fallback #1
    try {
      price = await fetchPriceFromCryptoCompare(cryptoCompareSymbol);
      source = 'CryptoCompare';
      console.log('[WALLET-BALANCE] Successfully fetched from CryptoCompare:', price);
    } catch (error2) {
      console.warn('[WALLET-BALANCE] CryptoCompare failed:', error2.message);

      // Try Binance as fallback #2
      try {
        price = await fetchPriceFromBinance(binanceSymbol);
        source = 'Binance';
        console.log('[WALLET-BALANCE] Successfully fetched from Binance:', price);
      } catch (error3) {
        console.error('[WALLET-BALANCE] All price sources failed. CoinGecko:', error1.message,
                     'CryptoCompare:', error2.message, 'Binance:', error3.message);

        // If all fail, use stale cache if available
        if (nativePriceCache.chain === currentChain && nativePriceCache.price > 0) {
          console.log('[WALLET-BALANCE] Using stale cached price due to all sources failing:', nativePriceCache.price);
          return nativePriceCache.price;
        }
        return 0;
      }
    }
  }

  // Update cache
  if (price > 0) {
    nativePriceCache.price = price;
    nativePriceCache.timestamp = now;
    nativePriceCache.chain = currentChain;
    console.log('[WALLET-BALANCE] Price cached for', currentChain, 'from', source);
  }

  return price;
}

// Get XEN price from localStorage (already cached by settings)
function getXenPrice() {
  try {
    const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
    const chainPrefix = currentChain + '_';

    // Try chain-specific key first, then fallback to global
    let priceStr = localStorage.getItem(chainPrefix + 'xenPrice');
    console.log(`[WALLET-BALANCE] Looking for XEN price with key: ${chainPrefix}xenPrice, found:`, priceStr);

    if (!priceStr) {
      priceStr = localStorage.getItem('xenPrice');
      console.log(`[WALLET-BALANCE] Fallback to xenPrice key, found:`, priceStr);
    }

    // Also try xenUsdPrice which might be used by main app
    if (!priceStr) {
      priceStr = localStorage.getItem(chainPrefix + 'xenUsdPrice');
      console.log(`[WALLET-BALANCE] Trying ${chainPrefix}xenUsdPrice, found:`, priceStr);
    }

    if (!priceStr) {
      priceStr = localStorage.getItem('xenUsdPrice');
      console.log(`[WALLET-BALANCE] Trying xenUsdPrice, found:`, priceStr);
    }

    const price = parseFloat(priceStr) || 0;
    console.log(`[WALLET-BALANCE] Final XEN price for ${currentChain}:`, price);
    return price;
  } catch (e) {
    console.error('[WALLET-BALANCE] Error getting XEN price:', e);
    return 0;
  }
}

// Fetch native token balance (ETH, AVAX, BNB, etc.)
async function fetchNativeBalance(address) {
  try {
    if (!address) return '0';

    let provider = null;
    const currentChainId = window.chainManager?.getCurrentConfig()?.id || 1;

    // Try to use wallet provider if connected and on correct chain
    if (window.web3Wallet) {
      try {
        const cid = await window.web3Wallet.eth.getChainId();
        if (Number(cid) === currentChainId) {
          provider = window.web3Wallet;
        }
      } catch (_) {}
    }

    // Fallback to chain-specific RPC
    if (!provider) {
      const rpcList = window.chainManager?.getRPCEndpoints() || [getDefaultRPCForBalance()];
      provider = new Web3(rpcList[0]);
    }

    const balance = await provider.eth.getBalance(address);
    return balance; // wei string
  } catch (error) {
    console.warn('[WALLET-BALANCE] Failed to fetch native balance:', error);
    return '0';
  }
}

// Fetch XEN token balance (reuse existing function from mint_flows.js)
async function fetchXenBalance(address) {
  try {
    if (!address) return '0';

    let provider = null;
    const currentChainId = window.chainManager?.getCurrentConfig()?.id || 1;

    if (window.web3Wallet) {
      try {
        const cid = await window.web3Wallet.eth.getChainId();
        if (Number(cid) === currentChainId) {
          provider = window.web3Wallet;
        }
      } catch (_) {}
    }

    if (!provider) {
      const rpcList = window.chainManager?.getRPCEndpoints() || [getDefaultRPCForBalance()];
      provider = new Web3(rpcList[0]);
    }

    const xenAddress = getXenAddressForBalance();
    const token = new provider.eth.Contract(window.xenAbi, xenAddress);
    const balance = await token.methods.balanceOf(address).call();
    return balance; // wei string
  } catch (error) {
    console.warn('[WALLET-BALANCE] Failed to fetch XEN balance:', error);
    return '0';
  }
}

// Format balance for display (with commas and max 4 decimals)
function formatBalance(weiString, maxDecimals = 4) {
  try {
    const etherString = Web3.utils.fromWei(weiString, 'ether');
    const num = parseFloat(etherString);

    if (num === 0) return '0';

    // For very small numbers, show scientific notation
    if (num < 0.0001 && num > 0) {
      return num.toExponential(2);
    }

    // For normal numbers, show with commas and limited decimals
    const parts = num.toFixed(maxDecimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Remove trailing zeros after decimal
    if (parts[1]) {
      parts[1] = parts[1].replace(/0+$/, '');
      if (parts[1] === '') {
        return parts[0];
      }
      return parts[0] + '.' + parts[1];
    }

    return parts[0];
  } catch {
    return '0';
  }
}

// Format USD value
function formatUSD(amount) {
  if (!amount || amount === 0) return '$0.00';

  if (amount < 0.01) {
    return '<$0.01';
  }

  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Calculate USD value from balance and price
function calculateUSD(weiString, priceUSD) {
  try {
    const etherString = Web3.utils.fromWei(weiString, 'ether');
    const amount = parseFloat(etherString);
    return amount * priceUSD;
  } catch {
    return 0;
  }
}

// Update wallet balance display
async function updateWalletBalanceDisplay() {
  console.log('[WALLET-BALANCE] === updateWalletBalanceDisplay called ===');

  const card = document.getElementById('walletBalanceCard');
  const nativeLabel = document.getElementById('nativeTokenLabel');
  const nativeBalance = document.getElementById('nativeTokenBalance');
  const nativeUsd = document.getElementById('nativeTokenUsd');
  const xenBalance = document.getElementById('xenTokenBalance');
  const xenUsd = document.getElementById('xenTokenUsd');

  console.log('[WALLET-BALANCE] DOM Elements:', {
    card: !!card,
    nativeLabel: !!nativeLabel,
    nativeBalance: !!nativeBalance,
    nativeUsd: !!nativeUsd,
    xenBalance: !!xenBalance,
    xenUsd: !!xenUsd
  });

  if (!card) {
    console.error('[WALLET-BALANCE] Card element not found!');
    return;
  }

  // Check if wallet is connected
  console.log('[WALLET-BALANCE] Checking wallet connection...', {
    connectedAccount: window.connectedAccount,
    web3Wallet: !!window.web3Wallet,
    ethereum: !!window.ethereum
  });

  if (!window.connectedAccount) {
    console.log('[WALLET-BALANCE] No wallet connected, hiding card');
    card.style.display = 'none';
    return;
  }

  // Show card
  console.log('[WALLET-BALANCE] Wallet connected! Showing card...');
  card.style.display = 'block';

  // Update native token label based on current chain
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  const currencySymbol = CHAIN_CURRENCY_SYMBOLS[currentChain] || 'ETH';
  console.log('[WALLET-BALANCE] Current chain:', currentChain, 'Currency:', currencySymbol);
  if (nativeLabel) nativeLabel.textContent = currencySymbol;

  // Set loading state
  console.log('[WALLET-BALANCE] Setting loading state...');
  if (nativeBalance) nativeBalance.textContent = 'Loading...';
  if (nativeUsd) nativeUsd.textContent = '';
  if (xenBalance) xenBalance.textContent = 'Loading...';
  if (xenUsd) xenUsd.textContent = '';

  try {
    console.log('[WALLET-BALANCE] Fetching prices...');
    // Fetch prices
    const [nativePrice, xenPrice] = await Promise.all([
      fetchNativeTokenPrice(),
      Promise.resolve(getXenPrice())
    ]);
    console.log('[WALLET-BALANCE] Prices fetched:', { nativePrice, xenPrice });

    console.log('[WALLET-BALANCE] Fetching balances for:', window.connectedAccount);
    // Fetch balances
    const [nativeBal, xenBal] = await Promise.all([
      fetchNativeBalance(window.connectedAccount),
      fetchXenBalance(window.connectedAccount)
    ]);
    console.log('[WALLET-BALANCE] Balances fetched (wei):', { nativeBal, xenBal });

    // Update native token display
    if (nativeBalance) {
      nativeBalance.textContent = formatBalance(nativeBal, 4);
    }
    if (nativeUsd) {
      const nativeUsdValue = calculateUSD(nativeBal, nativePrice);
      nativeUsd.textContent = formatUSD(nativeUsdValue);
    }

    // Update XEN display
    if (xenBalance) {
      xenBalance.textContent = formatBalance(xenBal, 2);
    }
    if (xenUsd) {
      const xenUsdValue = calculateUSD(xenBal, xenPrice);
      xenUsd.textContent = formatUSD(xenUsdValue);
    }

    console.debug('[WALLET-BALANCE] Updated:', {
      native: formatBalance(nativeBal),
      nativeUSD: formatUSD(calculateUSD(nativeBal, nativePrice)),
      xen: formatBalance(xenBal),
      xenUSD: formatUSD(calculateUSD(xenBal, xenPrice))
    });
  } catch (error) {
    console.error('[WALLET-BALANCE] Error updating display:', error);
    if (nativeBalance) nativeBalance.textContent = 'Error';
    if (xenBalance) xenBalance.textContent = 'Error';
  }
}

// Initialize wallet balance display
function initWalletBalanceDisplay() {
  console.debug('[WALLET-BALANCE] Initializing display...');

  // Attach refresh button handler
  const refreshBtn = document.getElementById('refreshBalancesBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.debug('[WALLET-BALANCE] Manual refresh triggered');
      updateWalletBalanceDisplay();
    });
  }

  // Listen for wallet connection events from main_app.js
  document.addEventListener('walletConnected', () => {
    console.debug('[WALLET-BALANCE] Wallet connected event received');
    updateWalletBalanceDisplay();
  });

  document.addEventListener('walletDisconnected', () => {
    console.debug('[WALLET-BALANCE] Wallet disconnected event received');
    const card = document.getElementById('walletBalanceCard');
    if (card) card.style.display = 'none';
  });

  // Update on wallet connection - hook into existing function
  if (window.updateMintConnectHint) {
    const originalUpdate = window.updateMintConnectHint;
    window.updateMintConnectHint = function() {
      originalUpdate();
      setTimeout(() => {
        if (window.connectedAccount) {
          console.debug('[WALLET-BALANCE] Updating after wallet connection');
          updateWalletBalanceDisplay();
        }
      }, 100);
    };
  }

  // Update when tab becomes visible
  const mintTab = document.getElementById('tab-mint');
  if (mintTab) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isActive = mintTab.classList.contains('active');
          if (isActive && window.connectedAccount) {
            console.debug('[WALLET-BALANCE] Tab became active, updating display');
            updateWalletBalanceDisplay();
          }
        }
      });
    });

    observer.observe(mintTab, { attributes: true });
  }

  // Poll for wallet connection (fallback mechanism)
  let lastConnectedAccount = null;
  setInterval(() => {
    if (window.connectedAccount !== lastConnectedAccount) {
      lastConnectedAccount = window.connectedAccount;
      console.debug('[WALLET-BALANCE] Wallet state changed:', window.connectedAccount ? 'Connected' : 'Disconnected');
      if (window.connectedAccount) {
        const mintTab = document.getElementById('tab-mint');
        if (mintTab && mintTab.classList.contains('active')) {
          updateWalletBalanceDisplay();
        }
      } else {
        const card = document.getElementById('walletBalanceCard');
        if (card) card.style.display = 'none';
      }
    }
  }, 1000);

  // Initial update if wallet is already connected
  setTimeout(() => {
    if (window.connectedAccount) {
      console.debug('[WALLET-BALANCE] Initial update with connected account:', window.connectedAccount);
      updateWalletBalanceDisplay();
    } else {
      console.debug('[WALLET-BALANCE] No wallet connected yet');
    }
  }, 500);

  console.debug('[WALLET-BALANCE] Display initialized');
}

// Initialize on DOM ready
console.log('[WALLET-BALANCE] Script loaded, readyState:', document.readyState);
if (document.readyState === 'loading') {
  console.log('[WALLET-BALANCE] Waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', initWalletBalanceDisplay);
} else {
  console.log('[WALLET-BALANCE] DOM already ready, initializing now...');
  initWalletBalanceDisplay();
}

// Expose to global scope
window.updateWalletBalanceDisplay = updateWalletBalanceDisplay;

// Log that script is fully loaded
console.log('[WALLET-BALANCE] Script fully loaded and exposed to window');
console.log('[WALLET-BALANCE] Available functions:', {
  updateWalletBalanceDisplay: typeof window.updateWalletBalanceDisplay,
  CHAIN_CURRENCY_SYMBOLS: typeof CHAIN_CURRENCY_SYMBOLS
});

// Add a debug function to manually show the card for testing
window.debugShowBalanceCard = function() {
  console.log('[WALLET-BALANCE] === DEBUG: Manually showing card ===');
  const card = document.getElementById('walletBalanceCard');
  if (card) {
    card.style.display = 'block';
    console.log('[WALLET-BALANCE] Card display set to block');
    console.log('[WALLET-BALANCE] Card computed style:', window.getComputedStyle(card).display);
    console.log('[WALLET-BALANCE] Card offsetParent:', card.offsetParent);
    console.log('[WALLET-BALANCE] Card getBoundingClientRect:', card.getBoundingClientRect());
  } else {
    console.error('[WALLET-BALANCE] Card element not found!');
    console.log('[WALLET-BALANCE] Looking for element with ID: walletBalanceCard');
    console.log('[WALLET-BALANCE] All elements with wallet in ID:',
      Array.from(document.querySelectorAll('[id*="wallet"]')).map(el => el.id));
  }
  console.log('[WALLET-BALANCE] Window state:', {
    connectedAccount: window.connectedAccount,
    web3Wallet: !!window.web3Wallet,
    ethereum: !!window.ethereum
  });
};

console.log('[WALLET-BALANCE] Debug function available: window.debugShowBalanceCard()');
console.log('[WALLET-BALANCE] Manual update available: window.updateWalletBalanceDisplay()');
