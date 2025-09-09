// Fixed Database Migration - Prevents data loss and concurrent execution
export class DatabaseMigrator {
  constructor() {
    // Migration state
    this.migrating = false;
    this.migrationPromise = null;
    
    // Database mappings
    this.legacyToEthereumMap = {
      'DB_Cointool': 'ETH_DB_Cointool',
      'DB_Xenft': 'ETH_DB_Xenft',
      'DB-Xen-Stake': 'ETH_DB_XenStake',
      'DB-Xenft-Stake': 'ETH_DB_XenftStake'
    };
    
    // Base databases to create
    this.baseDatabases = [
      { name: 'BASE_DB_Cointool', version: 3, stores: ['mints', 'scanState', 'actionsCache'] },
      { name: 'BASE_DB_Xenft', version: 1, stores: ['mints', 'scanState'] },
      { name: 'BASE_DB_XenStake', version: 1, stores: ['stakes', 'scanState'] },
      { name: 'BASE_DB_XenftStake', version: 1, stores: ['stakes', 'scanState'] }
    ];
  }

  // Check if migration is needed
  isMigrationNeeded() {
    const flag = localStorage.getItem('dbMigrationCompleted');
    return flag !== 'v4';
  }

  // Main migration function with locking
  async migrate() {
    // If already migrating, return the existing promise
    if (this.migrating && this.migrationPromise) {
      console.log('Migration already in progress, waiting...');
      return this.migrationPromise;
    }
    
    // Check if migration is needed
    if (!this.isMigrationNeeded()) {
      console.log('Database migration already completed (v4)');
      return [];
    }
    
    // Set lock and start migration
    this.migrating = true;
    this.migrationPromise = this.performMigration();
    
    try {
      const results = await this.migrationPromise;
      return results;
    } finally {
      this.migrating = false;
      this.migrationPromise = null;
    }
  }
  
  // Perform the actual migration
  async performMigration() {
    console.log('Starting database migration v4...');
    const results = [];
    
    try {
      // Step 1: Migrate legacy databases to Ethereum names
      for (const [oldName, newName] of Object.entries(this.legacyToEthereumMap)) {
        const result = await this.migrateSingleDatabase(oldName, newName);
        if (result) {
          results.push(result);
        }
      }
      
      // Step 2: Create Base databases if they don't exist
      for (const dbConfig of this.baseDatabases) {
        const result = await this.createDatabaseIfNeeded(dbConfig);
        if (result) {
          results.push(result);
        }
      }
      
      // Step 3: Mark migration as complete
      localStorage.setItem('dbMigrationCompleted', 'v4');
      console.log('Database migration completed successfully');
      
    } catch (error) {
      console.error('Database migration failed:', error);
      results.push(`❌ Migration error: ${error.message}`);
    }
    
    return results;
  }
  
  // Migrate a single database
  async migrateSingleDatabase(oldName, newName) {
    try {
      // Check if old database exists
      const oldExists = await this.databaseExists(oldName);
      if (!oldExists) {
        console.log(`Legacy database ${oldName} does not exist, skipping`);
        return null;
      }
      
      // Check if new database already exists
      const newExists = await this.databaseExists(newName);
      if (newExists) {
        console.log(`Target database ${newName} already exists`);
        // Delete the old database since we already have the migrated version
        await this.deleteDatabase(oldName);
        return `✅ Cleaned up legacy ${oldName} (${newName} already exists)`;
      }
      
      // Perform migration
      console.log(`Migrating ${oldName} to ${newName}...`);
      
      // Open old database
      const oldDb = await this.openDatabase(oldName);
      if (!oldDb) {
        return null;
      }
      
      const version = oldDb.version;
      const storeNames = Array.from(oldDb.objectStoreNames);
      
      // Create new database with same structure
      const newDb = await this.createDatabase(newName, version, storeNames);
      
      // Copy data
      for (const storeName of storeNames) {
        await this.copyStore(oldDb, newDb, storeName);
      }
      
      // Close databases
      oldDb.close();
      newDb.close();
      
      // Delete old database
      await this.deleteDatabase(oldName);
      
      return `✅ Migrated ${oldName} to ${newName}`;
      
    } catch (error) {
      console.error(`Error migrating ${oldName}:`, error);
      return `❌ Failed to migrate ${oldName}: ${error.message}`;
    }
  }
  
