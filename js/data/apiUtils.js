// API utilities - shared API operations with rate limiting and error handling
export const apiUtils = {
  // Rate limiting for API calls
  rateLimiter: {
    calls: new Map(),
    
    // Check if rate limit allows the call
    canMakeCall(endpoint, ratePerSecond = 5) {
      const now = Date.now();
      const minInterval = 1000 / ratePerSecond;
      const lastCall = this.calls.get(endpoint) || 0;
      
      if (now - lastCall >= minInterval) {
        this.calls.set(endpoint, now);
        return true;
      }
      
      return false;
    },
    
    // Wait for rate limit to allow the call
    async waitForRateLimit(endpoint, ratePerSecond = 5) {
      const now = Date.now();
      const minInterval = 1000 / ratePerSecond;
      const lastCall = this.calls.get(endpoint) || 0;
      const waitTime = Math.max(0, lastCall + minInterval - now);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      this.calls.set(endpoint, Date.now());
    }
  },

  // Generic HTTP request with retry logic
  async httpRequest(url, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          ...options
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error;
        console.warn(`HTTP request attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }
    
    throw new Error(`HTTP request failed after ${maxRetries} attempts: ${lastError.message}`);
  },

  // Etherscan API utilities
  etherscan: {
    // Dynamic Base URL for current chain's explorer API
    get BASE_URL() {
      const config = window.chainManager?.getCurrentConfig();
      return config?.explorer?.apiUrl || 'https://api.etherscan.io/api';
    },

    // Make rate-limited Etherscan API call
    async apiCall(params, apiKey, ratePerSecond = 5) {
      await apiUtils.rateLimiter.waitForRateLimit('etherscan', ratePerSecond);

      const url = new URL(this.BASE_URL);
      Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
      });
      url.searchParams.append('apikey', apiKey);
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Etherscan API returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === '0' && data.message) {
        // Handle specific error cases
        if (data.message.toLowerCase().includes('rate limit')) {
          throw new Error('RATE_LIMIT');
        }
        if (data.message.toLowerCase().includes('no transactions found')) {
          return []; // Valid empty result
        }
        throw new Error(`Etherscan API Error: ${data.message}`);
      }
      
      return Array.isArray(data.result) ? data.result : [data.result];
    },

    // Fetch transaction logs with automatic range splitting
    async fetchLogs(params, apiKey, maxRetries = 3) {
      const results = [];
      await this.fetchLogsSplit(params, results, apiKey, 0, 1);
      return results;
    },

    // Recursive function to split large log requests
    async fetchLogsSplit(params, results, apiKey, depth = 0, attempt = 1) {
      const maxDepth = 18;
      const maxAttempts = 5;
      
      try {
        const data = await this.apiCall({
          module: 'logs',
          action: 'getLogs',
          ...params
        }, apiKey);
        
        results.push(...data);
        return;
      } catch (error) {
        const errorMsg = error.message;
        
        // Handle rate limiting
        if (errorMsg.includes('RATE_LIMIT') || /rate limit/i.test(errorMsg)) {
          if (attempt <= maxAttempts) {
            const backoff = Math.min(4000, 600 * attempt);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return this.fetchLogsSplit(params, results, apiKey, depth, attempt + 1);
          }
        }
        
        // Handle range too large errors by splitting
        if (/window is too large|reduce the range/i.test(errorMsg) && depth < maxDepth) {
          const fromBlock = Number(params.fromBlock);
          const toBlock = Number(params.toBlock);
          
          if (!Number.isFinite(fromBlock) || !Number.isFinite(toBlock) || toBlock <= fromBlock) {
            throw error;
          }
          
          const midBlock = Math.floor((fromBlock + toBlock) / 2);
          
          // Split into two smaller requests
          await this.fetchLogsSplit({
            ...params,
            toBlock: String(midBlock)
          }, results, apiKey, depth + 1, 1);
          
          await this.fetchLogsSplit({
            ...params,
            fromBlock: String(midBlock + 1)
          }, results, apiKey, depth + 1, 1);
          
          return;
        }
        
        // Handle no records found
        if (/no records found/i.test(errorMsg)) {
          return; // Valid empty result
        }
        
        // Retry on other errors
        if (attempt <= maxAttempts) {
          const backoff = Math.min(5000, 800 * attempt);
          await new Promise(resolve => setTimeout(resolve, backoff));
          return this.fetchLogsSplit(params, results, apiKey, depth, attempt + 1);
        }
        
        throw error;
      }
    },

    // Fetch NFT transfers for an address
    async fetchNFTTransfers(contractAddress, userAddress, apiKey, startBlock = 0, endBlock = 'latest') {
      return this.apiCall({
        module: 'account',
        action: 'tokennfttx',
        contractaddress: contractAddress,
        address: userAddress,
        startblock: startBlock,
        endblock: endBlock,
        page: 1,
        offset: 10000,
        sort: 'asc'
      }, apiKey);
    },

    // Fetch normal transactions for an address
    async fetchTransactions(address, apiKey, startBlock = 0, endBlock = 'latest') {
      return this.apiCall({
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: startBlock,
        endblock: endBlock,
        page: 1,
        offset: 10000,
        sort: 'asc'
      }, apiKey);
    },

    // Fetch ERC20 token transfers
    async fetchTokenTransfers(contractAddress, address, apiKey, startBlock = 0, endBlock = 'latest') {
      return this.apiCall({
        module: 'account',
        action: 'tokentx',
        contractaddress: contractAddress,
        address: address,
        startblock: startBlock,
        endblock: endBlock,
        page: 1,
        offset: 10000,
        sort: 'asc'
      }, apiKey);
    }
  },

  // Generic API client
  createClient(baseURL, defaultHeaders = {}) {
    return {
      baseURL,
      defaultHeaders,
      
      async get(endpoint, params = {}, options = {}) {
        const url = new URL(endpoint, baseURL);
        Object.keys(params).forEach(key => {
          url.searchParams.append(key, params[key]);
        });
        
        return apiUtils.httpRequest(url.toString(), {
          method: 'GET',
          headers: { ...defaultHeaders, ...options.headers },
          ...options
        });
      },
      
      async post(endpoint, data = {}, options = {}) {
        const url = new URL(endpoint, baseURL);
        
        return apiUtils.httpRequest(url.toString(), {
          method: 'POST',
          headers: { ...defaultHeaders, ...options.headers },
          body: JSON.stringify(data),
          ...options
        });
      }
    };
  },

  // Batch API calls with rate limiting
  async batchCalls(calls, ratePerSecond = 5) {
    const results = [];
    const delay = 1000 / ratePerSecond;
    
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      
      try {
        const result = await call();
        results.push({ success: true, data: result, index: i });
      } catch (error) {
        results.push({ success: false, error: error.message, index: i });
      }
      
      // Rate limit delay (except for last call)
      if (i < calls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return results;
  }
};

// Legacy global functions for backward compatibility
window.fetchLogsSplit = (apiKey, params, sink, depth, attempt) => 
  apiUtils.etherscan.fetchLogsSplit(params, sink, apiKey, depth, attempt);

export default apiUtils;