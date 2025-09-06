
// --- Mobile Tooltip Helpers ---

// A single, shared timer for the long-press detection
let longPressTimer;

/**
 * Attaches a long-press listener to an element to show a mobile-friendly tooltip.
 * @param {HTMLElement} element The cell element to attach the listener to.
 * @param {string} text The text content for the tooltip.
 */
function addLongPressTooltip(element, text) {
  if (!text) return; // Don't attach listeners if there's no tooltip text

  element.addEventListener('touchstart', (e) => {
    longPressTimer = setTimeout(() => {
      showMobileTooltip(e.target, text);
    }, 500); // 500ms for a long press
  }, { passive: true });

  element.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
  });

  element.addEventListener('touchmove', () => {
    clearTimeout(longPressTimer);
  });
}

/**
 * Displays and positions the custom mobile tooltip.
 * @param {HTMLElement} targetEl The element that was long-pressed.
 * @param {string} text The text to display.
 */
function showMobileTooltip(targetEl, text) {
  const tooltip = document.getElementById('mobile-tooltip');
  if (!tooltip) return;

  tooltip.textContent = text;
  tooltip.style.display = 'block';

  const rect = targetEl.getBoundingClientRect();

  // Position tooltip above the element
  tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
  tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;

  // Hide the tooltip after a few seconds or on the next touch
  setTimeout(() => {
    tooltip.style.display = 'none';
  }, 3000); // Hide after 3 seconds

  const hideOnNextTouch = () => {
    tooltip.style.display = 'none';
    document.removeEventListener('touchstart', hideOnNextTouch);
  };
  document.addEventListener('touchstart', hideOnNextTouch);
}

// --- THEME MANAGEMENT ---
function getStoredTheme(){
  try {
    const t = localStorage.getItem('theme');
    // Back-compat: treat legacy 'system' as dark by default
    if (t === 'system' || !t) return 'dark';
    return (t === 'light' || t === 'dark' || t === 'retro' || t === 'matrix') ? t : 'dark';
  } catch { return 'dark'; }
}

function storeTheme(v){
  try { localStorage.setItem('theme', (v === 'light' || v === 'retro' || v === 'matrix') ? v : 'dark'); } catch {}
}

function isSystemDark(){
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function effectiveTheme(mode){
  // No more 'system' in UI; keep fallback just in case imports contain it
  if (mode === 'system') return isSystemDark() ? 'dark' : 'light';
  if (mode === 'retro') return 'retro';
  if (mode === 'matrix') return 'matrix';
  return (mode === 'dark') ? 'dark' : 'light';
}

function applyTheme(mode){
  const eff = effectiveTheme(mode);
  document.body.classList.remove('light-mode', 'dark-mode', 'retro-mode', 'matrix-mode');
  document.body.classList.add(eff + '-mode');
  // Toggle Tabulator dark CSS
  try {
    const link = document.getElementById('tabulatorMidnightCss');
    if (link) link.disabled = !(eff === 'dark' || eff === 'retro' || eff === 'matrix');
  } catch {}
  // Toggle Flatpickr dark CSS
  try {
    const link = document.getElementById('flatpickrDarkCss');
    if (link) link.disabled = !(eff === 'dark' || eff === 'retro' || eff === 'matrix');
  } catch {}
  // Re-style ECharts chart
  try { if (typeof updateVmuChart === 'function') updateVmuChart(); } catch {}
  // Update header menu UI (current theme indicator, radio state)
  try { if (typeof updateThemeMenuUI === 'function') updateThemeMenuUI(); } catch {}
}

// Initialize theme on load (respect stored or system)
(function(){
  const mode = getStoredTheme();
  applyTheme(mode);
})();

// Keep header theme menu UI in sync with current setting
function updateThemeMenuUI(){
  const cur = getStoredTheme();
  const txt = (cur === 'light') ? 'Light' : (cur === 'retro') ? 'Retro' : (cur === 'matrix') ? 'Matrix' : 'Dark';
  const curEl = document.getElementById('themeMenuCurrent');
  if (curEl) curEl.textContent = txt;
  const items = document.querySelectorAll('#headerMenu .menu-item[data-theme]');
  items.forEach(btn => {
    const on = (btn.getAttribute('data-theme') === cur);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function buildEstXenTooltip(row, estNumber){
  const ONE_ETHER = 1_000_000_000_000_000_000n;
  const hasPrice = Number.isFinite(xenUsdPrice);
  const usdStr = (n) => hasPrice ? ` (${formatUSD(n * xenUsdPrice)})` : "";

  // Stake / Stake XENFT breakdown with $ values
  if (row?.SourceType === "Stake" || row?.SourceType === "Stake XENFT") {
    const b = stakeEstBreakdown(row);
    if (b) {
      const toTok = (x) => Number(x / b.ONE_ETHER);
      const fmtTok = (n) => n.toLocaleString();
      const fmtUsd = (n) =>
        (typeof xenUsdPrice === 'number' && xenUsdPrice > 0)
          ? ` (${formatUSD(n * xenUsdPrice)})`
          : '';

      const principalTok = toTok(b.amount);
      const rewardTok    = toTok(b.reward);
      const totalTok     = toTok(b.total);

      return `${row.SourceType}
Principal: ${fmtTok(principalTok)}${fmtUsd(principalTok)}
APY: ${b.apy}%, Term: ${b.termDays}d
Reward: ${fmtTok(rewardTok)}${fmtUsd(rewardTok)}
Total: ${fmtTok(totalTok)}${fmtUsd(totalTok)}`;
    }
    // No breakdown → just type
    return row.SourceType || "";
  }

  // Cointool / XENFT simple reward tooltip with $ values
  const est = Number(estNumber || 0);
  const label = (row?.SourceType === "XENFT") ? "XENFT" : "Cointool";
  return `${label}
Mint Reward: ${est.toLocaleString()}${usdStr(est)}`;
}


/* --- NEW: simple tab switcher (Dashboard / Settings) --- */
(function initTabs(){
  const buttons = document.querySelectorAll('.tab-button');
  const panels  = document.querySelectorAll('.tab-panel');
  if (!buttons.length || !panels.length) return;

  function setAriaForButtons(activeId){
    try {
      buttons.forEach(btn => {
        const on = (btn.dataset.target === activeId);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.classList.toggle('active', on);
      });
    } catch {}
  }

  function setAriaForPanels(activeId){
    try {
      panels.forEach(p => {
        const on = (p.id === activeId);
        p.classList.toggle('active', on);
        // Optional: hide inactive panels from ATs without removing from tab order
        p.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
    } catch {}
  }

  function persistActiveTab(id){
    try { localStorage.setItem('activeTabId', id); } catch {}
  }

  function getStoredActiveTab(){
    try { return localStorage.getItem('activeTabId') || 'tab-dashboard'; } catch { return 'tab-dashboard'; }
  }

  function show(id){
    setAriaForPanels(id);
    setAriaForButtons(id);
    persistActiveTab(id);
    try { ensurePrivacyConsentOnSettings(id); } catch {}
    try { if (id === 'tab-about') ensureAboutLoaded(); } catch {}
    // If user navigated to Dashboard, ensure chart is initialized and sized
    if (id === 'tab-dashboard') {
      try {
        const wantOpen = (localStorage.getItem('vmuChartExpanded') || '0') === '1';
        // If we deferred chart init earlier, attempt it now
        if (_vmuChartInitPending && wantOpen) {
          setTimeout(() => { try { setVmuChartExpandedState(true); _vmuChartInitPending = false; } catch {} }, 0);
        }
        // Resize/update even if already initialized (fixes 0px canvas after hidden layout)
        requestAnimationFrame(() => {
          try { if (vmuChart) { vmuChart.resize(); updateVmuChart(); } } catch {}
        });
      } catch {}
    }
  }

  // Expose a programmatic API for restoring via imports/settings
  window.setActiveTab = function(id){
    const panelExists = !!document.getElementById(id);
    show(panelExists ? id : 'tab-dashboard');
  };

  buttons.forEach(b => b.addEventListener('click', () => show(b.dataset.target)));

  // On first load, restore previously active tab if present
  const initial = getStoredActiveTab();
  window.setActiveTab(initial);
})();

// --- Privacy modal + Settings guard ---
function isPrivacyAccepted(){
  try { return localStorage.getItem('privacyAccepted') === '1'; } catch { return false; }
}

function setSettingsTextInputsEnabled(enabled){
  const root = document.getElementById('tab-settings');
  if (!root) return;
  const sel = '#tab-settings input[type="text"], #tab-settings input[type="number"], #tab-settings textarea, #tab-settings select';
  document.querySelectorAll(sel).forEach(el => {
    try { el.disabled = !enabled; } catch {}
  });
}

function openPrivacyModal(){
  const m = document.getElementById('privacyModal');
  if (!m) return;
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
}

function closePrivacyModal(){
  const m = document.getElementById('privacyModal');
  if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
}

function acceptPrivacy(){
  try { localStorage.setItem('privacyAccepted', '1'); } catch {}
  setSettingsTextInputsEnabled(true);
  closePrivacyModal();
}

function declinePrivacy(){
  // Clear consent and re-disable interactive settings
  try { localStorage.setItem('privacyAccepted', '0'); } catch {}
  setSettingsTextInputsEnabled(false);
  closePrivacyModal();
}

function ensurePrivacyConsentOnSettings(currentTabId){
  if (currentTabId !== 'tab-settings') return;
  if (!isPrivacyAccepted()) {
    setSettingsTextInputsEnabled(false);
    openPrivacyModal();
  } else {
    setSettingsTextInputsEnabled(true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  try { const y = document.getElementById('copyrightYear'); if (y) y.textContent = String(new Date().getFullYear()); } catch {}
  // Footer privacy link
  const link = document.getElementById('privacyLink');
  if (link) link.addEventListener('click', (e) => { e.preventDefault(); openPrivacyModal(); });
  // Modal buttons
  const acceptBtn = document.getElementById('privacyAcceptBtn');
  if (acceptBtn) acceptBtn.addEventListener('click', acceptPrivacy);
  const declineBtn = document.getElementById('privacyDeclineBtn');
  if (declineBtn) declineBtn.addEventListener('click', declinePrivacy);
  // Defensive: if user focuses a settings field without consent, block and show modal
  const settingsRoot = document.getElementById('tab-settings');
  if (settingsRoot) {
    settingsRoot.addEventListener('focusin', (e) => {
      if (!isPrivacyAccepted()) {
        const t = e.target;
        if (t && (t.matches('input, textarea, select'))) {
          try { t.blur(); } catch {}
          setSettingsTextInputsEnabled(false);
          openPrivacyModal();
        }
      }
    });
  }

  // Global guard: block clicks on buttons/interactive controls until privacy accepted
  document.addEventListener('click', function(e){
    try {
      if (isPrivacyAccepted()) return; // ok
      const target = e.target;
      // Allow interactions inside the privacy modal itself
      const modal = document.getElementById('privacyModal');
      if (modal && modal.contains(target)) return;
      // Allow explicit privacy link to open the modal (we open it below anyway)
      if (target && (target.id === 'privacyLink' || target.closest('#privacyLink'))) return;

      const buttonishSel = 'button, input[type="button"], input[type="submit"], .btn, .btn-secondary, .btn-mint, .button-like, .chip, .claim-button, .tab-button, .split-caret, .collapsible-toggle, .toggle, [role="button"]';
      const formishSel = 'input, textarea, select';
      const isButtonish = !!(target.closest && target.closest(buttonishSel));
      const isFormish = !!(target.closest && target.closest(formishSel));
      if (isButtonish || isFormish) {
        e.preventDefault();
        e.stopImmediatePropagation();
        openPrivacyModal();
      }
    } catch {}
  }, true);

  // If About tab is active by default (unlikely), ensure load
  try {
    const isAboutActive = document.getElementById('tab-about')?.classList.contains('active');
    if (isAboutActive) ensureAboutLoaded();
  } catch {}

  // Header menu wiring (Theme Light/Dark)
  try {
    const toggle = document.getElementById('headerMenuToggle');
    const panel  = document.getElementById('headerMenu');
    function closeMenu(){
      if (!panel) return;
      panel.hidden = true;
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
    function openMenu(){
      if (!panel) return;
      panel.hidden = false;
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
      try { updateThemeMenuUI(); } catch {}
    }
    function toggleMenu(){ panel && (panel.hidden ? openMenu() : closeMenu()); }
    if (toggle && panel) {
      toggle.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
      document.addEventListener('click', (e) => {
        if (!panel || panel.hidden) return;
        const root = document.getElementById('headerMenuRoot');
        if (root && root.contains(e.target)) return; // inside click
        closeMenu();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
      });
      panel.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('.menu-item');
        if (!btn) return;
        const t = btn.getAttribute('data-theme');
        if (!t) return;
        storeTheme(t);
        applyTheme(t);
        closeMenu();
      });
      // Initial sync
      updateThemeMenuUI();
    }
  } catch {}
});

// --- About tab loader ---
let _aboutLoaded = false;
async function ensureAboutLoaded(){
  if (_aboutLoaded) return;
  const mount = document.getElementById('aboutMarkdown');
  if (!mount) return;
  try {
    const url = new URL('README.md', document.baseURI).toString();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (window.marked && typeof window.marked.parse === 'function') {
      mount.innerHTML = window.marked.parse(text);
    } else {
      // Fallback: show as preformatted text
      mount.textContent = text;
    }
    _aboutLoaded = true;
  } catch (e) {
    mount.innerHTML = '<p class="muted">Failed to load README. Please try again later.</p>';
  }
}


// ===== RPC Importer (Ethereum mainnet) =====

// Public list source (CORS-friendly). Chainlist provides a maintained JSON of EVM chains.
const CHAINLIST_JSON = "https://chainid.network/chains.json";

// Extract https RPCs for chainId 1, drop placeholders/keys, prefer public endpoints
function extractMainnetRPCs(json) {
  try {
    const mainnet = (json || []).find(c => c?.chainId === 1);
    if (!mainnet || !Array.isArray(mainnet.rpc)) return [];
    return mainnet.rpc
      .filter(u => typeof u === "string")
      .map(u => u.trim())
      .filter(u => u.startsWith("http"))    // only http/https (no ws)
      .filter(u => !u.includes("${") && !u.includes("YOUR-") && !u.includes("{INFURA") && !u.includes("{ALCHEMY"))
      .filter(u => !/api\.infura|alchemyapi|quicknode|pokt\.network/i.test(u)); // avoid keys/paid templates
  } catch {
    return [];
  }
}

// Measure latency by making a minimal JSON-RPC call with a short timeout
async function pingRpcLatency(url, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: ctrl.signal,
      mode: "cors",
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json().catch(() => ({}));
    if (!data || (data.error && !data.result)) throw new Error(data?.error?.message || "bad jsonrpc");
    const ms = Math.max(1, Math.round(performance.now() - t0));
    return { url, ok: true, ms };
  } catch (e) {
    return { url, ok: false, ms: Infinity, err: e?.message || String(e) };
  } finally {
    clearTimeout(to);
  }
}

function uniqueUrls(arr) {
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    if (!raw) continue;
    const u = String(raw).trim().replace(/\/+$/,"");
    if (!u) continue;
    if (!seen.has(u)) { seen.add(u); out.push(u); }
  }
  return out;
}

function showImportStatus(msg, kind = "info") {
  const el = document.getElementById("importRpcStatus");
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("error", kind === "error");
  el.classList.toggle("success", kind === "success");
}

function ensureImportProgressUI() {
  const field = document.getElementById("field-customRPC");
  if (!field) return null;
  let wrap = document.getElementById("importRpcProgress");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "importRpcProgress";
    wrap.style.marginTop = "6px";
    wrap.style.display = "none";
    wrap.innerHTML = `
      <div id="importRpcProgressBarWrap" style="background:#e5e7eb;border-radius:6px;height:8px;max-width:480px;overflow:hidden;">
        <div id="importRpcProgressBar" style="background:#3b82f6;height:100%;width:0%;transition:width .2s ease;"></div>
      </div>
      <div id="importRpcProgressText" class="settings-status" style="margin-top:4px;"></div>
      <div id="importRpcActiveList" class="settings-status" style="font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
    `;
    // Insert after status line
    const status = document.getElementById("importRpcStatus");
    if (status && status.parentNode) {
      status.parentNode.insertBefore(wrap, status.nextSibling);
    } else {
      field.appendChild(wrap);
    }
  }
  return wrap;
}

function showImportProgress(){
  const wrap = ensureImportProgressUI();
  if (!wrap) return;
  try {
    const bar = document.getElementById("importRpcProgressBar");
    if (bar) bar.style.width = "0%";
    const txt = document.getElementById("importRpcProgressText");
    if (txt) txt.textContent = "";
    const act = document.getElementById("importRpcActiveList");
    if (act) act.textContent = "";
    wrap.style.display = "block";
  } catch {}
}

function hideImportProgress(){
  const wrap = document.getElementById("importRpcProgress");
  if (!wrap) return;
  try { wrap.style.display = "none"; } catch {}
}

function updateImportProgress({ total, done, active = [], failed = 0 }) {
  const bar = document.getElementById("importRpcProgressBar");
  const txt = document.getElementById("importRpcProgressText");
  const act = document.getElementById("importRpcActiveList");
  if (bar) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
  }
  if (txt) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    txt.textContent = `Scanning RPCs: ${done}/${total} (${pct}%) — ${failed} failed`;
  }
  if (act) {
    const hosts = active.map(u => { try { return new URL(u).hostname; } catch { return u; } });
    act.textContent = active.length ? `Testing: ${hosts.join(', ')}` : '';
  }
}

async function importAndRankRPCs() {
  const btn = document.getElementById("importRpcBtn");
  const ta  = document.getElementById("customRPC");
  if (!btn || !ta) return;

  btn.disabled = true;
  try { btn.setAttribute('aria-busy', 'true'); } catch {}
  showImportProgress();
  showImportStatus("Fetching public RPC list…");

  // 1) Fetch public RPCs (Chainlist). Fallback to a small known set if needed.
  let candidates = [];
  try {
    const res = await fetch(CHAINLIST_JSON, { mode: "cors" });
    const json = await res.json();
    candidates = extractMainnetRPCs(json);
  } catch {}
  if (!candidates.length) {
    candidates = [
      "https://cloudflare-eth.com",
      "https://rpc.ankr.com/eth",
      "https://ethereum.publicnode.com"
    ];
  }

  // 2) Merge with user-provided list
  const userList = ta.value.split("\n").map(s => s.trim()).filter(Boolean);
  let merged = uniqueUrls([...userList, ...candidates]);

  // 3) Probe each RPC concurrently (cap concurrency) with live progress
  showImportStatus(`Pinging ${merged.length} RPCs for latency (this uses your local network)…`);
  const results = [];
  const CONCURRENCY = 6;
  let index = 0;
  let done = 0;
  let failed = 0;
  const active = new Set();
  updateImportProgress({ total: merged.length, done, active: Array.from(active), failed });
  async function worker() {
    const myIdx = index++;
    if (myIdx >= merged.length) return;
    const url = merged[myIdx];
    active.add(url);
    updateImportProgress({ total: merged.length, done, active: Array.from(active), failed });
    const r = await pingRpcLatency(url);
    active.delete(url);
    results.push(r);
    done += 1;
    if (!r.ok) failed += 1;
    updateImportProgress({ total: merged.length, done, active: Array.from(active), failed });
    // keep pulling more until we've consumed all
    if (index < merged.length) await worker();
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, merged.length) }, worker));

  // 4) Keep only reachable, sort by latency asc
  const reachable = results.filter(r => r.ok).sort((a,b) => a.ms - b.ms);

  if (!reachable.length) {
    showImportStatus("No reachable RPCs found. Try again or check your connection.", "error");
    hideImportProgress();
    btn.disabled = false;
    return;
  }

  // 5) Write back to textarea (fastest -> slowest), persist, update UI
  const sorted = reachable.map(r => r.url);
  ta.value = sorted.join("\n");
  try { localStorage.setItem("customRPC", ta.value); } catch {}
  showImportStatus(`Imported ${sorted.length} RPCs. Fastest is ~${reachable[0].ms} ms.`, "success");

  // Re-validate the required field & any feature depending on RPC list
  if (typeof markValidity === "function") {
    markValidity("field-customRPC", !!sorted.length);
  }
  if (typeof validateInputs === "function") {
    try { validateInputs(); } catch {}
  }

  // Complete progress
  updateImportProgress({ total: 1, done: 1, active: [], failed: 0 });
  hideImportProgress();
  try { btn.removeAttribute('aria-busy'); } catch {}
  btn.disabled = false;
}

// Check if we should auto-run RPC import on page load
function checkAutoImportRPCs() {
  const ta = document.getElementById("customRPC");
  if (!ta) return;
  
  // Get the current RPC list
  const rpcList = ta.value.split("\n").map(s => s.trim()).filter(Boolean);
  
  // Only auto-run if there's exactly one RPC
  if (rpcList.length === 1) {
    // Small delay to ensure page is fully loaded
    setTimeout(() => {
      importAndRankRPCs();
    }, 500);
  }
}

// Wire up the button
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("importRpcBtn");
  if (btn) btn.addEventListener("click", importAndRankRPCs);
});


