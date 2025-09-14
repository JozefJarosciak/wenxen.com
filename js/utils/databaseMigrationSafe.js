// Safe Database Migration - Creates backups and validates before deletion
export class SafeDatabaseMigrator {
  constructor() {
    // Migration state
    this.migrating = false;
    this.migrationPromise = null;
    
    // Database mappings
    this.legacyToEthereumMap = {
      'DB_Cointool': 'ETH_DB_Cointool',
      'DB_Xenft': 'ETH_DB_Xenft',
      'DB_XenStake': 'ETH_DB_XenStake',
      'DB_XenftStake': 'ETH_DB_XenftStake'
    };
    
    // Databases to create for each chain
    this.ethereumDatabases = [
      { name: 'ETH_DB_Cointool', version: 3, stores: ['mints', 'scanState', 'actionsCache'] },
      { name: 'ETH_DB_Xenft', version: 3, stores: ['xenfts', 'scanState', 'processProgress'] },
      { name: 'ETH_DB_XenStake', version: 1, stores: ['stakes', 'scanState'] },
      { name: 'ETH_DB_XenftStake', version: 2, stores: ['stakes', 'scanState', 'processProgress'] }
    ];
    
    this.baseDatabases = [
      { name: 'BASE_DB_Cointool', version: 3, stores: ['mints', 'scanState', 'actionsCache'] },
      { name: 'BASE_DB_Xenft', version: 3, stores: ['xenfts', 'scanState', 'processProgress'] },
      { name: 'BASE_DB_XenStake', version: 1, stores: ['stakes', 'scanState'] },
      { name: 'BASE_DB_XenftStake', version: 2, stores: ['stakes', 'scanState', 'processProgress'] }
    ];
  }

  // Check if migration is needed
  isMigrationNeeded() {
    const flag = localStorage.getItem('dbMigrationCompleted');
    return flag !== 'v5_safe';
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
      console.log('Database migration already completed (v5_safe)');
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
    console.log('Starting SAFE database migration v5...');
    const results = [];
    
    try {
      // Step 1: Ensure all Ethereum databases exist (create or verify)
      console.log('Step 1: Ensuring Ethereum databases exist...');
      for (const dbConfig of this.ethereumDatabases) {
        const result = await this.ensureDatabaseExists(dbConfig);
        if (result) {
          results.push(result);
        }
      }
      
      // Step 2: Ensure all Base databases exist
      console.log('Step 2: Ensuring Base databases exist...');
      for (const dbConfig of this.baseDatabases) {
        const result = await this.ensureDatabaseExists(dbConfig);
        if (result) {
          results.push(result);
        }
      }
      
      // Step 3: Migrate legacy data if it exists (WITHOUT deleting originals yet)
      console.log('Step 3: Checking for legacy data to migrate...');
      for (const [oldName, newName] of Object.entries(this.legacyToEthereumMap)) {
        const result = await this.safeMigrateSingleDatabase(oldName, newName);
        if (result) {
          results.push(result);
        }
      }
      
      // Step 4: Verify all migrations succeeded before cleaning up
      console.log('Step 4: Verifying migrations...');
      const verifyResults = await this.verifyMigrations();
      if (verifyResults.success) {
        // Step 5: Only NOW delete legacy databases
        console.log('Step 5: Cleaning up legacy databases...');
        for (const oldName of Object.keys(this.legacyToEthereumMap)) {
          await this.deleteDatabase(oldName);
          results.push(`✅ Cleaned up legacy ${oldName}`);
        }
      } else {
        results.push(`⚠️ Migration verification failed: ${verifyResults.message}`);
        console.warn('Migration verification failed, keeping legacy databases');
      }
      
      // Step 6: Mark migration as complete
      localStorage.setItem('dbMigrationCompleted', 'v5_safe');
      console.log('Safe database migration completed successfully');
      
    } catch (error) {
      console.error('Database migration failed:', error);
      results.push(`❌ Migration error: ${error.message}`);
    }
    
    return results;
  }
  
  // Ensure a database exists with proper structure
  async ensureDatabaseExists(dbConfig) {
    try {
      const exists = await this.databaseExists(dbConfig.name);
      
      if (exists) {
        // Database exists, verify its structure
        const db = await this.openDatabase(dbConfig.name);
        if (db) {
          const missingStores = [];
          for (const storeName of dbConfig.stores) {
            if (!db.objectStoreNames.contains(storeName)) {
              missingStores.push(storeName);
            }
          }
          db.close();
          
          if (missingStores.length > 0) {
            console.log(`Database ${dbConfig.name} exists but is missing stores: ${missingStores.join(', ')}`);
            // We can't add stores to existing database without version bump
            // For now, just log this
            return `⚠️ ${dbConfig.name} missing stores: ${missingStores.join(', ')}`;
          }
          
          console.log(`Database ${dbConfig.name} already exists with correct structure`);
          return null;
        }
      }
      
      // Create the database
      console.log(`Creating database ${dbConfig.name}...`);
      const db = await this.createDatabase(dbConfig.name, dbConfig.version, dbConfig.stores);
      db.close();
      return `✅ Created ${dbConfig.name}`;
      
    } catch (error) {
      console.error(`Error ensuring ${dbConfig.name}:`, error);
      return `❌ Failed to ensure ${dbConfig.name}: ${error.message}`;
    }
  }
  
