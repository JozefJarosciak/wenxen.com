// Database migration utilities for converting old DB names to chain-specific format

export class DatabaseMigrator {
  constructor() {
    // Old database names (non-chain-specific) to new Ethereum names
    this.oldDatabases = {
      'DB_Cointool': 'ETH_DB_Cointool',
      'DB_Xenft': 'ETH_DB_Xenft',
      'DB-Xen-Stake': 'ETH_DB_XenStake',
      'DB_XenStake': 'ETH_DB_XenStake',  // Handle both formats
      'DB-Xenft-Stake': 'ETH_DB_XenftStake',
      'DB_XenftStake': 'ETH_DB_XenftStake',  // Handle both formats
      // Also check for any partially migrated names
      'DB_XenStake': 'ETH_DB_XenStake',
      'DB_XenftStake': 'ETH_DB_XenftStake'
    };

    // Base database configurations
    this.baseDatabases = [
      { name: 'BASE_DB_Cointool', version: 3, stores: ['mints', 'scanState', 'actionsCache'] },
      { name: 'BASE_DB_Xenft', version: 3, stores: ['xenfts', 'scanState', 'processProgress'] },
      { name: 'BASE_DB_XenStake', version: 1, stores: ['stakes', 'scanState'] },
      { name: 'BASE_DB_XenftStake', version: 2, stores: ['stakes', 'scanState', 'processProgress'] }
    ];
  }

  // Check if migration is needed
  async isMigrationNeeded() {
    const migrationFlag = localStorage.getItem('dbMigrationCompleted');
    if (migrationFlag === 'v3') {
      console.log('Database migration already completed (v3)');
      return false;
    }

    // Always try to migrate if flag is not v3 (handles incomplete migrations)
    console.log('Database migration check: flag not v3, will attempt migration');
    return true;
  }

  // Get list of all IndexedDB databases
  async getAllDatabases() {
    if (!indexedDB.databases) {
      // Fallback for browsers that don't support databases()
      console.log('Browser does not support indexedDB.databases(), checking known databases');
      return this.getKnownDatabases();
    }

    try {
      const databases = await indexedDB.databases();
      return databases;
    } catch (error) {
      console.error('Error getting databases:', error);
      return this.getKnownDatabases();
    }
  }

  // Fallback method to check known databases
  getKnownDatabases() {
    const knownDbs = [];
    const allPossibleDbs = [
      ...Object.keys(this.oldDatabases),
      ...Object.values(this.oldDatabases),
      ...this.baseDatabases.map(db => db.name)
    ];

    // We'll check each one by trying to open it
    return allPossibleDbs.map(name => ({ name, version: 1 }));
  }

  // Migrate a single database
  async migrateDatabase(oldName, newName) {
    console.log(`Checking database: ${oldName} → ${newName}`);
    
    try {
      // First check if the new database already exists
      const newDb = await this.openDatabase(newName);
      if (newDb) {
        newDb.close();
        console.log(`Target database ${newName} already exists`);
        
        // Now check if old database still exists and delete it
        const oldDb = await this.openDatabase(oldName);
        if (oldDb) {
          oldDb.close();
          await this.deleteDatabase(oldName);
          console.log(`Deleted legacy database ${oldName}`);
          return true;
        }
        return false;
      }
      
      // Open the old database
      const oldDb = await this.openDatabase(oldName);
      if (!oldDb) {
        console.log(`Database ${oldName} does not exist, skipping`);
        return false;
      }

      // Get the version and object stores
      const version = oldDb.version;
      const objectStoreNames = Array.from(oldDb.objectStoreNames);
      
      // Create the new database with the same structure (use different variable name)
      const createdDb = await this.createDatabase(newName, version, objectStoreNames);
      
      // Copy all data from old to new
      for (const storeName of objectStoreNames) {
        await this.copyObjectStore(oldDb, createdDb, storeName);
      }
      
      // Close databases
      oldDb.close();
      createdDb.close();
      
      // Delete the old database
      await this.deleteDatabase(oldName);
      
      console.log(`Successfully migrated ${oldName} to ${newName}`);
      return true;
    } catch (error) {
      console.error(`Error migrating ${oldName}:`, error);
      return false;
    }
  }

