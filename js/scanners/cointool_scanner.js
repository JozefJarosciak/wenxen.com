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
      'MOONBEAM': 'GLMR',
      'POLYGON': 'POL',
      'OPTIMISM': 'OPT'
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

  // Discover all mints by scanning transactions to the Cointool contract
  // This works regardless of which salt was used
  const discoveredMints = await scanEventsForMints(address, etherscanApiKey, forceRescan);

  if (discoveredMints.length === 0) {
    console.log(`[COINTOOL] No mints found for ${address}`);
    return;
  }

  // Initialize performance monitoring
  startPerformanceMonitoring(discoveredMints.length);

  // Initialize progress UI
  if (window.progressUI && window.progressUI.setStage) {
    window.progressUI.setStage(`Processing ${discoveredMints.length} discovered mints`, 0, discoveredMints.length);
  }

  const startTime = Date.now();
  const BATCH_SIZE = window.chainConfigUtils?.getCointoolBatchSize() || 50; // Larger batches since we already have the data
  const DELAY_BETWEEN_BATCHES = window.chainConfigUtils?.getCointoolBatchDelay() || 50;

  // Process discovered mints in batches
  for (let i = 0; i < discoveredMints.length; i += BATCH_SIZE) {
    const batchStart = Date.now();
    const batchEnd = Math.min(i + BATCH_SIZE, discoveredMints.length);
    const batch = discoveredMints.slice(i, batchEnd);

    // Update progress UI
    if (window.progressUI) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = i > 0 ? i / elapsed : 0;
      const remaining = discoveredMints.length - batchEnd;
      const eta = rate > 0 && remaining > 0 ? `${Math.ceil(remaining / rate)}s` : 'calculating...';

      if (window.progressUI.setStage) {
        window.progressUI.setStage(`Processing mints ${i + 1}-${batchEnd} of ${discoveredMints.length} (${rate.toFixed(1)}/s, ETA: ${eta})`, i, discoveredMints.length);
      }
    }

    // Process each mint in the batch
    for (let j = 0; j < batch.length; j++) {
      const mintInfo = batch[j];
      try {
        await processDiscoveredMint(address, mintInfo, postMintActions, forceRescan);

        // Yield to browser every 10 mints
        if (j % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      } catch (error) {
        console.warn(`[COINTOOL] Failed to process mint at proxy ${mintInfo.proxyAddress}:`, error.message);
      }
    }

    // Record batch performance
    recordBatchTime(batch.length, Date.now() - batchStart);

    // Small delay between batches
    if (batchEnd < discoveredMints.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  // Generate performance summary
  finishPerformanceMonitoring();
  console.log(`[COINTOOL] Scan completed successfully for ${address} - processed ${discoveredMints.length} mints`);
}

// Process a mint discovered from transaction scanning
async function processDiscoveredMint(address, mintInfo, postMintActions, forceRescan) {
  // Create a unique ID using proxy address (guaranteed unique per mint)
  const uniqueId = `${mintInfo.proxyAddress.toLowerCase()}-${address.toLowerCase()}`;

  // Check if already processed (unless force rescan)
  if (!forceRescan) {
    const existing = await getMintFromDB(uniqueId);
    if (existing) {
      // Skip if no new actions
      const existingActionCount = (existing.Actions || []).length;
      const saltKey = `proxy-${mintInfo.proxyAddress.toLowerCase()}`;
      const newActionCount = (postMintActions[saltKey] || []).length;

      if (newActionCount <= existingActionCount) {
        return null; // Already processed
      }
    }
  }

  // Get block timestamp if not available
  let timestamp = mintInfo.timestamp;
  if (!timestamp) {
    const block = await getBlockWithCache(mintInfo.blockNumber);
    timestamp = Number(block.timestamp);
  } else {
    timestamp = Number(timestamp);
  }

  // Calculate maturity
  const termDays = mintInfo.term;
  const maturityTimestamp = timestamp + (termDays * 86400);

  // Determine status
  let status = "Maturing";
  const now = Date.now() / 1000;
  if (maturityTimestamp <= now) {
    status = "Claimable";
  }

  // Check for actions (claims/remints)
  const saltKey = `proxy-${mintInfo.proxyAddress.toLowerCase()}`;
  const actions = postMintActions[saltKey] || [];
  if (actions.length > 0) {
    const lastAction = actions[actions.length - 1];
    if (lastAction.term == null || Number(lastAction.term) === 0) {
      status = "Claimed";
    }
  }

  // Format dates
  const mintDate = luxon.DateTime.fromSeconds(timestamp);
  const maturityDate = luxon.DateTime.fromSeconds(maturityTimestamp);

  // Create mint record
  const mintRecord = {
    ID: uniqueId,
    Mint_id_Start: mintInfo.proxyAddress, // Use proxy as identifier since mint IDs depend on salt
    TX_Hash: mintInfo.txHash,
    Salt: mintInfo.salt,
    Term: termDays,
    VMUs: 1, // Cointool batch mints are always 1 VMU per proxy
    Actions: actions,
    Status: status,
    Create_TS: timestamp,
    Mint_Date_Fmt: mintDate.toFormat('yyyy LLL dd HH:mm'),
    Maturity_Date_Fmt: maturityDate.toFormat('yyyy LLL dd HH:mm'),
    Maturity_TS: maturityTimestamp,
    Rank_Range: `${mintInfo.rank}-${mintInfo.rank}`, // Single rank per 1-VMU mint
    Address: address,
    SourceType: "Cointool",
    Est_XEN: 0,
    ProxyAddress: mintInfo.proxyAddress
  };

  // Save to database
  await saveMintToDB(mintRecord);
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

// Scan for Cointool mints by finding transactions where user called the Cointool contract
// This approach works regardless of which salt was used
async function scanEventsForMints(address, etherscanApiKey, forceRescan) {
  try {
    console.log(`[COINTOOL] Scanning transactions for ${address} mints`);

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
    const SAFETY_BUFFER_BLOCKS = 10000; // Larger buffer for transaction-based scanning
    const deploymentBlock = window.chainManager?.getXenDeploymentBlock() || 15704871;
    const safeStartBlock = forceRescan ? deploymentBlock : Math.max(lastTransactionBlock - SAFETY_BUFFER_BLOCKS, deploymentBlock);
    const fromBlock = safeStartBlock;

    console.log(`[COINTOOL] Transaction scanning from block ${fromBlock} to ${currentBlock} for ${address}`);

    if (fromBlock > currentBlock) {
      console.log(`[COINTOOL] No new blocks to scan for ${address}`);
      return [];
    }

    // Use Etherscan API to get all transactions from this address to the Cointool contract
    // Etherscan has a 10,000 result limit, so we need to paginate
    const chainId = window.chainManager?.getCurrentConfig()?.id || 1;

    let mintInfos = [];
    let highestBlockWithMint = lastTransactionBlock;
    let allCointoolTxs = [];
    let page = 1;
    const PAGE_SIZE = 10000;
    let hasMoreResults = true;

    console.log(`[COINTOOL] Starting paginated transaction scan for ${address}`);

    while (hasMoreResults) {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=${fromBlock}&endblock=${currentBlock}&page=${page}&offset=${PAGE_SIZE}&sort=asc&apikey=${etherscanApiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let data;
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        data = await response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.error(`[COINTOOL] Request timeout for ${address} page ${page}`);
          throw new Error('Request timeout');
        }
        throw error;
      }

      if (data.status === "1" && Array.isArray(data.result) && data.result.length > 0) {
        // Filter transactions that are calls to the Cointool contract
        const cointoolTxs = data.result.filter(tx =>
          tx.to && tx.to.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() &&
          tx.isError === "0" && // Only successful transactions
          tx.from.toLowerCase() === address.toLowerCase() // User initiated the tx
        );

        allCointoolTxs = allCointoolTxs.concat(cointoolTxs);
        console.log(`[COINTOOL] Page ${page}: Found ${cointoolTxs.length} Cointool txs (${data.result.length} total txs)`);

        // Check if there might be more results
        if (data.result.length < PAGE_SIZE) {
          hasMoreResults = false;
        } else {
          page++;
          // Rate limit: wait 200ms between pages
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } else {
        hasMoreResults = false;
        if (data.message && data.message !== "OK" && data.message !== "No transactions found") {
          console.warn(`[COINTOOL] API message on page ${page}: ${data.message}`);
        }
      }
    }

    console.log(`[COINTOOL] Total Cointool transactions found: ${allCointoolTxs.length}`);

    // For each transaction, fetch the receipt to get mint events
    let processedTxCount = 0;
    for (const tx of allCointoolTxs) {
      try {
        const receipt = await makeRpcCall(() => web3Instance.eth.getTransactionReceipt(tx.hash));

        // Find all mint events in this transaction
        const mintEvents = receipt.logs.filter(log =>
          log.topics && log.topics[0] === COINTOOL_EVENT_TOPIC
        );

        if (mintEvents.length > 0) {
          const blockNum = parseInt(tx.blockNumber);
          if (blockNum > highestBlockWithMint) {
            highestBlockWithMint = blockNum;
          }

          // Decode transaction input to get the salt used
          const methodSelector = tx.input.slice(0, 10);
          let salt = COINTOOL_SALT_BYTES; // Default

          try {
            const inputData = tx.input.slice(10);
            if (methodSelector === '0xb1ae2ed1') {
              // t(uint256, bytes, bytes)
              const decoded = web3Instance.eth.abi.decodeParameters(['uint256', 'bytes', 'bytes'], '0x' + inputData);
              salt = decoded[2];
            } else if (methodSelector === '0x9108e811' || methodSelector === '0xd21ba82f') {
              // t_(uint256[], bytes, bytes) or f(uint256[], bytes, bytes)
              const decoded = web3Instance.eth.abi.decodeParameters(['uint256[]', 'bytes', 'bytes'], '0x' + inputData);
              salt = decoded[2];
            }
          } catch (e) {
            console.warn(`[COINTOOL] Could not decode salt from tx ${tx.hash}:`, e.message);
          }

          // Add each mint event with its metadata
          for (const event of mintEvents) {
            const proxyAddress = '0x' + event.topics[1].slice(26);
            const decodedLog = web3Instance.eth.abi.decodeParameters(['uint256', 'uint256'], event.data);

            mintInfos.push({
              txHash: tx.hash,
              blockNumber: tx.blockNumber,
              timestamp: tx.timeStamp,
              proxyAddress: proxyAddress,
              term: Number(decodedLog[0]),
              rank: decodedLog[1],
              salt: salt,
              owner: address
            });
          }

          // Log progress every 10 transactions
          processedTxCount++;
          if (processedTxCount % 10 === 0) {
            console.log(`[COINTOOL] Processed ${processedTxCount}/${allCointoolTxs.length} txs, ${mintInfos.length} mints found`);
          }
        }
      } catch (e) {
        console.warn(`[COINTOOL] Error processing tx ${tx.hash}:`, e.message);
      }
    }

    // Update scan state
    await saveScanState(address, currentBlock, highestBlockWithMint);

    console.log(`[COINTOOL] Total mints discovered: ${mintInfos.length}`);
    return mintInfos;

  } catch (error) {
    console.error(`[COINTOOL] Error scanning transactions for ${address}:`, error);
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