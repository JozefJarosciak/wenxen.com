// Cointool scanner - handles Cointool mint scanning and analysis
// Wrapped in IIFE to avoid global variable conflicts with main_app.js

(function() {
  // Helper function to get chain prefix for database names
  function getChainPrefix(chain) {
    const prefixMap = {
      'ETHEREUM': 'ETH',
      'BASE': 'BASE',
      'AVALANCHE': 'AVAX',
      'BSC': 'BSC',
      'MOONBEAM': 'MOON',
      'POLYGON': 'MATIC',
      'OPTIMISM': 'OP'
    };
    return prefixMap[chain] || 'ETH';
  }

  // Get chain-specific contract address like other scanners
  const CONTRACT_ADDRESS = window.chainManager?.getContractAddress('COINTOOL') || 
    window.appConfig?.contracts?.COINTOOL || 
    "0x0dE8bf93dA2f7eecb3d9169422413A9bef4ef628"; // Ethereum fallback
  // Get chain-specific constants
  const COINTOOL_SALT_BYTES = window.chainManager?.getCurrentConfig()?.constants?.COINTOOL_SALT_BYTES || '0x29A2241A010000000000';
  const COINTOOL_EVENT_TOPIC = window.chainManager?.getCurrentConfig()?.events?.COINTOOL_MINT_TOPIC || '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37';
  const COINTOOL_PROXY_CODE = window.appConfig?.bytecode?.COINTOOL_COINTOOL_PROXY_CODE || '60806040523480156200001157600080fd5b5060405162000b5f38038062000b5f8339818101604052810190620000379190620001a3565b81600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600281905550620000936200009960201b60201c565b50620002ac565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663313ce5676040518163ffffffff1660e01b8152600401602060405180830381865afa15801562000108573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906200012e919062000214565b600060146101000a81548160ff021916908360ff1602179055565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006200017c8262000151565b9050919050565b6200018e816200016f565b81146200019a57600080fd5b50565b600081519050620001ae8162000183565b92915050565b6000819050919050565b620001c981620001b4565b8114620001d557600080fd5b50565b600081519050620001e981620001be565b92915050565b6000604082840312156200020857620002076200014c565b5b81019150620002188262000199565b92915050620002298262000209565b92915050620002388262000209565b92915050620002478262000209565b92915050620002568262000209565b92915050620002658262000209565b92915050620002748262000209565b92915050620002838262000209565b92915050620002928262000209565b92915050620002a18262000209565b92915050620002b08262000209565b92915050'; 

  // Local state for this scanner
  let web3Instance;
  let contractInstance; 
  let dbInstance;
  let progressUI;
  // Note: blockTsCache is shared globally (declared in main_app.js)
  let remintActionsCache = {};

  // Main scanner object
  const cointoolScanner = {
  // Scanner information
  getInfo() {
    return {
      name: 'Cointool',
      type: 'cointool',
      description: 'Scans for Cointool mints and post-mint actions',
      contractAddress: CONTRACT_ADDRESS
    };
  },

  // Main scan function
  async scan() {
    return await scanCointoolMints();
  },

  // Open database for this scanner
  async openDB() {
    return await openCointoolDB();
  }
};

// Database operations
async function openCointoolDB() {
  return new Promise((resolve, reject) => {
    // Get chain-specific database name
    const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
    const chainPrefix = getChainPrefix(currentChain);
    const dbName = `${chainPrefix}_DB_Cointool`;
    
    const request = indexedDB.open(dbName, 3);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("mints")) {
        db.createObjectStore("mints", { keyPath: "ID" });
      }
      if (!db.objectStoreNames.contains("scanState")) {
        db.createObjectStore("scanState", { keyPath: "address" });
      }
      if (!db.objectStoreNames.contains("actionsCache")) {
        db.createObjectStore("actionsCache", { keyPath: "address" });
      }
      if (!db.objectStoreNames.contains("mintProgress")) {
        db.createObjectStore("mintProgress", { keyPath: "address" });
      }
    };
    
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

// Main scanning function
async function scanCointoolMints() {
  // Get configuration from DOM elements like other scanners
  const addressInput = (document.getElementById("ethAddress")?.value || "").trim();
  const rpcInput = (document.getElementById("customRPC")?.value || "").trim();
  const etherscanApiKey = (document.getElementById("etherscanApiKey")?.value || "").trim();
  const forceRescan = !!document.getElementById('forceRescan')?.checked;

  if (!addressInput) {
    alert("Please enter at least one Ethereum address.");
    return;
  }
  if (!etherscanApiKey) {
    alert("Please enter an Etherscan API Key.");
    return;
  }

  const addresses = addressInput.split("\n").map(s => s.trim()).filter(Boolean);
  const rpcEndpoints = rpcInput.split("\n").map(s => s.trim()).filter(Boolean);

  // Create Web3 instance like other scanners
  web3Instance = newWeb3(rpcEndpoints[0] || null);
  const chainId = await web3Instance.eth.getChainId();

  // Create contract instance 
  contractInstance = new web3Instance.eth.Contract(window.cointoolAbi, CONTRACT_ADDRESS);

  // Open database
  dbInstance = await openCointoolDB();

  // Setup progress UI
  setupProgressUI('Cointool');

  console.log(`[COINTOOL] Starting scan for ${addresses.length} address(es)`);

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    updateProgress(i + 1, addresses.length, address);

    try {
      await scanAddressMints(address, etherscanApiKey, forceRescan);
    } catch (error) {
      console.error(`[COINTOOL] Failed to scan ${address}:`, error);
      // Continue with next address
    }
  }

  finishScan();
  console.log(`[COINTOOL] Scan completed for ${addresses.length} address(es)`);
}

// Scan mints for a specific address
async function scanAddressMints(address, etherscanApiKey, forceRescan) {
  // Get or refresh post-mint actions using event-based scanning
  const postMintActions = await fetchPostMintActions(address, etherscanApiKey, forceRescan);

  // First try to get latest mints via event-based scanning for better accuracy
  const eventBasedMints = await scanEventsForMints(address, etherscanApiKey, forceRescan);

  // Also get max mint ID for this address as fallback
  const maxId = await makeRpcCall(() =>
    contractInstance.methods.map(address, COINTOOL_SALT_BYTES).call()
  );

  // Use the higher of event-based count or contract maxId
  const totalMints = Math.max(eventBasedMints.length, parseInt(maxId) || 0);

  if (totalMints === 0) {
    return;
  }

  // Initialize performance monitoring
  startPerformanceMonitoring(totalMints);

  // Initialize progress UI
  if (window.progressUI) {
    if (window.progressUI.setStage) {
      window.progressUI.setStage(`Initializing Cointool scan for ${totalMints} potential mints`, 0, totalMints);
    }
  }

  // Process event-based mints first (most recent/accurate)
  if (eventBasedMints.length > 0) {
    if (window.progressUI && window.progressUI.setStage) {
      window.progressUI.setStage(`Found ${eventBasedMints.length} recent mint events`, 0, totalMints);
    }
  }

  // Process all mints by ID (covering both old and new)
  const maxIdToProcess = Math.max(totalMints, parseInt(maxId) || 0);

  // Get last processed mint ID for crash recovery
  let startFromMintId = 1;
  if (!forceRescan) {
    const mintProgress = await getMintProgress(address);
    if (mintProgress && mintProgress.lastProcessedMintId > 0) {
      startFromMintId = mintProgress.lastProcessedMintId + 1;
      if (window.progressUI && window.progressUI.setStage) {
        window.progressUI.setStage(`Resuming from mint ID ${startFromMintId}`, startFromMintId - 1, maxIdToProcess);
      }
    }
  } else {
    // Clear mint progress on force rescan
    await clearMintProgress(address);
    if (window.progressUI && window.progressUI.setStage) {
      window.progressUI.setStage(`Starting full rescan of ${maxIdToProcess} mints`, 0, maxIdToProcess);
    }
  }

  // Process mints in sequential batches to prevent browser crashes
  // Configurable batch sizes - smaller batches to prevent memory issues
  const BATCH_SIZE = window.chainConfigUtils?.getCointoolBatchSize() || 10; // Process 10 mints per batch (reduced from 15)
  const DELAY_BETWEEN_BATCHES = window.chainConfigUtils?.getCointoolBatchDelay() || 100; // 100ms minimum delay between batches

  const startTime = Date.now();

  for (let startId = startFromMintId; startId <= maxIdToProcess; startId += BATCH_SIZE) {
    const endId = Math.min(startId + BATCH_SIZE - 1, maxIdToProcess);
    const batchStart = Date.now();

    // Update progress UI at start of each batch
    const overallProgress = Math.floor(((startId - startFromMintId) / (maxIdToProcess - startFromMintId + 1)) * 100);
    if (window.progressUI) {
      const elapsed = (Date.now() - startTime) / 1000;
      const processed = startId - startFromMintId;
      const rate = processed > 0 ? processed / elapsed : 0;
      const remaining = maxIdToProcess - endId;
      const eta = rate > 0 && remaining > 0 ? `${Math.ceil(remaining / rate)}s` : 'calculating...';

      if (window.progressUI.setStage) {
        window.progressUI.setStage(`Processing mints ${startId}-${endId} (${rate.toFixed(1)}/s, ETA: ${eta})`, startId - startFromMintId, maxIdToProcess - startFromMintId + 1);
      } else if (window.progressUI.setProgress) {
        window.progressUI.setProgress(overallProgress, `Processing mints ${endId}/${maxIdToProcess} (${rate.toFixed(1)}/s, ETA: ${eta})`);
      }
    }

    // Process mints sequentially within batch to enable granular progress tracking
    for (let mintId = startId; mintId <= endId; mintId++) {
      try {
        await processMint(address, mintId, postMintActions, forceRescan);
        // Save progress after each mint to enable crash recovery
        await saveMintProgress(address, mintId);

        // Yield to browser every 5 mints to prevent UI freezing
        if ((mintId - startId) % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }

      } catch (error) {
        console.error(`[COINTOOL] Failed to process mint ${mintId} for ${address}:`, error);
        // Continue with next mint even if one fails
      }
    }

    // Record batch performance
    const batchDuration = Date.now() - batchStart;
    const actualBatchSize = endId - startId + 1;
    recordBatchTime(actualBatchSize, batchDuration);

    // Add small delay between batches to avoid overwhelming APIs and allow UI updates
    if (endId < maxIdToProcess) {
      await new Promise(resolve => setTimeout(resolve, Math.max(DELAY_BETWEEN_BATCHES, 100)));
    }

    // Force garbage collection hint (if available) after each batch to prevent memory buildup
    if (window.gc && typeof window.gc === 'function') {
      try {
        window.gc();
      } catch (e) {
        // gc() not available in this browser, that's fine
      }
    }
  }
  
  // Generate performance summary
  finishPerformanceMonitoring();

  // Clear mint progress on successful completion
  await clearMintProgress(address);
  console.log(`[COINTOOL] Scan completed successfully for ${address} - cleared mint progress`);
}

// Process a single mint
async function processMint(address, mintId, postMintActions, forceRescan) {
  const uniqueId = `${mintId}-${address.toLowerCase()}`;
  
  // Check if already processed (unless force rescan) - fast path optimization
  if (!forceRescan) {
    const existing = await getMintFromDB(uniqueId);
    if (existing) {
      // Skip if no new actions
      const existingActionCount = (existing.Actions || []).length;
      const saltKey = `${mintId}-${normalizeSalt(existing.Salt)}`;
      const newActionCount = (postMintActions[saltKey] || []).length;
      
      if (newActionCount <= existingActionCount) {
        return null; // Return null to indicate skipped
      }
    }
  }

  try {
    // Get mint details from blockchain
    const apiStart = Date.now();
    const mintData = await fetchMintDetails(address, mintId, etherscanApiKey);
    recordApiCallTime(Date.now() - apiStart);
    
    if (!mintData) return;

    // Combine with post-mint actions
    const saltKey = `${mintId}-${normalizeSalt(mintData.salt)}`;
    const actions = postMintActions[saltKey] || [];
    
    // Create mint record
    const mintRecord = createMintRecord(uniqueId, address, mintId, mintData, actions);
    
    // Save to database
    const dbStart = Date.now();
    await saveMintToDB(mintRecord);
    recordDbWriteTime(Date.now() - dbStart);
    
    console.log(`[COINTOOL] Processed mint ${mintId} for ${address}`);
    
  } catch (error) {
    console.warn(`[COINTOOL] Failed to process mint ${mintId} for ${address}:`, error);
  }
}

// Fetch mint details from blockchain
async function fetchMintDetails(address, mintId, etherscanApiKey) {
  // Compute proxy address
  const proxyAddress = computeProxyAddress(mintId, COINTOOL_SALT_BYTES, address);
  
  // Get contract creation info using Etherscan V2 multichain API
  const chainId = window.chainManager?.getCurrentConfig()?.id || 1;
  const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getcontractcreation&contractaddresses=${proxyAddress}&apikey=${etherscanApiKey}`;
  
  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for contract info

  let data;
  try {
    const response = await fetch(url, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Explorer API failed: ${response.status}`);
    }

    data = await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`[COINTOOL] Contract info request timeout`);
      return null; // Return null on timeout instead of throwing
    }
    throw error;
  }
  if (data.status !== "1" || !data.result || data.result.length === 0) {
    return null; // No creation found
  }

  const txHash = data.result[0].txHash;
  const blockNumber = data.result[0].blockNumber;

  // Get transaction details
  const tx = await makeRpcCall(() => web3Instance.eth.getTransaction(txHash));
  const receipt = await makeRpcCall(() => web3Instance.eth.getTransactionReceipt(txHash));
  const block = await getBlockWithCache(blockNumber);

  // Decode transaction data
  const inputData = tx.input.slice(10); // Remove '0x' and method selector
  const decodedParams = web3Instance.eth.abi.decodeParameters(['uint256', 'bytes', 'bytes'], inputData);
  
  const vmUs = decodedParams[0];
  const salt = decodedParams[2];

  // Find mint event in receipt
  const mintLog = receipt.logs.find(log => 
    log.topics[0] === COINTOOL_EVENT_TOPIC && 
    ('0x' + log.topics[1].slice(26)).toLowerCase() === proxyAddress.toLowerCase()
  );

  if (!mintLog) {
    throw new Error(`No mint log found for ${proxyAddress}`);
  }

  // Decode mint event data
  const decodedLog = web3Instance.eth.abi.decodeParameters(['uint256', 'uint256'], mintLog.data);
  const term = decodedLog[0];
  const baseRank = decodedLog[1];

  return {
    txHash,
    blockNumber,
    timestamp: Number(block.timestamp),
    vmUs: Number(vmUs),
    salt,
    term: Number(term),
    baseRank: BigInt(baseRank)
  };
}