// --- CoinTool + XEN (ETH mainnet) constants used by the Python script ---
let ETHERSCAN_CHAIN_ID = 1; // default to mainnet; we overwrite at scan start
const COINTOOL_MAIN = '0x0de8bf93da2f7eecb3d9169422413a9bef4ef628'; // you already use this as CONTRACT_ADDRESS
const XEN_ETH       = '0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8';
const selectedRows = new Set();
// This address is hard-coded in the Python remint path
const REMINT_HELPER = '0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98';
// Safety cap: CoinTool can handle up to this many VMUs per tx
const MAX_VMU_PER_TX = 128;
const blockTsCache = new Map();
// Small date formatter for remint dialog
function _formatRemintDate(termDays){
  const now = new Date();
  const ms  = Math.max(0, Number(termDays) || 0) * 24 * 60 * 60 * 1000;
  const dt  = new Date(now.getTime() + ms);
  return dt.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

// Read-only call to XEN.getCurrentMaxTerm() → days
async function fetchCurrentMaxTermDays(){
  try {
    const rpcs = (typeof getRpcList === 'function') ? getRpcList() : [DEFAULT_RPC];
    const provider = new Web3(rpcs[0] || DEFAULT_RPC);
    const xen = new provider.eth.Contract(window.xenAbi, XEN_ETH);
    const secs = await xen.methods.getCurrentMaxTerm().call();
    const days = Math.max(1, Math.floor(Number(secs) / 86400));
    return days;
  } catch (_) {
    return null;
  }
}

// Modal dialog to pick remint term with live date preview and Max Term fetch
function openRemintTermDialog(){
  return new Promise((resolve) => {
    const existing = document.getElementById('remintModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'remintModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'remintModalTitle');
    modal.innerHTML = `
      <div class="modal-content">
        <h3 id="remintModalTitle" style="margin:0 0 8px 0;">Remint Term</h3>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <input id="remintTermInput" type="number" min="1" step="1" style="width:100px; padding:6px 8px;" />
          <button id="remintSetMaxBtn" type="button" class="btn-secondary">Set Max Term</button>
        </div>
        <div id="remintDatePreview" class="muted" aria-live="polite"></div>
        <div class="modal-actions" style="margin-top:12px;">
          <button id="remintOkBtn" type="button">OK</button>
          <button id="remintCancelBtn" type="button" class="secondary">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('#remintTermInput');
    const btnMax = modal.querySelector('#remintSetMaxBtn');
    const prev = modal.querySelector('#remintDatePreview');
    const ok = modal.querySelector('#remintOkBtn');
    const cancel = modal.querySelector('#remintCancelBtn');

    // Default from Mint tab or saved value
    const mintVal = document.getElementById('mintTermDays')?.value || localStorage.getItem('mintTermDays') || '100';
    input.value = String(Math.max(1, parseInt(mintVal, 10) || 100));

    let maxDays = null; // unknown until user clicks Set Term
    const updatePreview = () => { prev.textContent = _formatRemintDate(parseInt(input.value, 10) || 0); };
    const clamp = () => {
      let v = Math.max(1, parseInt(input.value, 10) || 1);
      if (maxDays != null) v = Math.min(v, maxDays);
      input.value = String(v);
      updatePreview();
    };
    input.addEventListener('input', clamp);
    updatePreview();

    btnMax.addEventListener('click', async () => {
      btnMax.disabled = true;
      const days = await fetchCurrentMaxTermDays();
      btnMax.disabled = false;
      if (days && Number.isFinite(days)) {
        maxDays = days;
        input.value = String(days);
        updatePreview();
      } else {
        alert('Could not retrieve max term. Check RPC settings.');
      }
    });

    function done(val){
      modal.remove();
      resolve(val);
    }
    cancel.addEventListener('click', () => done(null));
    ok.addEventListener('click', async () => {
      let v = Math.max(1, parseInt(input.value, 10) || 1);
      // Ensure we do not exceed current max; fetch if unknown
      if (maxDays == null) {
        try { maxDays = await fetchCurrentMaxTermDays(); } catch {}
      }
      if (maxDays != null && v > maxDays) v = maxDays;
      done(v);
    });
  });
}

// Send CoinTool transaction(s) for given ids, respecting per-tx VMU cap
async function sendCointoolTx({ ids, dataHex, salt, w3, mintData, action }) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('No VMU ids');
  if (!w3 || !connectedAccount) throw new Error('Wallet not connected');

  const c = new w3.eth.Contract(cointoolAbi, COINTOOL_MAIN);
  const uniq = Array.from(new Set(ids)).sort((a,b)=>a-b);

  // If exceeds cap, alert once with planned tx count
  if (uniq.length > MAX_VMU_PER_TX) {
    const txCount = Math.ceil(uniq.length / MAX_VMU_PER_TX);
    alert(`This mint has ${uniq.length} VMUs. The contract allows up to ${MAX_VMU_PER_TX} VMUs per transaction. Your request will be sent in ${txCount} transaction(s).`);
  }

  for (let i = 0; i < uniq.length; i += MAX_VMU_PER_TX) {
    const chunk = uniq.slice(i, i + MAX_VMU_PER_TX);
    try {
      const tx = await c.methods.f(chunk, dataHex, salt).send({ from: connectedAccount });
      const msg = `${action || 'claim'} ${chunk.length} VMUs: ${tx.transactionHash}`;
      if (typeof showToast === 'function') showToast(msg, 'success'); else alert(msg);
    } catch (err) {
      console.error(err);
      alert(err?.message || `CoinTool ${action || 'claim'} failed.`);
      // stop on first failure
      break;
    }
  }
}


// === cRank (globalRank) fetch, no web3 required ===
window.__xenGlobalRank = null;
let __crankLast = { ok:false, value:null, ts:0, err:null };

const GLOBAL_RANK_SELECTOR = "0x1c244082"; // globalRank()

function getRpcList() {
  // Prefer Settings textarea; fall back to localStorage or DEFAULT_RPC
  const ta = document.getElementById("customRPC");
  const raw = (ta && ta.value.trim())
    || (localStorage.getItem("customRPC") || DEFAULT_RPC);
  return String(raw).split("\n").map(s => s.trim()).filter(Boolean);
}

function updateCrankStatus(){
  const el = document.getElementById("crankStatus");
  if (!el) return;
  if (!__crankLast.ts) { el.textContent = "Not fetched yet."; return; }
  const t = new Date(__crankLast.ts).toLocaleTimeString();
  el.textContent = __crankLast.ok
    ? `globalRank = ${(__crankLast.value||0).toLocaleString()} (updated ${t})`
    : `Failed to fetch (last attempt ${t})${__crankLast.err ? ` — ${__crankLast.err}` : ""}`;
}

async function fetchXenGlobalRank(){
  const rpcs = getRpcList();
  let lastErr = null;

  for (const rpc of rpcs) {
    try {
      const body = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "eth_call",
        params: [{ to: XEN_CRYPTO_ADDRESS, data: GLOBAL_RANK_SELECTOR }, "latest"]
      };
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json?.result) {
        const num = parseInt(json.result, 16);
        if (Number.isFinite(num)) {
          window.__xenGlobalRank = num;
          __crankLast = { ok:true, value:num, ts:Date.now(), err:null };
          updateCrankStatus();
          // re-render table estimates
          try { window.cointoolTable?.redraw?.(true); } catch {}
          try { updateXENTotalBadge(); } catch {}
          return;
        }
      }
      throw new Error(json?.error?.message || "Bad RPC response");
    } catch (e) {
      lastErr = e;
      // try next RPC
    }
  }
  __crankLast = { ok:false, value:null, ts:Date.now(), err:lastErr?.message || "all RPCs failed" };
  updateCrankStatus();
}


// --- tiny utils ---
const no0x = (s) => String(s).replace(/^0x/i, '');
const isHex = (s) => /^0x[0-9a-fA-F]*$/.test(s);
const ensureBytes = (s) => (isHex(s) ? s : ('0x' + Buffer.from(String(s), 'utf8').toString('hex')));

const DEFAULT_RPC = `https://ethereum-rpc.publicnode.com`;
const CONTRACT_ADDRESS = "0x0dE8bf93dA2f7eecb3d9169422413A9bef4ef628";
const EVENT_TOPIC = "0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37";
const SALT_BYTES_TO_QUERY = '0x01';
const REMINT_SELECTOR = '0xc2580804';
const XEN_CRYPTO_ADDRESS = '0x06450dee7fd2fb8e39061434babcfc05599a6fb8';



// XEN = VMUs * ( Term * log2(cRankDelta * Term) * AMP )
// === Est. XEN helpers & total badge ===
const OCT8_2022_UTC_MS = Date.UTC(2022, 9, 8, 0, 0, 0, 0); // Oct 8, 2022
function _daysSinceOct8_2022(){
  return Math.floor((Date.now() - OCT8_2022_UTC_MS) / 86_400_000);
}


function _currentAMP(){
  const amp = 3000 - _daysSinceOct8_2022();
  return amp > 0 ? amp : 0;
}


// Pull AMP and EAA from the row when available; fall back defensively.
function _rowAmp(row){
  const amp = Number(row?.amp ?? row?.AMP);
  if (Number.isFinite(amp) && amp > 0) return amp;
  // fallback for legacy rows
  return _currentAMP();
}

function _rowEaaRate(row){
  // row.eaa is usually an integer rate (0..100); sometimes "EAA (%)" as string
  const eaa = Number(row?.eaa ?? row?.["EAA (%)"]);
  return Number.isFinite(eaa) && eaa >= 0 ? eaa : 0;
}

function _parseStartCRank(row){
  // Prefer exact starting rank field if present
  const direct = Number(row?.rank ?? row?.cRank ?? row?.Rank ?? row?.StartRank);
  if (Number.isFinite(direct) && direct > 0) return direct;

  // Fallback: parse "Rank_Range" like "39065463 - 39066462"
  const rr = String(row?.Rank_Range || "").trim();
  const m  = rr.match(/^(\d+)/);
  if (m) return parseInt(m[1], 10);

  return NaN;
}

function stakeEstBreakdown(row) {
  const ONE_ETHER = 1_000_000_000_000_000_000n;
  const amount = _stakeAmountWei(row);            // wei (uses amountWei if present)
  const apy = Number(row.apy || 0);
  const termDays = Number(row.Term || row.term || 0);
  if (amount === 0n || apy <= 0 || termDays <= 0) return null;

  // reward = floor(amount * APY * termDays / (100 * 365))
  const reward = (amount * BigInt(Math.floor(apy * 100)) * BigInt(termDays)) / BigInt(100 * 365 * 100);
  const total  = amount + reward;                 // wei

  return { amount, reward, total, apy, termDays, ONE_ETHER };
}

function estimateXENForRow(row){

  if (row?.SourceType === 'Stake' || row?.SourceType === 'Stake XENFT') {
    const b = stakeEstBreakdown(row);
    return b ? Number(b.total / b.ONE_ETHER) : 0;   // return TOKENS

  }

  // --- Existing logic for Cointool and regular XENFTs ---
  const term = Number(row?.Term ?? row?.term) || 0;
  const vmus = Number(row?.VMUs ?? row?.vmus) || 0;
  if (term <= 0 || vmus <= 0) return 0;

  const amp = _rowAmp(row);                  // <-- use stored AMP
  if (amp <= 0) return 0;

  const eaaRate = _rowEaaRate(row);
  const eaaFactor = (1000 + eaaRate) / 1000; // = 1 when eaaRate = 0

  const start = _parseStartCRank(row);
  const gr    = Number(window.__xenGlobalRank || NaN);
  if (!Number.isFinite(start) || !Number.isFinite(gr)) return 0;

  const rankDelta = Math.max(gr - start, 2);
  const perVMU = Math.log2(rankDelta) * amp * term * eaaFactor;

  const val = vmus * perVMU;
  return Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
}





function updateXENTotalBadge() {
  const badge = document.getElementById("estXenTotal");
  if (!badge || typeof cointoolTable === 'undefined' || !cointoolTable) return;

  const activeData = cointoolTable.getData("active");
  let total = 0n;
  activeData.forEach(rowData => {
    const xenValue = estimateXENForRow(rowData);
    total += BigInt(xenValue);
  });

  badge.textContent = total.toLocaleString();
  renderXenUsdEstimate(total);   // ← NEW: show “($226.45)” style USD next to the total
}



// --- RPC & WEB3 MANAGEMENT ---
let web3;
let rpcEndpoints = [];
let currentRpcIndex = 0;
let contract;
let dbInstance;
const remintCache = {};
// --- WALLET INTERACTION VARIABLES ---
let web3Wallet;
let connectedAccount;

function chainIdToName(chainIdHexOrNum){
  const id = typeof chainIdHexOrNum === 'string' && chainIdHexOrNum.startsWith('0x')
    ? parseInt(chainIdHexOrNum, 16)
    : Number(chainIdHexOrNum);
  switch (id) {
    case 1:   return 'Ethereum Mainnet';
    case 11155111: return 'Sepolia';
    case 8453: return 'Base';
    case 10:  return 'Optimism';
    case 42161: return 'Arbitrum One';
    default:  return `Chain ${id}`;
  }
}

// --- XEN price (USD): Dexscreener primary, CoinGecko fallback ---
let xenUsdPrice = null;
let xenPriceLast = { ok: false, price: null, ts: null, source: null };

function updateXenPriceStatus(){
  const el = document.getElementById('xenPriceStatus');
  if (!el) return;
  if (!xenPriceLast?.ts) {
    el.textContent = 'No refresh yet.';
    return;
  }
  if (!xenPriceLast.ok) {
    el.textContent = `Last refresh failed at ${new Date(xenPriceLast.ts).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}`;
    return;
  }
  const priceText = Number.isFinite(xenPriceLast.price)
    ? `$${xenPriceLast.price.toFixed(10)}`
    : 'Unavailable';
  el.textContent = `Last refresh (${xenPriceLast.source || '—'}): ${priceText} at ${new Date(xenPriceLast.ts).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}`;
}

// Primary: Dexscreener token endpoint
async function fetchFromDexscreener(tokenAddress){
  const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Dexscreener HTTP ${res.status}`);
  const data = await res.json();

  // Dexscreener returns an array of pairs for the token — pick an Ethereum one if present
  const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
  if (!pairs.length) throw new Error('Dexscreener: no pairs');

  const preferred = pairs.find(p => (p.chainId || p.chain || '').toLowerCase().includes('eth')) || pairs[0];
  const price = parseFloat(preferred?.priceUsd ?? preferred?.price?.usd ?? preferred?.priceUsd);
  if (!Number.isFinite(price)) throw new Error('Dexscreener: no priceUsd');

  const dexName = preferred?.dexId || preferred?.url || 'Dex';
  return { price, source: `${dexName} Dexscreener` };
}

// Fallback: CoinGecko simple price
async function fetchFromCoinGecko(){
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=xen-crypto&vs_currencies=usd';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json();
  const price = parseFloat(data?.['xen-crypto']?.usd);
  if (!Number.isFinite(price)) throw new Error('CoinGecko: no price');
  return { price, source: 'CoinGecko' };
}

async function fetchXenUsdPrice(){
  try {
    // XEN_ETH is already defined above in your file (0x0645...6Fb8 on ETH)
    const primary = await fetchFromDexscreener(XEN_ETH);
    xenUsdPrice  = primary.price;
    xenPriceLast = { ok: true, price: xenUsdPrice, ts: Date.now(), source: primary.source };
  } catch (e1) {
    try {
      const fb = await fetchFromCoinGecko();
      xenUsdPrice  = fb.price;
      xenPriceLast = { ok: true, price: xenUsdPrice, ts: Date.now(), source: fb.source };
    } catch (e2) {
      xenUsdPrice  = null;
      xenPriceLast = { ok: false, price: null, ts: Date.now(), source: 'Dexscreener/CoinGecko' };
    }
  }
  updateXENTotalBadge();
  updateXenPriceStatus();
  try { updateVmuChart(); } catch {}
}



function formatUSD(n){
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  // If two-decimal rounding would display as $0.00, show four decimals to reveal tiny values
  if (abs < 0.005 && abs > 0) {
    return n.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function renderXenUsdEstimate(totalBigInt){
  const el = document.getElementById('estXenUsd');
  if (!el) return;
  if (xenUsdPrice == null) { el.textContent = ''; return; }

  // Totals are in the billions ⇒ safe to cast for multiplication
  const totalNum = Number(totalBigInt);
  const usd = totalNum * xenUsdPrice;
  el.textContent = `(${formatUSD(usd)})`;
}


async function updateNetworkBadge(){
  const el = document.getElementById('networkName');
  if (!el) return;
  try {
    const chainId = await window.ethereum?.request?.({ method: 'eth_chainId' });
    el.textContent = chainId ? chainIdToName(chainId) : 'Not Connected';
  } catch {
    el.textContent = 'Not Connected';
  }
}

function es2url(queryString) {
  // queryString should NOT start with "?" (just "module=...&action=...&...")
  return `https://api.etherscan.io/v2/api?chainid=${ETHERSCAN_CHAIN_ID}&${queryString}`;
}

function ensureBulkBar(){
  let bar = document.getElementById('bulkBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bulkBar';
    // Prefer to place after the filter chips block if present
    const chips = document.querySelector('.filter-chips');
    if (chips && typeof chips.insertAdjacentElement === 'function') {
      chips.insertAdjacentElement('afterend', bar);
    } else {
      const tableEl = document.getElementById('cointool-table');
      tableEl.parentNode.insertBefore(bar, tableEl); // show above table
    }
  }

  // Normalize layout styles every call in case CSS changed
  bar.style.margin = '8px 0';
  bar.style.gap = '8px';
  bar.style.alignItems = 'center';
  bar.style.flexWrap = 'wrap';
  bar.style.justifyContent = 'flex-start';
  if (!String(bar.className || '').includes('table-toolbar')) {
    bar.className = ((bar.className || '') + ' table-toolbar').trim();
  }

  // Ensure both buttons exist; if not, (re)build contents and listeners
  if (!document.getElementById('bulkClaimBtn') || !document.getElementById('bulkRemintBtn')) {
    bar.innerHTML = `
      <button id="bulkClaimBtn" class="btn">Claim</button>
      <button id="bulkRemintBtn" class="btn">Remint</button>
      <span id="bulkCount" class="bulk-count"></span>
    `;
    const claimBtn = document.getElementById('bulkClaimBtn');
    const remintBtn = document.getElementById('bulkRemintBtn');
    if (claimBtn) claimBtn.addEventListener('click', () => handleBulkAction('claim'));
    if (remintBtn) remintBtn.addEventListener('click', () => handleBulkAction('remint'));
  }

  return bar;
}

function refreshBulkUI(){
  const bar = ensureBulkBar();
  const ids = Array.from(selectedRows);
  const ct = document.getElementById('bulkCount');
  const claimBtn = document.getElementById('bulkClaimBtn');
  const remintBtn = document.getElementById('bulkRemintBtn');

  let anyClaimable = false;
  let anyCointoolClaimable = false;
  let ctMintCount = 0;
  let ctVMUs = 0;
  for (const id of ids) {
    try {
      const rowObj = cointoolTable.getRow(id);
      const data = rowObj?.getData?.();
      if (!data) continue;
      if (computeLiveStatus(data) === 'Claimable') {
        anyClaimable = true;
        if (String(data.SourceType) !== 'XENFT') anyCointoolClaimable = true;
      }
      if (String(data.SourceType) !== 'XENFT') {
        ctMintCount += 1;
        try { ctVMUs += getIdsForRow(data).length; } catch {}
      }
    } catch {}
  }

  const show = ids.length > 0 && anyClaimable;
  bar.style.display = show ? 'flex' : 'none';
  if (ct) {
    if (ctMintCount > 0) {
      const vmusText = ctVMUs.toLocaleString();
      ct.textContent = `(${ctMintCount} mints, ${vmusText} VMUs selected)`;
    } else {
      ct.textContent = ids.length ? `(${ids.length} selected)` : '';
    }
  }
  if (claimBtn) claimBtn.disabled = !show;
  if (remintBtn) remintBtn.style.display = anyCointoolClaimable ? '' : 'none';
}

function getIdsForRow(rowData){
  const startId  = Number(rowData.Mint_id_Start);
  const vmuCount = Number(rowData.VMUs || 1);
  return Array.from({ length: vmuCount }, (_, i) => startId + i);
}

function buildClaimData(minter, xen = XEN_ETH) {
  const xenNo = no0x(xen);
  const minterNo = no0x(minter);

  // fixed pieces copied from the Python code
  const head = '0x59635f6f'                                  // function selector
    + '000000000000000000000000' + xenNo           // address arg (padded to 32)
    + '0000000000000000000000000000000000000000000000000000000000000040' // offset
    + '0000000000000000000000000000000000000000000000000000000000000044' // bytes len
    + '1c560305'                                   // inner selector
    + '000000000000000000000000' + minterNo        // minter address
    + '0000000000000000000000000000000000000000000000000000000000000064' // 100 (0x64)
    + '00000000000000000000000000000000000000000000000000000000';        // padding
  return head;
}

async function handleBulkAction(mode){
  if (!web3Wallet || !connectedAccount) {
    alert("Please connect the wallet that owns these mints.");
    return;
  }
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (parseInt(chainId, 16) !== 1) {
      alert("Please switch your wallet to Ethereum Mainnet to claim/remint.");
      return;
    }
  } catch {
    alert("Could not read current network. Please switch to Ethereum Mainnet.");
    return;
  }

  // Collect selected rows
  const rows = Array.from(selectedRows)
    .map(id => {
      const r = cointoolTable.getRow(id);
      return r ? r.getData() : null;
    })
    .filter(Boolean);

  if (rows.length === 0) {
    alert("No claimable mints selected.");
    return;
  }

  // Split by type
  const xfRows = rows.filter(r => String(r.SourceType) === 'XENFT');
  const ctRows = rows.filter(r => String(r.SourceType) !== 'XENFT');

  // --- XENFTs: only support "claim" ---
  if (xfRows.length) {
    if (mode !== 'claim') {
      alert("Remint does not apply to XENFTs. XENFT rows will be ignored for remint.");
    } else {
      const TORRENT_ADDR =
        (typeof XENFT_TORRENT === 'string' && XENFT_TORRENT) ||
        (window.xenft && window.xenft.CONTRACT_ADDRESS) ||
        '0x0a252663DBCc0b073063D6420a40319e438Cfa59';

      const tor = new web3Wallet.eth.Contract(window.xenftAbi, TORRENT_ADDR);
      for (const r of xfRows) {
        const tokenId = Number(r.Xenft_id || r.Mint_id_Start || r.tokenId);
        if (!Number.isFinite(tokenId)) { alert("Bad XENFT tokenId in selection."); continue; }
        try {
          const tx = await tor.methods.bulkClaimMintReward(tokenId, connectedAccount)
            .send({ from: connectedAccount });
          if (typeof showToast === 'function') {
            showToast(`XENFT #${tokenId} claim submitted: ${tx.transactionHash}`, "success");
          } else {
            alert(`XENFT #${tokenId} claim submitted: ${tx.transactionHash}`);
          }
        } catch (err) {
          console.error(err);
          alert(err?.message || `XENFT #${tokenId} claim failed.`);
        }
      }
    }
  }

  // --- CoinTool path (batched to MAX_VMU_PER_TX) ---
  if (ctRows.length) {
    // optional: single prompt for remint term
    let term = null;
    if (mode === 'remint') {
      term = await openRemintTermDialog();
      if (term == null) { return; }
    } else {
      // claim path doesn't require term; buildClaimData ignores term
      term = 0;
    }

    // Build CoinTool data once
    const minter = connectedAccount;
    const dataHex = (mode === 'claim') ? buildClaimData(minter, XEN_ETH) : buildRemintData(minter, term);

    // Group by salt for CoinTool
    const bySalt = {};
    for (const r of ctRows) {
      const key = (ensureBytes(r.Salt) || '').toLowerCase();
      if (!bySalt[key]) bySalt[key] = { salt: ensureBytes(r.Salt), ids: [] };
      bySalt[key].ids.push(...getIdsForRow(r));
    }

    const c = new web3Wallet.eth.Contract(cointoolAbi, COINTOOL_MAIN);

    // Preflight: compute total selected VMUs and exact tx count
    let totalVMUs = 0;
    let totalTxCount = 0;
    for (const key of Object.keys(bySalt)) {
      const uniq = Array.from(new Set(bySalt[key].ids));
      totalVMUs += uniq.length;
      totalTxCount += Math.ceil(uniq.length / MAX_VMU_PER_TX);
    }
    if (totalVMUs > MAX_VMU_PER_TX) {
      alert(`You selected ${totalVMUs} VMUs across CoinTool mints. The contract allows up to ${MAX_VMU_PER_TX} VMUs per transaction. Your request will be sent in ${totalTxCount} transaction(s).`);
    }

    // Send per-salt in chunks of MAX_VMU_PER_TX
    for (const key of Object.keys(bySalt)) {
      const grp = bySalt[key];
      const uniq = Array.from(new Set(grp.ids)).sort((a,b)=>a-b);
      for (let i = 0; i < uniq.length; i += MAX_VMU_PER_TX) {
        const chunk = uniq.slice(i, i + MAX_VMU_PER_TX);
        try {
          const tx = await c.methods.f(chunk, dataHex, grp.salt).send({ from: connectedAccount });
          if (typeof showToast === 'function') {
            showToast(`Submitted ${mode} (${chunk.length} VMUs): ${tx.transactionHash}`, "success");
          } else {
            alert(`Submitted ${mode} (${chunk.length} VMUs): ${tx.transactionHash}`);
          }
        } catch (err) {
          console.error(err);
          alert(err?.message || `Bulk ${mode} failed for salt ${grp.salt}`);
        }
      }
    }
  }

  // Finish up
  selectedRows.clear();
  refreshBulkUI();
  if (typeof window.refreshUnified === 'function') { try { await window.refreshUnified(); } catch {} }
}


// REMINT (“remint mode” in the script):
//  0xc40493dc
//  + 32 bytes (address REMINT_HELPER)
//  + offset 0x40
//  + length 0x44
//  + 0x68154343
//  + 32 bytes (minter address)
//  + 32 bytes (manual_max_term as 3-hex-digit, e.g. 0x064) in the low bits
//  + padding
function buildRemintData(minter, manualDays /* integer 1..999 */) {
  const helperNo = no0x(REMINT_HELPER);
  const minterNo = no0x(minter);

  // 3-digit hex (lowercase), like the Python code (e.g., 100 -> "064")
  const termHex3 = manualDays.toString(16).padStart(3, '0').toLowerCase();
  const tailTerm = '0000000000000000000000000000000000000000000000000000000000000'
    + termHex3
    + '00000000000000000000000000000000000000000000000000000000';

  const head = '0xc40493dc'
    + '000000000000000000000000' + helperNo
    + '0000000000000000000000000000000000000000000000000000000000000040'
    + '0000000000000000000000000000000000000000000000000000000000000044'
    + '68154343'
    + '000000000000000000000000' + minterNo
    + tailTerm;

  return head;
}

function openDB() {
  return new Promise((resolve, reject) => {
    // bump to v3 to add actionsCache
    const request = indexedDB.open("DB_Cointool", 3);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("mints")) {
        db.createObjectStore("mints", { keyPath: "ID" });
      }
      if (!db.objectStoreNames.contains("scanState")) {
        db.createObjectStore("scanState", { keyPath: "address" });
      }
      // NEW: persist post-mint actions per address
      if (!db.objectStoreNames.contains("actionsCache")) {
        db.createObjectStore("actionsCache", { keyPath: "address" });
      }
    };

    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

async function getActionsCache(db, address) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction("actionsCache", "readonly");
      const store = tx.objectStore("actionsCache");
      const req = store.get(cleanHexAddr(address));
      req.onsuccess = e => {
        const row = e.target.result;
        resolve((row && row.actions) ? row.actions : {});
      };
      req.onerror = e => reject(e);
    } catch (e) { resolve({}); }
  });
}

async function putActionsCache(db, address, actionsMap) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction("actionsCache", "readwrite");
      const store = tx.objectStore("actionsCache");
      store.put({
        address: cleanHexAddr(address),
        actions: actionsMap,
        updatedAt: Date.now()
      }).onsuccess = () => resolve();
      tx.onerror = e => reject(e);
    } catch (e) { resolve(); }
  });
}

async function clearActionsCache(db, address) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction("actionsCache", "readwrite");
      const store = tx.objectStore("actionsCache");
      store.delete(cleanHexAddr(address)).onsuccess = () => resolve();
      tx.onerror = e => reject(e);
    } catch (e) { resolve(); }
  });
}

function saveMint(db, mint) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("DB not initialized");
    const tx = db.transaction("mints", "readwrite");
    const store = tx.objectStore("mints");
    store.put(mint).onsuccess = () => resolve();
    tx.onerror = e => reject(e);
  });
}
function getAllMints(db) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("DB not initialized");
    const tx = db.transaction("mints", "readonly");
    const store = tx.objectStore("mints");
    store.getAll().onsuccess = (event) => resolve(event.target.result);
    tx.onerror = e => reject(e);
  });
}

async function getScanState(db, address) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("DB not initialized");
    const tx = db.transaction("scanState", "readonly");
    const store = tx.objectStore("scanState");
    const req = store.get(cleanHexAddr(address));
    req.onsuccess = e => resolve(e.target.result || null);
    tx.onerror = e => reject(e);
  });
}

