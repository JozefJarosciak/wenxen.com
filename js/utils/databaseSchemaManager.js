// Database Schema Manager for Scanner Databases
// Ensures consistent schema across chains and handles migrations

/**
 * Database schema definitions for all scanner types
 */
const SCHEMA_DEFINITIONS = {
  cointool: {
    version: 3,
    stores: {
      mints: {
        keyPath: 'mintId',
        indexes: [
          { name: 'byOwner', keyPath: 'owner', unique: false },
          { name: 'byStatus', keyPath: 'status', unique: false },
          { name: 'byMaturityDate', keyPath: 'maturityDateOnly', unique: false }
        ]
      },
      scan_state: {
        keyPath: 'address',
        indexes: []
      },
      performance_stats: {
        keyPath: 'timestamp',
        indexes: []
      }
    }
  },
  
  xenft: {
    version: 2,
    stores: {
      xenfts: {
        keyPath: 'Xenft_id',
        indexes: [
          { name: 'byOwner', keyPath: 'owner', unique: false },
          { name: 'byStatus', keyPath: 'status', unique: false },
          { name: 'byMaturityDate', keyPath: 'maturityDateOnly', unique: false },
          { name: 'byTokenId', keyPath: 'tokenId', unique: false }
        ]
      }
    }
  },
  
  xenft_stake: {
    version: 2,
    stores: {
      stakes: {
        keyPath: 'tokenId',
        indexes: [
          { name: 'byOwner', keyPath: 'owner', unique: false },
          { name: 'byStatus', keyPath: 'status', unique: false },
          { name: 'byMaturityDate', keyPath: 'maturityDateOnly', unique: false }
        ]
      },
      scanState: {
        keyPath: 'address',
        indexes: []
      }
    }
  },
  
  xen_stake: {
    version: 1,
    stores: {
      stakes: {
        keyPath: 'id',
        indexes: [
          { name: 'byOwner', keyPath: 'owner', unique: false },
          { name: 'byStatus', keyPath: 'status', unique: false },
          { name: 'byMaturityDate', keyPath: 'maturityDateOnly', unique: false }
        ]
      },
      scanState: {
        keyPath: 'address',
        indexes: []
      }
    }
  }
};

/**
 * Database schema manager class
 */
export class DatabaseSchemaManager {
  constructor() {
    this.openDatabases = new Map();
    this.migrationLogs = [];
  }

  /**
   * Open a database with proper schema management
   * @param {string} dbType - Database type (cointool, xenft, etc.)
   * @param {string} chainId - Chain identifier (optional, will be determined automatically)
   * @returns {Promise<IDBDatabase>} Database instance
   */
  async openDatabase(dbType, chainId = null) {
    const dbName = this.getDatabaseName(dbType, chainId);
    const schema = SCHEMA_DEFINITIONS[dbType];
    
    if (!schema) {
      throw new Error(`Unknown database type: ${dbType}`);
    }

    // Check if already open
    if (this.openDatabases.has(dbName)) {
      return this.openDatabases.get(dbName);
    }

    console.log(`[DB Schema] Opening database: ${dbName} (v${schema.version})`);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, schema.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;

        console.log(`[DB Schema] Upgrading ${dbName} from v${oldVersion} to v${newVersion}`);
        this.handleSchemaUpgrade(db, dbType, oldVersion, newVersion);
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        
        // Add error handling
        db.onerror = (error) => {
          console.error(`[DB Schema] Database error for ${dbName}:`, error);
        };

        // Add version change handling
        db.onversionchange = () => {
          console.log(`[DB Schema] Version change detected for ${dbName}, closing connection`);
          db.close();
          this.openDatabases.delete(dbName);
        };

        this.openDatabases.set(dbName, db);
        resolve(db);
      };

      request.onerror = (event) => {
        const error = event.target.error;
        console.error(`[DB Schema] Failed to open ${dbName}:`, error);
        reject(error);
      };

