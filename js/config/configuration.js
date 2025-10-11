// Global configuration - centralized contract addresses, API endpoints, and constants
// This file contains all configuration values used across the application

import { chainManager, getCurrentChainConfig } from './chainConfig.js';

// Dynamic config that delegates to chain-specific settings
export const config = new Proxy({}, {
  get(target, prop) {
    // Get current chain config
    const chainConfig = getCurrentChainConfig();
    
    // Map old config structure to new chain config
    switch(prop) {
      case 'contracts':
        return chainConfig.contracts;
      case 'rpc':
        return {
          DEFAULT_RPC: chainConfig.rpcUrls.default,
          FALLBACK_RPCS: chainConfig.rpcUrls.fallback,
          CHAINLIST_URL: 'https://chainid.network/chains.json'
        };
      case 'apis':
        return {
          etherscan: {
            BASE_URL: chainConfig.explorer.apiUrl,
            TRANSACTION_URL: chainConfig.explorer.txUrl
          },
          coingecko: {
            XEN_PRICE_URL: `https://api.coingecko.com/api/v3/simple/price?ids=${chainConfig.coingecko.xenId}&vs_currencies=usd`
          }
        };
      case 'events':
        return chainConfig.events;
      case 'constants':
        return chainConfig.constants;
      case 'analytics':
        return {
          GOOGLE_ANALYTICS_ID: 'G-333LEVEH6W',
          GTAG_URL: 'https://www.googletagmanager.com/gtag/js'
        };
      case 'network':
        return {
          ETHEREUM_CHAIN_ID: chainConfig.id,
          ETHERSCAN_MAX_RESULTS: 10000,
          ETHERSCAN_RATE_LIMIT_DELAY: 200,
          MAX_RPC_RETRIES: 5,
          RPC_RETRY_DELAY: 1000,
          MAX_BLOCK_RANGE: 10000,
          SAFE_BLOCK_RANGE: 2000
        };
      case 'databases':
        return {
          COINTOOL_DB_NAME: chainConfig.databases.COINTOOL_DB,
          XENFT_DB_NAME: chainConfig.databases.XENFT_DB,
          XEN_STAKE_DB_NAME: chainConfig.databases.XEN_STAKE_DB,
          XENFT_STAKE_DB_NAME: chainConfig.databases.XENFT_STAKE_DB,
          STORES: {
            MINTS: 'mints',
            SCAN_STATE: 'scanState',
            ACTIONS_CACHE: 'actionsCache'
          }
        };
      default:
        return target[prop];
    }
  }
});

