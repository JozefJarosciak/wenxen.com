// Tab management - centralized tab switching and state management
import { storageUtils } from '../utils/storageUtils.js';

export const tabManager = {
  // Current state
  currentTab: 'tab-dashboard',
  
  // Get all tab buttons and panels
  getTabElements() {
    return {
      buttons: document.querySelectorAll('.tab-button'),
      panels: document.querySelectorAll('.tab-panel')
    };
  },

  // Set ARIA attributes for buttons
  setButtonStates(activeId) {
    try {
      const { buttons } = this.getTabElements();
      buttons.forEach(button => {
        const isActive = button.dataset.target === activeId;
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        button.classList.toggle('active', isActive);
      });
    } catch (error) {
      console.warn('Failed to set button states:', error);
    }
  },

  // Set ARIA attributes for panels
  setPanelStates(activeId) {
    try {
      const { panels } = this.getTabElements();
      panels.forEach(panel => {
        const isActive = panel.id === activeId;
        panel.classList.toggle('active', isActive);
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });
    } catch (error) {
      console.warn('Failed to set panel states:', error);
    }
  },

  // Persist active tab to storage
  persistActiveTab(tabId) {
    storageUtils.setItem('activeTabId', tabId);
  },

  // Get stored active tab
  getStoredActiveTab() {
    return storageUtils.getItem('activeTabId', 'tab-dashboard');
  },

  // Handle tab-specific initialization
  onTabActivated(tabId) {
    // Privacy consent check for settings
    try {
      if (typeof window.ensurePrivacyConsentOnSettings === 'function') {
        window.ensurePrivacyConsentOnSettings(tabId);
      }
    } catch (error) {
      console.warn('Failed to check privacy consent:', error);
    }

    // About tab loading
    if (tabId === 'tab-about') {
      try {
        if (typeof window.ensureAboutLoaded === 'function') {
          window.ensureAboutLoaded();
        }
      } catch (error) {
        console.warn('Failed to load about content:', error);
      }
    }

    // Dashboard chart handling
    if (tabId === 'tab-dashboard') {
      this.handleDashboardActivation();
    }
  },

  // Handle dashboard-specific activation
  handleDashboardActivation() {
    try {
      const wantOpen = storageUtils.getItem('vmuChartExpanded', '0') === '1';
      
      // If chart initialization was deferred, attempt it now
      if (window._vmuChartInitPending && wantOpen) {
        setTimeout(() => {
          try {
            if (typeof window.setVmuChartExpandedState === 'function') {
              window.setVmuChartExpandedState(true);
              window._vmuChartInitPending = false;
            }
          } catch (error) {
            console.warn('Failed to initialize VMU chart:', error);
          }
        }, 0);
      }
      
      // Resize and update existing chart
      requestAnimationFrame(() => {
        try {
          if (window.vmuChart && typeof window.vmuChart.resize === 'function') {
            window.vmuChart.resize();
          }
          if (typeof window.updateVmuChart === 'function') {
            window.updateVmuChart();
          }
        } catch (error) {
          console.warn('Failed to resize/update VMU chart:', error);
        }
      });
    } catch (error) {
      console.warn('Failed to handle dashboard activation:', error);
    }
  },

  // Switch to specific tab
  switchToTab(tabId) {
    // Validate tab exists
    const panel = document.getElementById(tabId);
    if (!panel) {
      console.warn(`Tab panel ${tabId} not found, falling back to dashboard`);
      tabId = 'tab-dashboard';
    }

    // Update states
    this.setPanelStates(tabId);
    this.setButtonStates(tabId);
    this.persistActiveTab(tabId);
    this.currentTab = tabId;

    // Handle tab-specific logic
    this.onTabActivated(tabId);

    // Dispatch custom event
    document.dispatchEvent(new CustomEvent('tabChanged', {
      detail: { tabId, previousTab: this.currentTab }
    }));
  },

  // Initialize tab system
  initialize() {
    const { buttons } = this.getTabElements();
    
    if (!buttons.length) {
      console.warn('No tab buttons found');
      return;
    }

    // Set up button click handlers
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const targetId = button.dataset.target;
        if (targetId) {
          this.switchToTab(targetId);
        }
      });
    });

    // Set up keyboard navigation
    buttons.forEach((button, index) => {
      button.addEventListener('keydown', (event) => {
        let targetIndex = index;
        
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault();
            targetIndex = index > 0 ? index - 1 : buttons.length - 1;
            break;
          case 'ArrowRight':
            event.preventDefault();
            targetIndex = index < buttons.length - 1 ? index + 1 : 0;
            break;
          case 'Home':
            event.preventDefault();
            targetIndex = 0;
            break;
          case 'End':
            event.preventDefault();
            targetIndex = buttons.length - 1;
            break;
          default:
            return;
        }
        
        buttons[targetIndex].focus();
        const targetTabId = buttons[targetIndex].dataset.target;
        if (targetTabId) {
          this.switchToTab(targetTabId);
        }
      });
    });

    // Restore previously active tab
    const storedTab = this.getStoredActiveTab();
    this.switchToTab(storedTab);
  },

  // Public API for programmatic tab switching
  setActiveTab(tabId) {
    this.switchToTab(tabId);
  },

  // Get current active tab
  getCurrentTab() {
    return this.currentTab;
  }
};

// Legacy global function for backward compatibility
window.setActiveTab = (tabId) => tabManager.setActiveTab(tabId);

// Auto-initialize when module loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => tabManager.initialize());
} else {
  tabManager.initialize();
}