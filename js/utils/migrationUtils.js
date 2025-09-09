// Migration utilities for moving from old localStorage format to chain-specific format

export function migrateOldLocalStorage() {
  console.log('Starting localStorage migration...');
  const migrations = [];
  
  // List of keys to migrate from old format to Ethereum-specific
  const keysToMigrate = {
    'ethAddress': 'ETHEREUM_ethAddress',
    'customRPC': 'ETHEREUM_customRPC',
    'chunkSize': 'ETHEREUM_chunkSize',
    'startBlock': 'ETHEREUM_startBlock',
    'endBlock': 'ETHEREUM_endBlock',
    'mintBatches': 'ETHEREUM_mintBatches',
    'mintTermDays': 'ETHEREUM_mintTermDays',
    'scanMode': 'ETHEREUM_scanMode',
    'scanHistory': 'ETHEREUM_scanHistory',
    'lastScanBlock': 'ETHEREUM_lastScanBlock',
    'savedFilters': 'ETHEREUM_savedFilters',
    'tableSettings': 'ETHEREUM_tableSettings',
    'bulkMintMode': 'ETHEREUM_bulkMintMode',
    'autoScanEnabled': 'ETHEREUM_autoScanEnabled',
    'scanInterval': 'ETHEREUM_scanInterval',
    'maxGasPrice': 'ETHEREUM_maxGasPrice',
    'selectedAddresses': 'ETHEREUM_selectedAddresses',
    'vmuChartExpanded': 'ETHEREUM_vmuChartExpanded',
    'calendarExpanded': 'ETHEREUM_calendarExpanded'
  };
  
  // Perform migration
  Object.entries(keysToMigrate).forEach(([oldKey, newKey]) => {
    const oldValue = localStorage.getItem(oldKey);
    
    if (oldValue !== null && oldValue !== undefined && oldValue !== '') {
      // Check if new key doesn't exist yet
      const existingNewValue = localStorage.getItem(newKey);
      
      if (!existingNewValue) {
        // Migrate the value
        localStorage.setItem(newKey, oldValue);
        migrations.push(`✅ Migrated ${oldKey} → ${newKey}`);
        
        // Remove the old key after successful migration
        localStorage.removeItem(oldKey);
      } else {
        migrations.push(`ℹ️ Skipped ${oldKey} (${newKey} already exists)`);
      }
    }
  });
  
  // Special handling for some keys that should remain global (not chain-specific)
  const globalKeys = [
    'etherscanApiKey',
    'theme',
    'etherscanApiKeyVisible',
    'ethAddressMasked', 
    'connectWalletMasked',
    'selectedChain',
    'deployVersion'
  ];
  
  globalKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) {
      migrations.push(`ℹ️ Kept ${key} as global (not chain-specific)`);
    }
  });
  
  // After migrating Ethereum data, also copy ethAddress to Base if it exists
  const ethereumAddress = localStorage.getItem('ETHEREUM_ethAddress');
  if (ethereumAddress && !localStorage.getItem('BASE_ethAddress')) {
    localStorage.setItem('BASE_ethAddress', ethereumAddress);
    migrations.push(`✅ Copied Ethereum address to Base`);
  }
  
  if (migrations.length > 0) {
    console.log('Migration completed:', migrations);
    
    // Set a flag to indicate migration has been done
    localStorage.setItem('migrationCompleted', 'v1');
  } else {
    console.log('No migration needed - data already in correct format');
  }
  
  return migrations;
}

// Check if migration is needed
export function isMigrationNeeded() {
  // Check if migration flag exists
  if (localStorage.getItem('migrationCompleted') === 'v1') {
    return false;
  }
  
  // Check if any old format keys exist
  const oldKeys = ['ethAddress', 'customRPC', 'chunkSize', 'startBlock', 'endBlock'];
  return oldKeys.some(key => localStorage.getItem(key) !== null);
}

// Don't auto-run - let initialization handle it

export default {
  migrateOldLocalStorage,
  isMigrationNeeded
};