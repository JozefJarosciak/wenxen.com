// Working Network Selector - Final Version
import { chainManager, SUPPORTED_CHAINS } from '../config/chainConfig.js';

class NetworkSelectorUI {
  constructor() {
    this.isOpen = false;
    this.selectorBtn = null;
    this.dropdown = null;
  }

  async initialize() {
    // Starting initialization
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }
    
    // Get elements
    this.selectorBtn = document.getElementById('networkSelectorBtn');
    this.dropdown = document.getElementById('networkDropdown');
    
    if (!this.selectorBtn || !this.dropdown) {
      console.error('NetworkSelector: Required elements not found');
      return;
    }
    
    // Elements found, setting up
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Update display based on current chain
    this.updateDisplay();
    
    // Listen for chain changes
    chainManager.onChainChange(() => {
      console.log('NetworkSelector: Chain changed, updating display');
      this.updateDisplay();
    });
    
    // Setup wallet listener
    if (window.ethereum) {
      window.ethereum.on?.('chainChanged', (chainIdHex) => {
        this.handleWalletChainChange(chainIdHex);
      });
    }
    
    // Initialization complete
  }
  
  setupEventHandlers() {
    // Button click handler
    this.selectorBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown();
    });
    
    // Option click handlers
    const options = this.dropdown.querySelectorAll('.network-option');
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleOptionClick(option);
      });
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && 
          !this.selectorBtn.contains(e.target) && 
          !this.dropdown.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }
  
  toggleDropdown() {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }
  
  openDropdown() {
    this.dropdown.style.display = 'block';
    this.dropdown.hidden = false;
    this.selectorBtn.setAttribute('aria-expanded', 'true');
    this.isOpen = true;
    this.updateCheckmarks();
  }
  
  closeDropdown() {
    this.dropdown.style.display = 'none';
    this.dropdown.hidden = true;
    this.selectorBtn.setAttribute('aria-expanded', 'false');
    this.isOpen = false;
  }
  
  async handleOptionClick(option) {
    const targetChain = option.dataset.chain;
    const currentChain = chainManager.getCurrentChain();
    
    if (targetChain && targetChain !== currentChain) {
      console.log(`NetworkSelector: User selected ${targetChain} (current: ${currentChain})`);
      
      // Close dropdown first
      this.closeDropdown();
      
      // Don't switch the app chain yet!
      // First check if wallet is connected and needs to switch
      if (window.ethereum) {
        try {
          // Get current wallet chain
          const walletChainId = await window.ethereum.request({ method: 'eth_chainId' });
          const walletChainIdNum = parseInt(walletChainId, 16);
          const targetChainId = SUPPORTED_CHAINS[targetChain].id;
          
          if (walletChainIdNum !== targetChainId) {
            // Wallet is on different chain - prompt to switch wallet first
            console.log(`Wallet on chain ${walletChainIdNum}, need to switch to ${targetChainId}`);
            
            // Show the chain mismatch dialog but with reversed logic
            // We want to switch TO the target chain
            const switched = await this.promptWalletSwitch(targetChain, targetChainId);
            
            if (switched) {
              // Wallet successfully switched, now switch the app
              console.log('Wallet switched successfully, switching app chain');
              this.saveCurrentState();
              chainManager.setChain(targetChain);
              this.showSwitchingOverlay(targetChain);
              setTimeout(() => window.location.reload(), 500);
            } else {
              // User cancelled or switch failed - stay on current chain
              console.log('Wallet switch cancelled or failed, staying on current chain');
              this.updateDisplay(); // Refresh display to show current chain
            }
          } else {
            // Wallet already on target chain, just switch the app
            console.log('Wallet already on target chain, switching app');
            this.saveCurrentState();
            chainManager.setChain(targetChain);
            this.showSwitchingOverlay(targetChain);
            setTimeout(() => window.location.reload(), 500);
          }
        } catch (error) {
          console.error('Error checking wallet chain:', error);
          // If we can't check wallet, just switch the app
          this.saveCurrentState();
          chainManager.setChain(targetChain);
          this.showSwitchingOverlay(targetChain);
          setTimeout(() => window.location.reload(), 500);
        }
      } else {
        // No wallet connected, just switch the app
        this.saveCurrentState();
        chainManager.setChain(targetChain);
        this.showSwitchingOverlay(targetChain);
        setTimeout(() => window.location.reload(), 500);
      }
    } else {
      this.closeDropdown();
    }
  }
  
  async promptWalletSwitch(targetChain, targetChainId) {
    const chainName = SUPPORTED_CHAINS[targetChain].name;
    
    // Use the chain mismatch handler if available
    if (window.chainMismatchHandler) {
      return await window.chainMismatchHandler.requestWalletSwitch(targetChain);
    }
    
    // Fallback: try to switch directly
    try {
      const chainIdHex = '0x' + targetChainId.toString(16);
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }]
      });
      return true;
    } catch (error) {
      console.error('Failed to switch wallet chain:', error);
      return false;
    }
  }
  
  handleWalletChainChange(chainIdHex) {
    const chainId = parseInt(chainIdHex, 16);
    const chainKey = chainManager.getChainById(chainId);
    
    // Don't auto-sync - just update the network badge to show mismatch
    console.log(`NetworkSelector: Wallet changed to chain ${chainId} (${chainKey || 'unsupported'})`);
    
    // Update network badge to show wallet's chain if different
    if (typeof updateNetworkBadge === 'function') {
      updateNetworkBadge();
    }
  }
  
  updateDisplay() {
    const currentChain = chainManager.getCurrentChain();
    const config = chainManager.getCurrentConfig();
    
    if (!config) {
      console.error('NetworkSelector: No config available');
      return;
    }
    
    // Updating display for network
    
    // Update button text
    const nameEl = document.getElementById('networkDisplayName');
    if (nameEl) {
      nameEl.textContent = config.name;
    }
    
    // Update button icon
    const iconEl = document.getElementById('networkIcon');
    if (iconEl) {
      iconEl.textContent = currentChain === 'BASE' ? '🔵' : '⟠';
    }
    
    // Update brand suffix
    const brandEl = document.querySelector('.brand-suffix-text');
    if (brandEl) {
      brandEl.textContent = config.name;
    }
    
    // Update checkmarks
    this.updateCheckmarks();
  }
  
  updateCheckmarks() {
    const currentChain = chainManager.getCurrentChain();
    const options = this.dropdown.querySelectorAll('.network-option');
    
    options.forEach(option => {
      const chain = option.dataset.chain;
      const checkEl = option.querySelector('.network-option-check');
      
      if (checkEl) {
        if (chain === currentChain) {
          checkEl.style.display = 'inline';
          option.classList.add('active');
        } else {
          checkEl.style.display = 'none';
          option.classList.remove('active');
        }
      }
    });
  }
  
  saveCurrentState() {
    // Save RPCs
    const rpcInput = document.getElementById('customRPC');
    if (rpcInput?.value) {
      const rpcList = rpcInput.value.trim().split('\n').filter(Boolean);
      chainManager.saveRPCEndpoints(rpcList);
    }
    
    // Save addresses
    const addressInput = document.getElementById('ethAddress');
    if (addressInput?.value) {
      const key = chainManager.getStorageKey('ethAddress');
      localStorage.setItem(key, addressInput.value);
    }
  }
  
  showSwitchingOverlay(newChain) {
    const config = SUPPORTED_CHAINS[newChain];
    
    const overlay = document.createElement('div');
    overlay.className = 'chain-switching-overlay';
    overlay.innerHTML = `
      <div class="chain-switching-modal">
        <div class="chain-switching-spinner"></div>
        <div class="chain-switching-title">Switching to ${config.name}</div>
        <div class="chain-switching-message">Loading chain data...</div>
      </div>
    `;
    
    document.body.appendChild(overlay);
  }
}

// Create singleton
const networkSelector = new NetworkSelectorUI();

// Export
export { networkSelector };
export default networkSelector;

// Make globally available
window.networkSelector = networkSelector;

// Debug functions
window.debugNetworkSelector = () => {
  console.log('=== Network Selector Debug ===');
  console.log('Current chain:', chainManager.getCurrentChain());
  console.log('Current config:', chainManager.getCurrentConfig());
  console.log('LocalStorage selectedChain:', localStorage.getItem('selectedChain'));
  console.log('Button text:', document.getElementById('networkDisplayName')?.textContent);
  console.log('Button icon:', document.getElementById('networkIcon')?.textContent);
  console.log('Brand suffix:', document.querySelector('.brand-suffix-text')?.textContent);
  console.log('Dropdown display:', document.getElementById('networkDropdown')?.style.display);
};

// NetworkSelector module loaded