// Unified Progress Tracking and Error Handling for Scanners
// Provides consistent progress reporting and error handling across all scanners

/**
 * Unified progress manager for all scanners
 */
export class ScannerProgressManager {
  constructor() {
    this.scanners = new Map(); // Track multiple scanners
    this.globalStartTime = null;
    this.errorLog = [];
    this.isScanning = false;
  }

  /**
   * Start tracking a scanner's progress
   * @param {string} scannerId - Unique scanner identifier
   * @param {string} scannerName - Display name for the scanner
   * @param {Object} config - Scanner configuration
   */
  startScanner(scannerId, scannerName, config = {}) {
    const scanner = {
      id: scannerId,
      name: scannerName,
      startTime: Date.now(),
      stage: 'Initializing',
      progress: 0,
      total: 100,
      currentAddress: null,
      addressIndex: 0,
      totalAddresses: config.totalAddresses || 1,
      errors: [],
      warnings: [],
      completed: false,
      eta: null,
      rate: 0,
      config
    };

    this.scanners.set(scannerId, scanner);
    
    if (!this.globalStartTime) {
      this.globalStartTime = Date.now();
      this.isScanning = true;
    }

    this.updateUI();
    console.log(`[Progress] Started scanner: ${scannerName}`);
  }

  /**
   * Update scanner progress
   * @param {string} scannerId - Scanner identifier
   * @param {Object} update - Progress update object
   */
  updateProgress(scannerId, update) {
    const scanner = this.scanners.get(scannerId);
    if (!scanner) {
      console.warn(`[Progress] Scanner ${scannerId} not found`);
      return;
    }

    // Update scanner state
    Object.assign(scanner, update);

    // Calculate ETA and rate
    const elapsed = Date.now() - scanner.startTime;
    if (scanner.progress > 0 && scanner.total > 0) {
      scanner.rate = scanner.progress / (elapsed / 1000);
      const remaining = scanner.total - scanner.progress;
      scanner.eta = scanner.rate > 0 ? remaining / scanner.rate : null;
    }

    this.updateUI();
  }

  /**
   * Set current processing stage
   * @param {string} scannerId - Scanner identifier
   * @param {string} stage - Stage description
   * @param {number} progress - Current progress (optional)
   * @param {number} total - Total items (optional)
   * @param {string} detail - Additional detail (optional)
   */
  setStage(scannerId, stage, progress = null, total = null, detail = null) {
    const update = { stage };
    if (progress !== null) update.progress = progress;
    if (total !== null) update.total = total;
    if (detail !== null) update.detail = detail;
    
    this.updateProgress(scannerId, update);
  }

  /**
   * Set current address being processed
   * @param {string} scannerId - Scanner identifier
   * @param {number} addressIndex - Current address index (1-based)
   * @param {number} totalAddresses - Total number of addresses
   * @param {string} address - Current address
   */
  setAddress(scannerId, addressIndex, totalAddresses, address) {
    this.updateProgress(scannerId, {
      currentAddress: address,
      addressIndex,
      totalAddresses
    });
  }

  /**
   * Add an error to the scanner
   * @param {string} scannerId - Scanner identifier
   * @param {string|Error} error - Error message or Error object
   * @param {string} context - Additional context
   */
  addError(scannerId, error, context = null) {
    const scanner = this.scanners.get(scannerId);
    if (!scanner) return;

    const errorEntry = {
      timestamp: Date.now(),
      message: error instanceof Error ? error.message : String(error),
      context,
      stack: error instanceof Error ? error.stack : null
    };

    scanner.errors.push(errorEntry);
    this.errorLog.push({ scannerId, ...errorEntry });

    console.error(`[${scanner.name}] Error:`, errorEntry.message, context || '');
    this.updateUI();
  }

  /**
   * Add a warning to the scanner
   * @param {string} scannerId - Scanner identifier
   * @param {string} message - Warning message
   * @param {string} context - Additional context
   */
  addWarning(scannerId, message, context = null) {
    const scanner = this.scanners.get(scannerId);
    if (!scanner) return;

    const warningEntry = {
      timestamp: Date.now(),
      message: String(message),
      context
    };

    scanner.warnings.push(warningEntry);

    console.warn(`[${scanner.name}] Warning:`, warningEntry.message, context || '');
    this.updateUI();
  }

