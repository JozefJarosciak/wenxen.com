// Chain-aware storage utilities
// Manages localStorage with chain-specific prefixes

import { chainManager } from '../config/chainConfig.js';

class ChainStorage {
  constructor() {
    this.cache = new Map();
  }

  // Get chain-specific key
  getKey(baseKey, useChainPrefix = true) {
    if (!useChainPrefix) return baseKey;
    return chainManager.getStorageKey(baseKey);
  }

  // Set item with optional chain prefix
  setItem(key, value, useChainPrefix = true) {
    const storageKey = this.getKey(key, useChainPrefix);
    
    try {
      const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
      localStorage.setItem(storageKey, serialized);
      this.cache.set(storageKey, value);
      return true;
    } catch (error) {
      console.error(`Failed to save ${storageKey}:`, error);
      return false;
    }
  }

  // Get item with optional chain prefix
  getItem(key, useChainPrefix = true, parseJSON = false) {
    const storageKey = this.getKey(key, useChainPrefix);
    
    // Check cache first
    if (this.cache.has(storageKey)) {
      return this.cache.get(storageKey);
    }
    
    try {
      const value = localStorage.getItem(storageKey);
      if (value === null) return null;
      
      if (parseJSON) {
        try {
          const parsed = JSON.parse(value);
          this.cache.set(storageKey, parsed);
          return parsed;
        } catch {
          return value;
        }
      }
      
      this.cache.set(storageKey, value);
      return value;
    } catch (error) {
      console.error(`Failed to get ${storageKey}:`, error);
      return null;
    }
  }

  // Remove item with optional chain prefix
  removeItem(key, useChainPrefix = true) {
    const storageKey = this.getKey(key, useChainPrefix);
    
    try {
      localStorage.removeItem(storageKey);
      this.cache.delete(storageKey);
      return true;
    } catch (error) {
      console.error(`Failed to remove ${storageKey}:`, error);
      return false;
    }
  }

  // Clear all items for current chain
  clearChainData() {
    const chain = chainManager.getCurrentChain();
    const prefix = `${chain}_`;
    
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      this.cache.delete(key);
    });
    
    console.log(`Cleared ${keysToRemove.length} items for chain ${chain}`);
    return keysToRemove.length;
  }

  // Migrate data from non-chain-specific to chain-specific keys
  migrateToChainStorage(keys) {
    const chain = chainManager.getCurrentChain();
    let migrated = 0;
    
    keys.forEach(key => {
      const oldValue = localStorage.getItem(key);
      if (oldValue !== null) {
        const newKey = this.getKey(key, true);
        
        // Only migrate if new key doesn't exist
        if (!localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, oldValue);
          migrated++;
          console.log(`Migrated ${key} to ${newKey}`);
        }
      }
    });
    
    return migrated;
  }

  // Get all keys for current chain
  getChainKeys() {
    const chain = chainManager.getCurrentChain();
    const prefix = `${chain}_`;
    const keys = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }
    
    return keys;
  }

  // Batch operations
  setMultiple(items, useChainPrefix = true) {
    const results = {};
    
    Object.entries(items).forEach(([key, value]) => {
      results[key] = this.setItem(key, value, useChainPrefix);
    });
    
    return results;
  }

  getMultiple(keys, useChainPrefix = true, parseJSON = false) {
    const results = {};
    
    keys.forEach(key => {
      results[key] = this.getItem(key, useChainPrefix, parseJSON);
    });
    
    return results;
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Export chain data
  exportChainData() {
    const chain = chainManager.getCurrentChain();
    const data = {
      chain,
      timestamp: Date.now(),
      items: {}
    };
    
    const keys = this.getChainKeys();
    keys.forEach(key => {
      data.items[key] = this.getItem(key, true, true);
    });
    
    return data;
  }

  // Import chain data
  importChainData(data) {
    if (!data || !data.items) {
      throw new Error('Invalid import data');
    }
    
    const currentChain = chainManager.getCurrentChain();
    if (data.chain && data.chain !== currentChain) {
      console.warn(`Importing data from ${data.chain} to ${currentChain}`);
    }
    
    let imported = 0;
    Object.entries(data.items).forEach(([key, value]) => {
      if (this.setItem(key, value, true)) {
        imported++;
      }
    });
    
    return imported;
  }
}

// Create singleton instance
export const chainStorage = new ChainStorage();

// Convenience functions
export function saveChainData(key, value) {
  return chainStorage.setItem(key, value, true);
}

export function loadChainData(key, parseJSON = false) {
  return chainStorage.getItem(key, true, parseJSON);
}

export function removeChainData(key) {
  return chainStorage.removeItem(key, true);
}

export function saveGlobalData(key, value) {
  return chainStorage.setItem(key, value, false);
}

export function loadGlobalData(key, parseJSON = false) {
  return chainStorage.getItem(key, false, parseJSON);
}

// Migrate existing non-chain-specific data on module load
export function migrateExistingData() {
  const keysToMigrate = [
    'trackedAddresses',
    'customRPC',
    'lastScanBlock',
    'scanHistory',
    'userPreferences',
    'savedFilters',
    'tableSettings'
  ];
  
  const migrated = chainStorage.migrateToChainStorage(keysToMigrate);
  if (migrated > 0) {
    console.log(`Migrated ${migrated} items to chain-specific storage`);
  }
}

// Make available globally
window.chainStorage = chainStorage;

export default chainStorage;