async function putScanState(db, address, lastScannedBlock) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("DB not initialized");
    const tx = db.transaction("scanState", "readwrite");
    const store = tx.objectStore("scanState");
    store.put({
      address: cleanHexAddr(address),
      lastScannedBlock: Number(lastScannedBlock) || 0,
      updatedAt: Date.now()
    }).onsuccess = () => resolve();
    tx.onerror = e => reject(e);
  });
}

async function clearScanState(db, address) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("DB not initialized");
    const tx = db.transaction("scanState", "readwrite");
    const store = tx.objectStore("scanState");
    store.delete(cleanHexAddr(address)).onsuccess = () => resolve();
    tx.onerror = e => reject(e);
  });
}

async function getMintByUniqueId(db, id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("DB not initialized");
    const tx = db.transaction("mints", "readonly");
    const store = tx.objectStore("mints");
    store.get(id).onsuccess = (event) => resolve(event.target.result);
    tx.onerror = e => reject(e);
  });
}

// --- UTILITY FUNCTIONS ---
function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ===== VMU Chart (ECharts) =====
let vmuChart = null;
let _vmuChartReady = false;
let _vmuChartMetric = 'vmus';
let _vmuChartInitPending = false; // if true, (re)init when Dashboard becomes visible

function _fmtAxisDateLabel(key){
  // Input key is 'YYYY-MM-DD'; output 'YYYY-Mon-DD'
  try {
    const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(key || '');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monIdx = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1));
    return `${m[1]}-${months[monIdx]}-${m[3]}`;
  } catch { return String(key || ''); }
}

function _collectActiveRows() {
  // Return ALL rows that are currently active (post-filter, post-sort), across all pages.
  try {
    const t = window.cointoolTable;
    if (!t) return [];
    // Preferred: data snapshot of all active rows
    try {
      const activeData = typeof t.getData === 'function' ? t.getData('active') : null;
      if (Array.isArray(activeData) && activeData.length >= 0) {
        console.debug('[VMU-CHART] _collectActiveRows source=data(active) count=', activeData.length);
        return activeData;
      }
    } catch {}
    // Fallback: RowComponents of active rows
    try {
      if (typeof t.getRows === 'function') {
        const rows = t.getRows('active');
        if (Array.isArray(rows)) {
          const out = rows.map(r => (typeof r.getData === 'function' ? r.getData() : r)).filter(Boolean);
          console.debug('[VMU-CHART] _collectActiveRows source=rowComponents(active) count=', out.length);
          return out;
        }
      }
    } catch {}
    // Last resort: full data set (may ignore filters depending on Tabulator version)
    try {
      const all = (typeof t.getData === 'function') ? t.getData() : [];
      console.debug('[VMU-CHART] _collectActiveRows source=data(all) count=', Array.isArray(all) ? all.length : 0);
      return Array.isArray(all) ? all : [];
    } catch {}
    return [];
  } catch (_) {
    return [];
  }
}

function _groupVMUsByDate(rows) {
  const map = {};
  for (const r of rows) {
    const vmu = Number(r?.VMUs || 0);
    if (!Number.isFinite(vmu) || vmu <= 0) continue;
    let dateStr = r?.maturityDateOnly;
    if (!dateStr) {
      const t = Number(r?.Maturity_Timestamp || 0);
      if (Number.isFinite(t) && t > 0) {
        dateStr = getLocalDateString(new Date(t * 1000));
      } else {
        // fallback: skip rows without a maturity date
        continue;
      }
    }
    map[dateStr] = (map[dateStr] || 0) + vmu;
  }
  const dates = Object.keys(map).sort();
  if (dates.length === 0 && typeof window.rowToLocalKey === 'function') {
    // Fallback: use global helper to compute date key from various row shapes
    const map2 = {};
    for (const r of rows) {
      const key = window.rowToLocalKey(r);
      if (!key) continue;
      const vmu = Number(r?.VMUs || 0);
      if (!Number.isFinite(vmu) || vmu <= 0) continue;
      map2[key] = (map2[key] || 0) + vmu;
    }
    const dates2 = Object.keys(map2).sort();
    console.debug('[VMU-CHART] fallback rowToLocalKey days=', dates2.length, 'sample=', dates2.slice(0,3).map(d=>({d, v: map2[d]})));
    return { dates: dates2, values: dates2.map(d => map2[d]) };
  }
  console.debug('[VMU-CHART] _groupVMUsByDate days=', dates.length, 'sample=', dates.slice(0,3).map(d=>({d, v: map[d]})));
  return { dates, values: dates.map(d => map[d]) };
}

function initVmuChartSection() {
  if (_vmuChartReady) return;
  const wrap  = document.getElementById('vmu-chart-wrap');
  const body  = document.getElementById('vmuChartBody');
  const btn   = document.getElementById('vmuChartToggle');
  const node  = document.getElementById('vmuChart');
  if (!wrap || !body || !btn || !node) return;

  // Toggle behavior
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const next = !expanded;
    setVmuChartExpandedState(next);
  });

  // Metric toggle wiring
  const vmusBtn = document.getElementById('vmuChartModeVMUs');
  const usdBtn  = document.getElementById('vmuChartModeUSD');
  if (vmusBtn && usdBtn) {
    const applyUi = () => {
      vmusBtn.classList.toggle('active', _vmuChartMetric === 'vmus');
      usdBtn.classList.toggle('active', _vmuChartMetric === 'usd');
      vmusBtn.setAttribute('aria-selected', String(_vmuChartMetric === 'vmus'));
      usdBtn.setAttribute('aria-selected', String(_vmuChartMetric === 'usd'));
    };
    const setMetric = (m) => {
      if (m !== 'vmus' && m !== 'usd') m = 'vmus';
      _vmuChartMetric = m;
      try { localStorage.setItem('vmuChartMetric', m); } catch {}
      applyUi();
      updateVmuChart();
    };
    vmusBtn.addEventListener('click', () => setMetric('vmus'));
    usdBtn.addEventListener('click', () => setMetric('usd'));
    // initial from storage
    try { _vmuChartMetric = (localStorage.getItem('vmuChartMetric') || 'vmus'); } catch {}
    if (_vmuChartMetric !== 'vmus' && _vmuChartMetric !== 'usd') _vmuChartMetric = 'vmus';
    applyUi();
  }

  // Defer ECharts init until expanded
  window.addEventListener('resize', () => { try { if (vmuChart) vmuChart.resize(); } catch {} });

  _vmuChartReady = true;
  // Initialize from saved state (default collapsed on first load)
  try {
    const saved = (localStorage.getItem('vmuChartExpanded') || '0') === '1';
    setVmuChartExpandedState(saved);
  } catch (_) {}
}

function updateVmuChart() {
  if (!document.getElementById('vmuChart')) return;
  if (!vmuChart && window.echarts) {
    // lazy init if needed
    initVmuChartSection();
  }
  if (!vmuChart) return;
  const node = document.getElementById('vmuChart');
  const w = node ? node.offsetWidth : 0;
  const h = node ? node.offsetHeight : 0;
  console.debug('[VMU-CHART] updateVmuChart size:', {w,h});
  if (!(node && w > 0 && h > 0)) { console.debug('[VMU-CHART] skip update due to zero size'); return; }
  const rows = _collectActiveRows();
  let dates = [], values = [];
  if (_vmuChartMetric === 'usd') {
    const out = _groupXenUsdByDate(rows);
    dates = out.dates; values = out.values;
  } else {
    const out = _groupVMUsByDate(rows);
    dates = out.dates; values = out.values;
  }
  console.debug('[VMU-CHART] metric=', _vmuChartMetric, 'points=', dates.length);
  if ((dates.length === 0) && rows && rows.length) {
    try {
      console.debug('[VMU-CHART] rows present but no dates. Sample row keys:', Object.keys(rows[0] || {}));
      console.debug('[VMU-CHART] sample rows[0..2]:', rows.slice(0,3));
    } catch {}
  }
    const empty = !dates || dates.length === 0;
  // Preserve current series type (line/bar) across updates (works with both custom and magicType toggles)
  let currentSeriesType = 'bar';
  try {
    const cur = vmuChart.getOption();
    if (cur && cur.series && cur.series[0] && cur.series[0].type) {
      currentSeriesType = cur.series[0].type;
    }
  } catch {}
  const opts = {
    title: { text: (_vmuChartMetric === 'usd' ? 'Value' : 'VMUs'), subtext: empty ? 'No data for current view' : '' },
    xAxis: { data: dates, axisLabel: { formatter: function(value){ return _fmtAxisDateLabel(value); } } },
    series: [{ type: currentSeriesType, data: values }],
    yAxis: { type: 'value', name: (_vmuChartMetric === 'usd' ? 'USD' : 'VMUs'), nameGap: 12 },
    tooltip: {
      trigger: 'axis',
      formatter: function(params){
        try {
          var p = Array.isArray(params) ? params[0] : params;
          var dateKey = (p && (p.axisValue || p.name)) || '';
          var d = new Date(dateKey + 'T00:00:00');
          var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          var fmtDate = isNaN(d.getTime())
            ? dateKey
            : (weekdays[d.getDay()] + ' ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear());
          var rows2 = _collectActiveRows();
          var vmuTotal = 0, usdTotal = 0;
          var price = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0) ? xenUsdPrice : null;
          for (var i=0;i<rows2.length;i++) {
            var r = rows2[i];
            var key = (typeof window.rowToLocalKey === 'function') ? window.rowToLocalKey(r) : (function(){
              var t = Number((r && r.Maturity_Timestamp) || 0);
              return isFinite(t) && t > 0 ? getLocalDateString(new Date(t * 1000)) : ((r && r.maturityDateOnly) || '');
            })();
            if (key !== dateKey) continue;
            var vmus = Number((r && r.VMUs) || 0);
            if (isFinite(vmus) && vmus > 0) vmuTotal += vmus;
            var tokens = Number(estimateXENForRow(r)) || 0;
            if (isFinite(tokens) && tokens > 0) usdTotal += (price ? tokens * price : tokens);
          }
          var vmuStr = Number(vmuTotal).toLocaleString();
          var usdStr = formatUSD(Number(usdTotal));
          return 'Date: ' + fmtDate + '<br/>VMUs: ' + vmuStr + '<br/>Value: ' + usdStr;
        } catch (e) {
          var v = Array.isArray(params) ? (params[0] && params[0].value) : (params && params.value);
          return (params && params.axisValue) + '<br/>' + Number(v).toLocaleString();
        }
      }
    }
  };

  // Apply light/dark/retro theming to chart, including metric-sensitive colors
  try {
    const isDark = document.body.classList.contains('dark-mode');
    const isRetro = document.body.classList.contains('retro-mode');
    const isMatrix = document.body.classList.contains('matrix-mode');
    const textColor = isDark ? '#e5e7eb' : isRetro ? '#c7fff7' : isMatrix ? '#00ff00' : '#111827';
    const axisColor = isDark ? '#9aa4b2' : isRetro ? '#bfe9ff' : isMatrix ? '#00aa00' : '#6b7280';
    const splitColor = isDark ? '#2a3341' : isRetro ? 'rgba(255,255,255,0.18)' : isMatrix ? '#003300' : '#e5e7eb';
    // Subtle dark gradient background
    if ((isDark || isRetro || isMatrix) && window.echarts && window.echarts.graphic) {
      const topC = isRetro ? '#061aa9' : isMatrix ? '#001100' : '#0b1220';
      const botC = isRetro ? '#04148a' : isMatrix ? '#000000' : '#0a0f1a';
      opts.backgroundColor = new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: topC },
        { offset: 1, color: botC },
      ]);
    } else {
      opts.backgroundColor = isDark ? '#111827' : isMatrix ? '#000000' : '#ffffff';
    }
    const retroFont = 'VT323, monospace';
    const matrixFont = 'Courier New, Monaco, Lucida Console, monospace';
    opts.textStyle = Object.assign({}, opts.textStyle || {}, {
      color: textColor,
      fontFamily: isRetro ? retroFont : isMatrix ? matrixFont : (opts.textStyle && opts.textStyle.fontFamily) || undefined,
    });
    opts.title.textStyle = Object.assign({}, opts.title.textStyle || {}, {
      color: textColor,
      fontFamily: isRetro ? retroFont : isMatrix ? matrixFont : (opts.title.textStyle && opts.title.textStyle.fontFamily) || undefined,
    });
    opts.xAxis = Object.assign({}, opts.xAxis, {
      axisLabel: Object.assign({}, opts.xAxis.axisLabel || {}, { color: axisColor, fontFamily: isRetro ? retroFont : isMatrix ? matrixFont : undefined }),
      axisLine: { lineStyle: { color: axisColor } },
      splitLine: { show: true, lineStyle: { color: splitColor } }
    });
    opts.yAxis = Object.assign({}, opts.yAxis, {
      axisLabel: Object.assign({}, (opts.yAxis && opts.yAxis.axisLabel) || {}, { color: axisColor, fontFamily: isRetro ? retroFont : isMatrix ? matrixFont : undefined }),
      axisLine: { lineStyle: { color: axisColor } },
      splitLine: { show: true, lineStyle: { color: splitColor } }
    });

    // Tooltip styling for themed modes
    if ((isDark || isRetro || isMatrix) && opts.tooltip) {
      opts.tooltip.backgroundColor = isRetro ? 'rgba(6, 19, 138, 0.96)' : isMatrix ? 'rgba(0, 17, 0, 0.96)' : 'rgba(47, 54, 66, 0.96)';
      opts.tooltip.borderColor = isRetro ? '#4e5bd4' : isMatrix ? '#00ff00' : '#4b5563';
      opts.tooltip.textStyle = { color: textColor };
      opts.tooltip.borderWidth = 1;
      opts.tooltip.borderRadius = isMatrix ? 0 : 10;
      opts.tooltip.extraCssText = isMatrix ? 'box-shadow: 0 0 10px rgba(0, 255, 0, 0.5); padding:8px 10px;' : 'box-shadow: 0 8px 20px rgba(0,0,0,.45); padding:8px 10px;';
      opts.axisPointer = {
        lineStyle: { color: axisColor, type: 'dashed', width: 1 }
      };
    }

    // Series colors by theme and metric
    const metric = (_vmuChartMetric === 'usd') ? 'usd' : 'vmus';
    if (isDark || isRetro || isMatrix) {
      const series = { type: currentSeriesType, data: values };
      if (currentSeriesType === 'bar') {
        // VMUs keep existing; USD uses distinct, theme-appropriate color
        const barColor = metric === 'vmus'
          ? (isRetro ? '#c2a1ff' : isMatrix ? '#00ff00' : '#e8cd0f')
          : (isRetro ? '#00ff9c' : isMatrix ? '#00ffff' : '#86efac');
        series.itemStyle = { color: barColor };
      } else {
        const lineColor = metric === 'vmus'
          ? (isRetro ? '#00ffff' : isMatrix ? '#00ff00' : '#e8cd0f')
          : (isRetro ? '#ffef5a' : isMatrix ? '#00ffff' : '#86efac');
        series.itemStyle = { color: lineColor };
        series.lineStyle = { color: lineColor, width: 2 };
        series.symbol = 'none';
        series.smooth = true;
      }
      opts.series = [series];
    } else {
      // Light theme
      const barColorLightVMU = '#2685f6';   // keep current
      const barColorLightUSD = '#34d399';   // emerald for $ value
      const lineColorLightUSD = '#059669';  // darker emerald for line

      try {
        opts.series = Array.isArray(opts.series) ? opts.series : [{ type: currentSeriesType, data: values }];
        if (currentSeriesType === 'bar') {
          const col = (metric === 'vmus') ? barColorLightVMU : barColorLightUSD;
          opts.series[0].itemStyle = Object.assign({}, opts.series[0].itemStyle || {}, { color: col });
        } else if (metric === 'usd') {
          // Only set explicit line color for USD; leave VMUs at existing default to "keep current color"
          opts.series[0].itemStyle = Object.assign({}, opts.series[0].itemStyle || {}, { color: lineColorLightUSD });
          opts.series[0].lineStyle = Object.assign({}, opts.series[0].lineStyle || {}, { color: lineColorLightUSD, width: 2 });
          opts.series[0].symbol = 'none';
          opts.series[0].smooth = true;
        }
      } catch {}
    }
  } catch {}

  try {
    // Merge update to preserve series.type and axes configuration
    vmuChart.setOption(opts);
  } catch(e) {
    console.warn('[VMU-CHART] setOption(data) failed', e);
  }
}

// Persist and apply expanded state; init chart on expand
function setVmuChartExpandedState(open) {
  const body = document.getElementById('vmuChartBody');
  const btn  = document.getElementById('vmuChartToggle');
  const node = document.getElementById('vmuChart');
  if (!btn || !body || !node) return;
  try { localStorage.setItem('vmuChartExpanded', open ? '1' : '0'); } catch {}

  btn.setAttribute('aria-expanded', String(!!open));
  btn.textContent = open ? '- Hide Chart' : '+ Show Chart';
  body.hidden = !open;

  if (!open) return;

  console.debug('[VMU-CHART] setExpandedState -> open. node size before:', { w: node.offsetWidth, h: node.offsetHeight });

  if (!vmuChart && window.echarts && typeof window.echarts.init === 'function') {
    const dashVisible = document.getElementById('tab-dashboard')?.classList.contains('active');
    const hasSize = (node.offsetWidth > 0 && node.offsetHeight > 0);
    if (!dashVisible || !hasSize) {
      // Defer init until the chart becomes visible and has layout size
      _vmuChartInitPending = true;
      return;
    }
    if (!hasSize) {
      node.style.width = '100%';
      node.style.height = node.style.height || '260px';
    }
    try {
      vmuChart = window.echarts.init(node, null, { useDirtyRect: true });
      console.debug('[VMU-CHART] echarts.init OK');
    } catch(e) {
      console.warn('[VMU-CHART] echarts.init failed', e);
    }
    const options = {
      title: { text: 'VMUs', left: 'center', top: 6, textStyle: { fontSize: 12 } },
      tooltip: { trigger: 'axis' },
      toolbox: {
        right: 10,
        feature: (function(){
          const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
          // Helper: set series type without losing data
          function setSeriesType(kind){
            try {
              if (vmuChart) {
                vmuChart.setOption({ series: [{ type: kind }] });
                // Ensure future updates respect the chosen type
                updateVmuChart();
              }
            } catch(e) { console.warn('[VMU-CHART] setSeriesType failed', e); }
          }
          const myFullscreen = {
            show: true,
            title: 'Toggle Fullscreen',
            icon: 'path://M2,2 L10,2 L10,10 L2,10 Z M4,4 L8,4 L8,8 L4,8 Z',
            onclick: function() {
              const el = node;
              if (!document.fullscreenElement) {
                // Use current page background for fullscreen backdrop
                try { el.style.backgroundColor = getComputedStyle(document.body).backgroundColor; } catch {}
                el.requestFullscreen?.();
              } else {
                document.exitFullscreen?.();
              }
              // Clean up background on exit
              const tidy = () => {
                if (!document.fullscreenElement) {
                  try { el.style.backgroundColor = ''; } catch {}
                  try { vmuChart && vmuChart.resize(); } catch {}
                  document.removeEventListener('fullscreenchange', tidy);
                }
              };
              document.addEventListener('fullscreenchange', tidy);
              setTimeout(() => { vmuChart && vmuChart.resize(); }, 100);
            }
          };
          if (isMobile) {
            return {
              myLine:    { show: true, title: 'Line', icon: 'path://M2,12 L6,8 L10,10 L14,6', onclick: () => setSeriesType('line') },
              myBar:     { show: true, title: 'Bar',  icon: 'path://M3,12 L3,6 L5,6 L5,12 Z M7,12 L7,4 L9,4 L9,12 Z M11,12 L11,8 L13,8 L13,12 Z', onclick: () => setSeriesType('bar') },
              myFullscreen
            };
          }
          // Desktop: remove zoom buttons, keep magicType, saveAsImage, fullscreen.
          return {
            magicType: { type: ['line', 'bar'] },
            saveAsImage: {},
            myFullscreen
          };
        })()
      },
      dataZoom: [
        { type: 'inside', throttle: 50 },
        { type: 'slider' }
      ],
      grid: { left: 55, right: 20, top: 40, bottom: 60 },
      xAxis: { type: 'category', data: [], axisLabel: { formatter: function(value){ return _fmtAxisDateLabel(value); } } },
      yAxis: { type: 'value', name: 'VMUs', nameGap: 12 },
      series: [{ type: 'bar', data: [] }]
    };
    try { vmuChart && vmuChart.setOption(options); console.debug('[VMU-CHART] setOption(base) done'); } catch(e) { console.warn('[VMU-CHART] setOption(base) failed', e); }
  } else if (!window.echarts) {
    try { node.textContent = 'Chart library failed to load.'; } catch {}
  }

requestAnimationFrame(() => {
    try { if (vmuChart) { console.debug('[VMU-CHART] rAF update pass (setter)'); updateVmuChart(); vmuChart.resize(); } } catch(e) { console.warn('[VMU-CHART] rAF update failed (setter)', e); }
    requestAnimationFrame(() => { try { if (vmuChart) { console.debug('[VMU-CHART] rAF resize pass2 (setter)'); vmuChart.resize(); } } catch(e) { console.warn('[VMU-CHART] rAF resize2 failed (setter)', e); } });
  });
}

function _groupXenUsdByDate(rows) {
  const price = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0) ? xenUsdPrice : null;
  const map = {};
  for (const r of rows) {
    const key = (typeof window.rowToLocalKey === 'function') ? window.rowToLocalKey(r) : (function(){
      const t = Number(r?.Maturity_Timestamp || 0);
      return Number.isFinite(t) && t > 0 ? getLocalDateString(new Date(t * 1000)) : (r?.maturityDateOnly || '');
    })();
    if (!key) continue;
    const tokens = Number(estimateXENForRow(r)) || 0;
    if (!Number.isFinite(tokens) || tokens <= 0) continue;
    map[key] = (map[key] || 0) + (price ? tokens * price : tokens);
  }
  const dates = Object.keys(map).sort();
  console.debug('[VMU-CHART] _groupXenUsdByDate days=', dates.length, 'price=', price, 'sample=', dates.slice(0,3).map(d=>({d, v: map[d]})));
  return { dates, values: dates.map(d => map[d]) };
}

/* NEW: single source of truth for chunk size */
function getChunkSize(){
  const v = parseInt(localStorage.getItem("chunkSize") || "50000", 10);
  return Number.isFinite(v) && v > 0 ? v : 50000;
}

