// Danger Zone Dropdown Manager - Updates dropdown based on current chain
export class DangerZoneDropdown {
  constructor() {
    this.dropdown = null;
    this.descriptionDiv = null;
    this.currentChain = null;
    this.currentOptions = [];
  }

  initialize() {
    this.dropdown = document.getElementById('resetDbSelect');
    this.descriptionDiv = document.getElementById('dangerZoneDescription');
    if (!this.dropdown) {
      console.warn('[Danger Zone] Dropdown element not found');
      return;
    }

    console.log('[Danger Zone] Initializing danger zone dropdown');

    // Update dropdown when chain changes
    this.updateDropdown();

    // Update description when selection changes
    this.dropdown.addEventListener('change', () => {
      this.updateDescription();
    });

    // Listen for chain changes via chainManager
    if (window.chainManager) {
      window.chainManager.onChainChange(() => {
        console.log('[Danger Zone] Chain changed, updating dropdown');
        this.updateDropdown();
      });
    } else {
      console.warn('[Danger Zone] ChainManager not available at initialization');
      // Retry setup when chainManager becomes available
      setTimeout(() => {
        if (window.chainManager) {
          console.log('[Danger Zone] ChainManager now available, setting up listener');
          window.chainManager.onChainChange(() => {
            console.log('[Danger Zone] Chain changed (delayed setup), updating dropdown');
            this.updateDropdown();
          });
        }
      }, 1000);
    }
  }

  updateDropdown() {
    if (!this.dropdown) return;

    // Get current chain
    const chain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
    console.log(`[Danger Zone] Updating dropdown for chain: ${chain}`);

    // Only update if chain changed
    if (this.currentChain === chain) {
      console.log(`[Danger Zone] Chain hasn't changed (${chain}), skipping update`);
      return;
    }
    this.currentChain = chain;

    const isEthereum = chain === 'ETHEREUM';
    const chainName = isEthereum ? 'Ethereum' : 'Base';
    const prefix = isEthereum ? 'ETH_' : 'BASE_';

    console.log(`[Danger Zone] Setting up dropdown for ${chainName} (prefix: ${prefix})`);

    // Store current selection
    const currentValue = this.dropdown.value;
    
    // Clear existing options
    this.dropdown.innerHTML = '';
    
    // Add options based on current chain with user-friendly descriptions
    const options = [
      {
        value: 'all-with-storage',
        text: `🔥 Everything (All ${chainName} data + settings)`,
        description: `Deletes all scan data, settings, and preferences for ${chainName}`
      },
      {
        value: 'all',
        text: `📊 All Scan Data (${chainName})`,
        description: `Keeps settings but deletes all mints, NFTs, and stakes for ${chainName}`
      },
      {
        value: `${prefix}_DB_Cointool`,
        text: `🪙 Cointool Mints (${chainName})`,
        description: `Only deletes Cointool mint records for ${chainName}`
      },
      {
        value: `${prefix}_DB_Xenft`,
        text: `🎨 XENFT Collection (${chainName})`,
        description: `Only deletes XENFT/NFT scan data for ${chainName}`
      },
      {
        value: `${prefix}_DB_XenftStake`,
        text: `🔒 XENFT Stakes (${chainName})`,
        description: `Only deletes XENFT staking records for ${chainName}`
      },
      {
        value: `${prefix}_DB_XenStake`,
        text: `💎 XEN Stakes (${chainName})`,
        description: `Only deletes regular XEN staking records for ${chainName}`
      },
      {
        value: 'storage-only',
        text: `⚙️ Settings Only (${chainName})`,
        description: `Only deletes local settings and preferences for ${chainName}`
      }
    ];

    // Store options for description lookup
    this.currentOptions = options;

    // Add options to dropdown with descriptions as tooltips
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.text;
      option.title = opt.description;
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

    // Update description for current selection
    this.updateDescription();

    // Danger Zone dropdown updated
  }

  updateDescription() {
    if (!this.descriptionDiv || !this.dropdown) return;

    const selectedValue = this.dropdown.value;
    const selectedOption = this.currentOptions.find(opt => opt.value === selectedValue);

    if (selectedOption) {
      this.descriptionDiv.textContent = selectedOption.description;
    } else {
      this.descriptionDiv.textContent = 'Select an option to see what will be deleted.';
    }
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