  // Open a database
  openDatabase(name) {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const request = indexedDB.open(name);
      
      request.onsuccess = (event) => {
        if (!resolved) {
          resolved = true;
          resolve(event.target.result);
        }
      };
      
      request.onerror = (event) => {
        if (!resolved) {
          resolved = true;
          console.log(`Database ${name} does not exist or cannot be opened`);
          resolve(null);
        }
      };
      
      request.onupgradeneeded = (event) => {
        // Database exists but needs upgrade - this means it exists
        if (!resolved) {
          resolved = true;
          const db = event.target.result;
          // Close and re-open without upgrade
          db.close();
          setTimeout(() => {
            const request2 = indexedDB.open(name);
            request2.onsuccess = (e) => resolve(e.target.result);
            request2.onerror = () => resolve(null);
          }, 10);
        }
      };
    });
  }

  // Create a new database with specified structure
  createDatabase(name, version, objectStoreNames) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        for (const storeName of objectStoreNames) {
          if (!db.objectStoreNames.contains(storeName)) {
            // Determine the key path based on store name
            let keyPath = 'id';
            if (storeName === 'mints') keyPath = 'ID';
            if (storeName === 'xenfts') keyPath = 'Xenft_id';
            if (storeName === 'scanState') keyPath = 'address';
            if (storeName === 'actionsCache') keyPath = 'address';
            if (storeName === 'stakes') keyPath = 'id';
            if (storeName === 'processProgress') keyPath = 'id';
            
            db.createObjectStore(storeName, { keyPath });
          }
        }
      };
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // Copy all data from one object store to another
  async copyObjectStore(sourceDb, targetDb, storeName) {
    return new Promise((resolve, reject) => {
      try {
        // Read from source
        const sourceTransaction = sourceDb.transaction(storeName, 'readonly');
        const sourceStore = sourceTransaction.objectStore(storeName);
        const getAllRequest = sourceStore.getAll();
        
        getAllRequest.onsuccess = (event) => {
          const data = event.target.result;
          
          if (data && data.length > 0) {
            // Write to target
            const targetTransaction = targetDb.transaction(storeName, 'readwrite');
            const targetStore = targetTransaction.objectStore(storeName);
            
            data.forEach(item => {
              targetStore.put(item);
            });
            
            targetTransaction.oncomplete = () => {
              console.log(`Copied ${data.length} items to ${storeName}`);
              resolve();
            };
            
            targetTransaction.onerror = (event) => {
              reject(event.target.error);
            };
          } else {
            resolve();
          }
        };
        
        getAllRequest.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Delete a database
  deleteDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      
      request.onsuccess = () => {
        console.log(`Deleted old database: ${name}`);
        resolve();
      };
      
      request.onerror = (event) => {
        console.error(`Failed to delete ${name}:`, event.target.error);
        // Don't reject, just log and continue
        resolve();
      };
      
      request.onblocked = () => {
        console.warn(`Delete blocked for ${name}, continuing anyway`);
        resolve();
      };
    });
  }

  // Create Ethereum databases if they don't exist
  async createEthereumDatabases() {
    console.log('Verifying Ethereum databases...');
    
    const ethDatabases = [
      { name: 'ETH_DB_Cointool', version: 3, stores: ['mints', 'scanState', 'actionsCache'] },
      { name: 'ETH_DB_Xenft', version: 3, stores: ['xenfts', 'scanState', 'processProgress'] },
      { name: 'ETH_DB_XenStake', version: 1, stores: ['stakes', 'scanState'] },
      { name: 'ETH_DB_XenftStake', version: 2, stores: ['stakes', 'scanState', 'processProgress'] }
    ];
    
    for (const dbConfig of ethDatabases) {
      await this.createDatabaseIfNeeded(dbConfig);
    }
  }
  
  // Create Base databases
  async createBaseDatabases() {
    console.log('Creating Base databases...');
    
    for (const dbConfig of this.baseDatabases) {
      await this.createDatabaseIfNeeded(dbConfig);
    }
  }
  
  // Helper to create a database if it doesn't exist
  async createDatabaseIfNeeded(dbConfig) {
    try {
      // Check if database already exists
      const existingDb = await this.openDatabase(dbConfig.name);
      if (existingDb) {
        existingDb.close();
        console.log(`${dbConfig.name} already exists`);
        return;
      }
      
      // Create the database
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbConfig.name, dbConfig.version);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Create object stores based on database type
          dbConfig.stores.forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
              let keyPath = 'id';
              if (storeName === 'mints') keyPath = 'ID';
              if (storeName === 'xenfts') keyPath = 'Xenft_id';
              if (storeName === 'scanState') keyPath = 'address';
              if (storeName === 'actionsCache') keyPath = 'address';
              if (storeName === 'stakes') keyPath = 'id';
              if (storeName === 'processProgress') keyPath = 'id';
              
              const store = db.createObjectStore(storeName, { keyPath });
              
              // Add indexes if needed
              if (storeName === 'mints') {
                store.createIndex('by_address', 'Address', { unique: false });
                store.createIndex('by_maturity', 'Maturity', { unique: false });
              }
              if (storeName === 'stakes') {
                store.createIndex('by_address', 'address', { unique: false });
                store.createIndex('by_maturity', 'maturityDate', { unique: false });
              }
            }
          });
        };
        
        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      });
      
      db.close();
      console.log(`Created database: ${dbConfig.name}`);
    } catch (error) {
      console.error(`Error creating ${dbConfig.name}:`, error);
    }
  }

  // Clean up any remaining legacy databases
  async cleanupLegacyDatabases() {
    console.log('Checking for additional legacy databases...');
    
    // List of all possible legacy database names to clean up
    const legacyNames = [
      'DB_Cointool', 'DB_Xenft', 'DB_XenStake', 'DB_XenftStake',
      'DB-Xen-Stake', 'DB-Xenft-Stake', 'DB_XENFT', 'DB_XENFT_STAKE',
      'DB-XEN-STAKE', 'DB-XENFT-STAKE'
    ];
    
    for (const name of legacyNames) {
      try {
        const db = await this.openDatabase(name);
        if (db) {
          db.close();
          await this.deleteDatabase(name);
          console.log(`Cleaned up legacy database: ${name}`);
        }
      } catch (error) {
        // Ignore errors, database probably doesn't exist
      }
    }
  }
  
  // Main migration function
  async migrate() {
    console.log('Starting database migration v3...');
    const results = [];
    
    try {
      // Check if migration is needed
      const needed = await this.isMigrationNeeded();
      if (!needed) {
        console.log('No database migration needed');
        return results;
      }
      
      // Migrate each old database to new name (or just delete if target exists)
      for (const [oldName, newName] of Object.entries(this.oldDatabases)) {
        const success = await this.migrateDatabase(oldName, newName);
        if (success) {
          results.push(`✅ Processed ${oldName} → ${newName}`);
        }
      }
      
      // Clean up any remaining legacy databases
      await this.cleanupLegacyDatabases();
      results.push('✅ Cleaned up legacy databases')
      
      // Create Base databases
      await this.createBaseDatabases();
      results.push('✅ Created Base databases');
      
      // Ensure Ethereum databases also exist (in case they're missing)
      await this.createEthereumDatabases();
      results.push('✅ Verified Ethereum databases');
      
      // Set migration flag
      localStorage.setItem('dbMigrationCompleted', 'v3');
      console.log('Database migration completed successfully');
      
    } catch (error) {
      console.error('Database migration failed:', error);
      results.push(`❌ Migration error: ${error.message}`);
    }
    
    return results;
  }
}

// Create singleton instance
export const dbMigrator = new DatabaseMigrator();

// Auto-run migration on module load if needed
if (typeof window !== 'undefined') {
  // Run migration after a short delay to ensure everything is initialized
  setTimeout(async () => {
    const needed = await dbMigrator.isMigrationNeeded();
    if (needed) {
      console.log('Database migration needed, running automatically...');
      await dbMigrator.migrate();
    }
  }, 100);
}

export default dbMigrator;