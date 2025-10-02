// String utilities - shared string manipulation and formatting functions
export const stringUtils = {
  // Clean and normalize hex addresses
  cleanHexAddr(addr) {
    return String(addr || "").trim().toLowerCase();
  },

  // Pad address for topic filtering
  padTopicAddress(addr) {
    return "0x" + "0".repeat(24) + addr.replace(/^0x/, "").toLowerCase();
  },

  // Parse number with loose validation
  parseNumLoose(value) {
    if (value == null || typeof value === 'object') return NaN;
    const str = String(value).replace(/[,_]/g, '').replace(/[^\d.\-]/g, '');
    return parseFloat(str);
  },

  // Format numbers in human-readable short form
  formatShortNumber(n) {
    if (n === null || n === undefined || n === '') return '';
    const v = Number(String(n).replace(/[^0-9.]/g, ''));
    if (!isFinite(v)) return '';
    const abs = Math.abs(v);
    if (abs >= 1e12) return (v / 1e12).toFixed(2).replace(/\.00$/, '') + 'T';
    if (abs >= 1e9) return (v / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (abs >= 1e6) return (v / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (abs >= 1e3) return (v / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
    return v.toString();
  },

  // Format USD currency
  formatUSD(amount) {
    if (!Number.isFinite(amount)) return "$0.00";
    // Use 2 decimals by default, unless value is <0.01 (which needs more precision)
    const decimals = (amount > 0 && amount < 0.01) ? 6 : 2;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals
    }).format(amount);
  },

  // Extract JSON from data URI
  extractJsonFromDataUri(uri) {
    try {
      if (typeof uri !== 'string') return {};
      if (uri.startsWith('data:application/json;base64,')) {
        const b64 = uri.split('base64,')[1] || '';
        const json = atob(b64);
        return JSON.parse(json);
      }
      if (uri.startsWith('data:application/json,')) {
        const raw = decodeURIComponent(uri.split('data:application/json,')[1] || '{}');
        return JSON.parse(raw);
      }
      if (uri.trim().startsWith('{')) return JSON.parse(uri);
    } catch (e) {}
    return {};
  },

  // Find attribute by name in attributes array
  findAttr(attrs, nameLike) {
    if (!Array.isArray(attrs)) return null;
    const key = String(nameLike).toLowerCase();
    const hit = attrs.find(a => String(a?.trait_type || '').toLowerCase().includes(key));
    return hit || null;
  },

  // Truncate text with ellipsis
  truncate(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  },

  // Capitalize first letter
  capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // Generate short address display (0x1234...abcd)
  shortAddr(addr) {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  },

  // Validate Ethereum address format
  isValidEthAddress(addr) {
    if (!addr || typeof addr !== 'string') return false;
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  },

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Legacy global functions for backward compatibility
window.cleanHexAddr = stringUtils.cleanHexAddr;
window.padTopicAddress = stringUtils.padTopicAddress;
window.parseNumLoose = stringUtils.parseNumLoose;
window.formatShortNumber = stringUtils.formatShortNumber;
window.formatUSD = stringUtils.formatUSD;
window.extractJsonFromDataUri = stringUtils.extractJsonFromDataUri;
window.findAttr = stringUtils.findAttr;