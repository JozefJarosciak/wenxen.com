// Transaction Helper - Simplifies auto-rescan integration
// This module provides a simple wrapper for blockchain transactions with automatic rescan

(function() {
  function normalizeSubmittedTx(tx, hash = '') {
    if (typeof tx === 'string') {
      return {
        transactionHash: tx,
        hash: tx,
        submitted: true,
        pendingReceipt: true
      };
    }

    const txHash = hash || tx?.transactionHash || tx?.hash || '';
    if (!txHash) return tx || {};

    return {
      ...(tx || {}),
      transactionHash: txHash,
      hash: txHash,
      submitted: true,
      pendingReceipt: tx?.blockNumber == null
    };
  }

  function waitForTransactionSubmission(txPromise) {
    const canListen = txPromise && (typeof txPromise.once === 'function' || typeof txPromise.on === 'function');
    if (!canListen) return Promise.resolve(txPromise);

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = tx => {
        if (settled) return;
        settled = true;
        resolve(tx);
      };
      const fail = err => {
        if (settled) return;
        settled = true;
        reject(err);
      };
      const listen = typeof txPromise.once === 'function'
        ? txPromise.once.bind(txPromise)
        : txPromise.on.bind(txPromise);

      try {
        listen('transactionHash', hash => settle(normalizeSubmittedTx(null, hash)));
      } catch (_) {}
      try {
        listen('receipt', receipt => settle(normalizeSubmittedTx(receipt)));
      } catch (_) {}
      try {
        listen('error', fail);
      } catch (_) {}

      // Keep consuming the underlying promise after an early tx-hash resolve so
      // a later receipt/revert does not become an unhandled rejection.
      Promise.resolve(txPromise)
        .then(receipt => settle(normalizeSubmittedTx(receipt)))
        .catch(fail);
    });
  }

  // Helper to execute transaction with auto-rescan
  async function executeWithAutoRescan(txPromise, txType, tokenId) {
    try {
      const tx = await waitForTransactionSubmission(txPromise);
      const txHash = tx?.transactionHash || tx?.hash;
      
      // Show toast if available
      if (typeof showToast === 'function') {
        const message = txHash
          ? (tokenId
            ? `${txType} #${tokenId} submitted: ${txHash}`
            : `${txType} submitted: ${txHash}`)
          : `${txType} submitted`;
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
