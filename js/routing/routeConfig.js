// Route configuration for all tabs and subtabs
export const routeConfig = {
  // Base path for the application (auto-detected in production)
  basePath: '',

  // Default route when no path is specified
  defaultRoute: {
    tab: 'tab-dashboard',
    subtab: null
  },

  // Main tab routes
  routes: {
    '': {
      tab: 'tab-dashboard',
      title: 'Dashboard - WenXen.com'
    },
    'dashboard': {
      tab: 'tab-dashboard',
      title: 'Dashboard - WenXen.com'
    },
    'mint': {
      tab: 'tab-mint',
      title: 'Mint/Stake - WenXen.com'
    },
    'xen': {
      tab: 'tab-xen',
      title: 'XEN - WenXen.com'
    },
    'settings': {
      tab: 'tab-settings',
      title: 'Settings - WenXen.com'
    },
    'about': {
      tab: 'tab-about',
      title: 'About - WenXen.com'
    }
  },

  // Reverse mapping: tab/subtab combinations to URL paths
  reverseRoutes: {
    'tab-dashboard': 'dashboard',
    'tab-mint': 'mint',
    'tab-xen': 'xen',
    'tab-settings': 'settings',
    'tab-about': 'about'
  },

  // Get URL path for a tab/subtab combination
  getPath(tabId, subtabId = null) {
    const key = subtabId ? `${tabId}/${subtabId}` : tabId;
    return this.reverseRoutes[key] || '';
  },

  // Parse a URL path to get tab and subtab
  parsePath(path) {
    // Remove leading/trailing slashes and normalize
    const cleanPath = String(path || '').replace(/^#\/?|^\/+|\/+$/g, '').toLowerCase();

    // Handle empty path (root)
    if (!cleanPath) {
      return this.defaultRoute;
    }

    const segments = cleanPath.split('/');
    const mainPath = segments[0];

    // Check if main route exists
    const route = this.routes[mainPath];
    if (!route) {
      return this.defaultRoute;
    }

    // Return main route.
    return {
      tab: route.tab,
      subtab: null,
      title: route.title
    };
  },

  // Get full URL for a route
  getFullUrl(tabId, subtabId = null) {
    const path = this.getPath(tabId, subtabId);
    const origin = window.location.origin;
    const basePath = this.basePath;

    const root = `${origin}${basePath}/`;
    return path ? `${root}#${path}` : root;
  }
};