  /**
   * Complete a scanner
   * @param {string} scannerId - Scanner identifier
   * @param {Object} results - Final results
   */
  completeScanner(scannerId, results = {}) {
    const scanner = this.scanners.get(scannerId);
    if (!scanner) return;

    scanner.completed = true;
    scanner.progress = scanner.total;
    scanner.stage = 'Completed';
    scanner.endTime = Date.now();
    scanner.duration = scanner.endTime - scanner.startTime;
    scanner.results = results;

    console.log(`[Progress] Completed scanner: ${scanner.name} in ${this.formatDuration(scanner.duration)}`);

    // Check if all scanners are complete
    const allComplete = Array.from(this.scanners.values()).every(s => s.completed);
    if (allComplete) {
      this.completeAllScanners();
    } else {
      this.updateUI();
    }
  }

  /**
   * Complete all scanners and finalize
   */
  completeAllScanners() {
    const totalDuration = Date.now() - this.globalStartTime;
    const totalErrors = this.errorLog.length;
    const totalWarnings = Array.from(this.scanners.values())
      .reduce((sum, s) => sum + s.warnings.length, 0);

    console.log(`[Progress] All scanners completed in ${this.formatDuration(totalDuration)}`);
    if (totalErrors > 0) {
      console.log(`[Progress] Total errors: ${totalErrors}`);
    }
    if (totalWarnings > 0) {
      console.log(`[Progress] Total warnings: ${totalWarnings}`);
    }

    this.isScanning = false;
    this.updateUI();

    // Hide progress UI after delay if not part of scan all
    setTimeout(() => {
      if (!window.__scanAllActive) {
        this.hideProgressUI();
      }
    }, 2000);
  }

  /**
   * Cancel all scanners
   */
  cancelAll() {
    console.log('[Progress] Cancelling all scanners');
    
    for (const scanner of this.scanners.values()) {
      if (!scanner.completed) {
        scanner.stage = 'Cancelled';
        scanner.completed = true;
        scanner.endTime = Date.now();
        scanner.duration = scanner.endTime - scanner.startTime;
      }
    }

    this.isScanning = false;
    this.updateUI();
    this.hideProgressUI();
  }

  /**
   * Reset all progress tracking
   */
  reset() {
    this.scanners.clear();
    this.errorLog = [];
    this.globalStartTime = null;
    this.isScanning = false;
    this.hideProgressUI();
  }

  /**
   * Get progress summary for all scanners
   * @returns {Object} Progress summary
   */
  getProgressSummary() {
    const scanners = Array.from(this.scanners.values());
    const completed = scanners.filter(s => s.completed).length;
    const total = scanners.length;
    const errors = this.errorLog.length;
    const warnings = scanners.reduce((sum, s) => sum + s.warnings.length, 0);

    let overallProgress = 0;
    if (total > 0) {
      overallProgress = scanners.reduce((sum, s) => {
        const scannerProgress = s.total > 0 ? (s.progress / s.total) * 100 : 0;
        return sum + scannerProgress;
      }, 0) / total;
    }

    return {
      completed,
      total,
      overallProgress: Math.round(overallProgress),
      errors,
      warnings,
      isScanning: this.isScanning,
      duration: this.globalStartTime ? Date.now() - this.globalStartTime : 0
    };
  }

  /**
   * Update UI elements
   */
  updateUI() {
    const summary = this.getProgressSummary();
    
    // Update address progress
    const activeScanner = this.getActiveScanner();
    if (activeScanner) {
      this.updateAddressProgress(activeScanner);
      this.updateTokenProgress(activeScanner);
      this.updateScanType(activeScanner);
    }

    // Update global progress
    this.updateGlobalProgress(summary);

    // Show/hide progress container
    this.showProgressUI();
  }

  /**
   * Get the currently active (non-completed) scanner
   * @returns {Object|null} Active scanner or null
   */
  getActiveScanner() {
    return Array.from(this.scanners.values()).find(s => !s.completed) || null;
  }

  /**
   * Update address progress display
   * @param {Object} scanner - Active scanner
   */
  updateAddressProgress(scanner) {
    const addressProgressText = document.getElementById('addressProgressText');
    if (addressProgressText && scanner.currentAddress) {
      const shortAddr = this.shortAddr(scanner.currentAddress);
      addressProgressText.textContent = 
        `Scanning address ${scanner.addressIndex}/${scanner.totalAddresses}: ${shortAddr}`;
    }
  }