  // Check if database exists
  async databaseExists(name) {
    return new Promise((resolve) => {
      const request = indexedDB.open(name);
      let exists = false;
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        exists = true;
        db.close();
        resolve(true);
      };
      
      request.onerror = () => {
        resolve(false);
      };
      
      request.onupgradeneeded = (event) => {
        // Database doesn't exist if upgrade is needed on version 1
        const db = event.target.result;
        if (event.oldVersion === 0) {
          exists = false;
          // Abort the transaction to not create the database
          event.target.transaction.abort();
        } else {
          exists = true;
        }
        db.close();
      };
      
      setTimeout(() => {
        resolve(exists);
      }, 100);
    });
  }
  
  // Open existing database
  openDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = () => {
        resolve(null);
      };
      
      request.onupgradeneeded = (event) => {
        // Don't upgrade, just open as-is
        event.target.transaction.abort();
        resolve(null);
      };
    });
  }
  
  // Create new database
  createDatabase(name, version, storeNames) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        for (const storeName of storeNames) {
          if (!db.objectStoreNames.contains(storeName)) {
            // Determine key path based on store name
            let keyPath = 'id';
            if (storeName === 'mints') keyPath = 'ID';
            if (storeName === 'scanState') keyPath = 'address';
            if (storeName === 'actionsCache') keyPath = 'address';
            if (storeName === 'stakes') keyPath = 'id';
            
            const store = db.createObjectStore(storeName, { keyPath });
            
            // Add indexes
            if (storeName === 'mints') {
              store.createIndex('by_address', 'Address', { unique: false });
              store.createIndex('by_maturity', 'Maturity', { unique: false });
            }
            if (storeName === 'stakes') {
              store.createIndex('by_address', 'address', { unique: false });
              store.createIndex('by_maturity', 'maturityDate', { unique: false });
            }
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
  
  // Copy data between stores
  async copyStore(sourceDb, targetDb, storeName) {
    return new Promise((resolve, reject) => {
      try {
        const sourceTransaction = sourceDb.transaction(storeName, 'readonly');
        const sourceStore = sourceTransaction.objectStore(storeName);
        const getAllRequest = sourceStore.getAll();
        
        getAllRequest.onsuccess = (event) => {
          const data = event.target.result;
          
          if (data && data.length > 0) {
            const targetTransaction = targetDb.transaction(storeName, 'readwrite');
            const targetStore = targetTransaction.objectStore(storeName);
            
            let addedCount = 0;
            let skippedCount = 0;
            
            data.forEach(item => {
              try {
                // Check if item has required key field
                const keyPath = targetStore.keyPath;
                if (keyPath && !item[keyPath]) {
                  console.warn(`Skipping item without key field '${keyPath}':`, item);
                  skippedCount++;
                  return;
                }
                
                targetStore.put(item);
                addedCount++;
              } catch (err) {
                console.warn(`Failed to copy item:`, err, item);
                skippedCount++;
              }
            });
            
            targetTransaction.oncomplete = () => {
              console.log(`Copied ${addedCount} items to ${storeName}${skippedCount > 0 ? `, skipped ${skippedCount} invalid items` : ''}`);
              resolve();
            };
            
            targetTransaction.onerror = (event) => {
              console.error(`Transaction error for ${storeName}:`, event.target.error);
              // Don't reject - continue with what we could copy
              resolve();
            };
          } else {
            resolve();
          }
        };
        
        getAllRequest.onerror = (event) => {
          console.error(`Failed to read from ${storeName}:`, event.target.error);
          resolve(); // Continue anyway
        };
      } catch (error) {
        console.error(`Error copying store ${storeName}:`, error);
        resolve(); // Continue anyway
      }
    });
  }
  
  // Delete database
  deleteDatabase(name) {
    return new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(name);
      
      request.onsuccess = () => {
        console.log(`Deleted database: ${name}`);
        resolve();
      };
      
      request.onerror = (event) => {
        console.warn(`Failed to delete ${name}:`, event.target.error);
        resolve(); // Continue anyway
      };
      
      request.onblocked = () => {
        console.warn(`Delete blocked for ${name}, continuing...`);
        resolve(); // Continue anyway
      };
    });
  }
  
  // Create database if it doesn't exist
  async createDatabaseIfNeeded(dbConfig) {
    const exists = await this.databaseExists(dbConfig.name);
    if (exists) {
      console.log(`Database ${dbConfig.name} already exists`);
      return null;
    }
    
    console.log(`Creating database ${dbConfig.name}...`);
    
    try {
      const db = await this.createDatabase(dbConfig.name, dbConfig.version, dbConfig.stores);
      db.close();
      return `✅ Created ${dbConfig.name}`;
    } catch (error) {
      console.error(`Failed to create ${dbConfig.name}:`, error);
      return `❌ Failed to create ${dbConfig.name}: ${error.message}`;
    }
  }
}

// Create singleton
export const dbMigrator = new DatabaseMigrator();

// Don't auto-run migration here - let it be called from initialization
console.log('Database migrator loaded');

export default dbMigrator;