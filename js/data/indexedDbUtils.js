// IndexedDB utilities - shared database operations
export const indexedDbUtils = {
  // Open database with upgrade handling
  async openDatabase(dbName, version, upgradeHandler) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        try {
          if (upgradeHandler) {
            upgradeHandler(db, event.oldVersion, event.newVersion);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
      
      request.onblocked = () => {
        console.warn(`Database ${dbName} is blocked. Close other tabs using this database.`);
      };
    });
  },

  // Save data to object store
  async saveToStore(db, storeName, data) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
        
        store.put(data);
      } catch (error) {
        reject(error);
      }
    });
  },

  // Get all data from object store
  async getAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = (event) => {
          resolve(event.target.result || []);
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },

  // Get data by key from object store
  async getFromStore(db, storeName, key) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = (event) => {
          resolve(event.target.result || null);
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },

  // Get data by index
  async getByIndex(db, storeName, indexName, key) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(key);
        
        request.onsuccess = (event) => {
          resolve(event.target.result || []);
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },

  // Delete data from object store
  async deleteFromStore(db, storeName, key) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
        
        store.delete(key);
      } catch (error) {
        reject(error);
      }
    });
  },

  // Clear entire object store
  async clearStore(db, storeName) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
        
        store.clear();
      } catch (error) {
        reject(error);
      }
    });
  },

  // Count records in store
  async countRecords(db, storeName, query = null) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = query ? store.count(query) : store.count();
        
        request.onsuccess = (event) => {
          resolve(event.target.result || 0);
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },

  // Batch operations
  async batchOperation(db, storeName, operations, mode = 'readwrite') {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
        
        operations.forEach(({ type, key, data }) => {
          switch (type) {
            case 'put':
              store.put(data);
              break;
            case 'add':
              store.add(data);
              break;
            case 'delete':
              store.delete(key);
              break;
            default:
              console.warn(`Unknown operation type: ${type}`);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  // Get database info
  async getDatabaseInfo(db) {
    const info = {
      name: db.name,
      version: db.version,
      objectStoreNames: Array.from(db.objectStoreNames)
    };
    
    // Get record counts for each store
    const counts = {};
    for (const storeName of info.objectStoreNames) {
      try {
        counts[storeName] = await this.countRecords(db, storeName);
      } catch (error) {
        console.warn(`Failed to count records in ${storeName}:`, error);
        counts[storeName] = 0;
      }
    }
    
    info.recordCounts = counts;
    return info;
  },

  // Check if IndexedDB is available
  isAvailable() {
    return 'indexedDB' in window && indexedDB !== null;
  },

  // Delete entire database
  async deleteDatabase(dbName) {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      
      deleteRequest.onsuccess = () => {
        console.log(`Database ${dbName} deleted successfully`);
        resolve();
      };
      
      deleteRequest.onerror = (event) => {
        console.error(`Failed to delete database ${dbName}:`, event.target.error);
        reject(event.target.error);
      };
      
      deleteRequest.onblocked = () => {
        console.warn(`Database ${dbName} deletion is blocked. Close other tabs using this database.`);
        reject(new Error('Database deletion blocked'));
      };
    });
  },

  // Migrate data between stores
  async migrateStore(db, fromStore, toStore, transformer = null) {
    try {
      const data = await this.getAllFromStore(db, fromStore);
      const operations = data.map(item => ({
        type: 'put',
        data: transformer ? transformer(item) : item
      }));
      
      await this.batchOperation(db, toStore, operations);
      console.log(`Migrated ${data.length} records from ${fromStore} to ${toStore}`);
      
      return data.length;
    } catch (error) {
      console.error(`Failed to migrate from ${fromStore} to ${toStore}:`, error);
      throw error;
    }
  }
};

// Specialized database classes
export class DatabaseManager {
  constructor(dbName, version, stores) {
    this.dbName = dbName;
    this.version = version;
    this.stores = stores;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;
    
    this.db = await indexedDbUtils.openDatabase(
      this.dbName, 
      this.version, 
      (db) => this.onUpgrade(db)
    );
    
    return this.db;
  }

  onUpgrade(db) {
    this.stores.forEach(({ name, keyPath, indexes = [] }) => {
      if (!db.objectStoreNames.contains(name)) {
        const store = db.createObjectStore(name, { keyPath });
        
        indexes.forEach(({ name: indexName, keyPath: indexKeyPath, options = {} }) => {
          store.createIndex(indexName, indexKeyPath, options);
        });
      }
    });
  }

  async save(storeName, data) {
    const db = await this.open();
    return indexedDbUtils.saveToStore(db, storeName, data);
  }

  async getAll(storeName) {
    const db = await this.open();
    return indexedDbUtils.getAllFromStore(db, storeName);
  }

  async get(storeName, key) {
    const db = await this.open();
    return indexedDbUtils.getFromStore(db, storeName, key);
  }

  async getByIndex(storeName, indexName, key) {
    const db = await this.open();
    return indexedDbUtils.getByIndex(db, storeName, indexName, key);
  }

  async delete(storeName, key) {
    const db = await this.open();
    return indexedDbUtils.deleteFromStore(db, storeName, key);
  }

  async clear(storeName) {
    const db = await this.open();
    return indexedDbUtils.clearStore(db, storeName);
  }

  async count(storeName) {
    const db = await this.open();
    return indexedDbUtils.countRecords(db, storeName);
  }

  async getInfo() {
    const db = await this.open();
    return indexedDbUtils.getDatabaseInfo(db);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Legacy global functions for backward compatibility - DO NOT override existing openDB
// The main_app.js has its own openDB() function for "DB_Cointool" database
if (typeof window.openDB === 'undefined') {
  window.openDB = (dbName, version, upgradeHandler) => indexedDbUtils.openDatabase(dbName, version, upgradeHandler);
}
window.clearStore = (db, storeName) => indexedDbUtils.clearStore(db, storeName);

export default indexedDbUtils;