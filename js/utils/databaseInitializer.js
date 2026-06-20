// Database Initializer - Creates all chain-specific databases on first load
(function() {
  
  // Database schemas for each scanner type
  const DATABASE_SCHEMAS = {
    'cointool': {
      version: 5,
      // v5: per-proxy storage plus summary indexes. The cointool_scanner
      // module owns the upgrade
      // path; this initializer just makes sure the DB exists at the right
      // version with the right stores when a fresh chain is opened.
      stores: {
        'proxies': {
          keyPath: 'id',
          indexes: {
            byOwner: { keyPath: 'Owner', unique: false },
            byOwnerStatus: { keyPath: ['Owner', 'Status'], unique: false },
            byOwnerSaltStatusTerm: { keyPath: ['Owner', 'Salt', 'Status', 'Term'], unique: false },
            byMaturity: { keyPath: 'Maturity_TS', unique: false }
          }
        },
        'scanState': { keyPath: 'address' },
        'summaryByType': {
          keyPath: 'id',
          indexes: {
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryByStatus': {
          keyPath: 'id',
          indexes: {
            byType: { keyPath: 'type', unique: false },
            byStatus: { keyPath: 'status', unique: false }
          }
        },
        'summaryByDay': {
          keyPath: 'id',
          indexes: {
            byDate: { keyPath: 'date', unique: false },
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryByOwner': {
          keyPath: 'id',
          indexes: {
            byOwner: { keyPath: 'owner', unique: false },
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryMetadata': { keyPath: 'id' }
      },
      // Legacy stores to drop when upgrading from v3.
      dropStores: ['mints', 'mintProgress', 'actionsCache']
    },
    'xenft': {
      version: 5,
      stores: {
        'xenfts': {
          keyPath: 'Xenft_id',
          indexes: {
            byTokenId: { keyPath: 'tokenId', unique: false }
          }
        },
        'scanState': { keyPath: 'address' },
        'processProgress': { keyPath: 'address' },
        'summaryByType': {
          keyPath: 'id',
          indexes: {
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryByStatus': {
          keyPath: 'id',
          indexes: {
            byType: { keyPath: 'type', unique: false },
            byStatus: { keyPath: 'status', unique: false }
          }
        },
        'summaryByDay': {
          keyPath: 'id',
          indexes: {
            byDate: { keyPath: 'date', unique: false },
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryByOwner': {
          keyPath: 'id',
          indexes: {
            byOwner: { keyPath: 'owner', unique: false },
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryMetadata': { keyPath: 'id' }
      }
    },
    'xenft-stake': {
      version: 3,
      stores: {
        'stakes': { keyPath: 'tokenId' },
        'scanState': { keyPath: 'address' },
        'processProgress': { keyPath: 'address' },
        'summaryByType': {
          keyPath: 'id',
          indexes: {
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryByStatus': {
          keyPath: 'id',
          indexes: {
            byType: { keyPath: 'type', unique: false },
            byStatus: { keyPath: 'status', unique: false }
          }
        },
        'summaryByDay': {
          keyPath: 'id',
          indexes: {
            byDate: { keyPath: 'date', unique: false },
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryByOwner': {
          keyPath: 'id',
          indexes: {
            byOwner: { keyPath: 'owner', unique: false },
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryMetadata': { keyPath: 'id' }
      }
    },
    'xen-stake': {
      version: 3,
      stores: {
        'stakes': { keyPath: 'id', indexes: { 'byOwner': { keyPath: 'owner', unique: false } } },
        'scanState': { keyPath: 'address' },
        'processProgress': { keyPath: 'address' },
        'summaryByType': {
          keyPath: 'id',
          indexes: {
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryByStatus': {
          keyPath: 'id',
          indexes: {
            byType: { keyPath: 'type', unique: false },
            byStatus: { keyPath: 'status', unique: false }
          }
        },
        'summaryByDay': {
          keyPath: 'id',
          indexes: {
            byDate: { keyPath: 'date', unique: false },
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryByOwner': {
          keyPath: 'id',
          indexes: {
            byOwner: { keyPath: 'owner', unique: false },
            byType: { keyPath: 'type', unique: false }
          }
        },
        'summaryMetadata': { keyPath: 'id' }
      }
    }
  };

  const DB_TYPE_ORDER = ['cointool', 'xenft', 'xenft_stake', 'xen_stake'];
  const DB_TYPE_ALIASES = {
    'xenft-stake': 'xenft_stake',
    'xen-stake': 'xen_stake',
    xenftStake: 'xenft_stake',
    xenStake: 'xen_stake'
  };

  function normalizeDbType(dbType) {
    return DB_TYPE_ALIASES[dbType] || dbType;
  }

  function getSchema(dbType) {
    const normalized = normalizeDbType(dbType);
    if (normalized === 'xenft_stake') return DATABASE_SCHEMAS['xenft-stake'];
    if (normalized === 'xen_stake') return DATABASE_SCHEMAS['xen-stake'];
    return DATABASE_SCHEMAS[normalized] || null;
  }

  function getDatabaseNameForType(chainPrefix, dbType) {
    const normalized = normalizeDbType(dbType);
    const suffixes = {
      cointool: 'Cointool',
      xenft: 'Xenft',
      xenft_stake: 'XenftStake',
      xen_stake: 'XenStake'
    };
    return `${chainPrefix}_DB_${suffixes[normalized] || dbType}`;
  }

  function getSchemaForDatabaseName(dbName) {
    if (dbName.includes('Cointool')) return getSchema('cointool');
    if (dbName.includes('XenftStake')) return getSchema('xenft_stake');
    if (dbName.includes('Xenft')) return getSchema('xenft');
    if (dbName.includes('XenStake')) return getSchema('xen_stake');
    return null;
  }

  function getExportDbTypes() {
    return DB_TYPE_ORDER.map(key => {
      const schema = getSchema(key);
      return {
        key,
        version: schema.version,
        stores: Object.keys(schema.stores)
      };
    });
  }

  function applySchema(db, schema, transaction) {
    if (!schema || !schema.stores) return;

    if (Array.isArray(schema.dropStores)) {
      for (const oldName of schema.dropStores) {
        if (db.objectStoreNames.contains(oldName)) {
          try { db.deleteObjectStore(oldName); } catch (_) {}
        }
      }
    }

    for (const [storeName, storeConfig] of Object.entries(schema.stores)) {
      let store = null;
      if (!db.objectStoreNames.contains(storeName)) {
        store = db.createObjectStore(storeName, { keyPath: storeConfig.keyPath });
      } else if (storeConfig.indexes && transaction) {
        store = transaction.objectStore(storeName);
      }

      if (store && storeConfig.indexes) {
        for (const [indexName, indexConfig] of Object.entries(storeConfig.indexes)) {
          if (!store.indexNames.contains(indexName)) {
            store.createIndex(indexName, indexConfig.keyPath, { unique: indexConfig.unique || false });
          }
        }
      }
    }
  }

  // Initialize a single database
  async function initializeDatabase(dbName, schema) {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(dbName, schema.version);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          applySchema(db, schema, event.target.transaction);
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
    
    for (const dbType of DB_TYPE_ORDER) {
      const schema = getSchema(dbType);
      const dbName = getDatabaseNameForType(chainPrefix, dbType);
      
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

  function getChainPrefixes() {
    if (window.chainManager?.getChainList && window.chainManager?.getDatabasePrefix) {
      return window.chainManager.getChainList().map(chain => window.chainManager.getDatabasePrefix(chain.key));
    }
    return ['ETH', 'BASE', 'AVAX', 'BSC', 'GLMR', 'POL', 'OPT'];
  }

  // Initialize databases for the current chain
  async function initializeCurrentChainDatabases() {
    try {
      // Get current chain
      const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
      const chainPrefix = window.chainManager?.getDatabasePrefix?.(currentChain) || 'ETH';
      
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
    
    for (const chainPrefix of getChainPrefixes()) {
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
    while ((!window.chainManager || !window.chainManager.initialized) && attempts < 50) {
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
  window.databaseSchemaRegistry = {
    schemas: DATABASE_SCHEMAS,
    getSchema,
    getSchemaForDatabaseName,
    getDatabaseNameForType,
    getExportDbTypes,
    applySchema
  };

  window.databaseInitializer = {
    initializeDatabase,
    initializeChainDatabases,
    initializeCurrentChainDatabases,
    initializeAllChainDatabases,
    autoInitialize,
    schemas: DATABASE_SCHEMAS
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
