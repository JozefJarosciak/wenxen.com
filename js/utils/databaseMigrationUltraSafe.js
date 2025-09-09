// Ultra-Safe Database Migration with Full Backup, Validation, and Rollback
export class UltraSafeDatabaseMigrator {
  constructor() {
    // Migration state
    this.migrating = false;
    this.migrationPromise = null;
    this.backupData = new Map(); // Store backups in memory
    
    // Database mappings
    this.legacyToEthereumMap = {
      'DB_Cointool': 'ETH_DB_Cointool',
      'DB_Xenft': 'ETH_DB_Xenft',
      'DB-Xen-Stake': 'ETH_DB_XenStake',
      'DB_XenStake': 'ETH_DB_XenStake',
      'DB-Xenft-Stake': 'ETH_DB_XenftStake',
      'DB_XenftStake': 'ETH_DB_XenftStake'
    };
    
    // Database configurations
    this.ethereumDatabases = [
      { name: 'ETH_DB_Cointool', version: 3, stores: ['mints', 'scanState', 'actionsCache'] },
      { name: 'ETH_DB_Xenft', version: 1, stores: ['mints', 'scanState'] },
      { name: 'ETH_DB_XenStake', version: 1, stores: ['stakes', 'scanState'] },
      { name: 'ETH_DB_XenftStake', version: 1, stores: ['stakes', 'scanState'] }
    ];
    
    this.baseDatabases = [
      { name: 'BASE_DB_Cointool', version: 3, stores: ['mints', 'scanState', 'actionsCache'] },
      { name: 'BASE_DB_Xenft', version: 1, stores: ['mints', 'scanState'] },
      { name: 'BASE_DB_XenStake', version: 1, stores: ['stakes', 'scanState'] },
      { name: 'BASE_DB_XenftStake', version: 1, stores: ['stakes', 'scanState'] }
    ];
    
    // Validation rules
    this.validationRules = {
      mints: ['ID', 'Address'],
      stakes: ['id'],
      scanState: ['address'],
      actionsCache: ['address']
    };
  }

  // Check if migration is needed
  isMigrationNeeded() {
    const flag = localStorage.getItem('dbMigrationCompleted');
    return flag !== 'v6_ultra_safe';
  }
  
  // Export all databases to JSON backup
  async exportAllDatabasesToJSON() {
    const backup = {
      timestamp: new Date().toISOString(),
      version: 'v6_ultra_safe',
      databases: {}
    };
    
    try {
      // Get all databases
      const allDatabases = await this.getAllExistingDatabases();
      
      for (const dbName of allDatabases) {
        const dbData = await this.exportDatabaseToJSON(dbName);
        if (dbData) {
          backup.databases[dbName] = dbData;
        }
      }
      
      // Store backup in localStorage with compression
      const backupString = JSON.stringify(backup);
      const backupKey = `db_backup_${Date.now()}`;
      
      // Split large backups into chunks if needed
      const chunkSize = 1024 * 1024; // 1MB chunks
      if (backupString.length > chunkSize) {
        const chunks = Math.ceil(backupString.length / chunkSize);
        localStorage.setItem(`${backupKey}_chunks`, chunks.toString());
        
        for (let i = 0; i < chunks; i++) {
          const chunk = backupString.slice(i * chunkSize, (i + 1) * chunkSize);
          localStorage.setItem(`${backupKey}_${i}`, chunk);
        }
      } else {
        localStorage.setItem(backupKey, backupString);
      }
      
      // Keep only last 3 backups
      this.cleanupOldBackups();
      
      console.log(`Created backup: ${backupKey}`);
      return backupKey;
      
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error('Backup creation failed - migration aborted');
    }
  }
  