// Create mint record object
function createMintRecord(uniqueId, address, mintId, mintData, actions) {
  const lastAction = actions.length > 0 ? actions[actions.length - 1] : null;
  const mintTimestamp = mintData.timestamp;
  const latestActionTimestamp = lastAction ? Number(lastAction.timeStamp) : mintTimestamp;
  
  let effectiveTermDays = Number(mintData.term);
  let maturityTimestamp = latestActionTimestamp + (effectiveTermDays * 86400);
  let status = "Maturing";
  
  // Handle ended stakes (term = 0 in last action)
  if (lastAction && (lastAction.term == null || Number(lastAction.term) === 0)) {
    maturityTimestamp = 0;
    status = "Claimed";
  } else if (actions.length > 0) {
    // Has actions, determine if claimed or extended
    status = "Claimed";
  } else {
    // Check if matured
    const now = Date.now() / 1000;
    if (maturityTimestamp <= now) {
      status = "Claimable";
    }
  }

  const effectiveRank = lastAction && lastAction.rank ? BigInt(lastAction.rank) : mintData.baseRank;
  const startRank = effectiveRank;
  const endRank = startRank + BigInt(mintData.vmUs) - 1n;
  
  const maturityDate = maturityTimestamp > 0 
    ? luxon.DateTime.fromSeconds(maturityTimestamp)
    : null;

  return {
    ID: uniqueId,
    Mint_id_Start: mintId,
    TX_Hash: mintData.txHash,
    Salt: mintData.salt,
    Term: effectiveTermDays,
    VMUs: mintData.vmUs,
    Actions: actions,
    Status: status,
    Create_TS: mintTimestamp,
    Mint_Date_Fmt: luxon.DateTime.fromSeconds(mintTimestamp).toFormat('yyyy LLL dd HH:mm'),
    Maturity_Date_Fmt: maturityDate ? maturityDate.toFormat('yyyy LLL dd HH:mm') : "Ended",
    Maturity_TS: maturityTimestamp,
    Rank_Range: `${startRank.toString()}-${endRank.toString()}`,
    Address: address,
    SourceType: "Cointool",
    Est_XEN: 0 // Will be calculated elsewhere
  };
}