function formatSeconds(seconds) {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '...';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

// --- Unified scan progress helpers ---
function shortAddr(addr){
  if (!addr) return '';
  const a = String(addr);
  if (a.length <= 12) return a;
  return `${a.slice(0,6)}…${a.slice(-4)}`;
}

window.progressUI = {
  shortAddr,
  setType(label){
    const el = document.getElementById('scanTypeText');
    if (el) el.textContent = label ? `Scanning: ${label}` : '';
  },
  setAddress(i, total, addr, suffix){
    const el = document.getElementById('addressProgressText');
    if (!el) return;
    const sfx = suffix ? ` — ${suffix}` : '';
    el.textContent = `Scanning address ${i}/${total}: ${shortAddr(addr)}${sfx}`;
  },
  setStage(label, done, total, extra){
    const bar = document.getElementById('tokenProgressBar');
    const txt = document.getElementById('tokenProgressText');
    if (bar && Number.isFinite(total) && total > 0) {
      bar.max = total; bar.value = Math.min(done, total);
    }
    const pct = (Number.isFinite(done) && Number.isFinite(total) && total>0)
      ? ` (${Math.floor((done/total)*100)}%)` : '';
    if (txt) txt.textContent = `${label} ${Number.isFinite(done)?done:''}${Number.isFinite(total)?`/${total}`:''}${pct}${extra?` — ${extra}`:''}`.trim();
  },
  setEta(sec){
    const etr = document.getElementById('etrText');
    if (!etr) return;
    etr.textContent = (sec && sec > 2) ? `ETA: ${formatSeconds(sec)}` : '';
  },
  setIdle(sinceSec){
    const el = document.getElementById('rpcStatus');
    if (!el) return;
    el.textContent = (sinceSec && sinceSec >= 3) ? `⏳ ${sinceSec}s since last reply` : '';
  },
  show(show=true){
    const pc = document.getElementById('progressContainer');
    if (!pc) return;
    if (show) {
      pc.classList.add('visible');
      // Ensure inline display can't keep it hidden
      try { pc.style.display = 'block'; } catch {}
    } else {
      pc.classList.remove('visible');
      try { pc.style.display = 'none'; } catch {}
    }
  }
};
// Strict hex normalizer for hashing: keeps leading zeros, enforces even length & hex chars
function normalizeSaltForHash(s) {
  if (typeof s !== 'string') return null;
  let out = s.trim().toLowerCase();
  if (!out.startsWith('0x')) return null;
  out = out.slice(2).replace(/\s+/g, ''); // strip any stray whitespace chars
  if (!/^[0-9a-f]*$/.test(out)) return null;
  if (out.length % 2 === 1) out = '0' + out;
  return '0x' + out;
}

function computeProxyAddress(web3, deployer, mintId, salt, minter) {
  // 1) Validate & sanitize pieces
  const safeSalt = normalizeSaltForHash(salt); // keeps leading zeros, even length
  if (!safeSalt || typeof mintId !== 'number' && typeof mintId !== 'bigint') return null;

  const addr = (minter || '').toLowerCase();
  if (!addr.startsWith('0x') || addr.length > 42) return null;

  const dep = (deployer || '').toLowerCase();
  if (!dep.startsWith('0x') || dep.length !== 42) return null;

  // 2) Build abi.encodePacked(_salt, mintId, minter) manually
  //   - bytes: raw (no length), hex as-is
  //   - uint256: 32-byte left-padded
  //   - address: 20-byte (40 hex chars) left-padded
  const saltHex = safeSalt.slice(2);                                      // raw bytes
  const mintHex = BigInt(mintId).toString(16).padStart(64, '0');          // 32 bytes
  const addrHex = addr.slice(2).padStart(40, '0');                        // 20 bytes

  const packed = '0x' + saltHex + mintHex + addrHex;
  const saltForHash = web3.utils.keccak256(packed);

  // 3) CREATE2: keccak256(0xff ++ deployer ++ saltHash ++ keccak256(init_code))
  const initCode = '0x3d602d80600a3d3981f3363d3d373d3d3d363d73' + dep.slice(2) + '5af43d82803e903d91602b57fd5bf3';
  const initCodeHash = web3.utils.keccak256(initCode);

  const combined = '0xff' + dep.slice(2) + saltForHash.slice(2) + initCodeHash.slice(2);
  const computedHash = web3.utils.keccak256(combined);

  return web3.utils.toChecksumAddress('0x' + computedHash.slice(-40));
}

// Normalize salt hex (handles '0x01' vs '0x0001')
function normalizeSalt(s) {
  if (!s || typeof s !== 'string') return s;
  let out = s.toLowerCase();
  if (out.startsWith('0x')) out = out.slice(2);
  out = out.replace(/^0+/, '');     // strip leading zeros
  if (out === '') out = '0';
  return '0x' + out;
}

document.getElementById("resetBtn").addEventListener("click", async function () {
  function friendlyDbName(id){
    switch(id){
      case 'DB_Cointool': return 'Cointool (mints)';
      case 'DB_Xenft': return 'XENFT (NFT scans)';
      case 'DB-Xenft-Stake': return 'XENFT Stake (stakes)';
      case 'DB-Xen-Stake': return 'XEN Stake (regular)';
      default: return id;
    }
  }
  const sel = document.getElementById("resetDbSelect");
  const choice = (sel && sel.value) ? sel.value : "all";

  if (choice === "all") {
    const confirmed = confirm(
      "Are you sure you want to delete all saved data (DB_Cointool, DB_Xenft, DB-Xenft-Stake, and DB-Xen-Stake)? Your input fields will not be affected. This action cannot be undone."
    );
    if (!confirmed) return;

    // Close any open connections we can reach
    try { if (window.dbInstance) window.dbInstance.close(); } catch {}
    try {
      if (window.xenft?.openDB) {
        const xf = await window.xenft.openDB();
        try { xf.close(); } catch {}
      }
    } catch {}
    try {
      if (window.xenftStake?.openDB) {
        const stakeDb = await window.xenftStake.openDB();
        try { stakeDb.close(); } catch {}
      }
    } catch {}
    try {
      if (window.xenStake?.openDB) {                 // ✅ close DB-Xen-Stake
        const xsDb = await window.xenStake.openDB();
        try { xsDb.close(); } catch {}
      }
    } catch {}

    // Delete all four DBs
    const results = await Promise.allSettled([
      deleteDatabaseByName("DB_Cointool"),
      deleteDatabaseByName("DB_Xenft"),
      deleteDatabaseByName("DB-Xenft-Stake"),
      deleteDatabaseByName("DB-Xen-Stake")          // ✅ regular stakes DB
    ]);

    const blocked = results.some(r => r.status === 'fulfilled' && r.value === 'blocked');
    if (blocked) {
      alert("Some data could not be deleted because another tab or window is using it. Please close other tabs using this app and try again.");
      return;
    }

    window.location.reload();
    return;
  }

  // Single DB deletion path
  const confirmed = confirm(
    `Are you sure you want to delete only ${friendlyDbName(choice)}? Your input fields will not be affected. This action cannot be undone.`
  );
  if (!confirmed) return;

  // Close the specific DB if open
  try {
    if (choice === "DB_Cointool" && window.dbInstance) {
      window.dbInstance.close();
    }
  } catch {}
  try {
    if (choice === "DB_Xenft" && window.xenft?.openDB) {
      const xf = await window.xenft.openDB();
      try { xf.close(); } catch {}
    }
  } catch {}
  try {
    if (choice === "DB-Xenft-Stake" && window.xenftStake?.openDB) {
      const stakeDb = await window.xenftStake.openDB();
      try { stakeDb.close(); } catch {}
    }
  } catch {}
  try {
    if (choice === "DB-Xen-Stake" && window.xenStake?.openDB) {
      const xsDb = await window.xenStake.openDB();
      try { xsDb.close(); } catch {}
    }
  } catch {}

  const result = await deleteDatabaseByName(choice);
  if (result === 'blocked') {
    alert("The selected database could not be deleted because another tab or window is using it. Please close other tabs using this app and try again.");
    return;
  }

  window.location.reload();
});

// Parse inputs like ">= 1M", "10k-50k", "<250000", or "500000"
function matchesNumberQuery(value, raw){
  const s = String(raw).trim().toLowerCase();

  // convert "1k/1m/1b" etc to numbers
  function toNum(txt){
    const t = String(txt).trim().replace(/[, _]/g, "");
    const m = t.match(/^([<>]=?|=)?\s*([0-9]*\.?[0-9]+)\s*([kmbt])?$/i);
    if (!m) return { op: null, num: NaN };
    const op = m[1] || null;
    const n  = parseFloat(m[2]);
    const suf = (m[3] || "").toLowerCase();
    const mul = suf === "k" ? 1e3 : suf === "m" ? 1e6 : suf === "b" ? 1e9 : suf === "t" ? 1e12 : 1;
    return { op, num: n * mul };
  }

  // Range: "a-b"
  if (s.includes("-")) {
    const [a,b] = s.split("-");
    const A = toNum(a).num, B = toNum(b).num;
    if (Number.isFinite(A) && Number.isFinite(B)) return value >= Math.min(A,B) && value <= Math.max(A,B);
    return true; // invalid input → don't filter out rows
  }

  // Single comparator or plain number
  const { op, num } = toNum(s);
  if (!Number.isFinite(num)) return true;

  switch (op) {
    case ">":  return value >  num;
    case ">=": return value >= num;
    case "<":  return value <  num;
    case "<=": return value <= num;
    case "=":  return value === num;
    default:   return value >= num; // default behavior for a lone number
  }
}

function switchRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % rpcEndpoints.length;
  const newRpc = rpcEndpoints[currentRpcIndex];
  try {
    web3.setProvider(new Web3.providers.HttpProvider(newRpc));
    contract.setProvider(web3.currentProvider);
    console.log(`Switched to new RPC: ${newRpc}`);
  } catch (e) {
    console.error("Failed to set new provider", e);
  }
}

async function makeRpcRequest(requestFn, requestName) {
  const maxAttempts = rpcEndpoints.length * 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      console.warn(`RPC request '${requestName}' failed on attempt ${attempt}/${maxAttempts} with ${rpcEndpoints[currentRpcIndex]}. Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 250));
      switchRpc();
    }
  }
  throw new Error(`RPC request '${requestName}' failed after ${maxAttempts} attempts on all available RPCs.`);
}

// Helper: ensure Flatpickr header (month/year) isn't pushed down by vendor padding
function __fixFlatpickrHeader(fpInstance){
  try {
    const root = fpInstance && fpInstance.calendarContainer;
    if (!root) return;
    const hdr = root.querySelector('.flatpickr-current-month');
    if (hdr) {
      hdr.style.paddingTop = '0px';
      // Also clear full padding to override vendor shorthand
      hdr.style.padding = '0px';
    }
  } catch {}
}

// Optional: keep an initial instance so the calendar is usable even before data loads
window._calendar = flatpickr("#calendar", {
  inline: true,
  defaultDate: "today",
  onReady: function(selectedDates, dateStr, instance){ __fixFlatpickrHeader(instance); }
});

// Helper to always grab the *current* calendar instance
function getActiveCalendar() {
  // Prefer the instance created by unify.js
  if (window.calendarPicker && typeof window.calendarPicker.setDate === "function") {
    return window.calendarPicker;
  }
  // Fallback to the bootstrap instance
  if (window._calendar && typeof window._calendar.setDate === "function") {
    return window._calendar;
  }
  return null;
}

// Wire up the "Center Calendar" button (appears on the Dashboard filter row)
(function attachCenterCalendar(){
  const btn = document.getElementById("centerCalendarBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    let cal = getActiveCalendar();
    if (!cal) return;

    const today = new Date();

    // 1. Jump calendar view to today's month/year without selecting a date
    try { cal.jumpToDate?.(today); } catch {}

    // 2. Format the filter text as "YYYY Mon" (e.g., "2025 Sep")
    const year = today.getFullYear();
    const monthName = today.toLocaleString('default', { month: 'short' });
    const filterText = `${year} ${monthName}`;

    // 3. Set the header filter and clear any visual selection in the calendar
    if (typeof setHeaderFilterTextDebounced === 'function') {
      setHeaderFilterTextDebounced("Maturity_Date_Fmt", filterText);
    }
    try { cal.clear(); } catch {} // This removes the highlight from any selected day
  });
})();


// Normalize a stake amount from row → BigInt wei
  function _stakeAmountWei(row) {
    // Priority 1: explicit wei if present
    if (row && row.amountWei) {
      try {
        const wei = BigInt(String(row.amountWei));
        if (wei > 0n) return wei;
      } catch {}
    }
    // Priority 2: token amount → wei
    if (row && (row.stakedAmount || row.amount)) {
      try {
        const tokens = BigInt(String(row.stakedAmount || row.amount).replace(/[,_\s]/g, ""));
        if (tokens > 0n) return tokens * 1000000000000000000n;
      } catch {}
    }
    return 0n;
  }

// --- TABULATOR TABLE ---
let cointoolTable;
function populateTable(mints) {
  const tableExists = !!document.getElementById("cointool-table").tabulator;
  if (tableExists) {
    window.cointoolTable = document.getElementById("cointool-table").tabulator; // ← add this
    cointoolTable.replaceData(mints);
    // Ensure bulk bar and selection hooks remain wired
    ensureBulkBar();
    refreshBulkUI();
    if (!cointoolTable._bulkEvents) {
      cointoolTable.on("rowSelected", (row) => { try { selectedRows.add(row.getIndex()); } catch {} refreshBulkUI(); });
      cointoolTable.on("rowDeselected", (row) => { try { selectedRows.delete(row.getIndex()); } catch {} refreshBulkUI(); });
      cointoolTable.on("rowSelectionChanged", (_data, rows) => { try { selectedRows.clear(); rows.forEach(r => selectedRows.add(r.getIndex())); } catch {} refreshBulkUI(); });
      cointoolTable._bulkEvents = true;
    }
    return;
  }
  cointoolTable = new Tabulator("#cointool-table", {

    // Add the event handlers here, at the top level:
    selectable: true,
    // Only allow selecting Cointool rows; disable others (XENFT, Stake, etc.)
    selectableCheck: function(row){
      try {
        const t = String((row.getData() || {}).SourceType || 'Cointool');
        return t === 'Cointool';
      } catch (_) { return true; }
    },
    // Visually disable non-Cointool checkboxes on render
    rowFormatter: function(row){
      try {
        const t = String((row.getData() || {}).SourceType || 'Cointool');
        if (t !== 'Cointool') {
          const cells = row.getCells();
          const c0 = (cells && cells.length) ? cells[0] : null;
          const el = c0 ? c0.getElement() : null;
          const inp = el ? el.querySelector('input[type="checkbox"]') : null;
          if (inp) { inp.disabled = true; inp.checked = false; }
        }
      } catch (_) {}
    },
    rowSelected: function(row) {
      selectedRows.add(row.getIndex());
      refreshBulkUI();
    },
    rowDeselected: function(row) {
      selectedRows.delete(row.getIndex());
      refreshBulkUI();
    },

    data: mints,
    layout: "fitData",
    index: "ID",
    pagination: "local",
    paginationSize: 20,
    paginationSizeSelector: [10, 20, 50, 100],
    // Default sort: maturity date ascending on first load
    initialSort: [
      { column: 'Maturity_Date_Fmt', dir: 'asc' }
    ],
    persistentLayout: true,
    persistenceID: "cointoolTableGrouped",

    // ✅ make Tabulator actually call column tooltip functions
    tooltips: true,

    // Ensure Status header filter defaults to 'All' (no filtering)
    initialHeaderFilter: [
      { field: 'Status', value: '' }
    ],

    columns: [
      {
        title: "",
        formatter: "rowSelection",
        hozAlign: "center",
        headerSort: false,
        width: 40,
        cellClick: function(e, cell) {
          const data = cell.getRow().getData();
          const t = String((data || {}).SourceType || 'Cointool');
          if (t !== 'Cointool') return; // ignore clicks on non-Cointool rows
          cell.getRow().toggleSelect();
        },
      },

      {
        title: "Mint ID",
        field: "Mint_id_Start",
        headerFilter: "input",
        sorter: "number",
        width: 120,
        formatter: function(cell) {
          const row   = cell.getRow().getData();
          const value = String(cell.getValue() ?? "");

          // XENFT rows → link token inventory page
          if (row.SourceType === "XENFT") {
            const ca = (window.xenft && window.xenft.CONTRACT_ADDRESS)
              ? window.xenft.CONTRACT_ADDRESS
              : "0x0a252663DBCc0b073063D6420a40319e438Cfa59";
            return `<a href="https://etherscan.io/token/${ca}?a=${value}" target="_blank">${value}</a>`;
          }

          // Stake XENFT rows → link NFT page
          if (row.SourceType === "Stake XENFT") {
            const acts = Array.isArray(row.Actions) ? row.Actions : (Array.isArray(row.actions) ? row.actions : []);
            const first = acts && acts.length ? acts[0] : null;
            const hash = first && (first.hash || first.txHash);
            if (hash) {
              return `<a href="https://etherscan.io/tx/${hash}" target="_blank" rel="noopener">${value}</a>`;
            }
            const ca = "0xfeda03b91514d31b435d4e1519fd9e699c29bbfc";
            return `<a href="https://etherscan.io/nft/${ca}/${value}" target="_blank" rel="noopener">${value}</a>`;
          }

          // ✅ Regular Stakes → show short id (last 8)
          if (row.SourceType === "Stake") {
            const short = value.length > 8 ? value.slice(-8) : value;
            const acts = Array.isArray(row.Actions) ? row.Actions : (Array.isArray(row.actions) ? row.actions : []);
            const first = acts && acts.length ? acts[0] : null;
            const hash = first && (first.hash || first.txHash);
            if (hash) {
              return `<a href="https://etherscan.io/tx/${hash}" target="_blank" rel="noopener">${short}</a>`;
            }
            // keep full value in a tooltip for convenience
            return `<span title="${value}">${short}</span>`;
          }

          // CoinTool rows → link to mint tx if present
          if (row.TX_Hash) {
            return `<a href="https://etherscan.io/tx/${row.TX_Hash}" target="_blank">${value}</a>`;
          }

          return value;
        }
      },


      { title: "Salt", field: "Salt", headerFilter: "input", width: 80,
        formatter: (cell) => {
          const salt = cell.getValue();
          return `<span ">${salt.length > 6 ? salt.slice(0, 6) + '...' : salt}</span>`;
        }
      },
      { title: "cRank Range", field: "Rank_Range", headerFilter: "input", width: 220 },
      { title: "Term", field: "Term", headerFilter: "input", sorter: "number", width: 120 },
      { title: "VMUs", field: "VMUs", headerFilter: "input", sorter: "number", width: 80 },
      {
        title: "Status",
        field: "Status",
        headerFilter: "list",
        headerFilterParams: {
          // Values migrated to Tabulator v6 list format
          values: [
            { label: "All", value: "" },
            { label: "Maturing", value: "Maturing" },
            { label: "Claimable", value: "Claimable" },
            { label: "Claimed", value: "Claimed" },
            { label: "Ended Early", value: "Ended Early" },
          ]
        },
        width: 110,

        // ✅ Filter by live/computed status, exact match; blank = All
        headerFilterFunc: function(headerValue, _rowValue, rowData){
          const raw = String(headerValue ?? "").trim();
          if (!raw) return true; // All

          // map a few casual inputs → canonical statuses (defensive for programmatic sets)
          const q = raw.toLowerCase();
          const map = {
            "ready": "claimable",
            "claim": "claimable",
            "claimable": "claimable",
            "maturing": "maturing",
            "pending": "maturing",
            "claimed": "claimed",
            "ended early": "ended early",
          };
          const target = map[q] || q;

          // ✅ Get the single source of truth for the row's status
          const currentStatus = computeLiveStatus(rowData).toLowerCase();

          // Perform an exact match
          return currentStatus === target;
        },

        formatter: function(cell){
          const rowData = cell.getRow().getData();
          const live = computeLiveStatus(rowData);
          if (live === 'Claimable') {
            if (connectedAccount && connectedAccount.toLowerCase() === rowData.Owner.toLowerCase()) {
              return `<span class="claim-button">Claimable</span>`;
            }
          }
          return live;
        },
        cellClick: function(e, cell){
          const rowData = cell.getRow().getData();
          const liveStatus = computeLiveStatus(rowData);

          // If the status is claimable and the user clicked the button, handle the action
          if (liveStatus === 'Claimable' &&
            e.target.classList.contains('claim-button') &&
            connectedAccount &&
            connectedAccount.toLowerCase() === rowData.Owner.toLowerCase())
          {
            handleClaimAction(rowData);
          }
        }
      }
      ,
      {
        title: "Actions",
        field: "Actions",
        headerFilter: "input",
        width: 100,
        sorter:"number",
        sorterParams:{
          accessor: (value) => value ? value.length : 0
        },
        formatter: function(cell) {
          const actions = cell.getValue() || [];
          const actionCount = actions.length;
          const rowData = cell.getRow().getData();
          const vmus = BigInt(rowData.VMUs);

          if (actionCount === 0) {
            return "0";
          }

          const links = actions.map((action, index) => {
            const href = `https://etherscan.io/tx/${(action.hash || action.txHash || '')}`;
            const date = luxon.DateTime.fromSeconds(Number(action.timeStamp)).toFormat('MMM d, yyyy, hh:mm a');
            let tooltipText = `${date}\nHash: ${(action.hash || action.txHash || 'n/a')}`;
            if (action.rank) {
              const startRank = BigInt(action.rank);
              const endRank = startRank + vmus - 1n;
              tooltipText += `\ncRank Range: ${startRank}-${endRank}`;
            }

            return `<a href="${href}" title="${tooltipText}" target="_blank">${index + 1}</a>`;
          });

          return links.join(', ');
        }
      },
      {
        title: "Maturity Date",
        field: "Maturity_Date_Fmt",
        headerFilter: "input",
        headerFilterPlaceholder: "Type e.g. 2025 Aug",

        // ✨ NEW: sort by the numeric timestamp (seconds)
        sorter: function(a, b, aRow, bRow) {
          const ra = aRow.getData?.() || {};
          const rb = bRow.getData?.() || {};
          const ta = Number(ra.Maturity_Timestamp) || 0;
          const tb = Number(rb.Maturity_Timestamp) || 0;

          // If both timestamps exist, sort by them
          if (ta && tb) return ta - tb;

          // Fallback: try to parse the displayed text (keeps working even if timestamp is missing)
          const pa = Date.parse(String(a).replace(/,\s*/, ' ')) || 0;
          const pb = Date.parse(String(b).replace(/,\s*/, ' ')) || 0;
          return pa - pb;
        },

        // same filter logic you already have...
        headerFilterFunc: function (headerValue, rowValue) {
          const qRaw = String(headerValue || "").trim();
          if (!qRaw) return true;
          const rv = String(rowValue || "");
          const q = qRaw.toLowerCase().replace(/\s+/g, " ");
          const rvNorm = rv.toLowerCase();
          const m = q.match(/^(\d{4})\s+([a-z]{3})(?:\s+(\d{1,2}))?$/i);
          if (m) {
            const year = m[1];
            const mon  = m[2].slice(0,3);
            if (m[3]) {
              const day = String(parseInt(m[3], 10));
              const re = new RegExp(`^${year}\\s+${mon}\\s+0?${day}\\b`, "i"); // ← handles 2 and 02
              return re.test(rv);
            }
            const prefix = `${year} ${mon}`;
            return rvNorm.startsWith(prefix.toLowerCase());
          }
          return rvNorm.includes(q);
        },
        // ✅ Tabulator tooltip (console-debugged)
        tooltip: function(cell){
          if (!cell || typeof cell.getRow !== "function") {
            console.debug("[MaturityTooltip] tooltip() no cell / no getRow");
            return "";
          }
          const row = cell.getRow().getData?.();
          if (!row) {
            console.debug("[MaturityTooltip] tooltip() no row data");
            return "";
          }
          const tip = computeMaturityTooltip(row) || "";
          console.debug("[MaturityTooltip] tooltip() →", tip);
          return tip;
        },

        // ✅ Native browser title as a fallback so you still get a tooltip even if Tabulator tooltips are off
        formatter: function(cell){
          const row = cell.getRow().getData();
          const text = cell.getValue() || "";
          const tip = computeMaturityTooltip(row) || "";

          // Create a span element for the cell's content
          const content = document.createElement("span");
          content.textContent = text;

          // This keeps the original hover tooltip for desktop users
          content.title = tip;

          // This adds the new tap-and-hold functionality for mobile users
          addLongPressTooltip(content, tip);

          return content; // Return the new element to Tabulator
        },
      },

      {
        title: "Est. XEN",
        field: "Est_XEN",
        width: 140,
        hozAlign: "right",

        headerFilter: "input",
        headerFilterPlaceholder: "e.g. >=1B, 1B-2B",

        headerFilterFunc: function(headerValue, rowValue, rowData){
          const query = String(headerValue || "").trim();
          if (!query) return true;
          const est = estimateXENForRow(rowData);
          return matchesNumberQuery(est, query);
        },

        sorter: function(a, b, aRow, bRow) {
          return estimateXENForRow(aRow.getData()) - estimateXENForRow(bRow.getData());
        },

        // Native title (fallback) with $ values
        formatter: function(cell) {
          const row = cell.getRow().getData();
          const est = estimateXENForRow(row);
          const tip = buildEstXenTooltip(row, est);

          // Create a container for the cell content
          const content = document.createElement("span");
          content.textContent = est.toLocaleString();
          content.title = tip; // Keep the desktop tooltip

          // Attach the long-press listener for mobile
          addLongPressTooltip(content, tip);

          return content;
        },

        // Pretty Tabulator hover tooltip with $ values
        tooltip: function(cell){
          const row = cell?.getRow?.().getData?.() || {};
        if (row?.SourceType === "Stake" || row?.SourceType === "Stake XENFT") {
          const b = stakeEstBreakdown(row);
          if (!b) return row.SourceType;
          const toTok = (x) => Number(x / b.ONE_ETHER);
          const fmtTok = (n) => n.toLocaleString();
          const fmtUsd = (n) => (typeof xenUsdPrice === 'number' && xenUsdPrice > 0)
            ? ` (${formatUSD(n * xenUsdPrice)})` : '';

            const principalTok = toTok(b.amount);
            const rewardTok    = toTok(b.reward);
            const totalTok     = toTok(b.total);

            return `${row.SourceType}
Principal: ${fmtTok(principalTok)}${fmtUsd(principalTok)}
APY: ${b.apy}%, Term: ${b.termDays}d
Reward: ${fmtTok(rewardTok)}${fmtUsd(rewardTok)}
Total: ${fmtTok(totalTok)}${fmtUsd(totalTok)}`;
          }},
      },

      {
        title: "Owner", field: "Owner", headerFilter: "input", formatter: cell => {
          let val = cell.getValue();
          return (val && val.length > 12) ? `<a href="https://etherscan.io/address/${val}" target="_blank"">${val.substring(0, 4)}...${val.substring(val.length - 4)}</a>` : val;
        }
      }
    ],
    headerFilterLiveFilter: true,
  });

  window.cointoolTable = cointoolTable;
  // Also wire selection events so the bulk bar updates immediately
  cointoolTable.on("rowSelected", (row) => {
    try { selectedRows.add(row.getIndex()); } catch {}
    refreshBulkUI();
  });
  cointoolTable.on("rowDeselected", (row) => {
    try { selectedRows.delete(row.getIndex()); } catch {}
    refreshBulkUI();
  });
  cointoolTable.on("rowSelectionChanged", (_data, rows) => {
    try {
      selectedRows.clear();
      rows.forEach(r => selectedRows.add(r.getIndex()));
    } catch {}
    refreshBulkUI();
  });
  cointoolTable.on("renderComplete", refreshBulkUI);
  cointoolTable.on("dataProcessed", refreshBulkUI);
  // Existing handler
  cointoolTable.on("dataProcessed", function(){
    updateSummaryStats();
    document.getElementById("downloadBtn").style.display = (cointoolTable.getDataCount("active") > 0) ? "inline-block" : "none";
  });

  cointoolTable.on("tableBuilt",     updateXENTotalBadge);
  cointoolTable.on("dataLoaded",     updateXENTotalBadge);
  cointoolTable.on("dataProcessed",  updateXENTotalBadge);
  cointoolTable.on("dataFiltered",   updateXENTotalBadge);
  cointoolTable.on("dataSorted",     updateXENTotalBadge);
  cointoolTable.on("renderComplete", updateXENTotalBadge);
  cointoolTable.on("pageLoaded",     updateXENTotalBadge);

  // VMU Chart wiring
  cointoolTable.on("tableBuilt",     initVmuChartSection);
  const _chartUpdater = () => { try { updateVmuChart(); } catch (e) { /* noop */ } };
  cointoolTable.on("dataLoaded",     _chartUpdater);
  cointoolTable.on("dataProcessed",  _chartUpdater);
  cointoolTable.on("dataFiltered",   _chartUpdater);
  // Be extra explicit: update on header filter changes too (if supported)
  try { cointoolTable.on("headerFilterChanged", _chartUpdater); } catch {}
  try { cointoolTable.on("filterChanged", _chartUpdater); } catch {}
  cointoolTable.on("dataSorted",     _chartUpdater);
  cointoolTable.on("renderComplete", _chartUpdater);
  cointoolTable.on("pageLoaded",     _chartUpdater);


  startStatusTicker();

  // Ensure Status header filter shows 'All' by default
  try {
    cointoolTable.on("tableBuilt", () => {
      try { cointoolTable.setHeaderFilterValue('Status', ''); } catch (_) {}
    });
  } catch (_) {}
}

