// === Stake XENFTs module (Etherscan-Optimized with Incremental Scanning) ===========================
// Scans the Stake XENFT contract and stores rows in IndexedDB "DB-Xenft-Stake".
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
  const CONTRACT_ADDRESS = "0xfEdA03b91514D31b435d4E1519Fd9e699C29BbFC";
  const CONTRACT_CREATION_BLOCK = 16339900; // Optimization: don't scan before this
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

  const DEFAULT_RPC = `https://ethereum-rpc.publicnode.com`;

  // ABI moved to ./ABI/xenft-stake-ABI.js as window.xenftStakeAbi

  // --- small utils ---
  function cleanHexAddr(a){ return String(a||'').trim().toLowerCase(); }

  function getAddressesFromSettings(){
    const text = (document.getElementById("ethAddress")?.value || localStorage.getItem("ethAddress") || "").trim();
    return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  }

  function getRpcList(){
    const ta = document.getElementById("customRPC");
    const raw = (ta && ta.value.trim()) || (localStorage.getItem("customRPC") || DEFAULT_RPC);
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
  const DB_NAME = "DB-Xenft-Stake";
  const DB_VERSION = 2; // Bump version for schema change
  const STORE_STAKES = "stakes";
  const STORE_STATE = "scanState";

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_STAKES)) {
          db.createObjectStore(STORE_STAKES, { keyPath: "tokenId" });
        }
        if (!db.objectStoreNames.contains(STORE_STATE)) {
          db.createObjectStore(STORE_STATE, { keyPath: "address" });
        }
      };
      req.onsuccess = e => resolve(e.target.result);
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
      const tx = db.transaction(STORE_STAKES, "readonly");
      tx.objectStore(STORE_STAKES).getAll().onsuccess = e => resolve(e.target.result || []);
      tx.onerror = e => reject(e);
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


  // --- Etherscan helper: Fetch NFT transfers in a specific block range ---
  async function fetchStakeTxsInRange(userAddress, apiKey, startBlock, endBlock) {
    const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&contractaddress=${CONTRACT_ADDRESS}&address=${userAddress}&startblock=${startBlock}&endblock=${endBlock}&page=1&offset=10000&sort=asc&apikey=${apiKey}`;

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url);
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
      alert("An Etherscan API Key is required for this fast scan method. Please add one in Settings.");
      return;
    }

    const w3 = newWeb3();
    const db = await openDB();
    const c  = new w3.eth.Contract(window.xenftStakeAbi, CONTRACT_ADDRESS);

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
        const startBlock = scanState ? scanState.lastScannedBlock + 1 : CONTRACT_CREATION_BLOCK;

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
        let _startedAt = Date.now();
        let _lastUi = 0;

        for (let i=0; i < newTxs.length; i++) {
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
          } else if (isTransferOut && existing && existing.owner.toLowerCase() === addr.toLowerCase()) {
            existing.owner = cleanHexAddr(tx.to);
            await save(db, existing);
            if (tokenTxt) tokenTxt.textContent = `Token #${tokenId} transferred to ${existing.owner.slice(0,6)}...`;
          }
        }
        await putScanState(db, addr, latestBlock);
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
  window.xenftStake = { CONTRACT_ADDRESS, openDB, getAll, scan };
})();