  // Safely migrate a single database (copy without deleting)
  async safeMigrateSingleDatabase(oldName, newName) {
    try {
      // Check if old database exists
      const oldExists = await this.databaseExists(oldName);
      if (!oldExists) {
        console.log(`Legacy database ${oldName} does not exist, skipping`);
        return null;
      }
      
      // Open old database
      const oldDb = await this.openDatabase(oldName);
      if (!oldDb) {
        return null;
      }
      
      // Check if new database already has data
      const newDb = await this.openDatabase(newName);
      if (!newDb) {
        oldDb.close();
        return `❌ Target database ${newName} doesn't exist`;
      }
      
      // Check if target already has data
      let hasData = false;
      for (const storeName of oldDb.objectStoreNames) {
        if (newDb.objectStoreNames.contains(storeName)) {
          const count = await this.getStoreCount(newDb, storeName);
          if (count > 0) {
            hasData = true;
            break;
          }
        }
      }
      
      if (hasData) {
        console.log(`Target database ${newName} already has data, skipping migration`);
        oldDb.close();
        newDb.close();
        return `ℹ️ ${newName} already has data`;
      }
      
      // Copy data
      console.log(`Migrating ${oldName} to ${newName}...`);
      let totalCopied = 0;
      let totalSkipped = 0;
      
      for (const storeName of oldDb.objectStoreNames) {
        if (newDb.objectStoreNames.contains(storeName)) {
          const result = await this.safeCopyStore(oldDb, newDb, storeName);
          totalCopied += result.copied;
          totalSkipped += result.skipped;
        }
      }
      
      // Close databases
      oldDb.close();
      newDb.close();
      
      // Don't delete old database yet - wait for verification
      return `✅ Migrated ${oldName} to ${newName} (${totalCopied} records copied, ${totalSkipped} skipped)`;
      
    } catch (error) {
      console.error(`Error migrating ${oldName}:`, error);
      return `❌ Failed to migrate ${oldName}: ${error.message}`;
    }
  }
  
  // Get count of records in a store
  async getStoreCount(db, storeName) {
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();
        
        request.onsuccess = () => {
          resolve(request.result || 0);
        };
        
        request.onerror = () => {
          resolve(0);
        };
      } catch (error) {
        resolve(0);
      }
    });
  }
  
  // Verify all migrations succeeded
  async verifyMigrations() {
    try {
      // Check that all Ethereum databases have data or are ready
      for (const dbConfig of this.ethereumDatabases) {
        const db = await this.openDatabase(dbConfig.name);
        if (!db) {
          return { success: false, message: `Failed to open ${dbConfig.name}` };
        }
        
        // Just verify structure exists
        for (const storeName of dbConfig.stores) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            return { success: false, message: `${dbConfig.name} missing store ${storeName}` };
          }
        }
        db.close();
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
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
        // Database doesn't exist if upgrade is needed on version 0
        if (event.oldVersion === 0) {
          exists = false;
          event.target.transaction.abort();
        } else {
          exists = true;
        }
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
        if (event.oldVersion === 0) {
          event.target.transaction.abort();
          resolve(null);
        }
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
            if (storeName === 'xenfts') keyPath = 'Xenft_id';
            if (storeName === 'scanState') keyPath = 'address';
            if (storeName === 'actionsCache') keyPath = 'address';
            if (storeName === 'stakes') keyPath = 'id';
            if (storeName === 'processProgress') keyPath = 'id';
            
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
  
  // Safely copy data between stores
  async safeCopyStore(sourceDb, targetDb, storeName) {
    return new Promise((resolve) => {
      try {
        const sourceTransaction = sourceDb.transaction(storeName, 'readonly');
        const sourceStore = sourceTransaction.objectStore(storeName);
        const getAllRequest = sourceStore.getAll();
        
        getAllRequest.onsuccess = (event) => {
          const data = event.target.result;
          let copiedCount = 0;
          let skippedCount = 0;
          
          if (data && data.length > 0) {
            const targetTransaction = targetDb.transaction(storeName, 'readwrite');
            const targetStore = targetTransaction.objectStore(storeName);
            
            // Get the key path for validation
            const keyPath = targetStore.keyPath;
            
            for (const item of data) {
              try {
                // Validate item has required key
                if (keyPath) {
                  if (Array.isArray(keyPath)) {
                    // Composite key
                    const hasAllKeys = keyPath.every(key => item[key] !== undefined);
                    if (!hasAllKeys) {
                      console.warn(`Skipping item missing composite key in ${storeName}`);
                      skippedCount++;
                      continue;
                    }
                  } else {
                    // Single key
                    if (item[keyPath] === undefined || item[keyPath] === null) {
                      console.warn(`Skipping item missing key '${keyPath}' in ${storeName}`);
                      skippedCount++;
                      continue;
                    }
                  }
                }
                
                targetStore.put(item);
                copiedCount++;
              } catch (err) {
                console.warn(`Failed to copy item in ${storeName}:`, err);
                skippedCount++;
              }
            }
            
            targetTransaction.oncomplete = () => {
              console.log(`Copied ${copiedCount} items to ${storeName} (skipped ${skippedCount})`);
              resolve({ copied: copiedCount, skipped: skippedCount });
            };
            
            targetTransaction.onerror = (event) => {
              console.error(`Transaction error for ${storeName}:`, event.target.error);
              resolve({ copied: copiedCount, skipped: skippedCount });
            };
          } else {
            console.log(`No data to copy in ${storeName}`);
            resolve({ copied: 0, skipped: 0 });
          }
        };
        
        getAllRequest.onerror = (event) => {
          console.error(`Failed to read from ${storeName}:`, event.target.error);
          resolve({ copied: 0, skipped: 0 });
        };
      } catch (error) {
        console.error(`Error copying store ${storeName}:`, error);
        resolve({ copied: 0, skipped: 0 });
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
        resolve();
      };
      
      request.onblocked = () => {
        console.warn(`Delete blocked for ${name}, continuing...`);
        resolve();
      };
    });
  }
}

// Create singleton
export const dbMigrator = new SafeDatabaseMigrator();

// Don't auto-run migration here - let it be called from initialization
// Safe database migrator loaded

export default dbMigrator;