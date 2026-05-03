
// === UNIFIED VIEW (CoinTool + XENFT) ===
// Goal: one table (#cointool-table) that includes BOTH CoinTool mints and XENFTs.
// - Adds a "Scan XENFTs" button next to your existing Scan button
// - Appends XENFT-specific columns to the CoinTool table
// - Merges data and keeps it merged after CoinTool refreshes
// - Calendar shows total VMUs across both
// - Summary gets an extra XENFT line

function updateStakeSummaryLine(){
  const container = document.getElementById("summaryContainer");
  if (!container) return;

  let line = document.getElementById("stakeItemCount");
  if (!line) {
    line = document.createElement("div");
    line.id = "stakeItemCount";
    line.style.marginTop = "4px";
    container.appendChild(line);
  }

  const all = (Array.isArray(window._allUnifiedRows) && window._allUnifiedRows.length)
    ? window._allUnifiedRows
    : (window.cointoolTable ? (window.cointoolTable.getData("all") || window.cointoolTable.getData("active")) : []);

  const s = all.filter(r => r.SourceType === "Stake");
  const count = s.length;
  const maturingCount = s.filter(r => r.Status === "Maturing").length;
  const claimableCount = s.filter(r => r.Status === "Claimable").length;

  line.innerHTML = `<strong>Stakes:</strong> ${count.toLocaleString()} | <strong>Maturing:</strong> ${maturingCount.toLocaleString()} | <strong>Claimable:</strong> ${claimableCount.toLocaleString()}`;
}

// DOM utility functions now provided by js/utils/domUtils.js module
// Legacy functions like debounce(), setHeaderFilterText(), setHeaderFilterTextDebounced() are available globally

