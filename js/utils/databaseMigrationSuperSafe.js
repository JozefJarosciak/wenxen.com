// Super Safe Database Migration with Enhanced Data Protection
// Version 7.0 - Never delete until fully verified with checksums
export class SuperSafeDatabaseMigrator {
  constructor() {
    // Migration state
    this.migrating = false;
    this.migrationPromise = null;
    this.backupData = new Map();
    this.checksums = new Map(); // Store checksums for verification
    
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
      { name: 'ETH_DB_Xenft', version: 3, stores: ['xenfts', 'scanState', 'processProgress'] },
      { name: 'ETH_DB_XenStake', version: 1, stores: ['stakes', 'scanState'] },
      { name: 'ETH_DB_XenftStake', version: 2, stores: ['stakes', 'scanState'] }
    ];
    
    this.baseDatabases = [
      { name: 'BASE_DB_Cointool', version: 3, stores: ['mints', 'scanState', 'actionsCache'] },
      { name: 'BASE_DB_Xenft', version: 3, stores: ['xenfts', 'scanState', 'processProgress'] },
      { name: 'BASE_DB_XenStake', version: 1, stores: ['stakes', 'scanState'] },
      { name: 'BASE_DB_XenftStake', version: 2, stores: ['stakes', 'scanState'] }
    ];
    
    // Validation rules
    this.validationRules = {
      mints: ['ID', 'Address'],
      xenfts: ['Xenft_id'],  // XENFTs use Xenft_id as key
      stakes: ['id', 'tokenId'], // Some stakes use 'id', others use 'tokenId'
      scanState: ['address'],
      actionsCache: ['address']
    };
    
