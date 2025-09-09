// Danger Zone Dropdown Manager - Updates dropdown based on current chain
export class DangerZoneDropdown {
  constructor() {
    this.dropdown = null;
    this.currentChain = null;
  }

  initialize() {
    this.dropdown = document.getElementById('resetDbSelect');
    if (!this.dropdown) return;
    
    // Update dropdown when chain changes
    this.updateDropdown();
    
    // Listen for chain changes
    window.addEventListener('chainChanged', () => {
      this.updateDropdown();
    });
  }

  updateDropdown() {
    if (!this.dropdown) return;
    
    // Get current chain
    const chain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
    
    // Only update if chain changed
    if (this.currentChain === chain) return;
    this.currentChain = chain;
    
    const isEthereum = chain === 'ETHEREUM';
    const chainName = isEthereum ? 'Ethereum' : 'Base';
    const prefix = isEthereum ? 'ETH_' : 'BASE_';
    
    // Store current selection
    const currentValue = this.dropdown.value;
    
    // Clear existing options
    this.dropdown.innerHTML = '';
    
    // Add options based on current chain
    const options = [
      {
        value: 'all-with-storage',
        text: `All Data + Local Storage (${chainName})`
      },
      {
        value: 'all',
        text: `All Data (${chainName} databases)`
      },
      {
        value: `${prefix}DB_Cointool`,
        text: `${prefix}DB_Cointool (${chainName} mints)`
      },
      {
        value: `${prefix}DB_Xenft`,
        text: `${prefix}DB_Xenft (${chainName} NFTs)`
      },
      {
        value: `${prefix}DB_XenftStake`,
        text: `${prefix}DB_XenftStake (${chainName} XENFT stakes)`
      },
      {
        value: `${prefix}DB_XenStake`,
        text: `${prefix}DB_XenStake (${chainName} XEN stakes)`
      },
      {
        value: 'storage-only',
        text: `Local Storage Only (${chainName})`
      }
    ];
    
    // Add options to dropdown
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.text;
      this.dropdown.appendChild(option);
    });
    
    // Try to restore previous selection if it's still valid
    const validValues = options.map(o => o.value);
    if (validValues.includes(currentValue)) {
      this.dropdown.value = currentValue;
    } else {
      // Default to 'all-with-storage'
      this.dropdown.value = 'all-with-storage';
    }
    
    console.log(`Danger Zone dropdown updated for ${chainName}`);
  }
}

// Create and export singleton
export const dangerZoneDropdown = new DangerZoneDropdown();

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  const initDropdown = () => {
    dangerZoneDropdown.initialize();
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropdown);
  } else {
    // DOM already loaded
    setTimeout(initDropdown, 100);
  }
}