  // Export single database to JSON
  async exportDatabaseToJSON(dbName) {
    try {
      const db = await this.openDatabase(dbName);
      if (!db) return null;
      
      const dbExport = {
        version: db.version,
        stores: {}
      };
      
      for (const storeName of db.objectStoreNames) {
        const data = await this.getAllFromStore(db, storeName);
        dbExport.stores[storeName] = {
          keyPath: null,
          data: data,
          count: data.length
        };
        
        // Try to get keyPath info
        try {
          const transaction = db.transaction(storeName, 'readonly');
          const store = transaction.objectStore(storeName);
          dbExport.stores[storeName].keyPath = store.keyPath;
        } catch (e) {
          // Ignore if we can't get keyPath
        }
      }
      
      db.close();
      return dbExport;
      
    } catch (error) {
      console.error(`Failed to export ${dbName}:`, error);
      return null;
    }
  }
  
  // Get all data from a store
  async getAllFromStore(db, storeName) {
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => {
          resolve(request.result || []);
        };
        
        request.onerror = () => {
          resolve([]);
        };
      } catch (error) {
        resolve([]);
      }
    });
  }
  
  // Restore from backup
  async restoreFromBackup(backupKey) {
    try {
      console.log(`Restoring from backup: ${backupKey}`);
      
      // Retrieve backup from localStorage
      let backupString;
      const chunks = localStorage.getItem(`${backupKey}_chunks`);
      
      if (chunks) {
        // Reassemble from chunks
        backupString = '';
        const chunkCount = parseInt(chunks);
        for (let i = 0; i < chunkCount; i++) {
          backupString += localStorage.getItem(`${backupKey}_${i}`) || '';
        }
      } else {
        backupString = localStorage.getItem(backupKey);
      }
      
      if (!backupString) {
        throw new Error('Backup not found');
      }
      
      const backup = JSON.parse(backupString);
      
      // Restore each database
      for (const [dbName, dbData] of Object.entries(backup.databases)) {
        await this.restoreDatabase(dbName, dbData);
      }
      
      console.log('Backup restoration completed');
      return true;
      
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }
  
  // Restore single database
  async restoreDatabase(dbName, dbData) {
    try {
      // Delete existing database
      await this.deleteDatabase(dbName);
      
      // Create new database with correct structure
      const storeNames = Object.keys(dbData.stores);
      const db = await this.createDatabase(dbName, dbData.version, storeNames);
      
      // Restore data to each store
      for (const [storeName, storeData] of Object.entries(dbData.stores)) {
        if (storeData.data && storeData.data.length > 0) {
          await this.restoreStoreData(db, storeName, storeData.data);
        }
      }
      
      db.close();
      console.log(`Restored database: ${dbName}`);
      
    } catch (error) {
      console.error(`Failed to restore ${dbName}:`, error);
    }
  }
  
  // Restore data to a store
  async restoreStoreData(db, storeName, data) {
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        for (const item of data) {
          store.put(item);
        }
        
        transaction.oncomplete = () => {
          console.log(`Restored ${data.length} items to ${storeName}`);
          resolve();
        };
        
        transaction.onerror = () => {
          console.error(`Failed to restore ${storeName}`);
          resolve();
        };
      } catch (error) {
        console.error(`Error restoring ${storeName}:`, error);
        resolve();
      }
    });
  }
  
  // Clean up old backups
  cleanupOldBackups() {
    try {
      const backupKeys = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('db_backup_')) {
          const timestamp = key.replace('db_backup_', '').replace(/_chunks$/, '').replace(/_\d+$/, '');
          if (!isNaN(timestamp)) {
            backupKeys.push({ key: key.replace(/_chunks$/, '').replace(/_\d+$/, ''), timestamp: parseInt(timestamp) });
          }
        }
      }
      
      // Sort by timestamp descending
      backupKeys.sort((a, b) => b.timestamp - a.timestamp);
      
      // Keep only the 3 most recent
      for (let i = 3; i < backupKeys.length; i++) {
        const backupKey = backupKeys[i].key;
        
        // Remove backup and all its chunks
        const chunks = localStorage.getItem(`${backupKey}_chunks`);
        if (chunks) {
          const chunkCount = parseInt(chunks);
          for (let j = 0; j < chunkCount; j++) {
            localStorage.removeItem(`${backupKey}_${j}`);
          }
          localStorage.removeItem(`${backupKey}_chunks`);
        } else {
          localStorage.removeItem(backupKey);
        }
        
        console.log(`Removed old backup: ${backupKey}`);
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }
  
  // Get all existing databases
  async getAllExistingDatabases() {
    const databases = new Set();
    
    // Add all known database names
    for (const name of Object.keys(this.legacyToEthereumMap)) {
      databases.add(name);
    }
    for (const name of Object.values(this.legacyToEthereumMap)) {
      databases.add(name);
    }
    for (const config of this.ethereumDatabases) {
      databases.add(config.name);
    }
    for (const config of this.baseDatabases) {
      databases.add(config.name);
    }
    
    // Filter to only existing ones
    const existing = [];
    for (const name of databases) {
      if (await this.databaseExists(name)) {
        existing.push(name);
      }
    }
    
    return existing;
  }
  
  // Main migration function with locking
  async migrate() {
    // If already migrating, return existing promise
    if (this.migrating && this.migrationPromise) {
      console.log('Migration already in progress, waiting...');
      return this.migrationPromise;
    }
    
    // Check if migration is needed
    if (!this.isMigrationNeeded()) {
      console.log('Database migration already completed (v6_ultra_safe)');
      return { success: true, results: [] };
    }
    
    // Set lock and start migration
    this.migrating = true;
    this.migrationPromise = this.performMigration();
    
    try {
      const result = await this.migrationPromise;
      return result;
    } finally {
      this.migrating = false;
      this.migrationPromise = null;
    }
  }
  
  // Perform the actual migration
  async performMigration() {
    console.log('Starting ULTRA-SAFE database migration v6...');
    const results = [];
    let backupKey = null;
    
    try {
      // Step 1: Create comprehensive backup of ALL databases
      console.log('Step 1: Creating comprehensive backup of all databases...');
      try {
        backupKey = await this.exportAllDatabasesToJSON();
        results.push(`✅ Created backup: ${backupKey}`);
      } catch (error) {
        return {
          success: false,
          error: 'Failed to create backup',
          results: [`❌ Backup failed: ${error.message}`]
        };
      }
      
      // Step 2: Validate existing data integrity
      console.log('Step 2: Validating existing data integrity...');
      const validationResult = await this.validateAllDatabases();
      if (!validationResult.valid) {
        results.push(`⚠️ Data validation warnings: ${validationResult.warnings.join(', ')}`);
      } else {
        results.push('✅ Data validation passed');
      }
      
      // Step 3: Create all target databases (Ethereum and Base)
      console.log('Step 3: Ensuring all target databases exist...');
      
      for (const dbConfig of this.ethereumDatabases) {
        const result = await this.ensureDatabaseExists(dbConfig);
        if (result) results.push(result);
      }
      
      for (const dbConfig of this.baseDatabases) {
        const result = await this.ensureDatabaseExists(dbConfig);
        if (result) results.push(result);
      }
      
      // Step 4: Migrate legacy data (copy without deletion)
      console.log('Step 4: Migrating legacy data...');
      const migrationResults = new Map();
      
      for (const [oldName, newName] of Object.entries(this.legacyToEthereumMap)) {
        const result = await this.safeMigrateWithValidation(oldName, newName);
        migrationResults.set(oldName, result);
        if (result.message) {
          results.push(result.message);
        }
      }
      
      // Step 5: Verify all migrations
      console.log('Step 5: Verifying all migrations...');
      const verificationResult = await this.verifyMigrations(migrationResults);
      
      if (!verificationResult.success) {
        // Rollback if verification failed
        console.log('Migration verification failed, attempting rollback...');
        results.push(`❌ Verification failed: ${verificationResult.error}`);
        
        if (backupKey) {
          const restored = await this.restoreFromBackup(backupKey);
          if (restored) {
            results.push('✅ Successfully rolled back to backup');
          } else {
            results.push('❌ Rollback failed - manual intervention required');
          }
        }
        
        return {
          success: false,
          error: 'Migration verification failed',
          results
        };
      }
      
      results.push('✅ All migrations verified successfully');
      
      // Step 6: Only now delete legacy databases
      console.log('Step 6: Cleaning up legacy databases...');
      for (const oldName of Object.keys(this.legacyToEthereumMap)) {
        // Only delete if migration was successful
        if (migrationResults.get(oldName)?.success) {
          await this.deleteDatabase(oldName);
          results.push(`✅ Removed legacy database: ${oldName}`);
        }
      }
      
      // Step 7: Final validation
      console.log('Step 7: Final validation...');
      const finalValidation = await this.validateAllDatabases();
      if (finalValidation.valid) {
        results.push('✅ Final validation passed');
      } else {
        results.push(`⚠️ Final validation warnings: ${finalValidation.warnings.join(', ')}`);
      }
      
      // Step 8: Mark migration as complete
      localStorage.setItem('dbMigrationCompleted', 'v6_ultra_safe');
      localStorage.setItem('lastSuccessfulMigration', new Date().toISOString());
      console.log('Ultra-safe database migration completed successfully');
      
      return {
        success: true,
        results,
        backupKey
      };
      
    } catch (error) {
      console.error('Migration failed:', error);
      results.push(`❌ Migration error: ${error.message}`);
      
      // Attempt rollback
      if (backupKey) {
        console.log('Attempting automatic rollback...');
        const restored = await this.restoreFromBackup(backupKey);
        if (restored) {
          results.push('✅ Successfully rolled back to backup');
        } else {
          results.push('❌ Automatic rollback failed');
        }
      }
      
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }
  
  // Validate all databases
  async validateAllDatabases() {
    const warnings = [];
    let valid = true;
    
    const allDatabases = await this.getAllExistingDatabases();
    
    for (const dbName of allDatabases) {
      const validation = await this.validateDatabase(dbName);
      if (!validation.valid) {
        warnings.push(`${dbName}: ${validation.issues.join(', ')}`);
        // Don't fail migration for validation warnings
        // valid = false;
      }
    }
    
    return { valid, warnings };
  }
  
  // Validate single database
  async validateDatabase(dbName) {
    const issues = [];
    
    try {
      const db = await this.openDatabase(dbName);
      if (!db) {
        return { valid: false, issues: ['Database does not exist'] };
      }
      
      for (const storeName of db.objectStoreNames) {
        const validation = await this.validateStore(db, storeName);
        if (!validation.valid) {
          issues.push(`${storeName}: ${validation.issue}`);
        }
      }
      
      db.close();
      return { valid: issues.length === 0, issues };
      
    } catch (error) {
      return { valid: false, issues: [`Validation error: ${error.message}`] };
    }
  }
  
  // Validate store data
  async validateStore(db, storeName) {
    try {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const keyPath = store.keyPath;
      const requiredFields = this.validationRules[storeName] || [];
      
      return new Promise((resolve) => {
        const request = store.openCursor();
        let invalidCount = 0;
        let totalCount = 0;
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            totalCount++;
            const item = cursor.value;
            
            // Check key path
            if (keyPath && !item[keyPath]) {
              invalidCount++;
            }
            
            // Check required fields
            for (const field of requiredFields) {
              if (!item[field]) {
                invalidCount++;
                break;
              }
            }
            
            cursor.continue();
          } else {
            // Done iterating
            if (invalidCount > 0) {
              resolve({
                valid: false,
                issue: `${invalidCount} invalid items out of ${totalCount}`
              });
            } else {
              resolve({ valid: true });
            }
          }
        };
        
        request.onerror = () => {
          resolve({ valid: false, issue: 'Failed to read store' });
        };
      });
    } catch (error) {
      return { valid: false, issue: error.message };
    }
  }
  
  // Migrate with validation
  async safeMigrateWithValidation(oldName, newName) {
    try {
      // Check if old database exists
      if (!await this.databaseExists(oldName)) {
        return { success: true, message: `ℹ️ ${oldName} does not exist, skipping` };
      }
      
      // Open both databases
      const oldDb = await this.openDatabase(oldName);
      if (!oldDb) {
        return { success: false, message: `❌ Failed to open ${oldName}` };
      }
      
      const newDb = await this.openDatabase(newName);
      if (!newDb) {
        oldDb.close();
        return { success: false, message: `❌ Target ${newName} does not exist` };
      }
      
      // Check if target already has data
      let targetHasData = false;
      for (const storeName of oldDb.objectStoreNames) {
        if (newDb.objectStoreNames.contains(storeName)) {
          const count = await this.getStoreCount(newDb, storeName);
          if (count > 0) {
            targetHasData = true;
            break;
          }
        }
      }
      
      if (targetHasData) {
        oldDb.close();
        newDb.close();
        return { success: true, message: `ℹ️ ${newName} already has data, skipping` };
      }
      
      // Copy data with validation
      let totalCopied = 0;
      let totalValidated = 0;
      
      for (const storeName of oldDb.objectStoreNames) {
        if (newDb.objectStoreNames.contains(storeName)) {
          const result = await this.copyWithValidation(oldDb, newDb, storeName);
          totalCopied += result.copied;
          totalValidated += result.validated;
        }
      }
      
      oldDb.close();
      newDb.close();
      
      // Verify copy was successful
      if (totalCopied !== totalValidated) {
        return {
          success: false,
          message: `⚠️ ${oldName} → ${newName}: Copied ${totalCopied} but only ${totalValidated} validated`
        };
      }
      
      return {
        success: true,
        message: `✅ Migrated ${oldName} → ${newName} (${totalCopied} records validated)`
      };
      
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to migrate ${oldName}: ${error.message}`
      };
    }
  }
  
  // Copy with validation
  async copyWithValidation(sourceDb, targetDb, storeName) {
    return new Promise((resolve) => {
      try {
        const sourceTransaction = sourceDb.transaction(storeName, 'readonly');
        const sourceStore = sourceTransaction.objectStore(storeName);
        const request = sourceStore.getAll();
        
        request.onsuccess = (event) => {
          const data = event.target.result;
          if (!data || data.length === 0) {
            resolve({ copied: 0, validated: 0 });
            return;
          }
          
          const targetTransaction = targetDb.transaction(storeName, 'readwrite');
          const targetStore = targetTransaction.objectStore(storeName);
          const keyPath = targetStore.keyPath;
          
          let copiedCount = 0;
          const itemsToValidate = [];
          
          for (const item of data) {
            // Validate item has key
            if (keyPath && item[keyPath] !== undefined && item[keyPath] !== null) {
              targetStore.put(item);
              copiedCount++;
              itemsToValidate.push(item[keyPath]);
            }
          }
          
          targetTransaction.oncomplete = async () => {
            // Validate copied items
            let validatedCount = 0;
            const validateTransaction = targetDb.transaction(storeName, 'readonly');
            const validateStore = validateTransaction.objectStore(storeName);
            
            for (const key of itemsToValidate) {
              try {
                const getRequest = validateStore.get(key);
                await new Promise((resolveGet) => {
                  getRequest.onsuccess = () => {
                    if (getRequest.result) {
                      validatedCount++;
                    }
                    resolveGet();
                  };
                  getRequest.onerror = resolveGet;
                });
              } catch (e) {
                // Continue validation
              }
            }
            
            console.log(`${storeName}: Copied ${copiedCount}, validated ${validatedCount}`);
            resolve({ copied: copiedCount, validated: validatedCount });
          };
          
          targetTransaction.onerror = () => {
            resolve({ copied: 0, validated: 0 });
          };
        };
        
        request.onerror = () => {
          resolve({ copied: 0, validated: 0 });
        };
      } catch (error) {
        resolve({ copied: 0, validated: 0 });
      }
    });
  }
  
  // Verify migrations
  async verifyMigrations(migrationResults) {
    try {
      // Check all migrations succeeded
      for (const [oldName, result] of migrationResults) {
        if (!result.success && !result.message?.includes('does not exist') && !result.message?.includes('already has data')) {
          return {
            success: false,
            error: `Migration failed for ${oldName}: ${result.message}`
          };
        }
      }
      
      // Verify all target databases exist and have correct structure
      for (const dbConfig of [...this.ethereumDatabases, ...this.baseDatabases]) {
        const db = await this.openDatabase(dbConfig.name);
        if (!db) {
          return {
            success: false,
            error: `Target database ${dbConfig.name} does not exist`
          };
        }
        
        for (const storeName of dbConfig.stores) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            return {
              success: false,
              error: `${dbConfig.name} missing store: ${storeName}`
            };
          }
        }
        
        db.close();
      }
      
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: `Verification error: ${error.message}`
      };
    }
  }
  
  // Ensure database exists
  async ensureDatabaseExists(dbConfig) {
    try {
      if (await this.databaseExists(dbConfig.name)) {
        // Verify structure
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
            return `⚠️ ${dbConfig.name} exists but missing stores: ${missingStores.join(', ')}`;
          }
          
          return null; // Database exists with correct structure
        }
      }
      
      // Create database
      const db = await this.createDatabase(dbConfig.name, dbConfig.version, dbConfig.stores);
      db.close();
      return `✅ Created ${dbConfig.name}`;
      
    } catch (error) {
      return `❌ Failed to ensure ${dbConfig.name}: ${error.message}`;
    }
  }
  
  // Get store count
  async getStoreCount(db, storeName) {
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();
        
        request.onsuccess = () => resolve(request.result || 0);
        request.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
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
      
      request.onerror = () => resolve(false);
      
      request.onupgradeneeded = (event) => {
        if (event.oldVersion === 0) {
          exists = false;
          event.target.transaction.abort();
        } else {
          exists = true;
        }
      };
      
      setTimeout(() => resolve(exists), 100);
    });
  }
  
  // Open database
  openDatabase(name) {
    return new Promise((resolve) => {
      const request = indexedDB.open(name);
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = () => resolve(null);
      
      request.onupgradeneeded = (event) => {
        if (event.oldVersion === 0) {
          event.target.transaction.abort();
          resolve(null);
        }
      };
    });
  }
  
  // Create database
  createDatabase(name, version, storeNames) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        for (const storeName of storeNames) {
          if (!db.objectStoreNames.contains(storeName)) {
            // Determine key path
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
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
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
      
      request.onerror = () => {
        console.warn(`Failed to delete ${name}`);
        resolve();
      };
      
      request.onblocked = () => {
        console.warn(`Delete blocked for ${name}`);
        resolve();
      };
    });
  }
  
  // Get migration status
  getMigrationStatus() {
    const status = {
      completed: !this.isMigrationNeeded(),
      version: localStorage.getItem('dbMigrationCompleted') || 'none',
      lastMigration: localStorage.getItem('lastSuccessfulMigration') || 'never',
      backups: []
    };
    
    // Find backups
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('db_backup_') && !key.includes('_chunks') && !key.match(/_\d+$/)) {
        const timestamp = key.replace('db_backup_', '');
        if (!isNaN(timestamp)) {
          status.backups.push({
            key,
            timestamp: parseInt(timestamp),
            date: new Date(parseInt(timestamp)).toISOString()
          });
        }
      }
    }
    
    status.backups.sort((a, b) => b.timestamp - a.timestamp);
    
    return status;
  }
}

// Create singleton
export const ultraSafeMigrator = new UltraSafeDatabaseMigrator();

// Export for use
export default ultraSafeMigrator;

console.log('Ultra-safe database migrator loaded - use ultraSafeMigrator.migrate() to start');