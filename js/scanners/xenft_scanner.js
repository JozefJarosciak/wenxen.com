// === XENFT INTEGRATION (scan DB only) ===
// Uses a separate IndexedDB "DB_Xenft".
// Exposes: window.xenft = { openDB, getAll, scan, CONTRACT_ADDRESS }


// Fetch EndTorrent (bulkClaimMintReward) events for a user, with timestamps
async function fetchEndTorrentActions(w3, user, fromBlock) {
  const c = new w3.eth.Contract(window.xenftAbi, CONTRACT_ADDRESS);
  const evs = await c.getPastEvents("EndTorrent", {
    filter: { user },
    fromBlock: Number(fromBlock || 0),
    toBlock: "latest",
  });

  const actions = [];
  for (const ev of evs) {
    let ts = 0;
    try {
      const b = await w3.eth.getBlock(ev.blockNumber);
      ts = Number(b?.timestamp || 0);
    } catch {}
    actions.push({
      type: "bulkClaimMintReward",
      tokenId: String(ev.returnValues.tokenId),
      to: ev.returnValues.to,
      hash: ev.transactionHash,      // IMPORTANT: 'hash' is what the table expects
      timeStamp: ts,
      blockNumber: ev.blockNumber,
    });
  }
  return actions;
}


(function(){
  // Get chain-specific contract address
  const CONTRACT_ADDRESS = window.chainManager?.getContractAddress('XENFT_TORRENT') || 
    window.appConfig?.contracts?.XENFT_TORRENT || 
    "0x0a252663DBCc0b073063D6420a40319e438Cfa59";
  const DEFAULT_RPC = window.chainManager?.getCurrentConfig()?.rpcUrls?.default || 
    window.appConfig?.rpc?.DEFAULT_RPC || 
    "https://ethereum-rpc.publicnode.com";



  // --- helpers from user's code ---
  function formatLocalDate(date) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleString("en-US", options).replace(/\s[A-Z]{3,4}$/, "");
  }
  function formatUTCDate(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} ${String(date.getUTCHours()).padStart(2,'0')}:${String(date.getUTCMinutes()).padStart(2,'0')} UTC`;
  }
  function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  function decodeMintInfo(infoStr) {
    let info = BigInt(infoStr);
    const nftNames = ['Ruby', 'Opal', 'Topaz', 'Emerald', 'Aquamarine', 'Sapphire', 'Amethyst', 'Xenturion', 'Limited', 'Rare', 'Epic', 'Legendary', 'Exotic', 'Xunicorn'];
    const getMapping = (shift, bits) => Number((info >> BigInt(shift)) & ((BigInt(1) << BigInt(bits)) - BigInt(1)));
    let mappings = {
      term: getMapping(240, 16),
      maturityTs: getMapping(176, 64),
      rank: getMapping(48, 128),
      amp: getMapping(32, 16),
      eaa: getMapping(16, 16),
      nftClass: getMapping(8, 8) & 0x3F,
      redeemed: getMapping(0, 8)
    };
    mappings.apex = mappings.nftClass > 8;
    mappings.limited = mappings.nftClass === 8;
    mappings.collector = !mappings.apex && !mappings.limited;
    mappings.nftClass = mappings.limited ? "Limited" : (mappings.nftClass < nftNames.length ? nftNames[mappings.nftClass] : "Unknown");
    return mappings;
  }
  function extractTokenData(tokenUri) {
    if (tokenUri && tokenUri.startsWith("data:application/json;base64,")) {
      const base64Data = tokenUri.split(",")[1];
      try { return JSON.parse(atob(base64Data)); } catch { return {}; }
    }
    return {};
  }

  // --- INDEXEDDB ---
  function openDB() {
    return new Promise((resolve, reject) => {
      // Get chain-specific database name
      const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
      const chainPrefix = currentChain === 'BASE' ? 'BASE' : 'ETH';
      const dbName = `${chainPrefix}_DB_Xenft`;
      
      const request = indexedDB.open(dbName, 3);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("xenfts")) {
          db.createObjectStore("xenfts", { keyPath: "Xenft_id" });
        }
        if (!db.objectStoreNames.contains("scanState")) {
          db.createObjectStore("scanState", { keyPath: "address" });
        }
        if (!db.objectStoreNames.contains("processProgress")) {
          db.createObjectStore("processProgress", { keyPath: "address" });
        }
      };
      request.onsuccess = e => resolve(e.target.result);
      request.onerror = e => reject(e.target.error);
    });
  }
  function save(db, xenft) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("xenfts", "readwrite");
      tx.objectStore("xenfts").put(xenft).onsuccess = () => resolve();
      tx.onerror = e => reject(e);
    });
  }
  function getAll(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("xenfts", "readonly");
      tx.objectStore("xenfts").getAll().onsuccess = e => resolve(e.target.result || []);
      tx.onerror = e => reject(e);
    });
  }
  async function getByTokenId(db, tokenId) {
    const all = await getAll(db);
    return all.find(t => t.tokenId == tokenId || t.Xenft_id == tokenId);
  }

  // --- SCAN STATE MANAGEMENT ---
  async function getScanState(db, address) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction("scanState", "readonly");
        const store = tx.objectStore("scanState");
        const req = store.get(address.toLowerCase());
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror = e => reject(e.target.error);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function putScanState(db, address, lastTokenId, foundTokens) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("scanState", "readwrite");
      tx.objectStore("scanState").put({
        address: address.toLowerCase(),
        lastScannedTokenId: Number(lastTokenId) || 0,
        foundTokens: foundTokens || 0,
        updatedAt: Date.now(),
        searchCompleted: false
      }).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }

  async function markScanComplete(db, address, totalFound) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("scanState", "readwrite");
      tx.objectStore("scanState").put({
        address: address.toLowerCase(),
        lastScannedTokenId: 0,
        foundTokens: totalFound || 0,
        updatedAt: Date.now(),
        searchCompleted: true
      }).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }

  async function clearScanState(db, address) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("scanState", "readwrite");
      tx.objectStore("scanState").delete(address.toLowerCase()).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }

  // Process progress tracking for crash recovery
  async function getProcessProgress(db, address) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("processProgress", "readonly");
      tx.objectStore("processProgress").get(address.toLowerCase()).onsuccess = e => resolve(e.target.result || null);
      tx.onerror = e => reject(e.target.error);
    });
  }

  async function saveProcessProgress(db, address, lastProcessedTokenId, totalProcessed) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("processProgress", "readwrite");
      const progress = {
        address: address.toLowerCase(),
        lastProcessedTokenId: String(lastProcessedTokenId),
        totalProcessed: Number(totalProcessed) || 0,
        updatedAt: Date.now()
      };
      tx.objectStore("processProgress").put(progress).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }

  async function clearProcessProgress(db, address) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("processProgress", "readwrite");
      tx.objectStore("processProgress").delete(address.toLowerCase()).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }

  // --- LOG SCAN (bulkClaimMintReward -> EndTorrent) ---
  async function fetchEndTorrentActions(w3OrRpcList, addr, fromBlock) {
    // If we get an array, try each RPC until one works
    if (Array.isArray(w3OrRpcList)) {
      for (const rpc of w3OrRpcList) {
        try {
          const w3 = new window.Web3(rpc);
          const result = await fetchEndTorrentActionsWithW3(w3, addr, fromBlock, rpc);
          if (result !== null) return result;
        } catch (e) {
          console.log(`RPC ${rpc} failed for events, trying next...`);
        }
      }
      console.log('No RPC could fetch EndTorrent events. Events not critical for display.');
      return [];
    } else {
      // Single web3 instance
      return fetchEndTorrentActionsWithW3(w3OrRpcList, addr, fromBlock, 'current');
    }
  }
  
  async function fetchEndTorrentActionsWithW3(w3, addr, fromBlock, rpcName) {
    const c = new w3.eth.Contract(window.xenftAbi, CONTRACT_ADDRESS);
    let latest;
    try {
      latest = await w3.eth.getBlockNumber();
    } catch (e) {
      console.log(`RPC ${rpcName} can't get block number`);
      return null;
    }
    
    const start = Math.max(0, Number(fromBlock || 0));
    let events = [];
    
    try {
      // Skip if range too large
      if (latest - start > 1000000) {
        console.log('Range too large for EndTorrent events, skipping.');
        return [];
      }
      
      // Try reasonable chunk size first
      let CHUNK_SIZE = 50000;
      let currentBlock = start;
      let failedChunks = 0;
      
      while (currentBlock < latest && failedChunks < 2) {
        const toBlock = Math.min(currentBlock + CHUNK_SIZE - 1, latest);
        
        try {
          const chunkEvents = await c.getPastEvents("EndTorrent", {
            filter: { user: addr },
            fromBlock: currentBlock,
            toBlock: toBlock
          });
          events.push(...chunkEvents);
          failedChunks = 0; // Reset on success
        } catch (chunkError) {
          // If it's a range limit error, try smaller chunks
          if (chunkError.message && (chunkError.message.includes('413') || chunkError.message.includes('range'))) {
            if (CHUNK_SIZE > 100) {
              CHUNK_SIZE = Math.floor(CHUNK_SIZE / 10); // Reduce chunk size
              console.log(`Reducing chunk size to ${CHUNK_SIZE} blocks`);
              continue; // Retry same range with smaller chunk
            }
          }
          failedChunks++;
          console.log(`RPC ${rpcName} failed chunk ${currentBlock}-${toBlock}`);
          
          // This RPC doesn't work well, signal to try another
          if (failedChunks >= 2) {
            return null;
          }
        }
        
        currentBlock = toBlock + 1;
      }
      
      console.log(`RPC ${rpcName} fetched ${events.length} EndTorrent events`);
    } catch (e) {
      console.log(`RPC ${rpcName} doesn't support getPastEvents`);
      return null;
    }
    
    // Decorate with block timestamps and normalized action objects
    const actions = [];
    for (const ev of events) {
      let ts = 0;
      try { const b = await w3.eth.getBlock(ev.blockNumber); ts = Number(b.timestamp) || 0; } catch {}
      const tokenId = String(ev?.returnValues?.tokenId ?? "");
      const to = String(ev?.returnValues?.to ?? "");
      actions.push({
        type: "bulkClaimMintReward",
        tokenId: tokenId,
        to: to,
        hash: ev?.transactionHash || "",
        timeStamp: ts,
        blockNumber: ev.blockNumber
      });
    }
    return actions;
  }

  // xenft_scanner.js — persistent RPC warning popup
  function ensureToastEl() {
    let el = document.getElementById("globalToast");
    if (el) return el;

    el = document.createElement("div");
    el.id = "globalToast";
    el.className = "toast";

    // Close button
    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.style.float = "right";
    btn.style.fontSize = "20px";
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.onclick = () => el.remove();

    el.appendChild(btn);

    const msgSpan = document.createElement("span");
    msgSpan.id = "globalToastMessage";
    el.appendChild(msgSpan);

    document.body.appendChild(el);
    return el;
  }

  function showPersistentToast(msg, kind = "error") {
    const el = ensureToastEl();
    const msgSpan = el.querySelector("#globalToastMessage");
    if (msgSpan) msgSpan.textContent = msg;
    el.classList.remove("success", "error");
    if (kind) el.classList.add(kind);
    el.classList.add("show");   // stays until user clicks ×
  }

  let __rpcWarnedOnce = false;
  function warnRpcIncompatible(rpc, detail) {
    if (__rpcWarnedOnce) return;
    __rpcWarnedOnce = true;

    const txt = `This RPC seems incompatible with XENFT scanning:\n${rpc}\n\n` +
      `It timed out / doesn't support required calls.\n` +
      `Open Settings → “Custom ETH RPCs” and remove it, or move a different RPC to the top.\n\n` +
      `Details: ${detail || "timeout"}`;

    try { showPersistentToast(txt, "error"); }
    catch { alert(txt); }
  }

  // --- RPC helper ---
  // xenft_scanner.js — getWorkingContract
  async function getWorkingContract(rpcList) {
    // Get chain-specific XENFT contract address dynamically
    const xenftAddress = window.chainManager?.getContractAddress('XENFT_TORRENT') || 
      window.appConfig?.contracts?.XENFT_TORRENT || 
      "0x0a252663DBCc0b073063D6420a40319e438Cfa59";
    
    for (let i = 0; i < rpcList.length; i++) {
      const rpc = rpcList[i].trim();
      if (!rpc) continue;
      try {
        const w3 = new Web3(rpc);
        await w3.eth.getChainId();
        // NEW: remember which RPC we're using for XENFT scanning
        window._activeXenftRpc = rpc;
        return new w3.eth.Contract(window.xenftAbi, xenftAddress);
      } catch {}
    }
    throw new Error("No working RPC endpoints found");
  }

  // --- Helper functions for scan state and progress tracking ---
  function cleanHexAddr(addr) {
    if (!addr || typeof addr !== 'string') return '';
    return addr.toLowerCase().replace(/^0x/i, '').padStart(40, '0');
  }

  function getScanState(db, address) {
    address = cleanHexAddr(address);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('scanState', 'readonly');
      tx.objectStore('scanState').get(address).onsuccess = e => resolve(e.target.result || null);
      tx.onerror = e => reject(e.target.error);
    });
  }

  function saveScanState(db, address, lastScannedBlock, lastTransactionBlock) {
    address = cleanHexAddr(address);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('scanState', 'readwrite');
      const store = tx.objectStore('scanState');

      // Get existing state to preserve lastTransactionBlock if not provided
      const getRequest = store.get(address);
      getRequest.onsuccess = () => {
        const existing = getRequest.result || {};
        const newState = {
          address,
          lastScannedBlock: Number(lastScannedBlock) || 0,
          lastTransactionBlock: lastTransactionBlock > 0 ? lastTransactionBlock : (existing.lastTransactionBlock || 0),
          lastScannedAt: Date.now()
        };
        store.put(newState).onsuccess = () => resolve();
      };
      getRequest.onerror = e => reject(e.target.error);
      tx.onerror = e => reject(e.target.error);
    });
  }

  function getProcessProgress(db, address) {
    address = cleanHexAddr(address);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('processProgress', 'readonly');
      tx.objectStore('processProgress').get(address).onsuccess = e => resolve(e.target.result || null);
      tx.onerror = e => reject(e.target.error);
    });
  }

  function saveProcessProgress(db, address, lastProcessedTxIndex, lastProcessedTxHash, totalProcessed) {
    address = cleanHexAddr(address);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('processProgress', 'readwrite');
      const progress = {
        address,
        lastProcessedTxIndex: Number(lastProcessedTxIndex) || 0,
        lastProcessedTxHash: String(lastProcessedTxHash || ""),
        totalProcessed: Number(totalProcessed) || 0,
        updatedAt: Date.now()
      };
      tx.objectStore('processProgress').put(progress).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }

  function clearProcessProgress(db, address) {
    address = cleanHexAddr(address);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('processProgress', 'readwrite');
      tx.objectStore('processProgress').delete(address).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }

  // --- Chunked XENFT transfer fetching with incremental scanning ---
  async function fetchXenftTransfersInRange(userAddress, apiKey, startBlock, endBlock) {
    const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
    const contractAddr = window.chainManager?.getContractAddress('XENFT_TORRENT') ||
      (currentChain === 'BASE' ? '0x379002701BF6f2862e3dFdd1f96d3C5E1BF450B6' : '0x0a252663DBCc0b073063D6420a40319e438Cfa59');
    const chainId = window.chainManager?.getCurrentConfig()?.id || (currentChain === 'BASE' ? 8453 : 1);

    // Use Etherscan V2 multichain API for all chains
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokennfttx&contractaddress=${contractAddr}&address=${userAddress}&startblock=${startBlock}&endblock=${endBlock}&page=1&offset=10000&sort=asc&apikey=${apiKey}`;

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const res = await fetch(url, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`Etherscan API returned status ${res.status}`);
        }

        const data = await res.json();

        // Handle common API responses
        if (data.status === "0") {
          if (data.message === "No transactions found") {
            return []; // Valid empty result
          }
          if (data.message.toLowerCase().includes('rate limit')) {
            throw new Error('RATE_LIMIT');
          }
          throw new Error(`API Error: ${data.message}`);
        }

        if (data.status === "1" && Array.isArray(data.result)) {
          console.debug(`[XENFT] Fetched ${data.result.length} transfers for blocks ${startBlock}-${endBlock}`);
          return data.result;
        }

        throw new Error(`Unexpected API response: ${JSON.stringify(data)}`);

      } catch (error) {
        console.warn(`[XENFT] Attempt ${attempt} failed for ${userAddress} blocks ${startBlock}-${endBlock}:`, error.message);

        if (attempt === MAX_ATTEMPTS) {
          throw error; // Last attempt, re-throw
        }

        // Handle rate limits with exponential backoff
        if (error.message.includes('RATE_LIMIT') || error.message.includes('rate limit')) {
          const backoffTime = Math.min(5000, 1000 * Math.pow(2, attempt));
          console.log(`[XENFT] Rate limit hit, backing off for ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        } else {
          // Regular backoff for other errors
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  // --- Improved XENFT scanning using chunked incremental approach ---
  async function scanEventBased(addr, etherscanApiKey, forceRescan = false) {
    const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
    console.log(`🚀 XENFT Scanner - Using chunked incremental scanning for ${currentChain} address ${addr}`);

    const db = await openDB();
    const CHUNK_SIZE = 50000; // Process 50k blocks at a time
    const SAFETY_BUFFER_BLOCKS = 100; // Safety buffer for incremental scanning

    try {
      // Clear progress on force rescan
      if (forceRescan) {
        await saveScanState(db, addr, 0, 0);
        await clearProcessProgress(db, addr);
        console.log(`[XENFT] Force rescan enabled - cleared progress for ${addr}`);
      }

      // Get scan state for incremental scanning
      const scanState = await getScanState(db, addr);
      const lastTransactionBlock = scanState?.lastTransactionBlock || 0;

      // Use safety buffer approach: always rescan from before last transaction
      const safeStartBlock = lastTransactionBlock > 0
        ? Math.max(lastTransactionBlock - SAFETY_BUFFER_BLOCKS, 15700000) // XENFT deployment block
        : 15700000; // XENFT deployment block

      // Get current block using Web3 directly
      const rpcEndpoints = window.chainManager?.getRPCEndpoints() || [DEFAULT_RPC];
      let currentBlock;

      // Try to get current block from any working RPC
      for (const rpc of rpcEndpoints) {
        try {
          const w3 = new Web3(rpc);
          currentBlock = await w3.eth.getBlockNumber();
          break;
        } catch (e) {
          console.warn(`[XENFT] Failed to get block number from ${rpc}:`, e.message);
          continue;
        }
      }

      if (!currentBlock) {
        throw new Error('Failed to get current block number from any RPC endpoint');
      }

      if (safeStartBlock > currentBlock) {
        if (window.progressUI) {
          window.progressUI.setStage(`No new blocks to scan for ${addr}`, 1, 1);
        }
        return [];
      }

      // Get process progress for crash recovery
      const processProgress = forceRescan ? null : await getProcessProgress(db, addr);
      let allTransfers = [];
      let totalProcessed = processProgress?.totalProcessed || 0;
      let lastProcessedTxHash = processProgress?.lastProcessedTxHash || "";

      // Process in chunks
      const totalChunks = Math.ceil((currentBlock - safeStartBlock + 1) / CHUNK_SIZE);
      let chunkIndex = 0;

      // Initialize progress UI
      if (window.progressUI) {
        window.progressUI.setStage(`Starting chunked scan: ${totalChunks} chunks to process`, 0, totalChunks);
      }

      for (let blockStart = safeStartBlock; blockStart <= currentBlock; blockStart += CHUNK_SIZE) {
        const blockEnd = Math.min(blockStart + CHUNK_SIZE - 1, currentBlock);
        chunkIndex++;

        // Update progress UI
        const progressPercent = Math.round((chunkIndex / totalChunks) * 100);
        if (window.progressUI) {
          window.progressUI.setStage(`Scanning blocks ${blockStart}-${blockEnd} (chunk ${chunkIndex}/${totalChunks})`, chunkIndex, totalChunks);
        }

        try {
          const chunkTransfers = await fetchXenftTransfersInRange(addr, etherscanApiKey, blockStart, blockEnd);

          if (chunkTransfers && chunkTransfers.length > 0) {
            allTransfers.push(...chunkTransfers);

            // Save progress after each chunk
            const lastTx = chunkTransfers[chunkTransfers.length - 1];
            await saveProcessProgress(db, addr, chunkIndex, lastTx.hash, totalProcessed + chunkTransfers.length);

            // Update progress with transfer count
            if (window.progressUI) {
              window.progressUI.setStage(`Found ${allTransfers.length} transfers so far (chunk ${chunkIndex}/${totalChunks})`, chunkIndex, totalChunks);
            }
          }

          // Update scan state with the highest block processed
          await saveScanState(db, addr, blockEnd, Math.max(lastTransactionBlock, blockEnd));

          // Rate limiting between chunks
          if (blockEnd < currentBlock) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

        } catch (error) {
          // Continue with next chunk on non-fatal errors
          if (!error.message.includes('timeout') && !error.message.includes('network')) {
            continue;
          }
          throw error; // Re-throw fatal errors
        }
      }

      // Process transfers to find currently owned tokens
      const ownedTokens = new Set();

      if (window.progressUI) {
        window.progressUI.setStage(`Processing ${allTransfers.length} transfers to determine ownership`, totalChunks, totalChunks);
      }

      // Process transfers chronologically to track ownership
      for (const transfer of allTransfers) {
        const tokenId = transfer.tokenID;
        const fromAddr = transfer.from.toLowerCase();
        const toAddr = transfer.to.toLowerCase();
        const userAddr = addr.toLowerCase();

        if (toAddr === userAddr) {
          // Token transferred TO user (mint or receive)
          ownedTokens.add(tokenId);
        } else if (fromAddr === userAddr) {
          // Token transferred FROM user (sent away)
          ownedTokens.delete(tokenId);
        }
      }

      const tokenIds = Array.from(ownedTokens);
      console.log(`🎉 XENFT Scanner - Incremental scan complete: ${tokenIds.length} tokens owned by ${addr} on ${currentChain}: [${tokenIds.join(', ')}]`);

      // Clear process progress on successful completion
      await clearProcessProgress(db, addr);

      return tokenIds.sort((a, b) => Number(a) - Number(b));

    } catch (error) {
      console.error(`XENFT Scanner - Chunked scanning failed for ${addr} on ${currentChain}:`, error);
      return null; // Signal fallback needed
    }
  }

  // --- public scan() ---
  async function scan() {
    
    // Show shared progress UI
    if (window.progressUI) { window.progressUI.show(true); window.progressUI.setType('XENFTs'); }
    const addressProgressText = document.getElementById("addressProgressText");

    // Uses same inputs UI as Cointool settings
    const addressInput = (document.getElementById("ethAddress")?.value || "").trim();
    if (!addressInput) { alert("Enter at least one Ethereum address (Settings)."); return; }

    const rpcInput = (document.getElementById("customRPC")?.value || DEFAULT_RPC).trim();
    const rpcEndpoints = rpcInput.split("\n").map(s=>s.trim()).filter(Boolean);
    if (rpcEndpoints.length === 0) { alert("Enter at least one RPC endpoint."); return; }

    const addresses = addressInput.split("\n").map(s=>s.trim()).filter(Boolean);

    let contract;
    try { contract = await getWorkingContract(rpcEndpoints); }
    catch { alert("Could not connect to any RPC."); return; }

    const db = await openDB();
    const progress = document.getElementById("tokenProgressBar");
    const tokenProgressText = document.getElementById("tokenProgressText");
    if (progress) { progress.value = 0; progress.max = 100; }

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      if (window.progressUI) window.progressUI.setAddress(i+1, addresses.length, addr);
      let tokenIds = [];
      // xenft_scanner.js — inside scan(), where tokenIds are fetched per address
      try {
        // Debug logging
        const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
        const contractAddress = contract.options.address;
        console.log(`XENFT Scanner - Chain: ${currentChain}, Contract: ${contractAddress}, Address: ${addr}`);
        
        // Use unified fast event-based scanning for all chains
        const etherscanApiKey = document.getElementById('etherscanApiKey')?.value?.trim();
        if (!etherscanApiKey) {
          console.error(`XENFT Scanner - Etherscan API key required for ${currentChain} scanning`);
          alert(`Please add an Etherscan API key in Settings to scan ${currentChain} XENFTs`);
          continue;
        }

        if (window.progressUI) {
          window.progressUI.setStage(`Using fast ${currentChain} XENFT scanning...`, 1, 1);
        }

        // Use fast event-based scanning for all chains
        try {
          console.log('XENFT Scanner - Calling unified event-based scanner...');
          const forceRescan = document.getElementById('forceRescan')?.checked || false;
          const eventTokenIds = await scanEventBased(addr, etherscanApiKey, forceRescan);
          if (eventTokenIds !== null) {
            tokenIds = eventTokenIds;
            console.log(`XENFT Scanner - Event-based scan found ${tokenIds.length} tokens for ${addr} on ${currentChain}`);
          } else {
            console.log('XENFT Scanner - Event-based scan returned null, skipping address');
            continue;
          }
        } catch (eventScanError) {
          console.error('XENFT Scanner - Event-based scan threw error:', eventScanError);
          continue;
        }

        // Event-based scanning is now complete for all chains, proceed to token processing
      } catch (e) {
        const msg = (e && (e.message || String(e))) || "";
        // Detect HTTP 408 or EVM timeout shapes
        if (/408|request timeout|evm timeout|timeout/i.test(msg)) {
          const rpc = window._activeXenftRpc || (Array.isArray(rpcEndpoints) ? rpcEndpoints[0] : "");
          warnRpcIncompatible(rpc, msg);
        }
        console.warn("Token fetch failed for", addr, e);
        continue;
      }

      if (progress) { progress.max = tokenIds.length || 100; progress.value = 0; }

      // Get process progress for crash recovery
      let processProgress = null;
      const forceRescan = !!document.getElementById('forceRescan')?.checked;
      if (!forceRescan) {
        processProgress = await getProcessProgress(db, addr);
      } else {
        await clearProcessProgress(db, addr);
        console.log(`[XENFT] Force rescan enabled - cleared process progress for ${addr}`);
      }

      let startFromIndex = 0;
      if (processProgress && processProgress.lastProcessedTokenId) {
        const resumeIndex = tokenIds.findIndex(id => String(id) === String(processProgress.lastProcessedTokenId));
        if (resumeIndex !== -1) {
          startFromIndex = resumeIndex + 1; // Start after the last processed token
          console.log(`[XENFT] Resuming from token ${startFromIndex}/${tokenIds.length} (ID: ${processProgress.lastProcessedTokenId})`);
        }
      }

      const tokensToProcess = tokenIds.slice(startFromIndex);
      let processed = startFromIndex;
      let _startedAt = Date.now();
      let _lastUi = 0;
      for (const tokenId of tokensToProcess) {
        try {
          const existing = await getByTokenId(db, tokenId);

          const now = Math.floor(Date.now() / 1000);
          let maturityTs = 0;
          if (existing) {
            if ('Maturity_Timestamp' in existing) {
              maturityTs = Number(existing.Maturity_Timestamp || 0);
            } else if ('maturityTs' in existing) {
              maturityTs = Number(existing.maturityTs || 0);
            }
          }

          const isRedeemed = existing ? Number(existing.redeemed || 0) === 1 : false;
          const isFutureMaturing = existing ? (maturityTs > now) : false;

// Skip already-known future or redeemed XENFTs
          if (existing && (isRedeemed || isFutureMaturing)) {
            continue;
          }


          // --- After tokens: scan EndTorrent logs once for this owner and merge into entries
          try {
            let startBlock = 0;
            try { startBlock = Number(await contract.methods.startBlockNumber().call()); } catch {}

            // Try all RPCs for event fetching
            const actions = await fetchEndTorrentActions(rpcEndpoints, addr, startBlock);
            if (actions.length) {
              const byToken = actions.reduce((acc, a) => {
                (acc[String(a.tokenId)] ||= []).push(a);
                return acc;
              }, {});

              const rows = await getAll(db);
              for (const row of rows) {
                if ((row.owner || "").toLowerCase() !== addr.toLowerCase()) continue;
                const tid = String(row.Xenft_id || row.tokenId || "");
                const acts = byToken[tid] || [];
                if (acts.length) {
                  row.actions = (row.actions || []).concat(acts);
                  row.latestActionTimestamp = Math.max(
                    ...row.actions.map(x => Number(x.timeStamp || 0))
                  );
                  await save(db, row);
                }
              }
            }
          } catch (e) {
            console.warn("EndTorrent scan failed:", e);
          }
// Occasionally refresh near maturity
          let refresh = true;
          if (existing) {
            const now = Math.floor(Date.now() / 1000);
            const isRedeemed = Number(existing.redeemed || 0) === 1;
            const isMaturingFuture = Number(existing.maturityTs || 0) > now;
            refresh = !(isRedeemed || isMaturingFuture);
          }
          if (!refresh) { continue; }

          let detail = null;
          
          // Get the correct contract address for the current chain
          const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
          const xenftContractAddress = window.chainManager?.getContractAddress('XENFT_TORRENT') || CONTRACT_ADDRESS;
          console.log(`XENFT Scanner - Processing token ${tokenId} with contract ${xenftContractAddress}`);
          
          for (const rpc of rpcEndpoints) {
            try {
              const w3 = new Web3(rpc);
              const c  = new w3.eth.Contract(window.xenftAbi, xenftContractAddress);
              
              // First check if token exists by checking vmuCount (like Python code)
              let vmuCount = 0;
              try {
                console.log(`XENFT Scanner - Checking vmuCount for token ${tokenId} on ${rpc}`);
                vmuCount = await c.methods.vmuCount(tokenId).call();
                console.log(`XENFT Scanner - Token ${tokenId} has vmuCount: ${vmuCount}`);
              } catch (e) {
                console.log(`Token ${tokenId} vmuCount check failed: ${e.message}`);
                break; // Token doesn't exist, no point trying other RPCs
              }
              
              // Only process if vmuCount > 0 (token exists)
              if (Number(vmuCount) === 0) {
                console.log(`Token ${tokenId} has vmuCount of 0, skipping`);
                break;
              }
              
              const tokenUri = await c.methods.tokenURI(tokenId).call();
              const tokenData = extractTokenData(tokenUri);
              const xenftId = tokenData.name ? tokenData.name.split('#').pop().trim() : tokenId;
              
              // Use tokenId directly for mintInfo, like in Python code
              const mintInfoRaw = await c.methods.mintInfo(tokenId).call();
              const mintInfo = decodeMintInfo(mintInfoRaw);
              const maturityDate = new Date(mintInfo.maturityTs * 1000);
              const localMaturity = (typeof luxon !== "undefined"
                ? luxon.DateTime.fromJSDate(maturityDate).toFormat('yyyy LLL dd, hh:mm a') // two-digit hour
                : formatLocalDate(maturityDate));
              const utcMaturity   = formatUTCDate(maturityDate);
              const maturityKey = (typeof luxon !== "undefined")
                ? luxon.DateTime.fromSeconds(mintInfo.maturityTs)
                  .setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
                  .toFormat("yyyy-LL-dd")
                : (function(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); })(new Date(mintInfo.maturityTs*1000));


              // Get xenBurned value like Python code
              let xenBurned = 0;
              try {
                xenBurned = await c.methods.xenBurned(tokenId).call();
              } catch (e) {
                console.log(`Failed to get xenBurned for token ${tokenId}`);
              }
              
              detail = {
                owner: addr,
                tokenId: tokenId,
                Xenft_id: xenftId,
                AMP: tokenData.attributes ? (tokenData.attributes.find(a => a.trait_type === "AMP")?.value || "") : "",
                Category: tokenData.attributes ? (tokenData.attributes.find(a => a.trait_type === "Category")?.value || "") : "",
                Class: tokenData.attributes ? (tokenData.attributes.find(a => a.trait_type === "Class")?.value || "") : "",
                "EAA (%)": tokenData.attributes ? (tokenData.attributes.find(a => a.trait_type === "EAA (%)")?.value || "") : "",
                "Maturity_Date_Fmt": localMaturity,
                "Maturity UTC": utcMaturity,
                Term: tokenData.attributes ? (tokenData.attributes.find(a => a.trait_type === "Term")?.value || "") : "",
                VMUs: vmuCount.toString(), // Use the actual vmuCount we fetched
                "XEN Burned": xenBurned.toString(),
                redeemed: mintInfo.redeemed,
                maturityDateOnly: maturityKey,
                Maturity_Timestamp: Number(mintInfo.maturityTs),
                amp: mintInfo.amp,
                apex: mintInfo.apex,
                cRank: tokenData.attributes ? (tokenData.attributes.find(a => a.trait_type === "cRank")?.value || "") : "",
                collector: mintInfo.collector,
                eaa: mintInfo.eaa,
                limited: mintInfo.limited,
                maturityTs: mintInfo.maturityTs,
                nftClass: mintInfo.nftClass,
                rank: mintInfo.rank,
                term: mintInfo.term,
                owner: addr
              };
              // Attach important flags/fields
              try { detail.owner = addr; } catch(_){}
              try { detail.redeemed = Number(mintInfo.redeemed)||0; } catch(_){}
              // default actions container
              if (!Array.isArray(detail.actions)) detail.actions = [];
              await save(db, detail);
              // Save progress after each token for crash recovery
              await saveProcessProgress(db, addr, tokenId, processed + 1);
              break;
            } catch {}
          }
          if (!detail) { console.warn("Could not fetch detail for token", tokenId); continue; }
        } catch (e) {
          console.warn("Failed token", tokenId, e);
        } finally {
          processed++;
          if (progress) progress.value = processed;
          const now = Date.now();
          if (now - _lastUi > 300) {
            if (window.progressUI) window.progressUI.setStage('Processing XENFTs', processed, tokenIds.length);
            const elapsed = (now - _startedAt) / 1000;
            const rate = processed / Math.max(1, elapsed);
            const remain = Math.max(0, tokenIds.length - processed);
            const eta = rate > 0 ? remain / rate : 0;
            if (window.progressUI) window.progressUI.setEta(eta);
            _lastUi = now;
          }
        }
      }
    }

    // Call unified refresh if present
    if (typeof window.refreshUnified === "function") {
      try { await window.refreshUnified(); } catch {}
    }

    // Clear process progress on successful completion
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      await clearProcessProgress(db, addr);
    }
    console.log(`[XENFT] Scan completed successfully for all addresses - cleared process progress`);

    tokenProgressText.textContent = "Address scanning complete.";
    setTimeout(() => {
      // Only hide the container if we are NOT part of a "Scan All" sequence.
      if (!window.__scanAllActive) {
        const at = document.getElementById("addressProgressText");
        const tt = document.getElementById("tokenProgressText");
        if (at) at.textContent = "";
        if (tt) tt.textContent = "";
        window.progressUI?.show(false);
      }
    }, 2000);

  }



  // Export
  window.xenft = {
    CONTRACT_ADDRESS,
    openDB,
    getAll,
    scan,
  };
  
  // Initialize fast scan setting on page load
  document.addEventListener('DOMContentLoaded', () => {
    const fastScanCheckbox = document.getElementById('useFastXenftScan');
    if (fastScanCheckbox) {
      // Load saved setting (default to true for fast scan)
      const savedSetting = localStorage.getItem('useFastXenftScan');
      if (savedSetting !== null) {
        fastScanCheckbox.checked = savedSetting === 'true';
      } else {
        fastScanCheckbox.checked = true; // Default to fast scan
      }
      
      // Save setting when changed
      fastScanCheckbox.addEventListener('change', () => {
        localStorage.setItem('useFastXenftScan', fastScanCheckbox.checked.toString());
      });
    }
  });
})();

