// Centralized Auto-Rescan System
// Monitors wallet transactions and triggers automatic rescans after successful operations

(function() {
  const autoRescanManager = {
    scheduled: false,
    enabled: false, // Disabled by default
    delay: 120000, // 2 minutes (120 seconds) default - Etherscan needs time to index

    // Initialize from localStorage
    init() {
      // Load enabled state (default: false)
      const savedEnabled = localStorage.getItem('autoRescanEnabled');
      this.enabled = savedEnabled === 'true';

      // Load delay (default: 120 seconds = 120000ms)
      const savedDelay = localStorage.getItem('autoRescanDelay');
      if (savedDelay) {
        const delaySeconds = parseInt(savedDelay, 10);
        if (Number.isFinite(delaySeconds) && delaySeconds >= 30 && delaySeconds <= 300) {
          this.delay = delaySeconds * 1000;
        }
      }

      console.log(`[Auto-Rescan] Initialized: enabled=${this.enabled}, delay=${this.delay}ms`);
    },

    // Schedule an auto-rescan after successful transaction
    scheduleRescan(txType, txHash) {
      // Check if auto-rescan is enabled
      if (!this.enabled) {
        console.log(`[Auto-Rescan] Disabled, skipping rescan after ${txType}`);
        return;
      }

      if (this.scheduled) return; // Prevent multiple simultaneous rescans

      this.scheduled = true;
      const delaySeconds = Math.round(this.delay / 1000);
      console.log(`[Auto-Rescan] Scheduled rescan after ${txType} in ${delaySeconds}s (tx: ${txHash})`);

      // Show toast notification about scheduled rescan
      if (typeof showToast === 'function') {
        showToast(`Auto-rescan scheduled in ${delaySeconds} seconds...`, "info");
      }

      setTimeout(() => {
        this.scheduled = false;
        this.triggerRescan(txType);
      }, this.delay);
    },

    // Trigger the actual rescan
    triggerRescan(txType) {
      console.log(`[Auto-Rescan] Triggering rescan after ${txType}...`);

      // Show toast notification
      if (typeof showToast === 'function') {
        showToast(`Auto-rescan starting...`, "info");
      }

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

        // Schedule auto-rescan (will check if enabled internally)
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
      localStorage.setItem('autoRescanEnabled', String(enabled));
      console.log(`[Auto-Rescan] ${enabled ? 'Enabled' : 'Disabled'}`);
    },

    // Set custom delay (in seconds)
    setDelay(delaySeconds) {
      const seconds = Math.max(30, Math.min(300, delaySeconds)); // Clamp between 30-300
      this.delay = seconds * 1000;
      localStorage.setItem('autoRescanDelay', String(seconds));
      console.log(`[Auto-Rescan] Delay set to ${seconds}s (${this.delay}ms)`);
    }
  };

  // Initialize on load
  autoRescanManager.init();

  // Make it globally available
  window.autoRescanManager = autoRescanManager;
})();