// Database helper functions
async function getMintFromDB(uniqueId) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction("mints", "readonly");
    const store = tx.objectStore("mints");
    const request = store.get(uniqueId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveMintToDB(mintRecord) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction("mints", "readwrite");
    const store = tx.objectStore("mints");
    const request = store.put(mintRecord);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Batch save multiple mints for better performance
async function saveMintsBatchToDB(mintRecords) {
  if (!mintRecords.length) return;
  
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction("mints", "readwrite");
    const store = tx.objectStore("mints");
    let completed = 0;
    
    mintRecords.forEach(record => {
      const request = store.put(record);
      request.onsuccess = () => {
        completed++;
        if (completed === mintRecords.length) resolve();
      };
      request.onerror = () => reject(request.error);
    });
  });
}

// Utility functions
function computeProxyAddress(mintId, salt, minter) {
  const constructorParams = web3Instance.eth.abi.encodeParameters(['address', 'uint256'], [minter, mintId]);
  const creationCode = COINTOOL_PROXY_CODE + constructorParams.slice(2);
  const saltBytes32 = web3Instance.utils.padLeft('0x' + normalizeSaltForHash(salt), 64);
  const creationCodeHash = web3Instance.utils.keccak256('0x' + creationCode);
  const concatenated = '0xff' + CONTRACT_ADDRESS.slice(2) + saltBytes32.slice(2) + creationCodeHash.slice(2);
  const fullHash = web3Instance.utils.keccak256(concatenated);
  return '0x' + fullHash.slice(-40);
}