function formatDurationParts(obj) {
  const y = Math.max(0, Math.floor(obj.years   || 0));
  const d = Math.max(0, Math.floor(obj.days    || 0));
  const h = Math.max(0, Math.floor(obj.hours   || 0));
  const m = Math.max(0, Math.floor(obj.minutes || 0));
  const parts = [];
  if (y) parts.push(`${y}y`);
  if (d) parts.push(`${d}d`);
  if (h || (!y && !d)) parts.push(`${h}h`);
  if (m || (!y && !d)) parts.push(`${m}m`);
  return parts.join(" ");
}

function computeMaturityTooltip(rowData) {
  const now = luxon.DateTime.now();
  const liveStatus = computeLiveStatus(rowData); // use live status
  const maturitySec   = Number(rowData.Maturity_Timestamp || 0);
  const lastActionSec = Number(rowData.Latest_Action_Timestamp || 0);

  // DEBUG
  console.debug("[MaturityTooltip] row.ID=", rowData.ID,
    "liveStatus=", liveStatus,
    "maturitySec=", maturitySec,
    "lastActionSec=", lastActionSec);

  if (liveStatus === "Maturing") {
    if (!Number.isFinite(maturitySec) || maturitySec <= 0) {
      console.debug("[MaturityTooltip] no maturitySec → empty");
      return "";
    }
    const maturity = luxon.DateTime.fromSeconds(maturitySec);
    const diff = maturity.diff(now, ["years","days","hours","minutes"]);
    console.debug("[MaturityTooltip] diff(ms)=", diff.toMillis(), "parts=", diff.toObject());
    if (diff.toMillis() <= 0) return "Ready to claim";
    return "Time remaining: " + formatDurationParts(diff.toObject());
  }

  if (liveStatus === "Claimed") {
    if (!Number.isFinite(lastActionSec) || lastActionSec <= 0) {
      console.debug("[MaturityTooltip] no lastActionSec → empty");
      return "";
    }
    const last = luxon.DateTime.fromSeconds(lastActionSec);
    const diff = now.diff(last, ["years","days","hours","minutes"]);
    console.debug("[MaturityTooltip] since last claim diff=", diff.toObject());
    return "Since last claim/remint: " + formatDurationParts(diff.toObject());
  }

  console.debug("[MaturityTooltip] status not eligible → empty");
  return "";
}


// Dropdown modal to choose 'claim' or 'remint'
function chooseActionDialog(defaultChoice = 'claim', rowData = null){
  return new Promise((resolve) => {
    const modal = document.getElementById('actionModal');
    const select = document.getElementById('actionSelect');
    const ok = document.getElementById('actionConfirmBtn');
    const cancel = document.getElementById('actionCancelBtn');

    // If this is an XENFT row, disable/hide remint and force claim
    // app.js — chooseActionDialog (snippet)
    const remintOpt = select.querySelector('option[value="remint"]');
    const st = rowData && String(rowData.SourceType);
    if (st === 'XENFT' || st === 'Stake XENFT') {
      if (remintOpt) remintOpt.disabled = true;
      select.value = 'claim';
    } else {
      if (remintOpt) remintOpt.disabled = false;
      select.value = defaultChoice || 'claim';
    }
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    function cleanup(val){
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      resolve(val);
    }
    function onOk(){ cleanup(select.value); }
    function onCancel(){ cleanup(null); }

    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  });
}


// --- live status recompute (no rescan required) ---
// --- live status recompute (no rescan required) ---
function computeLiveStatus(row) {
  const data = row.getData ? row.getData() : row;

  // ✅ Priority 1: Stakes have an authoritative, pre-computed status. Use it directly.
  if (data.SourceType === 'Stake' || data.SourceType === 'Stake XENFT') {
    return data.Status || 'Unknown'; // Return the status stored in the row
  }

  const nowSec = Date.now() / 1000;
  const matured = Number(data.Maturity_Timestamp || 0) <= nowSec;

  // Treat XENFTs differently: we can have an explicit 'redeemed' flag or precomputed Status
  if (data.SourceType === 'XENFT') {
    const red = Number(data.redeemed || 0);
    if (red === 1 || String(data.Status).toLowerCase() === 'claimed') return 'Claimed';
    return matured ? 'Claimable' : 'Maturing';
  }

  // Fallback for Cointool mints
  const acts = Array.isArray(data.Actions) ? data.Actions : [];
  const hasActs = acts.length > 0;

  if (matured && !hasActs) return 'Claimable';
  if (!matured) return 'Maturing';
  return 'Claimed';
}

let statusTickerId = null;

async function performStatusTick() {
  if (!window.cointoolTable) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const data   = cointoolTable.getData();
  const updates = [];

  for (const r of data) {
    // ✅ ADD THIS CHECK: Only perform status ticks for Cointool rows.
    if (r.SourceType !== "Cointool") {
      continue; // Skip XENFT, Stake XENFT, and Stake rows.
    }

    const maturity = Number(r.Maturity_Timestamp || 0);
    const hasActs  = Array.isArray(r.Actions) && r.Actions.length > 0;

    // If last action lacks term/rank (failed tx), try to recover maturity
    let recomputedTs = 0;
    let recomputedStartRank = null;
    if (hasActs) {
      const acts = r.Actions;
      const last = acts[acts.length - 1];
      const lastMissing = !last || (last.term == null || Number(last.term) === 0) || (last.rank == null || String(last.rank) === "");
      if (lastMissing || !(Number.isFinite(maturity) && maturity > 0)) {
        // Find the most recent good action with term and rank
        for (let i = acts.length - 1; i >= 0; i--) {
          const a = acts[i];
          const tDays = Number(a && a.term);
          const hasRank = a && a.rank != null && String(a.rank) !== "";
          const ts = Number(a && a.timeStamp);
          if (Number.isFinite(tDays) && tDays > 0 && hasRank && Number.isFinite(ts) && ts > 0) {
            recomputedTs = ts + tDays * 86400;
            try { recomputedStartRank = BigInt(String(a.rank)); } catch { recomputedStartRank = null; }
            break;
          }
        }
      }
    }

    const effTs = (Number.isFinite(maturity) && maturity > 0) ? maturity : (recomputedTs || 0);

    let desired;
    if (effTs > nowSec) {
      desired = "Maturing";
    } else if (effTs > 0) {
      desired = hasActs ? "Claimed" : "Claimable";
    } else {
      desired = hasActs ? "Claimed" : "Maturing";
    }

    const needRangeUpdate = (recomputedStartRank !== null);
    // Build patch when status changes, or we recomputed maturity, or the rank range needs update
    if (r.Status !== desired || (recomputedTs && recomputedTs !== maturity) || needRangeUpdate) {
      const patch = { ID: r.ID, Status: desired };
      if (recomputedTs && recomputedTs !== maturity) {
        try {
          const dt = (typeof luxon !== 'undefined' && luxon.DateTime)
            ? luxon.DateTime.fromSeconds(recomputedTs)
            : null;
          patch.Maturity_Timestamp = recomputedTs;
          patch.Maturity_Date_Fmt  = dt ? dt.toFormat('yyyy LLL dd, hh:mm a') : new Date(recomputedTs * 1000).toLocaleString();
          patch.maturityDateOnly   = dt ? dt.toFormat('yyyy-MM-dd') : (function(d){
            const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; })(new Date(recomputedTs*1000));
        } catch(_) {}
      }
      // If we found a better start rank, recompute range as [start .. start+VMUs-1]
      if (recomputedStartRank !== null) {
        try {
          const vmus = BigInt(String(r.VMUs || '0'));
          if (vmus > 0n) {
            const endRank = recomputedStartRank + vmus - 1n;
            patch.Rank_Range = `${recomputedStartRank.toString()}-${endRank.toString()}`;
          }
        } catch { /* ignore */ }
      }
      updates.push(patch);
    }
  }

  if (!updates.length) return;

  // Update the table view
  cointoolTable.updateData(updates);

  // Persist to IndexedDB so filters & calendar read the same truth
  if (window.dbInstance && typeof getMintByUniqueId === 'function' && typeof saveMint === 'function') {
    await Promise.all(updates.map(async (u) => {
      try {
        const rec = await getMintByUniqueId(dbInstance, u.ID);
        if (rec) {
          rec.Status = u.Status;
          if ('Rank_Range' in u) {
            rec.Rank_Range = u.Rank_Range;
          }
          if ('Maturity_Timestamp' in u) {
            rec.Maturity_Timestamp = u.Maturity_Timestamp;
            rec.Maturity_Date_Fmt  = u.Maturity_Date_Fmt;
            rec.maturityDateOnly   = u.maturityDateOnly;
          }
          await saveMint(dbInstance, rec);
        }
      } catch (e) {
        console.warn("Failed to persist status for", u.ID, e);
      }
    }));
  }

  // Keep the rest of the UI consistent
  if (typeof refreshBulkUI === "function") refreshBulkUI();
  if (typeof updateSummaryStats === "function") updateSummaryStats();
  if (typeof updateCalendar === "function") updateCalendar();
}

function startStatusTicker() {
  if (statusTickerId) return;
  performStatusTick();                 // run once immediately
  statusTickerId = setInterval(performStatusTick, 30_000);
}

// --- USER PREFERENCES ---
function saveUserPreferences(addresses, customRPC, apiKey) {
  localStorage.setItem("ethAddress", addresses);
  localStorage.setItem("customRPC", customRPC);
  localStorage.setItem("etherscanApiKey", apiKey);
}
function loadUserPreferences() {
  document.getElementById("ethAddress").value = localStorage.getItem("ethAddress") || "";
  document.getElementById("customRPC").value = localStorage.getItem("customRPC") || DEFAULT_RPC;
  document.getElementById("etherscanApiKey").value = localStorage.getItem("etherscanApiKey") || "";
}

// --- Show/Hide Toggles for sensitive fields ---
function __eyeIcon() {
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 5c6 0 10 5.33 10 8s-4 8-10 8S2 15.67 2 13 6 5 12 5zm0 2C7 7 4 12 4 13s3 6 8 6 8-5 8-6-3-6-8-6zm0 3a3 3 0 110 6 3 3 0 010-6z"/></svg>';
}
function __eyeOffIcon() {
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M2.1 3.51L3.51 2.1l18.39 18.39-1.41 1.41-3.06-3.06A11.33 11.33 0 0112 20c-6 0-10-5.33-10-8 0-1.13 1.02-3.08 3.06-4.89L2.1 3.51zM7.5 8.91A7.6 7.6 0 004 12c0 1.2 3 6 8 6 1.63 0 3.09-.42 4.35-1.13l-1.8-1.8A4 4 0 018 12c0-.43.07-.85.2-1.24l-.7-.7zM12 6c6 0 10 5.33 10 8 0 .84-.48 2-1.42 3.22l-1.43-1.43c.51-.77.85-1.48.85-1.79 0-1.2-3-6-8-6-1.03 0-2 .2-2.89.56l-1.5-1.5C9.11 6.39 10.51 6 12 6zm0 4a2 2 0 011.73 3l-2.73-2.73c.29-.17.62-.27 1-.27z"/></svg>';
}

function __updateWalletEyeSize(){
  try{
    const btn = document.getElementById('connectWalletBtn');
    const eye = document.getElementById('toggleConnectMask');
    if (!btn || !eye) return;
    const h = btn.offsetHeight || 32;
    const s = Math.max(10, Math.round(h * 0.5));
    eye.style.height = s + 'px';
    eye.style.width  = s + 'px';
  }catch{}
}

function setApiKeyVisibility(visible) {
  const inp = document.getElementById('etherscanApiKey');
  const btn = document.getElementById('toggleApiKeyVisibility');
  if (inp) {
    // Use the same blur masking as textarea: visible=false => add .masked
    inp.classList.toggle('masked', !visible);
  }
  try { localStorage.setItem('etherscanApiKeyVisible', visible ? '1' : '0'); } catch {}
  if (btn) {
    btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    btn.setAttribute('aria-label', visible ? 'Hide API key' : 'Show API key');
    btn.title = visible ? 'Hide' : 'Show';
    btn.innerHTML = visible ? __eyeOffIcon() : __eyeIcon();
  }
}

function setEthAddressMasked(masked) {
  const ta = document.getElementById('ethAddress');
  const btn = document.getElementById('toggleEthAddressMask');
  if (ta) {
    ta.classList.toggle('masked', !!masked);
  }
  try { localStorage.setItem('ethAddressMasked', masked ? '1' : '0'); } catch {}
  if (btn) {
    btn.setAttribute('aria-pressed', masked ? 'true' : 'false');
    btn.setAttribute('aria-label', masked ? 'Show addresses' : 'Mask addresses');
    btn.title = masked ? 'Show' : 'Mask';
    btn.innerHTML = masked ? __eyeIcon() : __eyeOffIcon();
  }
}

function setConnectWalletMasked(masked){
  const btn = document.getElementById('connectWalletText');
  const eye = document.getElementById('toggleConnectMask');
  if (btn) {
    btn.classList.toggle('masked', !!masked);
  }
  try { localStorage.setItem('connectWalletMasked', masked ? '1' : '0'); } catch {}
  if (eye) {
    eye.setAttribute('aria-pressed', masked ? 'true' : 'false');
    eye.setAttribute('aria-label', masked ? 'Show wallet text' : 'Mask wallet text');
    eye.title = masked ? 'Show' : 'Mask';
    eye.innerHTML = masked ? __eyeIcon() : __eyeOffIcon();
  }
  __updateWalletEyeSize();
}

function initShowMaskToggles() {
  // Defaults: API key masked (not visible); addresses unmasked
  const __apiVisRaw = localStorage.getItem('etherscanApiKeyVisible');
  const apiVisible = (__apiVisRaw == null) ? true : (__apiVisRaw === '1');
  const addrMasked = (localStorage.getItem('ethAddressMasked') === '1');
  const walletMasked = (localStorage.getItem('connectWalletMasked') === '1');
  setApiKeyVisibility(!!apiVisible);
  setEthAddressMasked(!!addrMasked);
  setConnectWalletMasked(!!walletMasked);
  const apiBtn = document.getElementById('toggleApiKeyVisibility');
  if (apiBtn) apiBtn.addEventListener('click', () => setApiKeyVisibility(!(localStorage.getItem('etherscanApiKeyVisible') === '1')));
  const addrBtn = document.getElementById('toggleEthAddressMask');
  if (addrBtn) addrBtn.addEventListener('click', () => setEthAddressMasked(!(localStorage.getItem('ethAddressMasked') === '1')));
  const walletBtn = document.getElementById('toggleConnectMask');
  if (walletBtn) walletBtn.addEventListener('click', () => setConnectWalletMasked(!(localStorage.getItem('connectWalletMasked') === '1')));
  try { window.addEventListener('resize', __updateWalletEyeSize, { passive: true }); } catch {}
}
function validateInputs() {
  const rpcText = document.getElementById("customRPC").value.trim();
  const apiKey = document.getElementById("etherscanApiKey").value.trim();
  const scanBtn = document.getElementById("scanBtn");
  const hasRpc = rpcText.split("\n").some(s => s.trim().startsWith("http"));
  scanBtn.disabled = !hasRpc || !apiKey;
}

// --- SUMMARY STATS ---
// REPLACE the entire existing updateSummaryStats function with this one

function updateSummaryStats() {
  if (!window.cointoolTable) return;

  // 1) Prefer an unfiltered snapshot of all data
  const overall =
    (Array.isArray(window._allUnifiedRows) && window._allUnifiedRows.length ? window._allUnifiedRows : null)
    || (typeof cointoolTable.getData === "function" ? cointoolTable.getData("all") : null)
    || cointoolTable.getData("active");

  // --- A) COINTOOL summary (header + per-address) ---
  const onlyCT = overall.filter(r => r.SourceType === "Cointool");
  const summaryByAddress = {};
  for (const row of onlyCT) {
    const owner = row.Owner;
    if (!summaryByAddress[owner]) {
      summaryByAddress[owner] = { mintCount: 0, totalCranks: 0, remintCranks: 0, maturingVMUs: 0, claimableVMUs: 0 };
    }
    const vmus = Number(row.VMUs) || 0;
    const remintCount = (row.Actions || []).length;
    summaryByAddress[owner].mintCount++;
    summaryByAddress[owner].totalCranks += vmus;
    if (remintCount > 0) summaryByAddress[owner].remintCranks += vmus;

    // Use the live status for accurate counts
    const liveStatus = computeLiveStatus(row);
    if (liveStatus === "Maturing") {
      summaryByAddress[owner].maturingVMUs += vmus;
    }
    if (liveStatus === "Claimable") {
      summaryByAddress[owner].claimableVMUs += vmus;
    }
  }

  // Build and inject the main Cointool summary line
  const itemCountDiv = document.getElementById('itemCount');
  if (itemCountDiv) {
    const overallMintCount = Object.values(summaryByAddress).reduce((s, x) => s + x.mintCount, 0);
    const totalCranks = Object.values(summaryByAddress).reduce((s, x) => s + x.totalCranks, 0);
    const totalRemintCranks = Object.values(summaryByAddress).reduce((s, x) => s + x.remintCranks, 0);
    const totalMaturingVMUs = Object.values(summaryByAddress).reduce((s, x) => s + x.maturingVMUs, 0);
    const totalClaimableVMUs = Object.values(summaryByAddress).reduce((s, x) => s + x.claimableVMUs, 0);

    itemCountDiv.innerHTML = `<strong>Cointool Mints:</strong> ${overallMintCount.toLocaleString()} | <strong>Total VMUs:</strong> ${totalCranks.toLocaleString()} | <strong>Remints:</strong> ${totalRemintCranks.toLocaleString()} | <strong>Maturing:</strong> ${totalMaturingVMUs.toLocaleString()} | <strong>Claimable:</strong> ${totalClaimableVMUs.toLocaleString()}`;
  }


  // Render per-address blocks for Cointool
  const perAddressContainer = document.getElementById('perAddressSummary');
  perAddressContainer.innerHTML = ''; // Clear previous entries

  const ctAddresses = Object.keys(summaryByAddress);
  if (ctAddresses.length > 0) {
    for (const address of ctAddresses) {
      const s = summaryByAddress[address];
      const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const line = document.createElement('div');
      line.innerHTML = `
      <strong>${short}:</strong>
      Mints: ${s.mintCount.toLocaleString()} |
      Total VMUs: ${s.totalCranks.toLocaleString()} |
      Remints: ${s.remintCranks.toLocaleString()} |
      Maturing: ${s.maturingVMUs.toLocaleString()} |
      Claimable: ${s.claimableVMUs.toLocaleString()}
    `;
      perAddressContainer.appendChild(line);
    }
  }

  // --- The rest of the function handles other types (XENFT, Stakes), which is correct ---
  // --- B) XENFTs (by address) ---
  const xfMap = {};
  for (const row of overall.filter(r => r.SourceType === "XENFT")) {
    const owner = row.Owner || '';
    if (!xfMap[owner]) {
      xfMap[owner] = { mintCount: 0, totalCranks: 0, maturingVMUs: 0, claimableCount: 0 };
    }
    const vmus = Number(row.VMUs) || 0;
    xfMap[owner].mintCount++;
    xfMap[owner].totalCranks += vmus;
    const liveStatus = computeLiveStatus(row);
    if (liveStatus === "Maturing") {
      xfMap[owner].maturingVMUs += vmus;
    }
    if (liveStatus === "Claimable") {
      xfMap[owner].claimableCount++;
    }
  }

  const oldXfBlock = document.getElementById('xenftPerAddressSummary');
  if (oldXfBlock) oldXfBlock.remove();

  const xfAddrs = Object.keys(xfMap);
  if (xfAddrs.length > 0) {
    const anchor = document.getElementById('xenftItemCount');
    const container = document.getElementById('summaryContainer');
    const block = document.createElement('div');
    block.id = 'xenftPerAddressSummary';
    block.style.marginTop = '6px';
    for (const address of xfAddrs) {
      const s = xfMap[address];
      const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const line = document.createElement('div');
      line.innerHTML = `
      <strong>${short}:</strong>
      Mints: ${s.mintCount.toLocaleString()} |
      Total VMUs: ${s.totalCranks.toLocaleString()} |
      Maturing: ${s.maturingVMUs.toLocaleString()} |
      Claimable: ${s.claimableCount.toLocaleString()}
    `;
      block.appendChild(line);
    }
    if (anchor && anchor.parentElement) {
      anchor.insertAdjacentElement('afterend', block);
    } else if (container) {
      container.appendChild(block);
    }
  }

  // --- C) STAKE XENFTs (by address) ---
  const stakeMap = {};
  for (const row of overall.filter(r => r.SourceType === "Stake XENFT")) {
    const owner = row.Owner || '';
    if (!stakeMap[owner]) {
      stakeMap[owner] = { mintCount: 0, maturingCount: 0, claimableCount: 0 };
    }
    stakeMap[owner].mintCount++;
    if (computeLiveStatus(row) === "Maturing") {
      stakeMap[owner].maturingCount++;
    }
    if (computeLiveStatus(row) === "Claimable") {
      stakeMap[owner].claimableCount++;
    }
  }

  const oldStakeBlock = document.getElementById('stakePerAddressSummary');
  if (oldStakeBlock) oldStakeBlock.remove();
  const stakeAddrs = Object.keys(stakeMap);
  if (stakeAddrs.length > 0) {
    const anchor = document.getElementById('stakeXenftItemCount');
    const container = document.getElementById('summaryContainer');
    const block = document.createElement('div');
    block.id = 'stakePerAddressSummary';
    for (const address of stakeAddrs) {
      const s = stakeMap[address];
      const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const line = document.createElement('div');
      line.innerHTML = `<strong>${short}:</strong> Stakes: ${s.mintCount.toLocaleString()} | Maturing: ${s.maturingCount.toLocaleString()} | Claimable: ${s.claimableCount.toLocaleString()}`;
      block.appendChild(line);
    }
    if (anchor && anchor.parentElement) {
      anchor.insertAdjacentElement('afterend', block);
    } else if (container) {
      container.appendChild(block);
    }
  }

  // --- D) STAKES (by address) ---
  const stakeRegularMap = {};
  for (const row of overall.filter(r => r.SourceType === "Stake")) {
    const owner = row.Owner || '';
    if (!stakeRegularMap[owner]) {
      stakeRegularMap[owner] = { mintCount: 0, maturingCount: 0, claimableCount: 0 };
    }
    stakeRegularMap[owner].mintCount++;
    if (computeLiveStatus(row) === "Maturing") {
      stakeRegularMap[owner].maturingCount++;
    }
    if (computeLiveStatus(row) === "Claimable") {
      stakeRegularMap[owner].claimableCount++;
    }
  }

  const oldStakeRegularBlock = document.getElementById('stakeRegularPerAddressSummary');
  if (oldStakeRegularBlock) oldStakeRegularBlock.remove();
  const stakeRegularAddrs = Object.keys(stakeRegularMap);
  if (stakeRegularAddrs.length > 0) {
    const anchor = document.getElementById('stakeItemCount');
    const container = document.getElementById('summaryContainer');
    const block = document.createElement('div');
    block.id = 'stakeRegularPerAddressSummary';
    for (const address of stakeRegularAddrs) {
      const s = stakeRegularMap[address];
      const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const line = document.createElement('div');
      line.innerHTML = `<strong>${short}:</strong> Stakes: ${s.mintCount.toLocaleString()} | Maturing: ${s.maturingCount.toLocaleString()} | Claimable: ${s.claimableCount.toLocaleString()}`;
      block.appendChild(line);
    }
    if (anchor && anchor.parentElement) {
      anchor.insertAdjacentElement('afterend', block);
    } else if (container) {
      container.appendChild(block);
    }
  }
}

/**
 * Fetches txs for [startBlock, endBlock] from Etherscan.
 * If the response length >= 10000, recursively split the range (bisect)
 * so we never miss transactions due to Etherscan's per-response cap.
 */
/**
 * Verbose Etherscan range fetcher with dynamic splitting.
 * - Logs each leaf range and split (indented by depth)
 * - Updates a single UI status line via `onStatus`
 * - Retries/backoffs on transient errors
 */
