// Rate limiter for API calls - ensures we don't exceed API rate limits
export class RateLimiter {
  constructor(maxRequestsPerSecond = 5) {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    this.minInterval = 1000 / maxRequestsPerSecond; // Minimum ms between requests
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.activeRequests = 0;
  }

  async throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  async execute(fn) {
    await this.throttle();
    return fn();
  }
}

// Global rate limiter for Etherscan API (5 requests per second)
export const etherscanRateLimiter = new RateLimiter(5);

// For backward compatibility with existing code
window.etherscanRateLimiter = etherscanRateLimiter;

export default etherscanRateLimiter;