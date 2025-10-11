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
      XEN_GENESIS_TIMESTAMP: 1665250163,
      XEN_GENESIS_DATE_MS: Date.UTC(2022, 9, 8, 0, 0, 0, 0),
      XEN_DEPLOYMENT_BLOCK: 15704871, // XEN deployed at this block on Ethereum
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
        'https://base.blockpi.network/v1/rpc/public',
        'https://1rpc.io/base',
        'https://base.meowrpc.com'
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
      REMINT_HELPER: '0xc82ba627ba29fc4da2d3343e2f0a2d40119c2885' // Base-specific helper (1130 bytes, verified)
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
      XEN_GENESIS_TIMESTAMP: 1692986123, // Base XEN launch timestamp (Aug-25-2023 04:13:53 PM UTC)
      XEN_GENESIS_DATE_MS: Date.UTC(2023, 7, 25, 16, 13, 53, 0), // Base XEN launch date (month is 0-indexed)
      XEN_DEPLOYMENT_BLOCK: 3098388, // XEN deployed at this block on Base
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
  },

  AVALANCHE: {
    id: 43114,
    name: 'Avalanche',
    shortName: 'AVAX',
    nativeCurrency: {
      name: 'Avalanche',
      symbol: 'AVAX',
      decimals: 18
    },
    rpcUrls: {
      default: 'https://api.avax.network/ext/bc/C/rpc',
      fallback: [
        'https://avalanche-c-chain.publicnode.com',
        'https://rpc.ankr.com/avalanche',
        'https://avalanche.public-rpc.com',
        'https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc',
        'https://avalanche.drpc.org'
      ]
    },
    explorer: {
      name: 'SnowTrace',
      baseUrl: 'https://snowtrace.io',
      apiUrl: 'https://api.snowtrace.io/api',
      txUrl: 'https://snowtrace.io/tx/',
      addressUrl: 'https://snowtrace.io/address/',
      blockUrl: 'https://snowtrace.io/block/'
    },
    contracts: {
      XEN_CRYPTO: '0xC0C5AA69Dbe4d6DDdfBc89c0957686ec60F24389',
      COINTOOL: '0x9Ec1C3DcF667f2035FB4CD2eB42A1566fd54d2B7',
      XENFT_TORRENT: '0x94d9E02D115646DFC407ABDE75Fa45256D66E043',
      XENFT_STAKE: '0x1Ac17FFB8456525BfF46870bba7Ed8772ba063a5',
      REMINT_HELPER: '0xd8fb02f08f940d9d87ae1ab81d78ac6ef134ca2e' // Avalanche-specific helper (1130 bytes, verified)
    },
    events: {
      // Avalanche uses same event signatures as Ethereum
      COINTOOL_MINT_TOPIC: '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37',
      REMINT_SELECTOR: '0xc2580804',
      CLAIM_MINT_REWARD_SELECTOR: '0xa2309ff8',
      CLAIM_AND_STAKE_SELECTOR: '0xf2f4eb26'
    },
    constants: {
      SALT_BYTES_TO_QUERY: '0x01',
      COINTOOL_SALT_BYTES: '0x29A2241A010000000000',
      XEN_GENESIS_TIMESTAMP: 1665700430, // Avalanche XEN launch timestamp (Oct 13, 2022)
      XEN_GENESIS_DATE_MS: 1665700430000, // Avalanche XEN launch date in milliseconds (Oct 13, 2022)
      XEN_DEPLOYMENT_BLOCK: 27265450, // XEN deployed at this block on Avalanche
      BASE_AMP: 3000
    },
    databases: {
      COINTOOL_DB: 'AVAX_DB_Cointool',
      XENFT_DB: 'AVAX_DB_Xenft',
      XEN_STAKE_DB: 'AVAX_DB_XenStake',
      XENFT_STAKE_DB: 'AVAX_DB_XenftStake'
    },
    dbVersions: {
      COINTOOL: 1,
      XENFT: 1,
      STAKE: 1
    },
    coingecko: {
      xenId: 'xen-crypto' // Same ID for XEN across chains
    }
  },

  BSC: {
    id: 56,
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18
    },
    rpcUrls: {
      default: 'https://bsc-dataseed.binance.org/',
      fallback: [
        'https://bsc-dataseed1.defibit.io/',
        'https://bsc-dataseed1.ninicoin.io/',
        'https://bsc-dataseed2.defibit.io/',
        'https://bsc-dataseed3.bnbchain.org/',
        'https://bsc.publicnode.com'
      ]
    },
    explorer: {
      name: 'BscScan',
      baseUrl: 'https://bscscan.com',
      apiUrl: 'https://api.etherscan.io/api',
      txUrl: 'https://bscscan.com/tx/',
      addressUrl: 'https://bscscan.com/address/',
      blockUrl: 'https://bscscan.com/block/'
    },
    contracts: {
      XEN_CRYPTO: '0x2AB0e9e4eE70FFf1fB9D67031E44F6410170d00e',
      COINTOOL: '0x7ff11e5b256c9EB67F4dEa2FacECEd5De1CD691F',
      XENFT_TORRENT: '0x1Ac17FFB8456525BfF46870bba7Ed8772ba063a5',
      XENFT_STAKE: '0x94d9E02D115646DFC407ABDE75Fa45256D66E043',
      REMINT_HELPER: '0xc3025b2f2ba021bcc6e83b5a3fcf51a6ee300d26' // BSC-specific helper (1130 bytes, verified)
    },
    events: {
      // BSC uses same event signatures as Ethereum
      COINTOOL_MINT_TOPIC: '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37',
      REMINT_SELECTOR: '0xc2580804',
      CLAIM_MINT_REWARD_SELECTOR: '0xa2309ff8',
      CLAIM_AND_STAKE_SELECTOR: '0xf2f4eb26'
    },
    constants: {
      SALT_BYTES_TO_QUERY: '0x01',
      COINTOOL_SALT_BYTES: '0x29A2241A010000000000',
      XEN_GENESIS_TIMESTAMP: 1665527037,
      XEN_GENESIS_DATE_MS: 1665527037000, // Oct 11, 2022
      XEN_DEPLOYMENT_BLOCK: 25361679,
      BASE_AMP: 3000
    },
    databases: {
      COINTOOL_DB: 'BSC_DB_Cointool',
      XENFT_DB: 'BSC_DB_Xenft',
      XEN_STAKE_DB: 'BSC_DB_XenStake',
      XENFT_STAKE_DB: 'BSC_DB_XenftStake'
    },
    dbVersions: {
      COINTOOL: 1,
      XENFT: 1,
      STAKE: 1
    },
    coingecko: {
      xenId: 'xen-crypto' // Same ID for XEN across chains
    }
  },

  MOONBEAM: {
    id: 1284,
    name: 'Moonbeam',
    shortName: 'GLMR',
    nativeCurrency: {
      name: 'Glimmer',
      symbol: 'GLMR',
      decimals: 18
    },
    rpcUrls: {
      default: 'https://rpc.api.moonbeam.network',
      fallback: [
        'https://moonbeam.public.blastapi.io',
        'https://moonbeam-rpc.dwellir.com',
        'https://rpc.ankr.com/moonbeam',
        'https://1rpc.io/glmr',
        'https://moonbeam.drpc.org'
      ]
    },
    explorer: {
      name: 'Moonscan',
      baseUrl: 'https://moonscan.io',
      apiUrl: 'https://api.etherscan.io/api',
      txUrl: 'https://moonscan.io/tx/',
      addressUrl: 'https://moonscan.io/address/',
      blockUrl: 'https://moonscan.io/block/'
    },
    contracts: {
      XEN_CRYPTO: '0xb564A5767A00Ee9075cAC561c427643286F8F4E1',
      COINTOOL: '0x9Ec1C3DcF667f2035FB4CD2eB42A1566fd54d2B7',
      XENFT_TORRENT: '0x94d9E02D115646DFC407ABDE75Fa45256D66E043',
      XENFT_STAKE: '0x1Ac17FFB8456525BfF46870bba7Ed8772ba063a5',
      REMINT_HELPER: '0xcd40c4f617959338e47f453a666392bf10af5bc0' // Moonbeam-specific helper (1130 bytes, verified)
    },
    events: {
      // Moonbeam uses same event signatures as Ethereum
      COINTOOL_MINT_TOPIC: '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37',
      REMINT_SELECTOR: '0xc2580804',
      CLAIM_MINT_REWARD_SELECTOR: '0xa2309ff8',
      CLAIM_AND_STAKE_SELECTOR: '0xf2f4eb26'
    },
    constants: {
      SALT_BYTES_TO_QUERY: '0x01',
      COINTOOL_SALT_BYTES: '0x29A2241A010000000000',
      XEN_GENESIS_TIMESTAMP: 1666118622,
      XEN_GENESIS_DATE_MS: 1666118622000, // Oct 18, 2022
      XEN_DEPLOYMENT_BLOCK: 3203586,
      BASE_AMP: 3000
    },
    databases: {
      COINTOOL_DB: 'GLMR_DB_Cointool',
      XENFT_DB: 'GLMR_DB_Xenft',
      XEN_STAKE_DB: 'GLMR_DB_XenStake',
      XENFT_STAKE_DB: 'GLMR_DB_XenftStake'
    },
    dbVersions: {
      COINTOOL: 1,
      XENFT: 1,
      STAKE: 1
    },
    coingecko: {
      xenId: 'xen-crypto' // Same ID for XEN across chains
    }
  },

  POLYGON: {
    id: 137,
    name: 'Polygon',
    shortName: 'MATIC',
    nativeCurrency: {
      name: 'Matic',
      symbol: 'MATIC',
      decimals: 18
    },
    rpcUrls: {
      default: 'https://polygon-rpc.com',
      fallback: [
        'https://rpc.ankr.com/polygon',
        'https://polygon-mainnet.public.blastapi.io',
        'https://polygon-bor-rpc.publicnode.com',
        'https://1rpc.io/matic',
        'https://polygon.drpc.org'
      ]
    },
    explorer: {
      name: 'PolygonScan',
      baseUrl: 'https://polygonscan.com',
      apiUrl: 'https://api.etherscan.io/api',
      txUrl: 'https://polygonscan.com/tx/',
      addressUrl: 'https://polygonscan.com/address/',
      blockUrl: 'https://polygonscan.com/block/'
    },
    contracts: {
      XEN_CRYPTO: '0x2AB0e9e4eE70FFf1fB9D67031E44F6410170d00e',
      COINTOOL: '0xdf6fEE057222d2F7933C215C11e5150bD2efc53E',
      XENFT_TORRENT: '0x726bB6aC9b74441Eb8FB52163e9014302D4249e5',
      XENFT_STAKE: '0x94d9E02D115646DFC407ABDE75Fa45256D66E043',
      REMINT_HELPER: '0x413aaa75db26c007563ab536f98613e7981daa32' // Polygon-specific helper (1130 bytes, verified)
    },
    events: {
      // Polygon uses same event signatures as Ethereum
      COINTOOL_MINT_TOPIC: '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37',
      REMINT_SELECTOR: '0xc2580804',
      CLAIM_MINT_REWARD_SELECTOR: '0xa2309ff8',
      CLAIM_AND_STAKE_SELECTOR: '0xf2f4eb26'
    },
    constants: {
      SALT_BYTES_TO_QUERY: '0x01',
      COINTOOL_SALT_BYTES: '0x29A2241A010000000000',
      XEN_GENESIS_TIMESTAMP: 1665615710,
      XEN_GENESIS_DATE_MS: 1665615710000, // Oct 12, 2022
      XEN_DEPLOYMENT_BLOCK: 39156314,
      BASE_AMP: 3000
    },
    databases: {
      COINTOOL_DB: 'POL_DB_Cointool',
      XENFT_DB: 'POL_DB_Xenft',
      XEN_STAKE_DB: 'POL_DB_XenStake',
      XENFT_STAKE_DB: 'POL_DB_XenftStake'
    },
    dbVersions: {
      COINTOOL: 1,
      XENFT: 1,
      STAKE: 1
    },
    coingecko: {
      xenId: 'xen-crypto' // Same ID for XEN across chains
    }
  },

  OPTIMISM: {
    id: 10,
    name: 'Optimism',
    shortName: 'OP',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: {
      default: 'https://mainnet.optimism.io',
      fallback: [
        'https://optimism-rpc.publicnode.com',
        'https://rpc.ankr.com/optimism',
        'https://1rpc.io/op',
        'https://optimism.public.blastapi.io',
        'https://optimism.drpc.org'
      ]
    },
    explorer: {
      name: 'Optimistic Etherscan',
      baseUrl: 'https://optimistic.etherscan.io',
      apiUrl: 'https://api.etherscan.io/api',
      txUrl: 'https://optimistic.etherscan.io/tx/',
      addressUrl: 'https://optimistic.etherscan.io/address/',
      blockUrl: 'https://optimistic.etherscan.io/block/'
    },
    contracts: {
      XEN_CRYPTO: '0xeB585163DEbB1E637c6D617de3bEF99347cd75c8',
      COINTOOL: '0x9Ec1C3DcF667f2035FB4CD2eB42A1566fd54d2B7',
      XENFT_TORRENT: '0xAF18644083151cf57F914CCCc23c42A1892C218e',
      XENFT_STAKE: '0x4c4CF206465AbFE5cECb3b581fa1b508Ec514692',
      REMINT_HELPER: '0xcd40c4f617959338e47f453a666392bf10af5bc0' // Optimism-specific helper (1130 bytes, verified, shared with Moonbeam)
    },
    events: {
      // Optimism uses same event signatures as Ethereum
      COINTOOL_MINT_TOPIC: '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37',
      REMINT_SELECTOR: '0xc2580804',
      CLAIM_MINT_REWARD_SELECTOR: '0xa2309ff8',
      CLAIM_AND_STAKE_SELECTOR: '0xf2f4eb26'
    },
    constants: {
      SALT_BYTES_TO_QUERY: '0x01',
      COINTOOL_SALT_BYTES: '0x29A2241A010000000000',
      XEN_GENESIS_TIMESTAMP: 1694825551,
      XEN_GENESIS_DATE_MS: 1694825551000, // Sep 16, 2023
      XEN_DEPLOYMENT_BLOCK: 109613518,
      BASE_AMP: 300
    },
    databases: {
      COINTOOL_DB: 'OPT_DB_Cointool',
      XENFT_DB: 'OPT_DB_Xenft',
      XEN_STAKE_DB: 'OPT_DB_XenStake',
      XENFT_STAKE_DB: 'OPT_DB_XenftStake'
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

    console.log(`[Chain Manager] Switching from ${previousChain} to ${chainKey}`);

    // Save to localStorage
    localStorage.setItem('selectedChain', chainKey);

    // Trigger listeners if chain actually changed
    if (triggerListeners && previousChain !== chainKey) {
      console.log(`[Chain Manager] Notifying ${this.listeners.size} listeners of chain change`);
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
    const customRPCSourceKey = `${chain}_customRPC_source`;
    const lastKnownKey = `${chain}_customRPC_lastKnown`;
    const customRPCs = localStorage.getItem(customRPCKey);
    const sourceChain = localStorage.getItem(customRPCSourceKey);
    const lastKnown = localStorage.getItem(lastKnownKey);

    console.log(`[Chain RPC] Getting RPCs for ${chain}, customRPCKey: ${customRPCKey}, found custom: ${!!customRPCs}, source: ${sourceChain || 'none'}`);

    if (customRPCs && (!sourceChain || sourceChain === chain)) {
      const rpcList = customRPCs.split('\n').map(s => s.trim()).filter(Boolean);
      const joined = rpcList.join('\n');

      if (!sourceChain) {
        // If we have a last-known value and the stored entry differs, prefer the last-known cache
        if (lastKnown && lastKnown !== joined) {
          console.warn(`[Chain RPC] Detected unexpected change to ${chain} RPCs without metadata. Restoring last known value.`);
          const restored = lastKnown.split('\n').map(s => s.trim()).filter(Boolean);
          localStorage.setItem(customRPCKey, lastKnown);
          localStorage.setItem(customRPCSourceKey, chain);
          return restored.length ? restored : [config.rpcUrls.default, ...config.rpcUrls.fallback];
        }

        // Heuristic: if value matches another chain's known list, treat as contamination
        for (const [otherChain] of Object.entries(SUPPORTED_CHAINS)) {
          if (otherChain === chain) continue;
          const otherKnown = localStorage.getItem(`${otherChain}_customRPC_lastKnown`) || localStorage.getItem(`${otherChain}_customRPC`);
          if (otherKnown && otherKnown === joined) {
            console.warn(`[Chain RPC] Detected ${chain} RPCs matching ${otherChain} list without metadata. Restoring ${chain} last known value.`);
            if (lastKnown) {
              const restored = lastKnown.split('\n').map(s => s.trim()).filter(Boolean);
              localStorage.setItem(customRPCKey, lastKnown);
              localStorage.setItem(customRPCSourceKey, chain);
              return restored.length ? restored : [config.rpcUrls.default, ...config.rpcUrls.fallback];
            } else {
              localStorage.removeItem(customRPCKey);
              console.log(`[Chain RPC] No lastKnown for ${chain}; falling back to defaults.`);
              return [config.rpcUrls.default, ...config.rpcUrls.fallback];
            }
          }
        }
      }

      if (rpcList.length > 0) {
        console.log(`[Chain RPC] Using ${rpcList.length} custom RPCs for ${chain}:`, rpcList.slice(0, 3));
        try {
          localStorage.setItem(lastKnownKey, joined);
          if (!sourceChain) {
            localStorage.setItem(customRPCSourceKey, chain);
          }
        } catch (_) {}
        return rpcList;
      }
    } else if (customRPCs && sourceChain && sourceChain !== chain) {
      console.warn(`[Chain RPC] Removing mismatched custom RPC entry for ${customRPCKey} (stored source=${sourceChain})`);
      localStorage.removeItem(customRPCKey);
      localStorage.removeItem(customRPCSourceKey);
      if (lastKnown) {
        console.log(`[Chain RPC] Restoring ${chain} RPCs from lastKnown after mismatch cleanup.`);
        const restored = lastKnown.split('\n').map(s => s.trim()).filter(Boolean);
        if (restored.length) {
          return restored;
        }
      }
    } else if (!customRPCs && lastKnown) {
      console.log(`[Chain RPC] No stored RPCs for ${chain}, using lastKnown cache.`);
      const restored = lastKnown.split('\n').map(s => s.trim()).filter(Boolean);
      if (restored.length) {
        return restored;
      }
    }

    // Return default RPCs for all chains if no custom RPCs are configured
    const defaultRPCs = [config.rpcUrls.default, ...config.rpcUrls.fallback];
    console.log(`[Chain RPC] Using ${defaultRPCs.length} default RPCs for ${chain}:`, defaultRPCs.slice(0, 3));
    return defaultRPCs;
  }

  // Save chain-specific RPC endpoints
  saveRPCEndpoints(rpcList, forceChain = null) {
    const chain = forceChain || this.getCurrentChain();
    const customRPCKey = `${chain}_customRPC`;
    const customRPCSourceKey = `${chain}_customRPC_source`;
    const lastKnownKey = `${chain}_customRPC_lastKnown`;
    
    if (rpcList && rpcList.length > 0) {
      const rpcString = rpcList.join('\n');

      // Guard against accidental cross-chain contamination (e.g., saving Ethereum list onto Base)
      for (const [otherChain, otherConfig] of Object.entries(SUPPORTED_CHAINS)) {
        if (otherChain === chain) continue;
        const otherLastKnown = localStorage.getItem(`${otherChain}_customRPC_lastKnown`);
        if (otherLastKnown && otherLastKnown === rpcString) {
          console.warn(`[Chain RPC] Detected RPC list for ${chain} matching ${otherChain}. Ignoring save to prevent cross-contamination.`);
          return;
        }
      }

      localStorage.setItem(customRPCKey, rpcString);
      localStorage.setItem(customRPCSourceKey, chain);
      localStorage.setItem(lastKnownKey, rpcString);
      console.log(`[Chain RPC] Saved ${rpcList.length} RPCs for ${chain} into ${customRPCKey}`);
      try {
        if (typeof window !== 'undefined' && typeof window.__setRpcLastValueForChain === 'function') {
          window.__setRpcLastValueForChain(chain, rpcString);
        }
      } catch (_) {}
    } else {
      localStorage.removeItem(customRPCKey);
      localStorage.removeItem(customRPCSourceKey);
      localStorage.removeItem(lastKnownKey);
      console.log(`[Chain RPC] Cleared custom RPCs for ${chain} at key ${customRPCKey}`);
      try {
        if (typeof window !== 'undefined' && typeof window.__setRpcLastValueForChain === 'function') {
          window.__setRpcLastValueForChain(chain, '');
        }
      } catch (_) {}
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
  
  // Get XEN deployment block for current chain
  getXenDeploymentBlock() {
    const config = this.getCurrentConfig();
    return config.constants.XEN_DEPLOYMENT_BLOCK || 0;
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
