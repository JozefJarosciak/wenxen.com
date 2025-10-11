// Unified Rate Limiting Manager for Scanner APIs
// Provides configurable rate limiting for Etherscan API, RPC calls, and other external services

/**
 * Rate limiter for different service types
 */
export class RateLimitManager {
  constructor() {
    this.limiters = new Map();
    this.defaultLimits = {
      etherscan: { requestsPerSecond: 5, burstSize: 5 },
      rpc: { requestsPerSecond: 10, burstSize: 10 },
      cointool_batch: { requestsPerSecond: 20, burstSize: 50 },
      xenft_enumeration: { requestsPerSecond: 50, burstSize: 100 }
    };
    
    // Load user preferences
    this.loadUserPreferences();
  }

  /**
   * Load rate limiting preferences from localStorage
   */
  loadUserPreferences() {
    // Etherscan API rate limiting
    const etherscanRate = parseInt(localStorage.getItem('etherscanRateLimit')) || this.defaultLimits.etherscan.requestsPerSecond;
    
    // RPC rate limiting  
    const rpcRate = parseInt(localStorage.getItem('rpcRateLimit')) || this.defaultLimits.rpc.requestsPerSecond;
    
    // Cointool batch settings (chain-specific)
    const cointoolBatchSize = window.chainConfigUtils?.getCointoolBatchSize() || 15;
    const cointoolBatchDelay = window.chainConfigUtils?.getCointoolBatchDelay() || 50;
    const cointoolRate = cointoolBatchSize / (cointoolBatchDelay / 1000);
    
    // Update default limits with user preferences
    this.defaultLimits.etherscan.requestsPerSecond = Math.max(1, Math.min(etherscanRate, 20)); // 1-20 req/s
    this.defaultLimits.rpc.requestsPerSecond = Math.max(1, Math.min(rpcRate, 100)); // 1-100 req/s
    this.defaultLimits.cointool_batch.requestsPerSecond = Math.max(1, Math.min(cointoolRate, 100));
    
    console.log('[RateLimit] Loaded preferences:', {
      etherscan: this.defaultLimits.etherscan.requestsPerSecond,
      rpc: this.defaultLimits.rpc.requestsPerSecond,
      cointool: this.defaultLimits.cointool_batch.requestsPerSecond
    });
  }

  /**
   * Get or create a rate limiter for a service
   * @param {string} serviceType - Type of service (etherscan, rpc, etc.)
   * @param {Object} customLimits - Custom rate limits (optional)
   * @returns {TokenBucket} Rate limiter instance
   */
  getLimiter(serviceType, customLimits = null) {
    const key = customLimits ? `${serviceType}_custom` : serviceType;
    
    if (!this.limiters.has(key)) {
      const limits = customLimits || this.defaultLimits[serviceType] || this.defaultLimits.rpc;
      this.limiters.set(key, new TokenBucket(limits.requestsPerSecond, limits.burstSize));
    }
    
    return this.limiters.get(key);
  }

  /**
   * Wait for rate limit compliance
   * @param {string} serviceType - Type of service
   * @param {Object} customLimits - Custom limits (optional)
   * @returns {Promise} Promise that resolves when it's safe to make the request
   */
  async waitForLimit(serviceType, customLimits = null) {
    const limiter = this.getLimiter(serviceType, customLimits);
    return limiter.waitForToken();
  }

  /**
   * Check if a request can be made immediately
   * @param {string} serviceType - Type of service
   * @param {Object} customLimits - Custom limits (optional)
   * @returns {boolean} True if request can be made immediately
   */
  canMakeRequest(serviceType, customLimits = null) {
    const limiter = this.getLimiter(serviceType, customLimits);
    return limiter.hasTokens();
  }

  /**
   * Update rate limits for a service
   * @param {string} serviceType - Type of service
   * @param {number} requestsPerSecond - New rate limit
   * @param {number} burstSize - New burst size (optional)
   */
  updateLimits(serviceType, requestsPerSecond, burstSize = null) {
    const newLimits = {
      requestsPerSecond: Math.max(0.1, requestsPerSecond),
      burstSize: burstSize || Math.max(1, requestsPerSecond)
    };
    
    this.defaultLimits[serviceType] = newLimits;
    
    // Remove existing limiter to force recreation with new limits
    this.limiters.delete(serviceType);
    
    console.log(`[RateLimit] Updated ${serviceType} limits:`, newLimits);
  }

  /**
   * Get current statistics for all limiters
   * @returns {Object} Statistics for each service type
   */
  getStats() {
    const stats = {};
    
    for (const [serviceType, limiter] of this.limiters) {
      stats[serviceType] = {
        tokensAvailable: limiter.tokensAvailable,
        maxTokens: limiter.maxTokens,
        refillRate: limiter.refillRate,
        lastRefill: limiter.lastRefill,
        totalRequests: limiter.totalRequests || 0,
        rejectedRequests: limiter.rejectedRequests || 0
      };
    }
    
    return stats;
  }