function normalizeSalt(salt) {
  return salt.startsWith('0x') ? salt.slice(2).toLowerCase() : salt.toLowerCase();
}

function normalizeSaltForHash(salt) {
  const normalized = normalizeSalt(salt);
  return normalized.length % 2 === 0 ? normalized : '0' + normalized;
}

async function getBlockWithCache(blockNumber) {
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  const chainCache = blockTsCache[currentChain] || blockTsCache.ETHEREUM;

  if (!chainCache.has(blockNumber)) {
    const block = await makeRpcCall(() => web3Instance.eth.getBlock(blockNumber));
    chainCache.set(blockNumber, block);
  }
  return chainCache.get(blockNumber);
}

// Rate limiting for API calls
let lastApiCall = 0;
const API_RATE_LIMIT_MS = 200; // 5 calls per second

async function makeRpcCall(requestFn) {
  // Add rate limiting
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < API_RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT_MS - timeSinceLastCall));
  }
  lastApiCall = Date.now();
  
  // Add retry logic
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.warn(`[COINTOOL] RPC call failed (attempt ${attempt}/3), retrying...`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
  }
  
  console.error('[COINTOOL] RPC call failed after 3 attempts:', lastError);
  throw lastError;
}

// Performance monitoring
let performanceStats = {
  startTime: null,
  processedMints: 0,
  totalMints: 0,
  batchTimes: [],
  apiCallTimes: [],
  dbWriteTimes: []
};

