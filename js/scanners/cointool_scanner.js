// Cointool scanner - handles Cointool mint scanning and analysis
// Wrapped in IIFE to avoid global variable conflicts with main_app.js

(function() {
  // Use centralized configuration (loaded globally via configuration.js module)  
  const COINTOOL_COINTOOL_CONTRACT_ADDRESS = window.appConfig?.contracts?.COINTOOL_SCANNER || '0x2Ab31426d94496B4C80C60A0e2E4E9B70EB32f18';
  const COINTOOL_SALT_BYTES = window.appConfig?.constants?.COINTOOL_SALT_BYTES || '0x29A2241A010000000000';
  const COINTOOL_COINTOOL_EVENT_TOPIC = window.appConfig?.events?.COINTOOL_MINT_TOPIC_SCANNER || '0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885';
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
      contractAddress: COINTOOL_COINTOOL_CONTRACT_ADDRESS
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
    const chainPrefix = currentChain === 'BASE' ? 'BASE' : 'ETH';
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
  contractInstance = new web3Instance.eth.Contract(window.cointoolAbi, COINTOOL_CONTRACT_ADDRESS);

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
  console.log(`[COINTOOL] Scanning mints for ${address}`);

  // Get or refresh post-mint actions
  const postMintActions = await fetchPostMintActions(address, etherscanApiKey, forceRescan);

  // Get max mint ID for this address
  const maxId = await makeRpcCall(() => 
    contractInstance.methods.map(address, COINTOOL_SALT_BYTES).call()
  );

  if (!maxId || maxId === '0') {
    console.log(`[COINTOOL] No mints found for ${address}`);
    return;
  }

  console.log(`[COINTOOL] Found ${maxId} potential mints for ${address}`);

  // Process each mint ID
  for (let mintId = 1; mintId <= maxId; mintId++) {
    await processMint(address, mintId, postMintActions, forceRescan);
  }
}

// Process a single mint
async function processMint(address, mintId, postMintActions, forceRescan) {
  const uniqueId = `${mintId}-${address.toLowerCase()}`;
  
  // Check if already processed (unless force rescan)
  if (!forceRescan) {
    const existing = await getMintFromDB(uniqueId);
    if (existing) {
      // Skip if no new actions
      const existingActionCount = (existing.Actions || []).length;
      const saltKey = `${mintId}-${normalizeSalt(existing.Salt)}`;
      const newActionCount = (postMintActions[saltKey] || []).length;
      
      if (newActionCount <= existingActionCount) {
        return; // Skip this mint
      }
    }
  }

  try {
    // Get mint details from blockchain
    const mintData = await fetchMintDetails(address, mintId, etherscanApiKey);
    if (!mintData) return;

    // Combine with post-mint actions
    const saltKey = `${mintId}-${normalizeSalt(mintData.salt)}`;
    const actions = postMintActions[saltKey] || [];
    
    // Create mint record
    const mintRecord = createMintRecord(uniqueId, address, mintId, mintData, actions);
    
    // Save to database
    await saveMintToDB(mintRecord);
    
    console.log(`[COINTOOL] Processed mint ${mintId} for ${address}`);
    
  } catch (error) {
    console.warn(`[COINTOOL] Failed to process mint ${mintId} for ${address}:`, error);
  }
}

// Fetch mint details from blockchain
async function fetchMintDetails(address, mintId, etherscanApiKey) {
  // Compute proxy address
  const proxyAddress = computeProxyAddress(mintId, COINTOOL_SALT_BYTES, address);
  
  // Get contract creation info from explorer API
  const explorerUrl = window.chainManager?.getCurrentConfig()?.explorer?.apiUrl || 'https://api.etherscan.io/api';
  const url = `${explorerUrl}?module=contract&action=getcontractcreation&contractaddresses=${proxyAddress}&apikey=${etherscanApiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Explorer API failed: ${response.status}`);
  
  const data = await response.json();
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

// Utility functions
function computeProxyAddress(mintId, salt, minter) {
  const constructorParams = web3Instance.eth.abi.encodeParameters(['address', 'uint256'], [minter, mintId]);
  const creationCode = COINTOOL_PROXY_CODE + constructorParams.slice(2);
  const saltBytes32 = web3Instance.utils.padLeft('0x' + normalizeSaltForHash(salt), 64);
  const creationCodeHash = web3Instance.utils.keccak256('0x' + creationCode);
  const concatenated = '0xff' + COINTOOL_CONTRACT_ADDRESS.slice(2) + saltBytes32.slice(2) + creationCodeHash.slice(2);
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
  if (!blockTsCache.has(blockNumber)) {
    const block = await makeRpcCall(() => web3Instance.eth.getBlock(blockNumber));
    blockTsCache.set(blockNumber, block);
  }
  return blockTsCache.get(blockNumber);
}

async function makeRpcCall(requestFn) {
  // Simple RPC call - could add rotation logic like other scanners
  try {
    return await requestFn();
  } catch (error) {
    console.error('[COINTOOL] RPC call failed:', error);
    throw error;
  }
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