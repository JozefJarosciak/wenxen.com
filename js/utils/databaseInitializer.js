// Database Initializer - Creates all chain-specific databases on first load
(function() {
  
  // Database schemas for each scanner type
  const DATABASE_SCHEMAS = {
    'cointool': {
      version: 3,
      stores: {
        'mints': { keyPath: 'ID' },
        'scanState': { keyPath: 'address' },
        'actionsCache': { keyPath: 'address' }
      }
    },
    'xenft': {
      version: 3,
      stores: {
        'xenfts': { keyPath: 'Xenft_id' },
        'scanState': { keyPath: 'address' },
        'processProgress': { keyPath: 'id' }
      }
    },
    'xenft-stake': {
      version: 2,
      stores: {
        'stakes': { keyPath: 'tokenId' },
        'scanState': { keyPath: 'address' },
        'processProgress': { keyPath: 'address' }
      }
    },
    'xen-stake': {
      version: 1,
      stores: {
        'stakes': { keyPath: 'id', indexes: { 'byOwner': { keyPath: 'owner', unique: false } } },
        'scanState': { keyPath: 'address' }
      }
    }
  };

  // Initialize a single database
  async function initializeDatabase(dbName, schema) {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(dbName, schema.version);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Create stores if they don't exist
          for (const [storeName, storeConfig] of Object.entries(schema.stores)) {
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, { keyPath: storeConfig.keyPath });
              
              // Add indexes if specified
              if (storeConfig.indexes) {
                for (const [indexName, indexConfig] of Object.entries(storeConfig.indexes)) {
                  store.createIndex(indexName, indexConfig.keyPath, { unique: indexConfig.unique || false });
                }
              }
            }
          }
        };
        
        request.onsuccess = () => {
          request.result.close(); // Close immediately after creation
          resolve();
        };
        
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Initialize all databases for a specific chain
  async function initializeChainDatabases(chainPrefix) {
    const results = [];
    
    for (const [dbType, schema] of Object.entries(DATABASE_SCHEMAS)) {
      // Always use manual naming that matches scanner expectations
      let dbName;
      switch(dbType) {
        case 'cointool':
          dbName = `${chainPrefix}_DB_Cointool`;
          break;
        case 'xenft':
          dbName = `${chainPrefix}_DB_Xenft`;
          break;
        case 'xenft-stake':
          dbName = `${chainPrefix}_DB_XenftStake`;
          break;
        case 'xen-stake':
          dbName = `${chainPrefix}_DB_XenStake`;
          break;
        default:
          dbName = `${chainPrefix}_DB_${dbType}`;
      }
      
      try {
        await initializeDatabase(dbName, schema);
        results.push({ dbName, status: 'success' });
        // Database created/verified
      } catch (error) {
        results.push({ dbName, status: 'error', error });
        console.error(`[DatabaseInitializer] Failed to initialize ${dbName}:`, error);
      }
    }
    
    return results;
  }

  // Initialize databases for the current chain
  async function initializeCurrentChainDatabases() {
    try {
      // Get current chain
      const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
      const isEthereum = currentChain === 'ETHEREUM';
      const chainPrefix = isEthereum ? 'ETH' : 'BASE';
      
      // Initializing databases for chain
      const results = await initializeChainDatabases(chainPrefix);
      
      // Log summary
      const successful = results.filter(r => r.status === 'success').length;
      const failed = results.filter(r => r.status === 'error').length;
      
      // Initialization complete
      
      return results;
    } catch (error) {
      console.error('[DatabaseInitializer] Fatal error during initialization:', error);
      return [];
    }
  }

  // Initialize all databases for all chains (useful for migration/setup)
  async function initializeAllChainDatabases() {
    const results = [];
    
    for (const chainPrefix of ['ETH', 'BASE']) {
      // Initializing databases for chain
      const chainResults = await initializeChainDatabases(chainPrefix);
      results.push(...chainResults);
    }
    
    return results;
  }

  // Auto-initialize on page load
  async function autoInitialize() {
    // Wait for chainManager to be ready
    let attempts = 0;
    while (!window.chainManager && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    // Initialize databases for current chain
    await initializeCurrentChainDatabases();
  }

  // Listen for chain switches to initialize new chain databases
  if (window.addEventListener) {
    window.addEventListener('chainChanged', async (event) => {
      // Chain changed, initializing databases
      await initializeCurrentChainDatabases();
    });
  }

  // Export functions
  window.databaseInitializer = {
    initializeDatabase,
    initializeChainDatabases,
    initializeCurrentChainDatabases,
    initializeAllChainDatabases,
    autoInitialize
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Small delay to ensure chainManager is ready
      setTimeout(autoInitialize, 100);
    });
  } else {
    // DOM already loaded
    setTimeout(autoInitialize, 100);
  }

})();