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

  // Detect base path and environment for routing
  detectBasePath() {
    const pathname = window.location.pathname;
    const hostname = window.location.hostname;
    const port = window.location.port;

    // Check if we're in IDE development server (IntelliJ IDEA)
    this.isIdeServer = hostname === 'localhost' && port === '63342';

    // In production (GitHub Pages or similar), base path might be /wenxen.com/
    // In development (file:// or localhost), base path is usually empty
    if (window.location.protocol === 'file:') {
      routeConfig.basePath = '';
    } else if (pathname.includes('/wenxen.com/')) {
      routeConfig.basePath = '/wenxen.com';
    } else {
      routeConfig.basePath = '';
    }

    this.routingMode = 'hash';
  },

  // Set up browser event listeners
  setupEventListeners() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
      this.handleCurrentRoute(false); // Don't push to history
    });
    window.addEventListener('hashchange', () => {
      this.handleCurrentRoute(false);
    });

    // Listen for tab changes from tabManager
    document.addEventListener('tabChanged', (event) => {
      const { tabId, fromRouter } = event.detail;
      // Only update URL if change didn't come from router (prevent loops)
      if (!fromRouter) {
        this.updateUrlForTab(tabId);
      }
    });

  },

  // Get current path from URL (supports both path and query modes)
  getCurrentPath() {
    const hashPath = window.location.hash.replace(/^#\/?/, '');
    if (hashPath) {
      return hashPath;
    }

    // Compatibility fallback if the static host serves index.html for old path routes.
    const pathname = window.location.pathname;
    const basePath = routeConfig.basePath;
    const appPath = basePath && pathname.startsWith(basePath)
      ? pathname.substring(basePath.length)
      : pathname;
    return appPath === '/' ? '' : appPath;
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

    const root = window.location.protocol === 'file:'
      ? window.location.href.replace(/[?#].*$/, '')
      : `${origin}${basePath}/`;
    const cleanPath = String(path || '').replace(/^\/+|#\/?/g, '');
    return cleanPath ? `${root}#${cleanPath}` : root;
  },

  // Navigate to a specific route
  navigateTo(tabId, subtabId = null, pushToHistory = true) {
    const path = routeConfig.getPath(tabId, subtabId);
    const fullPath = path || '';
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
    try {
      window.trackPageView?.(route.title, newUrl);
    } catch (_) {}

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

  // Activate a subtab (reserved for future tab-specific nested routes)
  activateSubtab(tabId, subtabId) {
    return { tabId, subtabId };
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
window.router = router;
window.navigateTo = (tabId, subtabId) => router.navigateTo(tabId, subtabId);
window.getCurrentRoute = () => router.getCurrentRoute();
