// Math utilities - shared mathematical operations and calculations
export const mathUtils = {
  // Convert Wei to Ether (18 decimals)
  weiToEther(wei) {
    if (!wei) return "0";
    try {
      return window.Web3.utils.fromWei(String(wei), 'ether');
    } catch {
      // Fallback calculation
      const BN = window.Web3.utils.toBN;
      const weiStr = String(wei);
      const weiBN = BN(weiStr);
      const etherBN = weiBN.div(BN('1000000000000000000'));
      return etherBN.toString();
    }
  },

  // Convert Ether to Wei (18 decimals)
  etherToWei(ether) {
    if (!ether) return "0";
    try {
      return window.Web3.utils.toWei(String(ether), 'ether');
    } catch {
      // Fallback calculation
      const BN = window.Web3.utils.toBN;
      const etherStr = String(ether);
      const etherBN = BN(etherStr);
      const weiBN = etherBN.mul(BN('1000000000000000000'));
      return weiBN.toString();
    }
  },

  // Calculate APY at given timestamp (XEN staking formula)
  calculateAPY(timestamp, genesisTs = 1665187200, secondsInDay = 86400) {
    const START = 20;
    const END = 2;
    const STEP = 90 * secondsInDay;
    const decay = Math.floor(Math.max(0, timestamp - genesisTs) / STEP);
    const apy = START - decay;
    return apy < END ? END : apy;
  },

  // Calculate stake rewards
  calculateStakeReward(principalWei, apy, termDays) {
    if (!principalWei || !apy || !termDays) return "0";
    try {
      const BN = window.Web3.utils.toBN;
      const principal = BN(String(principalWei));
      const apyPercent = Number(apy) / 100;
      const termRatio = Number(termDays) / 365;
      const rewardRatio = apyPercent * termRatio;
      
      // Calculate reward: principal * (apy/100) * (termDays/365)
      const rewardWei = principal.mul(BN(Math.floor(rewardRatio * 1e18))).div(BN('1000000000000000000'));
      return rewardWei.toString();
    } catch (error) {
      console.warn('Failed to calculate stake reward:', error);
      return "0";
    }
  },

  // Safe number parsing with fallback
  parseNumber(value, defaultValue = 0) {
    if (value === null || value === undefined) return defaultValue;
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
  },

  // Clamp number between min and max
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  // Round to specified decimal places
  round(value, decimals = 0) {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  },

  // Calculate percentage
  percentage(value, total) {
    if (!total || total === 0) return 0;
    return (value / total) * 100;
  },

  // Generate random integer between min and max (inclusive)
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // Calculate compound interest
  compoundInterest(principal, rate, time, frequency = 1) {
    return principal * Math.pow(1 + rate / frequency, frequency * time);
  },

  // Sum array of numbers
  sum(numbers) {
    return numbers.reduce((acc, num) => acc + (Number(num) || 0), 0);
  },

  // Calculate average of array
  average(numbers) {
    if (!numbers.length) return 0;
    return this.sum(numbers) / numbers.length;
  },

  // Format number with thousands separators
  formatNumber(num, decimals = 0) {
    const value = Number(num);
    if (!Number.isFinite(value)) return '0';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
};

// BigNumber utilities for high precision calculations
export const bigNumberUtils = {
  // Safe BigNumber operations
  add(a, b) {
    try {
      const BN = window.Web3.utils.toBN;
      return BN(String(a)).add(BN(String(b))).toString();
    } catch {
      return String(Number(a) + Number(b));
    }
  },

  subtract(a, b) {
    try {
      const BN = window.Web3.utils.toBN;
      return BN(String(a)).sub(BN(String(b))).toString();
    } catch {
      return String(Number(a) - Number(b));
    }
  },

  multiply(a, b) {
    try {
      const BN = window.Web3.utils.toBN;
      return BN(String(a)).mul(BN(String(b))).toString();
    } catch {
      return String(Number(a) * Number(b));
    }
  },

  divide(a, b) {
    try {
      const BN = window.Web3.utils.toBN;
      return BN(String(a)).div(BN(String(b))).toString();
    } catch {
      return String(Number(a) / Number(b));
    }
  },

  compare(a, b) {
    try {
      const BN = window.Web3.utils.toBN;
      const aBN = BN(String(a));
      const bBN = BN(String(b));
      if (aBN.gt(bBN)) return 1;
      if (aBN.lt(bBN)) return -1;
      return 0;
    } catch {
      const aNum = Number(a);
      const bNum = Number(b);
      if (aNum > bNum) return 1;
      if (aNum < bNum) return -1;
      return 0;
    }
  },

  max(a, b) {
    return this.compare(a, b) >= 0 ? String(a) : String(b);
  },

  min(a, b) {
    return this.compare(a, b) <= 0 ? String(a) : String(b);
  }
};

// Legacy global functions for backward compatibility
window.calculateAPY = mathUtils.calculateAPY;
window.parseNumber = mathUtils.parseNumber;