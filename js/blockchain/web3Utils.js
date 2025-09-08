// Web3 utilities - shared Web3 and RPC management functions
import { settingsStorage } from '../utils/storageUtils.js';

export const web3Utils = {
  // Default RPC endpoint
  DEFAULT_RPC: 'https://ethereum-rpc.publicnode.com',

  // Create new Web3 instance with RPC rotation support
  createWeb3Instance() {
    const rpcList = this.getRPCList();
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

  // Rotate to next RPC endpoint
  rotateRPC(web3) {
    if (!web3.__rpcList || !web3.__rpcList.length) return false;
    
    web3.__rpcIndex = (web3.__rpcIndex + 1) % web3.__rpcList.length;
    const nextRPC = web3.__rpcList[web3.__rpcIndex];
    
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
      return false;
    }
  },

  // Retry operation with RPC rotation
  async withRetry(web3, operation, maxRetries = null) {
    const maxAttempts = maxRetries || Math.max(6, (web3.__rpcList?.length || 4) * 2);
    let lastError;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt + 1} failed:`, error.message);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        
        // Rotate RPC for next attempt
        this.rotateRPC(web3);
      }
    }
    
    throw new Error(`Operation failed after ${maxAttempts} attempts: ${lastError?.message || lastError}`);
  },

  // Get working contract instance
  async getWorkingContract(abi, contractAddress) {
    const rpcList = this.getRPCList();
    
    for (let i = 0; i < rpcList.length; i++) {
      const rpc = rpcList[i].trim();
      if (!rpc) continue;
      
      try {
        const web3 = new window.Web3(rpc);
        await web3.eth.getChainId(); // Test connection
        
        // Remember which RPC we're using
        window._activeRpc = rpc;
        
        return new web3.eth.Contract(abi, contractAddress);
      } catch (error) {
        console.warn(`RPC ${rpc} failed:`, error.message);
        continue;
      }
    }
    
    throw new Error('No working RPC endpoints found');
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
      
      if (chainId !== 1) {
        throw new Error('Please switch to Ethereum Mainnet');
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

export default web3Utils;