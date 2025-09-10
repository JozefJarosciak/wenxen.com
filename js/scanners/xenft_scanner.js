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
      
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("xenfts")) {
          db.createObjectStore("xenfts", { keyPath: "Xenft_id" });
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
        
        // Special handling for Base chain
        if (currentChain === 'BASE') {
          // For Base, we need a different approach since it doesn't support enumeration properly
          // First check the balance to know how many tokens to look for
          let targetBalance = 0;
          try {
            targetBalance = Number(await contract.methods.balanceOf(addr).call());
            console.log(`XENFT Scanner - ${addr} has ${targetBalance} XENFTs on Base`);
          } catch (e) {
            console.log(`Balance check failed for ${addr}:`, e.message);
          }
          
          if (targetBalance > 0) {
            // Get the latest token ID to know where to start searching
            let latestTokenId = 860000; // Default estimate
            try {
              latestTokenId = Number(await contract.methods.tokenIdCounter().call());
              console.log(`XENFT Scanner - Latest token ID on Base: ${latestTokenId}`);
            } catch (e) {
              console.log(`Could not get tokenIdCounter, using estimate`);
            }
            
            // Search backwards from the latest token ID
            // Need to search enough range to find all tokens
            let foundCount = 0;
            const maxSearch = Math.max(20000, targetBalance * 100); // Search at least 20k tokens or 100x the balance
            const startId = latestTokenId;
            const endId = Math.max(1, latestTokenId - maxSearch);
            
            console.log(`XENFT Scanner - Searching for ${targetBalance} tokens from ID ${startId} down to ${endId}`);
            
            for (let testId = startId; testId >= endId && foundCount < targetBalance; testId--) {
              try {
                const testOwner = await contract.methods.ownerOf(testId.toString()).call();
                if (testOwner.toLowerCase() === addr.toLowerCase()) {
                  // Validate with vmuCount like in Python code
                  try {
                    const vmuCount = await contract.methods.vmuCount(testId.toString()).call();
                    if (Number(vmuCount) > 0) {
                      tokenIds.push(testId.toString());
                      foundCount++;
                      console.log(`XENFT Scanner - Found valid Base token ${testId} for ${addr} (${foundCount}/${targetBalance})`);
                    }
                  } catch (e) {
                    // If vmuCount fails, still add it as it passed ownerOf check
                    tokenIds.push(testId.toString());
                    foundCount++;
                    console.log(`XENFT Scanner - Found Base token ${testId} for ${addr} (${foundCount}/${targetBalance})`);
                  }
                }
              } catch (err) {
                // Token doesn't exist or not owned, continue
              }
              
              // Add small delay every 25 tokens to avoid rate limiting
              if (testId % 25 === 0) {
                await new Promise(resolve => setTimeout(resolve, 20));
              }
              
              // Show progress
              if (testId % 100 === 0 && window.progressUI) {
                const searched = startId - testId;
                window.progressUI.setStage(`Searching Base tokens (found ${foundCount}/${targetBalance})`, searched, maxSearch);
              }
            }
            
            // Sort token IDs in ascending order for display
            tokenIds.sort((a, b) => Number(a) - Number(b));
            
            if (tokenIds.length > 0) {
              console.log(`XENFT Scanner - Found ${tokenIds.length}/${targetBalance} Base tokens for ${addr}: ${tokenIds.join(', ')}`);
              if (tokenIds.length < targetBalance) {
                console.log(`XENFT Scanner - Note: Could not find all tokens, may need wider search range`);
              }
            } else {
              console.log(`XENFT Scanner - No tokens found for ${addr} in range ${endId}-${startId}`);
            }
          }
        } else {
          // For other chains, use standard methods
          // Try ownedTokens first (Ethereum XENFT method)
          if (contract.methods.ownedTokens) {
            try {
              tokenIds = await contract.methods.ownedTokens().call({ from: addr });
            } catch (ownedTokensError) {
              // If ownedTokens fails, try standard ERC721 enumerable methods
              if (contract.methods.balanceOf) {
                const balance = await contract.methods.balanceOf(addr).call();
                tokenIds = await Promise.all(
                  Array.from({length:Number(balance)},(_,j)=>contract.methods.tokenOfOwnerByIndex(addr,j).call())
                );
              }
            }
          } else if (contract.methods.balanceOf) {
            // Fallback to standard ERC721 enumerable methods
            const balance = await contract.methods.balanceOf(addr).call();
            tokenIds = await Promise.all(
              Array.from({length:Number(balance)},(_,j)=>contract.methods.tokenOfOwnerByIndex(addr,j).call())
            );
          }
        }
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

      let processed = 0;
      let _startedAt = Date.now();
      let _lastUi = 0;
      for (const tokenId of tokenIds) {
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

