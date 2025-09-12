// Chain Configuration Utilities
// Provides standardized access to chain-specific configuration across all scanners

/**
 * Get the current chain configuration with fallbacks
 * @returns {Object} Current chain configuration
 */
export function getCurrentChainConfig() {
  try {
    if (window.chainManager && typeof window.chainManager.getCurrentConfig === 'function') {
      const config = window.chainManager.getCurrentConfig();
      if (config) return config;
    }
  } catch (error) {
    console.debug('Chain manager not ready, using fallback config');
  }
  
  // Fallback to Ethereum configuration
  return {
    id: 1,
    name: 'Ethereum',
    shortName: 'ETH',
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
      addressUrl: 'https://etherscan.io/address/'
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
      XEN_GENESIS_TIMESTAMP: 1665250163,
      XEN_DEPLOYMENT_BLOCK: 15704871,
      BASE_AMP: 3000
    },
    databases: {
      COINTOOL_DB: 'ETH_DB_Cointool',
      XENFT_DB: 'ETH_DB_Xenft',
      XEN_STAKE_DB: 'ETH_DB_XenStake',
      XENFT_STAKE_DB: 'ETH_DB_XenftStake'
    }
  };
}

/**
 * Get current chain name
 * @returns {string} Chain name (e.g., 'Ethereum', 'Base')
 */
export function getCurrentChainName() {
  try {
    return window.chainManager?.getCurrentChain() || 'ETHEREUM';
  } catch {
    return 'ETHEREUM';
  }
}

/**
 * Get contract address by name for current chain
 * @param {string} contractName - Contract name (XEN_CRYPTO, COINTOOL, etc.)
 * @returns {string} Contract address
 */
export function getContractAddress(contractName) {
  const config = getCurrentChainConfig();
  const address = config.contracts[contractName];
  
  if (!address) {
    console.warn(`Contract address for ${contractName} not found in chain config`);
    return null;
  }
  
  return address;
}

/**
 * Get chain-specific database name
 * @param {string} dbType - Database type (cointool, xenft, xen_stake, xenft_stake)
 * @returns {string} Database name
 */
export function getDatabaseName(dbType) {
  try {
    if (window.chainManager && typeof window.chainManager.getDatabaseName === 'function') {
      return window.chainManager.getDatabaseName(dbType);
    }
  } catch (error) {
    console.debug('Using fallback database name');
  }
  
  // Fallback logic
  const currentChain = getCurrentChainName();
  const chainPrefix = currentChain === 'BASE' ? 'BASE' : 'ETH';
  
  const dbMap = {
    'cointool': `${chainPrefix}_DB_Cointool`,
    'xenft': `${chainPrefix}_DB_Xenft`, 
    'xen_stake': `${chainPrefix}_DB_XenStake`,
    'xenft_stake': `${chainPrefix}_DB_XenftStake`
  };
  
  return dbMap[dbType.toLowerCase()] || `${chainPrefix}_DB_${dbType}`;
}

/**
 * Get RPC endpoints for current chain
 * @returns {string[]} Array of RPC endpoints
 */
export function getRPCEndpoints() {
  try {
    if (window.chainManager && typeof window.chainManager.getRPCEndpoints === 'function') {
      return window.chainManager.getRPCEndpoints();
    }
  } catch (error) {
    console.debug('Using fallback RPC endpoints');
  }
  
  // Fallback: check DOM or use defaults
  const customRPC = document.getElementById('customRPC')?.value?.trim();
  if (customRPC) {
    return customRPC.split('\n').map(s => s.trim()).filter(Boolean);
  }
  
  const config = getCurrentChainConfig();
  return [config.rpcUrls.default, ...config.rpcUrls.fallback];
}

/**
 * Get Etherscan API URL for current chain
 * @param {string} module - API module (e.g., 'account', 'logs')
 * @param {string} action - API action (e.g., 'txlist', 'getLogs')
 * @param {Object} params - Additional parameters
 * @returns {string} Complete API URL
 */
export function getEtherscanApiUrl(module, action, params = {}) {
  const config = getCurrentChainConfig();
  const chainId = config.id;
  
  // Use Etherscan V2 multichain API for all chains
  const baseUrl = 'https://api.etherscan.io/v2/api';
  const urlParams = new URLSearchParams({
    chainid: chainId.toString(),
    module,
    action,
    ...params
  });
  
  return `${baseUrl}?${urlParams.toString()}`;
}

/**
 * Get explorer transaction URL
 * @param {string} txHash - Transaction hash
 * @returns {string} Explorer URL for transaction
 */
export function getExplorerTxUrl(txHash) {
  const config = getCurrentChainConfig();
  return `${config.explorer.txUrl}${txHash}`;
}

/**
 * Get explorer address URL
 * @param {string} address - Address
 * @returns {string} Explorer URL for address
 */
