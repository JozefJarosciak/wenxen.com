
// === UNIFIED VIEW (CoinTool + XENFT) ===
// Goal: one table (#cointool-table) that includes BOTH CoinTool mints and XENFTs.
// - Adds a "Scan XENFTs" button next to your existing Scan button
// - Appends XENFT-specific columns to the CoinTool table
// - Merges data and keeps it merged after CoinTool refreshes
// - Calendar shows total VMUs across both
// - Summary gets an extra XENFT line

function getSummaryCacheForType(type) {
  return window._summaryStatsCache?.byType?.[type] || null;
}

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

  const cached = getSummaryCacheForType("Stake");
  let count;
  let maturingCount;
  let claimableCount;
  if (cached) {
    count = cached.totalCount || 0;
    maturingCount = cached.maturing || 0;
    claimableCount = cached.claimable || 0;
  } else {
    const all = (Array.isArray(window._allUnifiedRows) && window._allUnifiedRows.length)
      ? window._allUnifiedRows
      : (window.cointoolTable ? (window.cointoolTable.getData("all") || window.cointoolTable.getData("active")) : []);

    const s = all.filter(r => r.SourceType === "Stake");
    count = s.length;
    maturingCount = s.filter(r => r.Status === "Maturing").length;
    claimableCount = s.filter(r => r.Status === "Claimable").length;
  }

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
    window.__wenxenScanCancelRequested = false;
    let stoppedByUser = false;
    const shouldStop = () => stoppedByUser || window.__wenxenScanCancelRequested === true;
    const markStopped = () => {
      stoppedByUser = true;
      window.__wenxenScanCancelRequested = true;
      const lbl = document.getElementById("scanBtnLabel");
      if (lbl) lbl.textContent = "Stopping...";
      if (stopBtn) {
        stopBtn.disabled = true;
        stopBtn.textContent = "Stopping...";
      }
      try { window.progressUI?.setType?.("Stopping scan"); } catch {}
    };

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
        stopBtn.disabled = false;
        stopBtn.textContent = "Stop Scan";
        stopBtn.onclick = markStopped;
      }
    } catch {}

    // If Force Rescan is checked, confirm and CLEAR stores for the selected mode first (fast path)
    try {
      const force = !!document.getElementById('forceRescan')?.checked;
      if (force) {
        const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
        const dbNames = window.chainManager?.getDatabaseNames?.(currentChain) || {
          cointool: 'ETH_DB_Cointool',
          xenft: 'ETH_DB_Xenft',
          xenft_stake: 'ETH_DB_XenftStake',
          xen_stake: 'ETH_DB_XenStake'
        };
        
        const dbIds = (
          mode === 'all' ? [dbNames.cointool, dbNames.xenft, dbNames.xenft_stake, dbNames.xen_stake] :
          mode === 'cointool' ? [dbNames.cointool] :
          mode === 'xenft' ? [dbNames.xenft] :
          mode === 'stake-xenft' ? [dbNames.xenft_stake] :
          mode === 'stake' ? [dbNames.xen_stake] :
          [dbNames.cointool]
        );

        const friendly = (id) => {
          const baseId = id.replace(/^[A-Z0-9]+_/, '');
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

        const ok = typeof window.wenxenConfirm === 'function'
          ? await window.wenxenConfirm({
              title: 'Force rescan',
              message: title,
              confirmText: 'Reset and scan'
            })
          : confirm(title);
        if (!ok) {
          if (modeToggleEl) modeToggleEl.disabled = false;
          liveScanBtn.disabled = false;
          liveScanBtn.removeAttribute("aria-busy");
          const lbl = document.getElementById("scanBtnLabel");
          if (lbl) lbl.textContent = liveScanBtn.dataset.prevText || "Scan";
          if (stopBtn) { stopBtn.style.display = "none"; stopBtn.onclick = null; stopBtn.disabled = false; }
          try { window.progressUI?.show?.(false); } catch (_) {}
          return; // user canceled
        }

        // Immediate UI feedback while clearing
        document.getElementById("scanBtnLabel").textContent = "Preparing rescan…";
        liveScanBtn.disabled = true;
        liveScanBtn.setAttribute("aria-busy", "true");

        // Run clears in parallel for speed (no DB deletion to avoid blocking)
        const tasks = dbIds.map((id) => {
          const baseId = id.replace(/^[A-Z0-9]+_/, '');
          
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
          if (modeToggleEl) modeToggleEl.disabled = false;
          liveScanBtn.disabled = false;
          liveScanBtn.removeAttribute("aria-busy");
          const lbl = document.getElementById("scanBtnLabel");
          if (lbl) lbl.textContent = liveScanBtn.dataset.prevText || "Scan";
          if (stopBtn) { stopBtn.style.display = "none"; stopBtn.onclick = null; stopBtn.disabled = false; }
          try { window.progressUI?.show?.(false); } catch (_) {}
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

    const previousUnifiedScanState = window.__scanUnifiedActive;
    window.__scanUnifiedActive = true;

    try {
      // If we're scanning everything, keep the progress bar under our control
      if (mode === "all") {
        window.__scanAllActive = true;
        if (window.progressUI) window.progressUI.show(true);
      }

      // Step 1: Run the actual data scans (sequential)
      if (mode === "all") {
        if (typeof window.scanMints === "function") { await window.scanMints(); }
        if (shouldStop()) return;
        if (window.xenft && typeof window.xenft.scan === "function") { await window.xenft.scan(); }
        if (shouldStop()) return;
        if (window.xenftStake && typeof window.xenftStake.scan === "function") { await window.xenftStake.scan(); }
        if (shouldStop()) return;
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
      const cancelled = shouldStop();
      window.__wenxenScanCancelRequested = false;
      window.__scanUnifiedActive = previousUnifiedScanState;

      // Step 2: Restore the buttons right away
      if (typeof window.validateInputs === "function") {
        try { window.validateInputs(); } catch { liveScanBtn.disabled = false; }
      } else {
        liveScanBtn.disabled = false;
      }
      if (modeToggleEl) modeToggleEl.disabled = false;
      const lbl = document.getElementById("scanBtnLabel");
      if (lbl) {
        lbl.textContent = liveScanBtn.dataset.prevText || "Scan";
      } else {
        // fallback if label span missing
        liveScanBtn.textContent = liveScanBtn.dataset.prevText || "Scan All";
      }
      liveScanBtn.removeAttribute("aria-busy");
      if (stopBtn) { stopBtn.style.display = "none"; stopBtn.onclick = null; stopBtn.disabled = false; }
      if (cancelled) {
        try { window.progressUI?.setType?.("Scan stopped"); } catch (_) {}
      }

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
      } else {
        setTimeout(() => {
          try { window.progressUI?.show?.(false); } catch (_) {}
        }, 400);
      }
    }

    if (stoppedByUser) return;

    // Finally, uncheck the Force Rescan option after a completed scan
    try { const cb = document.getElementById('forceRescan'); if (cb) cb.checked = false; } catch {}

    // Step 3: Auto-remove duplicates before the single final UI refresh.
    try {
      const autoDedupeEnabled = localStorage.getItem('autoDedupeAfterScan') === 'true';
      if (autoDedupeEnabled && typeof window.removeDuplicatesFromAllDatabases === 'function') {
        console.log('[Scan] Running auto-dedupe after scan...');
        const removed = await window.removeDuplicatesFromAllDatabases(true, { refresh: false, scope: 'current' }); // silent mode
        if (removed > 0) {
          console.log(`[Scan] Auto-dedupe removed ${removed} duplicates`);
          // Update last cleanup time
          localStorage.setItem('duplicatesLastCleanup', String(Date.now()));
          // Update the display if function exists
          if (typeof window.updateLastCleanupDisplay === 'function') {
            window.updateLastCleanupDisplay();
          }
        }
      }
    } catch (e) {
      console.warn('[Scan] Auto-dedupe failed:', e);
    }

    // Step 4: Refresh the UI once after all selected scans and optional dedupe.
    if (typeof window.refreshUnified === "function") {
      try {
        await window.refreshUnified();
      } catch (e) {
        console.error("Unified refresh failed:", e);
      }
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
    const cal = window.calendarController?.get?.() || null;
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
    const cal = window.calendarController?.get?.() || null;
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

  function _yieldToBrowser() {
    if (typeof window.yieldToUi === 'function') return window.yieldToUi();
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  async function _readStoreInBatches(db, storeName, batchSize = 5000) {
    const out = [];
    let range = null;

    while (true) {
      const { rows, keys } = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const rowsReq = store.getAll(range, batchSize);
        const keysReq = store.getAllKeys(range, batchSize);

        let rows = null;
        let keys = null;
        const finish = () => {
          if (rows !== null && keys !== null) resolve({ rows, keys });
        };

        rowsReq.onsuccess = () => {
          rows = rowsReq.result || [];
          finish();
        };
        keysReq.onsuccess = () => {
          keys = keysReq.result || [];
          finish();
        };
        rowsReq.onerror = () => reject(rowsReq.error);
        keysReq.onerror = () => reject(keysReq.error);
        tx.onerror = () => reject(tx.error);
      });

      if (!rows.length) break;
      out.push(...rows);
      if (rows.length < batchSize || !keys.length) break;
      range = IDBKeyRange.lowerBound(keys[keys.length - 1], true);
      await _yieldToBrowser();
    }

    return out;
  }

  const COINTOOL_RENDER_CACHE_VERSION = 2;
  const COINTOOL_RENDER_CACHE_CHUNK_SIZE = 250;
  const COINTOOL_SUMMARY_VERSION = 1;
  const COINTOOL_SUMMARY_STORES = ['summaryByType', 'summaryByStatus', 'summaryByDay', 'summaryByOwner', 'summaryMetadata'];

  function _currentChainKey() {
    return window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
  }

  function _renderCacheInvalidationKey() {
    return `${_currentChainKey()}_cointoolRenderCacheInvalidatedAt`;
  }

  function _renderCacheBaseKey(maxPerBatch) {
    return `__renderCache_v${COINTOOL_RENDER_CACHE_VERSION}_${maxPerBatch}`;
  }

  function _getRenderCacheInvalidatedAt() {
    return Number(localStorage.getItem(_renderCacheInvalidationKey()) || 0) || 0;
  }

  function _hasCointoolSummaryStores(db) {
    return !!db?.objectStoreNames && COINTOOL_SUMMARY_STORES.every(storeName => db.objectStoreNames.contains(storeName));
  }

  function _emptyCounter() {
    return {
      totalCount: 0,
      totalVMUs: 0,
      remints: 0,
      maturing: 0,
      claimable: 0,
      mintable: 0,
      failed: 0,
      claimed: 0,
      unknown: 0,
      xenRewards: 0
    };
  }

  function _addCounter(counter, status, vmus, hasHistory) {
    counter.totalVMUs += vmus;
    if (hasHistory) counter.remints += vmus;
    if (status === 'Maturing') counter.maturing += vmus;
    else if (status === 'Claimable') counter.claimable += vmus;
    else if (status === 'Mintable') counter.mintable += vmus;
    else if (status === 'Failed') counter.failed += vmus;
    else if (status === 'Claimed') counter.claimed += vmus;
    else counter.unknown += vmus;
  }

  function _buildCointoolSummaryIndexFromProxies(proxies, maxPerBatch) {
    const nowSec = Math.floor(Date.now() / 1000);
    const typeStats = _emptyCounter();
    const statusMap = new Map();
    const dayMap = new Map();
    const ownerMap = new Map();
    const groupMap = new Map();
    const dateKeyCache = new Map();

    const getCachedDateKey = (ts) => {
      const n = Number(ts) || 0;
      if (n <= 0) return '';
      if (!dateKeyCache.has(n)) dateKeyCache.set(n, _localDateKeyFromSeconds(n));
      return dateKeyCache.get(n);
    };

    for (const proxy of proxies) {
      const owner = String(proxy?.Owner || '').toLowerCase();
      const status = _effectiveStatusFromProxy(proxy, nowSec) || 'Unknown';
      const dayKey = getCachedDateKey(proxy?.Maturity_TS);
      const hasHistory = Array.isArray(proxy?.History) && proxy.History.length > 0;
      const vmus = 1;

      _addCounter(typeStats, status, vmus, hasHistory);

      if (!statusMap.has(status)) {
        statusMap.set(status, { ..._emptyCounter(), id: `Cointool|${status}|${maxPerBatch}`, type: 'Cointool', status, maxPerBatch });
      }
      _addCounter(statusMap.get(status), status, vmus, hasHistory);

      if (owner) {
        if (!ownerMap.has(owner)) {
          ownerMap.set(owner, { ..._emptyCounter(), id: `Cointool|${owner}|${maxPerBatch}`, type: 'Cointool', owner, maxPerBatch });
        }
        _addCounter(ownerMap.get(owner), status, vmus, hasHistory);
      }

      if (dayKey && status !== 'Claimed' && status !== 'Failed' && status !== 'Unknown') {
        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, {
            id: `Cointool|${dayKey}`,
            type: 'Cointool',
            date: dayKey,
            totalVMUs: 0,
            maturing: 0,
            claimable: 0,
            mintable: 0
          });
        }
        const day = dayMap.get(dayKey);
        day.totalVMUs += vmus;
        if (status === 'Maturing') day.maturing += vmus;
        else if (status === 'Claimable') day.claimable += vmus;
        else if (status === 'Mintable') day.mintable += vmus;
      }

      const groupKey = `${owner}|${String(proxy?.Salt || '').toLowerCase()}|${status}|${proxy?.Term || 0}|${dayKey}`;
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, { owner, status, count: 0 });
      groupMap.get(groupKey).count += 1;
    }

    for (const group of groupMap.values()) {
      const batchCount = Math.ceil(group.count / maxPerBatch);
      typeStats.totalCount += batchCount;
      const status = statusMap.get(group.status);
      if (status) status.totalCount += batchCount;
      const owner = ownerMap.get(group.owner);
      if (owner) owner.totalCount += batchCount;
    }

    const builtAt = Date.now();
    const invalidatedAt = _getRenderCacheInvalidatedAt();
    const byType = [{
      id: `Cointool|${maxPerBatch}`,
      type: 'Cointool',
      maxPerBatch,
      ...typeStats,
      updatedAt: builtAt
    }];
    const byStatus = Array.from(statusMap.values()).map(row => ({ ...row, updatedAt: builtAt }));
    const byDay = Array.from(dayMap.values()).map(row => ({ ...row, updatedAt: builtAt }));
    const byOwner = Array.from(ownerMap.values()).map(row => ({ ...row, updatedAt: builtAt }));
    const metadata = {
      id: 'cointool',
      version: COINTOOL_SUMMARY_VERSION,
      type: 'Cointool',
      maxPerBatch,
      proxyCount: proxies.length,
      groupCount: groupMap.size,
      builtAt,
      invalidatedAt,
      updatedAt: builtAt
    };

    return _normalizeCointoolSummaryIndex({ metadata, byType, byStatus, byDay, byOwner });
  }

  function _normalizeCointoolSummaryIndex(index) {
    const byTypeMap = Object.create(null);
    const byStatusMap = Object.create(null);
    const byDayMap = Object.create(null);
    const byOwnerMap = Object.create(null);
    for (const row of index.byType || []) byTypeMap[row.type] = row;
    for (const row of index.byStatus || []) byStatusMap[row.status] = row;
    for (const row of index.byDay || []) byDayMap[row.date] = row;
    for (const row of index.byOwner || []) byOwnerMap[row.owner] = row;
    return {
      metadata: index.metadata || null,
      byType: byTypeMap,
      byStatus: byStatusMap,
      byDay: byDayMap,
      byOwner: byOwnerMap,
      raw: {
        byType: index.byType || [],
        byStatus: index.byStatus || [],
        byDay: index.byDay || [],
        byOwner: index.byOwner || []
      }
    };
  }

  async function _readCointoolSummaryIndex(maxPerBatch = _getMaxVmuPerTx()) {
    try {
      const db = window.cointoolDb || window.dbInstance;
      if (!_hasCointoolSummaryStores(db)) return null;
      const [metadata, byType, byStatus, byDay, byOwner] = await Promise.all([
        new Promise((resolve, reject) => {
          const tx = db.transaction('summaryMetadata', 'readonly');
          const req = tx.objectStore('summaryMetadata').get('cointool');
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        }),
        _readStoreInBatches(db, 'summaryByType', 1000),
        _readStoreInBatches(db, 'summaryByStatus', 1000),
        _readStoreInBatches(db, 'summaryByDay', 5000),
        _readStoreInBatches(db, 'summaryByOwner', 1000)
      ]);

      if (!metadata || metadata.version !== COINTOOL_SUMMARY_VERSION || metadata.maxPerBatch !== maxPerBatch) return null;
      if (Number(metadata.builtAt || 0) < _getRenderCacheInvalidatedAt()) return null;
      return _normalizeCointoolSummaryIndex({ metadata, byType, byStatus, byDay, byOwner });
    } catch (_) {
      return null;
    }
  }

  async function _writeCointoolSummaryIndex(index) {
    const db = window.cointoolDb || window.dbInstance;
    if (!_hasCointoolSummaryStores(db) || !index?.metadata) return false;

    await new Promise((resolve, reject) => {
      const tx = db.transaction(COINTOOL_SUMMARY_STORES, 'readwrite');
      for (const storeName of COINTOOL_SUMMARY_STORES) {
        tx.objectStore(storeName).clear();
      }
      for (const row of index.raw.byType || []) tx.objectStore('summaryByType').put(row);
      for (const row of index.raw.byStatus || []) tx.objectStore('summaryByStatus').put(row);
      for (const row of index.raw.byDay || []) tx.objectStore('summaryByDay').put(row);
      for (const row of index.raw.byOwner || []) tx.objectStore('summaryByOwner').put(row);
      tx.objectStore('summaryMetadata').put(index.metadata);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('summary write aborted'));
    });

    return true;
  }

  async function _buildCointoolSummaryIndex(proxies, maxPerBatch) {
    const started = performance?.now?.() || Date.now();
    const isCancellation = error => /cancel|chain-change|backup-import|chunk-size/i.test(error?.message || '');
    try {
      if (window.wenxen?.workerClient?.isAvailable?.()) {
        const raw = await window.wenxen.workerClient.run('buildCointoolSummary', {
          proxies,
          maxPerBatch,
          invalidatedAt: _getRenderCacheInvalidatedAt(),
          nowSec: Math.floor(Date.now() / 1000)
        }, {
          jobName: 'summary:cointool',
          meta: { records: proxies.length, maxPerBatch }
        });
        window.wenxen?.perf?.set?.('lastSummaryRebuildMs', Math.round((performance?.now?.() || Date.now()) - started));
        return _normalizeCointoolSummaryIndex(raw);
      }
    } catch (error) {
      if (isCancellation(error)) throw error;
      window.wenxen?.perf?.event?.({ type: 'worker-fallback', task: 'buildCointoolSummary', message: error?.message || String(error) });
    }

    const index = _buildCointoolSummaryIndexFromProxies(proxies, maxPerBatch);
    window.wenxen?.perf?.set?.('lastSummaryRebuildMs', Math.round((performance?.now?.() || Date.now()) - started));
    return index;
  }

  async function _buildCointoolRenderData(proxies, maxPerBatch) {
    const started = performance?.now?.() || Date.now();
    const isCancellation = error => /cancel|chain-change|backup-import|chunk-size/i.test(error?.message || '');
    try {
      if (window.wenxen?.workerClient?.isAvailable?.()) {
        const result = await window.wenxen.workerClient.run('buildCointoolRenderData', {
          proxies,
          maxPerBatch,
          invalidatedAt: _getRenderCacheInvalidatedAt(),
          nowSec: Math.floor(Date.now() / 1000)
        }, {
          jobName: 'render:cointool',
          meta: { records: proxies.length, maxPerBatch }
        });
        const elapsedMs = Math.round((performance?.now?.() || Date.now()) - started);
        window.wenxen?.perf?.set?.('lastCointoolGroupingMs', elapsedMs);
        window.wenxen?.perf?.set?.('lastCointoolGroupingSource', 'worker');
        window.wenxen?.perf?.set?.('lastSummaryRebuildMs', elapsedMs);
        return {
          rows: Array.isArray(result?.rows) ? result.rows : [],
          summary: result?.summary ? _normalizeCointoolSummaryIndex(result.summary) : null,
          source: 'worker',
          elapsedMs
        };
      }
    } catch (error) {
      if (isCancellation(error)) throw error;
      window.wenxen?.perf?.event?.({ type: 'worker-fallback', task: 'buildCointoolRenderData', message: error?.message || String(error) });
    }

    const summary = _buildCointoolSummaryIndexFromProxies(proxies, maxPerBatch);
    const rows = await _groupAndChunkProxies(proxies, maxPerBatch);
    const elapsedMs = Math.round((performance?.now?.() || Date.now()) - started);
    window.wenxen?.perf?.set?.('lastCointoolGroupingMs', elapsedMs);
    window.wenxen?.perf?.set?.('lastCointoolGroupingSource', 'main-thread');
    window.wenxen?.perf?.set?.('lastSummaryRebuildMs', elapsedMs);
    return { rows, summary, source: 'main-thread', elapsedMs };
  }

  async function _loadOrBuildCointoolSummaryIndex(options = {}) {
    const maxPerBatch = options.maxPerBatch || _getMaxVmuPerTx();
    let index = await _readCointoolSummaryIndex(maxPerBatch);
    if (index) {
      window._cointoolSummaryIndex = index;
      return index;
    }

    if (!options.allowRebuild && !Array.isArray(options.proxies)) return null;
    const proxies = Array.isArray(options.proxies) ? options.proxies : await _readAllProxies();
    if (!proxies.length) return null;

    index = await _buildCointoolSummaryIndex(proxies, maxPerBatch);
    window._cointoolSummaryIndex = index;
    _writeCointoolSummaryIndex(index).catch(() => {});
    return index;
  }

  function _emptyRowTypeSummary(type) {
    if (type === 'XENFT') {
      return { totalCount: 0, totalVMUs: 0, apex: 0, collector: 0, limited: 0, maturing: 0, claimable: 0, xenRewards: 0 };
    }
    return { totalCount: 0, totalVMUs: 0, maturing: 0, claimable: 0, xenRewards: 0 };
  }

  function _summaryMetadataId(type) {
    return String(type || '').toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'summary';
  }

  function _statusForSummary(row) {
    try {
      if (typeof window.computeLiveStatus === 'function') return window.computeLiveStatus(row);
    } catch (_) {}
    return String(row?.Status || row?.status || 'Unknown');
  }

  function _dateKeyForSummary(row) {
    const direct = String(row?.maturityDateOnly || '').trim();
    if (direct) return direct;
    try {
      if (typeof rowToLocalKey === 'function') return rowToLocalKey(row) || '';
    } catch (_) {}
    const ts = Number(row?.Maturity_Timestamp || row?.Maturity_TS || row?.maturityTs || 0);
    if (!Number.isFinite(ts) || ts <= 0) return '';
    return _localDateKeyFromSeconds(ts);
  }

  function _addRowSummaryTotals(target, row, type, status) {
    const vmus = Number(row?.VMUs || 0) || 0;
    target.totalCount = Number(target.totalCount || 0) + 1;
    target.totalVMUs = Number(target.totalVMUs || 0) + vmus;

    if (type === 'XENFT') {
      const category = String(row?.Category || '').toLowerCase();
      const klass = String(row?.Class || '').toLowerCase();
      if (category === 'apex') target.apex = Number(target.apex || 0) + 1;
      if (category === 'collector') target.collector = Number(target.collector || 0) + 1;
      if (klass === 'limited') target.limited = Number(target.limited || 0) + 1;
      if (status === 'Maturing') target.maturing = Number(target.maturing || 0) + vmus;
      if (status === 'Claimable') target.claimable = Number(target.claimable || 0) + 1;
      return;
    }

    if (status === 'Maturing') target.maturing = Number(target.maturing || 0) + 1;
    if (status === 'Claimable') target.claimable = Number(target.claimable || 0) + 1;
  }

  function _buildRowSummaryIndex(type, rows, sourceCount = rows?.length || 0) {
    const typeStats = _emptyRowTypeSummary(type);
    const statusMap = new Map();
    const dayMap = new Map();
    const ownerMap = new Map();
    const builtAt = Date.now();

    for (const row of rows || []) {
      const status = _statusForSummary(row) || 'Unknown';
      const owner = String(row?.Owner || row?.owner || '').toLowerCase();
      const vmus = Number(row?.VMUs || 0) || 0;

      _addRowSummaryTotals(typeStats, row, type, status);

      if (!statusMap.has(status)) {
        statusMap.set(status, { id: `${type}|${status}`, type, status, ..._emptyRowTypeSummary(type) });
      }
      _addRowSummaryTotals(statusMap.get(status), row, type, status);

      if (owner) {
        if (!ownerMap.has(owner)) {
          ownerMap.set(owner, { id: `${type}|${owner}`, type, owner, ..._emptyRowTypeSummary(type) });
        }
        _addRowSummaryTotals(ownerMap.get(owner), row, type, status);
      }

      const isDone = status === 'Claimed' || status === 'Failed' || status === 'Unknown' || status === 'Ended Early' || Number(row?.redeemed || 0) === 1;
      const dayKey = _dateKeyForSummary(row);
      if (!isDone && dayKey && vmus > 0) {
        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, { id: `${type}|${dayKey}`, type, date: dayKey, totalVMUs: 0, maturing: 0, claimable: 0 });
        }
        const day = dayMap.get(dayKey);
        day.totalVMUs += vmus;
        if (status === 'Maturing') day.maturing += vmus;
        if (status === 'Claimable') day.claimable += vmus;
      }
    }

    const byType = [{ id: type, type, ...typeStats, updatedAt: builtAt }];
    const byStatus = Array.from(statusMap.values()).map(row => ({ ...row, updatedAt: builtAt }));
    const byDay = Array.from(dayMap.values()).map(row => ({ ...row, updatedAt: builtAt }));
    const byOwner = Array.from(ownerMap.values()).map(row => ({ ...row, updatedAt: builtAt }));
    const metadata = {
      id: _summaryMetadataId(type),
      version: COINTOOL_SUMMARY_VERSION,
      type,
      sourceCount,
      builtAt,
      updatedAt: builtAt
    };

    return _normalizeRowSummaryIndex({ metadata, byType, byStatus, byDay, byOwner });
  }

  function _normalizeRowSummaryIndex(index) {
    const byTypeMap = Object.create(null);
    const byStatusMap = Object.create(null);
    const byDayMap = Object.create(null);
    const byOwnerMap = Object.create(null);
    for (const row of index.byType || []) byTypeMap[row.type] = row;
    for (const row of index.byStatus || []) byStatusMap[row.status] = row;
    for (const row of index.byDay || []) byDayMap[row.date] = row;
    for (const row of index.byOwner || []) byOwnerMap[row.owner] = row;
    return {
      metadata: index.metadata || null,
      byType: byTypeMap,
      byStatus: byStatusMap,
      byDay: byDayMap,
      byOwner: byOwnerMap,
      raw: {
        byType: index.byType || [],
        byStatus: index.byStatus || [],
        byDay: index.byDay || [],
        byOwner: index.byOwner || []
      }
    };
  }

  function _setSummaryIndexForType(type, index) {
    if (!index) return null;
    window._summaryIndexByType = window._summaryIndexByType || {};
    window._summaryIndexByType[type] = index;
    return index;
  }

  async function _readRowSummaryIndex(db, type) {
    try {
      if (!_hasCointoolSummaryStores(db)) return null;
      const metadataId = _summaryMetadataId(type);
      const [metadata, byTypeRows, byStatusRows, byDayRows, byOwnerRows] = await Promise.all([
        new Promise((resolve, reject) => {
          const tx = db.transaction('summaryMetadata', 'readonly');
          const req = tx.objectStore('summaryMetadata').get(metadataId);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        }),
        _readStoreInBatches(db, 'summaryByType', 1000),
        _readStoreInBatches(db, 'summaryByStatus', 1000),
        _readStoreInBatches(db, 'summaryByDay', 5000),
        _readStoreInBatches(db, 'summaryByOwner', 1000)
      ]);

      if (!metadata || metadata.version !== COINTOOL_SUMMARY_VERSION || metadata.type !== type) return null;
      return _normalizeRowSummaryIndex({
        metadata,
        byType: byTypeRows.filter(row => row?.type === type),
        byStatus: byStatusRows.filter(row => row?.type === type),
        byDay: byDayRows.filter(row => row?.type === type),
        byOwner: byOwnerRows.filter(row => row?.type === type)
      });
    } catch (_) {
      return null;
    }
  }

  async function _writeRowSummaryIndex(db, index) {
    if (!_hasCointoolSummaryStores(db) || !index?.metadata) return false;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(COINTOOL_SUMMARY_STORES, 'readwrite');
      for (const storeName of COINTOOL_SUMMARY_STORES) {
        tx.objectStore(storeName).clear();
      }
      for (const row of index.raw.byType || []) tx.objectStore('summaryByType').put(row);
      for (const row of index.raw.byStatus || []) tx.objectStore('summaryByStatus').put(row);
      for (const row of index.raw.byDay || []) tx.objectStore('summaryByDay').put(row);
      for (const row of index.raw.byOwner || []) tx.objectStore('summaryByOwner').put(row);
      tx.objectStore('summaryMetadata').put(index.metadata);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('summary write aborted'));
    });
    return true;
  }

  async function _loadOrBuildRowSummaryIndex(options = {}) {
    const { db, type } = options;
    if (!db || !type) return null;

    if (!Array.isArray(options.rows)) {
      const existing = await _readRowSummaryIndex(db, type);
      if (existing) return _setSummaryIndexForType(type, existing);
      if (!options.allowRebuild) return null;
    }

    const rows = Array.isArray(options.rows) ? options.rows : [];
    const index = _buildRowSummaryIndex(type, rows, options.sourceCount ?? rows.length);
    _setSummaryIndexForType(type, index);
    _writeRowSummaryIndex(db, index).catch(() => {});
    return index;
  }

  async function _loadExistingNonCointoolSummaryIndexes() {
    const specs = [
      { type: 'XENFT', api: window.xenft },
      { type: 'Stake XENFT', api: window.xenftStake },
      { type: 'Stake', api: window.xenStake }
    ];
    let loadedAny = false;
    await Promise.all(specs.map(async spec => {
      try {
        if (!spec.api || typeof spec.api.openDB !== 'function') return;
        const db = await spec.api.openDB();
        try {
          const index = await _loadOrBuildRowSummaryIndex({ db, type: spec.type, allowRebuild: false });
          if (index) loadedAny = true;
        } finally {
          try { db.close(); } catch (_) {}
        }
      } catch (_) {}
    }));
    return loadedAny;
  }

  window.invalidateCointoolRenderCache = window.invalidateCointoolRenderCache || function() {
    try {
      localStorage.setItem(_renderCacheInvalidationKey(), String(Date.now()));
    } catch (_) {}
  };

  function _scanStateGet(db, key) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('scanState', 'readonly');
        const req = tx.objectStore('scanState').get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      } catch (e) { resolve(null); }
    });
  }

  function _scanStatePut(db, row) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('scanState', 'readwrite');
        tx.objectStore('scanState').put(row);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) { resolve(); }
    });
  }

  function _hydrateCachedCointoolRows(rows) {
    const nowSec = Math.floor(Date.now() / 1000);
    return rows.map(row => {
      if (!row || row.SourceType !== 'Cointool') return row;
      const ts = Number(row.Maturity_Timestamp || 0);
      if (row.Status === 'Maturing' && Number.isFinite(ts) && ts > 0 && ts <= nowSec) {
        return { ...row, Status: 'Claimable' };
      }
      return row;
    });
  }

  async function _readCointoolRenderCache(maxPerBatch) {
    try {
      const db = window.cointoolDb || window.dbInstance;
      window.wenxen?.perf?.set?.('renderCacheVersion', COINTOOL_RENDER_CACHE_VERSION);
      if (!db?.objectStoreNames?.contains?.('scanState')) {
        window.wenxen?.perf?.set?.('renderCacheStatus', 'unavailable');
        return null;
      }
      const baseKey = _renderCacheBaseKey(maxPerBatch);
      const meta = await _scanStateGet(db, `${baseKey}:meta`);
      if (!meta || meta.version !== COINTOOL_RENDER_CACHE_VERSION || meta.maxPerBatch !== maxPerBatch) {
        window.wenxen?.perf?.set?.('renderCacheStatus', 'miss');
        return null;
      }
      if (!Number.isFinite(Number(meta.createdAt)) || Number(meta.createdAt) < _getRenderCacheInvalidatedAt()) {
        window.wenxen?.perf?.set?.('renderCacheStatus', 'stale');
        return null;
      }
      const chunks = Number(meta.chunks || 0);
      if (!Number.isFinite(chunks) || chunks <= 0) return [];

      const rows = [];
      for (let i = 0; i < chunks; i++) {
        const chunk = await _scanStateGet(db, `${baseKey}:chunk:${i}`);
        if (!chunk || !Array.isArray(chunk.rows)) return null;
        rows.push(...chunk.rows);
        if (i % 4 === 3) await _yieldToBrowser();
      }
      window.wenxen?.perf?.set?.('renderCacheStatus', 'hit');
      return _hydrateCachedCointoolRows(rows);
    } catch (_) {
      window.wenxen?.perf?.set?.('renderCacheStatus', 'error');
      return null;
    }
  }

  function _scheduleWriteCointoolRenderCache(rows, maxPerBatch) {
    if (!Array.isArray(rows)) return;
    setTimeout(() => {
      _writeCointoolRenderCache(rows, maxPerBatch).catch(() => {});
    }, 0);
  }

  async function _writeCointoolRenderCache(rows, maxPerBatch) {
    const db = window.cointoolDb || window.dbInstance;
    if (!db?.objectStoreNames?.contains?.('scanState')) return;

    const baseKey = _renderCacheBaseKey(maxPerBatch);
    const createdAt = Date.now();
    const invalidatedAtStart = _getRenderCacheInvalidatedAt();
    const chunks = Math.ceil(rows.length / COINTOOL_RENDER_CACHE_CHUNK_SIZE);

    for (let i = 0; i < chunks; i++) {
      if (_getRenderCacheInvalidatedAt() !== invalidatedAtStart) return;
      await _scanStatePut(db, {
        address: `${baseKey}:chunk:${i}`,
        rows: rows.slice(i * COINTOOL_RENDER_CACHE_CHUNK_SIZE, (i + 1) * COINTOOL_RENDER_CACHE_CHUNK_SIZE),
        updatedAt: createdAt
      });
      await _yieldToBrowser();
    }

    if (_getRenderCacheInvalidatedAt() !== invalidatedAtStart) return;
    await _scanStatePut(db, {
      address: `${baseKey}:meta`,
      version: COINTOOL_RENDER_CACHE_VERSION,
      maxPerBatch,
      chunks,
      rowCount: rows.length,
      createdAt,
      updatedAt: createdAt
    });
  }

  async function _readAllProxies(){
    try {
      const db = window.cointoolDb || window.dbInstance;
      if (!db || !db.objectStoreNames || !db.objectStoreNames.contains('proxies')) return [];
      const rows = await _readStoreInBatches(db, 'proxies');
      window.wenxen?.perf?.set?.('proxyRecordCount', rows.length);
      return rows;
    } catch(e){ return []; }
  }

  // Render-time status: the scanner only flips Maturing→Claimable during a
  // scan, so a record can stay "Maturing" past its Maturity_TS until the
  // next scan runs. Compute an effective status from the timestamp so the
  // table reflects reality between scans. Only Maturing is upgraded — never
  // touch Claimed/Failed/etc.
  function _effectiveStatusFromProxy(p, nowSec){
    const status = p && p.Status;
    if (status !== 'Maturing') return status || '';
    const ts = Number(p && p.Maturity_TS);
    if (Number.isFinite(ts) && ts > 0 && ts <= nowSec) return 'Claimable';
    return status;
  }

  const LOCAL_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function _pad2(n) {
    return n < 10 ? `0${n}` : String(n);
  }

  function _localDatePartsFromSeconds(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return null;
    const d = new Date(n * 1000);
    if (!Number.isFinite(d.getTime())) return null;
    return {
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      day: d.getDate(),
      hour24: d.getHours(),
      minute: d.getMinutes()
    };
  }

  function _localDateKeyFromSeconds(ts) {
    const parts = _localDatePartsFromSeconds(ts);
    if (!parts) return '';
    return `${parts.year}-${_pad2(parts.monthIndex + 1)}-${_pad2(parts.day)}`;
  }

  function _localMaturityDisplayFromSeconds(ts) {
    const parts = _localDatePartsFromSeconds(ts);
    if (!parts) return '';
    const hour12 = parts.hour24 % 12 || 12;
    const ampm = parts.hour24 >= 12 ? 'PM' : 'AM';
    return `${parts.year} ${LOCAL_MONTHS_SHORT[parts.monthIndex]} ${_pad2(parts.day)}, ${_pad2(hour12)}:${_pad2(parts.minute)} ${ampm}`;
  }

  async function _groupAndChunkProxies(proxies, maxPerBatch){
    // Group by (Owner|Salt|EffectiveStatus|Term|MaturityDay) so each batch
    // row contains only proxies maturing on the same calendar day. Otherwise
    // a chunk can mix proxies with different maturities (same Term but
    // different mint timestamps), which makes the table's VMU count for a
    // given date inaccurate. EffectiveStatus is used so a freshly-matured
    // proxy (still persisted as Maturing) groups with already-Claimable
    // siblings instead of forming a separate stale-status row.
    const nowSec = Math.floor(Date.now() / 1000);
    const groups = new Map();
    const dateKeyCache = new Map();
    const getCachedDateKey = (ts) => {
      const n = Number(ts) || 0;
      if (n <= 0) return '';
      if (!dateKeyCache.has(n)) dateKeyCache.set(n, _localDateKeyFromSeconds(n));
      return dateKeyCache.get(n);
    };

    for (let i = 0; i < proxies.length; i++) {
      const p = proxies[i];
      const dayKey = getCachedDateKey(p.Maturity_TS);
      const effStatus = _effectiveStatusFromProxy(p, nowSec);
      const key = `${(p.Owner||'').toLowerCase()}|${(p.Salt||'').toLowerCase()}|${effStatus}|${p.Term||0}|${dayKey}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
      if (i > 0 && i % 5000 === 0) await _yieldToBrowser();
    }

    const rows = [];
    let processedGroups = 0;
    for (const [, list] of groups) {
      list.sort((a,b) => (Number(a.Maturity_TS||0) - Number(b.Maturity_TS||0)) || (Number(a.Index||0) - Number(b.Index||0)));
      for (let i = 0; i < list.length; i += maxPerBatch) {
        const chunk = list.slice(i, i + maxPerBatch);
        const first = chunk[0];
        const last  = chunk[chunk.length - 1];

        let minRank = null;
        let maxRank = null;
        for (const p of chunk) {
          let rank = 0n;
          try { rank = BigInt(p.Rank || '0'); } catch {}
          if (rank <= 0n) continue;
          if (minRank === null || rank < minRank) minRank = rank;
          if (maxRank === null || rank > maxRank) maxRank = rank;
        }
        const rankRange = minRank !== null
          ? `${minRank.toString()}-${maxRank.toString()}`
          : 'N/A';

        const matFmt = _localMaturityDisplayFromSeconds(last.Maturity_TS);
        const matKey = _localDateKeyFromSeconds(last.Maturity_TS);

        // Rows are grouped by maturity day, so the calendar count can be
        // attached without reformatting every proxy in the chunk.
        const maturityByDay = matKey ? { [matKey]: chunk.length } : {};

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

        const rowStatus = _effectiveStatusFromProxy(first, nowSec);
        rows.push({
          ID: `ct-batch-${first.Owner}-${first.Salt}-${rowStatus}-${first.Term}-${first.Index}`,
          RowKind: 'batch',
          SourceType: 'Cointool',
          Owner: first.Owner,
          Salt: first.Salt,
          Status: rowStatus,
          Term: String(first.Term || 0),
          VMUs: String(chunk.length),
          Indices: chunk.map(p => Number(p.Index)),
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

        if (rows.length > 0 && rows.length % 200 === 0) await _yieldToBrowser();
      }
      processedGroups++;
      if (processedGroups % 50 === 0) await _yieldToBrowser();
    }
    return rows;
  }

  async function fetchCointoolRows(){
    const maxPerBatch = _getMaxVmuPerTx();
    const cachedRows = await _readCointoolRenderCache(maxPerBatch);
    if (Array.isArray(cachedRows)) {
      _loadOrBuildCointoolSummaryIndex({ maxPerBatch, allowRebuild: true }).catch(() => {});
      window.wenxen?.perf?.set?.('groupedCointoolRowCount', cachedRows.length);
      window.wenxen?.perf?.set?.('lastCointoolGroupingSource', 'cache');
      return cachedRows;
    }

    const all = await _readAllProxies();
    if (!all.length) return [];
    const renderData = await _buildCointoolRenderData(all, maxPerBatch);
    if (renderData.summary) {
      window._cointoolSummaryIndex = renderData.summary;
      _writeCointoolSummaryIndex(renderData.summary).catch(() => {});
    }
    window.wenxen?.perf?.set?.('groupedCointoolRowCount', renderData.rows.length);
    _scheduleWriteCointoolRenderCache(renderData.rows, maxPerBatch);
    return renderData.rows;
  }


  async function fetchStakeRows(){
    if (!window.xenStake || typeof window.xenStake.getAll !== "function") return [];
    let db = null;
    try {
      db = await window.xenStake.openDB();
      const rows = await window.xenStake.getAll(db);
      if (Array.isArray(rows)) {
        const mapped = rows.map(mapStakeToRow);
        await _loadOrBuildRowSummaryIndex({
          db,
          type: 'Stake',
          rows: mapped,
          sourceCount: rows.length
        }).catch(() => {});
      }
      return Array.isArray(rows) ? rows : [];
    } catch(e){ console.error("Failed to fetch Stake rows", e); }
    finally { if (db) { try { db.close(); } catch (_) {} } }
    return [];
  }

  function mapStakeToRow(s){
    const startTs = Number(s.startTs || 0) || (
      Number(s.maturityTs || 0) > 0 && Number(s.term || 0) > 0
        ? Number(s.maturityTs) - Number(s.term) * 86400
        : 0
    );
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
      Start_Timestamp: startTs,
      Maturity_Timestamp: s.maturityTs,    // seconds
      maturityDateOnly: s.maturityDateOnly,
      Latest_Action_Timestamp: s.actions?.length ? (s.actions[s.actions.length-1].timeStamp || 0) : 0,
    };
  }


  async function fetchXenftRows(){
    if (!window.xenft || typeof window.xenft.openDB !== "function") return [];
    let db = null;
    try {
      db = await window.xenft.openDB();
      var rows = await window.xenft.getAll(db);
      if (Array.isArray(rows)) {
        const mapped = rows.map(mapXenftToRow);
        await _loadOrBuildRowSummaryIndex({
          db,
          type: 'XENFT',
          rows: mapped,
          sourceCount: rows.length
        }).catch(() => {});
      }
      return Array.isArray(rows) ? rows : [];
    } catch(e){}
    finally { if (db) { try { db.close(); } catch (_) {} } }
    return [];
  }

  let ensureUnifiedColumnsRetryTimer = null;
  function _scheduleEnsureUnifiedColumns() {
    if (ensureUnifiedColumnsRetryTimer) return;
    ensureUnifiedColumnsRetryTimer = setTimeout(() => {
      ensureUnifiedColumnsRetryTimer = null;
      try { ensureUnifiedColumns(); } catch (_) {}
    }, 100);
  }

  function _isTabulatorColumnDomReady(table) {
    const tableElement = table?.element || document.getElementById('cointool-table');
    const headerElement = table?.columnManager?.headersElement || tableElement?.querySelector?.('.tabulator-headers');
    return !!(tableElement && tableElement.isConnected && headerElement && headerElement.isConnected);
  }

  // Ensure XENFT columns exist on the main table
  function ensureUnifiedColumns(){
    if (!window.cointoolTable) return;
    if (!_isTabulatorColumnDomReady(window.cointoolTable)) {
      _scheduleEnsureUnifiedColumns();
      return;
    }

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
      var currentOrder = defs.map(function(d){ return (d && d.field) || ""; });
      var nextOrder = newDefs.map(function(d){ return (d && d.field) || ""; });
      var sameOrder = currentOrder.length === nextOrder.length &&
        currentOrder.every(function(field, index){ return field === nextOrder[index]; });
      if (toAdd.length || !sameOrder) {
        table.setColumns(newDefs);
      }
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
    let db = null;
    try {
      if (typeof window.xenftStake.reconcile === "function") {
        const now = Date.now();
        if (!window.__xenftStakeReconcilePromise && (!window.__xenftStakeReconcileAt || now - window.__xenftStakeReconcileAt > 120000)) {
          window.__xenftStakeReconcilePromise = window.xenftStake.reconcile()
            .then(result => {
              window.__xenftStakeReconcileAt = Date.now();
              return result;
            })
            .catch(error => {
              console.warn("Stake XENFT reconciliation failed", error);
              return 0;
            })
            .finally(() => { window.__xenftStakeReconcilePromise = null; });
        }
        if (window.__xenftStakeReconcilePromise) await window.__xenftStakeReconcilePromise;
      }
      db = await window.xenftStake.openDB();
      var rows = await window.xenftStake.getAll(db);
      if (Array.isArray(rows)) {
        const mapped = rows.map(mapStakeXenftToRow);
        await _loadOrBuildRowSummaryIndex({
          db,
          type: 'Stake XENFT',
          rows: mapped,
          sourceCount: rows.length
        }).catch(() => {});
      }
      return Array.isArray(rows) ? rows : [];
    } catch(e){ console.error("Failed to fetch Stake XENFT rows", e); }
    finally { if (db) { try { db.close(); } catch (_) {} } }
    return [];
  }

  function mapStakeXenftToRow(s) {
    const startTs = Number(s.startTs || 0) || (
      Number(s.maturityTs || 0) > 0 && Number(s.term || 0) > 0
        ? Number(s.maturityTs) - Number(s.term) * 86400
        : 0
    );
    const actions = Array.isArray(s.actions) ? s.actions : [];
    const latestActionTs = actions.reduce((max, action) => {
      const ts = Number(action?.timeStamp || action?.timestamp || 0);
      return Number.isFinite(ts) ? Math.max(max, ts) : max;
    }, 0);
    return {
      ID: "stake-xenft_" + s.tokenId,
      SourceType: "Stake XENFT",
      Mint_id_Start: s.tokenId,
      Owner: s.owner,
      Status: s.status,
      Maturity_Date_Fmt: s.Maturity_Date_Fmt,
      Term: s.term,
      VMUs: '1', // Each stake NFT represents a single position
      Actions: actions,
      Est_XEN: 0, // This will be calculated by main_app.js's estimateXENForRow
      Rank_Range: 'N/A',
      Salt: 'N/A',
      stakedAmount: s.amount, // For Est. XEN calculation
      apy: s.apy, // For Est. XEN calculation
      Start_Timestamp: startTs,
      Maturity_Timestamp: s.maturityTs,
      maturityDateOnly: s.maturityDateOnly,
      Latest_Action_Timestamp: latestActionTs
    };
  }


  // Unified calendar (sum VMUs across both) — accurate, clickable, and no clipping
  async function updateUnifiedCalendar(){
    const calendarStarted = performance?.now?.() || Date.now();
    // Build YYYY-MM-DD -> total VMUs using the *same date your table shows*
    const dateMap = Object.create(null);
    const cointoolSummaryIndex = window._cointoolSummaryIndex || await _readCointoolSummaryIndex().catch(() => null);
    const useCointoolDaySummary = !!(cointoolSummaryIndex?.byDay && Object.keys(cointoolSummaryIndex.byDay).length);
    if (useCointoolDaySummary) {
      window._cointoolSummaryIndex = cointoolSummaryIndex;
      for (const row of Object.values(cointoolSummaryIndex.byDay)) {
        const key = row?.date;
        const total = Number(row?.totalVMUs || 0);
        if (key && total > 0) dateMap[key] = (dateMap[key] || 0) + total;
      }
    }
    const summaryDayTypes = new Set();
    const summaryIndexesByType = window._summaryIndexByType || {};
    for (const [type, index] of Object.entries(summaryIndexesByType)) {
      const byDay = index?.byDay || {};
      const days = Object.values(byDay);
      if (!days.length) continue;
      summaryDayTypes.add(type);
      for (const row of days) {
        const key = row?.date;
        const total = Number(row?.totalVMUs || 0);
        if (key && total > 0) dateMap[key] = (dateMap[key] || 0) + total;
      }
    }

    function addFromRow(row){
      const st = String(row.Status || row.status || "");
      if (st === "Unknown") return;
      if (useCointoolDaySummary && row.SourceType === "Cointool") return;
      if (summaryDayTypes.has(row.SourceType)) return;

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

    if (Array.isArray(window._allUnifiedRows) && window._allUnifiedRows.length) {
      window._allUnifiedRows.forEach(addFromRow);
    } else {
      const ctRows = useCointoolDaySummary ? [] : await fetchCointoolRows();
      const xfRows = await fetchXenftRows();
      const stakeXfRows = await fetchStakeXenftRows();
      const stakeRows   = await fetchStakeRows();

      ctRows.forEach(addFromRow);
      xfRows.map(mapXenftToRow).forEach(addFromRow);
      stakeXfRows.map(mapStakeXenftToRow).forEach(addFromRow);
      stakeRows.map(mapStakeToRow).forEach(addFromRow);
    }

    // Helper: set header filter to "YYYY Mon" when user changes month/year
    // From a year + 0-based month (for month navigation)
    function setMaturityHeaderFilterFromYearMonth(year, monthIndex) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const txt = `${year} ${months[Math.max(0, Math.min(11, monthIndex))]}`;
      setHeaderFilterTextDebounced("Maturity_Date_Fmt", txt);
      try { window.cointoolTable?.refreshFilter(); } catch (_) {}
    }

    window.calendarController?.update?.(dateMap, {
      firstDayOfWeek: 1,
      hideOtherMonthDays: true,
      onDateClick: function(dt) {
        try { setMaturityHeaderFilterFromDate(dt); } catch(_) {}
      },
      onDateChange: function(dt) {
        try { setMaturityHeaderFilterFromDate(dt); } catch(_) {}
      },
      onClear: function() {
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
      },
      onMonthYearChange: function(year, monthIndex) {
        try { setMaturityHeaderFilterFromYearMonth(year, monthIndex); } catch(_) {}
      },
      afterInteraction: function() {
        try { if (typeof updateXENTotalBadge === 'function') updateXENTotalBadge(); } catch(_) {}
      }
    });
    attachMaturityHeaderSync();
    window.wenxen?.perf?.set?.('lastCalendarUpdateMs', Math.round((performance?.now?.() || Date.now()) - calendarStarted));
  }

  window.updateUnifiedCalendar = updateUnifiedCalendar;


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

    const cached = getSummaryCacheForType("Stake XENFT");
    let count;
    let maturingCount;
    let claimableCount;
    if (cached) {
      count = cached.totalCount || 0;
      maturingCount = cached.maturing || 0;
      claimableCount = cached.claimable || 0;
    } else {
      const all = (Array.isArray(window._allUnifiedRows) && window._allUnifiedRows.length)
        ? window._allUnifiedRows
        : (window.cointoolTable ? (window.cointoolTable.getData("all") || window.cointoolTable.getData("active")) : []);

      const sxf = all.filter(r => r.SourceType === "Stake XENFT");
      count = sxf.length;
      maturingCount = sxf.filter(r => r.Status === "Maturing").length;
      claimableCount = sxf.filter(r => r.Status === "Claimable").length;
    }

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

    const cached = getSummaryCacheForType("XENFT");
    let xfCount;
    let xfVMUs;
    let apex;
    let collector;
    let limited;
    let maturingVMUs;
    let claimableCount;

    if (cached) {
      xfCount = cached.totalCount || 0;
      xfVMUs = cached.totalVMUs || 0;
      apex = cached.apex || 0;
      collector = cached.collector || 0;
      limited = cached.limited || 0;
      maturingVMUs = cached.maturing || 0;
      claimableCount = cached.claimable || 0;
    } else {
      // Overall, unfiltered data
      const all = (Array.isArray(window._allUnifiedRows) && window._allUnifiedRows.length)
        ? window._allUnifiedRows
        : (window.cointoolTable ? (window.cointoolTable.getData("all") || window.cointoolTable.getData("active")) : []);

      const xf = all.filter(r => r.SourceType === "XENFT");
      xfCount = xf.length;
      xfVMUs  = xf.reduce((s, r) => s + (Number(r.VMUs)||0), 0);
      apex     = xf.filter(r => String(r.Category||"").toLowerCase() === "apex").length;
      collector= xf.filter(r => String(r.Category||"").toLowerCase() === "collector").length;
      limited  = xf.filter(r => String(r.Class||"").toLowerCase() === "limited").length;

      maturingVMUs = xf.filter(r => r.Status === "Maturing").reduce((s, r) => s + (Number(r.VMUs)||0), 0);
      claimableCount = xf.filter(r => r.Status === "Claimable").length;
    }

    line.innerHTML = `<strong>XENFTs:</strong> ${xfCount.toLocaleString()}
    | <strong>Total VMUs:</strong> ${xfVMUs.toLocaleString()} (Apex: ${apex.toLocaleString()} | Collector: ${collector.toLocaleString()} | Limited: ${limited.toLocaleString()})
    | <strong>Maturing:</strong> ${maturingVMUs.toLocaleString()} | <strong>Claimable:</strong> ${claimableCount.toLocaleString()}`;
  }





  // Unified refresh: columns + merge + summary + calendar
  async function refreshUnified(){
    if (!window.cointoolTable) return;
    if (window.__refreshUnifiedInFlight) return window.__refreshUnifiedInFlight;

    const refreshStarted = performance?.now?.() || Date.now();
    window.__refreshUnifiedInFlight = (async () => {
      window.__wenxenInitialDataLoading = true;
      window.__wenxenUnifiedDataReady = false;
      try { window.summaryOption2?.requestRefresh?.(); } catch(_) {}

      try {
        ensureUnifiedColumns();

        const [earlyCointoolSummary, earlyOtherSummaries] = await Promise.all([
          _loadOrBuildCointoolSummaryIndex({ allowRebuild: false }).catch(() => null),
          _loadExistingNonCointoolSummaryIndexes().catch(() => false)
        ]);
        if (earlyCointoolSummary || earlyOtherSummaries) {
          try { if (typeof updateSummaryStats === "function") updateSummaryStats(); } catch(_) {}
          try { updateXenftSummaryLine(); } catch(_) {}
          try { updateStakeXenftSummaryLine(); } catch(_) {}
          try { updateStakeSummaryLine(); } catch(_) {}
          try { await updateUnifiedCalendar(); } catch(_) {}
          try { window.summaryOption2?.requestRefresh?.(); } catch(_) {}
        }

        const [ctRows, xfRows, stakeXfRows, stakeRows] = await Promise.all([
          fetchCointoolRows(),
          fetchXenftRows(),
          fetchStakeXenftRows(),
          fetchStakeRows()
        ]);

        await _loadOrBuildCointoolSummaryIndex({ allowRebuild: true }).catch(() => null);

        const merged = ctRows.map(r => { r.SourceType = "Cointool"; return r; })
          .concat(xfRows.map(mapXenftToRow))
          .concat(stakeXfRows.map(mapStakeXenftToRow))
          .concat(stakeRows.map(mapStakeToRow));

        // Cache an unfiltered snapshot for global stats. Reuse the merged array to
        // avoid cloning hundreds of thousands of rows during startup.
        window._allUnifiedRows = merged;

        // Apply data without full replacement when the table helper is available.
        const tableApplyStarted = performance?.now?.() || Date.now();
        if (typeof window.applyTableRows === "function") {
          await window.applyTableRows(window.cointoolTable, merged, {
            preferReplaceLarge: true,
            suppressDerived: true
          });
        } else {
          await window.cointoolTable.replaceData(merged);
        }
        try { window.updateDashboardEmptyState?.(merged.length); } catch(_) {}
        window.wenxen?.perf?.set?.('lastTableApplyMs', Math.round((performance?.now?.() || Date.now()) - tableApplyStarted));
        window.wenxen?.perf?.set?.('totalUnifiedRowCount', merged.length);
        pendingCointoolChunkTableRows = null;
        window.__cointoolChunkTableApplyDeferred = false;
        window.__pendingCointoolChunkTableRows = 0;
        const hasNonCointool = (xfRows.length + stakeXfRows.length + stakeRows.length) > 0;
        clearXenftBlockingFilters(hasNonCointool);

        // Update summary & calendar (now read from _allUnifiedRows)
        if (typeof updateSummaryStats === "function") { try { updateSummaryStats(); } catch(_){} }
        try { updateXenftSummaryLine(); } catch(_) {}
        try { updateStakeXenftSummaryLine(); } catch(_) {}
        try { updateStakeSummaryLine(); } catch(_) {}
        try { await updateUnifiedCalendar(); } catch(_) {}
      } finally {
        window.__wenxenInitialDataLoading = false;
        window.__wenxenUnifiedDataReady = true;
        window.wenxen?.perf?.set?.('lastUnifiedRefreshMs', Math.round((performance?.now?.() || Date.now()) - refreshStarted));
        try { window.summaryOption2?.requestRefresh?.(); } catch(_) {}
        try { window.dispatchEvent(new CustomEvent('unifiedDataRefresh')); } catch(_) {}
      }
    })();

    try {
      return await window.__refreshUnifiedInFlight;
    } finally {
      window.__refreshUnifiedInFlight = null;
    }
  }

  function _mergeCointoolRowsWithCurrentSnapshot(ctRows) {
    const existing = (Array.isArray(window._allUnifiedRows) && window._allUnifiedRows.length)
      ? window._allUnifiedRows
      : (window.cointoolTable
        ? (window.cointoolTable.getData("all") || window.cointoolTable.getData("active") || [])
        : []);
    const nonCointool = existing.filter(row => row && row.SourceType !== "Cointool");
    const cointoolRows = ctRows.map(row => {
      row.SourceType = "Cointool";
      return row;
    });
    return {
      merged: cointoolRows.concat(nonCointool),
      hasNonCointool: nonCointool.length > 0
    };
  }

  let cointoolChunkRefreshToken = 0;
  let cointoolChunkRefreshPromise = null;
  let pendingCointoolChunkTableRows = null;

  function _isDashboardTableActive() {
    const dashboard = document.getElementById('tab-dashboard');
    return !!dashboard?.classList?.contains('active');
  }

  async function _replaceUnifiedTableRows(rows) {
    const applyStarted = performance?.now?.() || Date.now();
    if (typeof window.applyTableRows === "function") {
      await window.applyTableRows(window.cointoolTable, rows, {
        forceReplace: true,
        preferReplaceLarge: true,
        suppressDerived: true
      });
    } else {
      await window.cointoolTable.replaceData(rows);
    }
    try { window.updateDashboardEmptyState?.(Array.isArray(rows) ? rows.length : undefined); } catch(_) {}
    window.__cointoolChunkTableAppliedAt = Date.now();
    window.__cointoolChunkTableApplyDeferred = false;
    window.wenxen?.perf?.set?.('lastTableApplyMs', Math.round((performance?.now?.() || Date.now()) - applyStarted));
  }

  async function _applyOrDeferCointoolChunkRows(rows) {
    if (!_isDashboardTableActive()) {
      pendingCointoolChunkTableRows = rows;
      window.__cointoolChunkTableApplyDeferred = true;
      window.__pendingCointoolChunkTableRows = rows.length;
      return { deferred: true };
    }
    await _replaceUnifiedTableRows(rows);
    return { deferred: false };
  }

  async function flushPendingCointoolChunkTableRows() {
    if (!pendingCointoolChunkTableRows || !window.cointoolTable || !_isDashboardTableActive()) return false;
    const rows = pendingCointoolChunkTableRows;
    pendingCointoolChunkTableRows = null;
    await _replaceUnifiedTableRows(rows);
    try { if (typeof updateXENTotalBadge === "function") updateXENTotalBadge(); } catch(_) {}
    try { if (typeof updateVmuChart === "function") updateVmuChart(); } catch(_) {}
    try { if (typeof updateDownloadButtonsVisibility === "function") updateDownloadButtonsVisibility(); } catch(_) {}
    try {
      window.dispatchEvent(new CustomEvent("cointoolChunkTableApplied", {
        detail: { rows: rows.length }
      }));
    } catch (_) {}
    return true;
  }

  async function refreshCointoolChunkSizeOnly() {
    if (!window.cointoolTable) return false;

    const token = ++cointoolChunkRefreshToken;
    const previousRefresh = cointoolChunkRefreshPromise;
    if (previousRefresh) {
      window.wenxen?.workerClient?.cancelAll?.('chunk-size-change');
    }
    const promise = (async () => {
      if (previousRefresh) await previousRefresh.catch(() => {});
      if (token !== cointoolChunkRefreshToken) return false;

      if (window.__refreshUnifiedInFlight) {
        await window.__refreshUnifiedInFlight.catch(() => {});
      }
      if (token !== cointoolChunkRefreshToken) return false;

      const started = (window.performance && typeof window.performance.now === "function")
        ? window.performance.now()
        : Date.now();
      const targetMaxVmu = _getMaxVmuPerTx();
      window.__wenxenCointoolChunkRefreshing = true;
      window.__wenxenCointoolChunkRefreshValue = targetMaxVmu;

      try {
        const ctRows = await fetchCointoolRows();
        if (token !== cointoolChunkRefreshToken) return false;
        await _loadOrBuildCointoolSummaryIndex({ maxPerBatch: targetMaxVmu, allowRebuild: true }).catch(() => null);

        const { merged, hasNonCointool } = _mergeCointoolRowsWithCurrentSnapshot(ctRows);
        window._allUnifiedRows = merged;

        const tableApply = await _applyOrDeferCointoolChunkRows(merged);
        if (token !== cointoolChunkRefreshToken) return false;

        clearXenftBlockingFilters(hasNonCointool);
        if (typeof updateSummaryStats === "function") { try { updateSummaryStats(); } catch(_){} }
        try { updateXenftSummaryLine(); } catch(_) {}
        try { updateStakeXenftSummaryLine(); } catch(_) {}
        try { updateStakeSummaryLine(); } catch(_) {}
        try { await updateUnifiedCalendar(); } catch(_) {}
        try { if (typeof updateXENTotalBadge === "function") updateXENTotalBadge(); } catch(_) {}
        try { if (typeof updateVmuChart === "function") updateVmuChart(); } catch(_) {}
        try { if (typeof updateDownloadButtonsVisibility === "function") updateDownloadButtonsVisibility(); } catch(_) {}

        const ended = (window.performance && typeof window.performance.now === "function")
          ? window.performance.now()
          : Date.now();
        window.__cointoolChunkRefreshAppliedAt = Date.now();
        window.__cointoolChunkRefreshElapsedMs = Math.max(0, Math.round(ended - started));
        try {
          window.dispatchEvent(new CustomEvent("cointoolChunkRefresh", {
            detail: {
              value: targetMaxVmu,
              rows: ctRows.length,
              elapsedMs: window.__cointoolChunkRefreshElapsedMs,
              tableDeferred: !!tableApply.deferred
            }
          }));
        } catch (_) {}
        return true;
      } finally {
        window.__wenxenCointoolChunkRefreshing = false;
      }
    })();

    cointoolChunkRefreshPromise = promise;
    window.__cointoolChunkRefreshInFlight = promise;
    try {
      return await promise;
    } finally {
      if (cointoolChunkRefreshPromise === promise) cointoolChunkRefreshPromise = null;
      if (window.__cointoolChunkRefreshInFlight === promise) window.__cointoolChunkRefreshInFlight = null;
    }
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
    let lastRenderedValue = _getMaxVmuPerTx();
    const trigger = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        const nextValue = _getMaxVmuPerTx();
        if (nextValue === lastRenderedValue) return;
        lastRenderedValue = nextValue;
        refreshCointoolChunkSizeOnly().catch(err => console.warn('Cointool chunk refresh failed:', err));
      }, 200);
    };
    input.addEventListener('change', trigger);
    input.addEventListener('blur', trigger);
    window.addEventListener('cointoolMaxVmuPerTxChanged', trigger);
  }

  // Boot
  ensureXenftScanButton();
  whenTableReady(function(){
    attachGuards();
    window.refreshUnified = refreshUnified;
    window.refreshCointoolChunkSizeOnly = refreshCointoolChunkSizeOnly;
    window.flushPendingCointoolChunkTableRows = flushPendingCointoolChunkTableRows;
    document.addEventListener('tabChanged', event => {
      if (event?.detail?.tabId !== 'tab-dashboard') return;
      setTimeout(() => {
        flushPendingCointoolChunkTableRows().catch(err => console.warn('Pending Cointool table apply failed:', err));
      }, 0);
    });
    wireMaxVmuListener();
    refreshUnified();
  });
})();