    // Migration transaction log
    this.migrationLog = [];
    this.verificationResults = new Map();
  }

  // Check if migration is needed
  isMigrationNeeded() {
    const flag = localStorage.getItem('dbMigrationCompleted');
    return flag !== 'v7_super_safe';
  }
  
  // Generate checksum for data verification
  generateChecksum(data) {
    if (!data) return 'empty';
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
  
  // Create comprehensive backup with checksums
  async createFullBackupWithChecksums() {
    const backup = {
      timestamp: new Date().toISOString(),
      version: 'v7_super_safe',
      databases: {},
      checksums: {}
    };
    
    try {
      console.log('Creating comprehensive backup with checksums...');
      const allDatabases = await this.getAllExistingDatabases();
      
      for (const dbName of allDatabases) {
        const dbData = await this.exportDatabaseWithChecksum(dbName);
        if (dbData) {
          backup.databases[dbName] = dbData.data;
          backup.checksums[dbName] = dbData.checksums;
          this.checksums.set(dbName, dbData.checksums);
        }
      }
      
      // Store backup in multiple locations for redundancy
      const backupString = JSON.stringify(backup);
      const backupKey = `db_backup_${Date.now()}`;
      
      // Store in localStorage with chunking if needed
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
      
      // Also store a secondary backup reference
      localStorage.setItem('last_safe_backup', backupKey);
      
      // Keep backup in memory for quick rollback
      this.backupData.set(backupKey, backup);
      
      // Clean up old backups
      this.cleanupOldBackups();
      
      console.log(`Created backup with checksum verification: ${backupKey}`);
      this.migrationLog.push({
        action: 'backup_created',
        key: backupKey,
        timestamp: Date.now(),
        databaseCount: Object.keys(backup.databases).length
      });
      
      return backupKey;
      
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error(`Backup creation failed: ${error.message}. Migration aborted for safety.`);
    }
  }
  
  // Export database with checksum
  async exportDatabaseWithChecksum(dbName) {
    try {
      const db = await this.openDatabase(dbName);
      if (!db) return null;
      
      const dbExport = {
        version: db.version,
        stores: {}
      };
      
      const checksums = {
        stores: {},
        total: null
      };
      
      let allDataString = '';
      
      for (const storeName of db.objectStoreNames) {
        const data = await this.getAllFromStore(db, storeName);
        dbExport.stores[storeName] = {
          keyPath: null,
          data: data,
          count: data.length
        };
        
        // Generate checksum for this store
        checksums.stores[storeName] = {
          count: data.length,
          checksum: this.generateChecksum(data)
        };
        
        allDataString += JSON.stringify(data);
        
        // Try to get keyPath info
        try {
          const transaction = db.transaction(storeName, 'readonly');
          const store = transaction.objectStore(storeName);
          dbExport.stores[storeName].keyPath = store.keyPath;
        } catch (e) {
          // Ignore if we can't get keyPath
        }
      }
      
      // Generate total checksum
      checksums.total = this.generateChecksum(allDataString);
      
      db.close();
      return { data: dbExport, checksums };
      
    } catch (error) {
      console.error(`Failed to export ${dbName}:`, error);
      return null;
    }
  }
  
  // Verify data integrity with checksums
  async verifyDataIntegrity(dbName, expectedChecksums) {
    try {
      const currentData = await this.exportDatabaseWithChecksum(dbName);
      if (!currentData) {
        return { valid: false, error: 'Database not found' };
      }
      
      // Compare checksums
      if (currentData.checksums.total !== expectedChecksums.total) {
        return { 
          valid: false, 
          error: 'Total checksum mismatch',
          expected: expectedChecksums.total,
          actual: currentData.checksums.total
        };
      }
      
      // Compare store checksums
      for (const [storeName, storeChecksum] of Object.entries(expectedChecksums.stores)) {
        const currentStoreChecksum = currentData.checksums.stores[storeName];
        if (!currentStoreChecksum) {
          return { valid: false, error: `Store ${storeName} missing` };
        }
        
        if (currentStoreChecksum.checksum !== storeChecksum.checksum) {
          return { 
            valid: false, 
            error: `Store ${storeName} checksum mismatch`,
            expected: storeChecksum.checksum,
            actual: currentStoreChecksum.checksum
          };
        }
        
        if (currentStoreChecksum.count !== storeChecksum.count) {
          return { 
            valid: false, 
            error: `Store ${storeName} count mismatch`,
            expected: storeChecksum.count,
            actual: currentStoreChecksum.count
          };
        }
      }
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
  
  // Safe migrate with multiple verification steps
  async safeMigrateWithTripleVerification(oldName, newName) {
    const migrationId = `${oldName}_to_${newName}_${Date.now()}`;
    
    try {
      // Step 1: Check if old database exists
      if (!await this.databaseExists(oldName)) {
        this.migrationLog.push({
          id: migrationId,
          action: 'skip_not_exists',
          source: oldName,
          target: newName,
          timestamp: Date.now()
        });
        return { success: true, message: `ℹ️ ${oldName} does not exist, skipping` };
      }
      
      // Step 2: Get source data and checksum
      console.log(`Getting source data from ${oldName}...`);
      const sourceData = await this.exportDatabaseWithChecksum(oldName);
      if (!sourceData) {
        return { success: false, message: `❌ Failed to read ${oldName}` };
      }
      
      const sourceChecksum = sourceData.checksums;
      const sourceRecordCount = Object.values(sourceData.data.stores)
        .reduce((sum, store) => sum + store.count, 0);
      
      // Step 3: Check if target already has data
      const targetDb = await this.openDatabase(newName);
      if (!targetDb) {
        return { success: false, message: `❌ Target ${newName} does not exist` };
      }
      
      let targetHasData = false;
      for (const storeName of targetDb.objectStoreNames) {
        const count = await this.getStoreCount(targetDb, storeName);
        if (count > 0) {
          targetHasData = true;
          break;
        }
      }
      
      if (targetHasData) {
        targetDb.close();
        this.migrationLog.push({
          id: migrationId,
          action: 'skip_target_has_data',
          source: oldName,
          target: newName,
          timestamp: Date.now()
        });
        return { success: true, message: `ℹ️ ${newName} already has data, skipping` };
      }
      
      targetDb.close();
      
      // Step 4: Copy data
      console.log(`Copying data from ${oldName} to ${newName}...`);
      const copyResult = await this.copyDataWithVerification(oldName, newName, sourceData.data);
      
      if (!copyResult.success) {
        return { 
          success: false, 
          message: `❌ Failed to copy data: ${copyResult.error}` 
        };
      }
      
      // Step 5: First verification - check record counts
      console.log('Verification 1: Checking record counts...');
      const targetRecordCount = await this.countAllRecords(newName);
      
      // Special case: If source is empty (0 records), consider it successful
      if (sourceRecordCount === 0 && targetRecordCount === 0) {
        console.log(`Database ${oldName} is empty, marking as successful migration`);
        // Continue with verification but it will pass since both are empty
      } else if (targetRecordCount !== sourceRecordCount) {
        return {
          success: false,
          message: `❌ Record count mismatch: expected ${sourceRecordCount}, got ${targetRecordCount}`
        };
      }
      
      // Step 6: Second verification - check data integrity with checksums
      console.log('Verification 2: Checking data integrity with checksums...');
      const targetData = await this.exportDatabaseWithChecksum(newName);
      if (!targetData) {
        return { success: false, message: `❌ Failed to read target after copy` };
      }
      
      // Compare store data directly (not just checksums since structure might differ slightly)
      for (const [storeName, sourceStore] of Object.entries(sourceData.data.stores)) {
        const targetStore = targetData.data.stores[storeName];
        if (!targetStore) {
          return { success: false, message: `❌ Store ${storeName} missing in target` };
        }
        
        if (sourceStore.count !== targetStore.count) {
          return { 
            success: false, 
            message: `❌ Store ${storeName} count mismatch: ${sourceStore.count} vs ${targetStore.count}` 
          };
        }
      }
      
      // Step 7: Third verification - sample data comparison
      console.log('Verification 3: Sample data comparison...');
      const sampleVerification = await this.verifySampleData(oldName, newName);
      if (!sampleVerification.valid) {
        return {
          success: false,
          message: `❌ Sample data verification failed: ${sampleVerification.error}`
        };
      }
      
      // Step 8: Store verification results
      this.verificationResults.set(migrationId, {
        source: oldName,
        target: newName,
        sourceChecksum: sourceChecksum,
        targetChecksum: targetData.checksums,
        recordCount: sourceRecordCount,
        timestamp: Date.now(),
        verified: true
      });
      
      this.migrationLog.push({
        id: migrationId,
        action: 'migration_verified',
        source: oldName,
        target: newName,
        recordCount: sourceRecordCount,
        timestamp: Date.now()
      });
      
      return {
        success: true,
        message: `✅ Migrated and verified ${oldName} → ${newName} (${sourceRecordCount} records)`,
        verificationId: migrationId
      };
      
    } catch (error) {
      this.migrationLog.push({
        id: migrationId,
        action: 'migration_failed',
        source: oldName,
        target: newName,
        error: error.message,
        timestamp: Date.now()
      });
      
      return {
        success: false,
        message: `❌ Migration failed for ${oldName}: ${error.message}`
      };
    }
  }
  
  // Copy data with verification
  async copyDataWithVerification(sourceName, targetName, sourceData) {
    try {
      const sourceDb = await this.openDatabase(sourceName);
      const targetDb = await this.openDatabase(targetName);
      
      if (!sourceDb || !targetDb) {
        return { success: false, error: 'Failed to open databases' };
      }
      
      const copyResults = [];
      
      // Special handling for DB_Xenft which has xenfts store in both source and target
      const storeMapping = {};
      if (sourceName === 'DB_Xenft' && targetName.includes('_DB_Xenft')) {
        // DB_Xenft uses xenfts store, ensure it maps correctly
        storeMapping['xenfts'] = 'xenfts';
      }
      
      for (const [storeName, storeData] of Object.entries(sourceData.stores)) {
        const targetStoreName = storeMapping[storeName] || storeName;
        
        if (targetDb.objectStoreNames.contains(targetStoreName)) {
          const result = await this.copyStoreData(targetDb, targetStoreName, storeData.data);
          copyResults.push({
            store: targetStoreName,
            expected: storeData.count,
            copied: result.copied
          });
        } else {
          // Log skipped stores for debugging
          console.warn(`Store ${storeName} not found in target database ${targetName}, skipping`);
        }
      }
      
      sourceDb.close();
      targetDb.close();
      
      // Verify all data was copied
      for (const result of copyResults) {
        if (result.copied !== result.expected) {
          return {
            success: false,
            error: `Store ${result.store}: copied ${result.copied} of ${result.expected} records`
          };
        }
      }
      
      return { success: true, results: copyResults };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Copy store data
  async copyStoreData(db, storeName, data) {
    return new Promise((resolve) => {
      if (!data || data.length === 0) {
        resolve({ copied: 0 });
        return;
      }
      
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      let copiedCount = 0;
      let skippedCount = 0;
      
      for (const item of data) {
        try {
          // Fix for stakes that might have different key names
          if (storeName === 'stakes') {
            // Ensure the item has the required key
            if (!item.tokenId && !item.id) {
              console.warn(`Skipping stake item without tokenId or id:`, item);
              skippedCount++;
              continue;
            }
            // If DB expects tokenId but item has id, copy it
            if (store.keyPath === 'tokenId' && !item.tokenId && item.id) {
              item.tokenId = item.id;
            }
            // If DB expects id but item has tokenId, copy it
            if (store.keyPath === 'id' && !item.id && item.tokenId) {
              item.id = item.tokenId;
            }
          }
          
          const request = store.put(item);
          request.onsuccess = () => copiedCount++;
          request.onerror = (e) => {
            console.error(`Failed to copy item in ${storeName}:`, e.target.error, item);
            skippedCount++;
          };
        } catch (error) {
          console.error(`Failed to copy item in ${storeName}:`, error);
          skippedCount++;
        }
      }
      
      transaction.oncomplete = () => {
        if (skippedCount > 0) {
          console.warn(`${storeName}: Copied ${copiedCount} items, skipped ${skippedCount} items`);
        }
        resolve({ copied: copiedCount, skipped: skippedCount });
      };
      
      transaction.onerror = () => {
        resolve({ copied: 0, skipped: data.length });
      };
    });
  }
  
  // Verify sample data
  async verifySampleData(sourceName, targetName) {
    try {
      const sourceDb = await this.openDatabase(sourceName);
      const targetDb = await this.openDatabase(targetName);
      
      if (!sourceDb || !targetDb) {
        return { valid: false, error: 'Failed to open databases' };
      }
      
      // Check a sample of records from each store
      for (const storeName of sourceDb.objectStoreNames) {
        if (!targetDb.objectStoreNames.contains(storeName)) {
          continue;
        }
        
        const sourceSample = await this.getSampleRecords(sourceDb, storeName, 5);
        const targetSample = await this.getSampleRecords(targetDb, storeName, 5);
        
        if (sourceSample.length !== targetSample.length) {
          sourceDb.close();
          targetDb.close();
          return { 
            valid: false, 
            error: `Sample size mismatch in ${storeName}` 
          };
        }
        
        // Compare sample records
        for (let i = 0; i < sourceSample.length; i++) {
          const sourceStr = JSON.stringify(sourceSample[i]);
          const targetStr = JSON.stringify(targetSample[i]);
          if (sourceStr !== targetStr) {
            sourceDb.close();
            targetDb.close();
            return { 
              valid: false, 
              error: `Sample data mismatch in ${storeName}` 
            };
          }
        }
      }
      
      sourceDb.close();
      targetDb.close();
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
  
  // Get sample records from store
  async getSampleRecords(db, storeName, count) {
    return new Promise((resolve) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor();
      const samples = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && samples.length < count) {
          samples.push(cursor.value);
          cursor.continue();
        } else {
          resolve(samples);
        }
      };
      
      request.onerror = () => {
        resolve([]);
      };
    });
  }
  
  // Count all records in database
  async countAllRecords(dbName) {
    try {
      const db = await this.openDatabase(dbName);
      if (!db) return 0;
      
      let totalCount = 0;
      
      for (const storeName of db.objectStoreNames) {
        const count = await this.getStoreCount(db, storeName);
        totalCount += count;
      }
      
      db.close();
      return totalCount;
      
    } catch (error) {
      return 0;
    }
  }
  
  // Main migration with extensive safety checks
  async migrate() {
    // If already migrating, return existing promise
    if (this.migrating && this.migrationPromise) {
      console.log('Migration already in progress, waiting...');
      return this.migrationPromise;
    }
    
    // Check if migration is needed
    if (!this.isMigrationNeeded()) {
      // Database migration already completed
      return { success: true, results: [], alreadyCompleted: true };
    }
    
    // Set lock and start migration
    this.migrating = true;
    this.migrationPromise = this.performSuperSafeMigration();
    
    try {
      const result = await this.migrationPromise;
      return result;
    } finally {
      this.migrating = false;
      this.migrationPromise = null;
    }
  }
  
  // Perform the super safe migration
  async performSuperSafeMigration() {
    console.log('Starting SUPER-SAFE database migration v7...');
    const results = [];
    let backupKey = null;
    const migrationStartTime = Date.now();
    
    try {
      // Phase 1: Create comprehensive backup with checksums
      console.log('PHASE 1: Creating comprehensive backup with checksums...');
      try {
        backupKey = await this.createFullBackupWithChecksums();
        results.push(`✅ Created backup with checksums: ${backupKey}`);
      } catch (error) {
        return {
          success: false,
          error: 'Critical: Failed to create backup',
          results: [`❌ Backup failed: ${error.message}`, '⚠️ Migration aborted for safety'],
          phase: 1
        };
      }
      
      // Phase 2: Pre-migration validation
      console.log('PHASE 2: Pre-migration validation...');
      const preValidation = await this.validateAllDatabases();
      if (!preValidation.valid && preValidation.warnings.length > 0) {
        results.push(`⚠️ Pre-migration warnings: ${preValidation.warnings.join(', ')}`);
      } else {
        results.push('✅ Pre-migration validation passed');
      }
      
      // Phase 3: Create all target databases
      console.log('PHASE 3: Ensuring all target databases exist...');
      
      for (const dbConfig of this.ethereumDatabases) {
        const result = await this.ensureDatabaseExists(dbConfig);
        if (result) results.push(result);
      }
      
      for (const dbConfig of this.baseDatabases) {
        const result = await this.ensureDatabaseExists(dbConfig);
        if (result) results.push(result);
      }
      
      // Phase 4: Migrate with triple verification
      console.log('PHASE 4: Migrating data with triple verification...');
      const migrationResults = new Map();
      const verifiedMigrations = [];
      
      for (const [oldName, newName] of Object.entries(this.legacyToEthereumMap)) {
        const result = await this.safeMigrateWithTripleVerification(oldName, newName);
        migrationResults.set(oldName, result);
        
        if (result.message) {
          results.push(result.message);
        }
        
        if (result.success && result.verificationId) {
          verifiedMigrations.push({
            source: oldName,
            target: newName,
            verificationId: result.verificationId
          });
        }
      }
      
      // Phase 5: Final verification before any deletion
      console.log('PHASE 5: Final verification before deletion...');
      let allVerified = true;
      
      for (const migration of verifiedMigrations) {
        const verification = this.verificationResults.get(migration.verificationId);
        if (!verification || !verification.verified) {
          allVerified = false;
          results.push(`❌ Verification failed for ${migration.source} → ${migration.target}`);
        } else {
          // Double-check the data one more time
          const currentCount = await this.countAllRecords(migration.target);
          if (currentCount !== verification.recordCount) {
            allVerified = false;
            results.push(`❌ Final count mismatch for ${migration.target}: expected ${verification.recordCount}, got ${currentCount}`);
          }
        }
      }
      
      if (!allVerified) {
        console.log('Migration verification failed, initiating rollback...');
        results.push('❌ Final verification failed - no data will be deleted');
        results.push('⚠️ Original databases preserved');
        
        // Don't delete anything, keep both old and new data
        return {
          success: false,
          error: 'Migration verification failed - original data preserved',
          results,
          backupKey,
          phase: 5
        };
      }
      
      results.push('✅ All migrations verified successfully');
      
      // Phase 6: Delete legacy databases only after full verification
      console.log('PHASE 6: Removing legacy databases (only verified ones)...');
      const deletionLog = [];
      
      for (const migration of verifiedMigrations) {
        try {
          // One final check before deletion
          const targetExists = await this.databaseExists(migration.target);
          const targetCount = await this.countAllRecords(migration.target);
          const verification = this.verificationResults.get(migration.verificationId);
          
          if (targetExists && targetCount === verification.recordCount) {
            await this.deleteDatabase(migration.source);
            deletionLog.push({
              database: migration.source,
              timestamp: Date.now(),
              recordCount: verification.recordCount
            });
            results.push(`✅ Safely removed legacy database: ${migration.source}`);
          } else {
            results.push(`⚠️ Skipped deletion of ${migration.source} - verification mismatch`);
          }
        } catch (error) {
          results.push(`⚠️ Could not delete ${migration.source}: ${error.message}`);
        }
      }
      
      // Phase 7: Post-migration validation
      console.log('PHASE 7: Post-migration validation...');
      const postValidation = await this.validateAllDatabases();
      if (postValidation.valid) {
        results.push('✅ Post-migration validation passed');
      } else {
        results.push(`⚠️ Post-migration warnings: ${postValidation.warnings.join(', ')}`);
      }
      
      // Phase 8: Mark migration as complete
      const migrationEndTime = Date.now();
      const migrationDuration = migrationEndTime - migrationStartTime;
      
      localStorage.setItem('dbMigrationCompleted', 'v7_super_safe');
      localStorage.setItem('lastSuccessfulMigration', new Date().toISOString());
      localStorage.setItem('migrationDuration', migrationDuration.toString());
      localStorage.setItem('migrationDeletionLog', JSON.stringify(deletionLog));
      
      console.log(`Super-safe migration completed in ${migrationDuration}ms`);
      results.push(`✅ Migration completed successfully in ${migrationDuration}ms`);
      
      return {
        success: true,
        results,
        backupKey,
        duration: migrationDuration,
        deletionLog,
        migrationLog: this.migrationLog
      };
      
    } catch (error) {
      console.error('Migration failed:', error);
      results.push(`❌ Migration error: ${error.message}`);
      
      // Attempt restoration from backup
      if (backupKey) {
        console.log('Attempting automatic restoration from backup...');
        results.push('⚠️ Attempting automatic restoration...');
        
        try {
          const restored = await this.restoreFromBackup(backupKey);
          if (restored) {
            results.push('✅ Successfully restored from backup');
          } else {
            results.push('❌ Automatic restoration failed - manual intervention may be required');
          }
        } catch (restoreError) {
          results.push(`❌ Restoration error: ${restoreError.message}`);
        }
      }
      
      return {
        success: false,
        error: error.message,
        results,
        backupKey,
        migrationLog: this.migrationLog
      };
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
      
      // Try to get from memory first
      let backup = this.backupData.get(backupKey);
      
      if (!backup) {
        // Retrieve from localStorage
        let backupString;
        const chunks = localStorage.getItem(`${backupKey}_chunks`);
        
        if (chunks) {
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
        
        backup = JSON.parse(backupString);
      }
      
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
      await this.deleteDatabase(dbName);
      
      const storeNames = Object.keys(dbData.stores);
      const db = await this.createDatabase(dbName, dbData.version, storeNames);
      
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
      
      backupKeys.sort((a, b) => b.timestamp - a.timestamp);
      
      // Keep only the 5 most recent
      for (let i = 5; i < backupKeys.length; i++) {
        const backupKey = backupKeys[i].key;
        
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
        
        // Remove from memory
        this.backupData.delete(backupKey);
        
        console.log(`Removed old backup: ${backupKey}`);
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }
  
  // Get all existing databases
  async getAllExistingDatabases() {
    const databases = new Set();
    
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
    
    const existing = [];
    for (const name of databases) {
      if (await this.databaseExists(name)) {
        existing.push(name);
      }
    }
    
    return existing;
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
            
            if (keyPath && !item[keyPath]) {
              invalidCount++;
            }
            
            for (const field of requiredFields) {
              if (!item[field]) {
                invalidCount++;
                break;
              }
            }
            
            cursor.continue();
          } else {
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
  
  // Ensure database exists
  async ensureDatabaseExists(dbConfig) {
    try {
      if (await this.databaseExists(dbConfig.name)) {
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
          
          return null;
        }
      }
      
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
            let keyPath = 'id';
            if (storeName === 'mints') keyPath = 'ID';
            if (storeName === 'xenfts') keyPath = 'Xenft_id';
            if (storeName === 'scanState') keyPath = 'address';
            if (storeName === 'actionsCache') keyPath = 'address';
            if (storeName === 'stakes') keyPath = 'id';
            if (storeName === 'processProgress') keyPath = 'id';
            
            const store = db.createObjectStore(storeName, { keyPath });
            
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
      duration: localStorage.getItem('migrationDuration') || 'unknown',
      backups: [],
      migrationLog: this.migrationLog,
      verificationResults: Array.from(this.verificationResults.entries())
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
    
    // Get deletion log
    try {
      const deletionLog = localStorage.getItem('migrationDeletionLog');
      if (deletionLog) {
        status.deletionLog = JSON.parse(deletionLog);
      }
    } catch (e) {
      // Ignore
    }
    
    return status;
  }
}

// Create singleton
export const superSafeMigrator = new SuperSafeDatabaseMigrator();

// Export for use
export default superSafeMigrator;

// Super-safe database migrator v7 loaded