function startPerformanceMonitoring(totalMints) {
  performanceStats = {
    startTime: Date.now(),
    processedMints: 0,
    totalMints: totalMints,
    batchTimes: [],
    apiCallTimes: [],
    dbWriteTimes: []
  };
  
  console.log(`[COINTOOL] Performance monitoring started for ${totalMints} mints`);
  logPerformanceSettings();
}

function logPerformanceSettings() {
  const batchSize = window.chainConfigUtils?.getCointoolBatchSize() || 15;
  const batchDelay = window.chainConfigUtils?.getCointoolBatchDelay() || 50;
  const rateLimit = 200; // API_RATE_LIMIT_MS
  
  console.log(`[COINTOOL] Current Performance Settings:`);
  console.log(`  • Batch Size: ${batchSize} mints processed in parallel`);
  console.log(`  • Batch Delay: ${batchDelay}ms between batches`);
  console.log(`  • API Rate Limit: ${rateLimit}ms between RPC calls`);
  console.log(`  • Theoretical max rate: ${(1000/rateLimit).toFixed(1)} RPC calls/sec`);
  console.log(``);
  console.log(`[COINTOOL] To adjust performance settings, use:`);
  console.log(`  localStorage.setItem('cointoolBatchSize', '20'); // 10-50 recommended`);
  console.log(`  localStorage.setItem('cointoolBatchDelay', '100'); // 0-500ms`);
  console.log(``);
}

