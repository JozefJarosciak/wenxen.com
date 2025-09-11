// Tooltip management - mobile and desktop tooltip handling
export const tooltipManager = {
  // Long press timer for mobile tooltips
  longPressTimer: null,

  // Mobile tooltip handling
  mobile: {
    // Add long-press tooltip to element
    addLongPressTooltip(element, text) {
      if (!text || !element) return;

      const startLongPress = (event) => {
        tooltipManager.longPressTimer = setTimeout(() => {
          tooltipManager.mobile.show(event.target, text);
        }, 500); // 500ms for long press
      };

      const cancelLongPress = () => {
        if (tooltipManager.longPressTimer) {
          clearTimeout(tooltipManager.longPressTimer);
          tooltipManager.longPressTimer = null;
        }
      };

      // Touch event listeners
      element.addEventListener('touchstart', startLongPress, { passive: true });
      element.addEventListener('touchend', cancelLongPress);
      element.addEventListener('touchmove', cancelLongPress);
      element.addEventListener('touchcancel', cancelLongPress);

      // Store cleanup function on element
      element._tooltipCleanup = () => {
        element.removeEventListener('touchstart', startLongPress);
        element.removeEventListener('touchend', cancelLongPress);
        element.removeEventListener('touchmove', cancelLongPress);
        element.removeEventListener('touchcancel', cancelLongPress);
      };
    },

    // Show mobile tooltip
    show(targetElement, text) {
      const tooltip = this.getOrCreateTooltip();
      if (!tooltip || !targetElement) return;

      tooltip.textContent = text;
      tooltip.style.display = 'block';

      // Position tooltip
      this.position(tooltip, targetElement);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.hide();
      }, 3000);

      // Hide on next touch
      const hideOnNextTouch = () => {
        this.hide();
        document.removeEventListener('touchstart', hideOnNextTouch);
      };
      document.addEventListener('touchstart', hideOnNextTouch, { once: true });
    },

    // Hide mobile tooltip
    hide() {
      const tooltip = document.getElementById('mobile-tooltip');
      if (tooltip) {
        tooltip.style.display = 'none';
      }
    },

    // Position tooltip above element
    position(tooltip, targetElement) {
      if (!tooltip || !targetElement) return;

      try {
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        // Position above the element
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 10;

        // Keep within viewport bounds
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        // Horizontal bounds
        if (left < 5) left = 5;
        if (left + tooltipRect.width > viewportWidth - 5) {
          left = viewportWidth - tooltipRect.width - 5;
        }

        // Vertical bounds - if no room above, show below
        if (top < 5) {
          top = rect.bottom + 10;
        }
        if (top + tooltipRect.height > viewportHeight - 5) {
          top = viewportHeight - tooltipRect.height - 5;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      } catch (error) {
        console.warn('Failed to position tooltip:', error);
      }
    },

    // Get or create mobile tooltip element
    getOrCreateTooltip() {
      let tooltip = document.getElementById('mobile-tooltip');
      
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'mobile-tooltip';
        tooltip.className = 'mobile-tooltip';
        tooltip.style.cssText = `
          position: fixed;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
          z-index: 2147483647;
          max-width: 250px;
          word-wrap: break-word;
          display: none;
          pointer-events: none;
        `;
        // Append to body as the last element to ensure it's on top
        document.body.appendChild(tooltip);
      }
      
      return tooltip;
    }
  },

  // Desktop tooltip handling
  desktop: {
    // Add hover tooltip to element
    addHoverTooltip(element, text) {
      if (!text || !element) return;

      // Use native title attribute for simple desktop tooltips
      element.title = text;
    },

    // Create custom tooltip with HTML content
    addCustomTooltip(element, content, options = {}) {
      if (!content || !element) return;

      const showTooltip = (event) => {
        this.show(event.target, content, options);
      };

      const hideTooltip = () => {
        this.hide();
      };

      element.addEventListener('mouseenter', showTooltip);
      element.addEventListener('mouseleave', hideTooltip);
      element.addEventListener('mousemove', this.updatePosition.bind(this));

      // Store cleanup function
      element._tooltipCleanup = () => {
        element.removeEventListener('mouseenter', showTooltip);
        element.removeEventListener('mouseleave', hideTooltip);
        element.removeEventListener('mousemove', this.updatePosition.bind(this));
      };
    },

    // Show desktop tooltip
    show(targetElement, content, options = {}) {
      const tooltip = this.getOrCreateTooltip();
      if (!tooltip) return;

      // Set content
      if (typeof content === 'string') {
        tooltip.textContent = content;
      } else {
        tooltip.innerHTML = content;
      }

      // Apply options
      if (options.className) {
        tooltip.className = `desktop-tooltip ${options.className}`;
      }

      tooltip.style.display = 'block';
      
      // Position will be updated by mousemove
    },

    // Hide desktop tooltip
    hide() {
      const tooltip = document.getElementById('desktop-tooltip');
      if (tooltip) {
        tooltip.style.display = 'none';
      }
    },

    // Update tooltip position based on mouse
    updatePosition(event) {
      const tooltip = document.getElementById('desktop-tooltip');
      if (!tooltip || tooltip.style.display === 'none') return;

      const x = event.clientX;
      const y = event.clientY;
      const offset = 10;

      tooltip.style.left = `${x + offset}px`;
      tooltip.style.top = `${y + offset}px`;
    },

    // Get or create desktop tooltip element
    getOrCreateTooltip() {
      let tooltip = document.getElementById('desktop-tooltip');
      
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'desktop-tooltip';
        tooltip.className = 'desktop-tooltip';
        tooltip.style.cssText = `
          position: fixed;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          z-index: 2147483647;
          max-width: 300px;
          word-wrap: break-word;
          display: none;
          pointer-events: none;
        `;
        // Append to body as the last element to ensure it's on top
        document.body.appendChild(tooltip);
      }
      
      return tooltip;
    }
  },

  // Utility functions
  utils: {
    // Detect if device supports touch
    isTouchDevice() {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    // Remove tooltip from element
    removeTooltip(element) {
      if (!element) return;
      
      if (element._tooltipCleanup) {
        element._tooltipCleanup();
        delete element._tooltipCleanup;
      }
      
      // Remove title attribute
      if (element.hasAttribute('title')) {
        element.removeAttribute('title');
      }
    },

    // Clean up all tooltips
    cleanup() {
      // Remove tooltip elements
      const mobileTooltip = document.getElementById('mobile-tooltip');
      if (mobileTooltip) {
        mobileTooltip.remove();
      }
      
      const desktopTooltip = document.getElementById('desktop-tooltip');
      if (desktopTooltip) {
        desktopTooltip.remove();
      }
      
      // Clear any active timers
      if (tooltipManager.longPressTimer) {
        clearTimeout(tooltipManager.longPressTimer);
        tooltipManager.longPressTimer = null;
      }
    }
  },

  // Auto-add appropriate tooltip based on device
  addTooltip(element, text, options = {}) {
    if (!element || !text) return;

    // Remove existing tooltip first
    this.utils.removeTooltip(element);

    // Add appropriate tooltip type
    if (this.utils.isTouchDevice()) {
      this.mobile.addLongPressTooltip(element, text);
    } else {
      if (options.html || options.custom) {
        this.desktop.addCustomTooltip(element, text, options);
      } else {
        this.desktop.addHoverTooltip(element, text);
      }
    }
  },

  // Build tooltip for estimated XEN
  buildEstXenTooltip(row, estNumber) {
    const hasPrice = Number.isFinite(window.xenUsdPrice);
    const usdStr = (n) => hasPrice ? ` (${window.formatUSD ? window.formatUSD(n * window.xenUsdPrice) : `$${(n * window.xenUsdPrice).toFixed(2)}`})` : "";

    // Stake / Stake XENFT breakdown
    if (row?.SourceType === "Stake" || row?.SourceType === "Stake XENFT") {
      const breakdown = window.stakeEstBreakdown ? window.stakeEstBreakdown(row) : null;
      if (breakdown) {
        const toTok = (x) => Number(x / breakdown.ONE_ETHER);
        const fmtTok = (n) => n.toLocaleString();
        const fmtUsd = (n) => hasPrice ? ` (${window.formatUSD ? window.formatUSD(n * window.xenUsdPrice) : `$${(n * window.xenUsdPrice).toFixed(2)}`})` : '';

        const principalTok = toTok(breakdown.amount);
        const rewardTok = toTok(breakdown.reward);
        const totalTok = toTok(breakdown.total);

        return `${row.SourceType}
Principal: ${fmtTok(principalTok)}${fmtUsd(principalTok)}
APY: ${breakdown.apy}%, Term: ${breakdown.termDays}d
Reward: ${fmtTok(rewardTok)}${fmtUsd(rewardTok)}
Total: ${fmtTok(totalTok)}${fmtUsd(totalTok)}`;
      }
      return row.SourceType || "";
    }

    // Cointool / XENFT simple reward tooltip
    const est = Number(estNumber || 0);
    const label = (row?.SourceType === "XENFT") ? "XENFT" : "Cointool";
    return `${label}
Mint Reward: ${est.toLocaleString()}${usdStr(est)}`;
  }
};

// Legacy global functions for backward compatibility
window.addLongPressTooltip = (element, text) => tooltipManager.mobile.addLongPressTooltip(element, text);
window.showMobileTooltip = (targetEl, text) => tooltipManager.mobile.show(targetEl, text);
window.buildEstXenTooltip = (row, estNumber) => tooltipManager.buildEstXenTooltip(row, estNumber);

// Initialize mobile tooltip element on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    tooltipManager.mobile.getOrCreateTooltip();
  });
} else {
  tooltipManager.mobile.getOrCreateTooltip();
}