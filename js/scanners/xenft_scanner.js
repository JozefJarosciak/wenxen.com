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
  async function fetchEndTorrentActions(w3, addr, fromBlock) {
    const c = new w3.eth.Contract(window.xenftAbi, CONTRACT_ADDRESS);
    const latest = await w3.eth.getBlockNumber();
    const start = Math.max(0, Number(fromBlock || 0));
    let events = [];
    try {
      events = await c.getPastEvents("EndTorrent", {
        filter: { user: addr },
        fromBlock: start,
        toBlock: 'latest'
      });
    } catch (e) {
      // Some RPCs don't allow getPastEvents; skip logs on those endpoints.
      events = [];
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
        if (typeof contract.methods.ownedTokens === "function") {
          tokenIds = await contract.methods.ownedTokens().call({ from: addr });
        } else if (typeof contract.methods.balanceOf === "function") {
          const balance = await contract.methods.balanceOf(addr).call();
          tokenIds = await Promise.all(
            Array.from({length:Number(balance)},(_,j)=>contract.methods.tokenOfOwnerByIndex(addr,j).call())
          );
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
            const w3 = new Web3(rpcEndpoints[0]);
            let startBlock = 0;
            try { startBlock = Number(await contract.methods.startBlockNumber().call()); } catch {}

            const actions = await fetchEndTorrentActions(w3, addr, startBlock);
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
          for (const rpc of rpcEndpoints) {
            try {
              const w3 = new Web3(rpc);
              const c  = new w3.eth.Contract(window.xenftAbi, CONTRACT_ADDRESS);
              const tokenUri = await c.methods.tokenURI(tokenId).call();
              const tokenData = extractTokenData(tokenUri);
              const xenftId = tokenData.name ? tokenData.name.split('#').pop().trim() : tokenId;
              const mintInfoRaw = await c.methods.mintInfo(xenftId).call();
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
                VMUs: tokenData.attributes ? (tokenData.attributes.find(a => a.trait_type === "VMUs")?.value || "") : "",
                "XEN Burned": tokenData.attributes ? (tokenData.attributes.find(a => a.trait_type === "XEN Burned")?.value || "") : "",
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
            } catch (err) { /* try next RPC */ }
          }
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
})();