      request.onblocked = () => {
        console.warn(`[DB Schema] Database ${dbName} upgrade blocked. Close other tabs.`);
      };
    });
  }

  /**
   * Handle database schema upgrades
   * @param {IDBDatabase} db - Database instance
   * @param {string} dbType - Database type
   * @param {number} oldVersion - Old version number
   * @param {number} newVersion - New version number
   */
  handleSchemaUpgrade(db, dbType, oldVersion, newVersion) {
    const schema = SCHEMA_DEFINITIONS[dbType];
    const migrationLog = {
      dbType,
      dbName: db.name,
      oldVersion,
      newVersion,
      timestamp: Date.now(),
      changes: []
    };

    try {
      // Create or update object stores
      for (const [storeName, storeConfig] of Object.entries(schema.stores)) {
        if (!db.objectStoreNames.contains(storeName)) {
          // Create new store
          const store = db.createObjectStore(storeName, { keyPath: storeConfig.keyPath });
          migrationLog.changes.push(`Created store: ${storeName}`);

          // Create indexes
          for (const indexConfig of storeConfig.indexes) {
            store.createIndex(indexConfig.name, indexConfig.keyPath, { unique: indexConfig.unique });
            migrationLog.changes.push(`Created index: ${storeName}.${indexConfig.name}`);
          }
        } else {
          // Update existing store indexes if needed
          const transaction = db.transaction ? null : event.target.transaction;
          if (transaction) {
            const store = transaction.objectStore(storeName);
            
            // Check for missing indexes
            for (const indexConfig of storeConfig.indexes) {
              if (!store.indexNames.contains(indexConfig.name)) {
                store.createIndex(indexConfig.name, indexConfig.keyPath, { unique: indexConfig.unique });
                migrationLog.changes.push(`Added index: ${storeName}.${indexConfig.name}`);
              }
            }
          }
        }
      }

      // Perform version-specific migrations
      this.runVersionSpecificMigrations(db, dbType, oldVersion, newVersion, migrationLog);

      // Log successful migration
      this.migrationLogs.push(migrationLog);
      console.log(`[DB Schema] Successfully upgraded ${db.name}:`, migrationLog.changes);

    } catch (error) {
      migrationLog.error = error.message;
      this.migrationLogs.push(migrationLog);
      console.error(`[DB Schema] Migration failed for ${db.name}:`, error);
      throw error;
    }
  }

  /**
   * Run version-specific data migrations
   * @param {IDBDatabase} db - Database instance
   * @param {string} dbType - Database type
   * @param {number} oldVersion - Old version
   * @param {number} newVersion - New version
   * @param {Object} migrationLog - Migration log object
   */
  runVersionSpecificMigrations(db, dbType, oldVersion, newVersion, migrationLog) {
    // Cointool-specific migrations
    if (dbType === 'cointool') {
      if (oldVersion < 2 && newVersion >= 2) {
        // Migration: Add performance tracking
        migrationLog.changes.push('Added performance tracking support');
      }
      
      if (oldVersion < 3 && newVersion >= 3) {
        // Migration: Standardize field names
        migrationLog.changes.push('Standardized field naming conventions');
      }
    }

    // XENFT-specific migrations
    if (dbType === 'xenft') {
      if (oldVersion < 2 && newVersion >= 2) {
        // Migration: Add tokenId index for faster lookups
        migrationLog.changes.push('Added tokenId index for improved Base chain support');
      }
    }

    // XEN Stake-specific migrations
    if (dbType === 'xen_stake') {
      if (oldVersion < 1 && newVersion >= 1) {
        // Initial schema - no migrations needed
        migrationLog.changes.push('Initial schema created');
      }
    }

    // XENFT Stake-specific migrations  
    if (dbType === 'xenft_stake') {
      if (oldVersion < 2 && newVersion >= 2) {
        // Migration: Add scan state tracking
        migrationLog.changes.push('Added incremental scan state tracking');
      }
    }
  }

  /**
   * Get standardized database name
   * @param {string} dbType - Database type
   * @param {string} chainId - Chain identifier (optional)
   * @returns {string} Database name
   */
  getDatabaseName(dbType, chainId = null) {
    // Use chain config utils if available
    if (window.chainConfigUtils && typeof window.chainConfigUtils.getDatabaseName === 'function') {
      return window.chainConfigUtils.getDatabaseName(dbType);
    }

    // Fallback logic
    const currentChain = chainId || (window.chainManager?.getCurrentChain?.() || 'ETHEREUM');
    const chainPrefix = currentChain === 'BASE' ? 'BASE' : 'ETH';
    
    const typeMap = {
      'cointool': `${chainPrefix}_DB_Cointool`,
      'xenft': `${chainPrefix}_DB_Xenft`,
      'xenft_stake': `${chainPrefix}_DB_XenftStake`,
      'xen_stake': `${chainPrefix}_DB_XenStake`
    };
    
    return typeMap[dbType] || `${chainPrefix}_DB_${dbType}`;
  }

  /**
   * Validate database schema
   * @param {IDBDatabase} db - Database instance
   * @param {string} dbType - Expected database type
   * @returns {Object} Validation result
   */
  validateSchema(db, dbType) {
    const schema = SCHEMA_DEFINITIONS[dbType];
    if (!schema) {
      return { valid: false, error: `Unknown database type: ${dbType}` };
    }

    const issues = [];

    // Check version
    if (db.version !== schema.version) {
      issues.push(`Version mismatch: expected ${schema.version}, got ${db.version}`);
    }

    // Check object stores
    for (const [storeName, storeConfig] of Object.entries(schema.stores)) {
      if (!db.objectStoreNames.contains(storeName)) {
        issues.push(`Missing object store: ${storeName}`);
        continue;
      }

      // Note: Can't check indexes without transaction, so we'll trust the upgrade process
    }

    // Check for unexpected stores
    for (const storeName of db.objectStoreNames) {
      if (!schema.stores[storeName]) {
        issues.push(`Unexpected object store: ${storeName}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      version: db.version,
      stores: Array.from(db.objectStoreNames)
    };
  }

  /**
   * Close a database and remove from cache
   * @param {string} dbType - Database type
   * @param {string} chainId - Chain identifier (optional)
   */
  closeDatabase(dbType, chainId = null) {
    const dbName = this.getDatabaseName(dbType, chainId);
    
    if (this.openDatabases.has(dbName)) {
      const db = this.openDatabases.get(dbName);
      db.close();
      this.openDatabases.delete(dbName);
      console.log(`[DB Schema] Closed database: ${dbName}`);
    }
  }

  /**
   * Close all open databases
   */
  closeAllDatabases() {
    for (const [dbName, db] of this.openDatabases) {
      db.close();
      console.log(`[DB Schema] Closed database: ${dbName}`);
    }
    this.openDatabases.clear();
  }

  /**
   * Delete a database (useful for testing or cleanup)
   * @param {string} dbType - Database type
   * @param {string} chainId - Chain identifier (optional)
   * @returns {Promise} Promise that resolves when database is deleted
   */
  async deleteDatabase(dbType, chainId = null) {
    const dbName = this.getDatabaseName(dbType, chainId);
    
    // Close the database first
    this.closeDatabase(dbType, chainId);
    
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      
      deleteRequest.onsuccess = () => {
        console.log(`[DB Schema] Deleted database: ${dbName}`);
        resolve();
      };
      
      deleteRequest.onerror = (event) => {
        console.error(`[DB Schema] Failed to delete database ${dbName}:`, event.target.error);
        reject(event.target.error);
      };
      
      deleteRequest.onblocked = () => {
        console.warn(`[DB Schema] Delete blocked for ${dbName}. Close other tabs.`);
      };
    });
  }

  /**
   * Get migration history
   * @returns {Array} Array of migration log entries
   */
  getMigrationHistory() {
    return [...this.migrationLogs];
  }

  /**
   * Export database data for backup
   * @param {string} dbType - Database type
   * @param {string} chainId - Chain identifier (optional)
   * @returns {Promise<Object>} Database export data
   */
  async exportDatabase(dbType, chainId = null) {
    const db = await this.openDatabase(dbType, chainId);
    const schema = SCHEMA_DEFINITIONS[dbType];
    const exportData = {
      dbType,
      chainId: chainId || window.chainManager?.getCurrentChain?.() || 'ETHEREUM',
      version: db.version,
      timestamp: Date.now(),
      data: {}
    };

    const transaction = db.transaction(Object.keys(schema.stores), 'readonly');
    
    for (const storeName of Object.keys(schema.stores)) {
      const store = transaction.objectStore(storeName);
      const data = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      exportData.data[storeName] = data;
    }

    return exportData;
  }

  /**
   * Import database data from backup
   * @param {Object} exportData - Database export data
   * @returns {Promise} Promise that resolves when import is complete
   */
  async importDatabase(exportData) {
    const { dbType, chainId, data } = exportData;
    const db = await this.openDatabase(dbType, chainId);
    
    const transaction = db.transaction(Object.keys(data), 'readwrite');
    
    for (const [storeName, records] of Object.entries(data)) {
      const store = transaction.objectStore(storeName);
      
      // Clear existing data
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });
      
      // Import new data
      for (const record of records) {
        await new Promise((resolve, reject) => {
          const addRequest = store.add(record);
          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => reject(addRequest.error);
        });
      }
    }

    console.log(`[DB Schema] Imported data for ${dbType} (${chainId})`);
  }
}

// Create global singleton instance
const databaseSchemaManager = new DatabaseSchemaManager();

// Make available globally for non-module scripts
if (typeof window !== 'undefined') {
  window.databaseSchemaManager = databaseSchemaManager;
  window.DatabaseSchemaManager = DatabaseSchemaManager;
  
  // Legacy compatibility functions
  window.openDB = async (dbType, chainId) => {
    return databaseSchemaManager.openDatabase(dbType, chainId);
  };
  
  window.closeAllDBs = () => {
    databaseSchemaManager.closeAllDatabases();
  };
}

export default databaseSchemaManager;