// URL Router - handles browser history and URL routing for tabs/subtabs
import { routeConfig } from './routeConfig.js';

export const router = {
  // Current route state
  currentRoute: null,
  isInitialized: false,

  // Initialize the router
  initialize() {
    if (this.isInitialized) return;

    // Set up base path detection
    this.detectBasePath();

    // Set up event listeners
    this.setupEventListeners();

    // Handle initial route
    this.handleCurrentRoute();

    this.isInitialized = true;
  },

  // Detect base path for production deployment
  detectBasePath() {
    const pathname = window.location.pathname;

    // In production (GitHub Pages or similar), base path might be /wenxen.com/
    // In development (file:// or localhost), base path is usually empty
    if (window.location.protocol === 'file:') {
      routeConfig.basePath = '';
    } else if (pathname.includes('/wenxen.com/')) {
      routeConfig.basePath = '/wenxen.com';
    } else {
      routeConfig.basePath = '';
    }
  },

  // Set up browser event listeners
  setupEventListeners() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
      this.handleCurrentRoute(false); // Don't push to history
    });

    // Listen for tab changes from tabManager
    document.addEventListener('tabChanged', (event) => {
      const { tabId, fromRouter } = event.detail;
      // Only update URL if change didn't come from router (prevent loops)
      if (!fromRouter) {
        this.updateUrlForTab(tabId);
      }
    });

    // Listen for subtab changes (we'll need to implement this)
    document.addEventListener('subtabChanged', (event) => {
      const { tabId, subtabId } = event.detail;
      this.updateUrlForSubtab(tabId, subtabId);
    });
  },

  // Get current path from URL
  getCurrentPath() {
    const pathname = window.location.pathname;
    const basePath = routeConfig.basePath;

    // Remove base path if present
    if (basePath && pathname.startsWith(basePath)) {
      return pathname.substring(basePath.length);
    }

    return pathname;
  },

  // Handle current route (from URL)
  handleCurrentRoute(pushToHistory = false) {
    const currentPath = this.getCurrentPath();
    const route = routeConfig.parsePath(currentPath);

    this.currentRoute = route;

    // Update document title
    if (route.title) {
      document.title = route.title;
    }

    // Switch to the appropriate tab
    if (window.tabManager && typeof window.tabManager.switchToTab === 'function') {
      window.tabManager.switchToTab(route.tab, true); // fromRouter = true
    }

    // Handle subtabs
    if (route.subtab) {
      this.activateSubtab(route.tab, route.subtab);
    }

    // Update browser history if needed
    if (pushToHistory) {
      const newUrl = this.buildUrl(currentPath);
      window.history.pushState({ route }, route.title, newUrl);
    }
  },

  // Build full URL from path
  buildUrl(path) {
    const origin = window.location.origin;
    const basePath = routeConfig.basePath;

    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${origin}${basePath}${cleanPath}`;
  },

  // Navigate to a specific route
  navigateTo(tabId, subtabId = null, pushToHistory = true) {
    const path = routeConfig.getPath(tabId, subtabId);
    const fullPath = path ? `/${path}` : '/';
    const route = routeConfig.parsePath(path);

    // Update current route
    this.currentRoute = route;

    // Update document title
    if (route.title) {
      document.title = route.title;
    }

    // Update URL
    const newUrl = this.buildUrl(fullPath);

    if (pushToHistory) {
      window.history.pushState({ route }, route.title, newUrl);
    } else {
      window.history.replaceState({ route }, route.title, newUrl);
    }

    // Switch to the tab (this will trigger tabChanged event)
    if (window.tabManager && typeof window.tabManager.switchToTab === 'function') {
      window.tabManager.switchToTab(tabId, true); // fromRouter = true
    }

    // Handle subtabs
    if (subtabId) {
      this.activateSubtab(tabId, subtabId);
    }
  },

  // Update URL when tab changes (called by event listener)
  updateUrlForTab(tabId) {
    if (!this.isInitialized) return;

    const currentPath = this.getCurrentPath();
    const currentRoute = routeConfig.parsePath(currentPath);

    // If the URL already matches the tab, don't update
    if (currentRoute.tab === tabId) return;

    // Navigate to the new tab
    this.navigateTo(tabId, null, true);
  },

  // Update URL when subtab changes
  updateUrlForSubtab(tabId, subtabId) {
    if (!this.isInitialized) return;

    // Navigate to the tab/subtab combination
    this.navigateTo(tabId, subtabId, true);
  },

  // Activate a subtab (this needs to be implemented based on existing subtab logic)
  activateSubtab(tabId, subtabId) {
    // For now, handle the About tab subtabs specifically
    if (tabId === 'tab-about') {
      // Find about subtab buttons and activate the correct one
      setTimeout(() => {
        const subtabButtons = document.querySelectorAll('.about-subtab-btn');
        const aboutPanels = document.querySelectorAll('.about-panel');

        // Update button states
        subtabButtons.forEach(btn => {
          const isActive = btn.dataset.subtab === subtabId;
          btn.classList.toggle('active', isActive);
        });

        // Update panel visibility
        aboutPanels.forEach(panel => {
          panel.classList.remove('active');
        });

        // Show the selected panel
        const targetPanel = document.getElementById(`about-${subtabId}`);
        if (targetPanel) {
          targetPanel.classList.add('active');

          // Sync theme for the iframe
          const iframe = targetPanel.querySelector('iframe');
          if (iframe && typeof window.syncIframeTheme === 'function') {
            window.syncIframeTheme(iframe);
          }

          // Initialize Mermaid diagrams if showing design tab
          if (subtabId === 'design' && iframe && iframe.contentWindow && iframe.contentWindow.mermaid) {
            setTimeout(() => {
              iframe.contentWindow.mermaid.init();
            }, 500);
          }
        }
      }, 0);
    }
  },

  // Get current route
  getCurrentRoute() {
    return this.currentRoute;
  },

  // Go back in history
  goBack() {
    window.history.back();
  },

  // Go forward in history
  goForward() {
    window.history.forward();
  }
};

// Initialize router when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => router.initialize());
} else {
  router.initialize();
}

// Global functions for backward compatibility
window.navigateTo = (tabId, subtabId) => router.navigateTo(tabId, subtabId);
window.getCurrentRoute = () => router.getCurrentRoute();