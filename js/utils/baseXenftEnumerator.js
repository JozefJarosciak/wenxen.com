// Base Chain XENFT Enumeration Utility
// Efficient token enumeration for Base chain using Transfer events

/**
 * Enumerate XENFT tokens for an address on Base chain using Transfer events
 * This is much more efficient than brute force token ID searching
 */
export class BaseXenftEnumerator {
  constructor(contract, web3Instance, etherscanApiKey) {
    this.contract = contract;
    this.web3 = web3Instance;
    this.etherscanApiKey = etherscanApiKey;
    this.cache = new Map(); // Cache results by address
  }

  /**
   * Get all XENFT token IDs owned by an address
   * @param {string} address - Owner address
   * @param {boolean} forceRefresh - Skip cache and fetch fresh data
   * @returns {Promise<string[]>} Array of token IDs
   */
  async getTokenIds(address, forceRefresh = false) {
    const cacheKey = address.toLowerCase();
    
    // Check cache first
    if (!forceRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      const cacheAge = Date.now() - cached.timestamp;
      if (cacheAge < 300000) { // 5 minutes cache
        console.log(`[Base XENFT] Using cached tokens for ${address}: ${cached.tokenIds.length} tokens`);
        return cached.tokenIds;
      }
    }

    try {
      console.log(`[Base XENFT] Enumerating tokens for ${address} using Transfer events`);
      
      // Get current balance to validate our results
      const currentBalance = await this.contract.methods.balanceOf(address).call();
      console.log(`[Base XENFT] Current balance: ${currentBalance}`);
      
      if (Number(currentBalance) === 0) {
        this.cache.set(cacheKey, { tokenIds: [], timestamp: Date.now() });
        return [];
      }

      // Get tokens using multiple strategies for robustness
      const strategies = [
        () => this.getTokensFromTransferEvents(address),
        () => this.getTokensFromEtherscanAPI(address),
        () => this.getTokensFromFallbackEnumeration(address, Number(currentBalance))
      ];

      let tokenIds = [];
      for (const strategy of strategies) {
        try {
          tokenIds = await strategy();
          if (tokenIds.length > 0) {
            console.log(`[Base XENFT] Found ${tokenIds.length} tokens using strategy`);
            break;
          }
        } catch (error) {
          console.warn(`[Base XENFT] Strategy failed:`, error.message);
        }
      }

      // Validate tokens and remove any that are no longer owned
      const validTokenIds = await this.validateTokenOwnership(address, tokenIds);
      
      // Cache the results
      this.cache.set(cacheKey, { 
        tokenIds: validTokenIds, 
        timestamp: Date.now() 
      });
      
      console.log(`[Base XENFT] Final result: ${validTokenIds.length} valid tokens for ${address}`);
      return validTokenIds;
      
    } catch (error) {
      console.error(`[Base XENFT] Failed to enumerate tokens for ${address}:`, error);
      // Return cached data if available
      if (this.cache.has(cacheKey)) {
        console.log(`[Base XENFT] Using stale cached data`);
        return this.cache.get(cacheKey).tokenIds;
      }
      return [];
    }
  }

