// Theme management - centralized theme switching and persistence
import { themeStorage } from '../utils/storageUtils.js';

export const themeManager = {
  // Check system preference
  isSystemDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  },

  // Get effective theme (resolve system preference)
  effectiveTheme(mode) {
    if (mode === 'system') return this.isSystemDark() ? 'dark' : 'light';
    return (mode === 'dark') ? 'dark' : 'light';
  },

  // Apply theme to DOM
  applyTheme(mode) {
    const effectiveMode = this.effectiveTheme(mode);
    
    // Update body classes for both naming conventions
    document.body.classList.remove('light-mode', 'dark-mode', 'theme-light', 'theme-dark');
    document.body.classList.add(effectiveMode + '-mode');
    document.body.classList.add('theme-' + effectiveMode);
    
    // Toggle Tabulator dark CSS
    try {
      const tabulatorLink = document.getElementById('tabulatorMidnightCss');
      if (tabulatorLink) {
        tabulatorLink.disabled = !(effectiveMode === 'dark');
      }
    } catch (error) {
      console.warn('Failed to toggle Tabulator CSS:', error);
    }
    
    // Toggle Flatpickr dark CSS
    try {
      const flatpickrLink = document.getElementById('flatpickrDarkCss');
      if (flatpickrLink) {
        flatpickrLink.disabled = !(effectiveMode === 'dark');
      }
    } catch (error) {
      console.warn('Failed to toggle Flatpickr CSS:', error);
    }
    
    // Re-style ECharts chart if available
    try {
      if (typeof window.updateVmuChart === 'function') {
        window.updateVmuChart();
      }
    } catch (error) {
      console.warn('Failed to update VMU chart theme:', error);
    }
    
    // Update About tab iframes if they exist
    try {
      const iframes = document.querySelectorAll('.about-iframe');
      iframes.forEach(iframe => {
        if (iframe.contentWindow) {
          const themeClass = 'theme-' + effectiveMode;
          iframe.contentWindow.postMessage({ type: 'theme-change', theme: themeClass }, '*');
          // Also try direct access
          if (iframe.contentDocument && iframe.contentDocument.body) {
            iframe.contentDocument.body.className = themeClass;
          }
        }
      });
    } catch (error) {
      console.debug('Failed to update iframe themes:', error);
    }
    
    // Update header menu UI
    this.updateThemeMenuUI();
    
    // Dispatch custom event for theme change
    document.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: effectiveMode, originalMode: mode }
    }));
  },

  // Set theme and persist
  setTheme(theme) {
    themeStorage.storeTheme(theme);
    this.applyTheme(theme);
  },

  // Get current theme
  getCurrentTheme() {
    return themeStorage.getStoredTheme();
  },

  // Update theme menu UI state
  updateThemeMenuUI() {
    const currentTheme = this.getCurrentTheme();
    const displayName = this.getThemeDisplayName(currentTheme);
    
    // Update current theme indicator
    const currentElement = document.getElementById('themeMenuCurrent');
    if (currentElement) {
      currentElement.textContent = displayName;
    }
    
    // Update radio button states
    const menuItems = document.querySelectorAll('#headerMenu .menu-item[data-theme]');
    menuItems.forEach(button => {
      const isSelected = button.getAttribute('data-theme') === currentTheme;
      button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      
      // Update visual state
      if (isSelected) {
        button.classList.add('selected');
      } else {
        button.classList.remove('selected');
      }
    });
  },

  // Get display name for theme
  getThemeDisplayName(theme) {
    const names = {
      light: 'Light',
      dark: 'Dark'
    };
    return names[theme] || 'Dark';
  },

  // Initialize theme system
  initialize() {
    // Apply stored theme
    const storedTheme = this.getCurrentTheme();
    this.applyTheme(storedTheme);
    
    // Set up header menu if available
    this.setupHeaderMenu();
    
    // Listen for system preference changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        const currentTheme = this.getCurrentTheme();
        if (currentTheme === 'system') {
          this.applyTheme('system');
        }
      });
    }
  },

  // Set up header menu interactions
  setupHeaderMenu() {
    try {
      const toggle = document.getElementById('headerMenuToggle');
      const panel = document.getElementById('headerMenu');
      
      if (!toggle || !panel) return;
      
      const closeMenu = () => {
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      };
      
      const openMenu = () => {
        panel.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        this.updateThemeMenuUI();
      };
      
      const toggleMenu = () => {
        if (panel.hidden) {
          openMenu();
        } else {
          closeMenu();
        }
      };
      
      // Toggle menu on button click
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleMenu();
      });
      
      // Close menu on outside click
      document.addEventListener('click', (event) => {
        if (panel.hidden) return;
        
        const menuRoot = document.getElementById('headerMenuRoot');
        if (menuRoot && menuRoot.contains(event.target)) return;
        
        closeMenu();
      });
      
      // Close menu on escape key
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeMenu();
        }
      });
      
      // Handle theme selection
      panel.addEventListener('click', (event) => {
        const menuItem = event.target.closest('.menu-item');
        if (!menuItem) return;
        
        const theme = menuItem.getAttribute('data-theme');
        if (!theme) return;
        
        this.setTheme(theme);
        closeMenu();
      });
      
      // Initial UI sync
      this.updateThemeMenuUI();
      
    } catch (error) {
      console.warn('Failed to setup header menu:', error);
    }
  }
};

// Legacy global functions for backward compatibility
window.getStoredTheme = () => themeManager.getCurrentTheme();
window.storeTheme = (theme) => themeManager.setTheme(theme);
window.isSystemDark = () => themeManager.isSystemDark();
window.effectiveTheme = (mode) => themeManager.effectiveTheme(mode);
window.applyTheme = (mode) => themeManager.applyTheme(mode);
window.updateThemeMenuUI = () => themeManager.updateThemeMenuUI();

// Auto-initialize when module loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => themeManager.initialize());
} else {
  themeManager.initialize();
}