function recordBatchTime(batchSize, duration) {
  performanceStats.batchTimes.push({ batchSize, duration });
  performanceStats.processedMints += batchSize;
  
  // Calculate ETA and current performance
  const elapsed = Date.now() - performanceStats.startTime;
  const rate = performanceStats.processedMints / (elapsed / 1000);
  const remaining = performanceStats.totalMints - performanceStats.processedMints;
  const eta = remaining / rate;
  
  if (performanceStats.batchTimes.length % 10 === 0) { // Log every 10 batches
    console.log(`[COINTOOL] Progress: ${performanceStats.processedMints}/${performanceStats.totalMints} ` +
               `(${(performanceStats.processedMints/performanceStats.totalMints*100).toFixed(1)}%) ` +
               `Rate: ${rate.toFixed(1)} mints/sec ETA: ${formatDuration(eta)}`);
  }
}

function recordApiCallTime(duration) {
  performanceStats.apiCallTimes.push(duration);
}

function recordDbWriteTime(duration) {
  performanceStats.dbWriteTimes.push(duration);
}

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds/60)}m ${Math.round(seconds%60)}s`;
  return `${Math.round(seconds/3600)}h ${Math.round((seconds%3600)/60)}m`;
}

function finishPerformanceMonitoring() {
  const elapsed = Date.now() - performanceStats.startTime;
  const rate = performanceStats.processedMints / (elapsed / 1000);
  
  console.log(`[COINTOOL] === PERFORMANCE SUMMARY ===`);
  console.log(`  • Total Time: ${formatDuration(elapsed/1000)}`);
  console.log(`  • Mints Processed: ${performanceStats.processedMints}`);
  console.log(`  • Average Rate: ${rate.toFixed(2)} mints/sec`);
  
  if (performanceStats.batchTimes.length > 0) {
    const avgBatchTime = performanceStats.batchTimes.reduce((sum, b) => sum + b.duration, 0) / performanceStats.batchTimes.length;
    console.log(`  • Average Batch Time: ${(avgBatchTime/1000).toFixed(2)}s`);
  }
  
  if (performanceStats.apiCallTimes.length > 0) {
    const avgApiTime = performanceStats.apiCallTimes.reduce((sum, t) => sum + t, 0) / performanceStats.apiCallTimes.length;
    console.log(`  • Average API Call Time: ${avgApiTime.toFixed(0)}ms`);
  }
  
  console.log(`[COINTOOL] === TUNING RECOMMENDATIONS ===`);
  if (rate < 2) {
    console.log(`  ⚠️  Low performance detected (${rate.toFixed(1)} mints/sec)`);
    console.log(`  • Try increasing batch size: localStorage.setItem('cointoolBatchSize', '25')`);
    console.log(`  • Try reducing batch delay: localStorage.setItem('cointoolBatchDelay', '25')`);
  } else if (rate > 8) {
    console.log(`  ✅ Excellent performance (${rate.toFixed(1)} mints/sec)`);
    console.log(`  • Current settings are optimal for your network conditions`);
  } else {
    console.log(`  ✅ Good performance (${rate.toFixed(1)} mints/sec)`);
    console.log(`  • Performance is within normal range`);
  }
  
  const currentBatchSize = window.chainConfigUtils?.getCointoolBatchSize() || 15;
  if (performanceStats.apiCallTimes.some(t => t > 2000)) {
    console.log(`  • Network latency detected - consider reducing batch size to ${Math.max(5, currentBatchSize-5)}`);
  }
  
  console.log(``);
}

// Scan for Cointool mint events using block-based incremental scanning
async function scanEventsForMints(address, etherscanApiKey, forceRescan) {
  try {
    console.log(`[COINTOOL] Scanning events for ${address} mints`);

    // Get scan state for incremental scanning with safety buffer
    let lastScannedBlock = 0;
    let lastTransactionBlock = 0;
    if (!forceRescan) {
      const scanState = await getScanState(address);
      if (scanState) {
        lastScannedBlock = scanState.lastScannedBlock || 0;
        lastTransactionBlock = scanState.lastTransactionBlock || 0;
      }
    }

    // Get current block for scanning range
    const currentBlock = await web3Instance.eth.getBlockNumber();

    // Always rescan from safety buffer blocks before last known transaction to handle API lag
    // This ensures we never miss transactions that appear late in APIs
    const SAFETY_BUFFER_BLOCKS = 50; // Configurable safety margin
    const deploymentBlock = window.chainManager?.getXenDeploymentBlock() || 15704871;
    const safeStartBlock = Math.max(lastTransactionBlock - SAFETY_BUFFER_BLOCKS, deploymentBlock);
    const fromBlock = safeStartBlock;

    console.log(`[COINTOOL] Using safety buffer: lastTransaction=${lastTransactionBlock}, safeStart=${safeStartBlock}, buffer=${SAFETY_BUFFER_BLOCKS}`);

    console.log(`[COINTOOL] Event scanning from block ${fromBlock} to ${currentBlock} for ${address}`);

    if (fromBlock > currentBlock) {
      console.log(`[COINTOOL] No new blocks to scan for ${address}`);
      return [];
    }

    // Use Etherscan V2 multichain API like other scanners
    const chainId = window.chainManager?.getCurrentConfig()?.id || 1;
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=logs&action=getLogs&fromBlock=${fromBlock}&toBlock=${currentBlock}&address=${CONTRACT_ADDRESS}&topic0=${COINTOOL_EVENT_TOPIC}&apikey=${etherscanApiKey}`;

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let data;
    try {
      const response = await fetch(url, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      data = await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error(`[COINTOOL] Request timeout for ${address}`);
        throw new Error('Request timeout');
      }
      throw error;
    }

    let events = [];
    let lastBlockWithTransaction = lastScannedBlock; // Start with previous value

    if (data.status === "1" && Array.isArray(data.result)) {
      events = data.result.filter(event => {
        // Filter events for this specific address
        return event.topics && event.topics.length >= 2 &&
               event.topics[1] && event.topics[1].toLowerCase().includes(address.toLowerCase().replace('0x', ''));
      });

      console.log(`[COINTOOL] Found ${events.length} mint events for ${address}`);

      // Find the highest block number that actually contained transactions
      if (events.length > 0) {
        lastBlockWithTransaction = Math.max(...events.map(e => parseInt(e.blockNumber, 16)));
        console.log(`[COINTOOL] Last block with actual transactions: ${lastBlockWithTransaction}`);
      }
    } else {
      console.log(`[COINTOOL] No events found or API error:`, data.message || 'Unknown error');
    }

    // Always update scan progress, but handle transaction tracking carefully
    await saveScanState(address, currentBlock, lastBlockWithTransaction);

    if (lastBlockWithTransaction > lastTransactionBlock) {
      console.log(`[COINTOOL] Found new transactions up to block ${lastBlockWithTransaction} (${events.length} events)`);
    } else {
      console.log(`[COINTOOL] Scanned up to block ${currentBlock}, no new transactions found`);
    }

    return events;

  } catch (error) {
    console.error(`[COINTOOL] Error scanning events for ${address}:`, error);
    return [];
  }
}