  /**
   * Reset all rate limiters
   */
  reset() {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }

  /**
   * Save current rate limit preferences to localStorage
   */
  savePreferences() {
    localStorage.setItem('etherscanRateLimit', this.defaultLimits.etherscan.requestsPerSecond.toString());
    localStorage.setItem('rpcRateLimit', this.defaultLimits.rpc.requestsPerSecond.toString());
    
    console.log('[RateLimit] Saved preferences to localStorage');
  }
}

/**
 * Token bucket implementation for rate limiting
 */
class TokenBucket {
  constructor(refillRate, maxTokens) {
    this.refillRate = refillRate; // tokens per second
    this.maxTokens = maxTokens;
    this.tokensAvailable = maxTokens;
    this.lastRefill = Date.now();
    this.totalRequests = 0;
    this.rejectedRequests = 0;
  }

  /**
   * Refill tokens based on elapsed time
   */
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokensAvailable = Math.min(this.maxTokens, this.tokensAvailable + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Check if tokens are available
   * @returns {boolean} True if tokens are available
   */
  hasTokens() {
    this.refill();
    return this.tokensAvailable >= 1;
  }

  /**
   * Consume a token (non-blocking)
   * @returns {boolean} True if token was consumed
   */
  consumeToken() {
    this.refill();
    this.totalRequests++;
    
    if (this.tokensAvailable >= 1) {
      this.tokensAvailable -= 1;
      return true;
    } else {
      this.rejectedRequests++;
      return false;
    }
  }

  /**
   * Wait for a token to become available
   * @returns {Promise} Promise that resolves when token is available
   */
  async waitForToken() {
    this.refill();
    this.totalRequests++;
    
    if (this.tokensAvailable >= 1) {
      this.tokensAvailable -= 1;
      return Promise.resolve();
    }
    
    // Calculate wait time for next token
    const waitTime = (1 - this.tokensAvailable) / this.refillRate * 1000;
    
    return new Promise(resolve => {
      setTimeout(() => {
        this.tokensAvailable -= 1;
        resolve();
      }, Math.max(0, waitTime));
    });
  }

  /**
   * Reset the bucket to full capacity
   */
  reset() {
    this.tokensAvailable = this.maxTokens;
    this.lastRefill = Date.now();
    this.totalRequests = 0;
    this.rejectedRequests = 0;
  }
}

/**
 * Wrapper for HTTP requests with automatic rate limiting
 */
export class RateLimitedFetcher {
  constructor(serviceType, rateLimitManager = null) {
    this.serviceType = serviceType;
    this.rateLimitManager = rateLimitManager || new RateLimitManager();
    this.retryAttempts = 3;
    this.retryDelay = 1000; // Base delay for retries
  }

  /**
   * Make a rate-limited HTTP request
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @param {number} attempt - Current attempt number (for retries)
   * @returns {Promise<Response>} Fetch response
   */
  async fetch(url, options = {}, attempt = 1) {
    // Wait for rate limit compliance
    await this.rateLimitManager.waitForLimit(this.serviceType);
    
    try {
      const response = await fetch(url, options);
      
      // Handle rate limit responses
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelay * attempt;
        
        console.warn(`[RateLimit] Rate limited (429), waiting ${delay}ms before retry`);
        
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetch(url, options, attempt + 1);
        } else {
          throw new Error(`Rate limit exceeded after ${this.retryAttempts} attempts`);
        }
      }
      
      return response;
      
    } catch (error) {
      if (attempt < this.retryAttempts && this.shouldRetry(error)) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`[RateLimit] Request failed, retrying in ${delay}ms:`, error.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetch(url, options, attempt + 1);
      } else {
        throw error;
      }
    }
  }

  /**
   * Determine if an error should trigger a retry
   * @param {Error} error - Error to check
   * @returns {boolean} True if should retry
   */
  shouldRetry(error) {
    const retryableErrors = [
      'network error',
      'timeout',
      'connection',
      'ECONNRESET',
      'ETIMEDOUT'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(err => errorMessage.includes(err));
  }
}

// Create global singleton instance
const rateLimitManager = new RateLimitManager();

// Make available globally for non-module scripts
if (typeof window !== 'undefined') {
  window.rateLimitManager = rateLimitManager;
  window.RateLimitManager = RateLimitManager;
  window.RateLimitedFetcher = RateLimitedFetcher;
  
  // Legacy compatibility for existing code
  window.throttle = async (serviceType = 'rpc') => {
    await rateLimitManager.waitForLimit(serviceType);
  };
  
  // Configuration helpers
  window.updateRateLimit = (serviceType, requestsPerSecond) => {
    rateLimitManager.updateLimits(serviceType, requestsPerSecond);
    rateLimitManager.savePreferences();
  };
  
  window.getRateLimitStats = () => {
    return rateLimitManager.getStats();
  };
}

export default rateLimitManager;