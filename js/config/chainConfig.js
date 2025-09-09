// Multi-chain configuration system
// Each chain has its own contract addresses, RPCs, and explorer URLs

export const SUPPORTED_CHAINS = {
  ETHEREUM: {
    id: 1,
    name: 'Ethereum',
    shortName: 'ETH',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: {
      default: 'https://ethereum-rpc.publicnode.com',
      fallback: [
        'https://cloudflare-eth.com',
        'https://rpc.ankr.com/eth',
        'https://ethereum.publicnode.com'
      ]
    },
    explorer: {
      name: 'Etherscan',
      baseUrl: 'https://etherscan.io',
      apiUrl: 'https://api.etherscan.io/api',
      txUrl: 'https://etherscan.io/tx/',
      addressUrl: 'https://etherscan.io/address/',
      blockUrl: 'https://etherscan.io/block/'
    },
    contracts: {
      XEN_CRYPTO: '0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8',
      COINTOOL: '0x0dE8bf93dA2f7eecb3d9169422413A9bef4ef628',
      XENFT_TORRENT: '0x0a252663DBCc0b073063D6420a40319e438Cfa59',
      XENFT_STAKE: '0xfEdA03b91514D31b435d4E1519Fd9e699C29BbFC',
      REMINT_HELPER: '0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98'
    },
    events: {
      COINTOOL_MINT_TOPIC: '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37',
      REMINT_SELECTOR: '0xc2580804',
      CLAIM_MINT_REWARD_SELECTOR: '0xa2309ff8',
      CLAIM_AND_STAKE_SELECTOR: '0xf2f4eb26'
    },
    constants: {
      SALT_BYTES_TO_QUERY: '0x01',
      COINTOOL_SALT_BYTES: '0x29A2241A010000000000',
      XEN_GENESIS_TIMESTAMP: 1665187200,
      XEN_GENESIS_DATE_MS: Date.UTC(2022, 9, 8, 0, 0, 0, 0),
      BASE_AMP: 3000
    },
    databases: {
      COINTOOL_DB: 'ETH_DB_Cointool',
      XENFT_DB: 'ETH_DB_Xenft',
      XEN_STAKE_DB: 'ETH_DB_XenStake',
      XENFT_STAKE_DB: 'ETH_DB_XenftStake'
    },
    dbVersions: {
      COINTOOL: 3,
      XENFT: 1,
      STAKE: 1
    },
    coingecko: {
      xenId: 'xen-crypto'
    }
  },
  
  BASE: {
    id: 8453,
    name: 'Base',
    shortName: 'BASE',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: {
      default: 'https://base-rpc.publicnode.com',
      fallback: [
        'https://mainnet.base.org',
        'https://base.gateway.tenderly.co',
        'https://rpc.ankr.com/base',
        'https://base.blockpi.network/v1/rpc/public'
      ]
    },
    explorer: {
      name: 'BaseScan',
      baseUrl: 'https://basescan.org',
      apiUrl: 'https://api.basescan.org/api',
      txUrl: 'https://basescan.org/tx/',
      addressUrl: 'https://basescan.org/address/',
      blockUrl: 'https://basescan.org/block/'
    },
    contracts: {
      // Base contract addresses
      XEN_CRYPTO: '0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5',
      COINTOOL: '0x9Ec1C3DcF667f2035FB4CD2eB42A1566fd54d2B7',
      XENFT_TORRENT: '0x379002701BF6f2862e3dFdd1f96d3C5E1BF450B6',
      XENFT_STAKE: '0xfC0eC2f733Cf35863178fa0DF759c6CE8C38ee7b',
      REMINT_HELPER: '0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98' // Same as Ethereum (may need verification)
    },
    events: {
      // Base uses same event signatures as Ethereum
      COINTOOL_MINT_TOPIC: '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37',
      REMINT_SELECTOR: '0xc2580804',
      CLAIM_MINT_REWARD_SELECTOR: '0xa2309ff8',
      CLAIM_AND_STAKE_SELECTOR: '0xf2f4eb26'
    },
    constants: {
      SALT_BYTES_TO_QUERY: '0x01',
      COINTOOL_SALT_BYTES: '0x29A2241A010000000000',
      XEN_GENESIS_TIMESTAMP: 1691020800, // Base XEN launch timestamp (needs verification)
      XEN_GENESIS_DATE_MS: Date.UTC(2023, 7, 3, 0, 0, 0, 0), // Base XEN launch date (needs verification)
      BASE_AMP: 3000
    },
    databases: {
      COINTOOL_DB: 'BASE_DB_Cointool',
      XENFT_DB: 'BASE_DB_Xenft',
      XEN_STAKE_DB: 'BASE_DB_XenStake',
      XENFT_STAKE_DB: 'BASE_DB_XenftStake'
    },
    dbVersions: {
      COINTOOL: 1,
      XENFT: 1,
      STAKE: 1
    },
    coingecko: {
      xenId: 'xen-crypto' // Same ID for XEN across chains
    }
  }
};

// Default chain (can be overridden by user preference)
export const DEFAULT_CHAIN = 'ETHEREUM';