  /**
   * Get tokens using Transfer events from RPC
   * @param {string} address - Owner address
   * @returns {Promise<string[]>} Array of token IDs
   */
  async getTokensFromTransferEvents(address) {
    const tokenIds = new Set();
    
    // Get XENFT contract creation block for Base
    const fromBlock = window.chainConfigUtils?.getCreationBlock('XENFT_TORRENT') || 3095343;
    const toBlock = 'latest';
    
    // Transfer event topic: Transfer(address,address,uint256)
    const transferTopic = this.web3.utils.sha3('Transfer(address,address,uint256)');
    const addressTopic = this.web3.utils.padLeft(address.toLowerCase(), 64);
    
    console.log(`[Base XENFT] Scanning Transfer events from block ${fromBlock}`);
    
    try {
      // Get transfers TO this address (mints and receives)
      const incomingTransfers = await this.contract.getPastEvents('Transfer', {
        filter: { to: address },
        fromBlock: fromBlock,
        toBlock: toBlock
      });
      
      // Get transfers FROM this address (sends) to track tokens that were transferred away
      const outgoingTransfers = await this.contract.getPastEvents('Transfer', {
        filter: { from: address },
        fromBlock: fromBlock,
        toBlock: toBlock
      });
      
      // Process incoming transfers
      for (const event of incomingTransfers) {
        const tokenId = event.returnValues.tokenId;
        if (tokenId) {
          tokenIds.add(tokenId.toString());
        }
      }
      
      // Remove tokens that were transferred away
      for (const event of outgoingTransfers) {
        const tokenId = event.returnValues.tokenId;
        if (tokenId) {
          tokenIds.delete(tokenId.toString());
        }
      }
      
      console.log(`[Base XENFT] Found ${tokenIds.size} tokens from Transfer events`);
      return Array.from(tokenIds);
      
    } catch (error) {
      console.warn(`[Base XENFT] Transfer event scanning failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get tokens using Etherscan API (more reliable for Base)
   * @param {string} address - Owner address
   * @returns {Promise<string[]>} Array of token IDs
   */
  async getTokensFromEtherscanAPI(address) {
    if (!this.etherscanApiKey) {
      throw new Error('Etherscan API key required for Base enumeration');
    }

    const contractAddress = this.contract.options.address;
    const url = window.chainConfigUtils?.getEtherscanApiUrl('account', 'tokennfttx', {
      contractaddress: contractAddress,
      address: address,
      startblock: 0,
      endblock: 99999999,
      page: 1,
      offset: 10000,
      sort: 'asc',
      apikey: this.etherscanApiKey
    });

    if (!url) {
      throw new Error('Could not build Etherscan API URL');
    }

    console.log(`[Base XENFT] Fetching NFT transactions from Etherscan API`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Etherscan API failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== "1" || !Array.isArray(data.result)) {
      if (data.message && data.message.toLowerCase().includes('no transactions found')) {
        return [];
      }
      throw new Error(`Etherscan API error: ${data.message || 'Unknown error'}`);
    }

    // Track token ownership changes
    const tokenHistory = new Map();
    
    for (const tx of data.result) {
      const tokenId = tx.tokenID;
      const isIncoming = tx.to.toLowerCase() === address.toLowerCase();
      const isOutgoing = tx.from.toLowerCase() === address.toLowerCase();
      
      if (isIncoming) {
        tokenHistory.set(tokenId, { owned: true, lastBlock: Number(tx.blockNumber) });
      } else if (isOutgoing) {
        tokenHistory.set(tokenId, { owned: false, lastBlock: Number(tx.blockNumber) });
      }
    }

    // Get currently owned tokens
    const ownedTokens = [];
    for (const [tokenId, status] of tokenHistory) {
      if (status.owned) {
        ownedTokens.push(tokenId);
      }
    }

    console.log(`[Base XENFT] Found ${ownedTokens.length} tokens from Etherscan API`);
    return ownedTokens;
  }

  /**
   * Fallback enumeration using smart token ID range detection
   * @param {string} address - Owner address
   * @param {number} expectedBalance - Expected number of tokens
   * @returns {Promise<string[]>} Array of token IDs
   */
  async getTokensFromFallbackEnumeration(address, expectedBalance) {
    console.log(`[Base XENFT] Using fallback enumeration for ${expectedBalance} expected tokens`);
    
    const tokenIds = [];
    let foundCount = 0;
    
    // Get a reasonable search range based on contract activity
    let latestTokenId = 860000; // Conservative estimate for Base
    try {
      latestTokenId = Number(await this.contract.methods.tokenIdCounter().call());
    } catch (e) {
      console.log(`[Base XENFT] Could not get tokenIdCounter, using estimate`);
    }
    
    // Use a more targeted search strategy
    const searchRanges = [
      // Recent tokens (most likely)
      { start: latestTokenId, end: Math.max(latestTokenId - 10000, 1), step: -1 },
      // Medium range
      { start: Math.max(latestTokenId - 10000, 1), end: Math.max(latestTokenId - 50000, 1), step: -10 },
      // Older tokens (less likely but possible)
      { start: Math.max(latestTokenId - 50000, 1), end: 1, step: -100 }
    ];
    
    for (const range of searchRanges) {
      if (foundCount >= expectedBalance) break;
      
      console.log(`[Base XENFT] Searching range ${range.start} to ${range.end} (step ${range.step})`);
      
      for (let tokenId = range.start; tokenId >= range.end && foundCount < expectedBalance; tokenId += range.step) {
        try {
          const owner = await this.contract.methods.ownerOf(tokenId.toString()).call();
          if (owner.toLowerCase() === address.toLowerCase()) {
            tokenIds.push(tokenId.toString());
            foundCount++;
            console.log(`[Base XENFT] Found token ${tokenId} (${foundCount}/${expectedBalance})`);
          }
        } catch (e) {
          // Token doesn't exist, continue
        }
        
        // Rate limiting
        if (tokenId % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }
    
    return tokenIds.sort((a, b) => Number(a) - Number(b));
  }

  /**
   * Validate that tokens are still owned by the address
   * @param {string} address - Owner address
   * @param {string[]} tokenIds - Token IDs to validate
   * @returns {Promise<string[]>} Array of valid token IDs
   */
  async validateTokenOwnership(address, tokenIds) {
    if (!tokenIds.length) return [];
    
    console.log(`[Base XENFT] Validating ownership of ${tokenIds.length} tokens`);
    
    const validTokens = [];
    const batchSize = 20; // Process in small batches to avoid rate limits
    
    for (let i = 0; i < tokenIds.length; i += batchSize) {
      const batch = tokenIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (tokenId) => {
        try {
          const owner = await this.contract.methods.ownerOf(tokenId).call();
          if (owner.toLowerCase() === address.toLowerCase()) {
            // Also validate that the token has VMU count > 0
            try {
              const vmuCount = await this.contract.methods.vmuCount(tokenId).call();
              if (Number(vmuCount) > 0) {
                return tokenId;
              }
            } catch (e) {
              // If vmuCount fails but ownerOf succeeded, still include it
              return tokenId;
            }
          }
        } catch (e) {
          // Token doesn't exist or ownership check failed
        }
        return null;
      });
      
      const batchResults = await Promise.all(batchPromises);
      validTokens.push(...batchResults.filter(tokenId => tokenId !== null));
      
      // Rate limiting between batches
      if (i + batchSize < tokenIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[Base XENFT] Validated ${validTokens.length}/${tokenIds.length} tokens`);
    return validTokens;
  }

  /**
   * Clear cache for an address
   * @param {string} address - Address to clear cache for
   */
  clearCache(address) {
    if (address) {
      this.cache.delete(address.toLowerCase());
    } else {
      this.cache.clear();
    }
  }
}

// Make available globally for non-module scripts
if (typeof window !== 'undefined') {
  window.BaseXenftEnumerator = BaseXenftEnumerator;
}