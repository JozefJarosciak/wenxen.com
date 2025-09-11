// Deploy Version Manager - handles clickable deploy version with commit history
import { toastManager } from './toastManager.js';

export const deployVersionManager = {
  currentPage: 1,
  perPage: 20,
  isLoading: false,
  allCommits: [],
  currentDeployTimestamp: null,
  
  // Rate limiting and caching
  rateLimitResetTime: null,
  rateLimitRemaining: null,
  lastRequestTime: 0,
  minRequestInterval: 1000, // Minimum 1 second between requests
  cache: new Map(), // Simple in-memory cache
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
  
  // Smart loading state
  maxCachedPage: 0, // Track highest page we have cached
  cachedPages: new Set(), // Track which pages are cached
  
  // Error handling
  retryAttempts: 0,
  maxRetries: 3,
  backoffBase: 2000, // 2 seconds base backoff
  
  // API state
  apiDisabled: false,
  apiDisabledUntil: null,
  
  // Initialize the deploy version click handler
  initialize() {
    const deployVersionEl = document.getElementById('deployVersion');
    if (deployVersionEl) {
      // Extract deployment timestamp from version
      const versionText = deployVersionEl.textContent || deployVersionEl.innerText;
      const match = versionText.match(/v(\d{14})/);
      if (match) {
        this.currentDeployTimestamp = this.parseDeployTimestamp(match[1]);
      }
      
      deployVersionEl.addEventListener('click', () => {
        this.showCommitHistory();
      });
    }
  },

  // Parse deployment timestamp: YYYYMMDDHHMISS
  parseDeployTimestamp(timestamp) {
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(8, 10);
    const min = timestamp.substring(10, 12);
    const sec = timestamp.substring(12, 14);
    
    return new Date(year, month - 1, day, hour, min, sec);
  },

  // Check if we can make an API request
  canMakeRequest() {
    const now = Date.now();
    
    // Check if API is temporarily disabled
    if (this.apiDisabled && this.apiDisabledUntil && now < this.apiDisabledUntil) {
      return false;
    }
    
    // Re-enable API if disabled period has passed
    if (this.apiDisabled && this.apiDisabledUntil && now >= this.apiDisabledUntil) {
      this.apiDisabled = false;
      this.apiDisabledUntil = null;
      this.retryAttempts = 0;
    }
    
    // Check rate limit timing
    if (now - this.lastRequestTime < this.minRequestInterval) {
      return false;
    }
    
    // Check if we have rate limit info and we're at the limit
    if (this.rateLimitRemaining !== null && this.rateLimitRemaining <= 1) {
      if (this.rateLimitResetTime && now < this.rateLimitResetTime * 1000) {
        return false;
      }
    }
    
    return true;
  },

  // Wait before making request if needed
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  },

  // Handle rate limit headers from GitHub API
  handleRateLimitHeaders(response) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    
    if (remaining !== null) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    
    if (reset !== null) {
      this.rateLimitResetTime = parseInt(reset, 10);
    }
    
    // If we're getting close to the limit, increase the delay
    if (this.rateLimitRemaining !== null && this.rateLimitRemaining < 10) {
      this.minRequestInterval = 2000; // Slow down to 2 seconds
    } else if (this.rateLimitRemaining !== null && this.rateLimitRemaining < 5) {
      this.minRequestInterval = 5000; // Slow down to 5 seconds
    }
  },

  // Get cache key for a request
  getCacheKey(page) {
    return `commits-page-${page}`;
  },

  // Get cached data if available and not expired
  getCachedData(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      // Try localStorage as backup
      try {
        const stored = localStorage.getItem(`commit-cache-${cacheKey}`);
        if (stored) {
          const parsedCache = JSON.parse(stored);
          const now = Date.now();
          if (now - parsedCache.timestamp < this.cacheExpiry) {
            console.log('Using localStorage cache for', cacheKey);
            // Restore dates from ISO strings
            if (parsedCache.data && parsedCache.data.commits) {
              parsedCache.data.commits.forEach(commit => {
                if (commit.date) {
                  commit.date = new Date(commit.date);
                }
              });
            }
            // Move to memory cache
            this.cache.set(cacheKey, parsedCache);
            return parsedCache.data;
          }
        }
      } catch (e) {
        console.warn('Error reading from localStorage cache:', e);
      }
      return null;
    }
    
    const now = Date.now();
    if (now - cached.timestamp > this.cacheExpiry) {
      this.cache.delete(cacheKey);
      try {
        localStorage.removeItem(`commit-cache-${cacheKey}`);
      } catch (e) {
        // Ignore localStorage errors
      }
      return null;
    }
    
    return cached.data;
  },

  // Cache data with timestamp
  setCachedData(cacheKey, data) {
    const cacheEntry = {
      data,
      timestamp: Date.now()
    };
    
    // Store in memory
    this.cache.set(cacheKey, cacheEntry);
    
    // Track cached pages
    const pageMatch = cacheKey.match(/commits-page-(\d+)/);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1], 10);
      this.cachedPages.add(pageNum);
      this.maxCachedPage = Math.max(this.maxCachedPage, pageNum);
    }
    
    // Also store in localStorage for persistence
    try {
      localStorage.setItem(`commit-cache-${cacheKey}`, JSON.stringify(cacheEntry));
    } catch (e) {
      console.warn('Unable to save to localStorage:', e);
    }
  },

  // Check if a page is cached and valid
  isPageCached(page) {
    const cacheKey = this.getCacheKey(page);
    const cachedData = this.getCachedData(cacheKey);
    return cachedData !== null;
  },

  // Find the next uncached page to load
  getNextUncachedPage() {
    // Start from page 1 and find the first gap
    let page = 1;
    while (page <= this.maxCachedPage + 1) {
      if (!this.isPageCached(page)) {
        return page;
      }
      page++;
    }
    return page;
  },

  // Build commit list from cache
  buildCommitListFromCache() {
    const commits = [];
    let page = 1;
    
    while (page <= this.maxCachedPage) {
      const cachedData = this.getCachedData(this.getCacheKey(page));
      if (cachedData && cachedData.commits) {
        commits.push(...cachedData.commits);
      }
      page++;
    }
    
    return commits;
  },

  // Initialize cache tracking from localStorage
  initializeCacheTracking() {
    this.cachedPages.clear();
    this.maxCachedPage = 0;
    
    // Scan localStorage for cached pages and clean up expired entries
    try {
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('commit-cache-commits-page-')) {
          const pageMatch = key.match(/commit-cache-commits-page-(\d+)/);
          if (pageMatch) {
            const pageNum = parseInt(pageMatch[1], 10);
            // Check if cache is still valid
            if (this.isPageCached(pageNum)) {
              this.cachedPages.add(pageNum);
              this.maxCachedPage = Math.max(this.maxCachedPage, pageNum);
            } else {
              // Mark expired entries for removal
              keysToRemove.push(key);
            }
          }
        }
      }
      
      // Remove expired entries
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn('Error removing expired cache:', key);
        }
      });
      
      console.log(`Initialized cache tracking: ${this.cachedPages.size} pages cached, max page: ${this.maxCachedPage}, cleaned ${keysToRemove.length} expired entries`);
    } catch (e) {
      console.warn('Error initializing cache tracking:', e);
    }
  },

  // Clean up all cache (for manual cache clearing if needed)
  clearAllCache() {
    try {
      // Clear memory cache
      this.cache.clear();
      this.cachedPages.clear();
      this.maxCachedPage = 0;
      
      // Clear localStorage cache
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('commit-cache-')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared all cache: ${keysToRemove.length} entries removed`);
    } catch (e) {
      console.warn('Error clearing cache:', e);
    }
  },

  // Handle API errors with exponential backoff
  async handleApiError(error, response, page) {
    console.error('API Error:', error, response?.status, response?.statusText);
    
    // Handle 403 Forbidden (often due to rate limiting or auth issues)
    if (response && response.status === 403) {
      console.warn('GitHub API access forbidden. Disabling API temporarily.');
      
      // Disable API for 5 minutes
      this.apiDisabled = true;
      this.apiDisabledUntil = Date.now() + (5 * 60 * 1000);
      
      // Try to return cached data if available
      const cacheKey = this.getCacheKey(page);
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        console.log('Using cached data due to API 403 error');
        return cachedData;
      }
      
      // If no cache and it's the first page, return fallback
      if (page === 1) {
        const fallbackCommits = this.getFallbackCommits();
        return { 
          commits: fallbackCommits, 
          deploymentStatus: { status: 'unknown', message: 'GitHub API unavailable - using fallback data' }
        };
      }
      
      return null;
    }
    
    // Handle 429 Too Many Requests
    if (response && response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      const backoffTime = retryAfter ? 
        parseInt(retryAfter, 10) * 1000 : 
        this.backoffBase * Math.pow(2, this.retryAttempts);
      
      console.warn(`Rate limited. Backing off for ${backoffTime}ms`);
      
      // Temporarily disable API
      this.apiDisabled = true;
      this.apiDisabledUntil = Date.now() + backoffTime;
      this.retryAttempts++;
      
      // Try to return cached data if available
      const cacheKey = this.getCacheKey(page);
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        console.log('Using cached data due to rate limiting');
        this.showRateLimitMessage(backoffTime);
        return cachedData;
      }
      
      // Show user-friendly message
      this.showRateLimitMessage(backoffTime);
      
      // If no cache and it's the first page, return fallback
      if (page === 1) {
        const fallbackCommits = this.getFallbackCommits();
        return { 
          commits: fallbackCommits, 
          deploymentStatus: { status: 'unknown', message: 'Rate limited - using fallback data' }
        };
      }
      
      return null;
    }
    
    // Handle other errors
    if (response && response.status >= 500) {
      // Server errors - try again with backoff
      if (this.retryAttempts < this.maxRetries) {
        const backoffTime = this.backoffBase * Math.pow(2, this.retryAttempts);
        console.warn(`Server error. Retrying in ${backoffTime}ms`);
        this.retryAttempts++;
        
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return await this.loadMoreCommits(); // Retry
      }
    }
    
    // Other errors or max retries reached - try cache first
    const cacheKey = this.getCacheKey(page);
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      console.log('Using cached data due to API error');
      return cachedData;
    }
    
    // If no cache and it's the first page, return fallback
    if (page === 1) {
      const fallbackCommits = this.getFallbackCommits();
      return { 
        commits: fallbackCommits, 
        deploymentStatus: { status: 'unknown', message: 'GitHub API error - using fallback data' }
      };
    }
    
    this.retryAttempts = 0;
    return null;
  },

  // Show rate limit message to user
  showRateLimitMessage(backoffTime) {
    const seconds = Math.ceil(backoffTime / 1000);
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.innerHTML = `Rate limited. Waiting ${seconds} seconds before retrying...`;
      loadingIndicator.style.display = 'block';
      
      // Update countdown
      const countdown = setInterval(() => {
        const remaining = Math.ceil((this.apiDisabledUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(countdown);
          loadingIndicator.innerHTML = 'Loading more commits...';
          loadingIndicator.style.display = 'none';
        } else {
          loadingIndicator.innerHTML = `Rate limited. Waiting ${remaining} seconds before retrying...`;
        }
      }, 1000);
    }
  },

  // Show commit history in a toast
  async showCommitHistory() {
    try {
      // Reset state
      this.currentPage = 1;
      this.isLoading = false;
      
      // Initialize cache tracking
      this.initializeCacheTracking();
      
      // Build initial commit list from cache
      let allCommits = this.buildCommitListFromCache();
      let deploymentStatus = null;
      
      console.log(`Starting with ${allCommits.length} cached commits from ${this.cachedPages.size} pages`);
      
      // If we have cached data, show it immediately
      if (allCommits.length > 0) {
        // Analyze deployment status from cached data
        deploymentStatus = this.analyzeDeploymentStatus(allCommits.slice(0, 20)); // Use first 20 for analysis
        
        this.allCommits = allCommits;
        let commitTable = this.createCommitTable(allCommits.slice(0, 20)); // Show first 20 initially
        
        const toastContent = this.createToastContent(commitTable, deploymentStatus);
        this.showCustomToast(toastContent, deploymentStatus);
        
        // Then load missing data in background
        this.loadMissingCommits();
        return;
      }
      
      // No cached data, load fresh from API
      const result = await this.getCommitHistory(1);
      
      // Handle null result (API failed)
      if (!result || !result.commits) {
        console.warn('No commit data received, using fallback');
        const fallbackCommits = this.getFallbackCommits();
        const fallbackStatus = { status: 'unknown', message: 'Unable to load commit history - using sample data' };
        
        this.allCommits = fallbackCommits;
        let commitTable = this.createCommitTable(fallbackCommits);
        
        const toastContent = this.createToastContent(commitTable, fallbackStatus);
        this.showCustomToast(toastContent, fallbackStatus);
        return;
      }
      
      // Successfully got fresh data
      const { commits, deploymentStatus: freshStatus } = result;
      this.allCommits = commits;
      
      let commitTable = this.createCommitTable(commits);
      const toastContent = this.createToastContent(commitTable, freshStatus);
      this.showCustomToast(toastContent, freshStatus);
      
    } catch (error) {
      console.error('Error fetching commit history:', error);
      
      // Try to show fallback data instead of just an error
      try {
        const fallbackCommits = this.getFallbackCommits();
        const fallbackStatus = { status: 'unknown', message: 'Error loading commits - showing sample data' };
        
        this.allCommits = fallbackCommits;
        const commitTable = this.createCommitTable(fallbackCommits);
        const toastContent = this.createToastContent(commitTable, fallbackStatus);
        this.showCustomToast(toastContent, fallbackStatus);
      } catch (fallbackError) {
        console.error('Even fallback failed:', fallbackError);
        toastManager.error('Unable to fetch commit history');
      }
    }
  },

  // Load missing commits in background
  async loadMissingCommits() {
    if (this.apiDisabled) {
      console.log('API disabled, skipping background loading');
      return;
    }
    
    // Find pages we need to fetch
    const missingPages = [];
    for (let page = 1; page <= this.maxCachedPage + 1; page++) {
      if (!this.isPageCached(page)) {
        missingPages.push(page);
      }
    }
    
    console.log(`Loading ${missingPages.length} missing pages: ${missingPages.join(', ')}`);
    
    // Load missing pages one by one to avoid rate limiting
    for (const page of missingPages) {
      try {
        if (this.apiDisabled || !this.canMakeRequest()) {
          console.log(`Stopping background loading at page ${page} due to rate limits`);
          break;
        }
        
        await this.waitForRateLimit();
        const result = await this.getCommitHistory(page);
        
        if (result && result.commits && result.commits.length > 0) {
          console.log(`Background loaded page ${page} with ${result.commits.length} commits`);
          
          // Update the display with new commits
          this.refreshCommitDisplay();
        } else {
          console.log(`No more commits available at page ${page}, stopping background loading`);
          break;
        }
      } catch (error) {
        console.warn(`Error loading page ${page} in background:`, error);
        break;
      }
    }
  },

  // Refresh the commit display with updated cache
  refreshCommitDisplay() {
    // Rebuild commit list from cache
    const updatedCommits = this.buildCommitListFromCache();
    
    if (updatedCommits.length > this.allCommits.length) {
      this.allCommits = updatedCommits;
      
      // Update the table if toast is still open
      const tbody = document.querySelector('.commit-table tbody');
      if (tbody) {
        // Clear and rebuild tbody with all commits
        tbody.innerHTML = '';
        this.allCommits.forEach(commit => {
          const row = this.createCommitRow({
            ...commit,
            isCurrentDeploy: this.isCurrentDeployCommit(commit.date)
          });
          tbody.appendChild(row);
        });
        console.log(`Refreshed display with ${this.allCommits.length} total commits`);
      }
    }
  },

  // Get commit history from git with pagination
  async getCommitHistory(page = 1) {
    const cacheKey = this.getCacheKey(page);
    
    // Try cache first
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      console.log(`Using cached data for page ${page}`);
      return cachedData;
    }
    
    // Check if we can make a request
    if (!this.canMakeRequest()) {
      console.log('Cannot make request due to rate limiting');
      // Return fallback for new requests, but don't fail completely
      if (page === 1) {
        const fallbackCommits = this.getFallbackCommits();
        return { 
          commits: fallbackCommits, 
          deploymentStatus: { status: 'unknown', message: 'Rate limited - using fallback data' }
        };
      }
      return { commits: [], deploymentStatus: null }; // No more data for pagination
    }
    
    try {
      // Wait if needed to respect rate limits
      await this.waitForRateLimit();
      
      const repoUrl = 'https://api.github.com/repos/JozefJarosciak/wenxen.com/commits';
      const response = await fetch(`${repoUrl}?per_page=${this.perPage}&page=${page}`);
      
      // Update rate limit tracking
      this.lastRequestTime = Date.now();
      this.handleRateLimitHeaders(response);
      
      if (!response.ok) {
        return await this.handleApiError(new Error(`HTTP ${response.status}`), response, page);
      }
      
      const commits = await response.json();
      
      // Reset retry attempts on success
      this.retryAttempts = 0;
      
      const processedCommits = commits.map(commit => ({
        sha: commit.sha,
        shortSha: commit.sha.substring(0, 7),
        message: commit.commit.message, // Full commit message for tooltip
        shortMessage: commit.commit.message.split('\n')[0], // First line for display
        author: commit.commit.author.name,
        date: new Date(commit.commit.author.date),
        url: commit.html_url,
        isCurrentDeploy: false // Will be set later
      }));
      
      let result;
      if (page === 1) {
        // Analyze deployment status and mark current deploy commit
        const deploymentStatus = this.analyzeDeploymentStatus(processedCommits);
        result = { commits: processedCommits, deploymentStatus };
      } else {
        // For pagination, just return commits
        result = { commits: processedCommits, deploymentStatus: null };
      }
      
      // Cache the result
      this.setCachedData(cacheKey, result);
      
      return result;
    } catch (error) {
      return await this.handleApiError(error, null, page);
    }
  },

  // Analyze deployment status relative to commits
  analyzeDeploymentStatus(commits) {
    if (!this.currentDeployTimestamp) {
      return { status: 'unknown', message: 'Deploy timestamp not available', count: 0 };
    }

    let status = 'unknown';
    let message = '';
    let count = 0;
    let deployCommitIndex = -1;

    // Find commits newer than deployment
    const newerCommits = commits.filter(commit => commit.date > this.currentDeployTimestamp);
    
    if (newerCommits.length === 0) {
      // Check if deployment is at the latest commit (within 5 minutes tolerance)
      const latestCommit = commits[0];
      if (latestCommit && Math.abs(latestCommit.date - this.currentDeployTimestamp) < 5 * 60 * 1000) {
        status = 'current';
        message = 'Deployment is up-to-date with latest commit';
        // Mark the current deploy commit
        latestCommit.isCurrentDeploy = true;
        deployCommitIndex = 0;
      } else {
        status = 'ahead';
        message = 'Deployment is ahead of repository (local changes?)';
      }
    } else {
      status = 'behind';
      count = newerCommits.length;
      message = `Deployment is ${count} commit${count > 1 ? 's' : ''} behind`;
      
      // Try to find the exact deployment commit
      const deployCommit = commits.find(commit => 
        Math.abs(commit.date - this.currentDeployTimestamp) < 5 * 60 * 1000
      );
      
      if (deployCommit) {
        deployCommit.isCurrentDeploy = true;
        deployCommitIndex = commits.indexOf(deployCommit);
      }
    }

    return { status, message, count, deployCommitIndex };
  },

  // Load more commits (lazy loading)
  async loadMoreCommits() {
    if (this.isLoading) return;
    
    // Check if API is disabled due to rate limiting
    if (this.apiDisabled) {
      console.log('API disabled due to rate limiting, skipping load more');
      return;
    }
    
    this.isLoading = true;
    
    // Find the next uncached page to load
    const nextPage = this.getNextUncachedPage();
    console.log(`Load more: trying page ${nextPage}`);
    
    try {
      const result = await this.getCommitHistory(nextPage);
      
      if (result && result.commits && result.commits.length > 0) {
        console.log(`Loaded page ${nextPage} with ${result.commits.length} commits`);
        
        // Rebuild the entire commit list from cache (now includes new data)
        const allCachedCommits = this.buildCommitListFromCache();
        
        // Only append the new commits to the display
        const newCommits = allCachedCommits.slice(this.allCommits.length);
        if (newCommits.length > 0) {
          const processedCommits = newCommits.map(commit => ({
            ...commit,
            isCurrentDeploy: this.isCurrentDeployCommit(commit.date)
          }));
          
          this.allCommits = allCachedCommits;
          this.appendCommitsToTable(processedCommits);
        }
      } else {
        // No more commits available
        console.log('No more commits available');
      }
    } catch (error) {
      console.error('Error loading more commits:', error);
    }
    
    this.isLoading = false;
  },

  // Check if a commit date matches deployment timestamp
  isCurrentDeployCommit(commitDate) {
    if (!this.currentDeployTimestamp) return false;
    return Math.abs(commitDate - this.currentDeployTimestamp) < 5 * 60 * 1000;
  },

  // Append new commits to existing table
  appendCommitsToTable(commits) {
    const tbody = document.querySelector('.commit-table tbody');
    if (!tbody) return;

    commits.forEach(commit => {
      const row = this.createCommitRow(commit);
      tbody.appendChild(row);
    });
  },

  // Create a single commit row element
  createCommitRow(commit) {
    const row = document.createElement('tr');
    row.classList.add('commit-row');
    if (commit.isCurrentDeploy) {
      row.classList.add('current-deploy');
    }

    const formattedDate = commit.date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Add click handler for toggling expanded view
    row.addEventListener('click', (e) => {
      // Don't toggle if clicking on the commit link
      if (e.target.closest('.commit-link')) return;
      
      this.toggleCommitDetails(row, commit);
    });

    row.innerHTML = `
      <td>
        <a href="${commit.url}" target="_blank" rel="noopener noreferrer" class="commit-link">${commit.shortSha}</a>
        ${commit.isCurrentDeploy ? '<span class="deploy-indicator">🚀</span>' : ''}
      </td>
      <td class="commit-message">
        <div class="message-content">
          <span class="expand-indicator">▶</span>
          <span class="message-text">${this.truncateMessage(commit.shortMessage || commit.message)}</span>
        </div>
      </td>
      <td class="commit-author">${commit.author}</td>
      <td class="commit-date">${formattedDate}</td>
    `;

    return row;
  },

  // Toggle commit details expansion
  toggleCommitDetails(row, commit) {
    const expandIndicator = row.querySelector('.expand-indicator');
    const existingDetails = row.nextElementSibling;
    
    // Check if details row already exists
    if (existingDetails && existingDetails.classList.contains('commit-details-row')) {
      // Collapse - remove details row
      existingDetails.remove();
      expandIndicator.textContent = '▶';
      row.classList.remove('expanded');
    } else {
      // Expand - create and insert details row
      const detailsRow = this.createCommitDetailsRow(commit);
      row.parentNode.insertBefore(detailsRow, row.nextSibling);
      expandIndicator.textContent = '▼';
      row.classList.add('expanded');
    }
  },

  // Create detailed commit information row
  createCommitDetailsRow(commit) {
    const detailsRow = document.createElement('tr');
    detailsRow.classList.add('commit-details-row');
    
    const fullDate = commit.date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    // Parse commit message for better display
    const messageParts = (commit.message || '').split('\n');
    const title = messageParts[0] || 'No commit message';
    const body = messageParts.slice(1).join('\n').trim();

    detailsRow.innerHTML = `
      <td colspan="4" class="commit-details">
        <div class="details-container">
          <div class="details-section">
            <h4>Commit Details</h4>
            <div class="detail-item">
              <span class="detail-label">Full SHA:</span>
              <code class="detail-value">${commit.sha}</code>
            </div>
            <div class="detail-item">
              <span class="detail-label">Author:</span>
              <span class="detail-value">${commit.author}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${fullDate}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Link:</span>
              <a href="${commit.url}" target="_blank" rel="noopener noreferrer" class="detail-link">View on GitHub →</a>
            </div>
          </div>
          <div class="details-section">
            <h4>Commit Message</h4>
            <div class="commit-title">${this.escapeHtml(title)}</div>
            ${body ? `<div class="commit-body">${this.escapeHtml(body).replace(/\n/g, '<br>')}</div>` : ''}
          </div>
        </div>
      </td>
    `;

    return detailsRow;
  },

  // Fallback commits if GitHub API is unavailable
  getFallbackCommits() {
    const now = new Date();
    return [
      {
        sha: 'abc1234567890abcdef1234567890abcdef123456',
        shortSha: 'abc1234',
        message: 'Update deployment version tracking\n\nAdded comprehensive deployment tracking system with:\n- Smart rate limiting for GitHub API\n- Exponential backoff for failures\n- Local caching to reduce API calls\n- Graceful error handling for 429 responses',
        shortMessage: 'Update deployment version tracking',
        author: 'Developer',
        date: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        url: 'https://github.com/JozefJarosciak/wenxen.com',
        isCurrentDeploy: true
      },
      {
        sha: 'def5678901234567890abcdef1234567890abcdef',
        shortSha: 'def5678',
        message: 'Fix tooltip theming and table alignment\n\nImproved user experience:\n- Left-aligned table content\n- Theme-specific tooltip colors\n- Better readability across all themes',
        shortMessage: 'Fix tooltip theming and table alignment',
        author: 'Developer',
        date: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
        url: 'https://github.com/JozefJarosciak/wenxen.com',
        isCurrentDeploy: false
      },
      {
        sha: 'ghi9012345678901234567890abcdef1234567890',
        shortSha: 'ghi9012',
        message: 'Add commit message tooltips\n\nEnhanced commit history display:\n- Full commit messages in tooltips\n- Better formatting and readability\n- Support for multiline messages',
        shortMessage: 'Add commit message tooltips',
        author: 'Developer',
        date: new Date(now.getTime() - 6 * 60 * 60 * 1000), // 6 hours ago
        url: 'https://github.com/JozefJarosciak/wenxen.com',
        isCurrentDeploy: false
      },
      {
        sha: 'jkl3456789012345678901234567890abcdef1234',
        shortSha: 'jkl3456',
        message: 'Implement smart rate limiting\n\nGitHub API improvements:\n- Intelligent request throttling\n- Exponential backoff on errors\n- Cache-first approach for better performance',
        shortMessage: 'Implement smart rate limiting',
        author: 'Developer',
        date: new Date(now.getTime() - 8 * 60 * 60 * 1000), // 8 hours ago
        url: 'https://github.com/JozefJarosciak/wenxen.com',
        isCurrentDeploy: false
      },
      {
        sha: 'mno7890123456789012345678901234567890abcd',
        shortSha: 'mno7890',
        message: 'Add deployment status tracking\n\nNew features:\n- Show if deployment is ahead/behind\n- Visual indicators for current deployment\n- Auto-scroll to deployment commit',
        shortMessage: 'Add deployment status tracking',
        author: 'Developer',
        date: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
        url: 'https://github.com/JozefJarosciak/wenxen.com',
        isCurrentDeploy: false
      }
    ];
  },

  // Create the commit table HTML
  createCommitTable(commits) {
    // Ensure commits is an array
    if (!Array.isArray(commits)) {
      console.error('createCommitTable: commits is not an array:', commits);
      return '<p>Error: Invalid commit data</p>';
    }

    const currentTheme = document.body.className.includes('dark-mode') ? 'dark' : 'light';
    const tableClass = `commit-table ${currentTheme}`;
    
    let tableHTML = `<table class="${tableClass}">`;
    tableHTML += '<thead><tr>';
    tableHTML += '<th>Commit</th>';
    tableHTML += '<th>Message</th>';
    tableHTML += '<th>Author</th>';
    tableHTML += '<th>Date</th>';
    tableHTML += '</tr></thead>';
    tableHTML += '<tbody>';

    commits.forEach(commit => {
      // Validate commit object
      if (!commit || typeof commit !== 'object') {
        console.error('Invalid commit object:', commit);
        return;
      }

      const formattedDate = commit.date ? commit.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Unknown date';

      const isCurrentDeploy = commit.isCurrentDeploy || false;
      const rowClass = isCurrentDeploy ? ' class="current-deploy"' : '';

      tableHTML += `<tr class="commit-row${isCurrentDeploy ? ' current-deploy' : ''}">`;
      tableHTML += `<td>
        <a href="${commit.url || '#'}" target="_blank" rel="noopener noreferrer" class="commit-link">${commit.shortSha || 'Unknown'}</a>
        ${isCurrentDeploy ? '<span class="deploy-indicator">🚀</span>' : ''}
      </td>`;
      tableHTML += `<td class="commit-message">
        <div class="message-content">
          <span class="expand-indicator">▶</span>
          <span class="message-text">${this.truncateMessage(commit.shortMessage || commit.message || 'No message')}</span>
        </div>
      </td>`;
      tableHTML += `<td class="commit-author">${commit.author || 'Unknown'}</td>`;
      tableHTML += `<td class="commit-date">${formattedDate}</td>`;
      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    return tableHTML;
  },

  // Truncate long commit messages
  truncateMessage(message, maxLength = 50) {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  },

  // Escape HTML for safe tooltip display
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Create the toast content wrapper
  createToastContent(commitTable, deploymentStatus) {
    const statusIcon = this.getStatusIcon(deploymentStatus.status);
    const statusClass = `status-${deploymentStatus.status}`;
    
    return `
      <div class="commit-history-toast">
        <div class="toast-header">
          <div class="header-left">
            <h3>Commit History</h3>
            <div class="deployment-status ${statusClass}">
              <span class="status-icon">${statusIcon}</span>
              <span class="status-text">${deploymentStatus.message}</span>
            </div>
          </div>
          <div class="repo-link">
            <a href="https://github.com/JozefJarosciak/wenxen.com" target="_blank" rel="noopener noreferrer">
              View Repository →
            </a>
          </div>
        </div>
        <div class="commit-table-container" id="commitTableContainer">
          ${commitTable}
          <div class="loading-indicator" id="loadingIndicator" style="display: none;">
            Loading more commits...
          </div>
        </div>
      </div>
    `;
  },

  // Get status icon based on deployment status
  getStatusIcon(status) {
    switch (status) {
      case 'current': return '✅';
      case 'behind': return '⚠️';
      case 'ahead': return '🚀';
      default: return '❓';
    }
  },

  // Show custom toast with commit history
  showCustomToast(content, deploymentStatus) {
    // Remove existing toast if any
    toastManager.removeExisting();
    
    // Create custom toast element
    const toast = document.createElement('div');
    toast.className = 'toast commit-toast';
    toast.innerHTML = content;
    
    // Set up infinite scroll
    this.setupInfiniteScroll(toast);
    
    // Add click handlers to commit rows
    this.setupCommitRowHandlers(toast);
    
    // Add OK button
    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.className = 'toast-ok-button';
    okButton.addEventListener('click', () => {
      toastManager.hide(toast);
    });
    
    toast.appendChild(okButton);
    
    // Add to document
    document.body.appendChild(toast);
    
    // Show with animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    // Scroll to current deployment if found
    setTimeout(() => {
      this.scrollToCurrentDeploy();
    }, 200);
    
    // Close on escape key
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        toastManager.hide(toast);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  },

  // Setup click handlers for commit rows
  setupCommitRowHandlers(toast) {
    const rows = toast.querySelectorAll('.commit-row');
    rows.forEach((row, index) => {
      row.addEventListener('click', (e) => {
        // Don't toggle if clicking on the commit link
        if (e.target.closest('.commit-link')) return;
        
        // Find the corresponding commit data
        const commit = this.allCommits[index];
        if (commit) {
          this.toggleCommitDetails(row, commit);
        }
      });
    });
  },

  // Setup infinite scroll for the commit table
  setupInfiniteScroll(toast) {
    const container = toast.querySelector('#commitTableContainer');
    if (!container) return;
    
    let scrollTimeout;
    
    container.addEventListener('scroll', () => {
      // Debounce scroll events to prevent excessive API calls
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        
        // Load more when scrolled to 95% of the height (less aggressive)
        // Also check if we're not already loading and API is not disabled
        if (scrollTop + clientHeight >= scrollHeight * 0.95 && 
            !this.isLoading && 
            !this.apiDisabled) {
          
          this.showLoadingIndicator();
          this.loadMoreCommits().then(() => {
            this.hideLoadingIndicator();
          }).catch((error) => {
            console.error('Load more commits failed:', error);
            this.hideLoadingIndicator();
          });
        }
      }, 100); // 100ms debounce
    });
  },

  // Show loading indicator
  showLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
      indicator.style.display = 'block';
    }
  },

  // Hide loading indicator
  hideLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  },

  // Scroll to current deployment row
  scrollToCurrentDeploy() {
    const currentDeployRow = document.querySelector('.commit-table tr.current-deploy');
    if (currentDeployRow) {
      currentDeployRow.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    deployVersionManager.initialize();
  });
} else {
  deployVersionManager.initialize();
}

export default deployVersionManager;