// Verbose Etherscan range fetcher with dynamic splitting + reason-aware retries
async function fetchRangeWithSplit(address, startBlock, endBlock, etherscanApiKey, sink, depth = 0, onStatus = null) {
  if (startBlock > endBlock) return;

  const indent = " ".repeat(depth * 2);
  const url = es2url(
    `module=account&action=txlist` +
    `&address=${address}&startblock=${startBlock}&endblock=${endBlock}` +
    `&sort=asc&apikey=${etherscanApiKey}`
  );

  const statusMsg = `${indent}- Fetching transactions in block range: ${startBlock} to ${endBlock}...`;
  if (typeof onStatus === "function") onStatus(statusMsg);
  console.log(statusMsg);

  const MAX_RETRIES = 6;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      const data = await res.json();

      const msg = (data?.message || "").toLowerCase();
      const resultText = (typeof data?.result === "string" ? data.result : "");

      // Success path
      if (Array.isArray(data?.result)) {
        const arr = data.result;

        if (arr.length >= 10000 && startBlock < endBlock) {
          const mid = Math.floor((startBlock + endBlock) / 2);
          console.log(`${indent}  ↪ Range looks full (${arr.length}). Splitting at ${mid}...`);
          if (typeof onStatus === "function") onStatus(`${indent}  ↪ Splitting ${startBlock}–${endBlock} at ${mid}`);
          await fetchRangeWithSplit(address, startBlock, mid,     etherscanApiKey, sink, depth + 1, onStatus);
          await fetchRangeWithSplit(address, mid + 1,  endBlock, etherscanApiKey, sink, depth + 1, onStatus);
        } else {
          console.log(`${indent}  ✓ Got ${arr.length} txs for ${startBlock}–${endBlock}`);
          if (arr.length > 0) sink.push(...arr);
        }

        window.__scanLastActivityTs = Date.now();
        await new Promise(r => setTimeout(r, 300));
        return;
      }

      // “No transactions found” is a clean empty leaf
      if (msg.includes("no transactions found")) {
        console.log(`${indent}  ∅ No transactions in ${startBlock}–${endBlock}`);
        window.__scanLastActivityTs = Date.now();
        return;
      }

      // Other NOTOK reasons -> log & choose policy
      const reason = (resultText || data?.message || "NOTOK").toString();
      const human = reason.replace(/\s+/g, " ").trim();
      const backoff = Math.min(2500, 200 * Math.pow(1.6, attempt));

      // Immediately split on “window too large” / “timeout”
      if (/window too large|timeout/i.test(human) && startBlock < endBlock) {
        const mid = Math.floor((startBlock + endBlock) / 2);
        console.warn(`${indent}  ! ${human}. Splitting at ${mid}...`);
        if (typeof onStatus === "function") onStatus(`${indent}  ↪ ${human}. Split ${startBlock}–${endBlock} at ${mid}`);
        await fetchRangeWithSplit(address, startBlock, mid,     etherscanApiKey, sink, depth + 1, onStatus);
        await fetchRangeWithSplit(address, mid + 1,  endBlock, etherscanApiKey, sink, depth + 1, onStatus);
        return;
      }

      // Hard errors -> explain and bail
      if (/invalid api key|missing api key|invalid address/i.test(human)) {
        console.error(`${indent}  ✖ ${human}. Please fix inputs.`);
        if (typeof onStatus === "function") onStatus(`${indent}  ✖ ${human}`);
        return;
      }

      // Rate limit / generic NOTOK -> retry with backoff
      console.warn(`${indent}  ! Transient error (${human}). Retrying in ${backoff}ms...`);
      if (typeof onStatus === "function") onStatus(`${indent}  ! ${human}. Retrying...`);
      await new Promise(r => setTimeout(r, backoff));
      continue;

    } catch (e) {
      const backoff = Math.min(2500, 200 * Math.pow(1.6, attempt));
      console.warn(`${indent}  ! Request failed (${e.message}). Retrying in ${backoff}ms...`);
      if (typeof onStatus === "function") onStatus(`${indent}  ! Network error. Retrying...`);
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }
  }

  // Fallback after all retries: bisect
  if (startBlock < endBlock) {
    const mid = Math.floor((startBlock + endBlock) / 2);
    console.warn(`${indent}  ! Exhausted retries for ${startBlock}–${endBlock}; bisecting at ${mid}...`);
    if (typeof onStatus === "function") onStatus(`${indent}  ↪ Bisect fallback at ${mid}`);
    await fetchRangeWithSplit(address, startBlock, mid,     etherscanApiKey, sink, depth + 1, onStatus);
    await fetchRangeWithSplit(address, mid + 1,  endBlock, etherscanApiKey, sink, depth + 1, onStatus);
  }
}

async function findEarliestTxBlock(address, etherscanApiKey) {
  const url = es2url(
    `module=account&action=txlist` +
    `&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${etherscanApiKey}`
  );
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data?.status === "1" && Array.isArray(data.result) && data.result.length > 0) {
      const b = Number(data.result[0].blockNumber);
      return Number.isFinite(b) ? b : 0;
    }
  } catch (_) {}
  return 0;
}

async function fetchPostMintActions(address, etherscanApiKey) {
  console.log(`Fetching post-mint action history for ${address}...`);

  // --- Inputs & globals we rely on in your app ---
  // web3, CONTRACT_ADDRESS, REMINT_SELECTOR, EVENT_TOPIC
  // helpers: getChunkSize, fetchRangeWithSplit, formatSeconds,
  //          getScanState, putScanState, clearScanState,
  //          getActionsCache, putActionsCache,
  //          normalizeSalt, computeProxyAddress, makeRpcRequest
  // caches/db: remintCache (in-memory), dbInstance (IndexedDB handle)

  const latestBlock = await web3.eth.getBlockNumber();
  const CHUNK_SIZE = getChunkSize();

  // --- UI handles ---
  const progressEl = document.getElementById("tokenProgressText");
  const etrEl = document.getElementById("etrText");
  const tokenProgressBar = document.getElementById("tokenProgressBar");
  const rpcStatusEl = document.getElementById("rpcStatus");

  // status helper
  const updateStatus = (msg) => { if (progressEl) progressEl.textContent = msg; };

  // heartbeat (lets you see if we're waiting on network)
  window.__scanLastActivityTs = Date.now();
  const heartbeat = setInterval(() => {
    const dt = Math.floor((Date.now() - (window.__scanLastActivityTs || Date.now())) / 1000);
    if (rpcStatusEl) rpcStatusEl.textContent = dt >= 3 ? `⏳ ${dt}s since last reply` : "";
  }, 2000);

  // -------- Resume logic (and "first tx" pre-skip) --------
  const forceRescan = document.getElementById("forceRescan")?.checked;
  let resumeFrom = 0;

  try {
    if (forceRescan && dbInstance) {
      await clearScanState(dbInstance, address);
    } else if (dbInstance) {
      const st = await getScanState(dbInstance, address);
      if (st && Number.isFinite(st.lastScannedBlock)) {
        resumeFrom = Math.min(latestBlock, Number(st.lastScannedBlock) + 1);
      }
    }
  } catch (e) {
    console.warn("resume cursor read/clear failed:", e);
  }

  // Pre-skip early empty ranges by finding the address’ first tx once
  try {
    const earliest = await findEarliestTxBlock(address, etherscanApiKey);
    if (earliest && (resumeFrom === 0 || resumeFrom < earliest)) {
      console.log(`Earliest tx for ${address} at block ${earliest} — skipping earlier empty ranges.`);
      resumeFrom = earliest;
    }
  } catch (e) {
    console.warn("earliest block preflight failed:", e);
  }

  // -------- Fetch account txs in [resumeFrom..latestBlock], chunked w/ splitter --------
  let allTransactions = [];
  const totalBlocks = Math.max(0, latestBlock - resumeFrom + 1);
  const totalChunks = Math.max(1, Math.ceil(totalBlocks / CHUNK_SIZE));
  const prevBarMax = tokenProgressBar.max;
  const prevBarVal = tokenProgressBar.value;
  tokenProgressBar.max = totalChunks;
  tokenProgressBar.value = 0;

  let chunksDone = 0;
  let lastUiUpdate = 0;
  const startedAt = Date.now();

  for (let startBlock = resumeFrom; startBlock <= latestBlock; startBlock += CHUNK_SIZE) {
    const endBlock = Math.min(startBlock + CHUNK_SIZE - 1, latestBlock);

    // dynamic split to satisfy Etherscan's 10k cap + verbosity
    await fetchRangeWithSplit(address, startBlock, endBlock, etherscanApiKey, allTransactions);

    // progress + ETA
    chunksDone++;
    const now = Date.now();
    if (now - lastUiUpdate > 300) {
      const elapsed = (now - startedAt) / 1000;
      const rate = chunksDone / Math.max(1, elapsed);
      const remainingChunks = Math.max(0, totalChunks - chunksDone);
      const remainingSec = rate > 0 ? remainingChunks / rate : 0;
      const pct = Math.floor((chunksDone / totalChunks) * 100);

      if (progressEl) {
        progressUI.setStage('Fetching transactions', chunksDone, totalChunks, `blocks ${startBlock}→${endBlock}`);
      }
      progressUI.setEta(remainingSec);
      tokenProgressBar.value = chunksDone;
      lastUiUpdate = now;
    }

    // save resume cursor after each chunk
    try {
      if (dbInstance) await putScanState(dbInstance, address, endBlock);
    } catch (e) {
      console.warn("resume cursor write failed:", e);
    }
  }

  // restore UI elements for next phase
  if (etrEl) etrEl.textContent = "";
  tokenProgressBar.max = prevBarMax;
  tokenProgressBar.value = prevBarVal;

  // dedupe by hash (some explorers can return duplicates on edges)
  if (allTransactions.length) {
    const seen = new Set();
    allTransactions = allTransactions.filter(tx => {
      const h = tx.hash || tx.hash?.toLowerCase();
      if (!h || seen.has(h)) return false;
      seen.add(h);
      return true;
    });
  }

  console.log(`Found ${allTransactions.length} total transactions for ${address}.`);
  const fetched = allTransactions.length;

  // -------- Load prior actions (from memory, or from DB if missing) --------
  const db = dbInstance || await openDB();
  let prior = remintCache[address];
  if (!prior) {
    try { prior = await getActionsCache(db, address); }
    catch (_) { prior = {}; }
    remintCache[address] = prior;
  }

  // If no new transactions at all, return prior unchanged
  if (fetched === 0) {
    if (progressEl) progressEl.textContent =
      `No new transactions — keeping ${Object.keys(prior).length} action-keys in cache`;
    clearInterval(heartbeat);
    return { actions: prior, fetched, newActionCount: 0 };
  }

  // -------- Prefilter candidate remint txs to the Cointool contract --------
  const lowerContract = CONTRACT_ADDRESS.toLowerCase();
  const candidates = allTransactions.filter(tx =>
    tx.to && tx.to.toLowerCase() === lowerContract &&
    tx.input && tx.input.startsWith(REMINT_SELECTOR) &&
    tx.isError !== "1"
  );

  // -------- Decode per-tx actions into a map: "<mintId>-<saltKey>" -> [actions] --------
  const info = {};
  const analyzeStart = Date.now();
  for (let i = 0; i < candidates.length; i++) {
    const tx = candidates[i];

    // lightweight progress/eta while decoding
    if (i === 0 || i % 50 === 0) {
      const elapsed = (Date.now() - analyzeStart) / 1000;
      const rate = i > 0 ? i / elapsed : 0;
      const remaining = rate > 0 ? (candidates.length - i) / rate : 0;
      if (progressEl) progressEl.textContent = `Analyzing post-mint actions ${i}/${candidates.length}...`;
      if (etrEl) etrEl.textContent = remaining > 2 ? `ETA: ${Math.round(remaining)}s` : "";
      await new Promise(r => setTimeout(r, 0)); // yield UI thread
    }

    try {
      const receipt = await makeRpcRequest(
        () => web3.eth.getTransactionReceipt(tx.hash),
        `Receipt for remint TX ${tx.hash}`
      );
      const logs = receipt.logs || [];

      // tx.input = 0x + 4-byte selector + encoded params, so slice(10)
      const inputData = tx.input.slice(10);
      // ABI: function remint(uint256[] ids, bytes proof, bytes salt)
      const params = web3.eth.abi.decodeParameters(['uint256[]', 'bytes', 'bytes'], inputData);

      let actedOnIds = params[0];
      if (!Array.isArray(actedOnIds)) actedOnIds = [actedOnIds];

      const saltRaw = params[2];
      const saltKey = normalizeSalt(saltRaw); // for map keys only

      for (const mintIdStr of actedOnIds) {
        const mintId = parseInt(mintIdStr);

        // compute CREATE2 proxy; skip invalids
        const proxyAddress = computeProxyAddress(web3, CONTRACT_ADDRESS, mintId, saltRaw, address);
        if (!proxyAddress) {
          console.warn(`Skipping action with invalid _salt for tx ${tx.hash}`);
          continue;
        }

        const uniqueKey = `${mintId}-${saltKey}`;

        // Find the event log that corresponds to this proxy (topics[1] encodes the proxy)
        const matchingLog = logs.find(
          log => log.topics?.includes(EVENT_TOPIC) &&
            ('0x' + log.topics[1].slice(26)).toLowerCase() === proxyAddress.toLowerCase()
        );

        const actionData = { hash: tx.hash, timeStamp: Number(tx.timeStamp) };
        if (matchingLog) {
          // event carries term & rank (uint256, uint256)
          const decodedLog = web3.eth.abi.decodeParameters(['uint256', 'uint256'], matchingLog.data);
          actionData.term = decodedLog[0];
          actionData.rank = decodedLog[1];
        }

        if (!info[uniqueKey]) info[uniqueKey] = [];
        info[uniqueKey].push(actionData);
      }
    } catch (e) {
      console.warn("Could not decode post-mint action transaction:", tx.hash, e);
    }
  }

  // Sort each action list chronologically
  for (const key in info) {
    info[key].sort((a, b) => a.timeStamp - b.timeStamp);
  }

  // -------- Merge with prior map and persist --------
  const merged = { ...prior };
  let newActionCount = 0;

  for (const key of Object.keys(info)) {
    const existing = Array.isArray(merged[key]) ? merged[key] : [];
    const incoming = info[key];

    // de-dupe by (hash|timestamp) signature
    const seen = new Set(existing.map(a => `${a.hash}|${a.timeStamp}`));
    for (const a of incoming) {
      const sig = `${a.hash}|${a.timeStamp}`;
      if (!seen.has(sig)) {
        existing.push(a);
        seen.add(sig);
        newActionCount++;
      }
    }
    existing.sort((a, b) => a.timeStamp - b.timeStamp);
    merged[key] = existing;
  }

  remintCache[address] = merged;
  try { await putActionsCache(db, address, merged); } catch (_) {}

  if (progressEl) progressEl.textContent = `Post-mint actions analyzed: ${Object.keys(info).length}`;
  if (etrEl) etrEl.textContent = "";

  clearInterval(heartbeat);
  return { actions: merged, fetched, newActionCount };
}

(function loadUserSettings(){
  // Load Ethereum addresses
  const addrInput = document.getElementById("ethAddress");
  if (addrInput) {
    const saved = localStorage.getItem("ethAddress");
    if (saved) addrInput.value = saved;
  }

  // Load custom RPCs
  const rpcInput = document.getElementById("customRPC");
  if (rpcInput) {
    const saved = localStorage.getItem("customRPC");
    if (saved) rpcInput.value = saved;
  }

  // Load Etherscan API Key
  const apiKeyInput = document.getElementById("etherscanApiKey");
  if (apiKeyInput) {
    const saved = localStorage.getItem("etherscanApiKey");
    if (saved) apiKeyInput.value = saved;
  }

  // Load Chunk Size
  const chunkInput = document.getElementById("chunkSize");
  if (chunkInput) {
    chunkInput.value = String(getChunkSize());
  }

  // Load Gas Refresh Interval
  const gasInput = document.getElementById("gasRefreshSeconds");
  if (gasInput) {
    gasInput.value = String(getGasRefreshMs() / 1000);
  }

})();

(function wireSettingsSaves(){
  // Helper to attach save handlers to text/textarea inputs
  function attachSave(input, key, {toastLabel, sanitize} = {}) {
    if (!input) return;
    const save = () => {
      let val = input.value;
      if (typeof sanitize === "function") val = sanitize(val);
      localStorage.setItem(key, val);
      if (typeof showToast === "function" && toastLabel) {
        showToast(`${toastLabel} saved`, "success");
      }
    };
    input.addEventListener("change", save);
    input.addEventListener("blur", save);
  }

  // Addresses, Custom RPCs, Etherscan API Key (unchanged)
  attachSave(document.getElementById("ethAddress"), "ethAddress", { toastLabel: "Addresses" });
  attachSave(document.getElementById("customRPC"), "customRPC", { toastLabel: "Custom RPCs" });
  attachSave(document.getElementById("etherscanApiKey"), "etherscanApiKey", { toastLabel: "Etherscan API key", sanitize: v => v.trim() });


  const gasRefreshInput = document.getElementById("gasRefreshSeconds");
  if (gasRefreshInput) {
    const persistGasRefresh = (val) => {
      const v = parseInt(val, 10);
      if (Number.isFinite(v) && v >= 5 && v <= 60) {
        localStorage.setItem("gasRefreshSeconds", String(v));
        if (typeof showToast === "function") showToast(`Gas refresh interval saved (${v}s)`, "success");
        markValidity("field-gasRefreshSeconds", true);
      } else {
        if (typeof showToast === "function") showToast("Gas refresh must be between 5 and 60 seconds.", "error");
        gasRefreshInput.value = String(getGasRefreshMs() / 1000); // revert
        markValidity("field-gasRefreshSeconds", false, "Gas refresh must be between 5 and 60 seconds.");
      }
    };
    gasRefreshInput.addEventListener("change", () => persistGasRefresh(gasRefreshInput.value));
    gasRefreshInput.addEventListener("blur", () => persistGasRefresh(gasRefreshInput.value));
    gasRefreshInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); persistGasRefresh(gasRefreshInput.value); }
    });
  }

  // Chunk Size (validated number >= 10000)
  const chunkInput = document.getElementById("chunkSize");
  if (chunkInput) {
    const persistChunkSize = (val) => {
      const v = parseInt(val, 10);
      if (Number.isFinite(v) && v >= 100000) {
        localStorage.setItem("chunkSize", String(v));
        if (typeof showToast === "function") showToast(`Chunk size saved (${v})`, "success");
        markValidity("field-chunkSize", true);
      } else {
        if (typeof showToast === "function") showToast("Chunk size must be at least 100,000.", "error");
        chunkInput.value = String(getChunkSize());
        markValidity("field-chunkSize", false, "Chunk Size must be 100,000 or higher.");
      }
    };
    chunkInput.addEventListener("change", () => persistChunkSize(chunkInput.value));
    chunkInput.addEventListener("blur",   () => persistChunkSize(chunkInput.value));
    chunkInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); persistChunkSize(chunkInput.value); }
    });
  }
})();

// --- Required fields UI helpers ---
function markValidity(fieldId, ok, msg) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.toggle("invalid", !ok);
  const errEl = field.querySelector(".error-message");
  if (errEl) errEl.textContent = msg || errEl.textContent;
}

function isNonEmptyTextarea(id) {
  const el = document.getElementById(id);
  return !!el && el.value.trim().length > 0;
}
function isNonEmptyInput(id) {
  const el = document.getElementById(id);
  return !!el && el.value.trim().length > 0;
}

// --- Ethereum address validation helpers ---
function isValidEthAddress(addr){
  if (!addr || typeof addr !== 'string') return false;
  const s = addr.trim();
  try {
    if (window.Web3 && Web3.utils && typeof Web3.utils.isAddress === 'function') {
      return Web3.utils.isAddress(s);
    }
  } catch (_) {}
  // Fallback: basic hex format check
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

function validateEthAddressesField(){
  const fieldId = 'field-ethAddress';
  const el = document.getElementById('ethAddress');
  if (!el) return true;
  const raw = (el.value || '').trim();
  if (!raw) {
    markValidity(fieldId, false, 'At least one Ethereum address is required.');
    return false;
  }
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  const invalid = [];
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    if (!isValidEthAddress(a)) invalid.push({ line: i + 1, value: a });
  }
  if (invalid.length) {
    const first = invalid[0];
    const msg = `Invalid Ethereum address on line ${first.line}: ${first.value}`;
    markValidity(fieldId, false, msg);
    return false;
  }
  markValidity(fieldId, true);
  return true;
}

// Validate all required settings; returns boolean
function validateSettings() {
  const okAddr  = isNonEmptyTextarea("ethAddress");
  markValidity("field-ethAddress", okAddr, "At least one Ethereum address is required.");

  const okRPC   = isNonEmptyTextarea("customRPC");
  markValidity("field-customRPC", okRPC, "Enter at least one RPC endpoint.");

  const okKey   = isNonEmptyInput("etherscanApiKey");
  markValidity("field-etherscanApiKey", okKey, "Etherscan API key is required.");
  try { const help=document.getElementById('etherscanApiHelp'); if(help) help.style.display = okKey ? 'none' : 'block'; } catch {}

  const chunkV  = parseInt(document.getElementById("chunkSize")?.value || "", 10);
  const okChunk = Number.isFinite(chunkV) && chunkV >= 10000;
  markValidity("field-chunkSize", okChunk, "Chunk Size must be 10,000 or higher.");

  const gasV    = parseInt(document.getElementById("gasRefreshSeconds")?.value || "", 10);
  const okGas   = Number.isFinite(gasV) && gasV >= 5 && gasV <= 60;
  markValidity("field-gasRefreshSeconds", okGas, "Gas refresh must be between 5 and 60 seconds.");

  return okAddr && okRPC && okKey && okChunk && okGas;
}

// Run validation on load and whenever user edits required fields
window.addEventListener("DOMContentLoaded", validateSettings);
["ethAddress","customRPC","etherscanApiKey","chunkSize","gasRefreshSeconds"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", validateSettings);
  el.addEventListener("blur", validateSettings);
});

// Validate Ethereum addresses on blur specifically for Address textarea
(() => {
  const el = document.getElementById('ethAddress');
  if (!el) return;
  el.addEventListener('blur', validateEthAddressesField);
})();



