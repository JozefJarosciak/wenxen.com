// Simplified and Fixed Network Selector UI Component
import { chainManager, SUPPORTED_CHAINS } from '../config/chainConfig.js';

class NetworkSelectorUI {
  constructor() {
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    
    console.log('NetworkSelector: Initializing');
    
    // Wait a bit to ensure DOM is ready
    setTimeout(() => {
      this.setupUI();
      this.initialized = true;
    }, 100);
  }
  
  setupUI() {
    const selectorBtn = document.getElementById('networkSelectorBtn');
    const dropdown = document.getElementById('networkDropdown');
    
    if (!selectorBtn || !dropdown) {
      console.error('NetworkSelector: Elements not found');
      return;
    }
    
    console.log('NetworkSelector: Setting up UI');
    
    // Update display immediately
    this.updateDisplay();
    
    // Setup button click
    selectorBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isOpen = dropdown.style.display === 'block';
      
      if (isOpen) {
        dropdown.style.display = 'none';
        selectorBtn.setAttribute('aria-expanded', 'false');
      } else {
        dropdown.style.display = 'block';
        selectorBtn.setAttribute('aria-expanded', 'true');
        this.updateCheckmarks();
      }
    };
    
    // Setup option clicks
    const options = dropdown.querySelectorAll('.network-option');
    options.forEach(option => {
      option.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const chain = option.dataset.chain;
        console.log('NetworkSelector: Switching to', chain);
        
        if (chain && chain !== chainManager.getCurrentChain()) {
          // Save current state
          this.saveCurrentState();
          
          // Switch chain
          chainManager.setChain(chain);
          
          // Update display
          this.updateDisplay();
          
          // Close dropdown
          dropdown.style.display = 'none';
          selectorBtn.setAttribute('aria-expanded', 'false');
          
          // Reload page after a short delay
          setTimeout(() => {
            console.log('NetworkSelector: Reloading page');
            window.location.reload();
          }, 500);
        } else {
          // Just close dropdown
          dropdown.style.display = 'none';
          selectorBtn.setAttribute('aria-expanded', 'false');
        }
      };
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!selectorBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
        selectorBtn.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Listen for chain changes
    chainManager.onChainChange(() => {
      console.log('NetworkSelector: Chain changed, updating display');
      this.updateDisplay();
    });
    
    // Listen for wallet changes
    if (window.ethereum) {
      window.ethereum.on?.('chainChanged', (chainIdHex) => {
        const chainId = parseInt(chainIdHex, 16);
        const chainKey = chainManager.getChainById(chainId);
        
        if (chainKey && chainKey !== chainManager.getCurrentChain()) {
          console.log('NetworkSelector: Wallet changed to', chainKey);
          this.saveCurrentState();
          chainManager.setChain(chainKey);
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      });
    }
  }
  
  updateDisplay() {
    try {
      const currentChain = chainManager.getCurrentChain();
      const config = chainManager.getCurrentConfig();
      
      if (!config) {
        console.error('NetworkSelector: No config found');
        return;
      }
      
      console.log('NetworkSelector: Updating display to', config.name);
      
      // Update button text
      const nameEl = document.getElementById('networkDisplayName');
      if (nameEl) {
        nameEl.textContent = config.name;
      }
      
      // Update button icon
      const iconEl = document.getElementById('networkIcon');
      if (iconEl) {
        const icon = currentChain === 'BASE' ? '🔵' : '⟠';
        iconEl.textContent = icon;
      }
      
      // Update brand suffix
      const brandEl = document.querySelector('.brand-suffix-text');
      if (brandEl) {
        brandEl.textContent = config.name;
      }
      
      // Update checkmarks
      this.updateCheckmarks();
      
    } catch (error) {
      console.error('NetworkSelector: Error updating display', error);
    }
  }
  
  updateCheckmarks() {
    const currentChain = chainManager.getCurrentChain();
    const options = document.querySelectorAll('.network-option');
    
    options.forEach(option => {
      const chain = option.dataset.chain;
      const check = option.querySelector('.network-option-check');
      if (check) {
        check.style.display = chain === currentChain ? 'inline' : 'none';
      }
    });
  }
  
  saveCurrentState() {
    // Save RPC endpoints
    const rpcInput = document.getElementById('customRPC');
    if (rpcInput && rpcInput.value) {
      const rpcList = rpcInput.value.trim().split('\n').filter(Boolean);
      chainManager.saveRPCEndpoints(rpcList);
    }
    
    // Save addresses
    const addressInput = document.getElementById('ethAddress');
    if (addressInput && addressInput.value) {
      const key = chainManager.getStorageKey('ethAddress');
      localStorage.setItem(key, addressInput.value);
    }
  }
}

// Export singleton
export const networkSelector = new NetworkSelectorUI();

// Make globally available
window.networkSelector = networkSelector;

// Force update function for debugging
window.forceNetworkUpdate = () => {
  networkSelector.updateDisplay();
  console.log('Forced network display update');
};

console.log('NetworkSelector: Module loaded');

export default networkSelector;