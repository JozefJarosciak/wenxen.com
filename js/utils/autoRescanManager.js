// Centralized Auto-Rescan System
// Monitors wallet transactions and triggers automatic rescans after successful operations

(function() {
  const autoRescanManager = {
    scheduled: false,
    delay: 6000, // 6 seconds default
    
    // Schedule an auto-rescan after successful transaction
    scheduleRescan(txType, txHash) {
      if (this.scheduled) return; // Prevent multiple simultaneous rescans
      
      this.scheduled = true;
      console.log(`[Auto-Rescan] Scheduled rescan after ${txType} (tx: ${txHash})`);
      
      setTimeout(() => {
        this.scheduled = false;
        this.triggerRescan(txType);
      }, this.delay);
    },
    
    // Trigger the actual rescan
    triggerRescan(txType) {
      console.log(`[Auto-Rescan] Triggering rescan after ${txType}...`);
      
      // Try to click the scan button if it's available and not disabled
      const scanBtn = document.getElementById('scanBtn');
      if (scanBtn && !scanBtn.disabled && !scanBtn.hasAttribute('aria-busy')) {
        console.log('[Auto-Rescan] Clicking scan button...');
        scanBtn.click();
      } else {
        // Fallback: refresh the unified view
        console.log('[Auto-Rescan] Scan button unavailable, refreshing data...');
        if (typeof window.refreshUnified === 'function') {
          window.refreshUnified().catch(err => 
            console.error('[Auto-Rescan] Refresh failed:', err)
          );
        }
      }
    },
    
    // Monitor transaction and schedule rescan on success
    async monitorTransaction(txPromise, txType, tokenId = '') {
      try {
        const tx = await txPromise;
        const txHash = tx.transactionHash || tx.hash;
        
        // Show success toast
        if (typeof showToast === 'function') {
          const message = tokenId 
            ? `${txType} #${tokenId} submitted: ${txHash}`
            : `${txType} submitted: ${txHash}`;
          showToast(message, "success");
        }
        
        // Schedule auto-rescan
        this.scheduleRescan(txType, txHash);
        
        // Immediate UI refresh
        if (typeof window.refreshUnified === 'function') {
          window.refreshUnified().catch(() => {});
        }
        
        return tx;
      } catch (err) {
        console.error(`[Auto-Rescan] ${txType} failed:`, err);
        throw err;
      }
    },
    
    // Wrap existing transaction calls with auto-rescan
    wrapTransaction(txFunction, txType, tokenId = '') {
      return async (...args) => {
        try {
          const txPromise = txFunction(...args);
          return await this.monitorTransaction(txPromise, txType, tokenId);
        } catch (err) {
          // Re-throw error for proper handling upstream
          throw err;
        }
      };
    },
    
    // Enable/disable auto-rescan
    setEnabled(enabled) {
      this.enabled = enabled;
      console.log(`[Auto-Rescan] ${enabled ? 'Enabled' : 'Disabled'}`);
    },
    
    // Set custom delay
    setDelay(delayMs) {
      this.delay = Math.max(1000, delayMs); // Minimum 1 second
      console.log(`[Auto-Rescan] Delay set to ${this.delay}ms`);
    }
  };
  
  // Make it globally available
  window.autoRescanManager = autoRescanManager;
  
  console.log('[Auto-Rescan] Manager initialized');
})();