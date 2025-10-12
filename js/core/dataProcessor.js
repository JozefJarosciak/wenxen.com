// Data Processing Module - handles formatting, calculations, and API interactions
// Extracted from main_app.js for modular architecture

// ===== Constants and Global Variables =====
let xenUsdPrice = null;
let xenPriceLast = { ok: false, price: null, ts: null, source: null };

// ===== Utility Functions =====

// Remove 0x prefix from hex strings
const no0x = (s) => String(s).replace(/^0x/i, '');
const isHex = (s) => /^0x[0-9a-fA-F]*$/.test(s);
const ensureBytes = (s) => (isHex(s) ? s : ('0x' + Buffer.from(String(s), 'utf8').toString('hex')));

// ===== Formatting Functions =====

// Format numbers for mobile display with abbreviated notation
function formatNumberForMobile(num) {
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) return num.toLocaleString();

  // Mobile: Use abbreviated format
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

// Format address with ellipsis for display
function formatAddress(address) {
  if (address === 'Unknown') return address;
  if (address.length <= 10) return address;
  // Show address in lowercase with ellipsis (addresses are normalized to lowercase)
  return address.slice(0, 6) + '...' + address.slice(-4);
}

// Format very small prices with subscript notation (e.g., $0.0₁₀4410)
function formatTinyPrice(price) {
  if (!Number.isFinite(price)) return 'Unavailable';

  // Convert to string with enough precision
  const priceStr = price.toFixed(20);
  const parts = priceStr.split('.');

  if (parts.length < 2) return `$${price.toFixed(2)}`;

  const fractional = parts[1];

  // Count leading zeros after decimal
  let zeros = 0;
  for (let i = 0; i < fractional.length; i++) {
    if (fractional[i] === '0') {
      zeros++;
    } else {
      break;
    }
  }

  // If less than 4 leading zeros, use normal formatting
  if (zeros < 4) {
    return `$${price.toFixed(Math.min(6, zeros + 3))}`;
  }

  // Find the first 4 significant digits after leading zeros
  const significantPart = fractional.slice(zeros, zeros + 4);

  return `$0.0<sub>${zeros}</sub>${significantPart}`;
}