export function getExplorerAddressUrl(address) {
  const config = getCurrentChainConfig();
  return `${config.explorer.addressUrl}${address}`;
}

/**
 * Get event topic/selector by name
 * @param {string} eventName - Event name (COINTOOL_MINT_TOPIC, REMINT_SELECTOR, etc.)
 * @returns {string} Event topic/selector
 */
export function getEventTopic(eventName) {
  const config = getCurrentChainConfig();
  return config.events[eventName] || null;
}

/**
 * Get chain constant by name
 * @param {string} constantName - Constant name
 * @returns {any} Constant value
 */
export function getChainConstant(constantName) {
  const config = getCurrentChainConfig();
  return config.constants[constantName];
}

/**
 * Get chain-specific creation block for contracts
 * @param {string} contractName - Contract name (optional, defaults to XEN deployment)
 * @returns {number} Block number
 */
export function getCreationBlock(contractName = 'XEN_CRYPTO') {
  const config = getCurrentChainConfig();
  
  // Use chain-specific deployment blocks
  if (contractName === 'XEN_CRYPTO') {
    return config.constants.XEN_DEPLOYMENT_BLOCK || 0;
  }
  
  // For other contracts, use XEN deployment as a safe starting point
  return config.constants.XEN_DEPLOYMENT_BLOCK || 0;
}

/**
 * Check if current chain is Base
 * @returns {boolean} True if current chain is Base
 */
export function isBaseChain() {
  return getCurrentChainName() === 'BASE';
}

/**
 * Check if current chain is Ethereum
 * @returns {boolean} True if current chain is Ethereum
 */
export function isEthereumChain() {
  return getCurrentChainName() === 'ETHEREUM';
}

/**
 * Get user settings from DOM/localStorage in standardized way
 * @returns {Object} User settings
 */
export function getUserSettings() {
  return {
    addresses: getAddressesFromSettings(),
    etherscanApiKey: getEtherscanApiKey(),
    customRPCs: getRPCEndpoints(),
    forceRescan: getForceRescanSetting(),
    chunkSize: getChunkSize(),
    cointoolBatchSize: getCointoolBatchSize(),
    cointoolBatchDelay: getCointoolBatchDelay()
  };
}

/**
 * Get addresses from settings
 * @returns {string[]} Array of addresses
 */
export function getAddressesFromSettings() {
  const addressInput = document.getElementById('ethAddress')?.value?.trim() || 
                      localStorage.getItem('ethAddress') || '';
  return addressInput.split('\n').map(s => s.trim()).filter(Boolean);
}

/**
 * Get Etherscan API key from settings
 * @returns {string} API key
 */
export function getEtherscanApiKey() {
  return document.getElementById('etherscanApiKey')?.value?.trim() || '';
}

/**
 * Get force rescan setting
 * @returns {boolean} Force rescan enabled
 */
export function getForceRescanSetting() {
  return document.getElementById('forceRescan')?.checked || false;
}

/**
 * Get chunk size setting
 * @returns {number} Chunk size
 */
export function getChunkSize() {
  const chunkSize = parseInt(localStorage.getItem('chunkSize')) || 
                   parseInt(document.getElementById('chunkSize')?.value) || 
                   50000;
  return Math.max(10000, Math.min(chunkSize, 500000));
}

/**
 * Get Cointool batch size setting
 * @returns {number} Batch size
 */
export function getCointoolBatchSize() {
  return parseInt(localStorage.getItem('cointoolBatchSize')) || 15;
}

/**
 * Get Cointool batch delay setting
 * @returns {number} Batch delay in milliseconds
 */
export function getCointoolBatchDelay() {
  return parseInt(localStorage.getItem('cointoolBatchDelay')) || 50;
}

/**
 * Validate user settings and show appropriate errors
 * @returns {Object} Validation result with {valid: boolean, errors: string[]}
 */
export function validateUserSettings() {
  const errors = [];
  const settings = getUserSettings();
  
  if (!settings.addresses.length) {
    errors.push('At least one address is required');
  }
  
  if (!settings.etherscanApiKey) {
    errors.push('Etherscan API key is required');
  }
  
  if (!settings.customRPCs.length) {
    errors.push('At least one RPC endpoint is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Make utilities available globally for non-module scripts
if (typeof window !== 'undefined') {
  window.chainConfigUtils = {
    getCurrentChainConfig,
    getCurrentChainName,
    getContractAddress,
    getDatabaseName,
    getRPCEndpoints,
    getEtherscanApiUrl,
    getExplorerTxUrl,
    getExplorerAddressUrl,
    getEventTopic,
    getChainConstant,
    getCreationBlock,
    isBaseChain,
    isEthereumChain,
    getUserSettings,
    getAddressesFromSettings,
    getEtherscanApiKey,
    getForceRescanSetting,
    getChunkSize,
    getCointoolBatchSize,
    getCointoolBatchDelay,
    validateUserSettings
  };
}