// --- SCAN FUNCTION ---
async function scanMints() {
  // DELETED: Initial block that managed the scan button's state.

  const addressInput = document.getElementById("ethAddress").value.trim();
  if (!addressInput) {
    alert("Please enter at least one Ethereum address.");
    // DELETED: restoreScanBtn();
    return;
  }
  const addresses = addressInput.split("\n").map(s => s.trim()).filter(Boolean);
  const rpcInput = document.getElementById("customRPC").value.trim();
  rpcEndpoints = rpcInput.split("\n").map(s => s.trim()).filter(Boolean);
  const etherscanApiKey = document.getElementById("etherscanApiKey").value.trim();
  if (!etherscanApiKey) {
    alert("Please enter an Etherscan API Key.");
    // DELETED: restoreScanBtn();
    return;
  }
  saveUserPreferences(addressInput, rpcInput, etherscanApiKey);

  web3 = new Web3(rpcEndpoints[0]);
  ETHERSCAN_CHAIN_ID = await web3.eth.getChainId();

  contract = new web3.eth.Contract(cointoolAbi, CONTRACT_ADDRESS);
  contract.setProvider(web3.currentProvider);

  window.progressUI.show(true);
  window.progressUI.setType('Cointool');
  const addressProgressText = document.getElementById("addressProgressText");
  const tokenProgressBar = document.getElementById("tokenProgressBar");
  const tokenProgressText = document.getElementById("tokenProgressText");
  const etrText = document.getElementById("etrText");

  const forceRescan = document.getElementById('forceRescan').checked;

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    progressUI.setAddress(i+1, addresses.length, addr);

    if (forceRescan) {
      if (remintCache[addr]) delete remintCache[addr];
      try { if (dbInstance) await clearActionsCache(dbInstance, addr); } catch (_) {}
    }

    if (!remintCache[addr]) {
      try {
        if (dbInstance) remintCache[addr] = await getActionsCache(dbInstance, addr);
      } catch (_) { /* ignore */ }
    }

    const { actions: postMintActions, fetched, newActionCount } =
      await fetchPostMintActions(addr, etherscanApiKey);

    if (!forceRescan && fetched === 0) {
      tokenProgressBar.value = 0;
      tokenProgressBar.max = 1;
      tokenProgressText.textContent =
        `No new transactions!`;
      continue;
    }

    if (newActionCount === 0) {
      tokenProgressText.textContent = `No new remint actions for ${shortAddr(addr)}, checking for new mints…`;
    }

    let maxId;
    try {
      maxId = await makeRpcRequest(() => contract.methods.map(addr, SALT_BYTES_TO_QUERY).call(), `Get Max ID for ${addr}`);
      tokenProgressBar.max = maxId;
      tokenProgressText.textContent = `Found ${maxId} potential mints for salt ${SALT_BYTES_TO_QUERY}. Analyzing...`;
    } catch(e) {
      alert(`Failed to fetch mint count for ${addr}. Check console for details.`);
      continue;
    }

    const startTime = Date.now();
    let lastUiUpdate = 0;

    for (let mintId = 1; mintId <= maxId; mintId++) {
      tokenProgressBar.value = mintId;
      tokenProgressText.textContent = `Processing mint ${mintId} of ${maxId}...`;

      const uniqueId = `${mintId}-${addr.toLowerCase()}`;
      const existingMint = await getMintByUniqueId(dbInstance, uniqueId);
      const uniqueKeyForLookup = `${mintId}-${normalizeSalt(existingMint?.Salt || SALT_BYTES_TO_QUERY)}`;

      const scannedActions = postMintActions[uniqueKeyForLookup] || [];
      const scannedCount   = scannedActions.length;
      const storedCount    = existingMint ? (existingMint.Actions || []).length : 0;

      const latestActionCount = Math.max(scannedCount, storedCount);

      if (existingMint && !forceRescan && latestActionCount === storedCount) {
        mintId += Number(existingMint.VMUs) - 1;
        continue;
      }

      try {
        const proxyAddressForCreation = computeProxyAddress(web3, CONTRACT_ADDRESS, mintId, SALT_BYTES_TO_QUERY, addr);
        const etherscanUrl = es2url(
          `module=contract&action=getcontractcreation` +
          `&contractaddresses=${proxyAddressForCreation}` +
          `&apikey=${etherscanApiKey}`
        );

        const response = await fetch(etherscanUrl);
        if (!response.ok) throw new Error(`Etherscan API failed with status ${response.status}`);
        const data = await response.json();

        if (data.status !== "1" || !data.result || data.result.length === 0) {
          console.warn(`Etherscan: No creation info for mint ${mintId}`);
          continue;
        }

        const txHash = data.result[0].txHash;
        const blockNumber = data.result[0].blockNumber;
        const tx = await makeRpcRequest(() => web3.eth.getTransaction(txHash), `TX Details for ${mintId}`);
        let mintBlockTs = blockTsCache.get(blockNumber);
        if (mintBlockTs === undefined) {
          const blk = await makeRpcRequest(() => web3.eth.getBlock(blockNumber), `Block Details for ${mintId}`);
          mintBlockTs = Number(blk.timestamp);
          blockTsCache.set(blockNumber, mintBlockTs);
        }
        const receipt = await makeRpcRequest(() => web3.eth.getTransactionReceipt(txHash), `Receipt for ${mintId}`);
        if (!tx || mintBlockTs === undefined || !receipt) {
          throw new Error(`Failed to get full details for TX ${txHash}`);
        }
        const inputData = tx.input.slice(10);
        const decodedTxParams = web3.eth.abi.decodeParameters(['uint256', 'bytes', 'bytes'], inputData);
        const salt = decodedTxParams[2];
        const totalMintsInTx = decodedTxParams[0];
        const proxyAddress = computeProxyAddress(web3, CONTRACT_ADDRESS, mintId, salt, addr);
        const matchingLog = receipt.logs.find(log => log.topics.includes(EVENT_TOPIC) && ('0x' + log.topics[1].slice(26)).toLowerCase() === proxyAddress.toLowerCase());
        if (!matchingLog) {
          console.warn(`No matching log for mint ${mintId} in TX ${txHash}`);
          continue;
        }

        const decodedLog = web3.eth.abi.decodeParameters(['uint256', 'uint256'], matchingLog.data);
        const term = decodedLog[0];
        const baseRank = decodedLog[1];
        const uniqueActionKey = `${mintId}-${normalizeSalt(salt)}`;
        const actionsFromScan = postMintActions[uniqueActionKey] || [];

        let actions = actionsFromScan;
        if (existingMint && Array.isArray(existingMint.Actions)) {
          const prior = existingMint.Actions;
          if (prior.length > actionsFromScan.length) {
            const seen = new Set(actionsFromScan.map(a => `${a.hash}|${a.timeStamp}`));
            const merged = actionsFromScan.slice();
            for (const a of prior) {
              const sig = `${a.hash}|${a.timeStamp}`;
              if (!seen.has(sig)) merged.push(a);
            }
            merged.sort((a,b) => Number(a.timeStamp) - Number(b.timeStamp));
            actions = merged;
          }
        }

        const mintTimestamp = mintBlockTs;
        const lastAction = actions.length > 0 ? actions[actions.length - 1] : null;
        const latestActionTimestamp = lastAction ? Number(lastAction.timeStamp) : mintTimestamp;
        let effectiveTermDays;
        let maturityTimestamp;

        if (lastAction && (lastAction.term == null || Number(lastAction.term) === 0)) {
          effectiveTermDays = Number(term);
          maturityTimestamp = 0;
        } else {
          effectiveTermDays = lastAction && lastAction.term != null
            ? Number(lastAction.term)
            : Number(term);

          maturityTimestamp = latestActionTimestamp + (effectiveTermDays * 86400);
        }

        let status;
        const now = luxon.DateTime.now().toSeconds();
        if (maturityTimestamp > now) {
          status = "Maturing";
        } else if (actions.length > 0) {
          status = "Claimed";
        } else {
          status = "Claimable";
        }

        const effectiveBaseRank = (lastAction && lastAction.rank != null)
          ? BigInt(lastAction.rank)
          : BigInt(baseRank);

        const startRank = effectiveBaseRank;
        const endRank = startRank + BigInt(totalMintsInTx) - 1n;
        const maturityDate = (maturityTimestamp > 0)
          ? luxon.DateTime.fromSeconds(maturityTimestamp)
          : null;

        const groupedMintDetails = {
          ID: uniqueId,
          Mint_id_Start: mintId,
          TX_Hash: txHash,
          Salt: salt,
          Rank_Range: `${startRank.toString()}-${endRank.toString()}`,
          Term: String(effectiveTermDays),
          VMUs: totalMintsInTx.toString(),
          Status: status,
          Actions: actions,
          Latest_Action_Timestamp: latestActionTimestamp,
          Maturity_Timestamp: maturityTimestamp,
          Maturity_Date_Fmt: maturityDate ? maturityDate.toFormat('yyyy LLL dd, hh:mm a') : "",
          maturityDateOnly:   maturityDate ? maturityDate.toFormat('yyyy-MM-dd') : "",
          Owner: addr
        };

        if (existingMint && Array.isArray(existingMint.Actions) && existingMint.Actions.length > actions.length) {
          actions = existingMint.Actions.slice();
        }

        await saveMint(dbInstance, groupedMintDetails);
        cointoolTable.updateOrAddData([groupedMintDetails]);

        updateCalendar();
        mintId += Number(totalMintsInTx) - 1;
      } catch(err) {
        console.error(`Failed to process mint ID ${mintId}:`, err);
      }

      const now = Date.now();
      if (now - lastUiUpdate > 1000) {
        const elapsedSeconds = (now - startTime) / 1000;
        if (elapsedSeconds > 3) {
          const rate = mintId / Math.max(elapsedSeconds, 0.0001);
          const remainingItems = Math.max(0, maxId - mintId);
          const remainingSeconds = remainingItems / Math.max(rate, 0.0001);
          progressUI.setEta(remainingSeconds);
        }
        updateSummaryStats();
        lastUiUpdate = now;
      }
    }
    etrText.textContent = "";
  }

  tokenProgressText.textContent = "Address scanning complete.";
  setTimeout(() => {
    // Only hide the container if we are NOT part of a "Scan All" sequence.
    if (!window.__scanAllActive) {
      document.getElementById("progressContainer").style.display = "none";
      etrText.textContent = "";
    }
  }, 1000);
}

// --- INITIALIZATION & CALENDAR ---
let calendarPicker;
function setMaturityHeaderFilter(dateObj) {
  const formattedDate = luxon.DateTime.fromJSDate(dateObj).toFormat('yyyy LLL dd');

  const maturityInput = document.querySelector('.tabulator-col[tabulator-field="Maturity_Date_Fmt"] .tabulator-header-filter input');
  if (maturityInput) {
    maturityInput.value = formattedDate;
    maturityInput.dispatchEvent(new Event('input', { bubbles: true }));
    const enterEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13 });
    maturityInput.dispatchEvent(enterEvent);
  }

  // Also ensure Status and Type header filters are reset to All using Tabulator API
  try {
    if (window.cointoolTable && typeof window.cointoolTable.setHeaderFilterValue === 'function') {
      window.cointoolTable.setHeaderFilterValue('Status', '');
      // Type column uses field 'SourceType' in unified view
      window.cointoolTable.setHeaderFilterValue('SourceType', '');
    } else {
      // Fallback to DOM-based setter
      try { setStatusHeaderFilter(''); } catch {}
      try {
        const root = document.querySelector('.tabulator-col[tabulator-field="SourceType"] .tabulator-header-filter');
        const sel  = root ? root.querySelector('select') : null;
        const inp  = root ? root.querySelector('input')  : null;
        const v    = '';
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
      } catch {}
    }
  } catch {}
}
function updateCalendar() {
  getAllMints(dbInstance).then(allTokens => {
    const nowSec  = Math.floor(Date.now() / 1000);
    const dateMap = {};

    for (const row of allTokens) {
      const t = Number(row.Maturity_Timestamp || 0);
      const live = computeLiveStatus(row);  // reuse your live status helper

      if (live === 'Maturing' && Number.isFinite(t) && t > nowSec) {
        const key = row.maturityDateOnly && row.maturityDateOnly.length
          ? row.maturityDateOnly
          : luxon.DateTime.fromSeconds(t).toFormat('yyyy-MM-dd');
        dateMap[key] = (dateMap[key] || 0) + Number(row.VMUs || 0);
      }
    }

    if (calendarPicker) calendarPicker.destroy();
    document.getElementById("calendar").style.display = 'block';

    calendarPicker = flatpickr("#calendar", {
      inline: true,
      onDayCreate: function(dObj, dStr, fp, dayElem) {
        const dateStr = dayElem.dateObj ? getLocalDateString(dayElem.dateObj) : "";
        if (dateMap[dateStr]) {
          const badge = document.createElement("span");
          badge.textContent = dateMap[dateStr];
          badge.style.cssText = "position:absolute;top:-2px;right:-2px;height:16px;line-height:16px;padding:0 4px;text-align:center;font-size:9px;background-color:#063d85;color:yellow;border-radius:4px;cursor:pointer;";
          badge.addEventListener("click", function(e) {
            e.stopPropagation();
            setMaturityHeaderFilter(dayElem.dateObj);
          });
          dayElem.style.position = "relative";
          dayElem.appendChild(badge);
        }
      },
      onChange: function(selectedDates) {
        if (selectedDates.length) {
          setMaturityHeaderFilter(selectedDates[0]);
        }
      }
      ,
      onReady: function(selectedDates, dateStr, instance){ __fixFlatpickrHeader(instance); },
      onMonthChange: function(selectedDates, dateStr, instance){ __fixFlatpickrHeader(instance); },
      onYearChange: function(selectedDates, dateStr, instance){ __fixFlatpickrHeader(instance); }
    });

    // keep the global pointer fresh
    window._calendar = calendarPicker;
  }).catch(err => {
    console.error("Error fetching mints for calendar update:", err);
  });
}



// --- *** NEW: WALLET CONNECTION & CLAIMING LOGIC *** ---

async function connectWallet() {
  if (!window.ethereum) {
    alert("Web3 wallet not detected. Please install a wallet like MetaMask or Rabby.");
    return;
  }
  try {
    web3Wallet = new Web3(window.ethereum);
    window.web3Wallet = web3Wallet; // expose for other scripts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    const chainId = parseInt(chainIdHex, 16);
    if (chainId !== 1) {
      // Not on Ethereum Mainnet: show message and prevent connecting
      alert('Please switch your wallet to Ethereum Mainnet to use the app.');
      // Ensure UI remains in disconnected state
      connectedAccount = null;
      window.connectedAccount = null;
      try { window.web3Wallet = null; } catch {}
      const btnTxt = document.getElementById('connectWalletText');
      if (btnTxt) btnTxt.textContent = 'Connect Wallet';
      await updateNetworkBadge();
      try { window.updateMintConnectHint?.(); window.updateStakeConnectHint?.(); } catch {}
      return;
    }

    connectedAccount = accounts[0];
    window.connectedAccount = connectedAccount; // expose for other scripts

    const btnTxt = document.getElementById('connectWalletText');
    if (btnTxt) btnTxt.textContent = `${connectedAccount.slice(0, 6)}...${connectedAccount.slice(-4)}`;

    await updateNetworkBadge();
    try { window.prefillStakeAmountFromBalance?.(); window.updateStakeStartEnabled?.(); } catch {}
    try { window.updateMintConnectHint?.(); window.updateStakeConnectHint?.(); } catch {}
    __updateWalletEyeSize();

    // keep UI in sync
    window.ethereum.removeAllListeners?.('chainChanged');
    window.ethereum.removeAllListeners?.('accountsChanged');
    window.ethereum.on?.('chainChanged', async (cidHex) => {
      const cid = parseInt(cidHex, 16);
      await updateNetworkBadge();
      if (cid !== 1) {
        alert('Please switch your wallet to Ethereum Mainnet to use the app.');
        await disconnectWallet();
        try { window.updateMintConnectHint?.(); window.updateStakeConnectHint?.(); } catch {}
        return;
      }
      if (cointoolTable) cointoolTable.redraw(true);
    });
    window.ethereum.on?.('accountsChanged', (accs) => {
      connectedAccount = accs?.[0] || null;
      window.connectedAccount = connectedAccount;
      const bt = document.getElementById('connectWalletText');
      if (bt) bt.textContent = connectedAccount
        ? `${connectedAccount.slice(0, 6)}...${connectedAccount.slice(-4)}`
        : 'Connect Wallet';
      selectedRows.clear();
      refreshBulkUI();
      if (cointoolTable) cointoolTable.redraw(true);
      try { window.prefillStakeAmountFromBalance?.(); window.updateStakeStartEnabled?.(); } catch {}
      try { window.updateMintConnectHint?.(); window.updateStakeConnectHint?.(); } catch {}
    });

    selectedRows.clear();
    refreshBulkUI();
    if (cointoolTable) cointoolTable.redraw(true);
  } catch (error) {
    alert("Failed to connect wallet.");
    console.error(error);
  }
}async function handleClaimAction(row) {
  // 1) Require wallet
  if (!web3Wallet || !connectedAccount) {
    alert("Please connect the wallet that owns this mint.");
    return;
  }
  // 1b) Require Ethereum mainnet
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (parseInt(chainId, 16) !== 1) {
      alert("Please switch your wallet to Ethereum Mainnet to claim/remint.");
      return;
    }
  } catch {
    alert("Could not read current network. Please switch to Ethereum Mainnet.");
    return;
  }

  const w3 = web3Wallet || web3;

  // ✅ NEW: Handle regular XEN Stake withdrawal
  if (String(row.SourceType) === 'Stake') {
    // ✅ FIX: Minimal ABI for the correct 'withdraw()' function (no parameters)
    try {
      // XEN_ETH address is already defined in app.js
      const xenContract = new w3.eth.Contract(window.xenAbi, XEN_ETH);
      // ✅ FIX: Call withdraw() with no arguments
      const tx = await xenContract.methods.withdraw().send({ from: connectedAccount });

      if (typeof showToast === 'function') {
        showToast(`Stake withdraw submitted: ${tx.transactionHash}`, "success");
      } else {
        alert(`Stake withdraw submitted: ${tx.transactionHash}`);
      }

      // Refresh the UI immediately
      if (typeof window.refreshUnified === 'function') { try { await window.refreshUnified(); } catch {} }
    } catch (err) {
      console.error(err);
      alert(err?.message || "Stake withdraw failed.");
    }
    return; // End the function here for this case
  }

  // NEW: Stake XENFT → endStake(tokenId)
  if (String(row.SourceType) === 'Stake XENFT') {
    // Stake NFTs don’t have “remint”; just end the stake.
    const tokenId = Number(row.Mint_id_Start || row.tokenId);
    if (!Number.isFinite(tokenId)) { alert("Bad Stake XENFT tokenId."); return; }

    // Use the address exported by xenft-stake.js, fallback to canonical mainnet address
    const STAKE_ADDR =
      (window.xenftStake && window.xenftStake.CONTRACT_ADDRESS) ||
      '0xfEdA03b91514D31b435d4E1519Fd9e699C29BbFC';

    try {
      const stake = new w3.eth.Contract(window.xenftStakeAbi, STAKE_ADDR);
      const tx = await stake.methods.endStake(tokenId).send({ from: connectedAccount });

      if (typeof showToast === 'function') {
        showToast(`Stake XENFT #${tokenId} end submitted: ${tx.transactionHash}`, "success");
      } else {
        alert(`Stake XENFT #${tokenId} end submitted: ${tx.transactionHash}`);
      }

      // Refresh the merged view; the scan will later pick up the on-chain end action.
      if (typeof window.refreshUnified === 'function') { try { await window.refreshUnified(); } catch {} }
    } catch (err) {
      console.error(err);
      alert(err?.message || "Stake XENFT end failed.");
    }
    return;
  }

  // XENFTs: only "claim" is meaningful — call torrent.bulkClaimMintReward(tokenId, to)
  if (String(row.SourceType) === 'XENFT') {
    const action = await chooseActionDialog('claim', row);
    if (action !== 'claim') return;

    const tokenId = Number(row.Xenft_id || row.Mint_id_Start || row.tokenId);
    if (!Number.isFinite(tokenId)) { alert("Bad XENFT tokenId."); return; }

    const TORRENT_ADDR =
      (typeof XENFT_TORRENT === 'string' && XENFT_TORRENT) ||
      (window.xenft && window.xenft.CONTRACT_ADDRESS) ||
      '0x0a252663DBCc0b073063D6420a40319e438Cfa59';

    const XF_ABI = (typeof window.xenftAbi !== 'undefined' && Array.isArray(window.xenftAbi))
      ? [...window.xenftAbi,
        {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"to","type":"address"}],
          "name":"bulkClaimMintReward","outputs":[],"stateMutability":"nonpayable","type":"function"}]
      : [{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"to","type":"address"}],
        "name":"bulkClaimMintReward","outputs":[],"stateMutability":"nonpayable","type":"function"}];

    try {
      const torrent = new w3.eth.Contract(window.xenftAbi, TORRENT_ADDR);
      const tx = await torrent.methods.bulkClaimMintReward(tokenId, connectedAccount)
        .send({ from: connectedAccount });
      if (typeof showToast === 'function') {
        showToast(`XENFT #${tokenId} claim submitted: ${tx.transactionHash}`, "success");
      } else {
        alert(`XENFT #${tokenId} claim submitted: ${tx.transactionHash}`);
      }
      if (typeof window.refreshUnified === 'function') { try { await window.refreshUnified(); } catch {} }
    } catch (err) {
      console.error(err);
      alert(err?.message || "XENFT claim failed.");
    }
    return;
  }

  // CoinTool path (unchanged)
  const action = await chooseActionDialog('claim', row);
  if (!action || (action !== 'claim' && action !== 'remint')) return;

  const startId  = Number(row.Mint_id_Start);
  const vmuCount = Number(row.VMUs || 1);
  if (!Number.isFinite(startId) || !Number.isFinite(vmuCount) || vmuCount < 1) {
    alert("Bad Mint_id_Start or VMUs.");
    return;
  }
  const ids  = Array.from({ length: vmuCount }, (_, i) => startId + i);
  const salt = ensureBytes(row.Salt);

  const minter = connectedAccount;
  let dataHex;
  if (action === 'claim') {
    dataHex = buildClaimData(minter, XEN_ETH);
  } else {
    const term = await openRemintTermDialog();
    if (term == null) return; // cancelled
    dataHex = buildRemintData(minter, term);
  }

  await sendCointoolTx({ ids, dataHex, salt, w3, mintData: row, action });
}


function cleanHexAddr(addr) {
  if (!addr) return addr;
  return '0x' + String(addr).trim().replace(/^0x/i, '').toLowerCase();
}

function ensureHexBytes(s) {
  if (!s) return s;
  const str = String(s).trim();
  return str.startsWith('0x') ? str : web3.utils.utf8ToHex(str);
}

async function resolveXenAddress() {
  // Handles both a plain string constant or a per-chain map
  // e.g. XEN_CRYPTO_ADDRESS = "0x..."  OR  { "1": "0x...", "56": "0x..." , eth: "0x..." }
  const cid = (typeof web3Wallet !== 'undefined') ? await web3Wallet.eth.getChainId() : null;
  const val = (typeof XEN_CRYPTO_ADDRESS === 'string')
    ? XEN_CRYPTO_ADDRESS
    : (XEN_CRYPTO_ADDRESS?.[String(cid)] ?? XEN_CRYPTO_ADDRESS?.eth ?? XEN_CRYPTO_ADDRESS?.ETH);
  if (!val) throw new Error('XEN address not configured for this network.');
  return cleanHexAddr(val);
}

window.onload = async () => {
  loadUserPreferences();
  try { initShowMaskToggles(); } catch {}
  validateInputs();
  // Check if we should auto-run RPC import for single RPC
  checkAutoImportRPCs();
  try {
    dbInstance = await openDB();
    window.dbInstance = dbInstance;
    const storedMints = await getAllMints(dbInstance);
    populateTable(storedMints);
    ensureBulkBar();
    refreshBulkUI();
    if (storedMints.length > 0) {
      updateCalendar();
    }
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
};

// Add event listeners to all inputs for validation and saving
document.getElementById("customRPC").addEventListener("input", validateInputs);
document.getElementById("etherscanApiKey").addEventListener("input", validateInputs);
document.getElementById("ethAddress").addEventListener("input", validateInputs);

document.getElementById("scanBtn").addEventListener("click", scanMints);
document.getElementById("connectWalletBtn").addEventListener("click", handleWalletConnectClick);
document.getElementById("customRPC").addEventListener("blur", function(){
  saveUserPreferences(
    document.getElementById("ethAddress").value,
    document.getElementById("customRPC").value,
    document.getElementById("etherscanApiKey").value
  );
});
document.getElementById("ethAddress").addEventListener("blur", function(){
  saveUserPreferences(
    document.getElementById("ethAddress").value,
    document.getElementById("customRPC").value,
    document.getElementById("etherscanApiKey").value
  );
});
document.getElementById("etherscanApiKey").addEventListener("blur", function(){
  saveUserPreferences(
    document.getElementById("ethAddress").value,
    document.getElementById("customRPC").value,
    document.getElementById("etherscanApiKey").value
  );
});
document.getElementById("downloadBtn").addEventListener("click", function(){
  if(cointoolTable){ cointoolTable.download("csv", "cointool-mints-detailed.csv"); }
});

// --- STATUS CHIP FILTERING ---
// app.js

// --- STATUS CHIP FILTERING ---
function setStatusHeaderFilter(statusText) {
  // 1. Update the UI to show which chip is active. This should run for every click.
  document.querySelectorAll('.filter-chips .chip').forEach(chip => {
    chip.classList.toggle('active', (chip.dataset.filter || '') === (statusText || ''));
  });

  // 2. Find the select (new) or input (fallback) for the Status header filter.
  const statusFilterRoot = document.querySelector('.tabulator-col[tabulator-field="Status"] .tabulator-header-filter');
  if (!statusFilterRoot) {
    if (window.cointoolTable) setTimeout(() => setStatusHeaderFilter(statusText), 200);
    return;
  }
  const selectEl = statusFilterRoot.querySelector('select');
  const inputEl  = statusFilterRoot.querySelector('input');

  // 3. Set the status filter value and trigger Tabulator to re-filter.
  // An empty string for statusText (from the "All" chip) will clear this specific filter
  // without affecting other filters like the date.
  const value = statusText || "";
  if (selectEl) {
    selectEl.value = value;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    selectEl.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (inputEl) {
    inputEl.value = value;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
  }

  // 4. To ensure a consistent view, re-apply a default sort after the filter changes.
  if (typeof cointoolTable?.setSort === 'function') {
    try {
      cointoolTable.setSort("Maturity_Date_Fmt", "asc");
    } catch (_) {}
  }
}

// New helper: set the Maturity Date header filter value programmatically (by text)
function setMaturityHeaderFilterText(text) {
  const root = document.querySelector('.tabulator-col[tabulator-field="Maturity_Date_Fmt"] .tabulator-header-filter');
  const input = root ? root.querySelector('input') : null;
  if (!input) {
    if (window.cointoolTable) setTimeout(() => setMaturityHeaderFilterText(text), 200);
    return;
  }
  input.value = text || "";
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}


// Delete content of ALL IndexedDBs (stores only; DB shells remain)
async function clearAllAppData() {
  // DB_Cointool
  try {
    const ctDb = await openDB();
    await Promise.all([
      clearStore(ctDb, "mints"),
      clearStore(ctDb, "scanState"),
      clearStore(ctDb, "actionsCache").catch(() => {})
    ]);
  } catch (_) {}

  // DB_Xenft
  try {
    if (window.xenft?.openDB) {
      const xfDb = await window.xenft.openDB();
      await clearStore(xfDb, "xenfts");
    }
  } catch (_) {}

  // DB-Xenft-Stake
  try {
    if (window.xenftStake?.openDB) {
      const stakeDb = await window.xenftStake.openDB();
      await Promise.all([
        clearStore(stakeDb, "stakes"),
        clearStore(stakeDb, "scanState")
      ]);
    }
  } catch (_) {}

  // ✅ DB-Xen-Stake (regular stakes)
  try {
    if (window.xenStake?.openDB) {
      const xsDb = await window.xenStake.openDB();
      await Promise.all([
        clearStore(xsDb, "stakes"),
        clearStore(xsDb, "scanState")
      ]);
    }
  } catch (_) {}
}


// read all from a store
function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = e => resolve(e.target.result || []);
    req.onerror = e => reject(e);
  });
}