// === Unified Scan: All / Cointool / XENFTs ===
(function initUnifiedScan(){
  const MODE_KEY = "scanMode";
  const $ = (sel) => document.querySelector(sel);
  let scanBtn       = $("#scanBtn"); // Changed to let
  const modeToggle    = $("#scanModeToggle");
  const modeMenu      = $("#scanModeMenu");
  const modeBadge     = $("#scanModeBadge");

  if (!scanBtn || !modeToggle || !modeMenu || !modeBadge) return; // HTML not present

  function getMode(){
    const v = localStorage.getItem(MODE_KEY);
    return (v === "cointool" || v === "xenft" || v === "stake-xenft" || v === "stake") ? v : "all";
  }

  function setMode(v){
    localStorage.setItem(MODE_KEY, v);
    updateScanButtonText(v); // This now sets the entire button text
    modeMenu.querySelectorAll("li").forEach(li => {
      li.setAttribute("aria-selected", li.dataset.value === v ? "true" : "false");
    });
  }
  function updateBadge(v){
    modeBadge.textContent =
      v === "cointool"   ? "Cointool" :
        v === "xenft"      ? "XENFTs" :
          v === "stake-xenft"? "Stake XENFTs" :
            "All";
  }

  // NEW, ROBUST VERSION of the function that updates the button text
  function updateScanButtonText(v) {
    const label = document.getElementById("scanBtnLabel");
    const badge = document.getElementById("scanModeBadge");
    if (label) {
      label.textContent =
        v === "cointool"     ? "Scan Cointool" :
          v === "xenft"        ? "Scan XENFTs" :
            v === "stake-xenft"  ? "Scan Stake XENFTs" :
              v === "stake"        ? "Scan Stakes" :
                "Scan";
    }
    if (badge) {
      badge.textContent =
        v === "cointool"     ? "Cointool" :
          v === "xenft"        ? "XENFTs" :
            v === "stake-xenft"  ? "Stake XENFTs" :
              v === "stake"        ? "Stakes" :
                "All";
    }
  }
// ...

// Orchestrate scans based on mode
// NEW, ROBUST VERSION of the main scan function


  async function scanUnified(){
    const liveScanBtn = document.getElementById("scanBtn");
    const modeToggleEl = document.getElementById("scanModeToggle");
    const stopBtn = document.getElementById("cancelScanBtn");
    if (!liveScanBtn) return;

    const mode = getMode();

    // Ensure progress container is visible immediately and type is labeled
    try {
      const typeLabel = (
        mode === 'all' ? 'All' :
        mode === 'cointool' ? 'Cointool' :
        mode === 'xenft' ? 'XENFTs' :
        mode === 'stake-xenft' ? 'Stake XENFTs' :
        mode === 'stake' ? 'Stakes' : 'Scan'
      );
      window.progressUI?.show(true);
      window.progressUI?.setType(typeLabel);
    } catch {}

    liveScanBtn.dataset.prevText = document.getElementById("scanBtnLabel")?.textContent || "Scan";
    const scanningText =
      mode === "all"        ? "Scanning All…"
        : mode === "xenft"      ? "Scanning XENFTs…"
          : mode === "stake-xenft"? "Scanning Stake XENFTs…"
            : mode === "stake"      ? "Scanning Stakes…"
              :                         "Scanning Cointool…";

    // Disable split scan controls and show Stop button
    try {
      if (modeToggleEl) modeToggleEl.disabled = true;
      liveScanBtn.disabled = true;
      liveScanBtn.setAttribute("aria-busy", "true");
      if (stopBtn) {
        stopBtn.style.display = "inline-block";
        stopBtn.textContent = "Stop Scan";
        stopBtn.onclick = () => { try { window.location.reload(); } catch { location.reload(); } };
      }
    } catch {}

    // If Force Rescan is checked, confirm and CLEAR stores for the selected mode first (fast path)
    try {
      const force = !!document.getElementById('forceRescan')?.checked;
      if (force) {
        // Get chain-specific database names
        const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
        const chainPrefix = currentChain === 'BASE' ? 'BASE' : 'ETH';
        
        const dbIds = (
          mode === 'all' ? [`${chainPrefix}_DB_Cointool`,`${chainPrefix}_DB_Xenft`,`${chainPrefix}_DB_XenftStake`,`${chainPrefix}_DB_XenStake`] :
          mode === 'cointool' ? [`${chainPrefix}_DB_Cointool`] :
          mode === 'xenft' ? [`${chainPrefix}_DB_Xenft`] :
          mode === 'stake-xenft' ? [`${chainPrefix}_DB_XenftStake`] :
          mode === 'stake' ? [`${chainPrefix}_DB_XenStake`] :
          [`${chainPrefix}_DB_Cointool`]
        );

        const friendly = (id) => {
          // Remove chain prefix for display
          const baseId = id.replace(/^(ETH_|BASE_)/, '');
          return (
            baseId === 'DB_Cointool' ? 'Cointool (mints)' :
            baseId === 'DB_Xenft' ? 'XENFT (NFT scans)' :
            baseId === 'DB_XenftStake' ? 'XENFT Stake (stakes)' :
            baseId === 'DB_XenStake' ? 'XEN Stake (regular)' : baseId
          );
        };

        const title = dbIds.length > 1
          ? `Force rescan will delete ALL saved data for: ${dbIds.map(friendly).join(', ')}.\n\nContinue?`
          : `Force rescan will delete ${friendly(dbIds[0])}. Continue?`;

        const ok = confirm(title);
        if (!ok) return; // user canceled

        // Immediate UI feedback while clearing
        document.getElementById("scanBtnLabel").textContent = "Preparing rescan…";
        liveScanBtn.disabled = true;
        liveScanBtn.setAttribute("aria-busy", "true");

        // Run clears in parallel for speed (no DB deletion to avoid blocking)
        const tasks = dbIds.map((id) => {
          // Extract base database type from chain-specific ID
          const baseId = id.replace(/^(ETH_|BASE_)/, '');
          
          if (baseId === 'DB_Cointool') {
            const opener = (window.cointool && typeof window.cointool.openDB === 'function')
              ? window.cointool.openDB()
              : (typeof openDB === 'function' ? openDB() : Promise.resolve(null));
            return opener.then(async (db) => {
              if (!db) return;
              try {
                if (db.objectStoreNames.contains('proxies')) await clearStore(db, 'proxies').catch(()=>{});
                if (db.objectStoreNames.contains('scanState')) await clearStore(db, 'scanState').catch(()=>{});
              } finally {
                // Close so the scanner can reopen at the same version without
                // being blocked by this connection.
                try { db.close(); } catch (_) {}
              }
            });
          }
          if (baseId === 'DB_Xenft') {
            return (window.xenft?.openDB ? window.xenft.openDB() : Promise.resolve(null)).then(async (db) => {
              if (!db) return; await clearStore(db, 'xenfts').catch(()=>{});
            });
          }
          if (baseId === 'DB_XenftStake') {
            return (window.xenftStake?.openDB ? window.xenftStake.openDB() : Promise.resolve(null)).then(async (db) => {
              if (!db) return; await Promise.all([
                clearStore(db, 'stakes').catch(()=>{}),
                clearStore(db, 'scanState').catch(()=>{}),
              ]);
            });
          }
          if (baseId === 'DB_XenStake') {
            return (window.xenStake?.openDB ? window.xenStake.openDB() : Promise.resolve(null)).then(async (db) => {
              if (!db) return; await Promise.all([
                clearStore(db, 'stakes').catch(()=>{}),
                clearStore(db, 'scanState').catch(()=>{}),
              ]);
            });
          }
          return Promise.resolve();
        });

        try {
          await Promise.all(tasks);
        } catch (e) {
          alert('Failed to reset data before rescan. Please try again.');
          return;
        }

        // Notify user we reset data for the selected scope before scanning
        try {
          const msg = dbIds.length > 1
            ? 'Rescan reset completed for all selected data.'
            : `Rescan reset completed for ${friendly(dbIds[0])}.`;
          if (typeof showToast === 'function') { showToast(msg, 'success'); }
        } catch {}
      }
    } catch (e) {
      console.warn('Force rescan pre-clear failed:', e);
    }

    // Proceed to scanning; update label right away
    document.getElementById("scanBtnLabel").textContent = scanningText;

    try {
      // If we're scanning everything, keep the progress bar under our control
      if (mode === "all") {
        window.__scanAllActive = true;
        if (window.progressUI) window.progressUI.show(true);
      }

      // Step 1: Run the actual data scans (sequential)
      if (mode === "all") {
        if (typeof window.scanMints === "function") { await window.scanMints(); }
        if (window.xenft && typeof window.xenft.scan === "function") { await window.xenft.scan(); }
        if (window.xenftStake && typeof window.xenftStake.scan === "function") { await window.xenftStake.scan(); }
        if (window.xenStake && typeof window.xenStake.scan === "function") { await window.xenStake.scan(); } // ✅ added regular Stakes
      } else if (mode === "cointool") {
        if (typeof window.scanMints === "function") { await window.scanMints(); }
      } else if (mode === "xenft") {
        if (window.xenft && typeof window.xenft.scan === "function") { await window.xenft.scan(); }
      } else if (mode === "stake-xenft") {
        if (window.xenftStake && typeof window.xenftStake.scan === "function") { await window.xenftStake.scan(); }
      } else if (mode === "stake") {
        if (window.xenStake && typeof window.xenStake.scan === "function") { await window.xenStake.scan(); }
      }
    } finally {
      // Step 2: Restore the buttons right away
      liveScanBtn.disabled = false;
      if (modeToggleEl) modeToggleEl.disabled = false;
      const lbl = document.getElementById("scanBtnLabel");
      if (lbl) {
        lbl.textContent = liveScanBtn.dataset.prevText || "Scan";
      } else {
        // fallback if label span missing
        liveScanBtn.textContent = liveScanBtn.dataset.prevText || "Scan All";
      }
      liveScanBtn.removeAttribute("aria-busy");
      if (stopBtn) { stopBtn.style.display = "none"; stopBtn.onclick = null; }

      // Step 3: If this was “Scan All”, hide progress a moment after everything finishes
      if (mode === "all") {
        setTimeout(() => {
          window.__scanAllActive = false;
          const pc  = document.getElementById("progressContainer");
          const at  = document.getElementById("addressProgressText");
          const tt  = document.getElementById("tokenProgressText");
          const etr = document.getElementById("etrText");
          if (window.progressUI) window.progressUI.show(false); else if (pc) pc.style.display = "none";
          if (at)  at.textContent = "";
          if (tt)  tt.textContent = "";
          if (etr) etr.textContent = "";
        }, 1200);
      }
    }

    // Step 3: Refresh the UI. This can take a few seconds, but the button is already restored.
    if (typeof window.refreshUnified === "function") {
      try {
        await window.refreshUnified();
      } catch (e) {
        console.error("Unified refresh failed:", e);
      }
    }

    // Finally, uncheck the Force Rescan option after a completed scan
    try { const cb = document.getElementById('forceRescan'); if (cb) cb.checked = false; } catch {}

    // Auto-remove duplicates after scan if enabled
    try {
      const autoDedupeEnabled = localStorage.getItem('autoDedupeAfterScan') !== 'false'; // Default true
      if (autoDedupeEnabled && typeof window.removeDuplicatesFromAllDatabases === 'function') {
        console.log('[Scan] Running auto-dedupe after scan...');
        const removed = await window.removeDuplicatesFromAllDatabases(true); // silent mode
        if (removed > 0) {
          console.log(`[Scan] Auto-dedupe removed ${removed} duplicates`);
          // Update last cleanup time
          localStorage.setItem('duplicatesLastCleanup', String(Date.now()));
          // Update the display if function exists
          if (typeof window.updateLastCleanupDisplay === 'function') {
            window.updateLastCleanupDisplay();
          }
          // Refresh the UI again to show deduplicated data
          if (typeof window.refreshUnified === 'function') {
            await window.refreshUnified();
          }
        }
      }
    } catch (e) {
      console.warn('[Scan] Auto-dedupe failed:', e);
    }
  }

  // open/close menu
  modeToggle.addEventListener("click", () => {
    const open = !modeMenu.hasAttribute("hidden");
    if (open) {
      modeMenu.setAttribute("hidden", "");
      modeToggle.setAttribute("aria-expanded", "false");
    } else {
      modeMenu.removeAttribute("hidden");
      modeToggle.setAttribute("aria-expanded", "true");
    }
  });
  document.addEventListener("click", (e) => {
    if (!modeMenu.contains(e.target) && e.target !== modeToggle) {
      modeMenu.setAttribute("hidden", "");
      modeToggle.setAttribute("aria-expanded", "false");
    }
  });
  modeMenu.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-value]");
    if (!li) return;
    setMode(li.dataset.value);
    modeMenu.setAttribute("hidden", "");
    modeToggle.setAttribute("aria-expanded", "false");
  });

  // initial state from storage (default: all)
  setMode(getMode());



  // Replace the old click handler that points directly to scanMints
  const clone = scanBtn.cloneNode(true);
  scanBtn.parentNode.replaceChild(clone, scanBtn);
  scanBtn = clone; // Re-assign the scanBtn variable to the new element
  scanBtn.addEventListener("click", scanUnified);

  // Hide any legacy “Scan XENFTs” button if it got injected earlier
  try { const legacy = document.getElementById("scanXenftBtn"); if (legacy) legacy.style.display = "none"; } catch {}

})();


