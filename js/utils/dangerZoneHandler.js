// Danger Zone Handler - Handles database and storage deletion
export class DangerZoneHandler {
  constructor() {
    this.chainManager = null;
  }

  initialize() {
    this.chainManager = window.chainManager;
    this.setupEventListener();
  }

  setupEventListener() {
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.handleReset());
    }
  }

  async handleReset() {
    const sel = document.getElementById("resetDbSelect");
    const choice = (sel && sel.value) ? sel.value : "all";
    
    // Get current chain info
    const currentChain = this.chainManager?.getCurrentChain() || 'ETHEREUM';
    const chainPrefix = currentChain === 'BASE' ? 'BASE_' : 'ETH_';
    const chainName = currentChain === 'BASE' ? 'Base' : 'Ethereum';
    
    console.log(`Danger Zone: Processing ${choice} for chain ${currentChain}`);
    
    // Handle different choices
    switch(choice) {
      case 'all-with-storage':
        await this.deleteAllDataAndStorage(chainPrefix, chainName);
        break;
      case 'all':
        await this.deleteAllChainDatabases(chainPrefix, chainName);
        break;
      case 'storage-only':
        await this.deleteStorageOnly(chainPrefix, chainName);
        break;
      default:
        // Specific database deletion
        await this.deleteSpecificDatabase(choice);
        break;
    }
  }

  async deleteAllDataAndStorage(chainPrefix, chainName) {
    const confirmed = confirm(
      `⚠️ WARNING: This will delete ALL ${chainName} data AND settings!\n\n` +
      `This includes:\n` +
      `• All ${chainName} databases\n` +
      `• All ${chainName} settings (addresses, API keys, etc.)\n` +
      `• All ${chainName} preferences\n\n` +
      `This action cannot be undone. Continue?`
    );
    
    if (!confirmed) return;
    
    // Close all database connections
    await this.closeAllConnections();
    
    // Delete chain-specific databases
    const databasesToDelete = [
      `${chainPrefix}DB_Cointool`,
      `${chainPrefix}DB_Xenft`,
      `${chainPrefix}DB_XenStake`,
      `${chainPrefix}DB_XenftStake`
    ];
    
    console.log(`Deleting databases: ${databasesToDelete.join(', ')}`);
    
    const dbResults = await Promise.allSettled(
      databasesToDelete.map(db => this.deleteDatabaseByName(db))
    );
    
    // Check for blocked databases
    const blocked = dbResults.some(r => r.status === 'fulfilled' && r.value === 'blocked');
    if (blocked) {
      alert("Some databases could not be deleted because another tab or window is using them. Please close other tabs and try again.");
      return;
    }
    
    // Clear chain-specific localStorage
    this.clearChainLocalStorage(chainPrefix);
    
    alert(`✅ All ${chainName} data and settings have been deleted.`);
    window.location.reload();
  }

  async deleteAllChainDatabases(chainPrefix, chainName) {
    const confirmed = confirm(
      `Are you sure you want to delete all ${chainName} databases?\n\n` +
      `This will delete:\n` +
      `• ${chainPrefix}DB_Cointool (mints)\n` +
      `• ${chainPrefix}DB_Xenft (NFTs)\n` +
      `• ${chainPrefix}DB_XenStake (XEN stakes)\n` +
      `• ${chainPrefix}DB_XenftStake (XENFT stakes)\n\n` +
      `Your settings will be preserved. This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    // Close all database connections
    await this.closeAllConnections();
    
    // Delete chain-specific databases
    const databasesToDelete = [
      `${chainPrefix}DB_Cointool`,
      `${chainPrefix}DB_Xenft`,
      `${chainPrefix}DB_XenStake`,
      `${chainPrefix}DB_XenftStake`
    ];
    
    console.log(`Deleting databases: ${databasesToDelete.join(', ')}`);
    
    const results = await Promise.allSettled(
      databasesToDelete.map(db => this.deleteDatabaseByName(db))
    );
    
    const blocked = results.some(r => r.status === 'fulfilled' && r.value === 'blocked');
    if (blocked) {
      alert("Some databases could not be deleted because another tab or window is using them. Please close other tabs and try again.");
      return;
    }
    
    alert(`✅ All ${chainName} databases have been deleted. Settings preserved.`);
    window.location.reload();
  }

  async deleteStorageOnly(chainPrefix, chainName) {
    const confirmed = confirm(
      `Are you sure you want to delete ${chainName} settings only?\n\n` +
      `This will clear:\n` +
      `• Addresses\n` +
      `• RPC settings\n` +
      `• Scan preferences\n` +
      `• Other ${chainName}-specific settings\n\n` +
      `Your database data will be preserved. Continue?`
    );
    
    if (!confirmed) return;
    
    // Clear chain-specific localStorage
    this.clearChainLocalStorage(chainPrefix);
    
    alert(`✅ ${chainName} settings have been cleared. Database data preserved.`);
    window.location.reload();
  }

  async deleteSpecificDatabase(dbName) {
    // Determine if it's a chain-specific database
    let displayName = dbName;
    let description = '';
    
    if (dbName.startsWith('ETH_')) {
      const baseName = dbName.replace('ETH_', '');
      displayName = `Ethereum ${this.getFriendlyName(baseName)}`;
      description = this.getDbDescription(baseName);
    } else if (dbName.startsWith('BASE_')) {
      const baseName = dbName.replace('BASE_', '');
      displayName = `Base ${this.getFriendlyName(baseName)}`;
      description = this.getDbDescription(baseName);
    } else {
      displayName = this.getFriendlyName(dbName);
      description = this.getDbDescription(dbName);
    }
    
    const confirmed = confirm(
      `Are you sure you want to delete ${displayName}?\n\n` +
      `${description}\n\n` +
      `This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    // Close specific database connection if needed
    await this.closeSpecificConnection(dbName);
    
    const result = await this.deleteDatabaseByName(dbName);
    
    if (result === 'blocked') {
      alert(`${displayName} could not be deleted because another tab or window is using it. Please close other tabs and try again.`);
      return;
    }
    
    alert(`✅ ${displayName} has been deleted.`);
    window.location.reload();
  }

  getFriendlyName(dbName) {
    switch(dbName) {
      case 'DB_Cointool': return 'Cointool';
      case 'DB_Xenft': return 'XENFT';
      case 'DB_XenStake': return 'XEN Stake';
      case 'DB_XenftStake': return 'XENFT Stake';
      default: return dbName;
    }
  }

  getDbDescription(dbName) {
    switch(dbName) {
      case 'DB_Cointool': return 'This contains all your XEN mint records and scan history.';
      case 'DB_Xenft': return 'This contains all your XENFT NFT records.';
      case 'DB_XenStake': return 'This contains all your regular XEN stake records.';
      case 'DB_XenftStake': return 'This contains all your XENFT stake records.';
      default: return 'This contains application data.';
    }
  }

  clearChainLocalStorage(chainPrefix) {
    console.log(`Clearing localStorage for prefix: ${chainPrefix}`);
    
    // List of keys to remove
    const keysToRemove = [];
    
    // Find all keys with the chain prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(chainPrefix)) {
        keysToRemove.push(key);
      }
    }
    
    // Also include chain-specific keys without database prefix
    const chainSpecificKeys = [
      `${chainPrefix.replace('_', '')}_ethAddress`,
      `${chainPrefix.replace('_', '')}_customRPC`,
      `${chainPrefix.replace('_', '')}_chunkSize`,
      `${chainPrefix.replace('_', '')}_mintTermDays`,
      `${chainPrefix.replace('_', '')}_scanMode`,
      `${chainPrefix.replace('_', '')}_vmuChartExpanded`
    ];
    
    // Add alternative format keys
    if (chainPrefix === 'ETH_') {
      chainSpecificKeys.push(
        'ETHEREUM_ethAddress',
        'ETHEREUM_customRPC',
        'ETHEREUM_chunkSize',
        'ETHEREUM_mintTermDays',
        'ETHEREUM_scanMode',
        'ETHEREUM_vmuChartExpanded'
      );
    } else if (chainPrefix === 'BASE_') {
      chainSpecificKeys.push(
        'BASE_ethAddress',
        'BASE_customRPC',
        'BASE_chunkSize',
        'BASE_mintTermDays',
        'BASE_scanMode',
        'BASE_vmuChartExpanded'
      );
    }
    
    // Combine all keys
    const allKeys = [...new Set([...keysToRemove, ...chainSpecificKeys])];
    
    // Remove all identified keys
    allKeys.forEach(key => {
      console.log(`Removing localStorage key: ${key}`);
      localStorage.removeItem(key);
    });
    
    console.log(`Cleared ${allKeys.length} localStorage keys`);
  }

  async closeAllConnections() {
    // Close any open database connections
    try { if (window.dbInstance) window.dbInstance.close(); } catch(e) {}
    try {
      if (window.xenft?.openDB) {
        const xf = await window.xenft.openDB();
        try { xf.close(); } catch(e) {}
      }
    } catch(e) {}
    try {
      if (window.xenftStake?.openDB) {
        const stakeDb = await window.xenftStake.openDB();
        try { stakeDb.close(); } catch(e) {}
      }
    } catch(e) {}
    try {
      if (window.xenStake?.openDB) {
        const xsDb = await window.xenStake.openDB();
        try { xsDb.close(); } catch(e) {}
      }
    } catch(e) {}
  }

  async closeSpecificConnection(dbName) {
    try {
      if (dbName.includes('Cointool') && window.dbInstance) {
        window.dbInstance.close();
      } else if (dbName.includes('Xenft') && !dbName.includes('Stake') && window.xenft?.openDB) {
        const xf = await window.xenft.openDB();
        try { xf.close(); } catch(e) {}
      } else if (dbName.includes('XenftStake') && window.xenftStake?.openDB) {
        const stakeDb = await window.xenftStake.openDB();
        try { stakeDb.close(); } catch(e) {}
      } else if (dbName.includes('XenStake') && window.xenStake?.openDB) {
        const xsDb = await window.xenStake.openDB();
        try { xsDb.close(); } catch(e) {}
      }
    } catch(e) {
      console.warn(`Could not close connection for ${dbName}:`, e);
    }
  }

  deleteDatabaseByName(name) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => {
          console.log(`Successfully deleted database: ${name}`);
          resolve('success');
        };
        req.onerror = (e) => {
          console.error(`Error deleting database ${name}:`, e);
          resolve('error');
        };
        req.onblocked = () => {
          console.warn(`Database ${name} deletion blocked`);
          resolve('blocked');
        };
      } catch (e) {
        console.error(`Exception deleting database ${name}:`, e);
        resolve('error');
      }
    });
  }
}

// Create and export singleton
export const dangerZoneHandler = new DangerZoneHandler();

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      dangerZoneHandler.initialize();
    });
  } else {
    // DOM already loaded
    setTimeout(() => dangerZoneHandler.initialize(), 100);
  }
}