// Chain state manager
class ChainManager {
  constructor() {
    this.currentChain = null;
    this.listeners = new Set();
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    
    // Load saved chain preference or use default
    const savedChain = localStorage.getItem('selectedChain') || DEFAULT_CHAIN;
    this.setChain(savedChain, false); // Don't trigger listeners on init
    this.initialized = true;
    
    // Update brand suffix on initialization
    const config = this.getCurrentConfig();
    const brandSuffixElement = document.querySelector('.brand-suffix-text');
    if (brandSuffixElement && config) {
      brandSuffixElement.textContent = config.name;
    }
  }

  getCurrentChain() {
    if (!this.currentChain) {
      this.initialize();
    }
    return this.currentChain;
  }

  getCurrentConfig() {
    const chainKey = this.getCurrentChain();
    return SUPPORTED_CHAINS[chainKey];
  }

  setChain(chainKey, triggerListeners = true) {
    if (!SUPPORTED_CHAINS[chainKey]) {
      console.error(`Invalid chain: ${chainKey}`);
      return false;
    }

    const previousChain = this.currentChain;
    this.currentChain = chainKey;
    
    // Save to localStorage
    localStorage.setItem('selectedChain', chainKey);
    
    // Trigger listeners if chain actually changed
    if (triggerListeners && previousChain !== chainKey) {
      this.notifyListeners(previousChain, chainKey);
    }
    
    return true;
  }

  onChainChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(previousChain, newChain) {
    const config = SUPPORTED_CHAINS[newChain];
    this.listeners.forEach(callback => {
      try {
        callback(newChain, config, previousChain);
      } catch (error) {
        console.error('Error in chain change listener:', error);
      }
    });
  }

  getChainList() {
    return Object.entries(SUPPORTED_CHAINS).map(([key, config]) => ({
      key,
      id: config.id,
      name: config.name,
      shortName: config.shortName
    }));
  }

  getChainById(chainId) {
    return Object.entries(SUPPORTED_CHAINS).find(([_, config]) => 
      config.id === chainId
    )?.[0] || null;
  }

  // Get chain-specific storage key
  getStorageKey(baseKey) {
    const chain = this.getCurrentChain();
    return `${chain}_${baseKey}`;
  }

  // Get chain-specific database name
  getDatabaseName(dbType) {
    const config = this.getCurrentConfig();
    const dbMap = {
      'cointool': config.databases.COINTOOL_DB,
      'xenft': config.databases.XENFT_DB,
      'xen_stake': config.databases.XEN_STAKE_DB,
      'xenft_stake': config.databases.XENFT_STAKE_DB
    };
    return dbMap[dbType.toLowerCase()] || null;
  }

  // Get chain-specific RPC endpoints
  getRPCEndpoints() {
    const config = this.getCurrentConfig();
    const chain = this.getCurrentChain();
    
    // Check for user-configured RPCs for this chain
    const customRPCKey = `${chain}_customRPC`;
    const customRPCs = localStorage.getItem(customRPCKey);
    
    if (customRPCs) {
      const rpcList = customRPCs.split('\n').map(s => s.trim()).filter(Boolean);
      if (rpcList.length > 0) {
        return rpcList;
      }
    }
    
    // Return default RPCs for all chains if no custom RPCs are configured
    return [config.rpcUrls.default, ...config.rpcUrls.fallback];
  }

  // Save chain-specific RPC endpoints
  saveRPCEndpoints(rpcList) {
    const chain = this.getCurrentChain();
    const customRPCKey = `${chain}_customRPC`;
    
    if (rpcList && rpcList.length > 0) {
      const rpcString = rpcList.join('\n');
      localStorage.setItem(customRPCKey, rpcString);
    } else {
      localStorage.removeItem(customRPCKey);
    }
  }

  // Get chain-specific contract address
  getContractAddress(contractName) {
    const config = this.getCurrentConfig();
    return config.contracts[contractName] || null;
  }

  // Get chain-specific explorer URL
  getExplorerUrl(type, value) {
    const config = this.getCurrentConfig();
    const explorer = config.explorer;
    
    switch(type) {
      case 'tx':
        return `${explorer.txUrl}${value}`;
      case 'address':
        return `${explorer.addressUrl}${value}`;
      case 'block':
        return `${explorer.blockUrl}${value}`;
      default:
        return `${explorer.baseUrl}`;
    }
  }

  // Calculate chain-specific XEN values
  getCurrentAMP() {
    const config = this.getCurrentConfig();
    const daysSinceGenesis = Math.floor(
      (Date.now() - config.constants.XEN_GENESIS_DATE_MS) / 86_400_000
    );
    const amp = config.constants.BASE_AMP - daysSinceGenesis;
    return amp > 0 ? amp : 0;
  }

  getDaysSinceGenesis() {
    const config = this.getCurrentConfig();
    return Math.floor(
      (Date.now() - config.constants.XEN_GENESIS_DATE_MS) / 86_400_000
    );
  }
}

// Create singleton instance
export const chainManager = new ChainManager();

// Export utility functions that use chainManager
export function getCurrentChainConfig() {
  return chainManager.getCurrentConfig();
}

export function switchChain(chainKey) {
  return chainManager.setChain(chainKey);
}

export function onChainChange(callback) {
  return chainManager.onChainChange(callback);
}

export function getChainSpecificKey(baseKey) {
  return chainManager.getStorageKey(baseKey);
}

// Initialize on module load
chainManager.initialize();

// Make chainManager available globally for non-module scripts
window.chainManager = chainManager;
window.SUPPORTED_CHAINS = SUPPORTED_CHAINS;

export default chainManager;