// --- parse "YYYY Mon" / "YYYY Mon DD" into a Date (day optional) ---
// parseYearMonDay function now provided by js/utils/dateUtils.js module

// --- wire header input → calendar (call this after table + calendar are ready) ---
function attachMaturityHeaderSync() {
  const sel = '.tabulator-col[tabulator-field="Maturity_Date_Fmt"] .tabulator-header-filter input';
  const input = document.querySelector(sel);
  if (!input || input.dataset._syncBound) return;

  const jumpDebounced = debounce((dt) => {
    const cal = (window.calendarPicker && typeof window.calendarPicker.jumpToDate === "function")
      ? window.calendarPicker
      : (window._calendar || null);
    if (!cal || typeof cal.jumpToDate !== "function") return;
    try { cal.jumpToDate(dt); } catch {}
  }, 200);

  input.addEventListener("input", () => {
    const dt = parseYearMonDay(input.value);
    if (dt) jumpDebounced(dt);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const dt = parseYearMonDay(input.value);
    if (!dt) return;
    const cal = window.calendarPicker || window._calendar;
    try { cal?.setDate?.(dt, true); cal?.jumpToDate?.(dt); } catch {}
  });

  input.dataset._syncBound = "1";
}




// Build "YYYY-MM-DD" from a JS Date in LOCAL time
// buildDayKeyFromDate and parseMaturityFmtToKey functions now provided by js/utils/dateUtils.js module

// Return local "YYYY-MM-DD" for a row from maturityDateOnly OR timestamp OR formatted text
// Make a single authoritative "YYYY-MM-DD" date key per row
function rowToLocalKey(row){
  if (!row) return "";

  // 1) Prefer what the user sees in the table (Maturity_Date_Fmt)
  const fromFmt = parseMaturityFmtToKey(row.Maturity_Date_Fmt);
  if (fromFmt) return fromFmt;

  // 2) Fall back to Maturity_Timestamp (seconds), converted to LOCAL time
  // Note: Cointool uses Maturity_TS, others use Maturity_Timestamp
  const t = Number(row.Maturity_Timestamp || row.Maturity_TS);
  if (Number.isFinite(t) && t > 0) {
    if (typeof luxon !== "undefined") {
      return luxon.DateTime.fromSeconds(t)
        .setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
        .toFormat("yyyy-LL-dd");
    } else {
      return buildDayKeyFromDate(new Date(t * 1000));
    }
  }

  // 3) Last resort: stored 'maturityDateOnly'
  if (row.maturityDateOnly && row.maturityDateOnly.length >= 8) return row.maturityDateOnly;

  return "";
}

