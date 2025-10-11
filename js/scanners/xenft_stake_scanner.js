// === Stake XENFTs module (Etherscan-Optimized with Incremental Scanning) ===========================
// Scans the Stake XENFT contract and stores rows in IndexedDB.
// Exposes window.xenftStake = { CONTRACT_ADDRESS, openDB, getAll, scan }.
//
// Key behavior per user request:
//   • Uses incremental scanning (resume from last block) for speed.
//   • Tracks transfers between addresses to update ownership correctly.
//   • Ignore tokenURI.maturity for Stake XENFTs.
//   • Derive maturity strictly as: maturityTs = first_mint_tx.timestamp + term_days * 86400
//   • If a token is ended/claimed, append an action and set status "Claimed", but DO NOT clobber
//     original APY/term/maturity (preserve earlier non-zero values).
//   • Actions include endStake with txHash/timeStamp when available.

(function(){
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

  // Get chain-specific contract address
  const getContractAddress = () => {
    return window.chainManager?.getContractAddress('XENFT_STAKE') || 
           "0xfEdA03b91514D31b435d4E1519Fd9e699C29BbFC"; // Ethereum fallback
  };
  
  const CONTRACT_ADDRESS = getContractAddress();

  // Get chain-specific deployment block from chainManager
  const CONTRACT_CREATION_BLOCK = window.chainManager?.getXenftStakeDeploymentBlock() || 16339900;
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

  const DEFAULT_RPC = window.chainManager?.getCurrentConfig()?.rpcUrls?.default ||
    'https://ethereum-rpc.publicnode.com';

  // ABI moved to ./ABI/xenft-stake-ABI.js as window.xenftStakeAbi

  // --- small utils ---
  // cleanHexAddr function now provided by js/utils/stringUtils.js module

  function getAddressesFromSettings(){
    const text = (document.getElementById("ethAddress")?.value || localStorage.getItem("ethAddress") || "").trim();
    return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  }

  function getRpcList(){
    const ta = document.getElementById("customRPC");
    if (ta && ta.value.trim()) {
      return String(ta.value.trim()).split(/\s+|\n+/).map(s => s.trim()).filter(Boolean);
    }
    if (window.chainManager) {
      const rpcs = window.chainManager.getRPCEndpoints();
      return rpcs.length > 0 ? rpcs : [DEFAULT_RPC];
    }
    const raw = DEFAULT_RPC;
    return String(raw).split(/\s+|\n+/).map(s => s.trim()).filter(Boolean);
  }

  function newWeb3(){
    const rpcList = getRpcList();
    const provider = new window.Web3.providers.HttpProvider(rpcList[0]);
    const w3 = new window.Web3(provider);
    w3.__rpcList = rpcList;
    w3.__rpcIndex = 0;
    return w3;
  }
  function rotateRpc(w3){
    if (!w3.__rpcList || !w3.__rpcList.length) return;
    w3.__rpcIndex = (w3.__rpcIndex + 1) % w3.__rpcList.length;
    const next = w3.__rpcList[w3.__rpcIndex];
    try { w3.setProvider(new window.Web3.providers.HttpProvider(next)); } catch {}
    try { document.getElementById("rpcStatus") && (document.getElementById("rpcStatus").textContent = `via ${next}`); } catch {}
  }

  async function withRetry(w3, label, fn){
    const max = Math.max(6, (w3.__rpcList?.length || 4) * 2);
    let lastErr;
    for (let i=0;i<max;i++){
      try {
        return await fn();
      } catch(e) {
        lastErr = e;
        await new Promise(r=>setTimeout(r, 200));
        rotateRpc(w3);
      }
    }
    throw new Error(label + " failed across RPCs: " + (lastErr?.message || lastErr));
  }

  function findAttr(attrs, nameLike){
    if (!Array.isArray(attrs)) return null;
    const key = String(nameLike).toLowerCase();
    const hit = attrs.find(a => String(a?.trait_type||'').toLowerCase().includes(key));
    return hit || null;
  }

  function parseNumLoose(v){
    if (v == null || typeof v === 'object') return NaN;
    const s = String(v).replace(/[,_]/g, '').replace(/[^\d.\-]/g, '');
    return parseFloat(s);
  }

  function extractJsonFromDataUri(uri){
    try{
      if (typeof uri !== 'string') return {};
      if (uri.startsWith('data:application/json;base64,')) {
        const b64 = uri.split('base64,')[1] || '';
        const json = atob(b64);
        return JSON.parse(json);
      }
      if (uri.startsWith('data:application/json,')) {
        const raw = decodeURIComponent(uri.split('data:application/json,')[1] || '{}');
        return JSON.parse(raw);
      }
      if (uri.trim().startsWith('{')) return JSON.parse(uri);
    }catch(e){}
    return {};
  }

  // --- IndexedDB ---
  const STORE_STAKES = "stakes";
  const STORE_STATE = "scanState";

  function openDB(){
    return new Promise((resolve, reject) => {
      // Get chain-specific database name
      const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
      const chainPrefix = getChainPrefix(currentChain);
      const dbName = window.chainManager?.getDatabaseName('xenft_stake') || `${chainPrefix}_DB_XenftStake`;
      
      const req = indexedDB.open(dbName, 2);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_STAKES)) {
          db.createObjectStore(STORE_STAKES, { keyPath: "tokenId" });
        }
        if (!db.objectStoreNames.contains(STORE_STATE)) {
          db.createObjectStore(STORE_STATE, { keyPath: "address" });
        }
        if (!db.objectStoreNames.contains("processProgress")) {
          db.createObjectStore("processProgress", { keyPath: "address" });
        }
      };
      req.onsuccess = e => {
        const db = e.target.result;
        // Verify that the stakes store has the correct keyPath
        if (db.objectStoreNames.contains(STORE_STAKES)) {
          const transaction = db.transaction(STORE_STAKES, 'readonly');
          const store = transaction.objectStore(STORE_STAKES);
          if (store.keyPath !== 'tokenId') {
            console.warn(`[XENFT Stake] Database has wrong keyPath for stakes store: ${store.keyPath}, expected 'tokenId'. Recreating database...`);
            db.close();
            // Delete and recreate database with correct schema
            const deleteReq = indexedDB.deleteDatabase(dbName);
            deleteReq.onsuccess = () => {
              openDB().then(resolve).catch(reject);
            };
            deleteReq.onerror = () => reject(deleteReq.error);
            return;
          }
        }
        resolve(db);
      };
      req.onerror   = e => reject(e.target.error);
    });
  }
  function save(db, row){
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STAKES, "readwrite");
      tx.objectStore(STORE_STAKES).put(row).onsuccess = () => resolve();
      tx.onerror = e => reject(e);
    });
  }
  function getAll(db){
    return new Promise((resolve, reject) => {
      try {
        // Check if the store exists before creating transaction
        if (!db.objectStoreNames.contains(STORE_STAKES)) {
          console.error(`[XENFT Stake] Store '${STORE_STAKES}' not found in database. Available stores:`, Array.from(db.objectStoreNames));
          resolve([]); // Return empty array instead of failing
          return;
        }

        const tx = db.transaction(STORE_STAKES, "readonly");
        tx.objectStore(STORE_STAKES).getAll().onsuccess = e => resolve(e.target.result || []);
        tx.onerror = e => {
          console.error(`[XENFT Stake] Error reading from '${STORE_STAKES}' store:`, e);
          resolve([]); // Return empty array instead of failing
        };
      } catch (error) {
        console.error(`[XENFT Stake] Error accessing store '${STORE_STAKES}':`, error);
        resolve([]); // Return empty array instead of failing
      }
    });
  }
  function getByTokenId(db, tokenId){
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STAKES, "readonly");
      tx.objectStore(STORE_STAKES).get(String(tokenId)).onsuccess = e => resolve(e.target.result || null);
      tx.onerror = e => reject(e);
    });
  }

  // --- DB Scan State Helpers ---
  async function getScanState(db, address) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_STATE, "readonly");
        const store = tx.objectStore(STORE_STATE);
        const req = store.get(cleanHexAddr(address));
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror = e => reject(e.target.error);
      } catch (e) { resolve(null); }
    });
  }
  async function putScanState(db, address, lastScannedBlock) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, "readwrite");
      tx.objectStore(STORE_STATE).put({
        address: cleanHexAddr(address),
        lastScannedBlock: Number(lastScannedBlock) || 0,
        updatedAt: Date.now()
      }).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }
  async function clearScanState(db, address) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, "readwrite");
      tx.objectStore(STORE_STATE).delete(cleanHexAddr(address)).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }

  // Process progress tracking for crash recovery
  async function getProcessProgress(db, address) {
    return new Promise((resolve, reject) => {
      // Check if the processProgress object store exists before attempting transaction
      if (!db.objectStoreNames.contains("processProgress")) {
        console.warn("[XENFT Stake Scanner] processProgress object store not found, returning null progress");
        resolve(null);
        return;
      }

      try {
        const tx = db.transaction("processProgress", "readonly");
        tx.objectStore("processProgress").get(cleanHexAddr(address)).onsuccess = e => resolve(e.target.result || null);
        tx.onerror = e => reject(e.target.error);
      } catch (error) {
        console.warn("[XENFT Stake Scanner] Error getting process progress:", error);
        resolve(null); // Return null progress if unable to read
      }
    });
  }

  async function saveProcessProgress(db, address, lastProcessedTxIndex, lastProcessedTxHash, totalProcessed) {
    return new Promise((resolve, reject) => {
      // Check if the processProgress object store exists before attempting transaction
      if (!db.objectStoreNames.contains("processProgress")) {
        console.warn("[XENFT Stake Scanner] processProgress object store not found, skipping save operation");
        resolve();
        return;
      }

      try {
        const tx = db.transaction("processProgress", "readwrite");
        const progress = {
          address: cleanHexAddr(address),
          lastProcessedTxIndex: Number(lastProcessedTxIndex) || 0,
          lastProcessedTxHash: String(lastProcessedTxHash || ""),
          totalProcessed: Number(totalProcessed) || 0,
          updatedAt: Date.now()
        };
        tx.objectStore("processProgress").put(progress).onsuccess = () => resolve();
        tx.onerror = e => reject(e.target.error);
      } catch (error) {
        console.warn("[XENFT Stake Scanner] Error saving process progress:", error);
        resolve(); // Don't fail the entire scan if progress saving fails
      }
    });
  }

  async function clearProcessProgress(db, address) {
    return new Promise((resolve, reject) => {
      // Check if the processProgress object store exists before attempting transaction
      if (!db.objectStoreNames.contains("processProgress")) {
        console.warn("[XENFT Stake Scanner] processProgress object store not found, skipping clear operation");
        resolve();
        return;
      }

      try {
        const tx = db.transaction("processProgress", "readwrite");
        tx.objectStore("processProgress").delete(cleanHexAddr(address)).onsuccess = () => resolve();
        tx.onerror = e => reject(e.target.error);
      } catch (error) {
        console.warn("[XENFT Stake Scanner] Error clearing process progress:", error);
        resolve(); // Don't fail the entire scan if progress clearing fails
      }
    });
  }


  // --- Explorer helper: Fetch NFT transfers in a specific block range ---
  async function fetchStakeTxsInRange(userAddress, apiKey, startBlock, endBlock) {
    const contractAddr = getContractAddress(); // Get current chain's contract
    const chainId = window.chainManager?.getCurrentConfig()?.id || 1;
    
    // Use Etherscan V2 multichain API for all chains (including Base with chainId 8453)
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

        if (data.status === "1" && Array.isArray(data.result)) {
          return data.result; // SUCCESS: Got transactions
        }

        if (data.status === "0" && data.message && data.message.toLowerCase().includes('no transactions found')) {
          return []; // SUCCESS: No transactions in this range is a valid response
        }

        if (data.status === "0" && data.result && typeof data.result === 'string' && data.result.toLowerCase().includes('rate limit')) {
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 750 * attempt));
            continue;
          }
        }

        throw new Error(`Etherscan API Error: ${data.message || 'Unknown error'} - ${data.result}`);

      } catch (error) {
        console.error(`[StakeXENFT] Attempt ${attempt}/${MAX_ATTEMPTS} to fetch txs failed:`, error.message);
        if (attempt >= MAX_ATTEMPTS) {
          throw error;
        }
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
    return [];
  }


  // --- Main Scan Function ---
  async function scan(){
    const addresses = getAddressesFromSettings();
    const etherscanApiKey = document.getElementById("etherscanApiKey")?.value.trim();
    const forceRescan = document.getElementById('forceRescan')?.checked;

    if (!addresses.length) {
      alert("Add at least one address in Settings to scan Stake XENFTs.");
      return;
    }
    if (!etherscanApiKey) {
      alert("An Etherscan Multichain API Key is required for this fast scan method. Please add one in Settings.");
      return;
    }

    const w3 = newWeb3();
    const db = await openDB();
    const contractAddr = getContractAddress(); // Get current chain's contract
    const c  = new w3.eth.Contract(window.xenftStakeAbi, contractAddr);
    
    // Log current chain and contract for debugging
    const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
    console.log(`[XENFT Stake Scanner] Starting scan on ${currentChain} with contract ${contractAddr}`);

    const addrLbl = document.getElementById("addressProgressText");
    const tokenBar = document.getElementById("tokenProgressBar");
    const tokenTxt = document.getElementById("tokenProgressText");
    if (window.progressUI) { window.progressUI.show(true); window.progressUI.setType('Stake XENFTs'); }

    for (let aIndex = 0; aIndex < addresses.length; aIndex++){
      const addr = cleanHexAddr(addresses[aIndex]);
      try {
        // Fetch latest block for each address to ensure freshness
        const latestBlock = await withRetry(w3, `getBlockNumber for ${addr.slice(0,6)}`, () => w3.eth.getBlockNumber());

        if (addrLbl) addrLbl.textContent = `Scanning address ${aIndex+1} of ${addresses.length}: ${window.progressUI ? window.progressUI.shortAddr(addr) : addr.slice(0,6)+"…"+addr.slice(-4)}`;

        if (forceRescan) {
          await clearScanState(db, addr);
        }

        const scanState = await getScanState(db, addr);
        const creationBlock = CONTRACT_CREATION_BLOCK; // Get chain-specific creation block
        const startBlock = scanState ? scanState.lastScannedBlock + 1 : creationBlock;

        if (startBlock > latestBlock && !forceRescan) {
          if(tokenTxt) tokenTxt.textContent = `Stake XENFTs for ${addr.slice(0,6)}... are up to date.`;
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        const newTxs = await fetchStakeTxsInRange(addr, etherscanApiKey, startBlock, latestBlock);

        if (!newTxs.length) {
          await putScanState(db, addr, latestBlock);
          if(tokenTxt) tokenTxt.textContent = `No new Stake XENFT activity found for ${addr.slice(0,6)}...`;
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        if (tokenBar) { tokenBar.value = 0; tokenBar.max = Math.max(1, newTxs.length); }
        if (tokenTxt) tokenTxt.textContent = `Found ${newTxs.length} new transactions. Processing…`;

        // Get process progress for crash recovery
        let processProgress = null;
        let startFromIndex = 0;
        if (!forceRescan) {
          processProgress = await getProcessProgress(db, addr);
          if (processProgress && processProgress.lastProcessedTxHash) {
            const resumeIndex = newTxs.findIndex(tx => tx.hash === processProgress.lastProcessedTxHash);
            if (resumeIndex !== -1) {
              startFromIndex = resumeIndex + 1; // Start after the last processed transaction
            }
          }
        } else {
          await clearProcessProgress(db, addr);
        }

        let _startedAt = Date.now();
        let _lastUi = 0;

        for (let i=startFromIndex; i < newTxs.length; i++) {
          const tx = newTxs[i];
          const tokenId = String(tx.tokenID);

          const done = i + 1;
          if (tokenBar) tokenBar.value = done;
          if (window.progressUI) window.progressUI.setStage('Processing Stake XENFT txs', done, newTxs.length, `Token #${tokenId}`);
          const now = Date.now();
          if (now - _lastUi > 300) {
            const elapsed = (now - _startedAt) / 1000;
            const rate = done / Math.max(1, elapsed);
            const remain = Math.max(0, newTxs.length - done);
            const eta = rate > 0 ? remain / rate : 0;
            if (window.progressUI) window.progressUI.setEta(eta);
            _lastUi = now;
          }

          // Yield to browser every 10 transactions to prevent UI freezing
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }

          const isMint = tx.to.toLowerCase() === addr.toLowerCase();
          const isClaim = tx.from.toLowerCase() === addr.toLowerCase() && tx.to.toLowerCase() === ZERO_ADDR;
          const isTransferOut = tx.from.toLowerCase() === addr.toLowerCase() && !isClaim;

          let existing = await getByTokenId(db, tokenId);

          if (isMint && !existing) {
            try {
              const uri = await withRetry(w3, `tokenURI for #${tokenId}`, async () => await c.methods.tokenURI(tokenId).call());
              const meta = extractJsonFromDataUri(uri);
              const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];

              let amount = parseNumLoose(findAttr(attrs, 'amount')?.value);
              let term = parseNumLoose(findAttr(attrs, 'term')?.value);
              let apy = parseNumLoose(findAttr(attrs, 'apy')?.value);

              if (!Number.isFinite(term) || term <= 0) {
                try {
                  const txDetails = await w3.eth.getTransaction(tx.hash);
                  if (txDetails && typeof txDetails.input === 'string' && txDetails.input.slice(0,10).toLowerCase() === '0xd7fa023d') {
                    const [amt, t] = w3.eth.abi.decodeParameters(['uint256','uint256'], '0x' + txDetails.input.slice(10));
                    term = Number(t);
                    amount = amt;
                  }
                } catch (e) { /* ignore */ }
              }

              const mintTs = Number(tx.timeStamp);
              const computedMaturityTs = mintTs + (term > 0 ? term * 86400 : 0);
              const nowSec = Math.floor(Date.now()/1000);
              const status = (computedMaturityTs > 0 && computedMaturityTs <= nowSec) ? "Claimable" : "Maturing";

              let Maturity_Date_Fmt = "", maturityDateOnly = "";
              const dt = (window.luxon ? window.luxon.DateTime.fromSeconds(computedMaturityTs) : null);
              if (dt?.isValid) {
                Maturity_Date_Fmt = dt.toFormat("yyyy LLL dd, hh:mm a");
                maturityDateOnly  = dt.toFormat("yyyy-MM-dd");
              }

              const newRow = {
                tokenId,
                owner: addr,
                amount: String(amount || "0"),
                term: term || 0,
                apy: apy || 0,
                maturityTs: computedMaturityTs || 0,
                status,
                Maturity_Date_Fmt,
                maturityDateOnly,
                actions: []
              };
              await save(db, newRow);
              // Save progress after each transaction for crash recovery
              await saveProcessProgress(db, addr, i, tx.hash, i + 1);

            } catch (e) {
              console.error(`[StakeXENFT] Failed to process new mint for token #${tokenId}.`, e);
            }
          } else if (isClaim && existing && existing.status !== "Claimed") {
            existing.status = "Claimed";
            const claimAction = { type: "endStake", hash: tx.hash, timeStamp: Number(tx.timeStamp) };
            if (!Array.isArray(existing.actions)) existing.actions = [];
            if (!existing.actions.some(a => a.hash === tx.hash)) {
              existing.actions.push(claimAction);
            }
            await save(db, existing);
            // Save progress after each transaction for crash recovery
            await saveProcessProgress(db, addr, i, tx.hash, i + 1);
          } else if (isTransferOut && existing && existing.owner.toLowerCase() === addr.toLowerCase()) {
            existing.owner = cleanHexAddr(tx.to);
            await save(db, existing);
            // Save progress after each transaction for crash recovery
            await saveProcessProgress(db, addr, i, tx.hash, i + 1);
            if (tokenTxt) tokenTxt.textContent = `Token #${tokenId} transferred to ${existing.owner.slice(0,6)}...`;
          } else {
            // Save progress even for transactions that don't result in changes
            await saveProcessProgress(db, addr, i, tx.hash, i + 1);
          }
        }
        await putScanState(db, addr, latestBlock);
        // Clear progress on successful completion of address scanning
        await clearProcessProgress(db, addr);
        console.log(`[XENFT Stake] Scan completed successfully for ${addr} - cleared process progress`);
      } catch (error) {
        console.error(`Failed to complete scan for address ${addr}:`, error);
        if (tokenTxt) tokenTxt.textContent = `Error scanning ${addr.slice(0,6)}... See console.`;
      }
    }

    if (tokenTxt) tokenTxt.textContent = "Stake scan complete.";
    setTimeout(()=>{
      if (!window.__scanAllActive) {
        if (window.progressUI) window.progressUI.show(false);
        else if (progContainer) progContainer.style.display = "none";
      }
    }, 1200);
  }

  // Export
  window.xenftStake = { 
    get CONTRACT_ADDRESS() { return getContractAddress(); }, 
    openDB, 
    getAll, 
    scan 
  };
})();