// Get scan state for incremental scanning
async function getScanState(address) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(['scanState'], 'readonly');
    const store = transaction.objectStore('scanState');
    const request = store.get(address.toLowerCase());

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save scan state for incremental scanning
async function saveScanState(address, lastScannedBlock, lastTransactionBlock) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(['scanState'], 'readwrite');
    const store = transaction.objectStore('scanState');

    // Get existing state to preserve lastTransactionBlock if not provided
    const getRequest = store.get(address.toLowerCase());

    getRequest.onsuccess = () => {
      const existingState = getRequest.result || {};

      const newState = {
        address: address.toLowerCase(),
        lastScannedBlock: lastScannedBlock,
        lastTransactionBlock: lastTransactionBlock > 0 ? lastTransactionBlock : (existingState.lastTransactionBlock || 0),
        lastScannedAt: Date.now()
      };

      const putRequest = store.put(newState);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Mint progress tracking for crash recovery
async function getMintProgress(address) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(['mintProgress'], 'readonly');
    const store = transaction.objectStore('mintProgress');
    const request = store.get(address.toLowerCase());

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveMintProgress(address, lastProcessedMintId) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(['mintProgress'], 'readwrite');
    const store = transaction.objectStore('mintProgress');

    const progressState = {
      address: address.toLowerCase(),
      lastProcessedMintId: lastProcessedMintId,
      updatedAt: Date.now()
    };

    const request = store.put(progressState);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearMintProgress(address) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(['mintProgress'], 'readwrite');
    const store = transaction.objectStore('mintProgress');
    const request = store.delete(address.toLowerCase());

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Post-mint actions fetching (simplified version)
async function fetchPostMintActions(address, etherscanApiKey, forceRescan) {
  // This would implement the post-mint action scanning logic
  // For now, return empty object to keep the scanner functional
  console.log(`[COINTOOL] Fetching post-mint actions for ${address} (TODO: implement)`);
  return {};
}

// UI helper functions
function setupProgressUI(type) {
  if (window.progressUI) {
    window.progressUI.show(true);
    window.progressUI.setType(type);
  }
  progressUI = window.progressUI;
}

function updateProgress(current, total, address) {
  if (progressUI && progressUI.setAddress) {
    progressUI.setAddress(current, total, address);
  }
}

function finishScan() {
  setTimeout(() => {
    if (!window.__scanAllActive && document.getElementById("progressContainer")) {
      document.getElementById("progressContainer").style.display = "none";
    }
  }, 1000);
}

  // Make the scanner globally available (no ES6 export needed for regular scripts)
  window.cointool = cointoolScanner;

})(); // End of IIFE