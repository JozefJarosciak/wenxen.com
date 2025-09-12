// XEN Value Toast Manager - Table-based detailed tooltip for Est. XEN values
export const xenValueToastManager = {
  activeToast: null,
  hideTimer: null,
  currentTarget: null,
  
  // Show detailed XEN value information in a table-based toast
  showXenValueToast(targetElement, rowData, estimatedXen) {
    // Clear any pending hide timer
    this.clearHideTimer();
    
    // If showing for the same target, don't recreate
    if (this.currentTarget === targetElement && this.activeToast) {
      return;
    }
    
    // Hide any existing toast first
    this.hideToast();
    
    if (!targetElement || !rowData) return;
    
    // Store current target
    this.currentTarget = targetElement;
    
    // Use cached price only - don't fetch on hover
    this.showActualToast(targetElement, rowData, estimatedXen);
  },
  
  // Show the actual toast content
  showActualToast(targetElement, rowData, estimatedXen) {
    // Create the toast content
    const toastContent = this.createToastContent(rowData, estimatedXen);
    if (!toastContent) return;
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'xen-value-toast';
    toast.innerHTML = toastContent;
    
    // Position toast relative to target element
    this.positionToast(toast, targetElement);
    
    // Add to document
    document.body.appendChild(toast);
    this.activeToast = toast;
    
    // Show with animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Set up hover behavior for stable display
    this.setupHoverBehavior(toast, targetElement);
  },

  // Set up hover behavior to keep tooltip stable
  setupHoverBehavior(toast, targetElement) {
    // Keep tooltip visible when hovering over either the target or the tooltip
    const keepVisible = () => {
      this.clearHideTimer();
    };
    
    // Schedule hiding when mouse leaves
    const scheduleHide = () => {
      this.clearHideTimer();
      this.hideTimer = setTimeout(() => {
        this.hideToast();
      }, 300); // Small delay to allow moving between target and tooltip
    };
    
    // Target element events
    targetElement.addEventListener('mouseenter', keepVisible);
    targetElement.addEventListener('mouseleave', scheduleHide);
    
    // Toast events
    toast.addEventListener('mouseenter', keepVisible);
    toast.addEventListener('mouseleave', scheduleHide);
    
    // Store cleanup function
    toast._cleanupHover = () => {
      targetElement.removeEventListener('mouseenter', keepVisible);
      targetElement.removeEventListener('mouseleave', scheduleHide);
      toast.removeEventListener('mouseenter', keepVisible);
      toast.removeEventListener('mouseleave', scheduleHide);
    };
  },

  // Clear hide timer
  clearHideTimer() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  },
  
  
  // Create the detailed table content for the toast
  createToastContent(row, estimatedXen) {
    const sourceType = row.SourceType || 'Unknown';
    const hasPrice = Number.isFinite(window.xenUsdPrice) && window.xenUsdPrice > 0;
    
    // Format XEN with thousands separators
    const formatXen = (amount) => Number(amount || 0).toLocaleString();
    
    // Format USD value
    const formatUsd = (xenAmount) => {
      if (!hasPrice) return 'Price unavailable';
      const usdValue = xenAmount * window.xenUsdPrice;
      return window.formatUSD ? window.formatUSD(usdValue) : `$${usdValue.toFixed(2)}`;
    };
    
    let content = `
      <div class="xen-toast-header">
        <h4>XEN Value Details</h4>
        <div class="source-type">${sourceType}</div>
      </div>
      <table class="xen-details-table">
    `;
    
    // Handle different source types
    if (sourceType === "Stake" || sourceType === "Stake XENFT") {
      // Get stake breakdown if available
      const breakdown = window.stakeEstBreakdown ? window.stakeEstBreakdown(row) : null;
      
      if (breakdown) {
        const toToken = (wei) => Number(wei / breakdown.ONE_ETHER);
        const principal = toToken(breakdown.amount);
        const reward = toToken(breakdown.reward);
        const total = toToken(breakdown.total);
        
        content += `
          <tr>
            <td class="label">Principal Amount</td>
            <td class="value">${formatXen(principal)} XEN</td>
            <td class="usd-value">${formatUsd(principal)}</td>
          </tr>
          <tr>
            <td class="label">APY</td>
            <td class="value">${breakdown.apy}%</td>
            <td class="info">Term: ${breakdown.termDays} days</td>
          </tr>
          <tr>
            <td class="label">Estimated Reward</td>
            <td class="value">${formatXen(reward)} XEN</td>
            <td class="usd-value">${formatUsd(reward)}</td>
          </tr>
          <tr class="total-row">
            <td class="label"><strong>Total Estimated</strong></td>
            <td class="value"><strong>${formatXen(total)} XEN</strong></td>
            <td class="usd-value"><strong>${formatUsd(total)}</strong></td>
          </tr>
        `;
      } else {
        // Fallback for stakes without breakdown
        content += `
          <tr class="total-row">
            <td class="label"><strong>Estimated XEN</strong></td>
            <td class="value"><strong>${formatXen(estimatedXen)} XEN</strong></td>
            <td class="usd-value"><strong>${formatUsd(estimatedXen)}</strong></td>
          </tr>
        `;
      }
    } else {
      // Cointool, XENFT, or other types
      const label = sourceType === "XENFT" ? "XENFT Mint Reward" : "Mint Reward";
      
      content += `
        <tr class="total-row">
          <td class="label"><strong>${label}</strong></td>
          <td class="value"><strong>${formatXen(estimatedXen)} XEN</strong></td>
          <td class="usd-value"><strong>${formatUsd(estimatedXen)}</strong></td>
        </tr>
      `;
    }
    
    // Add current XEN price info
    if (hasPrice) {
      content += `
        <tr class="price-info">
          <td class="label">Current XEN Price</td>
          <td class="value" colspan="2">${formatUsd(1)} per XEN</td>
        </tr>
      `;
    }
    
    content += `
      </table>
    `;
    
    return content;
  },
  
  // Position toast near the target element
  positionToast(toast, targetElement) {
    try {
      const rect = targetElement.getBoundingClientRect();
      const toastRect = toast.getBoundingClientRect();
      
      // Calculate position
      let left = rect.left + (rect.width / 2) - 150; // Center horizontally, toast width ~300px
      let top = rect.top - toastRect.height - 10; // Above the element
      
      // Keep within viewport bounds
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      
      // Horizontal bounds
      if (left < 10) left = 10;
      if (left + 300 > viewportWidth - 10) {
        left = viewportWidth - 310;
      }
      
      // Vertical bounds - if no room above, show below
      if (top < 10) {
        top = rect.bottom + 10;
      }
      if (top + toastRect.height > viewportHeight - 10) {
        top = viewportHeight - toastRect.height - 10;
      }
      
      toast.style.left = `${left}px`;
      toast.style.top = `${top}px`;
    } catch (error) {
      console.warn('Failed to position XEN value toast:', error);
      // Fallback position
      toast.style.left = '50%';
      toast.style.top = '20%';
      toast.style.transform = 'translateX(-50%)';
    }
  },
  
  // Hide the current toast
  hideToast() {
    this.clearHideTimer();
    
    if (this.activeToast) {
      // Clean up hover events if they exist
      if (this.activeToast._cleanupHover) {
        this.activeToast._cleanupHover();
      }
      
      this.activeToast.classList.remove('show');
      setTimeout(() => {
        if (this.activeToast && this.activeToast.parentNode) {
          this.activeToast.parentNode.removeChild(this.activeToast);
        }
        this.activeToast = null;
        this.currentTarget = null;
      }, 200);
    }
  },
  
  // Clean up - remove any active toasts
  cleanup() {
    this.hideToast();
  }
};

// Global helper function for easy integration
window.showXenValueToast = (targetElement, rowData, estimatedXen) => {
  xenValueToastManager.showXenValueToast(targetElement, rowData, estimatedXen);
};

// Global helper function to hide tooltip
window.hideXenValueToast = () => {
  xenValueToastManager.hideToast();
};

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
  xenValueToastManager.cleanup();
});