// Legacy static config for backwards compatibility
export const staticConfig = {
  // === CONTRACT ADDRESSES ===
  contracts: {
    // Main XEN contract (canonical Ethereum address)
    XEN_ETH: '0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8',

    // Cointool contract addresses (Ethereum-only legacy config)
    // CANONICAL: Use COINTOOL_MAIN for all current operations
    COINTOOL_MAIN: '0x0dE8bf93dA2f7eecb3d9169422413A9bef4ef628', // Current production contract
    COINTOOL_LEGACY: '0x0de8bf93da2f7eecb3d9169422413a9bef4ef628', // Same as MAIN (case difference only) - DEPRECATED
    COINTOOL_SCANNER: '0x2Ab31426d94496B4C80C60A0e2E4E9B70EB32f18', // OLD contract for historical scans only
    
    // XENFT contracts
    XENFT_TORRENT: '0x0a252663DBCc0b073063D6420a40319e438Cfa59',
    XENFT_STAKE: '0xfEdA03b91514D31b435d4E1519Fd9e699C29BbFC',
    
    // Helper contracts
    REMINT_HELPER: '0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98',
    
    // Special addresses
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000'
  },

  // === RPC ENDPOINTS ===
  rpc: {
    // Primary default RPC
    DEFAULT_RPC: 'https://ethereum-rpc.publicnode.com',
    
    // Fallback RPC endpoints
    FALLBACK_RPCS: [
      'https://cloudflare-eth.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com'
    ],
    
    // Chain data source
    CHAINLIST_URL: 'https://chainid.network/chains.json'
  },

  // === API ENDPOINTS ===
  apis: {
    etherscan: {
      BASE_URL: 'https://api.etherscan.io/api',
      TRANSACTION_URL: 'https://etherscan.io/tx/'
    },
    
    // External services
    coingecko: {
      XEN_PRICE_URL: 'https://api.coingecko.com/api/v3/simple/price?ids=xen-crypto&vs_currencies=usd'
    }
  },

  // === EVENT TOPICS AND SELECTORS ===
  events: {
    // Cointool mint event topics
    // NOTE: Two different topics because Cointool has TWO different contracts with different event signatures
    COINTOOL_MINT_TOPIC: '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37', // Current contract (COINTOOL_MAIN)
    COINTOOL_MINT_TOPIC_SCANNER: '0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885', // Old contract (COINTOOL_SCANNER) for historical data
    
    // XEN staking events
    XEN_STAKE_TOPIC: '0x...', // TODO: Add from xen_scanner.js
    XEN_WITHDRAW_TOPIC: '0x...', // TODO: Add from xen_scanner.js
    
    // Method selectors
    REMINT_SELECTOR: '0xc2580804',
    CLAIM_MINT_REWARD_SELECTOR: '0xa2309ff8',
    CLAIM_AND_STAKE_SELECTOR: '0xf2f4eb26'
  },

  // === CONSTANTS ===
  constants: {
    // Cointool specific
    SALT_BYTES_TO_QUERY: '0x01',
    COINTOOL_SALT_BYTES: '0x29A2241A010000000000',

    // XEN calculation constants - DO NOT USE THESE, use chainManager.getCurrentConfig().constants instead
    // These values are WRONG and chain-specific. Kept only for backwards compatibility.
    // DEPRECATED: XEN_GENESIS_TIMESTAMP: 1665187200, // WRONG - use chainManager
    // DEPRECATED: XEN_GENESIS_DATE_MS: Date.UTC(2022, 9, 8, 0, 0, 0, 0), // WRONG - use chainManager
    // DEPRECATED: BASE_AMP: 3000, // WRONG - use chainManager

    // Database versions
    DB_VERSION_COINTOOL: 3,
    DB_VERSION_XENFT: 1,
    DB_VERSION_STAKE: 1,

    // UI constants
    PROGRESS_UPDATE_INTERVAL: 500, // ms
    DEFAULT_SCAN_TIMEOUT: 120000 // 2 minutes
  },

  // === PROXY CONTRACT CREATION CODE ===
  bytecode: {
    // Cointool proxy creation code (Ethereum-specific, universal bytecode)
    // This bytecode is chain-agnostic and works on both Ethereum and Base
    // Used for detecting Cointool proxy contract deployments
    // TODO: Verify this works on Base network (likely does, as EVM is compatible)
    COINTOOL_PROXY_CREATION_CODE: '60806040523480156200001157600080fd5b5060405162000b5f38038062000b5f8339818101604052810190620000379190620001a3565b81600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600281905550620000936200009960201b60201c565b50620002ac565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663313ce5676040518163ffffffff1660e01b8152600401602060405180830381865afa15801562000108573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906200012e919062000214565b600060146101000a81548160ff021916908360ff1602179055565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006200017c8262000151565b9050919050565b6200018e816200016f565b81146200019a57600080fd5b50565b600081519050620001ae8162000183565b92915050565b6000819050919050565b620001c981620001b4565b8114620001d557600080fd5b50565b600081519050620001e981620001be565b92915050565b6000604082840312156200020857620002076200014c565b5b81019150620002188262000199565b92915050620002298262000209565b92915050620002388262000209565b92915050620002478262000209565b92915050620002568262000209565b92915050620002658262000209565b92915050620002748262000209565b92915050620002838262000209565b92915050620002928262000209565b92915050620002a18262000209565b92915050620002b08262000209565b92915050'
  },

  // === ANALYTICS ===
  analytics: {
    GOOGLE_ANALYTICS_ID: 'G-333LEVEH6W',
    GTAG_URL: 'https://www.googletagmanager.com/gtag/js'
  },

  // === NETWORK CONFIGURATION ===
  network: {
    ETHEREUM_CHAIN_ID: 1,
    
    // Etherscan API limits
    ETHERSCAN_MAX_RESULTS: 10000,
    ETHERSCAN_RATE_LIMIT_DELAY: 200, // ms between requests
    
    // RPC retry configuration
    MAX_RPC_RETRIES: 5,
    RPC_RETRY_DELAY: 1000, // ms
    
    // Block scanning configuration
    MAX_BLOCK_RANGE: 10000,
    SAFE_BLOCK_RANGE: 2000
  },

  // === DATABASE CONFIGURATION ===
  databases: {
    COINTOOL_DB_NAME: 'DB_Cointool',
    XENFT_DB_NAME: 'DB_Xenft', 
    XEN_STAKE_DB_NAME: 'DB_XenStake',
    XENFT_STAKE_DB_NAME: 'DB_XenftStake',
    
    // Object store names
    STORES: {
      MINTS: 'mints',
      SCAN_STATE: 'scanState', 
      ACTIONS_CACHE: 'actionsCache'
    }
  }
};

