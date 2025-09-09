// Simplified Network Selector UI Component
import { chainManager, SUPPORTED_CHAINS, onChainChange } from '../config/chainConfig.js';

class NetworkSelectorUI {
  constructor() {
    this.selectorBtn = null;
    this.dropdown = null;
    this.isOpen = false;
    this.isSwitching = false;
    this.overlay = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) {
      console.log('NetworkSelector: Already initialized');
      return;
    }

    console.log('NetworkSelector: Initializing...');
    
    this.selectorBtn = document.getElementById('networkSelectorBtn');
    this.dropdown = document.getElementById('networkDropdown');
    
    if (!this.selectorBtn || !this.dropdown) {
      console.error('NetworkSelector: Required elements not found');
      return;
    }

    // Setup click handler on button
    this.selectorBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('NetworkSelector: Button clicked, toggling dropdown');
      this.toggleDropdown();
    };

    // Setup click handlers on options
    const options = this.dropdown.querySelectorAll('.network-option');
    options.forEach(option => {
      option.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const chain = option.dataset.chain;
        console.log('NetworkSelector: Option clicked:', chain);
        if (chain && chain !== chainManager.getCurrentChain()) {
          this.switchNetwork(chain);
        }
        this.closeDropdown();
      };
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.selectorBtn.contains(e.target) && !this.dropdown.contains(e.target)) {
        this.closeDropdown();
      }
    });

    // Setup wallet listener for chain changes
    this.setupWalletListener();

    // Update display with current chain - force immediate update
    setTimeout(() => {
      this.updateDisplay();
    }, 0);

    // Listen for app chain changes
    onChainChange((newChain, config) => {
      console.log('NetworkSelector: App chain changed to', newChain);
      this.updateDisplay();
    });
    
    // Also update display when page visibility changes (in case of tab switching)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateDisplay();
      }
    });

    this.initialized = true;
    console.log('NetworkSelector: Initialization complete');
  }

  toggleDropdown() {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    console.log('NetworkSelector: Opening dropdown');
    this.dropdown.style.display = 'block';
    this.dropdown.hidden = false;
    this.selectorBtn.setAttribute('aria-expanded', 'true');
    this.isOpen = true;
    this.updateCheckmarks();
  }

  closeDropdown() {
    console.log('NetworkSelector: Closing dropdown');
    this.dropdown.style.display = 'none';
    this.dropdown.hidden = true;
    this.selectorBtn.setAttribute('aria-expanded', 'false');
    this.isOpen = false;
  }

  updateDisplay() {
    try {
      const currentChain = chainManager.getCurrentChain();
      const config = chainManager.getCurrentConfig();
      
      console.log('NetworkSelector: Updating display for chain:', currentChain, 'with name:', config.name);
      
      // Update button text - try multiple times to ensure it updates
      const nameElement = document.getElementById('networkDisplayName');
      if (nameElement) {
        console.log('NetworkSelector: Setting button text to', config.name);
        nameElement.textContent = config.name;
        // Force a reflow to ensure the change is applied
        nameElement.offsetHeight;
      } else {
        console.error('NetworkSelector: networkDisplayName element not found!');
      }
      
      // Update button icon
      const iconElement = document.getElementById('networkIcon');
      if (iconElement) {
        const icon = this.getChainIcon(currentChain);
        console.log('NetworkSelector: Setting icon to', icon);
        iconElement.textContent = icon;
        // Force a reflow
        iconElement.offsetHeight;
      } else {
        console.error('NetworkSelector: networkIcon element not found!');
      }
      
      // Update checkmarks in dropdown
      this.updateCheckmarks();
      
      // Also update aria-label for accessibility
      if (this.selectorBtn) {
        this.selectorBtn.setAttribute('aria-label', `Current network: ${config.name}`);
      }
      
      // Update brand suffix text
      const brandSuffixElement = document.querySelector('.brand-suffix-text');
      if (brandSuffixElement) {
        console.log('NetworkSelector: Updating brand suffix to', config.name);
        brandSuffixElement.textContent = config.name;
      }
    } catch (error) {
      console.error('NetworkSelector: Error updating display:', error);
    }
  }

  updateCheckmarks() {
    if (!this.dropdown) return;
    
    const currentChain = chainManager.getCurrentChain();
    console.log('NetworkSelector: Updating checkmarks for chain:', currentChain);
    
    const options = this.dropdown.querySelectorAll('.network-option');
    
    options.forEach(option => {
      const chain = option.dataset.chain;
      const check = option.querySelector('.network-option-check');
      if (check) {
        const shouldShow = chain === currentChain;
        check.style.display = shouldShow ? 'inline' : 'none';
        console.log(`NetworkSelector: Checkmark for ${chain}: ${shouldShow ? 'visible' : 'hidden'}`);
      }
    });
  }

  getChainIcon(chain) {
    const icons = {
      'ETHEREUM': '⟠',
      'BASE': '🔵'
    };
    return icons[chain] || '🔗';
  }

  async switchNetwork(newChain) {
    if (this.isSwitching) {
      console.log('NetworkSelector: Already switching');
      return;
    }
    
    console.log('NetworkSelector: User switching app to', newChain);
    this.isSwitching = true;
    this.showSwitchingOverlay(newChain);
    
    try {
      // Save current chain state
      await this.saveCurrentChainState();
      
      // Clear current UI
      await this.clearCurrentChainUI();
      
      // Switch chain in app
      chainManager.setChain(newChain);
      
      // Don't force wallet to switch - let user do it manually if they want
      // Just show a message if wallet is on different chain
      if (window.ethereum && window.connectedAccount) {
        const walletChainId = await window.ethereum.request({ method: 'eth_chainId' });
        const walletChainIdDec = parseInt(walletChainId, 16);
        const newChainId = SUPPORTED_CHAINS[newChain].id;
        
        if (walletChainIdDec !== newChainId) {
          console.log(`App switched to ${newChain} but wallet is still on chain ${walletChainIdDec}`);
          // User can manually switch wallet if they want
        }
      }
      
      // Load new chain data
      await this.loadNewChainData();
      
      // Reload page for clean state
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error('NetworkSelector: Error switching network:', error);
      this.hideSwitchingOverlay();
      this.showError('Failed to switch network. Please try again.');
      this.isSwitching = false;
    }
  }

  async switchWalletNetwork(chain) {
    if (!window.ethereum) return;
    
    const config = SUPPORTED_CHAINS[chain];
    const chainId = '0x' + config.id.toString(16);
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
      console.log(`Successfully switched wallet to ${config.name}`);
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId,
              chainName: config.name,
              nativeCurrency: config.nativeCurrency,
              rpcUrls: [config.rpcUrls.default],
              blockExplorerUrls: [config.explorer.baseUrl]
            }],
          });
          console.log(`Successfully added and switched to ${config.name}`);
        } catch (addError) {
          console.warn('Failed to add chain to wallet:', addError);
        }
      } else {
        console.warn('Failed to switch wallet chain:', switchError);
      }
    }
  }

  setupWalletListener() {
    if (!window.ethereum) return;
    
    // Listen for wallet chain changes
    window.ethereum.on?.('chainChanged', async (chainIdHex) => {
      const chainId = parseInt(chainIdHex, 16);
      console.log('NetworkSelector: Wallet chain changed to ID', chainId);
      
      // Find matching chain
      const chainKey = chainManager.getChainById(chainId);
      
      if (chainKey && chainKey !== chainManager.getCurrentChain()) {
        console.log(`NetworkSelector: Wallet switched to ${chainKey}, syncing app to match`);
        
        // Simply switch the app to match wallet - no overlay needed
        try {
          await this.saveCurrentChainState();
          chainManager.setChain(chainKey);
          
          // Reload page to sync everything
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } catch (error) {
          console.error('NetworkSelector: Error syncing with wallet:', error);
        }
      } else if (!chainKey) {
        console.log('NetworkSelector: Wallet switched to unsupported chain', chainId);
        // Don't do anything - let user handle it
      }
    });
  }

  showSwitchingOverlay(newChain) {
    const config = SUPPORTED_CHAINS[newChain];
    
    this.overlay = document.createElement('div');
    this.overlay.className = 'chain-switching-overlay';
    this.overlay.innerHTML = `
      <div class="chain-switching-modal">
        <div class="chain-switching-spinner"></div>
        <div class="chain-switching-title">Switching to ${config.name}</div>
        <div class="chain-switching-message">Loading chain data...</div>
      </div>
    `;
    
    document.body.appendChild(this.overlay);
  }

  hideSwitchingOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  async saveCurrentChainState() {
    const rpcInput = document.getElementById('customRPC');
    if (rpcInput && rpcInput.value) {
      const rpcList = rpcInput.value.trim().split('\n').filter(Boolean);
      chainManager.saveRPCEndpoints(rpcList);
    }
    
    const addressInput = document.getElementById('ethAddress');
    if (addressInput && addressInput.value) {
      if (window.chainStorage) {
        window.chainStorage.setItem('ethAddress', addressInput.value);
      } else {
        const key = chainManager.getStorageKey('ethAddress');
        localStorage.setItem(key, addressInput.value);
      }
    }
  }

  async clearCurrentChainUI() {
    // Clear tables
    const tables = ['cointool-table', 'xenft-table', 'xen-table', 'xenft-stake-table'];
    tables.forEach(tableId => {
      const tableElement = document.getElementById(tableId);
      if (tableElement && window[tableId.replace('-', '_')]) {
        try {
          window[tableId.replace('-', '_')].clearData();
        } catch (e) {
          console.warn(`Could not clear table ${tableId}:`, e);
        }
      }
    });
    
    // Clear inputs
    const inputs = ['ethAddress', 'customRPC', 'startBlock', 'endBlock'];
    inputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        input.value = '';
      }
    });
  }

  async loadNewChainData() {
    const newChain = chainManager.getCurrentChain();
    
    // Load chain-specific RPCs
    const rpcList = chainManager.getRPCEndpoints();
    const rpcInput = document.getElementById('customRPC');
    if (rpcInput) {
      rpcInput.value = rpcList.join('\n');
    }
    
    // Load chain-specific addresses
    const addressInput = document.getElementById('ethAddress');
    if (addressInput) {
      let addresses = '';
      
      if (window.chainStorage) {
        addresses = window.chainStorage.getItem('ethAddress') || '';
        
        // For Base, use Ethereum addresses as default on first load
        if (!addresses && newChain === 'BASE') {
          const baseLoadedKey = 'BASE_addresses_loaded';
          if (!localStorage.getItem(baseLoadedKey)) {
            addresses = localStorage.getItem('ETHEREUM_ethAddress') || '';
            localStorage.setItem(baseLoadedKey, '1');
            if (addresses) {
              window.chainStorage.setItem('ethAddress', addresses);
            }
          }
        }
      } else {
        const key = chainManager.getStorageKey('ethAddress');
        addresses = localStorage.getItem(key) || '';
      }
      
      addressInput.value = addresses;
    }
  }

  showError(message) {
    if (window.toastManager) {
      window.toastManager.showToast(message, 'error');
    } else {
      alert(message);
    }
  }
}

// Create and export singleton
export const networkSelector = new NetworkSelectorUI();

// Make available globally
window.networkSelector = networkSelector;

// Add debugging functions
window.updateNetworkDisplay = () => {
  console.log('Manual update triggered');
  networkSelector.updateDisplay();
};

window.getNetworkState = () => {
  const currentChain = chainManager.getCurrentChain();
  const config = chainManager.getCurrentConfig();
  console.log('Current chain:', currentChain);
  console.log('Current config:', config);
  console.log('Button text element:', document.getElementById('networkDisplayName')?.textContent);
  console.log('Icon element:', document.getElementById('networkIcon')?.textContent);
  return { currentChain, config };
};

console.log('NetworkSelector: Module loaded');

export default networkSelector;