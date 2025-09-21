// Web3 utilities - shared Web3 and RPC management functions
import { settingsStorage } from '../utils/storageUtils.js';

export const web3Utils = {
  // Default RPC endpoint
  DEFAULT_RPC: 'https://ethereum-rpc.publicnode.com',

  // RPC blacklist management
  _rpcBlacklist: new Map(), // Maps RPC URL to { failureCount, lastFailed, blacklistedUntil }
  _maxFailures: 3,
  _blacklistDuration: 5 * 60 * 1000, // 5 minutes

  // Create new Web3 instance with RPC rotation support
  createWeb3Instance() {
    const rpcList = this.getAvailableRPCs();
    if (rpcList.length === 0) {
      throw new Error('No available RPC endpoints');
    }

    const provider = new window.Web3.providers.HttpProvider(rpcList[0]);
    const web3 = new window.Web3(provider);

    // Add RPC rotation capabilities
    web3.__rpcList = rpcList;
    web3.__rpcIndex = 0;

    return web3;
  },

  // Get RPC list from settings
  getRPCList() {
    return settingsStorage.getRPCList();
  },

  // Get available (non-blacklisted) RPCs
  getAvailableRPCs() {
    const allRPCs = this.getRPCList();
    const now = Date.now();

    return allRPCs.filter(rpc => {
      const blacklistInfo = this._rpcBlacklist.get(rpc);
      if (!blacklistInfo) return true;

      // Check if blacklist period has expired
      if (blacklistInfo.blacklistedUntil && now > blacklistInfo.blacklistedUntil) {
        this._rpcBlacklist.delete(rpc);
        return true;
      }

      return !blacklistInfo.blacklistedUntil;
    });
  },

  // Record RPC failure and potentially blacklist it
  recordRPCFailure(rpcUrl, errorMessage = '') {
    const now = Date.now();
    const currentInfo = this._rpcBlacklist.get(rpcUrl) || { failureCount: 0, lastFailed: 0 };

    currentInfo.failureCount++;
    currentInfo.lastFailed = now;
    currentInfo.lastError = errorMessage;

    // Blacklist if failures exceed threshold
    if (currentInfo.failureCount >= this._maxFailures) {
      currentInfo.blacklistedUntil = now + this._blacklistDuration;
      console.warn(`RPC ${rpcUrl} blacklisted for ${this._blacklistDuration / 60000} minutes after ${currentInfo.failureCount} failures`);

      // Show user-friendly notification
      if (window.showToast) {
        window.showToast(`RPC endpoint temporarily disabled due to failures: ${rpcUrl.substring(0, 50)}...`, 'warning');
      }
    }

    this._rpcBlacklist.set(rpcUrl, currentInfo);
  },

  // Record RPC success (reset failure count)
  recordRPCSuccess(rpcUrl) {
    const currentInfo = this._rpcBlacklist.get(rpcUrl);
    if (currentInfo) {
      // Reset failure count but keep the entry for tracking
      currentInfo.failureCount = 0;
      delete currentInfo.blacklistedUntil;
      this._rpcBlacklist.set(rpcUrl, currentInfo);
    }
  },

  // Get RPC health status for debugging
  getRPCHealthStatus() {
    const availableRPCs = this.getAvailableRPCs();
    const allRPCs = this.getRPCList();
    const blacklistedRPCs = allRPCs.filter(rpc => !availableRPCs.includes(rpc));

    return {
      total: allRPCs.length,
      available: availableRPCs.length,
      blacklisted: blacklistedRPCs.length,
      blacklistedRPCs: blacklistedRPCs.map(rpc => {
        const info = this._rpcBlacklist.get(rpc);
        return {
          url: rpc,
          failures: info?.failureCount || 0,
          lastError: info?.lastError || '',
          blacklistedUntil: info?.blacklistedUntil ? new Date(info.blacklistedUntil).toLocaleTimeString() : null
        };
      })
    };
  },

  // Rotate to next available RPC endpoint
  rotateRPC(web3) {
    if (!web3.__rpcList || !web3.__rpcList.length) return false;

    // Get fresh list of available RPCs in case blacklist changed
    const availableRPCs = this.getAvailableRPCs();
    if (availableRPCs.length === 0) {
      console.warn('No available RPC endpoints to rotate to');
      return false;
    }

    // Update web3 instance with current available RPCs
    web3.__rpcList = availableRPCs;

    // Find next available RPC
    web3.__rpcIndex = (web3.__rpcIndex + 1) % availableRPCs.length;
    const nextRPC = availableRPCs[web3.__rpcIndex];

    try {
      web3.setProvider(new window.Web3.providers.HttpProvider(nextRPC));

      // Update status indicator if available
      const statusElement = document.getElementById('rpcStatus');
      if (statusElement) {
        statusElement.textContent = `via ${nextRPC}`;
      }

      return true;
    } catch (error) {
      console.warn('Failed to rotate RPC:', error);
      this.recordRPCFailure(nextRPC, error.message);
      return false;
    }
  },

  // Retry operation with intelligent RPC rotation and blacklisting
  async withRetry(web3, operation, maxRetries = null) {
    const availableRPCs = this.getAvailableRPCs();
    if (availableRPCs.length === 0) {
      await this.handleAllRPCsFailed('operation retry');
      throw this.createRecoveryError('No available RPC endpoints', 'Operation retry');
    }

    const maxAttempts = maxRetries || Math.max(6, availableRPCs.length * 2);
    let lastError;
    let currentRPC = availableRPCs[web3.__rpcIndex || 0];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await operation();
        // Record success for current RPC
        this.recordRPCSuccess(currentRPC);
        return result;
      } catch (error) {
        lastError = error;

        // Determine if this is an RPC-specific error that should trigger blacklisting
        const isRPCError = this.isRPCError(error);
        if (isRPCError) {
          this.recordRPCFailure(currentRPC, error.message);
          console.warn(`RPC ${currentRPC} failed (attempt ${attempt + 1}): ${error.message}`);
        } else {
          console.warn(`Operation failed (attempt ${attempt + 1}): ${error.message}`);
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.min(200 * Math.pow(1.5, attempt), 2000)));

        // Try to rotate to next available RPC
        const rotated = this.rotateRPC(web3);
        if (rotated && web3.__rpcList) {
          currentRPC = web3.__rpcList[web3.__rpcIndex];
        } else {
          // No more RPCs to try - attempt recovery
          const recovered = await this.handleAllRPCsFailed('operation retry');
          if (!recovered) {
            break;
          }
          // Retry with cleared blacklist
          const newAvailableRPCs = this.getAvailableRPCs();
          if (newAvailableRPCs.length > 0) {
            web3.__rpcList = newAvailableRPCs;
            web3.__rpcIndex = 0;
            currentRPC = newAvailableRPCs[0];
          } else {
            break;
          }
        }
      }
    }

    throw this.createRecoveryError(lastError?.message || 'Unknown error', 'Operation retry');
  },

  // Determine if error is RPC-specific and should trigger blacklisting
  isRPCError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const rpcErrorPatterns = [
      'network error',
      'timeout',
      'connection',
      'fetch',
      'unauthorized',
      'forbidden',
      'rate limit',
      'too many requests',
      'invalid response',
      'parse error',
      'internal server error',
      'bad gateway',
      'service unavailable',
      'gateway timeout'
    ];

    return rpcErrorPatterns.some(pattern => errorMessage.includes(pattern));
  },

  // Handle complete RPC failure with user-friendly recovery
  async handleAllRPCsFailed(context = 'operation') {
    const status = this.getRPCHealthStatus();
    console.error(`All RPCs failed for ${context}:`, status);

    // Show user-friendly error with recovery options
    if (window.showToast) {
      const message = `All RPC endpoints are unavailable. ${status.blacklisted} of ${status.total} endpoints temporarily disabled.`;
      window.showToast(message, 'error', 10000);
    }

    // Try to clear blacklist for recovery if all RPCs are blacklisted
    if (status.available === 0 && status.blacklisted > 0) {
      console.log('Attempting emergency blacklist clear...');
      this.clearBlacklist();

      if (window.showToast) {
        window.showToast('Cleared RPC blacklist for emergency recovery. Retrying...', 'info');
      }

      return true; // Indicates recovery attempt was made
    }

    return false;
  },

  // Clear RPC blacklist (emergency recovery)
  clearBlacklist() {
    this._rpcBlacklist.clear();
    console.log('RPC blacklist cleared');
  },

  // Get suggested recovery actions for users
  getRecoveryActions() {
    const status = this.getRPCHealthStatus();
    const actions = [];

    if (status.available === 0) {
      actions.push('Check your internet connection');

      if (status.blacklisted > 0) {
        actions.push('Wait 5 minutes for RPC endpoints to become available again');
        actions.push('Add more RPC endpoints in Settings');
      } else {
        actions.push('Add working RPC endpoints in Settings');
      }

      actions.push('Try refreshing the page');
    }

    return actions;
  },

  // Enhanced error with recovery suggestions
  createRecoveryError(originalError, context = 'operation') {
    const status = this.getRPCHealthStatus();
    const actions = this.getRecoveryActions();

    let message = `${context} failed: ${originalError}\\n\\n`;
    message += `RPC Status: ${status.available}/${status.total} endpoints available`;

    if (status.blacklisted > 0) {
      message += ` (${status.blacklisted} temporarily disabled)`;
    }

    if (actions.length > 0) {
      message += '\\n\\nSuggested actions:\\n• ' + actions.join('\\n• ');
    }

    const error = new Error(message);
    error.isRecoveryError = true;
    error.rpcStatus = status;
    error.recoveryActions = actions;

    return error;
  },

  // Test RPC resilience (for debugging)
  async testRPCResilience() {
    console.log('=== RPC Resilience Test ===');

    const initialStatus = this.getRPCHealthStatus();
    console.log('Initial RPC status:', initialStatus);

    try {
      // Test creating Web3 instance
      console.log('Testing Web3 instance creation...');
      const web3 = this.createWeb3Instance();
      console.log('✓ Web3 instance created successfully');

      // Test basic operation
      console.log('Testing basic operation (getChainId)...');
      const chainId = await this.withRetry(web3, async () => {
        return await web3.eth.getChainId();
      });
      console.log('✓ Chain ID retrieved:', chainId);

      // Test contract creation
      console.log('Testing contract creation...');
      const mockABI = [{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"}];
      const mockAddress = '0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8'; // XEN contract
      const contract = await this.getWorkingContract(mockABI, mockAddress);
      console.log('✓ Contract instance created successfully');

      const finalStatus = this.getRPCHealthStatus();
      console.log('Final RPC status:', finalStatus);

      return {
        success: true,
        chainId,
        initialStatus,
        finalStatus
      };

    } catch (error) {
      console.error('RPC resilience test failed:', error);
      const errorStatus = this.getRPCHealthStatus();
      console.log('Error state RPC status:', errorStatus);

      return {
        success: false,
        error: error.message,
        isRecoveryError: error.isRecoveryError,
        rpcStatus: errorStatus
      };
    }
  },

  // Simulate RPC failures for testing (for debugging)
  simulateRPCFailures(rpcUrls = null) {
    const rpcsToFail = rpcUrls || this.getRPCList().slice(0, 2); // Fail first 2 RPCs
    console.log('Simulating failures for RPCs:', rpcsToFail);

    rpcsToFail.forEach(rpc => {
      this.recordRPCFailure(rpc, 'Simulated failure for testing');
      this.recordRPCFailure(rpc, 'Simulated failure for testing');
      this.recordRPCFailure(rpc, 'Simulated failure for testing'); // This should blacklist it
    });

    console.log('Simulated failures applied. Current status:', this.getRPCHealthStatus());
  },

  // Get working contract instance
  async getWorkingContract(abi, contractAddress) {
    const availableRPCs = this.getAvailableRPCs();
    if (availableRPCs.length === 0) {
      await this.handleAllRPCsFailed('contract initialization');
      throw this.createRecoveryError('No available RPC endpoints', 'Contract initialization');
    }

    let lastError;
    for (let i = 0; i < availableRPCs.length; i++) {
      const rpc = availableRPCs[i].trim();
      if (!rpc) continue;

      try {
        const web3 = new window.Web3(rpc);
        await web3.eth.getChainId(); // Test connection

        // Record success and remember which RPC we're using
        this.recordRPCSuccess(rpc);
        window._activeRpc = rpc;

        return new web3.eth.Contract(abi, contractAddress);
      } catch (error) {
        lastError = error;
        console.warn(`RPC ${rpc} failed:`, error.message);

        // Record failure if it's an RPC error
        if (this.isRPCError(error)) {
          this.recordRPCFailure(rpc, error.message);
        }
        continue;
      }
    }

    await this.handleAllRPCsFailed('contract initialization');
    throw this.createRecoveryError(lastError?.message || 'Unknown error', 'Contract initialization');
  },

  // Validate Ethereum address
  isValidAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return window.Web3.utils.isAddress(address);
  },

  // Convert to checksum address
  toChecksumAddress(address) {
    if (!this.isValidAddress(address)) return address;
    return window.Web3.utils.toChecksumAddress(address);
  },

  // Get current network info
  async getNetworkInfo(web3) {
    try {
      const [chainId, blockNumber] = await Promise.all([
        web3.eth.getChainId(),
        web3.eth.getBlockNumber()
      ]);
      
      return {
        chainId: Number(chainId),
        blockNumber: Number(blockNumber),
        isMainnet: Number(chainId) === 1
      };
    } catch (error) {
      console.warn('Failed to get network info:', error);
      return null;
    }
  },

  // Check if wallet is connected to mainnet
  async requireMainnet() {
    if (!window.ethereum) {
      throw new Error('MetaMask or compatible wallet not found');
    }
    
    try {
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);
      
      const expectedChainId = window.chainManager?.getCurrentConfig()?.id || 1;
      const currentChainName = window.chainManager?.getCurrentConfig()?.name || 'Ethereum';
      
      if (chainId !== expectedChainId) {
        throw new Error(`Please switch to ${currentChainName} (chain ID ${expectedChainId})`);
      }
      
      return true;
    } catch (error) {
      console.warn('Mainnet check failed:', error);
      throw error;
    }
  },

  // Estimate gas with buffer
  async estimateGasWithBuffer(contract, method, params, options = {}) {
    const bufferMultiplier = options.bufferMultiplier || 1.2;
    
    try {
      const estimatedGas = await method.estimateGas(params);
      return Math.ceil(estimatedGas * bufferMultiplier);
    } catch (error) {
      console.warn('Gas estimation failed:', error);
      // Return a reasonable default
      return options.fallbackGas || 500000;
    }
  },

  // Wait for transaction confirmation
  async waitForTransaction(web3, txHash, maxWaitTime = 300000) { // 5 minutes
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const receipt = await web3.eth.getTransactionReceipt(txHash);
        if (receipt) {
          return receipt;
        }
      } catch (error) {
        console.warn('Error checking transaction:', error);
      }
      
      // Wait 3 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    throw new Error('Transaction confirmation timeout');
  },

  // Get transaction details
  async getTransactionDetails(web3, txHash) {
    try {
      const [tx, receipt] = await Promise.all([
        web3.eth.getTransaction(txHash),
        web3.eth.getTransactionReceipt(txHash)
      ]);
      
      return { transaction: tx, receipt };
    } catch (error) {
      console.warn('Failed to get transaction details:', error);
      return null;
    }
  },

  // Format wei to ether with precision
  formatWeiToEther(wei, precision = 4) {
    try {
      const ether = window.Web3.utils.fromWei(String(wei), 'ether');
      const number = parseFloat(ether);
      return number.toFixed(precision).replace(/\.?0+$/, '');
    } catch (error) {
      console.warn('Failed to format wei to ether:', error);
      return '0';
    }
  },

  // Convert ether to wei safely
  etherToWei(ether) {
    try {
      return window.Web3.utils.toWei(String(ether), 'ether');
    } catch (error) {
      console.warn('Failed to convert ether to wei:', error);
      return '0';
    }
  },

  // Get latest block with retry
  async getLatestBlock(web3) {
    return this.withRetry(web3, async () => {
      return await web3.eth.getBlockNumber();
    });
  },

  // Batch call multiple contract methods
  async batchCall(contract, calls) {
    const batch = new window.Web3.BatchRequest();
    const promises = [];
    
    calls.forEach(({ method, params, callback }) => {
      promises.push(new Promise((resolve, reject) => {
        const request = method(...params).call.request((error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(callback ? callback(result) : result);
          }
        });
        batch.add(request);
      }));
    });
    
    batch.execute();
    return Promise.all(promises);
  }
};

// Legacy global functions for backward compatibility
window.newWeb3 = () => web3Utils.createWeb3Instance();
window.rotateRpc = (web3) => web3Utils.rotateRPC(web3);
window.withRetry = (web3, label, fn) => web3Utils.withRetry(web3, fn);
window.getWorkingContract = (abi, address) => web3Utils.getWorkingContract(abi, address);
window.requireWalletMainnet = () => web3Utils.requireMainnet();

// New global functions for RPC health monitoring
window.getRPCHealthStatus = () => web3Utils.getRPCHealthStatus();
window.clearRPCBlacklist = () => web3Utils.clearBlacklist();
window.getAvailableRPCs = () => web3Utils.getAvailableRPCs();

// Testing functions (for debugging)
window.testRPCResilience = () => web3Utils.testRPCResilience();
window.simulateRPCFailures = (rpcUrls) => web3Utils.simulateRPCFailures(rpcUrls);

export default web3Utils;