// From a Date object (keeps your current behavior)
function setMaturityHeaderFilterFromDate(dt) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const y = dt.getFullYear();
  const m = months[dt.getMonth()];
  const d = String(dt.getDate()); // ← no padStart
  setHeaderFilterTextDebounced("Maturity_Date_Fmt", `${y} ${m} ${d}`);

  // Make sure Tabulator re-evaluates immediately
  try { window.cointoolTable?.refreshFilter(); } catch (_) {}

  // Ensure Status and Type header filters are set to All as well (use Tabulator API when possible)
  try {
    if (window.cointoolTable && typeof window.cointoolTable.setHeaderFilterValue === 'function') {
      window.cointoolTable.setHeaderFilterValue('Status', '');
      window.cointoolTable.setHeaderFilterValue('SourceType', '');
    } else {
      const setSelectToAll = (field) => {
        const root = document.querySelector(`.tabulator-col[tabulator-field="${field}"] .tabulator-header-filter`);
        if (!root) return;
        const sel = root.querySelector('select');
        const inp = root.querySelector('input');
        const v = '';
        if (sel) {
          sel.value = v;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          sel.dispatchEvent(new Event('input',  { bubbles: true }));
        } else if (inp) {
          inp.value = v;
          inp.dispatchEvent(new Event('input',  { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
        }
      };
      setSelectToAll('Status');
      setSelectToAll('SourceType');
    }
  } catch (_) {}
}


(function(){
  // Hide any legacy/standalone XENFT table if present
  try {
    var legacy = document.getElementById("xenft-table");
    if (legacy) legacy.style.display = "none";
  } catch(e) {}

  // Add a Scan XENFTs button (beside normal Scan)
  function ensureXenftScanButton(){
    var group = document.querySelector(".controls-container .button-group");
    if (!group || document.getElementById("scanXenftBtn")) return;
    if (!group || document.getElementById("scanXenftBtn") || document.getElementById("scanModeToggle")) return;

    var btn = document.createElement("button");
    btn.id = "scanXenftBtn";
    btn.textContent = "Scan XENFTs";
    group.insertBefore(btn, group.children[1] || null);

    function restore() {
      btn.disabled = false;
      btn.textContent = btn.dataset.prevText || "Scan XENFTs";
      btn.removeAttribute("aria-busy");
    }

    btn.addEventListener("click", async function(){
      btn.dataset.prevText = btn.textContent || "Scan XENFTs";
      btn.textContent = "Scanning…";
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      try {
        if (window.xenft && typeof window.xenft.scan === "function") {
          await window.xenft.scan();
        } else {
          alert("XENFT module not loaded.");
        }
      } finally {
        restore();
      }
    });
  }

  // Wait until the main table exists
  function whenTableReady(cb){
    if (window.cointoolTable) { cb(); return; }
    var iv = setInterval(function(){
      if (window.cointoolTable) {
        clearInterval(iv);
        cb();
      }
    }, 150);
  }

  // Fetch helpers
  // Reads the new per-proxy `proxies` store and groups records into virtual
  // batch rows of size up to `cointoolMaxVmuPerTx`. One DB row per (owner,
  // salt, index); one table row per executable batch.
  function _getMaxVmuPerTx(){
    const raw = parseInt(localStorage.getItem("cointoolMaxVmuPerTx") || "", 10);
    if (!Number.isFinite(raw) || raw < 1) return 64;
    return Math.min(128, raw);
  }

  async function _readAllProxies(){
    try {
      const db = window.cointoolDb || window.dbInstance;
      if (!db || !db.objectStoreNames || !db.objectStoreNames.contains('proxies')) return [];
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('proxies', 'readonly');
        const req = tx.objectStore('proxies').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch(e){ return []; }
  }

  function _groupAndChunkProxies(proxies, maxPerBatch){
    // Group by (Owner|Salt|Status|Term|MaturityDay) so each batch row
    // contains only proxies maturing on the same calendar day. Otherwise
    // a chunk can mix proxies with different maturities (same Term but
    // different mint timestamps), which makes the table's VMU count for a
    // given date inaccurate.
    const groups = new Map();
    for (const p of proxies) {
      let dayKey = '';
      const ts = Number(p.Maturity_TS);
      if (window.luxon && Number.isFinite(ts) && ts > 0) {
        dayKey = luxon.DateTime.fromSeconds(ts).toFormat('yyyy-MM-dd');
      }
      const key = `${(p.Owner||'').toLowerCase()}|${(p.Salt||'').toLowerCase()}|${p.Status||''}|${p.Term||0}|${dayKey}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }

    const rows = [];
    for (const [key, list] of groups) {
      list.sort((a,b) => (Number(a.Maturity_TS||0) - Number(b.Maturity_TS||0)) || (Number(a.Index||0) - Number(b.Index||0)));
      for (let i = 0; i < list.length; i += maxPerBatch) {
        const chunk = list.slice(i, i + maxPerBatch);
        const first = chunk[0];
        const last  = chunk[chunk.length - 1];

        const ranks = chunk
          .map(p => {
            try { return BigInt(p.Rank || '0'); } catch { return 0n; }
          })
          .filter(v => v > 0n)
          .sort((a,b) => a < b ? -1 : a > b ? 1 : 0);
        const rankRange = ranks.length
          ? `${ranks[0].toString()}-${ranks[ranks.length-1].toString()}`
          : 'N/A';

        const matFmt = (window.luxon && Number(last.Maturity_TS) > 0)
          ? luxon.DateTime.fromSeconds(Number(last.Maturity_TS)).toFormat('yyyy LLL dd, hh:mm a')
          : '';
        const matKey = (window.luxon && Number(last.Maturity_TS) > 0)
          ? luxon.DateTime.fromSeconds(Number(last.Maturity_TS)).toFormat('yyyy-MM-dd')
          : '';

        // Per-day VMU breakdown for the calendar: chunked proxies share
        // Term but may have been minted at different times, so they can
        // mature on different days. Calendar reads MaturityByDay so the
        // VMU counts are accurate even for grouped rows.
        const maturityByDay = {};
        for (const p of chunk) {
          const ts = Number(p.Maturity_TS);
          if (!Number.isFinite(ts) || ts <= 0) continue;
          if (!window.luxon) continue;
          const day = luxon.DateTime.fromSeconds(ts).toFormat('yyyy-MM-dd');
          maturityByDay[day] = (maturityByDay[day] || 0) + 1;
        }

        // Aggregate History across the chunk into the row's Actions list,
        // dedup by txHash. Older callers display this as a links column.
        const txMap = new Map();
        for (const p of chunk) {
          const hist = Array.isArray(p.History) ? p.History : [];
          for (const h of hist) {
            const hash = h?.txHash;
            if (!hash || txMap.has(hash)) continue;
            txMap.set(hash, {
              hash,
              type: h.type,
              timeStamp: Number(h.ts || 0),
              block: Number(h.block || 0),
              term: h.term != null ? String(h.term) : '',
              rank: h.rank != null ? String(h.rank) : ''
            });
          }
        }
        const actions = Array.from(txMap.values()).sort((a, b) => Number(a.timeStamp) - Number(b.timeStamp));
        const latestActionTs = actions.length ? Number(actions[actions.length - 1].timeStamp || 0) : 0;

        rows.push({
          ID: `ct-batch-${first.Owner}-${first.Salt}-${first.Status}-${first.Term}-${first.Index}`,
          RowKind: 'batch',
          SourceType: 'Cointool',
          Owner: first.Owner,
          Salt: first.Salt,
          Status: first.Status,
          Term: String(first.Term || 0),
          VMUs: String(chunk.length),
          Indices: chunk.map(p => Number(p.Index)),
          ProxyIds: chunk.map(p => p.id),
          ProxyAddresses: chunk.map(p => p.ProxyAddress),
          Mint_id_Start: first.Index,
          Rank_Range: rankRange,
          Maturity_Timestamp: Number(last.Maturity_TS) || 0,
          Maturity_Date_Fmt: matFmt,
          maturityDateOnly: matKey,
          Earliest_Maturity_Timestamp: Number(first.Maturity_TS) || 0,
          MaturityByDay: maturityByDay,
          // Legacy-shaped fields kept null/empty for compatibility with code
          // that still reads them.
          Actions: actions,
          FailedIds: [],
          FailedIds_Lost: [],
          FailedIds_NotYetMatured: [],
          MintableIds: [],
          MintableIds_Deployed: [],
          MintableIds_Missing: [],
          RecoveredMaturities: [],
          ProxyStates: [],
          Latest_Action_Timestamp: latestActionTs,
          Address: first.Owner,
          TX_Hash: '',
          Block_Number: 0,
          Est_XEN: 0
        });
      }
    }
    return rows;
  }

  async function fetchCointoolRows(){
    const all = await _readAllProxies();
    if (!all.length) return [];
    const maxPerBatch = _getMaxVmuPerTx();
    return _groupAndChunkProxies(all, maxPerBatch);
  }


  async function fetchStakeRows(){
    if (!window.xenStake || typeof window.xenStake.getAll !== "function") return [];
    try {
      const db = await window.xenStake.openDB();
      const rows = await window.xenStake.getAll(db);
      return Array.isArray(rows) ? rows : [];
    } catch(e){ console.error("Failed to fetch Stake rows", e); }
    return [];
  }

  function mapStakeToRow(s){
    return {
      ID: "stake_" + (s.id || (s.owner + "_" + (s.startTs||0))),
      SourceType: "Stake",
      Mint_id_Start: s.id || "",           // full id kept in data; the UI will show short
      Owner: s.owner,
      Status: s.status,
      Maturity_Date_Fmt: s.Maturity_Date_Fmt,
      Term: s.term,
      VMUs: "1",
      Actions: s.actions || [],
      Est_XEN: 0,                          // computed in main_app.js
      Rank_Range: "N/A",
      Salt: "N/A",
      stakedAmount: s.amount,              // tokens
      amountWei: s.amountWei,              // raw wei
      apy: s.apy,
      Maturity_Timestamp: s.maturityTs,    // seconds
      maturityDateOnly: s.maturityDateOnly,
      Latest_Action_Timestamp: s.actions?.length ? (s.actions[s.actions.length-1].timeStamp || 0) : 0,
    };
  }


  async function fetchXenftRows(){
    if (!window.xenft || typeof window.xenft.openDB !== "function") return [];
    try {
      var db = await window.xenft.openDB();
      var rows = await window.xenft.getAll(db);
      return Array.isArray(rows) ? rows : [];
    } catch(e){}
    return [];
  }

  // Ensure XENFT columns exist on the main table
  function ensureUnifiedColumns(){
    if (!window.cointoolTable) return;

    // Ensure XENFT-specific columns exist
    var newCols = [
      {
        title: "Type",
        field: "SourceType",
        width: 120,
        headerSort: true,
        headerFilter: "list",
        headerFilterParams: {
          elementAttributes: { autocomplete: "new-password" },
          // Tabulator v6: list values use an array of {label, value}
          values: [
            { label: "All", value: "" },
            { label: "Cointool", value: "Cointool" },
            { label: "XENFT", value: "XENFT" },
            { label: "Stake XENFT", value: "Stake XENFT" },
            { label: "Stake", value: "Stake" },
          ]
        },
        headerFilterFunc: "="
      },
      // (XENFT ID removed per earlier change)
      { title: "Category", field: "Category", headerFilter: "input", width: 120 },
      { title: "Class", field: "Class", headerFilter: "input", width: 120 },
      { title: "AMP", field: "AMP", headerFilter: "input", width: 80 },
      { title: "EAA (%)", field: "EAA (%)", headerFilter: "input", width: 90 },
      {
        title: "XEN Burned",
        field: "XEN Burned",
        headerFilter: "input",
        width: 130,
        formatter: function (cell) {
          const row = cell.getRow().getData();
          const raw = cell.getValue();
          // Only hide 0 for XENFTs
          if (String(row.SourceType) === "XENFT") {
            const n = Number(String(raw).replace(/[^0-9.]/g, ""));
            if (!Number.isFinite(n) || n === 0) return "";
          }
          return raw ?? "";
        }
      }
    ];

    // Add any missing of the above
    var haveFields = {};
    try {
      window.cointoolTable.getColumns().forEach(function(c){
        var f = (typeof c.getField === "function") ? c.getField() : null;
        if (f) haveFields[f] = true;
      });
    } catch(e) {}

    var toAdd = newCols.filter(function(col){ return !haveFields[col.field]; });

    try {
      if (toAdd.length) {
        // Append first; we’ll reorder right after.
        toAdd.forEach(function(col){
          window.cointoolTable.addColumn(col, false, "end");
        });
      }
    } catch(e) {
      try {
        if (toAdd.length) {
          var defs = window.cointoolTable.getColumnDefinitions();
          window.cointoolTable.setColumns(defs.concat(toAdd));
        }
      } catch(_) {}
    }

    // 🔁 Reorder columns to your requested sequence
    try {
      var table = window.cointoolTable;
      var defs  = table.getColumnDefinitions();

      // Desired order (fields)
      var desired = [
        "Mint_id_Start",       // Mint ID
        "Owner",
        "SourceType",          // Type
        "Status",
        "Maturity_Date_Fmt",   // Maturity Date
        "Rank_Range",          // cRank Range
        "VMUs",
        "Term",
        "Actions",
        "Est_XEN",
        "Salt",
        "Category",
        "Class",
        "AMP",
        "EAA (%)",              // EAA
        "XEN Burned"
      ];

      // Build maps
      var byField = {};
      defs.forEach(function(d){ if (d && d.field) byField[d.field] = d; });

      // Keep any "special" columns like the leading checkbox as-is at the very start
      var specials = defs.filter(function(d){ return !d.field || d.field === "select"; });

      // Produce the ordered block from desired[] (only if present)
      var ordered = desired.map(function(f){ return byField[f]; }).filter(Boolean);

      // Any remaining columns not in desired[] go to the end (e.g., legacy or optional fields)
      var desiredSet = new Set(desired);
      var rest = defs.filter(function(d){
        return d.field && d.field !== "select" && !desiredSet.has(d.field);
      });

      var newDefs = specials.concat(ordered, rest);

      // Apply
      table.setColumns(newDefs);
    } catch(_) {}
  }



  function clearXenftBlockingFilters(hasNonCointool){
    if (!hasNonCointool || !window.cointoolTable) return;
    try {
      const filters = window.cointoolTable.getHeaderFilters?.() || [];
      const needClear = filters.some(f => f && f.field === "Salt" && String(f.value||"").trim() !== "");
      if (needClear) {
        window.cointoolTable.clearHeaderFilter("Salt");
        const inp = document.querySelector('.tabulator-col[tabulator-field="Salt"] .tabulator-header-filter input');
        if (inp) { inp.value = ""; inp.dispatchEvent(new Event("input", {bubbles:true})); }
      }
    } catch(e){}
  }

  // Map a raw XENFT record to the CoinTool row schema
  function mapXenftToRow(x){
    var cr = Number(x.cRank || 0) || 0;
    var vm = Number(x.VMUs || 0) || 0;
    var range = (cr && vm) ? (cr + " - " + (cr + vm - 1)) : "";

    var mTs = Number(x.Maturity_Timestamp || x.maturityTs || 0) || 0;
    var acts = Array.isArray(x.actions) ? x.actions : (Array.isArray(x.Actions) ? x.Actions : []);
    var hasClaimAction = acts.some(function(a){
      var type = String((a && a.type) || "").toLowerCase();
      return type === "bulkclaimmintreward" || type === "endtorrent";
    });
    var hasVerification = Number(x.lastCheckedAt || x.scanUpdatedAt || 0) > 0;
    var status;
    if (Number(x.redeemed) === 1 || hasClaimAction || String(x.Status || "").toLowerCase() === "claimed") status = "Claimed";
    else if (!mTs) status = "Unknown";
    else if (mTs * 1000 > Date.now()) status = "Maturing";
    else if (hasVerification) status = "Claimable";
    else status = "Unknown";

    // Prefer preformatted field from xenft_scanner.js; otherwise fall back
    var mFmt = x["Maturity_Date_Fmt"] || x["Maturity DateTime"] || "";

    return {
      ID: "xenft_" + (x.Xenft_id || x.tokenId || ""),
      Mint_id_Start: Number(x.Xenft_id || x.tokenId || 0) || (x.Xenft_id || x.tokenId || ""),
      Salt: "",
      Rank_Range: range,
      Term: x.Term || x.term || "",
      VMUs: vm,
      Status: status,
      Actions: acts,
      Maturity_Timestamp: mTs,
      Maturity_Date_Fmt: mFmt,
      Est_XEN: undefined,
      Owner: x.owner || "",
      Latest_Action_Timestamp: Number(x.latestActionTimestamp||0) || 0,
      redeemed: Number(x.redeemed||0) || 0,
      lastCheckedAt: Number(x.lastCheckedAt || 0) || 0,
      scanUpdatedAt: Number(x.scanUpdatedAt || 0) || 0,

      // XENFT-only extras
      SourceType: "XENFT",
      Xenft_id: x.Xenft_id || "",
      Category: x.Category || "",
      Class: x.Class || "",
      AMP: x.AMP || "",
      "EAA (%)": x["EAA (%)"] || "",
      "XEN Burned": x["XEN Burned"] || "",

      // data used by calendar filter
      maturityDateOnly: x.maturityDateOnly || ""
    };
  }

  async function fetchStakeXenftRows(){
    if (!window.xenftStake || typeof window.xenftStake.getAll !== "function") return [];
    try {
      var db = await window.xenftStake.openDB();
      var rows = await window.xenftStake.getAll(db);
      return Array.isArray(rows) ? rows : [];
    } catch(e){ console.error("Failed to fetch Stake XENFT rows", e); }
    return [];
  }

  function mapStakeXenftToRow(s) {
    return {
      ID: "stake-xenft_" + s.tokenId,
      SourceType: "Stake XENFT",
      Mint_id_Start: s.tokenId,
      Owner: s.owner,
      Status: s.status,
      Maturity_Date_Fmt: s.Maturity_Date_Fmt,
      Term: s.term,
      VMUs: '1', // Each stake NFT represents a single position
      Actions: s.actions || [],
      Est_XEN: 0, // This will be calculated by main_app.js's estimateXENForRow
      Rank_Range: 'N/A',
      Salt: 'N/A',
      stakedAmount: s.amount, // For Est. XEN calculation
      apy: s.apy, // For Est. XEN calculation
      Maturity_Timestamp: s.maturityTs,
      maturityDateOnly: s.maturityDateOnly,
      Latest_Action_Timestamp: s.actions?.length > 0 ? s.maturityTs : 0
    };
  }


  // Unified calendar (sum VMUs across both) — accurate, clickable, and no clipping
  async function updateUnifiedCalendar(){
    const ctRows = await fetchCointoolRows();
    const xfRows = await fetchXenftRows();
    const stakeXfRows = await fetchStakeXenftRows();
    const stakeRows   = await fetchStakeRows();

    // Build YYYY-MM-DD -> total VMUs using the *same date your table shows*
    const dateMap = Object.create(null);

    function addFromRow(row){
      const st = String(row.Status || row.status || "");
      if (st === "Unknown") return;

      // Cointool batch rows: each row may contain proxies that mature on
      // different days (same Term but different mint timestamps), so use
      // the per-day breakdown attached at grouping time. Skip Claimed/
      // Failed batches outright.
      if (row.SourceType === "Cointool" && row.RowKind === 'batch') {
        if (st === "Claimed" || st === "Failed") return;
        const byDay = row.MaturityByDay;
        if (byDay && typeof byDay === 'object') {
          for (const k of Object.keys(byDay)) {
            const n = Number(byDay[k]) || 0;
            if (k && n > 0) dateMap[k] = (dateMap[k] || 0) + n;
          }
          return;
        }
        // Fallback (shouldn't happen): use headline + total VMUs.
        const t = Number(row.Maturity_Timestamp || 0);
        if (!Number.isFinite(t) || t <= 0) return;
        const key = rowToLocalKey(row);
        const vm = Number(row.VMUs || 0) || 0;
        if (key && vm > 0) dateMap[key] = (dateMap[key] || 0) + vm;
        return;
      }

      // Non-cointool rows (XENFTs, stakes): Status reflects the whole
      // row's state — bail out early on Claimed/Redeemed.
      const isHeadlineDone = (st === "Claimed" || st === "Ended Early" || Number(row.redeemed || 0) === 1);
      if (isHeadlineDone) return;

      const t = Number(row.Maturity_Timestamp || row.Maturity_TS || 0);
      const totalVm = Number(row.VMUs || 0) || 0;
      if (Number.isFinite(t) && t > 0 && totalVm > 0) {
        const key = rowToLocalKey(row);
        if (key) dateMap[key] = (dateMap[key] || 0) + totalVm;
      }
    }

    ctRows.forEach(addFromRow);
    xfRows.map(mapXenftToRow).forEach(addFromRow);
    stakeXfRows.map(mapStakeXenftToRow).forEach(addFromRow);
    stakeRows.map(mapStakeToRow).forEach(addFromRow);

    // Preserve the current month/year view before destroying
    let preservedYear = null;
    let preservedMonth = null;
    if (window.calendarPicker && window.calendarPicker.currentYear !== undefined && window.calendarPicker.currentMonth !== undefined) {
      // Store the currently displayed month/year
      preservedYear = window.calendarPicker.currentYear;
      preservedMonth = window.calendarPicker.currentMonth;
      console.log(`[Calendar] Preserving user's current view: ${preservedYear}-${preservedMonth + 1}`);
    }

    // If an old instance exists, remove it cleanly
    if (window.calendarPicker && typeof window.calendarPicker.destroy === "function") {
      try { window.calendarPicker.destroy(); } catch(e){}
    }

    // Helper: set header filter to "YYYY Mon" when user changes month/year
    // From a year + 0-based month (for month navigation)
    function setMaturityHeaderFilterFromYearMonth(year, monthIndex) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const txt = `${year} ${months[Math.max(0, Math.min(11, monthIndex))]}`;
      setHeaderFilterTextDebounced("Maturity_Date_Fmt", txt);
      try { window.cointoolTable?.refreshFilter(); } catch (_) {}
    }

    // Helper: ensure Flatpickr header (month/year) isn't pushed down by vendor padding
    function __fixFlatpickrHeader(fpInstance){
      try {
        const root = fpInstance && fpInstance.calendarContainer;
        if (!root) return;
        const hdr = root.querySelector('.flatpickr-current-month');
        if (hdr) {
          hdr.style.paddingTop = '0px';
          hdr.style.padding = '0px';
        }
      } catch {}
    }

    // Flag to prevent onMonthChange from firing during programmatic restore
    let restoringCalendarView = false;

    // Create a fresh Flatpickr with badges and navigation hooks
    window.calendarPicker = flatpickr("#calendar", {
      inline: true,
      // Week starts on Monday
      locale: { firstDayOfWeek: 1 },

      onDayCreate: function(dObj, dStr, fp, dayElem){
        const dt = dayElem.dateObj;
        if (!dt) return;

        // Hide days from prev/next month (but keep grid alignment)
        const isOtherMonth = dayElem.classList.contains("prevMonthDay") ||
          dayElem.classList.contains("nextMonthDay");
        if (isOtherMonth) {
          dayElem.style.visibility = "hidden";
          dayElem.style.pointerEvents = "none";
          return;
        }

        // Allow pill to overflow
        dayElem.style.position = "relative";
        dayElem.style.overflow = "visible";

        // Clicking the day cell sets the header filter (full date)
        dayElem.addEventListener("click", function(){
          try { setMaturityHeaderFilterFromDate(dt); } catch(_) {}
        });

        // --- badge creation (sum VMUs) ---
        const key = buildDayKeyFromDate(dt);
        const count = dateMap[key];
        if (!count) return;

        const badge = document.createElement("span");
        badge.textContent = String(count);
        badge.style.position = "absolute";
        badge.style.top = "-2px";
        badge.style.right = "-2px";
        badge.style.minWidth = "18px";
        badge.style.height = "18px";
        badge.style.padding = "0 6px";
        badge.style.lineHeight = "18px";
        badge.style.textAlign = "center";
        badge.style.fontSize = "10px";
        badge.style.backgroundColor = "#063d85";
        badge.style.color = "yellow";
        badge.style.borderRadius = "999px";
        badge.style.cursor = "pointer";
        badge.style.whiteSpace = "nowrap";
        badge.style.zIndex = "2";

        badge.addEventListener("click", function(e){
          e.stopPropagation();
          try { setMaturityHeaderFilterFromDate(dt); } catch(_) {}
        });

        dayElem.appendChild(badge);
      },

      // ✅ New: when user navigates months/years via arrows or header,
      //        set the header filter to "YYYY Mon"
      onMonthChange: function(selectedDates, dateStr, fp){
        // Skip if we're programmatically restoring the view (not user navigation)
        if (restoringCalendarView) return;
        try { setMaturityHeaderFilterFromYearMonth(fp.currentYear, fp.currentMonth); } catch(_) {}
        __fixFlatpickrHeader(fp);
        // Update XEN total badge to reflect filtered data
        try { if (typeof updateXENTotalBadge === 'function') updateXENTotalBadge(); } catch(_) {}
      },
      onYearChange: function(selectedDates, dateStr, fp){
        // Skip if we're programmatically restoring the view (not user navigation)
        if (restoringCalendarView) return;
        try { setMaturityHeaderFilterFromYearMonth(fp.currentYear, fp.currentMonth); } catch(_) {}
        __fixFlatpickrHeader(fp);
        // Update XEN total badge to reflect filtered data
        try { if (typeof updateXENTotalBadge === 'function') updateXENTotalBadge(); } catch(_) {}
      },

      // Selecting a specific date (even if no badge) sets the header filter (full date)
      onChange: function(selectedDates){
        if (selectedDates && selectedDates.length) {
          try { setMaturityHeaderFilterFromDate(selectedDates[0]); } catch(_) {}
        } else {
          try {
            const input = document.querySelector(
              '.tabulator-col[tabulator-field="Maturity_Date_Fmt"] .tabulator-header-filter input'
            );
            if (input) {
              input.value = "";
              input.dispatchEvent(new Event("input",  { bubbles: true }));
              input.dispatchEvent(new Event("change", { bubbles: true }));
            }
          } catch(_) {}
        }
        // Update XEN total badge to reflect filtered data
        try { if (typeof updateXENTotalBadge === 'function') updateXENTotalBadge(); } catch(_) {}
      },
      onReady: function(selectedDates, dateStr, fp){
        __fixFlatpickrHeader(fp);
        // Restore preserved month/year after initialization
        if (preservedYear !== null && preservedMonth !== null) {
          try {
            // Set flag to prevent onMonthChange from firing during restoration
            restoringCalendarView = true;
            fp.changeMonth(preservedMonth, false);
            fp.changeYear(preservedYear);
            console.log(`[Calendar] Restored user's view to: ${preservedYear}-${preservedMonth + 1}`);
            // Reset flag after restoration
            restoringCalendarView = false;
          } catch(e) {
            console.warn('[Calendar] Failed to restore month/year:', e);
            restoringCalendarView = false;
          }
        }
      }
    });

    // Keep the bootstrap pointer synchronized with the live instance
    window._calendar = window.calendarPicker;
    // NEW: attach header → calendar sync
    attachMaturityHeaderSync();
  }


  function updateStakeXenftSummaryLine(){
    const container = document.getElementById("summaryContainer");
    if (!container) return;

    let line = document.getElementById("stakeXenftItemCount");
    if (!line) {
      line = document.createElement("div");
      line.id = "stakeXenftItemCount";
      line.style.marginTop = "4px";
      container.appendChild(line);
    }

    const all = (Array.isArray(window._allUnifiedRows) && window._allUnifiedRows.length)
      ? window._allUnifiedRows
      : (window.cointoolTable ? (window.cointoolTable.getData("all") || window.cointoolTable.getData("active")) : []);

    const sxf = all.filter(r => r.SourceType === "Stake XENFT");
    const count = sxf.length;
    const maturingCount = sxf.filter(r => r.Status === "Maturing").length;
    const claimableCount = sxf.filter(r => r.Status === "Claimable").length;

    line.innerHTML = `<strong>XENFT Stakes:</strong> ${count.toLocaleString()} | <strong>Maturing:</strong> ${maturingCount.toLocaleString()} | <strong>Claimable:</strong> ${claimableCount.toLocaleString()}`;
  }

  // Extend the summary with XENFT counts
  function updateXenftSummaryLine(){
    const container = document.getElementById("summaryContainer");
    if (!container) return;

    let line = document.getElementById("xenftItemCount");
    if (!line) {
      line = document.createElement("div");
      line.id = "xenftItemCount";
      line.style.marginTop = "6px";
      container.appendChild(line);
    }

    // Overall, unfiltered data
    const all = (Array.isArray(window._allUnifiedRows) && window._allUnifiedRows.length)
      ? window._allUnifiedRows
      : (window.cointoolTable ? (window.cointoolTable.getData("all") || window.cointoolTable.getData("active")) : []);

    const xf = all.filter(r => r.SourceType === "XENFT");
    const xfCount = xf.length;
    const xfVMUs  = xf.reduce((s, r) => s + (Number(r.VMUs)||0), 0);
    const apex     = xf.filter(r => String(r.Category||"").toLowerCase() === "apex").length;
    const collector= xf.filter(r => String(r.Category||"").toLowerCase() === "collector").length;
    const limited  = xf.filter(r => String(r.Class||"").toLowerCase() === "limited").length;

    const maturingVMUs = xf.filter(r => r.Status === "Maturing").reduce((s, r) => s + (Number(r.VMUs)||0), 0);
    const claimableCount = xf.filter(r => r.Status === "Claimable").length;

    line.innerHTML = `<strong>XENFTs:</strong> ${xfCount.toLocaleString()}
    | <strong>Total VMUs:</strong> ${xfVMUs.toLocaleString()} (Apex: ${apex.toLocaleString()} | Collector: ${collector.toLocaleString()} | Limited: ${limited.toLocaleString()})
    | <strong>Maturing:</strong> ${maturingVMUs.toLocaleString()} | <strong>Claimable:</strong> ${claimableCount.toLocaleString()}`;
  }





  // Unified refresh: columns + merge + summary + calendar
  async function refreshUnified(){
    if (!window.cointoolTable) return;

    ensureUnifiedColumns();

    const ctRows = await fetchCointoolRows();
    const xfRows = await fetchXenftRows();
    const stakeXfRows = await fetchStakeXenftRows();
    const stakeRows   = await fetchStakeRows();

    const merged = ctRows.map(r => { r.SourceType = "Cointool"; return r; })
      .concat(xfRows.map(mapXenftToRow))
      .concat(stakeXfRows.map(mapStakeXenftToRow))
      .concat(stakeRows.map(mapStakeToRow));

    // Cache an unfiltered snapshot for global stats
    window._allUnifiedRows = merged.slice();

    // Replace data without losing filters/formatters
    window.cointoolTable.replaceData(merged);
    const hasNonCointool = (xfRows.length + stakeXfRows.length + stakeRows.length) > 0;
    clearXenftBlockingFilters(hasNonCointool);

    // Update summary & calendar (now read from _allUnifiedRows)
    if (typeof updateSummaryStats === "function") { try { updateSummaryStats(); } catch(_){} }
    try { updateXenftSummaryLine(); } catch(_) {}
    try { updateStakeXenftSummaryLine(); } catch(_) {}
    try { updateStakeSummaryLine(); } catch(_) {} // ✅ ADD THIS LINE
    try { await updateUnifiedCalendar(); } catch(_) {}
  }


  // Keep merged after any CoinTool refreshes
  function attachGuards(){
    if (!window.cointoolTable) return;
    if (!window._unifyWrappedPopulate && typeof window.populateTable === "function") {
      var _origPopulate = window.populateTable;
      window.populateTable = function(mints){
        _origPopulate(mints);
        if (typeof window.refreshUnified === "function") window.refreshUnified();
      };
      window._unifyWrappedPopulate = true;
    }

    if (!window.cointoolTable._unifyPatched) {
      var _origReplace = window.cointoolTable.replaceData.bind(window.cointoolTable);
      var _merging = false;
      window.cointoolTable.replaceData = async function(data){
        var res = await _origReplace(data);
        if (!_merging && typeof window.refreshUnified === "function") {
          _merging = true; try { await window.refreshUnified(); } finally { _merging = false; }
        }
        return res;
      };
      window.cointoolTable._unifyPatched = true;
    }

    // Always use unified calendar
    if (typeof window.updateCalendar === "function" && !window._unifyWrappedCalendar) {
      window.updateCalendar = function(){ return updateUnifiedCalendar(); };
      window._unifyWrappedCalendar = true;
    }
  }

  // Re-render when the user changes cointoolMaxVmuPerTx — batch sizes
  // depend on it, so the table needs to regroup.
  function wireMaxVmuListener(){
    const input = document.getElementById('cointoolMaxVmuPerTx');
    if (!input || input._unifyWired) return;
    input._unifyWired = true;
    let t = null;
    const trigger = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { try { refreshUnified(); } catch(_){} }, 200);
    };
    input.addEventListener('change', trigger);
    input.addEventListener('input', trigger);
  }

  // Boot
  ensureXenftScanButton();
  whenTableReady(function(){
    attachGuards();
    window.refreshUnified = refreshUnified;
    wireMaxVmuListener();
    refreshUnified();
  });
})();
