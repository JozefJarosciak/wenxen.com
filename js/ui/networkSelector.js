// Network Selector UI Component
import { chainManager, SUPPORTED_CHAINS, onChainChange } from '../config/chainConfig.js';

class NetworkSelectorUI {
  constructor() {
    this.selectorBtn = null;
    this.dropdown = null;
    this.isOpen = false;
    this.isSwitching = false;
    this.overlay = null;
  }

  initialize() {
    console.log('NetworkSelector: Starting initialization');
    this.selectorBtn = document.getElementById('networkSelectorBtn');
    this.dropdown = document.getElementById('networkDropdown');
    
    console.log('NetworkSelector: Found elements:', {
      selectorBtn: !!this.selectorBtn,
      dropdown: !!this.dropdown
    });
    
    if (!this.selectorBtn || !this.dropdown) {
      console.error('Network selector elements not found', {
        selectorBtn: this.selectorBtn,
        dropdown: this.dropdown
      });
      return;
    }

    this.setupEventListeners();
    this.setupWalletListener();
    this.updateDisplay();
    
    // Listen for chain changes from our app
    onChainChange((newChain, config) => {
      this.updateDisplay();
    });
    
    console.log('NetworkSelector: Initialization complete');
  }

  setupEventListeners() {
    console.log('NetworkSelector: Setting up event listeners');
    
    // Make sure we're not adding duplicate listeners
    if (this._listenersSetup) {
      console.log('NetworkSelector: Listeners already setup, skipping');
      return;
    }
    
    // Toggle dropdown
    this.selectorBtn.addEventListener('click', (e) => {
      console.log('NetworkSelector: Button clicked', e);
      e.stopPropagation();
      e.preventDefault();
      this.toggleDropdown();
    });

    // Network option clicks - add listeners to each option directly
    const options = this.dropdown.querySelectorAll('.network-option');
    console.log('NetworkSelector: Found', options.length, 'network options');
    
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        console.log('NetworkSelector: Option clicked', option.dataset.chain);
        e.stopPropagation();
        e.preventDefault();
        const chain = option.dataset.chain;
        if (chain && chain !== chainManager.getCurrentChain()) {
          this.switchNetwork(chain);
        }
        this.closeDropdown();
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.selectorBtn.contains(e.target) && !this.dropdown.contains(e.target)) {
        this.closeDropdown();
      }
    });

    // Keyboard navigation
    this.selectorBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleDropdown();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.closeDropdown();
      }
    });
    
    this._listenersSetup = true;
    console.log('NetworkSelector: Event listeners setup complete');
  }

  toggleDropdown() {
    console.log('NetworkSelector: Toggle dropdown, current state:', this.isOpen);
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    console.log('NetworkSelector: Opening dropdown');
    this.dropdown.hidden = false;
    this.dropdown.style.display = 'block';
    this.selectorBtn.setAttribute('aria-expanded', 'true');
    this.isOpen = true;
    this.updateCheckmarks();
    console.log('NetworkSelector: Dropdown opened');
  }

  closeDropdown() {
    this.dropdown.hidden = true;
    this.dropdown.style.display = 'none';
    this.selectorBtn.setAttribute('aria-expanded', 'false');
    this.isOpen = false;
  }

  updateDisplay() {
    const currentChain = chainManager.getCurrentChain();
    const config = chainManager.getCurrentConfig();
    
    console.log('NetworkSelector: Updating display for chain:', currentChain);
    
    // Update button display
    const nameElement = document.getElementById('networkDisplayName');
    const iconElement = document.getElementById('networkIcon');
    
    if (nameElement) {
      nameElement.textContent = config.name;
    }
    
    if (iconElement) {
      iconElement.textContent = this.getChainIcon(currentChain);
    }
    
    this.updateCheckmarks();
  }

  updateCheckmarks() {
    const currentChain = chainManager.getCurrentChain();
    const options = this.dropdown.querySelectorAll('.network-option');
    
    options.forEach(option => {
      const chain = option.dataset.chain;
      const check = option.querySelector('.network-option-check');
      if (check) {
        check.style.display = chain === currentChain ? 'inline' : 'none';
      }
      // Also update visual state of the option
      option.classList.toggle('active', chain === currentChain);
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
    console.log('NetworkSelector: Switching to chain:', newChain);
    
    if (this.isSwitching) {
      console.log('NetworkSelector: Already switching, ignoring');
      return;
    }
    
    this.isSwitching = true;
    this.showSwitchingOverlay(newChain);
    
    try {
      // Save current state
      await this.saveCurrentChainState();
      
      // Clear current chain data from UI
      await this.clearCurrentChainUI();
      
      // Switch chain in our app
      chainManager.setChain(newChain);
      
      // Try to switch wallet network automatically
      await this.switchWalletNetwork(newChain);
      
      // Load new chain data
      await this.loadNewChainData();
      
      // Reload the page to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error('Error switching network:', error);
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
      // Try to switch to the chain
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
      console.log(`Successfully switched wallet to ${config.name}`);
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          // Try to add the chain
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
    // Save any unsaved data for the current chain
    const currentChain = chainManager.getCurrentChain();
    
    // Save current RPC settings
    const rpcInput = document.getElementById('customRPC');
    if (rpcInput && rpcInput.value) {
      const rpcList = rpcInput.value.trim().split('\n').filter(Boolean);
      chainManager.saveRPCEndpoints(rpcList);
    }
    
    // Save current addresses being tracked
    const addressInput = document.getElementById('ethAddress');
    if (addressInput && addressInput.value) {
      // Use chainStorage to save with chain prefix
      if (window.chainStorage) {
        window.chainStorage.setItem('ethAddress', addressInput.value);
      } else {
        const key = chainManager.getStorageKey('ethAddress');
        localStorage.setItem(key, addressInput.value);
      }
    }
    
    console.log(`Saved state for ${currentChain}`);
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
    
      // Clear input fields
    const inputs = ['ethAddress', 'customRPC', 'startBlock', 'endBlock'];
    inputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        input.value = '';
      }
    });
    
    // Clear any displayed stats
    const stats = document.querySelectorAll('.stat-value');
    stats.forEach(stat => {
      stat.textContent = '0';
    });
  }

  async loadNewChainData() {
    const newChain = chainManager.getCurrentChain();
    const config = chainManager.getCurrentConfig();
    
    // Load chain-specific RPC settings
    const rpcList = chainManager.getRPCEndpoints();
    const rpcInput = document.getElementById('customRPC');
    if (rpcInput) {
      rpcInput.value = rpcList.join('\n');
      
      // Auto-import RPCs for Base if empty (first time)
      if (newChain === 'BASE' && rpcList.length === 0) {
        console.log('Base chain has no RPCs, will auto-import after reload');
        // The auto-import will happen after page reload via checkAutoImportRPCs()
      }
    }
    
    // Load chain-specific tracked addresses with smart fallback
    const addressInput = document.getElementById('ethAddress');
    if (addressInput) {
      let addresses = '';
      
      if (window.chainStorage) {
        // First try chain-specific addresses
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
    
    // Update explorer links
    this.updateExplorerLinks();
    
    console.log(`Loaded data for ${newChain}`);
  }

  updateExplorerLinks() {
    const config = chainManager.getCurrentConfig();
    
    // Update any existing explorer links
    const links = document.querySelectorAll('a[href*="etherscan.io"], a[href*="basescan.org"]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        // Extract the transaction/address/block hash
        const match = href.match(/\/(tx|address|block)\/([a-zA-Z0-9]+)/);
        if (match) {
          const type = match[1];
          const hash = match[2];
          link.setAttribute('href', chainManager.getExplorerUrl(type, hash));
        }
      }
    });
  }

  showError(message) {
    // Use existing toast manager if available
    if (window.toastManager) {
      window.toastManager.showToast(message, 'error');
    } else {
      alert(message);
    }
  }
  
  // Setup wallet network change listener
  setupWalletListener() {
    if (!window.ethereum) return;
    
    // Don't remove all listeners - other parts of the app may need them
    // Just add our listener
    
    // Listen for wallet network changes (add our handler without removing others)
    const walletChainHandler = async (chainIdHex) => {
      const chainId = parseInt(chainIdHex, 16);
      console.log('Wallet network changed to chain ID:', chainId);
      
      // Find which chain this ID corresponds to
      const chainKey = chainManager.getChainById(chainId);
      
      if (chainKey && chainKey !== chainManager.getCurrentChain()) {
        console.log(`Wallet switched to ${chainKey}, syncing app...`);
        
        // Don't show the switching overlay for wallet-initiated changes
        // Just update our app state to match
        this.isSwitching = true;
        
        try {
          // Save current state
          await this.saveCurrentChainState();
          
          // Clear current chain data from UI
          await this.clearCurrentChainUI();
          
          // Switch chain in our app to match wallet
          chainManager.setChain(chainKey);
          
          // Load new chain data
          await this.loadNewChainData();
          
          // Reload the page to ensure clean state
          setTimeout(() => {
            window.location.reload();
          }, 500);
          
        } catch (error) {
          console.error('Error syncing with wallet network:', error);
          this.showError('Failed to sync with wallet network');
          this.isSwitching = false;
        }
      } else if (!chainKey) {
        console.log('Wallet switched to unsupported chain ID:', chainId);
        // Optionally show a message that this chain is not supported
        if (window.toastManager) {
          window.toastManager.showToast(`Chain ID ${chainId} is not supported. Please switch to Ethereum or Base.`, 'warning');
        }
      }
    };
    
    // Add the listener
    window.ethereum.on?.('chainChanged', walletChainHandler);
    
    // Store reference so we can remove it later if needed
    this.walletChainHandler = walletChainHandler;
  }
}

// Create and export singleton instance
export const networkSelector = new NetworkSelectorUI();

// Don't auto-initialize here - will be initialized from index.html after app setup
console.log('NetworkSelector module loaded');

// Make available globally
window.networkSelector = networkSelector;

export default networkSelector;