// === UTILITY FUNCTIONS ===

// Get current AMP value based on days since genesis
export function getCurrentAMP() {
  return chainManager.getCurrentAMP();
}

// Get days since XEN genesis
export function getDaysSinceGenesis() {
  return chainManager.getDaysSinceGenesis();
}

// Build Explorer API URL (Etherscan/BaseScan/etc)
export function buildEtherscanUrl(module, action, params = {}) {
  const chainConfig = getCurrentChainConfig();
  const baseUrl = chainConfig.explorer.apiUrl;
  const urlParams = new URLSearchParams({
    module,
    action,
    ...params
  });
  return `${baseUrl}?${urlParams.toString()}`;
}

// Build Explorer transaction URL
export function buildTransactionUrl(txHash) {
  return chainManager.getExplorerUrl('tx', txHash);
}

// Get contract address by name (with fallback)
export function getContractAddress(name, fallback = null) {
  const address = config.contracts[name];
  if (!address && fallback) {
    console.warn(`Contract address for ${name} not found, using fallback: ${fallback}`);
    return fallback;
  }
  return address;
}

// Get RPC endpoint list for current chain
export function getRPCEndpoints() {
  return chainManager.getRPCEndpoints();
}

// Expose config globally for non-module scripts
window.appConfig = config;

// Legacy compatibility - DEPRECATED globals with warnings
// These always use Ethereum values and will break on Base network
// Use window.chainManager or window.appConfig instead
let _deprecationWarningsShown = new Set();

function createDeprecatedGlobal(name, value, replacement) {
  let _value = value;
  Object.defineProperty(window, name, {
    get() {
      if (!_deprecationWarningsShown.has(name)) {
        console.warn(
          `[DEPRECATED] window.${name} is deprecated and uses Ethereum values only.\n` +
          `Use ${replacement} instead for multi-chain support.`
        );
        _deprecationWarningsShown.add(name);
      }
      return _value;
    },
    set(newValue) {
      _value = newValue;
    }
  });
}

createDeprecatedGlobal('DEFAULT_RPC', config.rpc.DEFAULT_RPC, 'window.chainManager.getCurrentConfig().rpcUrls.default');
createDeprecatedGlobal('CONTRACT_ADDRESS', config.contracts.COINTOOL_MAIN, 'window.chainManager.getContractAddress("COINTOOL")');
createDeprecatedGlobal('EVENT_TOPIC', config.events.COINTOOL_MINT_TOPIC, 'window.chainManager.getCurrentConfig().events.COINTOOL_MINT_TOPIC');
createDeprecatedGlobal('SALT_BYTES_TO_QUERY', config.constants.SALT_BYTES_TO_QUERY, 'window.chainManager.getCurrentConfig().constants.SALT_BYTES_TO_QUERY');
createDeprecatedGlobal('REMINT_SELECTOR', config.events.REMINT_SELECTOR, 'window.chainManager.getCurrentConfig().events.REMINT_SELECTOR');
createDeprecatedGlobal('XEN_CRYPTO_ADDRESS', config.contracts.XEN_ETH, 'window.chainManager.getContractAddress("XEN_CRYPTO")');

export default config;