  /**
   * Update token/item progress display
   * @param {Object} scanner - Active scanner
   */
  updateTokenProgress(scanner) {
    const tokenProgressBar = document.getElementById('tokenProgressBar');
    const tokenProgressText = document.getElementById('tokenProgressText');
    const etrText = document.getElementById('etrText');

    if (tokenProgressBar) {
      tokenProgressBar.max = Math.max(1, scanner.total);
      tokenProgressBar.value = scanner.progress;
    }

    if (tokenProgressText) {
      let progressText = scanner.stage;
      if (scanner.detail) {
        progressText += ` - ${scanner.detail}`;
      }
      if (scanner.total > 0) {
        progressText += ` (${scanner.progress}/${scanner.total})`;
      }
      tokenProgressText.textContent = progressText;
    }

    if (etrText && scanner.eta !== null) {
      etrText.textContent = `ETA: ${this.formatDuration(scanner.eta * 1000)}`;
    }
  }

  /**
   * Update scan type display
   * @param {Object} scanner - Active scanner
   */
  updateScanType(scanner) {
    const scanTypeText = document.getElementById('scanTypeText');
    if (scanTypeText) {
      scanTypeText.textContent = scanner.name;
    }
  }

  /**
   * Update global progress indicators
   * @param {Object} summary - Progress summary
   */
  updateGlobalProgress(summary) {
    // Update scan button state
    const scanBtn = document.getElementById('scanBtn');
    const scanBtnLabel = document.getElementById('scanBtnLabel');
    const cancelBtn = document.getElementById('cancelScanBtn');

    if (scanBtn && scanBtnLabel) {
      if (summary.isScanning) {
        scanBtn.disabled = true;
        scanBtnLabel.textContent = `Scanning... (${summary.completed}/${summary.total})`;
        if (cancelBtn) {
          cancelBtn.style.display = 'inline-block';
          cancelBtn.onclick = () => this.cancelAll();
        }
      } else {
        scanBtn.disabled = false;
        scanBtnLabel.textContent = scanBtn.dataset.prevText || 'Scan';
        if (cancelBtn) {
          cancelBtn.style.display = 'none';
        }
      }
    }

    // Update RPC status
    const rpcStatus = document.getElementById('rpcStatus');
    if (rpcStatus && summary.errors > 0) {
      rpcStatus.textContent = `${summary.errors} errors`;
    }
  }

  /**
   * Show progress UI
   */
  showProgressUI() {
    if (window.progressUI) {
      window.progressUI.show(true);
    } else {
      const progressContainer = document.getElementById('progressContainer');
      if (progressContainer) {
        progressContainer.style.display = 'block';
      }
    }
  }

  /**
   * Hide progress UI
   */
  hideProgressUI() {
    if (window.progressUI) {
      window.progressUI.show(false);
    } else {
      const progressContainer = document.getElementById('progressContainer');
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
    }
  }

  /**
   * Show error summary to user
   */
  showErrorSummary() {
    if (this.errorLog.length === 0) return;

    const errorSummary = this.errorLog.map(error => 
      `[${error.scannerId}] ${error.message}${error.context ? ` (${error.context})` : ''}`
    ).join('\n');

    console.error('Scanner Error Summary:\n' + errorSummary);

    // Show toast notification if available
    if (typeof window.showToast === 'function') {
      window.showToast(
        `Scanning completed with ${this.errorLog.length} errors. Check console for details.`,
        'warning'
      );
    }
  }

  /**
   * Utility: Format duration in milliseconds to human readable
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Utility: Shorten address for display
   * @param {string} address - Full address
   * @returns {string} Shortened address
   */
  shortAddr(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
}

// Create global singleton instance
const progressManager = new ScannerProgressManager();

// Make available globally for non-module scripts
if (typeof window !== 'undefined') {
  window.scannerProgressManager = progressManager;
  window.ScannerProgressManager = ScannerProgressManager;
  
  // Legacy compatibility - expose common methods globally
  window.setupProgressUI = (type) => {
    if (window.progressUI) {
      window.progressUI.show(true);
      window.progressUI.setType(type);
    }
  };
  
  window.updateProgress = (current, total, address) => {
    // This will be called by legacy scanners, map to new system
    const scannerId = 'legacy_scanner';
    if (!progressManager.scanners.has(scannerId)) {
      progressManager.startScanner(scannerId, 'Legacy Scanner', { totalAddresses: 1 });
    }
    progressManager.updateProgress(scannerId, {
      progress: current,
      total: total,
      currentAddress: address
    });
  };
  
  window.finishScan = () => {
    // Complete any active scanners
    for (const scannerId of progressManager.scanners.keys()) {
      const scanner = progressManager.scanners.get(scannerId);
      if (!scanner.completed) {
        progressManager.completeScanner(scannerId);
      }
    }
  };
}

export default progressManager;