// clear a store
function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e);
  });
}

// bulk put
function bulkPut(db, storeName, items) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(items) || items.length === 0) return resolve();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const it of items) store.put(it);
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e);
  });
}

function getGasRefreshMs() {
  const v = parseInt(localStorage.getItem("gasRefreshSeconds") || "5", 10);
  const seconds = Number.isFinite(v) && v >= 5 ? v : 5;
  return seconds * 1000;
}

// collect all settings on the Settings tab (+ optional throttle)
function collectSettingsSnapshot() {
  const settings = {
    ethAddress: (document.getElementById("ethAddress")?.value ?? "").trim(),
    customRPC: (document.getElementById("customRPC")?.value ?? "").trim(),
    etherscanApiKey: (document.getElementById("etherscanApiKey")?.value ?? "").trim(),
    chunkSize: (document.getElementById("chunkSize")?.value ?? "").trim(),
    gasRefreshSeconds: (document.getElementById("gasRefreshSeconds")?.value ?? "").trim(),
    mintTermDays: (document.getElementById("mintTermDays")?.value ?? (localStorage.getItem("mintTermDays") || "")).trim(),
    theme: (function(){ try { return getStoredTheme(); } catch { return (localStorage.getItem("theme") || "system"); } })(),
    vmuChartExpanded: (localStorage.getItem("vmuChartExpanded") || '0'),
    // Persist the last active tab id (Dashboard/Mint/Settings/About)
    activeTab: (function(){
      try {
        const stored = localStorage.getItem('activeTabId');
        if (stored) return stored;
      } catch {}
      try {
        const p = document.querySelector('.tab-panel.active');
        return p ? p.id : 'tab-dashboard';
      } catch {}
      return 'tab-dashboard';
    })(),
    // New: persist show/mask states (default API key visible on first run)
    etherscanApiKeyVisible: (function(){ const v=localStorage.getItem("etherscanApiKeyVisible"); return v==null?'1':v; })(),
    ethAddressMasked: (localStorage.getItem("ethAddressMasked") || '0'),
    connectWalletMasked: (localStorage.getItem("connectWalletMasked") || '0')
  };
  const throttle = localStorage.getItem("etherscanThrottleMs");
  if (throttle) settings.etherscanThrottleMs = throttle;
  return settings;
}

function applySettingsSnapshot(settings) {
  if (!settings || typeof settings !== "object") return;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
  setVal("ethAddress", settings.ethAddress);
  setVal("customRPC", settings.customRPC);
  setVal("etherscanApiKey", settings.etherscanApiKey);
  setVal("chunkSize", settings.chunkSize);
  setVal("gasRefreshSeconds", settings.gasRefreshSeconds);
  setVal("mintTermDays", settings.mintTermDays);

  if (typeof settings.ethAddress === "string") localStorage.setItem("ethAddress", settings.ethAddress);
  if (typeof settings.customRPC === "string") localStorage.setItem("customRPC", settings.customRPC);
  if (typeof settings.etherscanApiKey === "string") localStorage.setItem("etherscanApiKey", settings.etherscanApiKey);
  if (settings.chunkSize != null) localStorage.setItem("chunkSize", String(settings.chunkSize));
  if (typeof settings.etherscanThrottleMs === "string") localStorage.setItem("etherscanThrottleMs", settings.etherscanThrottleMs);
  if (settings.gasRefreshSeconds != null) localStorage.setItem("gasRefreshSeconds", String(settings.gasRefreshSeconds));
  if (settings.mintTermDays != null) localStorage.setItem("mintTermDays", String(settings.mintTermDays));
  if (settings.etherscanApiKeyVisible != null) localStorage.setItem("etherscanApiKeyVisible", String(settings.etherscanApiKeyVisible));
  if (settings.ethAddressMasked != null) localStorage.setItem("ethAddressMasked", String(settings.ethAddressMasked));
  if (settings.connectWalletMasked != null) localStorage.setItem("connectWalletMasked", String(settings.connectWalletMasked));

  // Theme persistence and application (supports light/dark; legacy 'system' maps to OS)
  try {
    let theme = settings.theme;
    if (!(theme === 'dark' || theme === 'light' || theme === 'system')) theme = getStoredTheme();
    storeTheme(theme);
    applyTheme(theme);
    // Update header menu indicator
    try { updateThemeMenuUI(); } catch {}
  } catch {}

  // Restore active tab (if provided)
  try {
    if (settings.activeTab) {
      localStorage.setItem('activeTabId', settings.activeTab);
      if (typeof window.setActiveTab === 'function') {
        window.setActiveTab(settings.activeTab);
      } else {
        const id = document.getElementById(settings.activeTab) ? settings.activeTab : 'tab-dashboard';
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === id));
        document.querySelectorAll('.tab-button').forEach(b => b.classList.toggle('active', (b.dataset.target === id)));
      }
    }
  } catch {}

  // if Mint tab is present, refresh preview
  try {
    const el = document.getElementById("mintTermDays");
    if (el) {
      const evt = new Event('input', { bubbles: true });
      el.dispatchEvent(evt);
    }
  } catch (_) {}

  // Apply VMU chart expand/collapse from settings
  try {
    if (settings.vmuChartExpanded != null) {
      const wantOpen = String(settings.vmuChartExpanded) === '1' || String(settings.vmuChartExpanded).toLowerCase() === 'true';
      localStorage.setItem('vmuChartExpanded', wantOpen ? '1' : '0');
      // If chart UI exists now, apply immediately
      if (document.getElementById('vmuChartToggle')) {
        setVmuChartExpandedState(wantOpen);
      }
    }
  } catch (_) {}

  // Apply show/mask states to UI if elements exist (avoid ?? for broader compatibility)
  try {
    var apiVisRaw = (settings && settings.etherscanApiKeyVisible != null)
      ? settings.etherscanApiKeyVisible
      : localStorage.getItem('etherscanApiKeyVisible');
    var addrMaskRaw = (settings && settings.ethAddressMasked != null)
      ? settings.ethAddressMasked
      : localStorage.getItem('ethAddressMasked');
    var walletMaskRaw = (settings && settings.connectWalletMasked != null)
      ? settings.connectWalletMasked
      : localStorage.getItem('connectWalletMasked');
    var apiVis = String((apiVisRaw == null ? '1' : apiVisRaw)) === '1';
    var addrMask = String(addrMaskRaw || '0') === '1';
    var walletMask = String(walletMaskRaw || '0') === '1';
    if (document.getElementById('etherscanApiKey')) setApiKeyVisibility(apiVis);
    if (document.getElementById('ethAddress')) setEthAddressMasked(addrMask);
    if (document.getElementById('connectWalletBtn')) setConnectWalletMasked(walletMask);
  } catch(_) {}
}

// Export: bundles CointoolDB + DB_Xenft + Settings
function formatBackupFileName(now = new Date()){
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sept","Oct","Nov","Dec"]; // NOTE: "Sept" per request
  const y = now.getFullYear();
  const m = months[now.getMonth()];
  const d = String(now.getDate()).padStart(2, "0");
  let h = now.getHours();
  const am = h < 12;
  h = h % 12; if (h === 0) h = 12; // 12-hour clock, no leading zero
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const suffix = am ? "AM" : "PM";
  return `mintscanner-backup-${y}-${m}-${d}_${h}-${mm}-${ss}_${suffix}.json`;
}
async function exportBackup() {
  // --- DB_Cointool ---
  const ctDb = await openDB();
  const [mints, scanState, actionsCache] = await Promise.all([
    getAllFromStore(ctDb, "mints"),
    getAllFromStore(ctDb, "scanState"),
    // actionsCache was added in DB v3; if not present, resolve to []
    getAllFromStore(ctDb, "actionsCache").catch(() => [])
  ]);

  // --- DB_Xenft (optional if module unavailable/empty) ---
  let xenftRows = [];
  try {
    if (window.xenft?.openDB && window.xenft?.getAll) {
      const xfDb = await window.xenft.openDB();
      xenftRows = await window.xenft.getAll(xfDb);
    }
  } catch (_) {
    // ignore; we still export what we have
  }

  // --- DB-Xenft-Stake (NEW) ---
  let stakeXenftRows = [];
  let stakeXenftState = [];
  try {
    if (window.xenftStake?.openDB) {
      const stakeDb = await window.xenftStake.openDB();
      [stakeXenftRows, stakeXenftState] = await Promise.all([
        getAllFromStore(stakeDb, "stakes"),
        getAllFromStore(stakeDb, "scanState")
      ]);
    }
  } catch (_) {}


  // --- DB-Xen-Stake (NEW) ---
  let stakeRows = [];
  let stakeState = [];
  try {
    if (window.xenStake?.openDB) { //
      const xsDb = await window.xenStake.openDB(); //
      [stakeRows, stakeState] = await Promise.all([
        getAllFromStore(xsDb, "stakes"), //
        getAllFromStore(xsDb, "scanState") //
      ]);
    }
  } catch (_) {}

  const payload = {
    fileType: "mintscanner-backup",
    version: 4, // Bump version for regular Stake data
    exportedAt: new Date().toISOString(),
    settings: collectSettingsSnapshot(),
    databases: [
      {
        name: "DB_Cointool",
        version: 3,
        stores: { mints, scanState, actionsCache }
      },
      {
        name: "DB_Xenft",
        version: 1,
        stores: { xenfts: xenftRows }
      },
      {
        name: "DB-Xenft-Stake",
        version: 2,
        stores: { stakes: stakeXenftRows, scanState: stakeXenftState }
      },
      // ADD THIS NEW OBJECT
      {
        name: "DB-Xen-Stake",
        version: 1, //
        stores: { stakes: stakeRows, scanState: stakeState }
      }
    ]
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const fileName = formatBackupFileName(new Date());

  // save picker → web share → anchor fallback
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (_) {}
  }
  if (typeof navigator.canShare === "function" && typeof navigator.share === "function") {
    try {
      const file = new File([blob], fileName, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mint Scanner Backup", text: "Mint Scanner backup file" });
        return;
      }
    } catch (_) {}
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

// Import: supports new "mintscanner-backup" AND legacy "cointool-backup"
async function importBackupFromFile(file) {
  if (!file) return;

  const text = await file.text();
  let data;
  try { data = JSON.parse(text); }
  catch { alert("Invalid backup file."); return; }

  // New multi-DB format
  if (data && data.fileType === "mintscanner-backup" && Array.isArray(data.databases)) {
    applySettingsSnapshot(data.settings || {}); // settings first

    for (const dbDef of data.databases) {
      const name = dbDef?.name;
      const stores = dbDef?.stores || {};

      if (name === "DB_Cointool") {
        const db = await openDB();
        await clearStore(db, "mints").catch(()=>{});
        await clearStore(db, "scanState").catch(()=>{});
        await clearStore(db, "actionsCache").catch(()=>{});
        await bulkPut(db, "mints", stores.mints || []);
        await bulkPut(db, "scanState", stores.scanState || []);
        if (Array.isArray(stores.actionsCache)) {
          await bulkPut(db, "actionsCache", stores.actionsCache);
        }
      }

      if (name === "DB_Xenft" && window.xenft?.openDB) {
        const xfDb = await window.xenft.openDB();
        await clearStore(xfDb, "xenfts").catch(()=>{});
        await bulkPut(xfDb, "xenfts", stores.xenfts || []);
      }

      if (name === "DB-Xenft-Stake" && window.xenftStake?.openDB) {
        const stakeDb = await window.xenftStake.openDB();
        await clearStore(stakeDb, "stakes").catch(() => {});
        await clearStore(stakeDb, "scanState").catch(() => {});
        await bulkPut(stakeDb, "stakes", stores.stakes || []);
        await bulkPut(stakeDb, "scanState", stores.scanState || []);
      }

      // ADD THIS NEW BLOCK for DB-Xen-Stake
      if (name === "DB-Xen-Stake" && window.xenStake?.openDB) { //
        const xsDb = await window.xenStake.openDB(); //
        await clearStore(xsDb, "stakes").catch(() => {}); //
        await clearStore(xsDb, "scanState").catch(() => {}); //
        await bulkPut(xsDb, "stakes", stores.stakes || []);
        await bulkPut(xsDb, "scanState", stores.scanState || []);
      }
    }

    alert("Backup imported. The app will now reload.");
    setTimeout(() => window.location.reload(), 100);
    return;
  }

  // Legacy single-DB format
  if (!data || data.fileType !== "cointool-backup" || !data.stores) {
    alert("Invalid backup structure.");
    return;
  }

  const db = await openDB();
  await clearStore(db, "mints");
  await clearStore(db, "scanState");
  await bulkPut(db, "mints", data.stores.mints || []);
  await bulkPut(db, "scanState", data.stores.scanState || []);
  applySettingsSnapshot(data.settings || {});

  alert("Backup imported successfully. The app will now reload.");
  setTimeout(() => window.location.reload(), 100);
}

// Promise-based DB deletion with blocked handling
function deleteDatabaseByName(name) {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve('success');
      req.onerror   = (e) => reject(e.target?.error || new Error('delete failed'));
      req.onblocked = () => resolve('blocked'); // another tab holds it open
    } catch (e) {
      resolve('success'); // if deleteDatabase throws (rare), treat as best-effort
    }
  });
}

// Backup & Restore wiring (runs after DOM is available)
(function wireBackupRestore(){
  const exportBtn  = document.getElementById("exportBackupBtn");
  const importInput = document.getElementById("importBackupInput");
  const importLabel = document.getElementById("importBackupBtn"); // The button-styled label

  if (exportBtn) {
    exportBtn.addEventListener("click", exportBackup);
  }

  if (importLabel && importInput) {
    // This function handles the import process after user confirmation.
    const startImportProcess = async () => {
      const ok = confirm(
        "This will permanently DELETE your current data (DB_Cointool, DB_Xenft, DB-Xenft-Stake, and DB-Xen-Stake) before importing.\n\nContinue?"
      );
      if (!ok) return;

      try {
        await clearAllAppData();
      } catch(e) {
        console.error("Failed to clear app data before import:", e);
      }

      // Programmatically click the hidden file input to open the file picker.
      importInput.click();
    };

    // Handle clicks on the styled label.
    importLabel.addEventListener("click", (e) => {
      e.preventDefault(); // Prevent the label's default action.
      startImportProcess();
    });

    // Handle keyboard accessibility (Enter/Space).
    importLabel.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startImportProcess();
      }
    });

    // The actual import happens when a file is selected via the input.
    importInput.addEventListener("change", () => {
      const file = importInput.files && importInput.files[0];
      if (file) {
        importBackupFromFile(file);
      }
      // Reset the input so the user can select the same file again if needed.
      importInput.value = "";
    });
  }
})();




try { updateNetworkBadge(); } catch {}
document.getElementById('connectWalletBtn')?.addEventListener('click', handleWalletConnectClick);

// Wire up the chips once
(function initStatusChips(){
  const container = document.querySelector('.filter-chips');
  if (!container) return;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;

    // Toggle active highlight
    container.querySelectorAll('.chip').forEach(chip => chip.classList.toggle('active', chip === btn));

    const action = btn.dataset.filter || '';

    if (action === '') {
      // All: clear all header filters and ensure Status is set to All
      if (window.cointoolTable) {
        window.cointoolTable.clearHeaderFilter();
        try { window.cointoolTable.setHeaderFilterValue('Status', ''); } catch (_) {}
        try { window.cointoolTable.setSort('Maturity_Date_Fmt', 'asc'); } catch (_) {}
      }
      return;
    }

    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth(); // 0..11
    let value = '';

    switch (action) {
      case 'this-month':
        value = `${y} ${MONTHS[m]}`;
        break;
      case 'next-month':
        m = (m + 1) % 12;
        if (m === 0) y += 1;
        value = `${y} ${MONTHS[m]}`;
        break;
      case 'this-year':
        value = String(y);
        break;
      case 'next-year':
        value = String(y + 1);
        break;
      case 'year-plus-2':
        value = String(y + 2);
        break;
      case 'year-plus-3':
        value = String(y + 3);
        break;
      default:
        value = '';
    }

    // Apply the maturity filter (month/year or year only; no day part)
    setMaturityHeaderFilterText(value);

    // Keep Status header filter at All
    try { window.cointoolTable?.setHeaderFilterValue('Status', ''); } catch (_) {}
    try { window.cointoolTable?.setSort('Maturity_Date_Fmt', 'asc'); } catch (_) {}
  });
})();

/* === AUTO-CONNECT WALLET ON PAGE LOAD (added by optimizer) === */
(function() {
  const ready = () => new Promise(r => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => r(), { once: true });
    } else { r(); }
  });
  (async () => {
    await ready();
    if (!window.ethereum) return; // no injected wallet present
    try {
      // Only auto-connect if the site is already authorized by the wallet
      const existing = await window.ethereum.request({ method: 'eth_accounts' });
      if (Array.isArray(existing) && existing.length > 0) {
        if (typeof connectWallet === 'function') {
          await connectWallet();
        } else {
          // Fallback minimal setup
          try {
            window.web3Wallet = new Web3(window.ethereum);
          } catch (e) {}
          const acct = existing[0];
          window.connectedAccount = acct;
          const btnTxt = document.getElementById('connectWalletText');
          if (btnTxt) btnTxt.textContent = `${acct.slice(0,6)}...${acct.slice(-4)}`;
        }
      }
    } catch (e) {
      console.warn('Auto-connect wallet failed:', e);
    }
  })();
})();
/* === END AUTO-CONNECT === */

document.addEventListener('DOMContentLoaded', () => {


  // cRank (globalRank)
  updateCrankStatus();     // initial UI
  const cBtn = document.getElementById('refreshCrankBtn');
  if (cBtn) {
    cBtn.addEventListener('click', async () => {
      cBtn.disabled = true;
      try { await fetchXenGlobalRank(); }
      finally { cBtn.disabled = false; }
    });
  }

  // initial one-time fetch at load
  fetchXenGlobalRank();

  // initial status text
  updateXenPriceStatus();

  // wire button in Settings
  const btn = document.getElementById('refreshXenPriceBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await fetchXenUsdPrice(); }
      finally { btn.disabled = false; }
    });
  }

  // initial fetch + periodic refresh (optional)
  fetchXenUsdPrice();
  setInterval(fetchXenUsdPrice, 60_000);
});


function updateDownloadButtonsVisibility(){
  const csvBtn  = document.getElementById('downloadBtn');
  const jsonBtn = document.getElementById('downloadJsonBtn');
  const hasRows = !!(window.cointoolTable && typeof window.cointoolTable.getDataCount === 'function'
    ? window.cointoolTable.getDataCount() > 0
    : (window.cointoolTable?.getData?.()?.length || 0) > 0);

  const display = hasRows ? '' : 'none';
  if (csvBtn)  csvBtn.style.display  = display;
  if (jsonBtn) jsonBtn.style.display = display;
}

// After you initialize cointoolTable:
if (window.cointoolTable) {
  window.cointoolTable.on('dataLoaded',     updateDownloadButtonsVisibility);
  window.cointoolTable.on('dataProcessed',  updateDownloadButtonsVisibility);
  window.cointoolTable.on('dataFiltered',   updateDownloadButtonsVisibility);
  window.cointoolTable.on('renderComplete', updateDownloadButtonsVisibility);
}

// Also call once after your first data load / scan completes:
updateDownloadButtonsVisibility();

// ===== GAS PRICE WATCHER (WALLET-INDEPENDENT) =====
(function initGasPriceWatcher() {
  const headerGasEl = document.getElementById('headerGasNow');
  if (!headerGasEl) return;

  let web3Gas;
  let rpcList = [];
  let currentRpcIndex = 0;
  let gasIntervalId = null; // To hold the setInterval ID

  if (!headerGasEl) return;


  function getRpcListFromSettings() {
    // Reads from the same source as your scan functions
    const customRPC = document.getElementById("customRPC")?.value || localStorage.getItem("customRPC") || DEFAULT_RPC;
    return customRPC.split("\n").map(s => s.trim()).filter(Boolean);
  }

  function switchRpc() {
    if (!rpcList.length) return;
    currentRpcIndex = (currentRpcIndex + 1) % rpcList.length;
    const newRpc = rpcList[currentRpcIndex];
    try {
      if (web3Gas) {
        web3Gas.setProvider(new Web3.providers.HttpProvider(newRpc));
      } else {
        web3Gas = new Web3(newRpc);
      }
    } catch (e) {
      console.error("Gas Watcher: Failed to set new provider", e);
    }
  }

  async function fetchGasPrice() {
    rpcList = getRpcListFromSettings();
    if (!rpcList.length) {
      console.warn("Gas Watcher: No RPC endpoints configured.");
      updateDisplay(null, "No RPCs configured");
      return;
    }

    if (!web3Gas) {
      web3Gas = new Web3(rpcList[0]);
    }

    const maxAttempts = rpcList.length * 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const wei = await web3Gas.eth.getGasPrice();
        const gwei = parseFloat(Web3.utils.fromWei(wei, 'gwei'));

        if (isFinite(gwei)) {
          updateDisplay(gwei, null, rpcList[currentRpcIndex]);
          startHeaderGasCountdown(getGasRefreshMs()); // Use the dynamic value
          return;
        }
      } catch (error) {
        console.warn(`Gas Watcher: Failed to get gas price from ${rpcList[currentRpcIndex]}.`);
        switchRpc(); // Try next RPC
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    updateDisplay(null, "All RPCs failed");
  }

  function updateDisplay(gwei, errorMsg = null, rpcUrl = null) {
    const now = new Date();
    if (gwei !== null) {
      headerGasEl.textContent = `${gwei.toFixed(2)} gwei`;
      const rpcName = rpcUrl ? ` via ${new URL(rpcUrl).hostname}` : '';
      headerGasEl.title = `Last refresh: ${now.toLocaleTimeString()}${rpcName}`;
    } else {
      headerGasEl.textContent = '... gwei';
      headerGasEl.title = `Failed to refresh gas price. ${errorMsg || ''}. Last attempt: ${now.toLocaleTimeString()}`;
      // Stop the countdown bar on failure
      headerGasEl.style.setProperty('--p', '0');
    }
  }

  let gasCountdownRaf = null;
  let gasCountdownStart = 0;
  function startHeaderGasCountdown(durationMs) { // durationMs is now passed in
    if (gasCountdownRaf) {
      cancelAnimationFrame(gasCountdownRaf);
    }
    gasCountdownStart = performance.now();
    headerGasEl.style.setProperty('--p', '1');
    const tick = (now) => {
      const elapsed = now - gasCountdownStart;
      const remain = Math.max(0, 1 - (elapsed / durationMs));
      headerGasEl.style.setProperty('--p', String(remain));
      if (elapsed < durationMs) {
        gasCountdownRaf = requestAnimationFrame(tick);
      }
    };
    gasCountdownRaf = requestAnimationFrame(tick);
  }

  function startWatcher() {
    if (gasIntervalId) {
      clearInterval(gasIntervalId);
    }
    fetchGasPrice(); // Initial fetch
    gasIntervalId = setInterval(fetchGasPrice, getGasRefreshMs());
  }

  // Gas Refresh Interval (validated number >= 5)
  const gasRefreshInput = document.getElementById("gasRefreshSeconds");
  if (gasRefreshInput) {
    const persistGasRefresh = (val) => {
      const v = parseInt(val, 10);
      if (Number.isFinite(v) && v >= 5 && v <= 60) {
        localStorage.setItem("gasRefreshSeconds", String(v));
        if (typeof showToast === "function") showToast(`Gas refresh interval saved (${v}s)`, "success");
        markValidity("field-gasRefreshSeconds", true);
      } else {
        if (typeof showToast === "function") showToast("Gas refresh must be between 5 and 60 seconds.", "error");
        gasRefreshInput.value = String(getGasRefreshMs() / 1000); // revert
        markValidity("field-gasRefreshSeconds", false, "Gas refresh must be between 5 and 60 seconds.");
      }
    };
    gasRefreshInput.addEventListener("change", () => persistGasRefresh(gasRefreshInput.value));
    gasRefreshInput.addEventListener("blur", () => persistGasRefresh(gasRefreshInput.value));
    gasRefreshInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); persistGasRefresh(gasRefreshInput.value); }
    });
  }

  startWatcher(); // Initial start

})();


// Ensure wallet eye is sized on DOM ready
document.addEventListener('DOMContentLoaded', () => { try { __updateWalletEyeSize(); } catch {} });




function isWalletConnected(){ return !!window.connectedAccount; }

async function disconnectWallet(){
  try {
    window.connectedAccount = null;
    try { window.web3Wallet = null; } catch {}
    const btnTxt = document.getElementById('connectWalletText');
    if (btnTxt) btnTxt.textContent = 'Connect Wallet';
    await updateNetworkBadge();
    try { window.prefillStakeAmountFromBalance?.(); window.updateStakeStartEnabled?.(); } catch {}
    try { window.updateMintConnectHint?.(); window.updateStakeConnectHint?.(); } catch {}
    try { window.ethereum?.removeAllListeners?.('chainChanged'); } catch {}
    try { window.ethereum?.removeAllListeners?.('accountsChanged'); } catch {}
  } catch (e) { console.warn('disconnectWallet: ', e); }
}

function handleWalletConnectClick(){
  try {
    if (!isPrivacyAccepted()) { openPrivacyModal(); return; }
    if (isWalletConnected()) { disconnectWallet(); } else { connectWallet(); }
  } catch {}
}