// Format USD values with appropriate precision
function formatUSD(n) {
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  // If two-decimal rounding would display as $0.00, show four decimals to reveal tiny values
  if (abs > 0 && abs < 0.005) {
    return n.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }
  // Otherwise, standard two-decimal currency
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Format XEN amounts with K/M abbreviation
function formatXenShort(num) {
  if (!Number.isFinite(num)) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return Math.floor(num).toLocaleString();
}

// Format seconds into human-readable time
function formatSeconds(seconds) {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '...';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Format remint date display
function formatRemintDate(termDays) {
  if (!Number.isFinite(termDays) || termDays <= 0) return '';

  const now = new Date();
  const futureDate = new Date(now.getTime() + (termDays * 24 * 60 * 60 * 1000));

  // Format as YYYY-MM-DD
  const year = futureDate.getFullYear();
  const month = String(futureDate.getMonth() + 1).padStart(2, '0');
  const day = String(futureDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// ===== XEN Price Functions =====

// Primary: Dexscreener token/pair endpoint
async function fetchFromDexscreener(tokenAddress) {
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  let url;
  let data;

  if (currentChain === 'BASE') {
    // Base: Use pair endpoint for Base network
    url = `https://api.dexscreener.com/latest/dex/pairs/base/0x6b21b1ed8ecec2ff1c1b4ad6c6b8c90b6b6b9b3d`;
  } else {
    // Ethereum: Use token endpoint
    url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Dexscreener HTTP ${res.status}`);
  data = await res.json();

  let price;
  if (currentChain === 'BASE') {
    // Base: Extract from pair data
    price = parseFloat(data?.pair?.priceUsd || 0);
  } else {
    // Ethereum: Extract from pairs array
    const pairs = data?.pairs || [];
    if (pairs.length === 0) throw new Error('No pairs found');
    price = parseFloat(pairs[0]?.priceUsd || 0);
  }

  if (!price || price <= 0) throw new Error('Invalid price');
  return { price, source: 'Dexscreener' };
}

// Fallback: CoinGecko simple price
async function fetchFromCoinGecko() {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=xen-crypto&vs_currencies=usd';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json();
  const price = parseFloat(data?.['xen-crypto']?.usd || 0);
  if (!price || price <= 0) throw new Error('Invalid price');
  return { price, source: 'CoinGecko' };
}

// Fetch XEN price with fallback
async function fetchXenPrice() {
  try {
    let tokenAddress;
    const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
    if (currentChain === 'BASE') {
      // Use XEN token address on Base
      tokenAddress = window.chainManager?.getContractAddress('XEN') || '0x96B02E3E8e118e76F4d98C6a626D8dA26e7CC298';
    } else {
      // Use XEN token address on Ethereum
      tokenAddress = window.chainManager?.getContractAddress('XEN') || '0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8';
    }

    const primary = await fetchFromDexscreener(tokenAddress);
    xenUsdPrice = primary.price;
    xenPriceLast = { ok: true, price: xenUsdPrice, ts: Date.now(), source: primary.source };
  } catch (e1) {
    try {
      const fb = await fetchFromCoinGecko();
      xenUsdPrice = fb.price;
      xenPriceLast = { ok: true, price: xenUsdPrice, ts: Date.now(), source: fb.source };
    } catch (e2) {
      xenUsdPrice = null;
      xenPriceLast = { ok: false, price: null, ts: Date.now(), source: 'Dexscreener/CoinGecko' };
    }
  }
  // DO NOT auto-update XEN badge - only manual filter clicks and auto-apply "All" should trigger updates
  // This legacy function is not actively used, but keeping consistent with fetchXenUsdPrice()
  updateXenPriceStatus();
  try { updateVmuChart(); } catch {}
}

// Update XEN price status display
function updateXenPriceStatus() {
  const el = document.getElementById('xenPriceStatus');
  if (!el) return;
  if (!xenPriceLast?.ts) {
    el.textContent = 'Price: Not fetched yet';
    return;
  }
  const priceText = Number.isFinite(xenPriceLast.price)
    ? formatTinyPrice(xenPriceLast.price)
    : 'Unavailable';
  // Use innerHTML to render the subscript
  el.innerHTML = `Last refresh (${xenPriceLast.source || '—'}): ${priceText} at ${new Date(xenPriceLast.ts).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}`;
}

// Render XEN USD estimate for total display
function renderXenUsdEstimate(totalBigInt) {
  const el = document.getElementById('estXenUsd');
  if (!el) return;
  if (xenUsdPrice == null) { el.textContent = ''; return; }

  // Totals are in the billions ⇒ safe to cast for multiplication
  const totalNum = Number(totalBigInt);
  const usd = totalNum * xenUsdPrice;
  // Always format with exactly 2 decimal places for estXenUsd display
  const formattedUsd = usd.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  el.textContent = `(${formattedUsd})`;
}

// ===== Data Building Functions =====

// Build claim data for CoinTool transactions
function buildClaimData(minter, xen = null) {
  // Get chain-specific XEN address if not provided
  if (!xen) {
    xen = window.chainManager?.getContractAddress('XEN') || '0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8';
  }

  const xenNo = no0x(xen);
  const minterNo = no0x(minter);

  // fixed pieces copied from the Python code
  const head = '0x59635f6f'                                  // function selector
  const z32 = '0000000000000000000000000000000000000000000000000000000000000000';
  const z28 = '0000000000000000000000000000000000000000000000000000000000';
  const one = '0000000000000000000000000000000000000000000000000000000000000001';

  // XEN contract call data
  const xenCall = '0x1cff79cd'        // claimRank() selector
    + z32.slice(8);                    // padding

  return head                          // bulk3() selector
    + z28 + xenNo                     // target (32-byte XEN address)
    + z32                             // value = 0
    + '00000000000000000000000000000000000000000000000000000000000000c0' // offset to call data
    + one                             // nonce
    + '0000000000000000000000000000000000000000000000000000000000000000' // salt
    + minterNo + z28                  // refund address (minter)
    + '0000000000000000000000000000000000000000000000000000000000000024' // call data length (36 bytes)
    + xenCall;                        // call data
}

// Build remint data for CoinTool transactions
function buildRemintData(minter, manualDays) {
  // Get chain-specific REMINT_HELPER address
  const remintHelper = window.chainManager?.getContractAddress('REMINT_HELPER') || '0x1234567890123456789012345678901234567890'; // fallback
  const helperNo = no0x(remintHelper);
  const minterNo = no0x(minter);

  // 3-digit hex (lowercase), like the Python code (e.g., 100 -> "064")
  const termHex3 = manualDays.toString(16).padStart(3, '0').toLowerCase();

  const head = '0x59635f6f';  // bulk3() selector
  const z32 = '0000000000000000000000000000000000000000000000000000000000000000';
  const z28 = '0000000000000000000000000000000000000000000000000000000000';
  const z29 = '00000000000000000000000000000000000000000000000000000000000';
  const one = '0000000000000000000000000000000000000000000000000000000000000001';

  return head                    // bulk3() selector
    + z28 + helperNo            // target (32-byte REMINT_HELPER address)
    + z32                       // value = 0
    + '00000000000000000000000000000000000000000000000000000000000000c0' // offset to call data
    + one                       // nonce
    + z32                       // salt
    + minterNo + z28            // refund address (minter)
    + '0000000000000000000000000000000000000000000000000000000000000044' // call data length (68 bytes)
    + '40c10f19'                // mint(address,uint256) selector
    + z28 + minterNo            // to address (minter)
    + z29 + termHex3;           // amount (manual_max_term in low 3 hex digits)
}

// ===== Chart Data Processing =====

// Group XEN USD data by date for charts
function groupXenUsdByDate(rows) {
  const price = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0) ? xenUsdPrice : null;
  const map = {};
  for (const r of rows) {
    const key = (typeof window.rowToLocalKey === 'function') ? window.rowToLocalKey(r) : (function(){
      const t = Number(r?.Maturity_Timestamp || 0);
      return Number.isFinite(t) && t > 0 ? getLocalDateString(new Date(t * 1000)) : (r?.maturityDateOnly || '');
    })();
    if (!key) continue;
    const xen = Number(r?.XEN || 0);
    if (!Number.isFinite(xen) || xen <= 0) continue;
    const usd = price ? xen * price : 0;
    map[key] = (map[key] || 0) + usd;
  }
  const dates = Object.keys(map).sort();
  console.debug('[VMU-CHART] groupXenUsdByDate days=', dates.length, 'price=', price, 'sample=', dates.slice(0,3).map(d=>({d, v: map[d]})));
  return { dates, values: dates.map(d => map[d]) };
}

// Group XEN USD data by date and type for stacked charts
function groupXenUsdByDateAndType(rows) {
  const price = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0) ? xenUsdPrice : null;
  const typeMap = {};
  const types = (window.innerWidth <= 768) ? ['CT', 'XNFT', 'S.XNFT', 'Stk'] : ['Cointool', 'XENFT', 'Stake XENFT', 'Stake'];

  for (const r of rows) {
    const key = (typeof window.rowToLocalKey === 'function') ? window.rowToLocalKey(r) : (function(){
      const t = Number(r?.Maturity_Timestamp || 0);
      return Number.isFinite(t) && t > 0 ? getLocalDateString(new Date(t * 1000)) : (r?.maturityDateOnly || '');
    })();
    if (!key) continue;

    const xen = Number(r?.XEN || 0);
    if (!Number.isFinite(xen) || xen <= 0) continue;

    const usd = price ? xen * price : 0;
    let sourceType = String(r?.SourceType || 'Cointool');

    // Map type names for mobile
    if (window.innerWidth <= 768) {
      if (sourceType === 'Cointool') sourceType = 'CT';
      else if (sourceType === 'XENFT') sourceType = 'XNFT';
      else if (sourceType === 'Stake XENFT') sourceType = 'S.XNFT';
      else if (sourceType === 'Stake') sourceType = 'Stk';
    }

    if (!typeMap[sourceType]) typeMap[sourceType] = {};
    typeMap[sourceType][key] = (typeMap[sourceType][key] || 0) + usd;
  }

  const allDates = new Set();
  Object.values(typeMap).forEach(dateMap => {
    Object.keys(dateMap).forEach(date => allDates.add(date));
  });

  const dates = Array.from(allDates).sort();
  const series = types.map(type => ({
    name: type,
    data: dates.map(date => typeMap[type]?.[date] || 0)
  }));

  return { dates, seriesData: series };
}

// Get local date string helper
function getLocalDateString(date) {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
}

// ===== Export Module Functions =====
export const dataProcessor = {
  // Utility functions
  no0x,
  isHex,
  ensureBytes,

  // Formatting functions
  formatNumberForMobile,
  formatAddress,
  formatTinyPrice,
  formatUSD,
  formatXenShort,
  formatSeconds,
  formatRemintDate,

  // Price functions
  fetchXenPrice,
  updateXenPriceStatus,
  renderXenUsdEstimate,
  fetchFromDexscreener,
  fetchFromCoinGecko,

  // Data building
  buildClaimData,
  buildRemintData,

  // Chart data processing
  groupXenUsdByDate,
  groupXenUsdByDateAndType,
  getLocalDateString,

  // Price data access
  getXenPrice: () => xenUsdPrice,
  getXenPriceLast: () => xenPriceLast,
  setXenPrice: (price) => { xenUsdPrice = price; },
  setXenPriceLast: (data) => { xenPriceLast = data; }
};

// ===== Global Function Exports for Backward Compatibility =====
window.formatNumberForMobile = formatNumberForMobile;
window.formatAddress = formatAddress;
window.formatTinyPrice = formatTinyPrice;
window.formatUSD = formatUSD;
window.formatXenShort = formatXenShort;
window.formatSeconds = formatSeconds;
window._formatRemintDate = formatRemintDate;
window.fetchXenPrice = fetchXenPrice;
window.updateXenPriceStatus = updateXenPriceStatus;
window.renderXenUsdEstimate = renderXenUsdEstimate;
window.fetchFromDexscreener = fetchFromDexscreener;
window.fetchFromCoinGecko = fetchFromCoinGecko;
window.buildClaimData = buildClaimData;
window.buildRemintData = buildRemintData;
window._groupXenUsdByDate = groupXenUsdByDate;
window._groupXenUsdByDateAndType = groupXenUsdByDateAndType;
window.no0x = no0x;
window.isHex = isHex;
window.ensureBytes = ensureBytes;
window.getLocalDateString = getLocalDateString;
window.rowToLocalKey = (r) => {
  const t = Number(r?.Maturity_Timestamp || 0);
  return Number.isFinite(t) && t > 0 ? getLocalDateString(new Date(t * 1000)) : (r?.maturityDateOnly || '');
};

// Legacy globals for price access
Object.defineProperty(window, 'xenUsdPrice', {
  get: () => xenUsdPrice,
  set: (value) => { xenUsdPrice = value; }
});

Object.defineProperty(window, 'xenPriceLast', {
  get: () => xenPriceLast,
  set: (value) => { xenPriceLast = value; }
});

export default dataProcessor;