// Storage utilities - shared localStorage operations and data persistence
export const storageUtils = {
  // Safely get item from localStorage
  getItem(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value !== null ? value : defaultValue;
    } catch (error) {
      console.warn(`Failed to get localStorage item ${key}:`, error);
      return defaultValue;
    }
  },

  // Safely set item in localStorage
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`Failed to set localStorage item ${key}:`, error);
      return false;
    }
  },

  // Safely remove item from localStorage
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove localStorage item ${key}:`, error);
      return false;
    }
  },

  // Get JSON object from localStorage
  getJSON(key, defaultValue = {}) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.warn(`Failed to parse JSON from localStorage item ${key}:`, error);
      return defaultValue;
    }
  },

  // Set JSON object to localStorage
  setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Failed to stringify JSON to localStorage item ${key}:`, error);
      return false;
    }
  },

  // Check if localStorage is available
  isAvailable() {
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  },

  // Clear all localStorage data (with confirmation)
  clearAll() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
      return false;
    }
  },

  // Get all keys matching a pattern
  getKeys(pattern = null) {
    try {
      const keys = Object.keys(localStorage);
      if (pattern) {
        const regex = new RegExp(pattern);
        return keys.filter(key => regex.test(key));
      }
      return keys;
    } catch (error) {
      console.warn('Failed to get localStorage keys:', error);
      return [];
    }
  },

  // Get storage size estimation
  getStorageSize() {
    try {
      let total = 0;
      Object.keys(localStorage).forEach(key => {
        total += localStorage[key].length + key.length;
      });
      return total;
    } catch (error) {
      console.warn('Failed to calculate storage size:', error);
      return 0;
    }
  }
};

// Theme-specific storage utilities
export const themeStorage = {
  getStoredTheme() {
    try {
      const theme = localStorage.getItem('theme');
      // Back-compat: treat legacy 'system' as dark by default
      if (theme === 'system' || !theme) return 'dark';
      return (theme === 'light' || theme === 'dark' || theme === 'retro' || theme === 'matrix') ? theme : 'dark';
    } catch {
      return 'dark';
    }
  },

  storeTheme(theme) {
    try {
      localStorage.setItem('theme', (theme === 'light' || theme === 'retro' || theme === 'matrix') ? theme : 'dark');
      return true;
    } catch {
      return false;
    }
  }
};

// Privacy and onboarding storage utilities
export const privacyStorage = {
  isPrivacyAccepted() {
    try {
      return localStorage.getItem('privacyAccepted') === '1';
    } catch {
      return false;
    }
  },

  setPrivacyAccepted(accepted) {
    try {
      localStorage.setItem('privacyAccepted', accepted ? '1' : '0');
      return true;
    } catch {
      return false;
    }
  },

  isSetupComplete() {
    try {
      const ethAddress = localStorage.getItem('ethAddress');
      const etherscanApiKey = localStorage.getItem('etherscanApiKey');
      return !!(ethAddress && ethAddress.trim() && etherscanApiKey && etherscanApiKey.trim());
    } catch {
      return false;
    }
  }
};

// Settings storage utilities
export const settingsStorage = {
  getAddresses() {
    const text = storageUtils.getItem('ethAddress', '').trim();
    return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  },

  getRPCList() {
    const raw = storageUtils.getItem('customRPC', 'https://ethereum-rpc.publicnode.com');
    return String(raw).split(/\s+|\n+/).map(s => s.trim()).filter(Boolean);
  },

  getApiKey() {
    return storageUtils.getItem('etherscanApiKey', '').trim();
  }
};

// Legacy global functions for backward compatibility
window.getStoredTheme = themeStorage.getStoredTheme;
window.storeTheme = themeStorage.storeTheme;
window.isPrivacyAccepted = privacyStorage.isPrivacyAccepted;
window.isSetupComplete = privacyStorage.isSetupComplete;