// Transaction Helper - Simplifies auto-rescan integration
// This module provides a simple wrapper for blockchain transactions with automatic rescan

(function() {
  // Helper to execute transaction with auto-rescan
  async function executeWithAutoRescan(txPromise, txType, tokenId) {
    try {
      const tx = await txPromise;
      const txHash = tx.transactionHash || tx.hash;
      
      // Show toast if available
      if (typeof showToast === 'function') {
        const message = tokenId 
          ? `${txType} #${tokenId} submitted: ${txHash}`
          : `${txType} submitted: ${txHash}`;
        showToast(message, "success");
      }
      
      // Schedule auto-rescan if manager is available
      if (window.autoRescanManager && window.autoRescanManager.scheduleRescan) {
        window.autoRescanManager.scheduleRescan(txType, txHash);
      } else {
        // Fallback: manual rescan after 6 seconds
        setTimeout(() => {
          const scanBtn = document.getElementById('scanBtn');
          if (scanBtn && !scanBtn.disabled && !scanBtn.hasAttribute('aria-busy')) {
            console.log('[Transaction Helper] Triggering rescan after', txType);
            scanBtn.click();
          }
        }, 6000);
      }
      
      // Immediate UI refresh
      if (typeof window.refreshUnified === 'function') {
        window.refreshUnified().catch(() => {});
      }
      
      return tx;
    } catch (err) {
      console.error(`[Transaction Helper] ${txType} failed:`, err);
      throw err;
    }
  }
  
  // Simplified wrapper for common transaction patterns
  function wrapTx(txFunction) {
    return async function(...args) {
      const txType = args[args.length - 2] || 'Transaction';
      const tokenId = args[args.length - 1];
      
      try {
        const txPromise = txFunction.apply(this, args.slice(0, -2));
        return await executeWithAutoRescan(txPromise, txType, tokenId);
      } catch (err) {
        throw err;
      }
    };
  }
  
  // Global helper for easy integration
  window.txHelper = {
    execute: executeWithAutoRescan,
    wrap: wrapTx
  };
  
  // Also expose executeWithAutoRescan directly for backward compatibility
  window.executeWithAutoRescan = executeWithAutoRescan;
  
  // Transaction helper initialized
})();