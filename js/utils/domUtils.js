// DOM utilities - shared DOM manipulation and event handling functions
export const domUtils = {
  // Debounce function
  debounce(fn, wait = 200) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  },

  // Set header filter text with debouncing
  setHeaderFilterText(field, text) {
    const input = document.querySelector(`.tabulator-col[tabulator-field="${field}"] .tabulator-header-filter input`);
    if (!input) return;
    input.value = text || "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  },

  // Debounced variant of setHeaderFilterText
  setHeaderFilterTextDebounced: null, // Will be set after debounce is available

  // Show/hide element
  toggleElement(element, show) {
    if (!element) return;
    element.style.display = show ? '' : 'none';
  },

  // Add/remove CSS class
  toggleClass(element, className, add) {
    if (!element) return;
    if (add) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  },

  // Create element with attributes
  createElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    Object.keys(attributes).forEach(key => {
      if (key === 'className') {
        element.className = attributes[key];
      } else if (key === 'style' && typeof attributes[key] === 'object') {
        Object.assign(element.style, attributes[key]);
      } else {
        element.setAttribute(key, attributes[key]);
      }
    });
    if (textContent) element.textContent = textContent;
    return element;
  },

  // Wait for element to exist
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  },

  // Scroll to element smoothly
  scrollToElement(element, behavior = 'smooth') {
    if (!element) return;
    element.scrollIntoView({ behavior, block: 'start' });
  },

  // Get element dimensions
  getElementDimensions(element) {
    if (!element) return { width: 0, height: 0 };
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left
    };
  },

  // Check if element is visible in viewport
  isElementInViewport(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  // Attach event listeners with cleanup
  addEventListeners(element, events) {
    if (!element || !events) return () => {};
    
    const cleanupFunctions = [];
    
    Object.keys(events).forEach(eventType => {
      const handler = events[eventType];
      element.addEventListener(eventType, handler);
      cleanupFunctions.push(() => element.removeEventListener(eventType, handler));
    });
    
    // Return cleanup function
    return () => cleanupFunctions.forEach(cleanup => cleanup());
  },

  // Copy text to clipboard
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const result = document.execCommand('copy');
        document.body.removeChild(textArea);
        return result;
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      return false;
    }
  }
};

// Initialize debounced variant
domUtils.setHeaderFilterTextDebounced = domUtils.debounce(domUtils.setHeaderFilterText, 200);

// Legacy global functions for backward compatibility
window.debounce = domUtils.debounce;
window.setHeaderFilterText = domUtils.setHeaderFilterText;
window.setHeaderFilterTextDebounced = domUtils.setHeaderFilterTextDebounced;