
// --- Mobile Tooltip Helpers ---
// Mobile tooltip functions now provided by js/ui/tooltipManager.js module
// Legacy functions like addLongPressTooltip(), showMobileTooltip() are available globally

// About tab loading state
let _aboutLoaded = false;

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

// Update UI labels based on current chain
function updateChainSpecificLabels() {
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  const chainName = currentChain === 'BASE' ? 'Base' : 'Ethereum';
  const explorerName = currentChain === 'BASE' ? 'BaseScan' : 'Etherscan';
  
  if (!window.__rpcLastValuesByChain) {
    window.__rpcLastValuesByChain = {};
  }
  if (!window.__setRpcLastValueForChain) {
    window.__setRpcLastValueForChain = (chain, value) => {
      if (!chain) return;
      window.__rpcLastValuesByChain[chain] = value;
      try {
        localStorage.setItem(`${chain}_customRPC_lastKnown`, value || '');
        if (value && value.length) {
          localStorage.setItem(`${chain}_customRPC_source`, chain);
        }
      } catch (_) {}
    };
  }
  
  // Update Settings tab labels
  const addressLabel = document.querySelector('#field-ethAddress label[for="ethAddress"]');
  if (addressLabel) addressLabel.textContent = `${chainName} Addresses (one per line)`;
  
  const addressNote = document.querySelector('.settings-note');
  if (addressNote && addressNote.textContent.includes('address')) {
    addressNote.textContent = `Paste one ${chainName} address per line.`;
  }
  
  const addressError = document.querySelector('#field-ethAddress .error-message');
  if (addressError) addressError.textContent = `At least one ${chainName} address is required.`;
  
  const apiKeyLabel = document.querySelector('label[for="etherscanApiKey"]');
  if (apiKeyLabel) apiKeyLabel.textContent = `${explorerName} API Key`;
  
  const apiKeyInput = document.getElementById('etherscanApiKey');
  if (apiKeyInput) apiKeyInput.placeholder = `Your ${explorerName} API Key`;
  
  // Update RPC label to be chain-specific
  const rpcLabel = document.querySelector('label[for="customRPC"]');
  if (rpcLabel) rpcLabel.textContent = `Custom ${chainName} RPCs (one per line)`;

  // Update RPC textarea with chain-specific data
  const rpcTextarea = document.getElementById('customRPC');
  if (rpcTextarea && window.chainManager) {
    const actualChain = window.chainManager.getCurrentChain();
    const chainRPCs = window.chainManager.getRPCEndpoints();
    const rpcString = chainRPCs.join('\n');
    rpcTextarea.value = rpcString;
    window.__setRpcLastValueForChain(actualChain, rpcString);
    try {
      localStorage.setItem(`${actualChain}_customRPC_lastKnown`, rpcString);
    } catch (_) {}
    console.log(`[Chain UI] Updated RPC textarea for ${chainName} (actual chain: ${actualChain}) with ${chainRPCs.length} RPCs:`, chainRPCs.slice(0, 2));
  }

  // Note: Mint tab button stays as "Mint/Stake" - not chain-specific
  
  // Update Mint tab platform selector label if present
  const platformLabel = document.querySelector('label[for="mintPlatform"]');
  if (platformLabel) platformLabel.textContent = `Minting Platform`;
  
  // Update stake tab labels
  const stakeTitle = document.querySelector('#stakeControls h3');
  if (stakeTitle) stakeTitle.textContent = `Stake XEN`;
}

// --- THEME MANAGEMENT ---
// Theme management functions now provided by js/ui/themeManager.js module
// Legacy functions like getStoredTheme(), storeTheme(), applyTheme() are available globally

// Keep header theme menu UI in sync with current setting
function updateThemeMenuUI(){
  const cur = getStoredTheme();
  const txt = (cur === 'light') ? 'Light' : 'Dark';
  const curEl = document.getElementById('themeMenuCurrent');
  if (curEl) curEl.textContent = txt;
  const items = document.querySelectorAll('#headerMenu .menu-item[data-theme]');
  items.forEach(btn => {
    const on = (btn.getAttribute('data-theme') === cur);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

// buildEstXenTooltip function now provided by js/ui/tooltipManager.js module


/* --- Tab management now provided by js/ui/tabManager.js module --- */
// Legacy functions like setActiveTab() are available globally

// --- Privacy modal + Settings guard ---
// Modal and privacy functions now provided by js/ui/modalManager.js module
// Legacy functions like isPrivacyAccepted(), openPrivacyModal(), acceptPrivacy(), 
// isSetupComplete(), showOnboardingModal(), etc. are available globally

document.addEventListener('DOMContentLoaded', async () => {
  // Cleanup incorrectly named databases on load
  await cleanupIncorrectDatabases();
  
  // Update chain-specific labels on page load
  updateChainSpecificLabels();
  
  // Listen for chain changes to update labels
  if (window.chainManager) {
    window.chainManager.onChainChange(() => {
      updateChainSpecificLabels();
    });
  }
  
  
  // Check for dashboard hash and activate Dashboard tab
  if (window.location.hash === '#dashboard') {
    // Clear the hash from URL
    history.replaceState(null, null, window.location.pathname + window.location.search);
    
    // Activate dashboard tab after a short delay to ensure everything is loaded
    setTimeout(() => {
      if (typeof window.setActiveTab === 'function') {
        window.setActiveTab('tab-dashboard');
      } else {
        // Fallback if setActiveTab isn't available yet
        const dashboardTab = document.getElementById('tab-dashboard');
        const dashboardBtn = document.querySelector('[data-target="tab-dashboard"]');
        if (dashboardTab && dashboardBtn) {
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
          document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
          dashboardTab.classList.add('active');
          dashboardBtn.classList.add('active');
        }
      }
    }, 500);
  }
  
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
  
  // Onboarding modal button
  const onboardingBtn = document.getElementById('onboardingGetStartedBtn');
  if (onboardingBtn) onboardingBtn.addEventListener('click', completeOnboarding);
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
      const privacyModal = document.getElementById('privacyModal');
      if (privacyModal && privacyModal.contains(target)) return;
      // Allow interactions inside the onboarding modal itself
      const onboardingModal = document.getElementById('onboardingModal');
      if (onboardingModal && onboardingModal.contains(target)) return;
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

  // Header menu wiring (Theme Light/Dark) is now handled by themeManager.js

  // Check if onboarding should be shown on page load
  setTimeout(() => {
    if (shouldShowOnboarding()) {
      showOnboardingModal();
    }
  }, 500); // Small delay to ensure everything is loaded
});

// --- About tab loader ---
async function ensureAboutLoaded(){
  if (_aboutLoaded) return;
  _aboutLoaded = true;
  
  // Setup About subtabs
  setupAboutSubtabs();
}

// --- About subtab handler ---
function setupAboutSubtabs() {
  const subtabButtons = document.querySelectorAll('.about-subtab-btn');
  const aboutPanels = document.querySelectorAll('.about-panel');

  // Sync iframe themes on load
  syncIframeThemes();

  subtabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const targetSubtab = e.target.dataset.subtab;

      // Update button states
      subtabButtons.forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');

      // Update panel visibility
      aboutPanels.forEach(panel => panel.classList.remove('active'));

      // Show the selected panel
      const targetPanel = document.getElementById(`about-${targetSubtab}`);
      if (targetPanel) {
        targetPanel.classList.add('active');

        // Sync theme for the iframe
        const iframe = targetPanel.querySelector('iframe');
        if (iframe) {
          syncIframeTheme(iframe);
        }

        // Initialize Mermaid diagrams if showing design tab
        if (targetSubtab === 'design' && iframe && iframe.contentWindow && iframe.contentWindow.mermaid) {
          setTimeout(() => {
            iframe.contentWindow.mermaid.init();
          }, 500);
        }
      }

      // Dispatch subtab changed event for router integration
      document.dispatchEvent(new CustomEvent('subtabChanged', {
        detail: { tabId: 'tab-about', subtabId: targetSubtab }
      }));
    });
  });
}

// Sync iframe themes with parent document
function syncIframeThemes() {
  const iframes = document.querySelectorAll('.about-iframe');
  iframes.forEach(iframe => {
    iframe.addEventListener('load', () => {
      syncIframeTheme(iframe);
    });
  });
}

function syncIframeTheme(iframe) {
  try {
    const currentTheme = document.body.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light';
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'theme-change', theme: currentTheme }, '*');
      // Also try direct access
      if (iframe.contentDocument && iframe.contentDocument.body) {
        iframe.contentDocument.body.className = currentTheme;
      }
    }
  } catch (e) {
    console.debug('Could not sync iframe theme:', e);
  }
}


// ===== RPC Importer (Ethereum mainnet) =====

// Public list source (CORS-friendly). Chainlist provides a maintained JSON of EVM chains.
const CHAINLIST_JSON = "https://chainid.network/chains.json";

// Extract https RPCs for chainId 1, drop placeholders/keys, prefer public endpoints
function extractChainRPCs(json, chainId) {
  try {
    const chain = (json || []).find(c => c?.chainId === chainId);
    if (!chain || !Array.isArray(chain.rpc)) return [];
    return chain.rpc
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
  
  // Get current chain configuration
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  console.log('Current chain from chainManager:', currentChain);
  
  // Call getChainConfig as a function
  const chainConfig = typeof window.getChainConfig === 'function' ? window.getChainConfig() : { id: 1, name: 'Ethereum' };
  const chainId = chainConfig.id || (currentChain === 'BASE' ? 8453 : 1);
  const chainName = chainConfig.name || (currentChain === 'BASE' ? 'Base' : 'Ethereum');
  
  console.log(`[RPC Import] Importing RPCs for chain: ${chainName} (ID: ${chainId}), currentChain: ${currentChain}`);

  showImportStatus(`Fetching public ${chainName} RPC list…`);

  // 1) Fetch public RPCs (Chainlist). Fallback to a small known set if needed.
  let candidates = [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for chainlist

    const res = await fetch(CHAINLIST_JSON, {
      mode: "cors",
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const json = await res.json();
    candidates = extractChainRPCs(json, chainId);
  } catch (error) {
    // Silent fallback on any error including timeout
  }
  if (!candidates.length) {
    // Chain-specific fallbacks
    if (chainId === 8453) { // Base
      candidates = [
        "https://mainnet.base.org",
        "https://base.publicnode.com",
        "https://base.meowrpc.com"
      ];
      console.log(`[RPC Import] Using Base fallback RPCs: ${candidates.length} candidates`);
    } else { // Ethereum
      candidates = [
        "https://cloudflare-eth.com",
        "https://rpc.ankr.com/eth",
        "https://ethereum.publicnode.com"
      ];
      console.log(`[RPC Import] Using Ethereum fallback RPCs: ${candidates.length} candidates`);
    }
  } else {
    console.log(`[RPC Import] Found ${candidates.length} RPCs from chainlist for ${chainName}`);
  }

  // 2) Merge with user-provided list
  const userList = ta.value.split("\n").map(s => s.trim()).filter(Boolean);
  let merged = uniqueUrls([...userList, ...candidates]);

  // 3) Probe each RPC concurrently (cap concurrency) with live progress
  showImportStatus(`Pinging ${merged.length} ${chainName} RPCs for latency (this uses your local network)…`);
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
  const rpcString = sorted.join("\n");
  ta.value = rpcString;
  window.__setRpcLastValueForChain?.(currentChain, rpcString);
  try {
    // Save to chain-specific key
    if (window.chainManager) {
      window.chainManager.saveRPCEndpoints(sorted, currentChain);
      console.log(`[RPC Save] Saved ${sorted.length} RPCs to chain-specific storage for ${currentChain}`);
    } else {
      console.warn(`[RPC Save] Chain manager not available, RPCs not saved`);
    }
  } catch (e) {
    console.error('[RPC Save] Error saving RPCs:', e);
  }
  showImportStatus(`Imported ${sorted.length} ${chainName} RPCs. Fastest is ~${reachable[0].ms} ms.`, "success");

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
  
  // Get current chain
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  
  // Auto-run if:
  // 1. There's exactly one RPC (for Ethereum compatibility)
  // 2. Base chain has no RPCs (first time switching to Base)
  if (rpcList.length === 1 || (currentChain === 'BASE' && rpcList.length === 0)) {
    // Small delay to ensure page is fully loaded
    setTimeout(() => {
      console.log(`Auto-importing RPCs for ${currentChain} (RPC count: ${rpcList.length})`);
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
// Chain ID gets updated at scan start
let ETHERSCAN_CHAIN_ID = 1;  // Will be updated dynamically
let COINTOOL_MAIN = '0x0de8bf93da2f7eecb3d9169422413a9bef4ef628';  // Will be updated dynamically
let XEN_ETH = '0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8';  // Will be updated dynamically

// Update chain-specific values once chainManager is available
if (window.chainManager) {
  try {
    ETHERSCAN_CHAIN_ID = window.chainManager.getCurrentConfig().id;
    COINTOOL_MAIN = window.chainManager.getCurrentConfig().contracts.COINTOOL;
    XEN_ETH = window.chainManager.getCurrentConfig().contracts.XEN_CRYPTO;
  } catch (e) {
    console.debug('Chain manager not ready yet, using defaults');
  }
}
const selectedRows = new Set();
// This address is hard-coded in the Python remint path (Ethereum)
const REMINT_HELPER_ETH = '0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98';
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
async function sendCointoolTx({ ids, dataHex, salt, w3, action }) {
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
      const tx = await executeWithAutoRescan(
        c.methods.f(chunk, dataHex, salt).send({ from: connectedAccount }),
        `CoinTool ${action || 'claim'} (${chunk.length} VMUs)`
      );
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
  // Prefer Settings textarea; fall back to chain-specific RPCs or DEFAULT_RPC
  const ta = document.getElementById("customRPC");
  if (ta && ta.value.trim()) {
    return String(ta.value.trim()).split("\n").map(s => s.trim()).filter(Boolean);
  }

  // Use chain-specific RPCs if available
  if (window.chainManager) {
    const rpcs = window.chainManager.getRPCEndpoints();
    console.log(`[getRpcList] Using ${rpcs.length} chain-specific RPCs for ${window.chainManager.getCurrentChain()}`);
    return rpcs.length > 0 ? rpcs : [DEFAULT_RPC];
  }

  // Final fallback to DEFAULT_RPC only
  console.log(`[getRpcList] Using DEFAULT_RPC fallback`);
  return [DEFAULT_RPC];
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

  // Debug logging for chain-specific data
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  console.log(`[Rank] Fetching global rank for ${currentChain}, XEN contract: ${XEN_CRYPTO_ADDRESS}, using ${rpcs.length} RPCs:`, rpcs.slice(0, 3));

  for (const rpc of rpcs) {
    console.log(`[Rank] Trying RPC: ${rpc}`);
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
      console.log(`[Rank] RPC ${rpc} response:`, json?.result ? `Success (${json.result})` : `Error: ${json?.error?.message || 'Unknown'}`);

      if (json?.result) {
        const num = parseInt(json.result, 16);
        if (Number.isFinite(num)) {
          window.__xenGlobalRank = num;
          __crankLast = { ok:true, value:num, ts:Date.now(), err:null };
          updateCrankStatus();
          console.log(`[Rank] Successfully fetched ${currentChain} rank: ${num.toLocaleString()} from ${rpc}`);
          // re-render table estimates
          try { window.cointoolTable?.redraw?.(true); } catch {}
          // DO NOT auto-update XEN badge - only manual filter clicks and auto-apply "All" should trigger updates
          return;
        }
      }
      throw new Error(json?.error?.message || "Bad RPC response");
    } catch (e) {
      lastErr = e;
      console.log(`[Rank] RPC ${rpc} failed:`, e.message);
      // try next RPC
    }
  }

  // All RPCs failed
  console.error(`[Rank] Failed to fetch globalRank for ${currentChain} from ${rpcs.length} RPCs. Last error:`, lastErr);
  __crankLast = { ok:false, value:null, ts:Date.now(), err:lastErr?.message || "all RPCs failed" };
  updateCrankStatus();
}


// --- tiny utils ---
const no0x = (s) => String(s).replace(/^0x/i, '');
const isHex = (s) => /^0x[0-9a-fA-F]*$/.test(s);
const ensureBytes = (s) => (isHex(s) ? s : ('0x' + Buffer.from(String(s), 'utf8').toString('hex')));

// Get contract addresses from chain config
window.getChainConfig = () => {
  if (window.chainManager) {
    try {
      const config = window.chainManager.getCurrentConfig();
      // Ensure we have the full config including id and name
      if (config) return config;
    } catch (e) {
      console.debug('Chain manager not ready, using defaults');
    }
  }
  // Default Ethereum config as fallback
  return {
    id: 1,
    name: 'Ethereum',
    rpcUrls: { default: 'https://ethereum-rpc.publicnode.com' },
    contracts: {
      COINTOOL: "0x0dE8bf93dA2f7eecb3d9169422413A9bef4ef628",
      XEN_CRYPTO: '0x06450dee7fd2fb8e39061434babcfc05599a6fb8'
    },
    events: {
      COINTOOL_MINT_TOPIC: "0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37",
      REMINT_SELECTOR: '0xc2580804'
    },
    constants: {
      SALT_BYTES_TO_QUERY: '0x01'
    }
  };
};

// Initialize with defaults, will be updated when chain manager is ready
let DEFAULT_RPC = 'https://ethereum-rpc.publicnode.com';
let CONTRACT_ADDRESS = "0x0dE8bf93dA2f7eecb3d9169422413A9bef4ef628";
let EVENT_TOPIC = "0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37";
let SALT_BYTES_TO_QUERY = '0x01';
let REMINT_SELECTOR = '0xc2580804';
let XEN_CRYPTO_ADDRESS = '0x06450dee7fd2fb8e39061434babcfc05599a6fb8';

// Function to update config values when chain changes
function updateChainConfig() {
  const config = window.getChainConfig();
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';

  DEFAULT_RPC = config.rpcUrls.default;
  CONTRACT_ADDRESS = config.contracts.COINTOOL;
  EVENT_TOPIC = config.events.COINTOOL_MINT_TOPIC;
  SALT_BYTES_TO_QUERY = config.constants.SALT_BYTES_TO_QUERY;
  REMINT_SELECTOR = config.events.REMINT_SELECTOR;
  XEN_CRYPTO_ADDRESS = config.contracts.XEN_CRYPTO;
  COINTOOL_MAIN = config.contracts.COINTOOL;
  XEN_ETH = config.contracts.XEN_CRYPTO;
  ETHERSCAN_CHAIN_ID = config.id || 1;

  console.log(`[Config] Updated chain config for ${currentChain}: XEN_CRYPTO_ADDRESS=${XEN_CRYPTO_ADDRESS}, DEFAULT_RPC=${DEFAULT_RPC}`);
}

// Update config when chain manager is ready
if (window.chainManager) {
  try {
    updateChainConfig();
    // Listen for chain changes
    window.chainManager.onChainChange((newChain, config) => {
      updateChainConfig();
      
      // Update API key label to show it's multichain
      const apiKeyLabel = document.querySelector('label[for="etherscanApiKey"]');
      if (apiKeyLabel) {
        apiKeyLabel.textContent = 'Etherscan Multichain API Key';
      }
      
      const apiKeyInput = document.getElementById('etherscanApiKey');
      if (apiKeyInput) {
        apiKeyInput.placeholder = 'Your Etherscan API Key (works for all chains)';
      }
      
      // Update API help link to always point to Etherscan
      const apiHelp = document.getElementById('etherscanApiHelp');
      if (apiHelp) {
        const helpLink = apiHelp.querySelector('a');
        if (helpLink) {
          helpLink.href = 'https://etherscan.io/apidashboard';
          helpLink.textContent = 'Get a free Etherscan Multichain API key';
        }
        // Update help text to explain multichain support
        apiHelp.innerHTML = 'No key? <a href="https://etherscan.io/apidashboard" target="_blank" rel="noopener noreferrer">Get a free Etherscan Multichain API key</a> (works across 60+ chains including Base)';
      }
    });
  } catch (e) {
    console.debug('Will update config when chain manager is ready');
  }
}



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





function formatNumberForMobile(num) {
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) return num.toLocaleString();
  
  const numValue = Number(num);
  if (numValue >= 1e12) {
    return (numValue / 1e12).toFixed(2) + 'T';
  } else if (numValue >= 1e9) {
    return (numValue / 1e9).toFixed(2) + 'B';
  } else if (numValue >= 1e6) {
    return (numValue / 1e6).toFixed(2) + 'M';
  } else if (numValue >= 1e3) {
    return (numValue / 1e3).toFixed(2) + 'K';
  }
  return numValue.toLocaleString();
}

// Fetch XEN balances for all user addresses
async function fetchAllWalletBalances() {
  const balances = {};

  try {
    // Get addresses from settings
    const addressInput = document.getElementById("ethAddress")?.value?.trim();
    if (!addressInput) return balances;

    const addresses = addressInput.split("\n").map(s => s.trim()).filter(Boolean);
    if (addresses.length === 0) return balances;

    // Set up Web3 provider with RPC rotation
    let availableRpcs = [];
    let currentRpcIndex = 0;
    const currentChainId = window.chainManager?.getCurrentConfig()?.id || 1;

    // Try wallet first if connected to same chain
    if (window.web3Wallet) {
      try {
        const walletChainId = await window.web3Wallet.eth.getChainId();
        if (Number(walletChainId) === currentChainId) {
          availableRpcs.push({ provider: window.web3Wallet, name: 'wallet' });
        }
      } catch (e) {
        // Wallet not available
      }
    }

    // Add RPC endpoints as fallback options
    const rpcEndpoints = window.chainManager?.getRPCEndpoints() || [];
    rpcEndpoints.forEach((rpc, index) => {
      availableRpcs.push({
        provider: new Web3(rpc),
        name: `RPC-${index + 1}`,
        url: rpc
      });
    });

    if (availableRpcs.length === 0) return balances;

    // Get chain-specific XEN contract address
    const xenAddress = window.chainManager?.getContractAddress('XEN_CRYPTO');
    if (!xenAddress || !window.xenAbi) return balances;

    // Function to get next RPC provider
    const getNextProvider = () => {
      const rpc = availableRpcs[currentRpcIndex];
      currentRpcIndex = (currentRpcIndex + 1) % availableRpcs.length;
      return rpc;
    };

    // Function to fetch balance with RPC rotation
    const fetchBalanceWithRetry = async (address, maxRetries = availableRpcs.length) => {
      for (let retry = 0; retry < maxRetries; retry++) {
        const { provider, name, url } = getNextProvider();

        try {
          const token = new provider.eth.Contract(window.xenAbi, xenAddress);
          const balance = await token.methods.balanceOf(address).call();

          // Balance fetched successfully

          return balance;
        } catch (e) {
          const isRateLimit = e?.message?.includes('request limit') || e?.message?.includes('rate limit');

          // Silent retry - reduce console noise

          // If this was the last retry, return 0
          if (retry === maxRetries - 1) {
            return '0';
          }

          // Add extra delay for rate limits
          if (isRateLimit) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }
      return '0';
    };

    // Fetch balance for each address with rate limiting and RPC rotation
    const results = [];
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];

      // Add delay between requests to respect RPC rate limits
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 150)); // 150ms delay = ~6.7/second
      }

      const balance = await fetchBalanceWithRetry(addr);
      results.push({ address: addr.toLowerCase(), balance });
    }
    results.forEach(({ address, balance }) => {
      balances[address] = balance;
    });

    // Cache balances globally for reuse
    window._cachedWalletBalances = { ...balances };

    return balances;

  } catch (e) {
    // Silent fail - wallet balances are not critical
    return balances;
  }
}

// Set page load time for timing checks
window.pageLoadTime = Date.now();

// Import Progress Manager
class ImportProgressManager {
  constructor() {
    this.splash = null;
    this.progressBar = null;
    this.stepText = null;
    this.currentProgress = 0;
    this.isActive = false;
  }

  show() {
    this.splash = document.getElementById('importProgressSplash');
    this.progressBar = document.getElementById('importProgressBar');
    this.stepText = document.getElementById('importProgressStep');

    if (this.splash) {
      this.splash.classList.add('active');
      this.isActive = true;

      // Prevent page refresh/close
      this.enablePageProtection();

      // Disable scrolling
      document.body.style.overflow = 'hidden';
    }
  }

  hide() {
    if (this.splash && this.isActive) {
      this.splash.classList.remove('active');
      this.isActive = false;

      // Re-enable page interactions
      this.disablePageProtection();
      document.body.style.overflow = '';
    }
  }

  updateProgress(percent, stepText) {
    this.currentProgress = Math.max(0, Math.min(100, percent));

    if (this.progressBar) {
      this.progressBar.style.width = `${this.currentProgress}%`;
    }

    if (this.stepText && stepText) {
      this.stepText.textContent = stepText;
    }
  }

  enablePageProtection() {
    // Prevent beforeunload
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    // Prevent common keyboard shortcuts
    document.addEventListener('keydown', this.keydownHandler);
  }

  disablePageProtection() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    document.removeEventListener('keydown', this.keydownHandler);
  }

  beforeUnloadHandler = (e) => {
    if (this.isActive) {
      e.preventDefault();
      e.returnValue = 'Import in progress. Leaving now will cancel the process.';
      return 'Import in progress. Leaving now will cancel the process.';
    }
  };

  keydownHandler = (e) => {
    if (this.isActive) {
      // Prevent F5, Ctrl+R, Ctrl+F5
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.ctrlKey && e.key === 'F5')) {
        e.preventDefault();
        return false;
      }
      // Prevent Ctrl+W (close tab)
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        return false;
      }
    }
  };
}

// Global import progress manager
window.importProgress = new ImportProgressManager();

// Debounce XEN total updates to prevent rapid successive calls
let xenBadgeUpdateTimeout = null;

// Throttle wallet balance updates to prevent spam
let lastWalletBalanceUpdate = 0;
const WALLET_BALANCE_THROTTLE_MS = 30000; // Only update every 30 seconds

async function updateXENTotalBadge(includeWalletBalances = true) {
  // Debounce rapid calls
  if (xenBadgeUpdateTimeout) {
    clearTimeout(xenBadgeUpdateTimeout);
  }

  xenBadgeUpdateTimeout = setTimeout(async () => {
    const badge = document.getElementById("estXenTotal");
    if (!badge || typeof cointoolTable === 'undefined' || !cointoolTable) return;

    const activeData = cointoolTable.getData("active");

    // During initial load, wait for substantial data before updating
    // But allow updates immediately if filters are active (user interaction)
    const timeSinceLoad = Date.now() - window.pageLoadTime;
    const isInitialLoadPeriod = timeSinceLoad < 45000;
    // Changed threshold from 2000 to 0 to support ALL chains regardless of data size
    // This ensures XEN total displays immediately on all chains, even with just a few rows
    const hasSubstantialData = activeData.length > 0;

    // Check if any filters are currently active (check both programmatic and header filters)
    let hasActiveFilters = false;
    if (cointoolTable) {
      // Check programmatic filters
      const programmaticFilters = cointoolTable.getFilters && cointoolTable.getFilters().length > 0;

      // Check header filters by looking at DOM elements
      const statusFilter = document.querySelector('.tabulator-col[tabulator-field="Status"] .tabulator-header-filter input');
      const maturityFilter = document.querySelector('.tabulator-col[tabulator-field="Maturity_Date_Fmt"] .tabulator-header-filter input');
      const typeFilter = document.querySelector('.tabulator-col[tabulator-field="SourceType"] .tabulator-header-filter input');

      const hasStatusFilter = statusFilter && statusFilter.value && statusFilter.value.trim() !== '' && statusFilter.value.trim() !== 'All';
      const hasMaturityFilter = maturityFilter && maturityFilter.value && maturityFilter.value.trim() !== '' && maturityFilter.value.trim() !== 'All';
      const hasTypeFilter = typeFilter && typeFilter.value && typeFilter.value.trim() !== '' && typeFilter.value.trim() !== 'All';

      hasActiveFilters = programmaticFilters || hasStatusFilter || hasMaturityFilter || hasTypeFilter;
    }

    // Only block if it's initial load period, has small data, AND no active filters
    if (isInitialLoadPeriod && !hasSubstantialData && !hasActiveFilters) {
      console.log(`[XEN Badge - main_app.js] ${new Date().toISOString().slice(11,23)} Skipping update - only ${activeData.length} active rows (waiting for full load, no filters active)`);
      return;
    }

    // Build detailed filter info for logging
    let filterInfo = '(no filters)';
    if (hasActiveFilters) {
      const filterTypes = [];
      const programmaticCount = cointoolTable.getFilters ? cointoolTable.getFilters().length : 0;
      if (programmaticCount > 0) filterTypes.push(`${programmaticCount} programmatic`);

      const statusFilter = document.querySelector('.tabulator-col[tabulator-field="Status"] .tabulator-header-filter input');
      const maturityFilter = document.querySelector('.tabulator-col[tabulator-field="Maturity_Date_Fmt"] .tabulator-header-filter input');
      const typeFilter = document.querySelector('.tabulator-col[tabulator-field="SourceType"] .tabulator-header-filter input');

      if (statusFilter?.value?.trim() && statusFilter.value.trim() !== 'All') filterTypes.push(`Status: ${statusFilter.value}`);
      if (maturityFilter?.value?.trim() && maturityFilter.value.trim() !== 'All') filterTypes.push(`Maturity: ${maturityFilter.value}`);
      if (typeFilter?.value?.trim() && typeFilter.value.trim() !== 'All') filterTypes.push(`Type: ${typeFilter.value}`);

      filterInfo = `(${filterTypes.join(', ')})`;
    }
    console.log(`[XEN Badge - main_app.js] ${new Date().toISOString().slice(11,23)} Updating with ${activeData.length} active/filtered rows (all pages) ${filterInfo}, includeWalletBalances: ${typeof includeWalletBalances}`);
  let total = 0n;
  const addressBreakdown = {};

  // Process mint/stake data first
  activeData.forEach(rowData => {
    const xenValue = estimateXENForRow(rowData);
    total += BigInt(xenValue);

    // Collect breakdown by address - try multiple possible field names
    let address = rowData.Address || rowData.address || rowData.Owner || rowData.owner || rowData.User || rowData.user;

    // If still not found, check if there's an address in the ID or other fields
    if (!address && rowData.ID && rowData.ID.includes('_')) {
      // ID format might be "address_mintId"
      const parts = rowData.ID.split('_');
      if (parts[0] && parts[0].startsWith('0x')) {
        address = parts[0];
      }
    }

    // Normalize address to lowercase to avoid duplicates due to case differences
    address = address ? address.toLowerCase() : 'Unknown';

    if (!addressBreakdown[address]) {
      addressBreakdown[address] = {
        xen: 0n,
        count: 0,
        walletBalance: 0n
      };
    }
    addressBreakdown[address].xen += BigInt(xenValue);
    addressBreakdown[address].count++;
  });

  // Always try to include wallet balances from cache first
  // This ensures consistent totals even during rapid updates
  if (window._cachedWalletBalances) {
    Object.keys(addressBreakdown).forEach(address => {
      if (window._cachedWalletBalances[address]) {
        const balanceTokens = BigInt(window._cachedWalletBalances[address]) / BigInt('1000000000000000000');
        addressBreakdown[address].walletBalance = balanceTokens;
        total += balanceTokens;
      }
    });
  }

  // Only fetch fresh wallet balances if requested and throttle allows
  if (includeWalletBalances) {
    const now = Date.now();
    const shouldUpdateBalances = (now - lastWalletBalanceUpdate) > WALLET_BALANCE_THROTTLE_MS;

    if (shouldUpdateBalances) {
      try {
        lastWalletBalanceUpdate = now;
        const walletBalances = await fetchAllWalletBalances();

        // Reset totals to recalculate with fresh data
        total = 0n;
        Object.keys(addressBreakdown).forEach(address => {
          total += addressBreakdown[address].xen;
        });

        Object.entries(walletBalances).forEach(([address, balanceWei]) => {
          if (!addressBreakdown[address]) {
            addressBreakdown[address] = {
              xen: 0n,
              count: 0,
              walletBalance: 0n
            };
          }
          // Convert from wei to tokens (divide by 10^18)
          const balanceWeiBI = BigInt(balanceWei || '0');
          const balanceTokens = balanceWeiBI / BigInt('1000000000000000000'); // 10^18
          addressBreakdown[address].walletBalance = balanceTokens;
          total += balanceTokens;
        });
      } catch (e) {
        // Reduced console spam - only log major errors
        if (e.message && !e.message.includes('rate limit')) {
          console.warn('[XEN-TOTAL] Wallet balance error:', e.message);
        }
      }
    }
  }

  badge.textContent = formatNumberForMobile(total);
  renderXenUsdEstimate(total);   // ← NEW: show "($226.45)" style USD next to the total
  
  // Store breakdown data for tooltip
  badge.dataset.breakdown = JSON.stringify(
    Object.entries(addressBreakdown).map(([address, data]) => ({
      address,
      xen: data.xen.toString(),
      count: data.count,
      walletBalance: data.walletBalance.toString()
    }))
  );

    // Initialize breakdown display ONCE, then just refresh
    if (!window._xenBreakdownInitialized && typeof window._initializeXenTotalBreakdown === 'function') {
      window._initializeXenTotalBreakdown();
    } else if (window._xenTooltipRefresh) {
      window._xenTooltipRefresh();
    }
  }, 100); // 100ms debounce delay
}

// Initialize inline expandable breakdown for estXenTotal
function initializeXenTotalTooltip() {
  const toggleBtn = document.getElementById("toggleXenBreakdown");
  const compactDiv = document.getElementById("xenTotalCompact");
  const expandedDiv = document.getElementById("xenTotalExpanded");
  
  if (!toggleBtn || !compactDiv || !expandedDiv) return;
  
  let isExpanded = false;
  
  // Format address with ellipsis
  function formatAddress(address) {
    if (address === 'Unknown') return address;
    if (address.length <= 10) return address;
    // Show address in lowercase with ellipsis (addresses are normalized to lowercase)
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  // Build breakdown table
  function buildBreakdownTable() {
    const badge = document.getElementById("estXenTotal");
    if (!badge) return '';
    
    const breakdownData = badge.dataset.breakdown;
    
    if (!breakdownData) {
      tooltip.style.display = 'none';
      return;
    }
    
    try {
      const breakdown = JSON.parse(breakdownData);
      if (!breakdown || breakdown.length === 0) {
        tooltip.style.display = 'none';
        return;
      }
      
      // Sort by XEN amount descending
      breakdown.sort((a, b) => {
        const xenA = BigInt(a.xen);
        const xenB = BigInt(b.xen);
        return xenB > xenA ? 1 : xenB < xenA ? -1 : 0;
      });
      
      // Build tooltip content as table
      let html = '<table style="border-collapse: collapse; width: 100%;">';
      html += '<thead><tr>';
      html += '<th style="text-align: left; padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.2);">Address</th>';
      html += '<th style="text-align: right; padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.2);">XEN</th>';
      html += '<th style="text-align: right; padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.2);">Value</th>';
      html += '</tr></thead><tbody>';
      
      let totalXen = 0n;
      let totalUsd = 0;
      
      breakdown.forEach(item => {
        const xenAmount = BigInt(item.xen);
        totalXen += xenAmount;
        
        // Format XEN with max 2 decimals for cleaner display
        const xenTokens = Number(xenAmount);
        let xenFormatted;
        if (xenTokens >= 1000000) {
          xenFormatted = (xenTokens / 1000000).toFixed(2) + 'M';
        } else if (xenTokens >= 1000) {
          xenFormatted = (xenTokens / 1000).toFixed(2) + 'K';
        } else {
          xenFormatted = xenTokens.toFixed(2);
        }
        
        // Calculate USD value the same way as renderXenUsdEstimate does
        const usdValue = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0) 
          ? xenTokens * xenUsdPrice 
          : 0;
        totalUsd += usdValue;
        
        // Format USD with exactly 2 decimals
        const usdFormatted = usdValue > 0 
          ? usdValue.toLocaleString(undefined, {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })
          : '-';
        
        html += '<tr>';
        html += `<td style="padding: 2px 8px; color: #9ca3af;">${formatAddress(item.address)}</td>`;
        html += `<td style="padding: 2px 8px; text-align: right; color: #e5e7eb;">${xenFormatted}</td>`;
        html += `<td style="padding: 2px 8px; text-align: right;" class="usd-value">${usdFormatted}</td>`;
        html += '</tr>';
      });
      
      // Add total row
      html += '<tr style="border-top: 1px solid rgba(255,255,255,0.2);">';
      html += '<td style="padding: 4px 8px; font-weight: bold;">Total</td>';
      
      // Format total XEN with max 2 decimals
      const totalXenNum = Number(totalXen);
      let totalXenFormatted;
      if (totalXenNum >= 1000000) {
        totalXenFormatted = (totalXenNum / 1000000).toFixed(2) + 'M';
      } else if (totalXenNum >= 1000) {
        totalXenFormatted = (totalXenNum / 1000).toFixed(2) + 'K';
      } else {
        totalXenFormatted = totalXenNum.toFixed(2);
      }
      
      // Format total USD with exactly 2 decimals
      const totalUsdFormatted = totalUsd > 0 
        ? totalUsd.toLocaleString(undefined, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        : '-';
      
      html += `<td style="padding: 4px 8px; text-align: right; font-weight: bold;">${totalXenFormatted}</td>`;
      html += `<td style="padding: 4px 8px; text-align: right; font-weight: bold;" class="usd-value">${totalUsdFormatted}</td>`;
      html += '</tr>';
      
      html += '</tbody></table>';
      
      tooltip.innerHTML = html;
      
      // Position tooltip
      const rect = isModalMode ? toggleBtn.getBoundingClientRect() : badge.getBoundingClientRect();
      const tooltipWidth = 400;
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      let top = rect.bottom + 5;
      
      // Adjust if would go off screen
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }
      
      // If modal mode, ensure it's more visible
      if (isModalMode) {
        top = rect.bottom + 10;
      }
      
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      tooltip.style.display = 'block';
      
      // Apply theme-specific styling
      const isDark = document.body.classList.contains('dark-mode');
      
      if (!isDark) {
        tooltip.style.background = 'rgba(255, 255, 255, 0.98)';
        tooltip.style.border = '1px solid #e5e7eb';
        tooltip.style.color = '#111827';
        tooltip.querySelectorAll('td').forEach(td => {
          if (td.style.color === '#9ca3af') td.style.color = '#6b7280';
          if (td.style.color === '#e5e7eb') td.style.color = '#111827';
          if (td.style.color === '#86efac') td.style.color = '#085903';
        });
      }
      
    } catch (e) {
      console.error('Error showing XEN total tooltip:', e);
      tooltip.style.display = 'none';
    }
  }
  
  // Hide tooltip
  function hideTooltip() {
    if (!isModalMode && tooltipDiv) {
      tooltipDiv.style.display = 'none';
    }
  }
  
  // Refresh tooltip if visible
  function refreshTooltip() {
    if (tooltipDiv && tooltipDiv.style.display === 'block') {
      showTooltip({ target: badge });
    }
  }
  
  // Toggle modal mode
  function toggleModal() {
    isModalMode = !isModalMode;
    
    if (isModalMode) {
      // Show as modal
      toggleBtn.textContent = '−';
      toggleBtn.classList.add('active');
      showTooltip({ target: badge });
      tooltipDiv.style.pointerEvents = 'auto';
    } else {
      // Hide modal
      toggleBtn.textContent = '+';
      toggleBtn.classList.remove('active');
      if (tooltipDiv) {
        tooltipDiv.style.display = 'none';
        tooltipDiv.style.pointerEvents = 'none';
      }
    }
  }
  
  // Note: _xenTooltipRefresh is now handled by xen-breakdown.js
  
  // Add hover listeners (only work when not in modal mode)
  badge.style.cursor = 'help';
  badge.addEventListener('mouseenter', (e) => {
    if (!isModalMode) showTooltip(e);
  });
  badge.addEventListener('mouseleave', () => {
    if (!isModalMode) hideTooltip();
  });
  
  // Toggle button listener
  toggleBtn.addEventListener('click', toggleModal);
  
  // Hide on scroll or window resize only if not in modal mode
  window.addEventListener('scroll', () => {
    if (!isModalMode) hideTooltip();
  });
  window.addEventListener('resize', () => {
    if (!isModalMode) hideTooltip();
  });
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
    case 1:   return '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" style="vertical-align: middle;"><path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/></svg>';
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

// Format very small prices with subscript notation (e.g., $0.0₁₀4410)
function formatTinyPrice(price) {
  if (!Number.isFinite(price)) return 'Unavailable';
  
  // Convert to string with enough precision
  const priceStr = price.toFixed(15);
  
  // Find the position of first non-zero digit after decimal
  const match = priceStr.match(/^0\.0*[1-9]/);
  if (!match) {
    // Price is not tiny, just format normally
    return `$${price.toFixed(10)}`;
  }
  
  // Count the zeros after decimal point
  const zeros = (match[0].match(/0/g) || []).length - 1; // -1 for the initial 0 before decimal
  
  if (zeros < 4) {
    // Not that many zeros, show normally
    return `$${price.toFixed(10)}`;
  }
  
  // Get the significant digits after the zeros
  const significantPart = priceStr.substring(match[0].length, match[0].length + 4);
  
  // Create HTML with subscript for zero count
  return `$0.0<sub>${zeros}</sub>${significantPart}`;
}

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
    ? formatTinyPrice(xenPriceLast.price)
    : 'Unavailable';
  // Use innerHTML to render the subscript
  el.innerHTML = `Last refresh (${xenPriceLast.source || '—'}): ${priceText} at ${new Date(xenPriceLast.ts).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}`;
}

// Primary: Dexscreener token/pair endpoint
async function fetchFromDexscreener(tokenAddress){
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  let url;
  let data;
  
  if (currentChain === 'BASE') {
    // For Base CBXEN, use the pairs endpoint
    url = `https://api.dexscreener.com/latest/dex/pairs/base/${tokenAddress}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Dexscreener HTTP ${res.status}`);
    data = await res.json();
    
    // For pairs endpoint, check if we got a single pair or array
    const pair = data?.pair || (Array.isArray(data?.pairs) && data.pairs[0]);
    if (!pair) throw new Error('Dexscreener: no pair data for Base');
    
    const price = parseFloat(pair?.priceUsd);
    if (!Number.isFinite(price)) throw new Error('Dexscreener: no priceUsd for Base');
    
    const dexName = pair?.dexId || 'Aerodrome';
    return { price, source: `${dexName} Dexscreener` };
  } else {
    // For Ethereum XEN, use the tokens endpoint
    url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Dexscreener HTTP ${res.status}`);
    data = await res.json();
    
    // Dexscreener returns an array of pairs for the token — pick an Ethereum one if present
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    if (!pairs.length) throw new Error('Dexscreener: no pairs');
    
    const preferred = pairs.find(p => (p.chainId || p.chain || '').toLowerCase().includes('eth')) || pairs[0];
    const price = parseFloat(preferred?.priceUsd ?? preferred?.price?.usd ?? preferred?.priceUsd);
    if (!Number.isFinite(price)) throw new Error('Dexscreener: no priceUsd');
    
    const dexName = preferred?.dexId || preferred?.url || 'Dex';
    return { price, source: `${dexName} Dexscreener` };
  }
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
    // Get the appropriate token address based on current chain
    const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
    let tokenAddress;

    // Get the XEN contract address for the current chain
    if (window.chainManager) {
      const config = window.chainManager.getCurrentConfig();
      if (config && config.contracts && config.contracts.XEN_CRYPTO) {
        tokenAddress = config.contracts.XEN_CRYPTO;
        console.log(`[XEN Price] Fetching price for ${currentChain} using token address: ${tokenAddress}`);
      } else {
        // Fallback to Ethereum XEN if config not available
        tokenAddress = XEN_ETH;
        console.warn(`[XEN Price] No config for ${currentChain}, falling back to Ethereum XEN: ${tokenAddress}`);
      }
    } else {
      // Fallback to Ethereum XEN if chainManager not available
      tokenAddress = XEN_ETH;
      console.warn(`[XEN Price] ChainManager not available, falling back to Ethereum XEN: ${tokenAddress}`);
    }

    const primary = await fetchFromDexscreener(tokenAddress);
    xenUsdPrice  = primary.price;
    xenPriceLast = { ok: true, price: xenUsdPrice, ts: Date.now(), source: primary.source };
    console.log(`[XEN Price] Successfully fetched ${currentChain} price: $${xenUsdPrice} from ${primary.source}`);
  } catch (e1) {
    console.warn(`[XEN Price] Dexscreener failed: ${e1.message}, falling back to CoinGecko`);
    try {
      const fb = await fetchFromCoinGecko();
      xenUsdPrice  = fb.price;
      xenPriceLast = { ok: true, price: xenUsdPrice, ts: Date.now(), source: fb.source };
      console.log(`[XEN Price] Successfully fetched price from CoinGecko: $${xenUsdPrice}`);
    } catch (e2) {
      console.error(`[XEN Price] Both Dexscreener and CoinGecko failed. Dexscreener: ${e1.message}, CoinGecko: ${e2.message}`);
      xenUsdPrice  = null;
      xenPriceLast = { ok: false, price: null, ts: Date.now(), source: 'Dexscreener/CoinGecko' };
    }
  }
  // Refresh the breakdown view to update USD values with new price
  // Don't call updateXENTotalBadge as it would recalculate without wallet balances
  if (window._xenTooltipRefresh) {
    window._xenTooltipRefresh();
  }
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
  // Always format with exactly 2 decimal places for estXenUsd display
  const formattedUsd = usd.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  el.textContent = `(${formattedUsd})`;
}


async function updateNetworkBadge(){
  const el = document.getElementById('networkName');
  if (!el) return;
  
  // Check if wallet is connected by looking at the connect button text
  const connectBtn = document.getElementById('connectWalletText');
  const isConnected = connectBtn && connectBtn.textContent !== 'Connect Wallet';
  
  if (isConnected && window.ethereum) {
    try {
      const walletChainId = await window.ethereum?.request?.({ method: 'eth_chainId' });
      const appChainId = window.chainManager?.getCurrentConfig()?.id || 1;
      const walletChainIdDec = parseInt(walletChainId, 16);
      
      // Show badge if wallet is on a different chain than the app
      if (walletChainIdDec !== appChainId) {
        const networkName = chainIdToName(walletChainId);
        // Use innerHTML for Ethereum icon, textContent for others
        if (networkName.includes('<svg')) {
          el.innerHTML = networkName;
          el.title = `Wallet is on different chain than app (${window.chainManager?.getCurrentConfig()?.name})`;
        } else {
          el.textContent = networkName;
          el.title = `Wallet: ${networkName}, App: ${window.chainManager?.getCurrentConfig()?.name}`;
        }
        el.style.display = '';
        el.style.color = '#ff9800'; // Orange to indicate mismatch
      } else {
        // Wallet and app are on same chain - hide badge
        el.style.display = 'none';
        el.title = '';
      }
    } catch {
      el.style.display = 'none';
      el.title = '';
    }
  } else {
    // Hide when not connected
    el.style.display = 'none';
    el.title = '';
  }
}

function es2url(queryString) {
  // queryString should NOT start with "?" (just "module=...&action=...&...")
  // Always use Etherscan V2 multichain API for all chains
  const baseUrl = 'https://api.etherscan.io/v2/api';
  const chainId = window.chainManager?.getCurrentConfig()?.id || ETHERSCAN_CHAIN_ID || 1;
  
  return `${baseUrl}?chainid=${chainId}&${queryString}`;
}

function ensureBulkBar(){
  let bar = document.getElementById('bulkBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bulkBar';
    // Anchor the bulk bar after the chart and before the table
    const chartWrap = document.getElementById('vmu-chart-wrap');
    if (chartWrap && typeof chartWrap.insertAdjacentElement === 'function') {
      chartWrap.insertAdjacentElement('afterend', bar);
    } else {
      // Fallback to inserting before the table if chart isn't found
      const tableEl = document.getElementById('cointool-table');
      if (tableEl && tableEl.parentNode) {
        tableEl.parentNode.insertBefore(bar, tableEl);
      }
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
    const expectedChainId = window.chainManager?.getCurrentConfig()?.id || 1;
    const currentChainName = window.chainManager?.getCurrentConfig()?.name || 'Ethereum';
    
    if (parseInt(chainId, 16) !== expectedChainId) {
      alert(`Please switch your wallet to ${currentChainName} (chain ID ${expectedChainId}) to claim/remint.`);
      return;
    }
  } catch {
    const currentChainName = window.chainManager?.getCurrentConfig()?.name || 'Ethereum';
    alert(`Could not read current network. Please switch to ${currentChainName}.`);
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
      // Get chain-specific XENFT Torrent contract address
      const TORRENT_ADDR = window.chainManager?.getContractAddress('XENFT_TORRENT') ||
        (typeof XENFT_TORRENT === 'string' && XENFT_TORRENT) ||
        (window.xenft && window.xenft.CONTRACT_ADDRESS) ||
        '0x0a252663DBCc0b073063D6420a40319e438Cfa59';

      const tor = new web3Wallet.eth.Contract(window.xenftAbi, TORRENT_ADDR);
      for (const r of xfRows) {
        const tokenId = Number(r.Xenft_id || r.Mint_id_Start || r.tokenId);
        if (!Number.isFinite(tokenId)) { alert("Bad XENFT tokenId in selection."); continue; }
        try {
          const tx = await executeWithAutoRescan(
            tor.methods.bulkClaimMintReward(tokenId, connectedAccount).send({ from: connectedAccount }),
            'XENFT bulk claim',
            tokenId
          );
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
    let term;
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
          const tx = await executeWithAutoRescan(
            c.methods.f(chunk, dataHex, grp.salt).send({ from: connectedAccount }),
            `CoinTool ${mode} (${chunk.length} VMUs)`
          );
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
  // Get chain-specific REMINT_HELPER address
  const remintHelper = window.chainManager?.getContractAddress('REMINT_HELPER') || REMINT_HELPER_ETH;
  const helperNo = no0x(remintHelper);
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
    // Get chain-specific database name
    const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
    const chainPrefix = getChainPrefix(currentChain);
    const dbName = `${chainPrefix}_DB_Cointool`;
    
    // bump to v3 to add actionsCache
    const request = indexedDB.open(dbName, 3);

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
// Declare at top level to avoid initialization issues
let vmuChart = null;
let _vmuChartReady = false;
let _vmuChartMetric = 'vmus';
let _vmuChartInitPending = false; // if true, (re)init when Dashboard becomes visible

// Make globally accessible immediately
window.vmuChart = vmuChart;

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

// Format XEN numbers with K, M, B, T suffixes
function formatXenShort(num) {
  if (!Number.isFinite(num) || num === 0) return '0';
  if (num < 1000) return num.toFixed(2);
  
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  let index = 0;
  let value = num;
  
  while (value >= 1000 && index < suffixes.length - 1) {
    value /= 1000;
    index++;
  }
  
  return value.toFixed(2) + suffixes[index];
}

// Get aggregated data with both VMUs and XEN for tooltip
function _getTooltipDataByDateAndType(rows, dateKey) {
  const types = (window.innerWidth <= 768) ? ['CT', 'XNFT', 'S.XNFT', 'Stk'] : ['Cointool', 'XENFT', 'Stake XENFT', 'Stake'];
  const typeData = {};
  
  // Initialize type data
  types.forEach(type => {
    typeData[type] = { vmus: 0, xen: 0 };
  });
  
  for (const r of rows) {
    // Match the date logic from the chart functions
    let rowDateKey = r?.maturityDateOnly;
    if (!rowDateKey) {
      const t = Number(r?.Maturity_Timestamp || 0);
      if (Number.isFinite(t) && t > 0) {
        rowDateKey = getLocalDateString(new Date(t * 1000));
      } else if (typeof window.rowToLocalKey === 'function') {
        rowDateKey = window.rowToLocalKey(r);
      } else {
        continue;
      }
    }
    
    if (rowDateKey !== dateKey) continue;
    
    // Get VMUs and XEN
    const vmu = Number(r?.VMUs || 0);
    const xen = Number(estimateXENForRow(r)) || 0;
    
    if (!Number.isFinite(vmu) || vmu <= 0) continue;
    
    let sourceType = String(r?.SourceType || 'Cointool');
    // Map to mobile abbreviations
    if (window.innerWidth <= 768) {
      if (sourceType === 'Cointool') sourceType = 'CT';
      else if (sourceType === 'XENFT') sourceType = 'XNFT';
      else if (sourceType === 'Stake XENFT') sourceType = 'S.XNFT';
      else if (sourceType === 'Stake') sourceType = 'Stk';
    }
    
    if (typeData[sourceType]) {
      typeData[sourceType].vmus += vmu;
      typeData[sourceType].xen += xen;
    }
  }
  
  return typeData;
}

function _groupVMUsByDateAndType(rows) {
  const typeMap = {};
  const types = (window.innerWidth <= 768) ? ['CT', 'XNFT', 'S.XNFT', 'Stk'] : ['Cointool', 'XENFT', 'Stake XENFT', 'Stake'];
  
  for (const r of rows) {
    const vmu = Number(r?.VMUs || 0);
    if (!Number.isFinite(vmu) || vmu <= 0) continue;
    
    let dateStr = r?.maturityDateOnly;
    if (!dateStr) {
      const t = Number(r?.Maturity_Timestamp || 0);
      if (Number.isFinite(t) && t > 0) {
        dateStr = getLocalDateString(new Date(t * 1000));
      } else {
        continue;
      }
    }
    
    let sourceType = String(r?.SourceType || 'Cointool');
    // Map to mobile abbreviations
    if (window.innerWidth <= 768) {
      if (sourceType === 'Cointool') sourceType = 'CT';
      else if (sourceType === 'XENFT') sourceType = 'XNFT';
      else if (sourceType === 'Stake XENFT') sourceType = 'S.XNFT';
      else if (sourceType === 'Stake') sourceType = 'Stk';
    }
    
    if (!typeMap[dateStr]) {
      typeMap[dateStr] = {};
      types.forEach(type => typeMap[dateStr][type] = 0);
    }
    
    typeMap[dateStr][sourceType] = (typeMap[dateStr][sourceType] || 0) + vmu;
  }
  
  const dates = Object.keys(typeMap).sort();
  const seriesData = types.map(type => ({
    name: type,
    data: dates.map(d => typeMap[d] ? (typeMap[d][type] || 0) : 0)
  }));
  
  console.debug('[VMU-CHART] _groupVMUsByDateAndType days=', dates.length, 'types=', types.length);
  return { dates, seriesData };
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
  // Check if vmuChart exists or needs initialization
  if (typeof vmuChart === 'undefined' || (!vmuChart && !window.vmuChart)) {
    if (window.echarts) {
      // lazy init if needed
      initVmuChartSection();
    } else {
      return;  // ECharts not loaded yet
    }
  }
  if (!vmuChart && !window.vmuChart) return;
  const node = document.getElementById('vmuChart');
  const w = node ? node.offsetWidth : 0;
  const h = node ? node.offsetHeight : 0;
  console.debug('[VMU-CHART] updateVmuChart size:', {w,h});
  if (!(node && w > 0 && h > 0)) { 
    console.debug('[VMU-CHART] skip update due to zero size, will retry in 100ms'); 
    // If container has no size yet, retry after a short delay
    setTimeout(() => {
      const retryW = node ? node.offsetWidth : 0;
      const retryH = node ? node.offsetHeight : 0;
      if (retryW > 0 && retryH > 0) {
        console.debug('[VMU-CHART] retry successful, size:', {w: retryW, h: retryH});
        updateVmuChart();
      }
    }, 100);
    return; 
  }
  const rows = _collectActiveRows();
  let dates, seriesData;
  if (_vmuChartMetric === 'usd') {
    const out = _groupXenUsdByDateAndType(rows);
    dates = out.dates; seriesData = out.seriesData;
  } else {
    const out = _groupVMUsByDateAndType(rows);
    dates = out.dates; seriesData = out.seriesData;
  }
  console.debug('[VMU-CHART] metric=', _vmuChartMetric, 'points=', dates.length, 'series=', seriesData.length);
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
  
  // Create stacked series with theme-dependent colors
  const isDark = document.body.classList.contains('dark-mode');
  
  let typeColors;
  if (isDark) {
    typeColors = {
      'Cointool': '#60a5fa',    // soft blue
      'XENFT': '#f472b6',       // pastel pink
      'Stake XENFT': '#fbbf24', // warm yellow
      'Stake': '#34d399',       // mint green
      // Mobile abbreviations
      'CT': '#60a5fa',          // soft blue (same as Cointool)
      'XNFT': '#f472b6',        // pastel pink (same as XENFT)
      'S.XNFT': '#fbbf24',      // warm yellow (same as Stake XENFT)
      'Stk': '#34d399'          // mint green (same as Stake)
    };
  } else {
    // Light theme
    typeColors = {
      'Cointool': '#2563eb',    // darker blue
      'XENFT': '#dc2626',       // darker red
      'Stake XENFT': '#ea580c', // darker orange
      'Stake': '#16a34a',       // darker green
      // Mobile abbreviations
      'CT': '#2563eb',          // darker blue (same as Cointool)
      'XNFT': '#dc2626',        // darker red (same as XENFT)
      'S.XNFT': '#ea580c',      // darker orange (same as Stake XENFT)
      'Stk': '#16a34a'          // darker green (same as Stake)
    };
  }
  
  const series = seriesData.map(typeData => ({
    name: typeData.name,
    type: currentSeriesType,
    stack: 'total',
    data: typeData.data,
    itemStyle: { color: typeColors[typeData.name] || '#6b7280' }
  }));
  
  const opts = {
    title: { text: (_vmuChartMetric === 'usd' ? 'Value by Type' : 'VMUs by Type'), subtext: empty ? 'No data for current view' : '', top: -5 },
    xAxis: { data: dates, axisLabel: { formatter: function(value){ return _fmtAxisDateLabel(value); } } },
    series: series,
    yAxis: { type: 'value', name: (_vmuChartMetric === 'usd' ? 'USD' : 'VMUs'), nameGap: 12 },
    legend: {
      data: (window.innerWidth <= 768) ? ['CT', 'XNFT', 'S.XNFT', 'Stk'] : ['Cointool', 'XENFT', 'Stake XENFT', 'Stake'],
      top: 10,
      textStyle: {
        fontSize: (window.innerWidth <= 768) ? 12 : 14
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: function(params){
        try {
          var dateKey = (params && params[0] && (params[0].axisValue || params[0].name)) || '';
          var d = new Date(dateKey + 'T00:00:00');
          var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          var fmtDate = isNaN(d.getTime())
            ? dateKey
            : (weekdays[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear());
          
          var result = '<strong>Date: ' + fmtDate + '</strong><br/>';
          
          // Get detailed data for this date
          var activeRows = _collectActiveRows();
          var typeData = _getTooltipDataByDateAndType(activeRows, dateKey);
          
          var totalUsd = 0;
          var totalVmus = 0;
          var totalXen = 0;
          
          // Start table
          result += '<table style="border-collapse: collapse; width: 100%; margin-top: 8px;">';
          
          // Show breakdown by type with VMUs and XEN
          for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param.value > 0) {
              var seriesTypeData = typeData[param.seriesName];
              var vmus = seriesTypeData ? seriesTypeData.vmus : 0;
              var xen = seriesTypeData ? seriesTypeData.xen : 0;
              var xenShort = formatXenShort(xen);
              
              totalUsd += param.value;
              totalVmus += vmus;
              totalXen += xen;
              
              result += '<tr>';
              result += '<td style="padding: 2px 8px 2px 0; vertical-align: top;">' + param.marker + '<strong>' + param.seriesName + ':</strong></td>';
              
              if (_vmuChartMetric === 'usd') {
                // $value mode: $3,778.92, Xen: x, VMUs: y
                result += '<td style="padding: 2px 8px 2px 0; text-align: right;">' + formatUSD(param.value) + '</td>';
                result += '<td style="padding: 2px 8px 2px 0; text-align: right;">Xen: ' + xenShort + '</td>';
                result += '<td style="padding: 2px 0 2px 0; text-align: right;">VMUs: ' + Number(vmus).toLocaleString() + '</td>';
              } else {
                // VMU mode: VMUs: y, Xen: x, $3,778.92
                var usdValue = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0) ? xen * xenUsdPrice : 0;
                result += '<td style="padding: 2px 8px 2px 0; text-align: right;">VMUs: ' + Number(vmus).toLocaleString() + '</td>';
                result += '<td style="padding: 2px 8px 2px 0; text-align: right;">Xen: ' + xenShort + '</td>';
                result += '<td style="padding: 2px 0 2px 0; text-align: right;">' + formatUSD(usdValue) + '</td>';
              }
              result += '</tr>';
            }
          }
          
          // Total row with separator
          result += '<tr><td colspan="4" style="border-top: 1px solid rgba(255,255,255,0.2); padding: 4px 0 2px 0;"></td></tr>';
          result += '<tr>';
          result += '<td style="padding: 2px 8px 2px 0; vertical-align: top;"><strong>Total:</strong></td>';
          
          var totalXenShort = formatXenShort(totalXen);
          if (_vmuChartMetric === 'usd') {
            // $value mode: Total: $6,690.57, Xen: x, VMUs: y
            result += '<td style="padding: 2px 8px 2px 0; text-align: right;"><strong>' + formatUSD(totalUsd) + '</strong></td>';
            result += '<td style="padding: 2px 8px 2px 0; text-align: right;"><strong>Xen: ' + totalXenShort + '</strong></td>';
            result += '<td style="padding: 2px 0 2px 0; text-align: right;"><strong>VMUs: ' + Number(totalVmus).toLocaleString() + '</strong></td>';
          } else {
            // VMU mode: Total: VMUs: y, Xen: x, $6,690.57
            var totalUsdFromXen = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0) ? totalXen * xenUsdPrice : 0;
            result += '<td style="padding: 2px 8px 2px 0; text-align: right;"><strong>VMUs: ' + Number(totalVmus).toLocaleString() + '</strong></td>';
            result += '<td style="padding: 2px 8px 2px 0; text-align: right;"><strong>Xen: ' + totalXenShort + '</strong></td>';
            result += '<td style="padding: 2px 0 2px 0; text-align: right;"><strong>' + formatUSD(totalUsdFromXen) + '</strong></td>';
          }
          result += '</tr>';
          result += '</table>';
          
          return result;
        } catch (e) {
          return 'Date: ' + (params && params[0] && params[0].axisValue) + '<br/>Error loading details';
        }
      }
    }
  };

  // Apply light/dark theming to chart, including metric-sensitive colors
  try {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e5e7eb' : '#111827';
    const axisColor = isDark ? '#9aa4b2' : '#6b7280';
    const splitColor = isDark ? '#2a3341' : '#e5e7eb';
    // Subtle dark gradient background
    if (isDark && window.echarts && window.echarts.graphic) {
      const topC = '#0b1220';
      const botC = '#0a0f1a';
      opts.backgroundColor = new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: topC },
        { offset: 1, color: botC },
      ]);
    } else {
      opts.backgroundColor = isDark ? '#111827' : '#ffffff';
    }
    opts.textStyle = Object.assign({}, opts.textStyle || {}, {
      color: textColor,
      fontFamily: (opts.textStyle && opts.textStyle.fontFamily) || undefined,
    });
    opts.title.textStyle = Object.assign({}, opts.title.textStyle || {}, {
      color: textColor,
      fontFamily: (opts.title.textStyle && opts.title.textStyle.fontFamily) || undefined,
    });
    opts.legend = Object.assign({}, opts.legend || {}, {
      textStyle: {
        color: textColor,
        fontFamily: undefined
      }
    });
    opts.xAxis = Object.assign({}, opts.xAxis, {
      axisLabel: Object.assign({}, opts.xAxis.axisLabel || {}, { color: axisColor, fontFamily: undefined }),
      axisLine: { lineStyle: { color: axisColor } },
      splitLine: { show: true, lineStyle: { color: splitColor } }
    });
    opts.yAxis = Object.assign({}, opts.yAxis, {
      axisLabel: Object.assign({}, (opts.yAxis && opts.yAxis.axisLabel) || {}, { color: axisColor, fontFamily: undefined }),
      axisLine: { lineStyle: { color: axisColor } },
      splitLine: { show: true, lineStyle: { color: splitColor } }
    });

    // Tooltip styling for dark mode
    if (isDark && opts.tooltip) {
      opts.tooltip.backgroundColor = 'rgba(47, 54, 66, 0.96)';
      opts.tooltip.borderColor = '#4b5563';
      opts.tooltip.textStyle = { color: textColor };
      opts.tooltip.borderWidth = 1;
      opts.tooltip.borderRadius = 10;
      opts.tooltip.extraCssText = 'box-shadow: 0 8px 20px rgba(0,0,0,.45); padding:8px 10px;';
      opts.axisPointer = {
        lineStyle: { color: axisColor, type: 'dashed', width: 1 }
      };
    }

    // Series colors by theme and metric
    const metric = (_vmuChartMetric === 'usd') ? 'usd' : 'vmus';
    if (isDark) {
      const series = { type: currentSeriesType, data: values };
      if (currentSeriesType === 'bar') {
        // VMUs keep existing; USD uses distinct, theme-appropriate color
        const barColor = metric === 'vmus' ? '#e8cd0f' : '#86efac';
        series.itemStyle = { color: barColor };
      } else {
        const lineColor = metric === 'vmus' ? '#e8cd0f' : '#86efac';
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
    // Ensure chart properly sizes after option update
    setTimeout(() => {
      try {
        if (vmuChart) {
          vmuChart.resize();
          console.debug('[VMU-CHART] post-update resize completed');
        }
      } catch(e) {
        console.warn('[VMU-CHART] post-update resize failed', e);
      }
    }, 50);
  } catch(e) {
    console.warn('[VMU-CHART] setOption(data) failed', e);
  }
}

// Make updateVmuChart globally available
window.updateVmuChart = updateVmuChart;

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
      window.vmuChart = vmuChart;  // Store globally too
      console.debug('[VMU-CHART] echarts.init OK');
    } catch(e) {
      console.warn('[VMU-CHART] echarts.init failed', e);
    }
    const options = {
      title: { text: 'VMUs', left: 'center', top: 6, textStyle: { fontSize: 12 } },
      tooltip: { trigger: 'axis' },
      toolbox: {
        right: 10,
        itemSize: 18,  // Larger touch target for mobile
        itemGap: 10,   // More spacing between buttons
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
              const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
              
              if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                // Use current page background for fullscreen backdrop
                try { el.style.backgroundColor = getComputedStyle(document.body).backgroundColor; } catch {}
                
                // iOS Safari uses webkit prefix
                if (isIOS && el.webkitRequestFullscreen) {
                  el.webkitRequestFullscreen();
                } else if (el.requestFullscreen) {
                  el.requestFullscreen();
                } else if (el.webkitRequestFullscreen) {
                  el.webkitRequestFullscreen();
                } else if (el.mozRequestFullScreen) {
                  el.mozRequestFullScreen();
                } else if (el.msRequestFullscreen) {
                  el.msRequestFullscreen();
                }
              } else {
                if (document.exitFullscreen) {
                  document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                  document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                  document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                  document.msExitFullscreen();
                }
              }
              // Clean up background on exit
              const tidy = () => {
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                  try { el.style.backgroundColor = ''; } catch {}
                  try { vmuChart && vmuChart.resize(); } catch {}
                  document.removeEventListener('fullscreenchange', tidy);
                  document.removeEventListener('webkitfullscreenchange', tidy);
                }
              };
              document.addEventListener('fullscreenchange', tidy);
              document.addEventListener('webkitfullscreenchange', tidy);
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

function _groupXenUsdByDateAndType(rows) {
  const price = (typeof xenUsdPrice === 'number' && xenUsdPrice > 0) ? xenUsdPrice : null;
  const typeMap = {};
  const types = (window.innerWidth <= 768) ? ['CT', 'XNFT', 'S.XNFT', 'Stk'] : ['Cointool', 'XENFT', 'Stake XENFT', 'Stake'];
  
  for (const r of rows) {
    const key = (typeof window.rowToLocalKey === 'function') ? window.rowToLocalKey(r) : (function(){
      const t = Number(r?.Maturity_Timestamp || 0);
      return Number.isFinite(t) && t > 0 ? getLocalDateString(new Date(t * 1000)) : (r?.maturityDateOnly || '');
    })();
    if (!key) continue;
    
    const tokens = Number(estimateXENForRow(r)) || 0;
    if (!Number.isFinite(tokens) || tokens <= 0) continue;
    
    let sourceType = String(r?.SourceType || 'Cointool');
    // Map to mobile abbreviations
    if (window.innerWidth <= 768) {
      if (sourceType === 'Cointool') sourceType = 'CT';
      else if (sourceType === 'XENFT') sourceType = 'XNFT';
      else if (sourceType === 'Stake XENFT') sourceType = 'S.XNFT';
      else if (sourceType === 'Stake') sourceType = 'Stk';
    }
    const usdValue = price ? tokens * price : tokens;
    
    if (!typeMap[key]) {
      typeMap[key] = {};
      types.forEach(type => typeMap[key][type] = 0);
    }
    
    typeMap[key][sourceType] = (typeMap[key][sourceType] || 0) + usdValue;
  }
  
  const dates = Object.keys(typeMap).sort();
  const seriesData = types.map(type => ({
    name: type,
    data: dates.map(d => typeMap[d] ? (typeMap[d][type] || 0) : 0)
  }));
  
  console.debug('[VMU-CHART] _groupXenUsdByDateAndType days=', dates.length, 'price=', price, 'types=', types.length);
  return { dates, seriesData };
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
  const sel = document.getElementById("resetDbSelect");
  const choice = (sel && sel.value) ? sel.value : "all-with-storage";

  // Get current chain info for better messaging
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
  const chainName = currentChain === 'ETHEREUM' ? 'Ethereum' : 'Base';

  // Get user-friendly description from the dropdown
  const selectedOption = sel.options[sel.selectedIndex];
  const optionText = selectedOption?.textContent || 'selected data';
  const optionDescription = selectedOption?.title || 'No description available';

  // Enhanced confirmation message
  const confirmed = confirm(
    `🗑️ DELETE CONFIRMATION\n\n` +
    `You are about to delete: ${optionText}\n\n` +
    `Description: ${optionDescription}\n\n` +
    `⚠️ This action cannot be undone!\n\n` +
    `Are you sure you want to continue?`
  );
  if (!confirmed) return;

  if (choice === "all-with-storage") {
    console.log(`[Reset] Deleting all data + storage for ${chainName}`);
    await deleteAllDataWithStorage(currentChain, chainName);
  } else if (choice === "all") {
    console.log(`[Reset] Deleting all scan data for ${chainName}`);
    await deleteAllScanData(currentChain, chainName);
  } else if (choice === "storage-only") {
    console.log(`[Reset] Deleting settings only for ${chainName}`);
    await deleteStorageOnly(currentChain, chainName);
  } else {
    console.log(`[Reset] Deleting specific database: ${choice}`);
    await deleteSpecificDatabase(choice, chainName);
  }
});

// Helper functions for different reset operations
async function deleteAllDataWithStorage(currentChain, chainName) {
  const chainPrefix = getChainPrefix(currentChain) + '_';

  // Close open connections
  await closeOpenConnections();

  // Delete all databases for current chain
  const chainDatabases = [
    `${chainPrefix}DB_Cointool`,
    `${chainPrefix}DB_Xenft`,
    `${chainPrefix}DB_XenftStake`,
    `${chainPrefix}DB_XenStake`
  ];

  // Also delete legacy databases
  const legacyDatabases = ['DB_Cointool', 'DB_Xenft', 'DB_XenftStake', 'DB_XenStake'];
  const allDatabases = [...chainDatabases, ...legacyDatabases];

  const results = await Promise.allSettled(
    allDatabases.map(db => deleteDatabaseByName(db))
  );

  const blocked = results.some(r => r.status === 'fulfilled' && r.value === 'blocked');
  if (blocked) {
    alert("⚠️ Some data could not be deleted because another tab is using it. Please close other tabs and try again.");
    return;
  }

  // Clear chain-specific localStorage
  const chainKeys = Object.keys(localStorage).filter(key =>
    key.startsWith(currentChain + '_') ||
    (currentChain === 'ETHEREUM' && !key.includes('_'))
  );

  // Preserve critical settings
  const preserveKeys = ['selectedChain', 'privacyAccepted', 'onboardingDismissed'];
  chainKeys.forEach(key => {
    if (!preserveKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  });

  alert(`✅ All ${chainName} data and settings have been deleted successfully.`);
  window.location.reload();
}

async function deleteAllScanData(currentChain, chainName) {
  const chainPrefix = getChainPrefix(currentChain) + '_';

  // More aggressive connection closing
  await closeOpenConnections();

  // Wait a bit longer for connections to fully close
  await new Promise(resolve => setTimeout(resolve, 2000));

  const databases = [
    `${chainPrefix}DB_Cointool`,
    `${chainPrefix}DB_Xenft`,
    `${chainPrefix}DB_XenftStake`,
    `${chainPrefix}DB_XenStake`
  ];

  const results = await Promise.allSettled(
    databases.map(db => deleteDatabaseByName(db))
  );

  // Check for blocked databases and provide specific feedback
  const blockedDbs = [];
  const failedDbs = [];

  databases.forEach((db, index) => {
    const result = results[index];
    if (result.status === 'fulfilled' && result.value === 'blocked') {
      blockedDbs.push(db);
    } else if (result.status === 'rejected') {
      failedDbs.push(db);
    }
  });

  if (blockedDbs.length > 0) {
    const dbNames = blockedDbs.map(db => db.split('_').pop()).join(', ');
    alert(`⚠️ Some databases could not be deleted because they are in use: ${dbNames}.\n\nPlease:\n1. Close all other tabs with WenXen.com open\n2. Wait 10 seconds\n3. Try again`);
    return;
  }

  if (failedDbs.length > 0) {
    const dbNames = failedDbs.map(db => db.split('_').pop()).join(', ');
    alert(`⚠️ Some databases failed to delete: ${dbNames}.\n\nTry refreshing the page and attempting deletion again.`);
    return;
  }

  alert(`✅ All ${chainName} scan data has been deleted. Settings were preserved.`);
  window.location.reload();
}

async function deleteStorageOnly(currentChain, chainName) {
  // Clear only localStorage for current chain
  const chainKeys = Object.keys(localStorage).filter(key =>
    key.startsWith(currentChain + '_') ||
    (currentChain === 'ETHEREUM' && !key.includes('_'))
  );

  const preserveKeys = ['selectedChain', 'privacyAccepted', 'onboardingDismissed'];
  chainKeys.forEach(key => {
    if (!preserveKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  });

  alert(`✅ ${chainName} settings have been cleared. Scan data was preserved.`);
  window.location.reload();
}

async function deleteSpecificDatabase(dbName, chainName) {
  await closeOpenConnections();

  const result = await deleteDatabaseByName(dbName);
  if (result === 'blocked') {
    alert("⚠️ Database could not be deleted. Please close other tabs and try again.");
    return;
  }

  // Get friendly name for confirmation
  const friendlyName = dbName.includes('Cointool') ? 'Cointool mints' :
                      dbName.includes('Xenft') && dbName.includes('Stake') ? 'XENFT stakes' :
                      dbName.includes('Xenft') ? 'XENFT collection' :
                      dbName.includes('XenStake') ? 'XEN stakes' : 'selected data';

  alert(`✅ ${friendlyName} for ${chainName} have been deleted successfully.`);
  window.location.reload();
}

async function closeOpenConnections() {
  console.log('[DB] Closing all open database connections...');

  // Close main app database instances
  try {
    if (window.dbInstance) {
      console.log('[DB] Closing main dbInstance');
      window.dbInstance.close();
      window.dbInstance = null;
    }
  } catch (e) { console.log('[DB] Error closing dbInstance:', e.message); }

  // Close scanner database instances
  try {
    if (window.xenft?.openDB) {
      console.log('[DB] Closing XENFT database');
      const xf = await window.xenft.openDB();
      try { xf.close(); } catch {}
    }
  } catch (e) { console.log('[DB] Error closing XENFT database:', e.message); }

  try {
    if (window.xenftStake?.openDB) {
      console.log('[DB] Closing XENFT Stake database');
      const stakeDb = await window.xenftStake.openDB();
      try { stakeDb.close(); } catch {}
    }
  } catch (e) { console.log('[DB] Error closing XENFT Stake database:', e.message); }

  try {
    if (window.xenStake?.openDB) {
      console.log('[DB] Closing XEN Stake database');
      const xsDb = await window.xenStake.openDB();
      try { xsDb.close(); } catch {}
    }
  } catch (e) { console.log('[DB] Error closing XEN Stake database:', e.message); }

  // Also close any scanner-related connections
  try {
    if (window.cointoolScanner?.db) {
      console.log('[DB] Closing Cointool scanner database');
      window.cointoolScanner.db.close();
      window.cointoolScanner.db = null;
    }
  } catch (e) { console.log('[DB] Error closing Cointool scanner database:', e.message); }

  // Close any Tabulator table connections (they might hold DB refs)
  try {
    if (window.cointoolTable) {
      console.log('[DB] Destroying Tabulator table');
      window.cointoolTable.destroy();
      window.cointoolTable = null;
    }
  } catch (e) { console.log('[DB] Error destroying Tabulator table:', e.message); }

  console.log('[DB] Database connection cleanup completed');
}

// Old reset code has been replaced with improved chain-specific functionality above

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
  // Prefer the instance created by unified_view.js
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
            const ca = window.chainManager?.getContractAddress('XENFT_TORRENT') ||
              (window.xenft && window.xenft.CONTRACT_ADDRESS) ||
              "0x0a252663DBCc0b073063D6420a40319e438Cfa59";
            const explorerUrl = window.chainManager?.getExplorerUrl('address', ca) || `https://etherscan.io/token/${ca}`;
            return `<a href="${explorerUrl}?a=${value}" target="_blank">${value}</a>`;
          }

          // Stake XENFT rows → link NFT page
          if (row.SourceType === "Stake XENFT") {
            const acts = Array.isArray(row.Actions) ? row.Actions : (Array.isArray(row.actions) ? row.actions : []);
            const first = acts && acts.length ? acts[0] : null;
            const hash = first && (first.hash || first.txHash);
            if (hash) {
              const txUrl = window.chainManager?.getExplorerUrl('tx', hash) || `https://etherscan.io/tx/${hash}`;
              return `<a href="${txUrl}" target="_blank" rel="noopener">${value}</a>`;
            }
            const ca = "0xfeda03b91514d31b435d4e1519fd9e699c29bbfc";
            const nftUrl = window.chainManager?.getExplorerUrl('address', ca) || `https://etherscan.io/nft/${ca}`;
            return `<a href="${nftUrl}/${value}" target="_blank" rel="noopener">${value}</a>`;
          }

          // ✅ Regular Stakes → show short id (last 8)
          if (row.SourceType === "Stake") {
            const short = value.length > 8 ? value.slice(-8) : value;
            const acts = Array.isArray(row.Actions) ? row.Actions : (Array.isArray(row.actions) ? row.actions : []);
            const first = acts && acts.length ? acts[0] : null;
            const hash = first && (first.hash || first.txHash);
            if (hash) {
              const txUrl = window.chainManager?.getExplorerUrl('tx', hash) || `https://etherscan.io/tx/${hash}`;
              return `<a href="${txUrl}" target="_blank" rel="noopener">${short}</a>`;
            }
            // keep full value in a tooltip for convenience
            return `<span title="${value}">${short}</span>`;
          }

          // CoinTool rows → link to mint tx if present
          if (row.TX_Hash) {
            const txUrl = window.chainManager?.getExplorerUrl('tx', row.TX_Hash) || `https://etherscan.io/tx/${row.TX_Hash}`;
            return `<a href="${txUrl}" target="_blank">${value}</a>`;
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
            const txHash = action.hash || action.txHash || '';
            const href = window.chainManager?.getExplorerUrl('tx', txHash) || `https://etherscan.io/tx/${txHash}`;
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
          if (val && val.length > 12) {
            const addrUrl = window.chainManager?.getExplorerUrl('address', val) || `https://etherscan.io/address/${val}`;
            return `<a href="${addrUrl}" target="_blank">${val.substring(0, 4)}...${val.substring(val.length - 4)}</a>`;
          }
          return val;
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
    
    // Update mobile dropdown content when data changes
    if (window.innerWidth <= 768 && document.querySelector('.filter-chips.expanded')) {
      window.updateMobileDropdownContent();
    }
  });

  cointoolTable.on("tableBuilt", () => {
    // Signal that filter buttons are now ready to work
    window.tableReady = true;
    console.log('[Filter] Table built - filter buttons now ready');
  });

  // Auto-apply "All" filter ONCE after initial data load to ensure correct totals
  // This is the ONLY automatic update - simulates single "All" button click
  let initialDataLoaded = false;
  const applyAllFilterOnce = () => {
    if (!initialDataLoaded && window.tableReady && cointoolTable.getDataCount() > 0) {
      initialDataLoaded = true;
      console.log('[Filter] Auto-applying "All" filter on initial data load (ONE TIME ONLY)');
      setTimeout(() => {
        try {
          cointoolTable.clearHeaderFilter();
          cointoolTable.setHeaderFilterValue('Status', '');
          cointoolTable.setSort('Maturity_Date_Fmt', 'asc');
          // This is the ONE AND ONLY automatic badge update on page load
          updateXENTotalBadge();
        } catch (e) {
          console.warn('[Filter] Failed to auto-apply "All" filter:', e);
        }
      }, 500); // Delay to ensure all data is fully loaded
    }
  };
  cointoolTable.on("dataProcessed", applyAllFilterOnce);

  // Update XEN badge when user manually changes filters in table header inputs
  // This listener only runs AFTER initial page load is complete
  cointoolTable.on("dataFiltered", () => {
    // Only update if initial data load has completed (prevents duplicate updates during page load)
    if (initialDataLoaded) {
      console.log('[Filter] Manual filter change detected - updating XEN badge');
      updateXENTotalBadge();
    }
  });

  // Badge updates happen from:
  // 1. Auto-apply "All" filter above (once on page load)
  // 2. Manual filter button clicks (handled in filter button event listeners)
  // 3. Manual header filter changes in table (dataFiltered event above)
  // 4. Calendar date/month/year changes (in unified_view.js)

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
    // main_app.js — chooseActionDialog (snippet)
    const remintOpt = select.querySelector('option[value="remint"]');
    const st = rowData && String(rowData.SourceType);
    if (st === 'XENFT' || st === 'Stake XENFT') {
      if (remintOpt) remintOpt.disabled = true;
      select.value = 'claim';
    } else {
      if (remintOpt) remintOpt.disabled = false;
      select.value = defaultChoice || 'claim';
    }
    // Set aria-hidden first to prevent accessibility issues
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.remove('hidden');

    function cleanup(val){
      // Blur any focused elements within the modal to prevent accessibility issues
      const focusedElement = modal.querySelector(':focus');
      if (focusedElement) {
        focusedElement.blur();
      }
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
  const nowSec = Date.now() / 1000;

  // ✅ Stakes: Check redeemed status, then calculate based on maturity timestamp
  if (data.SourceType === 'Stake' || data.SourceType === 'Stake XENFT') {
    const actions = Array.isArray(data.Actions) ? data.Actions : [];
    const hasWithdraw = actions.some(a => a.type === 'withdraw');
    // Check if already claimed/redeemed
    if (hasWithdraw || Number(data.redeemed) === 1 || String(data.Status).toLowerCase() === 'claimed') {
      return 'Claimed';
    }
    // Calculate status based on maturity timestamp
    const maturityTs = Number(data.maturityTs || data.Maturity_Timestamp || 0);
    if (maturityTs > 0 && maturityTs <= nowSec) {
      return 'Claimable';
    }
    return 'Maturing';
  }

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
  // Save addresses with chain prefix
  if (window.chainStorage) {
    window.chainStorage.setItem("ethAddress", addresses);
    // For Ethereum, also update the prefixed key directly for safety
    if (window.chainManager && window.chainManager.getCurrentChain() === 'ETHEREUM') {
      localStorage.setItem("ETHEREUM_ethAddress", addresses);
    }
  } else {
    // Fallback to chain-specific key
    localStorage.setItem("ETHEREUM_ethAddress", addresses);
  }
  
  // Save RPC with chain prefix
  if (window.chainManager) {
    const rpcList = customRPC.split('\n').filter(Boolean);
    const currentChain = window.chainManager.getCurrentChain();
    window.chainManager.saveRPCEndpoints(rpcList, currentChain);
    window.__setRpcLastValueForChain?.(currentChain, customRPC);
    console.log(`[User Prefs] Saved ${rpcList.length} RPCs to chain-specific storage for ${currentChain}`);
  } else {
    console.warn(`[User Prefs] Chain manager not available, RPCs not saved`);
    try {
      localStorage.setItem('ETHEREUM_customRPC_lastKnown', customRPC);
      localStorage.setItem('ETHEREUM_customRPC_source', 'ETHEREUM');
    } catch (_) {}
  }
  
  // Save Etherscan API key (works for all chains)
  localStorage.setItem("etherscanApiKey", apiKey);
  
  // Check if setup is now complete and hide onboarding modal if it's showing
  if (isSetupComplete()) {
    hideOnboardingModal();
  }
}
function loadUserPreferences() {
  // Load addresses - chain-specific (migration should have already run)
  let addresses = "";
  
  if (window.chainStorage && window.chainManager) {
    const currentChain = window.chainManager.getCurrentChain();
    
    // Load chain-specific addresses (should be migrated already)
    addresses = window.chainStorage.getItem("ethAddress") || "";
    
    // If on Ethereum and no addresses, check if migration happened
    if (!addresses && currentChain === 'ETHEREUM') {
      // Double-check the migrated key directly
      addresses = localStorage.getItem("ETHEREUM_ethAddress") || "";
      if (!addresses) {
        // Last resort - check old format (shouldn't happen if migration ran)
        const oldAddresses = localStorage.getItem("ethAddress");
        if (oldAddresses) {
          console.log('Found unmigrated ethAddress, migrating now...');
          localStorage.setItem("ETHEREUM_ethAddress", oldAddresses);
          localStorage.removeItem("ethAddress");
          addresses = oldAddresses;
        }
      }
    }
    
    // If no addresses found and we're on Base, try Ethereum addresses as fallback
    if (!addresses && currentChain === 'BASE') {
      // Check if this is first time loading Base (no saved preference)
      const baseLoadedKey = 'BASE_addresses_loaded';
      if (!localStorage.getItem(baseLoadedKey)) {
        // First time on Base - load Ethereum addresses
        addresses = localStorage.getItem("ETHEREUM_ethAddress") || "";
        // Mark that we've loaded Base once
        localStorage.setItem(baseLoadedKey, '1');
        // Save Ethereum addresses as Base addresses for user to modify
        if (addresses) {
          window.chainStorage.setItem("ethAddress", addresses);
        }
      }
    }
  } else {
    // Fallback for when chain system not available - check both formats
    addresses = localStorage.getItem("ETHEREUM_ethAddress") || localStorage.getItem("ethAddress") || "";
  }
  
  document.getElementById("ethAddress").value = addresses;
  
  // Load chain-specific RPC
  let rpcValue = "";
  if (window.chainManager) {
    const rpcs = window.chainManager.getRPCEndpoints();
    rpcValue = rpcs.join('\n');
    console.log(`[Load User Prefs] Loaded ${rpcs.length} RPCs for ${window.chainManager.getCurrentChain()}`);
  } else {
    // No fallback to global customRPC - use DEFAULT_RPC only
    rpcValue = DEFAULT_RPC;
    console.log(`[Load User Prefs] Chain manager not available, using DEFAULT_RPC`);
  }
  document.getElementById("customRPC").value = rpcValue;
  if (window.chainManager) {
    window.__setRpcLastValueForChain?.(window.chainManager.getCurrentChain(), rpcValue);
    try {
      localStorage.setItem(`${window.chainManager.getCurrentChain()}_customRPC_lastKnown`, rpcValue);
    } catch (_) {}
  } else {
    window.__setRpcLastValueForChain?.('ETHEREUM', rpcValue);
    try { localStorage.setItem('ETHEREUM_customRPC_lastKnown', rpcValue); } catch (_) {}
  }
  
  // API key is global
  // Load Etherscan API key (now works for all chains)
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
  
  // RPC is optional - we have defaults for each chain
  // Only validate if user has entered something
  const hasValidRpc = !rpcText || rpcText.split("\n").some(s => s.trim().startsWith("http"));
  scanBtn.disabled = !hasValidRpc || !apiKey;
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
// Global rate limiter for Etherscan API calls (5 requests per second)
// Uses a queue to handle parallel requests properly
const etherscanRateLimiter = {
  queue: [],
  processing: false,
  lastRequestTime: 0,
  minInterval: 250, // 250ms = 4 requests per second (more conservative to avoid rate limits)
  
  async throttle() {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  },
  
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minInterval) {
        const waitTime = this.minInterval - timeSinceLastRequest;
        await new Promise(r => setTimeout(r, waitTime));
      }
      
      this.lastRequestTime = Date.now();
      const resolve = this.queue.shift();
      resolve();
      
      // Small delay between queue processing to prevent tight loops
      if (this.queue.length > 0) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
    
    this.processing = false;
  }
};

async function fetchRangeWithSplit(address, startBlock, endBlock, etherscanApiKey, sink, depth = 0, onStatus = null) {
  if (startBlock > endBlock) return;

  const indent = " ".repeat(depth * 2);
  const url = es2url(
    `module=account&action=txlist` +
    `&address=${address}&startblock=${startBlock}&endblock=${endBlock}` +
    `&sort=asc&apikey=${etherscanApiKey}`
  );

  const queueLength = etherscanRateLimiter.queue.length;
  const statusMsg = queueLength > 0 
    ? `${indent}- [Queue: ${queueLength}] Fetching transactions in block range: ${startBlock} to ${endBlock}...`
    : `${indent}- Fetching transactions in block range: ${startBlock} to ${endBlock}...`;
  if (typeof onStatus === "function") onStatus(statusMsg);
  console.log(statusMsg);

  const MAX_RETRIES = 6;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Apply rate limiting before making the request
      await etherscanRateLimiter.throttle();
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
        // Rate limiting is now handled by etherscanRateLimiter.throttle()
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

      // Rate limit error - wait longer
      if (/rate limit/i.test(human)) {
        const rateLimitWait = Math.max(1000, 500 * (attempt + 1)); // Progressive backoff for rate limits
        console.warn(`${indent}  ! Rate limit hit. Waiting ${rateLimitWait}ms before retry...`);
        if (typeof onStatus === "function") onStatus(`${indent}  ! Rate limit. Waiting...`);
        await new Promise(r => setTimeout(r, rateLimitWait));
      } else {
        // Other transient errors -> retry with backoff
        console.warn(`${indent}  ! Transient error (${human}). Retrying in ${backoff}ms...`);
        if (typeof onStatus === "function") onStatus(`${indent}  ! ${human}. Retrying...`);
        await new Promise(r => setTimeout(r, backoff));
      }

    } catch (e) {
      const backoff = Math.min(2500, 200 * Math.pow(1.6, attempt));
      console.warn(`${indent}  ! Request failed (${e.message}). Retrying in ${backoff}ms...`);
      if (typeof onStatus === "function") onStatus(`${indent}  ! Network error. Retrying...`);
      await new Promise(r => setTimeout(r, backoff));
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
  // Get XEN deployment block as minimum
  const xenDeploymentBlock = window.chainManager?.getXenDeploymentBlock() || 0;
  
  const url = es2url(
    `module=account&action=txlist` +
    `&address=${address}&startblock=${xenDeploymentBlock}&endblock=99999999&page=1&offset=1&sort=asc&apikey=${etherscanApiKey}`
  );
  try {
    // Apply rate limiting before making the request
    await etherscanRateLimiter.throttle();
    const res = await fetch(url);
    const data = await res.json();
    if (data?.status === "1" && Array.isArray(data.result) && data.result.length > 0) {
      const b = Number(data.result[0].blockNumber);
      // Ensure we never return a block before XEN deployment
      return Number.isFinite(b) ? Math.max(b, xenDeploymentBlock) : xenDeploymentBlock;
    }
  } catch (_) {}
  return xenDeploymentBlock;
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


  // heartbeat (lets you see if we're waiting on network)
  window.__scanLastActivityTs = Date.now();
  const heartbeat = setInterval(() => {
    const dt = Math.floor((Date.now() - (window.__scanLastActivityTs || Date.now())) / 1000);
    if (rpcStatusEl) rpcStatusEl.textContent = dt >= 3 ? `⏳ ${dt}s since last reply` : "";
  }, 2000);

  // -------- Resume logic (and "first tx" pre-skip) --------
  const forceRescan = document.getElementById("forceRescan")?.checked;
  const xenDeploymentBlock = window.chainManager?.getXenDeploymentBlock() || 0;
  let resumeFrom = xenDeploymentBlock; // Start from XEN deployment block as minimum

  try {
    if (forceRescan && dbInstance) {
      await clearScanState(dbInstance, address);
    } else if (dbInstance) {
      const st = await getScanState(dbInstance, address);
      if (st && Number.isFinite(st.lastScannedBlock)) {
        resumeFrom = Math.max(xenDeploymentBlock, Math.min(latestBlock, Number(st.lastScannedBlock) + 1));
      }
    }
  } catch (e) {
    console.warn("resume cursor read/clear failed:", e);
  }

  // Pre-skip early empty ranges by finding the address' first tx once
  try {
    const earliest = await findEarliestTxBlock(address, etherscanApiKey);
    if (earliest && (resumeFrom === xenDeploymentBlock || resumeFrom < earliest)) {
      console.log(`Earliest tx for ${address} at block ${earliest} — skipping earlier empty ranges (XEN deployed at ${xenDeploymentBlock}).`);
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
    // Load chain-specific addresses (migration should have already run)
    let saved = "";
    
    if (window.chainStorage && window.chainManager) {
      const currentChain = window.chainManager.getCurrentChain();
      
      // Load chain-specific addresses
      saved = window.chainStorage.getItem("ethAddress") || "";
      
      // For Ethereum, double-check migration
      if (!saved && currentChain === 'ETHEREUM') {
        saved = localStorage.getItem("ETHEREUM_ethAddress") || "";
        if (!saved) {
          // Check old format as last resort
          const oldSaved = localStorage.getItem("ethAddress");
          if (oldSaved) {
            console.log('Found unmigrated ethAddress, migrating now...');
            localStorage.setItem("ETHEREUM_ethAddress", oldSaved);
            localStorage.removeItem("ethAddress");
            saved = oldSaved;
          }
        }
      }
      
      // For Base, use Ethereum addresses as initial default if first time
      if (!saved && currentChain === 'BASE') {
        const baseLoadedKey = 'BASE_addresses_loaded';
        if (!localStorage.getItem(baseLoadedKey)) {
          saved = localStorage.getItem("ETHEREUM_ethAddress") || "";
          localStorage.setItem(baseLoadedKey, '1');
          if (saved) {
            window.chainStorage.setItem("ethAddress", saved);
          }
        }
      }
    } else {
      // Fallback - check both formats
      saved = localStorage.getItem("ETHEREUM_ethAddress") || localStorage.getItem("ethAddress") || "";
    }
    
    if (saved) addrInput.value = saved;
  }

  // Load custom RPCs
  const rpcInput = document.getElementById("customRPC");
  if (rpcInput) {
    // Load chain-specific RPC
    const currentChain = window.chainManager?.getCurrentChain() || 'Unknown';
    if (window.chainManager) {
      const rpcs = window.chainManager.getRPCEndpoints();
      if (rpcs.length > 0) {
        const saved = rpcs.join('\n');
        rpcInput.value = saved;
        console.log(`[Initial Load] Loaded ${rpcs.length} RPCs for ${currentChain}:`, rpcs.slice(0, 2));
      }
    } else {
      console.log(`[Initial Load] Chain manager not available for ${currentChain}`);
    }
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

  // Load Cointool Performance Settings
  const cointoolBatchSizeInput = document.getElementById("cointoolBatchSize");
  if (cointoolBatchSizeInput) {
    const saved = localStorage.getItem("cointoolBatchSize");
    if (saved) cointoolBatchSizeInput.value = saved;
  }
  
  const cointoolBatchDelayInput = document.getElementById("cointoolBatchDelay");
  if (cointoolBatchDelayInput) {
    const saved = localStorage.getItem("cointoolBatchDelay");
    if (saved) cointoolBatchDelayInput.value = saved;
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
  // Commented out to avoid duplicate saves - using the blur event listeners below instead
  // attachSave(document.getElementById("ethAddress"), "ethAddress", { toastLabel: "Addresses" });
  // attachSave(document.getElementById("customRPC"), "customRPC", { toastLabel: "Custom RPCs" });
  // attachSave(document.getElementById("etherscanApiKey"), "etherscanApiKey", { toastLabel: "Etherscan API key", sanitize: v => v.trim() });


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

  // Cointool Batch Size (validated number 5-50)
  const cointoolBatchSizeInput = document.getElementById("cointoolBatchSize");
  if (cointoolBatchSizeInput) {
    const persistCointoolBatchSize = (val) => {
      const v = parseInt(val, 10);
      if (Number.isFinite(v) && v >= 5 && v <= 50) {
        localStorage.setItem("cointoolBatchSize", String(v));
        if (typeof showToast === "function") showToast(`Cointool batch size saved (${v})`, "success");
        markValidity("field-cointoolBatchSize", true);
      } else {
        if (typeof showToast === "function") showToast("Cointool batch size must be between 5 and 50.", "error");
        cointoolBatchSizeInput.value = localStorage.getItem("cointoolBatchSize") || "15";
        markValidity("field-cointoolBatchSize", false, "Batch size must be between 5 and 50.");
      }
    };
    cointoolBatchSizeInput.addEventListener("change", () => persistCointoolBatchSize(cointoolBatchSizeInput.value));
    cointoolBatchSizeInput.addEventListener("blur", () => persistCointoolBatchSize(cointoolBatchSizeInput.value));
    cointoolBatchSizeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); persistCointoolBatchSize(cointoolBatchSizeInput.value); }
    });
  }

  // Cointool Batch Delay (validated number 0-500)
  const cointoolBatchDelayInput = document.getElementById("cointoolBatchDelay");
  if (cointoolBatchDelayInput) {
    const persistCointoolBatchDelay = (val) => {
      const v = parseInt(val, 10);
      if (Number.isFinite(v) && v >= 0 && v <= 500) {
        localStorage.setItem("cointoolBatchDelay", String(v));
        if (typeof showToast === "function") showToast(`Cointool batch delay saved (${v}ms)`, "success");
        markValidity("field-cointoolBatchDelay", true);
      } else {
        if (typeof showToast === "function") showToast("Cointool batch delay must be between 0 and 500ms.", "error");
        cointoolBatchDelayInput.value = localStorage.getItem("cointoolBatchDelay") || "50";
        markValidity("field-cointoolBatchDelay", false, "Batch delay must be between 0 and 500ms.");
      }
    };
    cointoolBatchDelayInput.addEventListener("change", () => persistCointoolBatchDelay(cointoolBatchDelayInput.value));
    cointoolBatchDelayInput.addEventListener("blur", () => persistCointoolBatchDelay(cointoolBatchDelayInput.value));
    cointoolBatchDelayInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); persistCointoolBatchDelay(cointoolBatchDelayInput.value); }
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

  // Custom RPC is optional - we have defaults for each chain
  // Only validate format if user has entered something
  const rpcText = document.getElementById("customRPC")?.value.trim() || "";
  const okRPC = !rpcText || rpcText.split("\n").some(s => s.trim().startsWith("http"));
  markValidity("field-customRPC", okRPC, "Invalid RPC format. URLs must start with http or https.");

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
  
  // Get Etherscan API key (works for all chains with V2 API)
  const etherscanApiKey = document.getElementById("etherscanApiKey").value.trim();
  if (!etherscanApiKey) {
    alert("Please enter an Etherscan API Key (works for all chains).");
    // DELETED: restoreScanBtn();
    return;
  }
  saveUserPreferences(addressInput, rpcInput, etherscanApiKey);

  web3 = new Web3(rpcEndpoints[0]);
  ETHERSCAN_CHAIN_ID = await web3.eth.getChainId();

  // Get current chain's contract address
  const currentContractAddress = window.chainManager?.getContractAddress('COINTOOL') || CONTRACT_ADDRESS;
  contract = new web3.eth.Contract(cointoolAbi, currentContractAddress);
  contract.setProvider(web3.currentProvider);

  window.progressUI.show(true);
  window.progressUI.setType('Cointool');
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

    // Preserve the current month/year view before destroying
    let preservedYear = null;
    let preservedMonth = null;
    if (calendarPicker && calendarPicker.currentYear !== undefined && calendarPicker.currentMonth !== undefined) {
      // Store the currently displayed month/year
      preservedYear = calendarPicker.currentYear;
      preservedMonth = calendarPicker.currentMonth;
    }

    if (calendarPicker) calendarPicker.destroy();
    document.getElementById("calendar").style.display = 'block';

    const calendarOptions = {
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
      onReady: function(selectedDates, dateStr, instance){
        __fixFlatpickrHeader(instance);
        // Restore preserved month/year after initialization
        if (preservedYear !== null && preservedMonth !== null) {
          instance.changeMonth(preservedMonth, false);
          instance.changeYear(preservedYear);
        }
      },
      onMonthChange: function(selectedDates, dateStr, instance){ __fixFlatpickrHeader(instance); },
      onYearChange: function(selectedDates, dateStr, instance){ __fixFlatpickrHeader(instance); }
    };

    calendarPicker = flatpickr("#calendar", calendarOptions);

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
    
    // Don't force app to match wallet - let user control app chain
    const walletChainKey = window.chainManager?.getChainById(chainId);
    
    if (!walletChainKey) {
      // Wallet is on unsupported chain
      alert(`Your wallet is connected to an unsupported network (chain ID ${chainId}). Please switch to Ethereum or Base.`);
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
    
    // Just connect - don't change app chain
    console.log(`Wallet connected on ${walletChainKey}, app is on ${window.chainManager?.getCurrentChain()}`);

    connectedAccount = accounts[0];
    window.connectedAccount = connectedAccount; // expose for other scripts

    const btnTxt = document.getElementById('connectWalletText');
    if (btnTxt) btnTxt.textContent = `${connectedAccount.slice(0, 6)}...${connectedAccount.slice(-4)}`;

    await updateNetworkBadge();
    
    // Only fetch XEN balance if wallet is on the same chain as the app
    const walletChainId = await web3Wallet.eth.getChainId();
    const appChainId = window.chainManager?.getCurrentConfig()?.id || 1;
    if (Number(walletChainId) === appChainId) {
      try { window.prefillStakeAmountFromBalance?.(); window.updateStakeStartEnabled?.(); } catch {}
    }
    
    try { window.updateMintConnectHint?.(); window.updateStakeConnectHint?.(); } catch {}
    __updateWalletEyeSize();

    // keep UI in sync
    // Note: chainChanged is now handled by networkSelector.js which will sync the app to match wallet's chain
    // We only need to listen for account changes here
    window.ethereum.removeAllListeners?.('accountsChanged');
    
    // The networkSelector will handle chain changes and sync the app accordingly
    // We just need to update the badge when network changes occur
    const chainChangeHandler = async (cidHex) => {
      const cid = parseInt(cidHex, 16);
      await updateNetworkBadge();
      if (cointoolTable) cointoolTable.redraw(true);
    };
    
    // Add a simple listener just for UI updates (network selector handles the actual switching)
    window.ethereum.on?.('chainChanged', chainChangeHandler);
    window.ethereum.on?.('accountsChanged', async (accs) => {
      connectedAccount = accs?.[0] || null;
      window.connectedAccount = connectedAccount;
      const bt = document.getElementById('connectWalletText');
      if (bt) bt.textContent = connectedAccount
        ? `${connectedAccount.slice(0, 6)}...${connectedAccount.slice(-4)}`
        : 'Connect Wallet';
      await updateNetworkBadge();
      selectedRows.clear();
      refreshBulkUI();
      if (cointoolTable) cointoolTable.redraw(true);
      
      // Only fetch XEN balance if wallet exists and is on same chain as app
      if (window.web3Wallet && connectedAccount) {
        try {
          const walletChainId = await window.web3Wallet.eth.getChainId();
          const appChainId = window.chainManager?.getCurrentConfig()?.id || 1;
          if (Number(walletChainId) === appChainId) {
            window.prefillStakeAmountFromBalance?.();
            window.updateStakeStartEnabled?.();
          }
        } catch {}
      }
      
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
    const expectedChainId = window.chainManager?.getCurrentConfig()?.id || 1;
    const currentChainName = window.chainManager?.getCurrentConfig()?.name || 'Ethereum';
    
    if (parseInt(chainId, 16) !== expectedChainId) {
      alert(`Please switch your wallet to ${currentChainName} (chain ID ${expectedChainId}) to claim/remint.`);
      return;
    }
  } catch {
    const currentChainName = window.chainManager?.getCurrentConfig()?.name || 'Ethereum';
    alert(`Could not read current network. Please switch to ${currentChainName}.`);
    return;
  }

  const w3 = web3Wallet || web3;

  // ✅ NEW: Handle regular XEN Stake withdrawal
  if (String(row.SourceType) === 'Stake') {
    // ✅ FIX: Minimal ABI for the correct 'withdraw()' function (no parameters)
    try {
      // XEN_ETH address is already defined in main_app.js
      const xenContract = new w3.eth.Contract(window.xenAbi, XEN_ETH);
      // ✅ FIX: Call withdraw() with no arguments
      const tx = await executeWithAutoRescan(
        xenContract.methods.withdraw().send({ from: connectedAccount }),
        'XEN Stake withdraw'
      );

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
    // Stake NFTs don't have "remint"; just end the stake.
    const tokenId = Number(row.Mint_id_Start || row.tokenId);
    if (!Number.isFinite(tokenId)) { alert("Bad Stake XENFT tokenId."); return; }

    // Use the address exported by xenft_stake_scanner.js, fallback to canonical mainnet address
    const STAKE_ADDR = window.chainManager?.getContractAddress('XENFT_STAKE') ||
      (window.xenftStake && window.xenftStake.CONTRACT_ADDRESS) ||
      '0xfEdA03b91514D31b435d4E1519Fd9e699C29BbFC';

    try {
      // Use the correct Stake XENFT ABI - must include endStake method
      let stakeAbi = window.xenftStakeAbi;

      // If ABI is not loaded or incomplete, use a complete fallback ABI
      if (!stakeAbi || !Array.isArray(stakeAbi) || stakeAbi.length === 0) {
        console.warn('Stake XENFT ABI not loaded, using fallback ABI');
        // Complete minimal ABI for Stake XENFT contract including endStake, ownerOf, and essential methods
        stakeAbi = [
          {
            "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
            "name": "endStake",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          },
          {
            "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
            "name": "ownerOf",
            "outputs": [{"internalType": "address", "name": "", "type": "address"}],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "name": "stakeInfo",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
          }
        ];
      } else {
        // Verify the ABI has the endStake method
        const hasEndStake = stakeAbi.some(item => item.type === 'function' && item.name === 'endStake');
        if (!hasEndStake) {
          console.error('Stake XENFT ABI is loaded but missing endStake method - using fallback');
          // Add just the endStake method to the existing ABI
          stakeAbi = [...stakeAbi, {
            "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
            "name": "endStake",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }];
        }
      }

      const stake = new w3.eth.Contract(stakeAbi, STAKE_ADDR);

      // Verify the contract methods are available
      if (!stake.methods.endStake) {
        console.error('Contract instantiation failed - endStake method not available');
        alert('Error: Failed to create Stake XENFT contract instance. Please refresh the page.');
        return;
      }
      const tx = await executeWithAutoRescan(
        stake.methods.endStake(tokenId).send({ from: connectedAccount }),
        'Stake XENFT end',
        tokenId
      );

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

    // Get chain-specific XENFT Torrent contract address
    const TORRENT_ADDR = window.chainManager?.getContractAddress('XENFT_TORRENT') ||
      (typeof XENFT_TORRENT === 'string' && XENFT_TORRENT) ||
      (window.xenft && window.xenft.CONTRACT_ADDRESS) ||
      '0x0a252663DBCc0b073063D6420a40319e438Cfa59';


    try {
      const torrent = new w3.eth.Contract(window.xenftAbi, TORRENT_ADDR);
      const tx = await executeWithAutoRescan(
        torrent.methods.bulkClaimMintReward(tokenId, connectedAccount).send({ from: connectedAccount }),
        'XENFT claim',
        tokenId
      );
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

  await sendCointoolTx({ ids, dataHex, salt, w3, action });
}


// cleanHexAddr function now provided by js/utils/stringUtils.js module



window.onload = async () => {
  // Initialize chain system first
  try {
    if (window.chainManager) {
      // Update all chain-specific configurations
      updateChainConfig();
      
      // Update display to show current chain
      const chainName = window.chainManager.getCurrentConfig().name;
      const networkNameEl = document.getElementById('networkName');
      if (networkNameEl) {
        networkNameEl.textContent = `(${chainName})`;
      }
      
      // Listen for chain changes if not already listening
      if (!window._chainListenerRegistered) {
        window.chainManager.onChainChange(() => {
          updateChainConfig();
        });
        window._chainListenerRegistered = true;
      }
    }
  } catch (e) {
    console.warn('Chain manager not initialized:', e);
  }
  
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

// Commented out to prevent conflict with unified scanner
// document.getElementById("scanBtn").addEventListener("click", scanMints);
document.getElementById("connectWalletBtn").addEventListener("click", handleWalletConnectClick);
// Individual field save handlers with proper duplicate prevention
(function() {
  // Track last saved values and blur timestamps to prevent duplicates
  const rpcLastValuesByChain = window.__rpcLastValuesByChain = window.__rpcLastValuesByChain || {};
  if (window.chainManager) {
    const initChain = window.chainManager.getCurrentChain();
    if (initChain && !(initChain in rpcLastValuesByChain)) {
      rpcLastValuesByChain[initChain] = window.chainManager.getRPCEndpoints().join('\n');
    }
  }

  const fieldState = {
    customRPC: {
      lastValue: (window.chainManager ? window.chainManager.getRPCEndpoints().join('\n') : "") || "",
      lastValueByChain: rpcLastValuesByChain,
      lastBlurTime: 0,
      saveTimer: null
    },
    ethAddress: {
      lastValue: (window.chainStorage ? window.chainStorage.getItem("ethAddress") : localStorage.getItem("ethAddress")) || "",
      lastBlurTime: 0,
      saveTimer: null
    },
    etherscanApiKey: {
      lastValue: localStorage.getItem("etherscanApiKey") || "",
      lastBlurTime: 0,
      saveTimer: null
    }
  };
  
  // Helper function to show save status (simple console log for now)
  function showSaveStatus(message, success = true) {
    console.log(`[Save Status] ${message}`);
    // You could enhance this to show a visual toast/notification
    // For now, just log to console to avoid the error
  }
  
  // Make it globally available for event handlers
  window.showSaveStatus = showSaveStatus;
  
  // Helper function to save field with duplicate prevention
  function saveField(fieldName, value, displayName) {
    const now = Date.now();
    const state = fieldState[fieldName];
    
    // Prevent duplicate blur events within 500ms
    if (now - state.lastBlurTime < 500) {
      return; // Skip this blur event as it's a duplicate
    }
    state.lastBlurTime = now;
    
    // Clear any pending save
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
    
    // Check if value actually changed
    if (value === state.lastValue) {
      return; // No change, no need to save
    }
    
    // Save immediately (no additional delay needed since we're preventing duplicates)
    localStorage.setItem(fieldName, value);
    state.lastValue = value;
    if (fieldName === 'customRPC') {
      const chainKey = window.chainManager?.getCurrentChain() || 'ETHEREUM';
      if (state.lastValueByChain) {
        state.lastValueByChain[chainKey] = value;
      }
      try {
        localStorage.setItem(`${chainKey}_customRPC_source`, chainKey);
        localStorage.setItem(`${chainKey}_customRPC_lastKnown`, value);
      } catch (e) {
        console.warn('Failed to update custom RPC source metadata:', e);
      }
      window.__setRpcLastValueForChain?.(chainKey, value);
    }
    
    // Show save status
    showSaveStatus(displayName + " saved", true);
    
    // Check if setup is complete
    if (isSetupComplete()) {
      hideOnboardingModal();
    }
  }
  
  // Add blur event listeners
  const customRPCField = document.getElementById("customRPC");
  if (customRPCField) {
    customRPCField.addEventListener("focus", function() {
      this.dataset.focusChain = window.chainManager?.getCurrentChain() || "";
      this.dataset.lastManualValue = this.value;
    });

    customRPCField.addEventListener("input", function() {
      this.dataset.lastManualValue = this.value;
    });

    customRPCField.addEventListener("blur", function() {
      const hadFocusInfo = Object.prototype.hasOwnProperty.call(this.dataset, 'focusChain');
      const hadManualValue = Object.prototype.hasOwnProperty.call(this.dataset, 'lastManualValue');

      if (!hadFocusInfo && !hadManualValue) {
        delete this.dataset.focusChain;
        delete this.dataset.lastManualValue;
        return; // Ignore blur events that didn't originate from user focus/input (e.g., programmatic switches)
      }

      const currentChain = window.chainManager?.getCurrentChain() || "";
      const focusChain = this.dataset.focusChain || currentChain;
      const lastManualValue = this.dataset.lastManualValue ?? this.value;

      let valueToPersist = lastManualValue;
      if (!valueToPersist && this.value) {
        valueToPersist = this.value;
      }

      delete this.dataset.focusChain;
      delete this.dataset.lastManualValue;

      const targetChain = focusChain || currentChain || 'ETHEREUM';
      const lastKnown = window.__rpcLastValuesByChain?.[targetChain] ?? localStorage.getItem(`${targetChain}_customRPC_lastKnown`) ?? "";

      if (!hadManualValue && valueToPersist === lastKnown) {
        return; // No change detected
      }

      if (window.chainManager) {
        const rpcList = valueToPersist.split('\n').map(s => s.trim()).filter(Boolean);
        window.chainManager.saveRPCEndpoints(rpcList, targetChain);
        window.__setRpcLastValueForChain?.(targetChain, valueToPersist);
        showSaveStatus("Custom RPCs saved", true);
      } else {
        saveField("customRPC", valueToPersist, "Custom RPCs");
        window.__setRpcLastValueForChain?.(focusChain || 'ETHEREUM', valueToPersist);
      }
    });
  }
  
  const ethAddressField = document.getElementById("ethAddress");
  if (ethAddressField) {
    ethAddressField.addEventListener("blur", function() {
      // Save chain-specific addresses
      if (window.chainStorage) {
        window.chainStorage.setItem("ethAddress", this.value);
        // Addresses saved via chainStorage
        showSaveStatus("Addresses saved", true);
      } else {
        saveField("ethAddress", this.value, "Addresses");
      }
    });
  }
  
  const etherscanApiKeyField = document.getElementById("etherscanApiKey");
  if (etherscanApiKeyField) {
    etherscanApiKeyField.addEventListener("blur", function() {
      saveField("etherscanApiKey", this.value.trim(), "Etherscan API key");
    });
  }
})();
document.getElementById("downloadBtn").addEventListener("click", function(){
  if(cointoolTable){ cointoolTable.download("csv", "cointool-mints-detailed.csv"); }
});

// --- STATUS CHIP FILTERING ---
// main_app.js

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


// Delete ALL IndexedDBs completely (including new chain-specific ones)
async function clearAllAppData() {
  console.log("Clearing all app data and databases...");

  // More aggressive connection closing
  await closeOpenConnections();

  // Wait a bit longer for connections to fully close
  await new Promise(resolve => setTimeout(resolve, 2000));

  // List of all possible databases (old and new)
  const allDatabases = [
    // Legacy databases
    "DB_Cointool", "DB_Xenft", "DB_XenftStake", "DB_XenStake",
    // New chain-specific databases
    "ETH_DB_Cointool", "ETH_DB_Xenft", "ETH_DB_XenStake", "ETH_DB_XenftStake",
    "BASE_DB_Cointool", "BASE_DB_Xenft", "BASE_DB_XenStake", "BASE_DB_XenftStake"
  ];

  // Delete all databases with proper error tracking
  const results = await Promise.allSettled(
    allDatabases.map(db => deleteDatabaseByName(db))
  );

  // Check for blocked databases and provide specific feedback
  const blockedDbs = [];
  const failedDbs = [];

  allDatabases.forEach((db, index) => {
    const result = results[index];
    if (result.status === 'fulfilled' && result.value === 'blocked') {
      blockedDbs.push(db);
    } else if (result.status === 'rejected') {
      failedDbs.push(db);
    }
  });

  if (blockedDbs.length > 0) {
    const dbNames = blockedDbs.map(db => db.includes('_') ? db.split('_').pop() : db).join(', ');
    alert(`⚠️ Some databases could not be deleted because they are in use: ${dbNames}.\n\nPlease:\n1. Close all other tabs with WenXen.com open\n2. Wait 10 seconds\n3. Try again`);
    return;
  }

  if (failedDbs.length > 0) {
    const dbNames = failedDbs.map(db => db.includes('_') ? db.split('_').pop() : db).join(', ');
    alert(`⚠️ Some databases failed to delete: ${dbNames}.\n\nTry refreshing the page and attempting deletion again.`);
    return;
  }

  console.log("Database deletion results:", results);
  
  // Reset migration flags so old backups can be migrated
  localStorage.removeItem('dbMigrationCompleted');
  localStorage.removeItem('lastSuccessfulMigration');
  localStorage.removeItem('migrationDuration');
  localStorage.removeItem('migrationDeletionLog');
  localStorage.removeItem('onboardingDismissed');
  console.log("Migration flags reset");
  
  // For backwards compatibility, also try to clear stores if databases exist
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

  // DB_XenftStake
  try {
    if (window.xenftStake?.openDB) {
      const stakeDb = await window.xenftStake.openDB();
      await Promise.all([
        clearStore(stakeDb, "stakes"),
        clearStore(stakeDb, "scanState")
      ]);
    }
  } catch (_) {}

  // ✅ DB_XenStake (regular stakes)
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

// Fast bulk put - simple and efficient
function bulkPut(db, storeName, items) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(items) || items.length === 0) return resolve();

    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    // Process all items in a single transaction (much faster)
    for (const item of items) {
      // Quick fix for XENFT keyPath if needed
      if (storeName === "xenfts" && !item.Xenft_id) {
        if (item.tokenId) item.Xenft_id = item.tokenId;
        else if (item.ID) item.Xenft_id = item.ID;
      }

      store.put(item);
    }

    tx.oncomplete = () => {
      console.log(`[Import] ${storeName}: imported ${items.length} items`);
      resolve();
    };
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
  const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';

  // Collect ALL localStorage data for complete backup
  const allLocalStorage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      allLocalStorage[key] = localStorage.getItem(key);
    }
  }

  // Collect current form values with chain-aware RPC handling
  const formSettings = {
    ethAddress: (document.getElementById("ethAddress")?.value ?? "").trim(),
    // Don't export current RPC form value - let chain-specific localStorage handle it
    // customRPC: (document.getElementById("customRPC")?.value ?? "").trim(),
    etherscanApiKey: (document.getElementById("etherscanApiKey")?.value ?? "").trim(),
    chunkSize: (document.getElementById("chunkSize")?.value ?? "").trim(),
    cointoolBatchSize: (document.getElementById("cointoolBatchSize")?.value ?? "").trim(),
    cointoolBatchDelay: (document.getElementById("cointoolBatchDelay")?.value ?? "").trim(),
    gasRefreshSeconds: (document.getElementById("gasRefreshSeconds")?.value ?? "").trim(),
    mintTermDays: (document.getElementById("mintTermDays")?.value ?? "").trim()
  };

  const settings = {
    // Complete localStorage backup
    localStorage: allLocalStorage,

    // Current form values (might differ from localStorage)
    formValues: formSettings,

    // Current state
    selectedChain: currentChain,
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

    // Capture current theme state
    theme: (function(){
      try {
        return window.getStoredTheme?.() || localStorage.getItem("theme") || "system";
      } catch {
        return localStorage.getItem("theme") || "system";
      }
    })(),

    // Export timestamp for reference
    exportedAt: new Date().toISOString(),
    exportedChain: currentChain
  };
  const throttle = localStorage.getItem("etherscanThrottleMs");
  if (throttle) settings.etherscanThrottleMs = throttle;
  return settings;
}

function applySettingsSnapshot(settings) {
  if (!settings || typeof settings !== "object") return;

  console.log('[Settings] Applying settings snapshot...');

  // Handle new comprehensive format (v6+)
  if (settings.localStorage && typeof settings.localStorage === 'object') {
    console.log('[Settings] Restoring complete localStorage data...');

    // Restore localStorage data, but preserve ALL existing chain-specific RPC data (ALL 7 CHAINS)
    const allChains = ['ETHEREUM', 'BASE', 'AVALANCHE', 'BSC', 'MOONBEAM', 'POLYGON', 'OPTIMISM'];
    const preservedRPCs = {};

    // Preserve ALL chain-specific RPC data before restore
    allChains.forEach(chain => {
      const rpcKey = `${chain}_customRPC`;
      const existingRPCs = localStorage.getItem(rpcKey);
      if (existingRPCs) {
        preservedRPCs[rpcKey] = existingRPCs;
        console.log(`[Settings] Preserving existing ${chain} RPC data`);
      }
    });

    Object.entries(settings.localStorage).forEach(([key, value]) => {
      try {
        // Skip restoring ANY chain-specific RPC data to prevent cross-contamination
        if (key.endsWith('_customRPC')) {
          console.log(`[Settings] Skipping restore of ${key} to prevent cross-contamination`);
          return;
        }
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn(`[Settings] Failed to restore localStorage key: ${key}`, e);
      }
    });

    // Restore all preserved RPC data
    Object.entries(preservedRPCs).forEach(([rpcKey, rpcData]) => {
      localStorage.setItem(rpcKey, rpcData);
      console.log(`[Settings] Restored preserved RPC data for ${rpcKey}`);
    });

    // Apply form values if available
    if (settings.formValues) {
      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el && v !== undefined && v !== null) el.value = v;
      };
      setVal("ethAddress", settings.formValues.ethAddress);
      // Don't restore customRPC form field - let chain manager load chain-specific RPCs
      // setVal("customRPC", settings.formValues.customRPC);
      setVal("etherscanApiKey", settings.formValues.etherscanApiKey);
      setVal("chunkSize", settings.formValues.chunkSize);
      setVal("cointoolBatchSize", settings.formValues.cointoolBatchSize);
      setVal("cointoolBatchDelay", settings.formValues.cointoolBatchDelay);
      setVal("gasRefreshSeconds", settings.formValues.gasRefreshSeconds);
      setVal("mintTermDays", settings.formValues.mintTermDays);
    }

    // Apply theme if specified
    if (settings.theme && window.setTheme) {
      try {
        window.setTheme(settings.theme);
      } catch (e) {
        console.warn('[Settings] Failed to apply theme:', e);
      }
    }

    console.log('[Settings] Complete settings restoration finished');

    // Ensure RPC textarea and rank are loaded with chain-specific data after import
    setTimeout(() => {
      if (window.chainManager) {
        const currentChainName = window.chainManager.getCurrentConfig()?.name || 'Unknown';
        const rpcTextarea = document.getElementById('customRPC');
        if (rpcTextarea) {
          const chainRPCs = window.chainManager.getRPCEndpoints();
          const rpcString = chainRPCs.join('\n');
          rpcTextarea.value = rpcString;
          window.__setRpcLastValueForChain?.(window.chainManager.getCurrentChain(), rpcString);
          console.log(`[Import] Loaded ${chainRPCs.length} ${currentChainName} RPCs into textarea after import`);
        }

        // Force refresh of chain-specific global rank to prevent cross-contamination
        if (typeof fetchXenGlobalRank === 'function') {
          console.log(`[Import] Refreshing ${currentChainName} global rank after import`);
          fetchXenGlobalRank().catch(e => console.warn('Failed to refresh rank after import:', e));
        }
      }
    }, 100);

    return;
  }

  // Handle legacy format (backward compatibility)
  console.log('[Settings] Applying legacy settings format...');
  const targetChain = settings.selectedChain || window.chainManager?.getCurrentChain() || 'ETHEREUM';
  const chainPrefix = targetChain === 'BASE' ? 'BASE_' : (targetChain === 'AVALANCHE' ? 'AVALANCHE_' : 'ETHEREUM_');

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
  setVal("ethAddress", settings.ethAddress);
  // Don't restore customRPC form field for legacy format either
  // setVal("customRPC", settings.customRPC);
  setVal("etherscanApiKey", settings.etherscanApiKey);
  setVal("chunkSize", settings.chunkSize);
  setVal("cointoolBatchSize", settings.cointoolBatchSize);
  setVal("cointoolBatchDelay", settings.cointoolBatchDelay);
  setVal("gasRefreshSeconds", settings.gasRefreshSeconds);
  setVal("mintTermDays", settings.mintTermDays);

  // Save addresses with chain prefix
  if (typeof settings.ethAddress === "string") {
    if (window.chainStorage) {
      window.chainStorage.setItem("ethAddress", settings.ethAddress);
    } else {
      localStorage.setItem("ethAddress", settings.ethAddress);
    }
  }
  if (typeof settings.customRPC === "string") {
    // Save chain-specific customRPC
    if (window.chainManager) {
      const rpcList = settings.customRPC.split('\n').filter(Boolean);
      window.chainManager.saveRPCEndpoints(rpcList, targetChain);
      window.__setRpcLastValueForChain?.(targetChain, settings.customRPC);
    } else {
      const customKey = chainPrefix + "customRPC";
      localStorage.setItem(customKey, settings.customRPC);
      localStorage.setItem(`${targetChain}_customRPC_source`, targetChain);
      localStorage.setItem(`${targetChain}_customRPC_lastKnown`, settings.customRPC);
      window.__setRpcLastValueForChain?.(targetChain, settings.customRPC);
    }
  }
  if (typeof settings.etherscanApiKey === "string") localStorage.setItem("etherscanApiKey", settings.etherscanApiKey);
  if (settings.chunkSize != null) localStorage.setItem("chunkSize", String(settings.chunkSize));
  if (settings.cointoolBatchSize != null) localStorage.setItem("cointoolBatchSize", String(settings.cointoolBatchSize));
  if (settings.cointoolBatchDelay != null) localStorage.setItem("cointoolBatchDelay", String(settings.cointoolBatchDelay));
  if (typeof settings.etherscanThrottleMs === "string") localStorage.setItem("etherscanThrottleMs", settings.etherscanThrottleMs);
  if (settings.gasRefreshSeconds != null) localStorage.setItem("gasRefreshSeconds", String(settings.gasRefreshSeconds));
  if (settings.mintTermDays != null) {
    // Save chain-specific mintTermDays
    localStorage.setItem(chainPrefix + "mintTermDays", String(settings.mintTermDays));
  }
  if (settings.onboardingDismissed != null) {
    // Save chain-specific onboardingDismissed
    localStorage.setItem(chainPrefix + "onboardingDismissed", String(settings.onboardingDismissed));
  }
  if (settings.etherscanApiKeyVisible != null) localStorage.setItem("etherscanApiKeyVisible", String(settings.etherscanApiKeyVisible));
  if (settings.ethAddressMasked != null) localStorage.setItem("ethAddressMasked", String(settings.ethAddressMasked));
  if (settings.connectWalletMasked != null) localStorage.setItem("connectWalletMasked", String(settings.connectWalletMasked));
  if (settings.xenBreakdownExpanded != null) localStorage.setItem("xenBreakdownExpanded", String(settings.xenBreakdownExpanded));

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

  // Apply summary collapsed state from settings
  try {
    if (settings.summaryCollapsed != null) {
      const wantCollapsed = String(settings.summaryCollapsed) === 'true';
      localStorage.setItem('summaryCollapsed', wantCollapsed ? 'true' : 'false');
      // If summary UI exists now, apply immediately
      const summaryContainer = document.getElementById('summaryContainer');
      const summaryToggle = document.getElementById('summaryToggle');
      if (summaryContainer && summaryToggle) {
        if (wantCollapsed) {
          summaryContainer.style.display = 'none';
          summaryToggle.textContent = '+ Show Details';
          summaryToggle.title = 'Show summary details';
        } else {
          summaryContainer.style.display = 'block';
          summaryToggle.textContent = '− Hide Details';
          summaryToggle.title = 'Hide summary details';
        }
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

  // Ensure RPC textarea and rank are loaded with chain-specific data after legacy import
  setTimeout(() => {
    if (window.chainManager) {
      const currentChainName = window.chainManager.getCurrentConfig()?.name || 'Unknown';
      const rpcTextarea = document.getElementById('customRPC');
      if (rpcTextarea) {
        const chainRPCs = window.chainManager.getRPCEndpoints();
        rpcTextarea.value = chainRPCs.join('\n');
        console.log(`[Import Legacy] Loaded ${chainRPCs.length} ${currentChainName} RPCs into textarea after legacy import`);
      }

      // Force refresh of chain-specific global rank to prevent cross-contamination
      if (typeof fetchXenGlobalRank === 'function') {
        console.log(`[Import Legacy] Refreshing ${currentChainName} global rank after legacy import`);
        fetchXenGlobalRank().catch(e => console.warn('Failed to refresh rank after legacy import:', e));
      }
    }
  }, 100);
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
  return `wenxen-backup-${y}-${m}-${d}_${h}-${mm}-${ss}_${suffix}.json`;
}
async function exportBackup() {
  console.log(`Exporting backup for ALL chains`);

  const allDatabases = [];

  // Define all database names for all chains (ALL 7 CHAINS)
  const chains = ['ETHEREUM', 'BASE', 'AVALANCHE', 'BSC', 'MOONBEAM', 'POLYGON', 'OPTIMISM'];
  const dbTypes = [
    { suffix: 'DB_Cointool', version: 3, stores: ['mints', 'scanState', 'actionsCache'] },
    { suffix: 'DB_Xenft', version: 3, stores: ['xenfts', 'scanState', 'processProgress'] },
    { suffix: 'DB_XenftStake', version: 2, stores: ['stakes', 'scanState', 'processProgress'] },
    { suffix: 'DB_XenStake', version: 1, stores: ['stakes', 'scanState'] }
  ];

  // Export data from all chains
  for (const chain of chains) {
    // Get proper chain prefix for each chain
    let chainPrefix;
    switch (chain) {
      case 'ETHEREUM': chainPrefix = 'ETH_'; break;
      case 'BASE': chainPrefix = 'BASE_'; break;
      case 'AVALANCHE': chainPrefix = 'AVAX_'; break;
      case 'BSC': chainPrefix = 'BSC_'; break;
      case 'MOONBEAM': chainPrefix = 'GLMR_'; break;
      case 'POLYGON': chainPrefix = 'POL_'; break;
      case 'OPTIMISM': chainPrefix = 'OPT_'; break;
      default: chainPrefix = 'ETH_';
    }
    
    for (const dbType of dbTypes) {
      const dbName = chainPrefix + dbType.suffix;
      
      try {
        console.log(`Attempting to export ${dbName}...`);
        
        // Special handling for different database modules
        let db;
        let storeData = {};
        
        if (dbType.suffix === 'DB_Cointool') {
          // Cointool database
          try {
            db = await openDatabaseByName(dbName);
          } catch {
            // Skip if doesn't exist
            console.log(`${dbName} does not exist, skipping`);
            continue;
          }
          
          for (const storeName of dbType.stores) {
            try {
              storeData[storeName] = await getAllFromStore(db, storeName);
            } catch {
              storeData[storeName] = [];
            }
          }
        } else if (dbType.suffix === 'DB_Xenft') {
          // XENFT database uses different API
          if (window.xenft?.openDB && window.xenft?.getAll) {
            // Need to temporarily switch chain for xenft module
            const originalChain = window.chainManager?.getCurrentChain();
            if (window.chainManager?.setChain) {
              window.chainManager.setChain(chain, false);
            }

            try {
              db = await window.xenft.openDB();

              // Export all stores for XENFT database
              storeData.xenfts = await window.xenft.getAll(db);

              // Also export scanState and processProgress
              for (const storeName of ['scanState', 'processProgress']) {
                try {
                  storeData[storeName] = await getAllFromStore(db, storeName);
                } catch {
                  storeData[storeName] = [];
                }
              }
            } catch {
              // Initialize with empty data if database doesn't exist
              storeData.xenfts = [];
              storeData.scanState = [];
              storeData.processProgress = [];
            }

            // Restore original chain
            if (originalChain && window.chainManager?.setChain) {
              window.chainManager.setChain(originalChain, false);
            }
          } else {
            continue;
          }
        } else if (dbType.suffix === 'DB_XenftStake') {
          // XENFT Stake database
          if (window.xenftStake?.openDB) {
            // Need to temporarily switch chain
            const originalChain = window.chainManager?.getCurrentChain();
            if (window.chainManager?.setChain) {
              window.chainManager.setChain(chain, false);
            }
            
            try {
              db = await window.xenftStake.openDB();
              for (const storeName of dbType.stores) {
                try {
                  storeData[storeName] = await getAllFromStore(db, storeName);
                } catch {
                  storeData[storeName] = [];
                }
              }
            } catch {
              console.log(`Could not open ${dbName}`);
              continue;
            }
            
            // Restore original chain
            if (originalChain && window.chainManager?.setChain) {
              window.chainManager.setChain(originalChain, false);
            }
          } else {
            continue;
          }
        } else if (dbType.suffix === 'DB_XenStake') {
          // XEN Stake database
          if (window.xenStake?.openDB) {
            // Need to temporarily switch chain
            const originalChain = window.chainManager?.getCurrentChain();
            if (window.chainManager?.setChain) {
              window.chainManager.setChain(chain, false);
            }
            
            try {
              db = await window.xenStake.openDB();
              for (const storeName of dbType.stores) {
                try {
                  storeData[storeName] = await getAllFromStore(db, storeName);
                } catch {
                  storeData[storeName] = [];
                }
              }
            } catch {
              console.log(`Could not open ${dbName}`);
              continue;
            }
            
            // Restore original chain
            if (originalChain && window.chainManager?.setChain) {
              window.chainManager.setChain(originalChain, false);
            }
          } else {
            continue;
          }
        }
        
        // Only add if we have some data
        const hasData = Object.values(storeData).some(data => 
          Array.isArray(data) ? data.length > 0 : data !== null && data !== undefined
        );
        
        if (hasData) {
          allDatabases.push({
            name: dbName,
            chain: chain,
            version: dbType.version,
            stores: storeData
          });
          console.log(`Successfully exported ${dbName}`);
        }
      } catch (e) {
        console.log(`Error exporting ${dbName}:`, e);
      }
    }
  }
  
  // Also check for legacy databases
  try {
    const legacyDb = await openDB();
    const [mints, scanState, actionsCache] = await Promise.all([
      getAllFromStore(legacyDb, "mints"),
      getAllFromStore(legacyDb, "scanState"),
      getAllFromStore(legacyDb, "actionsCache").catch(() => [])
    ]);
    
    if (mints.length > 0 || scanState.length > 0) {
      allDatabases.push({
        name: "DB_Cointool",
        chain: "LEGACY",
        version: 3,
        stores: { mints, scanState, actionsCache }
      });
      console.log(`Successfully exported legacy DB_Cointool`);
    }
  } catch {}
  
  const payload = {
    fileType: "wenxen-backup",
    version: 6, // Version 6 supports all chains export
    exportedAt: new Date().toISOString(),
    exportedChain: "ALL", // Indicates this is a full backup
    settings: collectSettingsSnapshot(),
    databases: allDatabases
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const fileName = formatBackupFileName(new Date());

  // save picker → web share → anchor fallback
  // Note: File System Access API (showSaveFilePicker) saves directly to user's chosen location
  // and won't appear in Chrome's Downloads list - this is correct behavior
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

// Cleanup incorrectly named databases (with hyphens)
async function cleanupIncorrectDatabases() {
  const incorrectDatabases = [
    'BASE_DB-Xen-Stake', 'BASE_DB-Xenft-Stake',
    'ETH_DB-Xen-Stake', 'ETH_DB-Xenft-Stake',
    'DB-Xen-Stake', 'DB-Xenft-Stake'
  ];
  
  // Cleaning up incorrectly named databases
  
  for (const dbName of incorrectDatabases) {
    try {
      await deleteDatabaseByName(dbName);
      // Deleted incorrect database
    } catch (e) {
      // Database might not exist, that's ok
    }
  }
}

// Check if migration is needed by looking for old database names
async function checkIfMigrationNeeded() {
  const oldDatabases = ['DB_Cointool', 'DB_Xenft', 'DB_XenftStake', 'DB_XenStake'];
  
  for (const dbName of oldDatabases) {
    try {
      // Try to open the database - if it exists, migration is needed
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          request.result.close();
          resolve(true);
        };
        request.onerror = () => reject(false);
      });
      
      if (db) {
        console.log(`[Migration Check] Found old database: ${dbName}`);
        return true;
      }
    } catch {
      // Database doesn't exist, continue checking
    }
  }
  
  return false;
}

// Import: supports new "wenxen-backup" AND legacy "cointool-backup"
async function importBackupFromFile(file) {
  console.log('[Import] Function called with file:', file?.name);
  if (!file) return;

  // Show progress splash immediately
  window.importProgress.show();
  window.importProgress.updateProgress(5, 'Reading backup file...');

  try {
    console.log('[Import] Reading file text...');
    const text = await file.text();
    console.log('[Import] File text read, length:', text.length);

    window.importProgress.updateProgress(10, 'Parsing backup data...');

    let data;
    try {
      console.log('[Import] Parsing JSON...');
      data = JSON.parse(text);
      console.log('[Import] JSON parsed successfully, version:', data?.version, 'fileType:', data?.fileType);
      window.importProgress.updateProgress(15, 'Backup file validated successfully');
    }
    catch {
      console.error('[Import] JSON parse failed');
      window.importProgress.hide();
      alert("Invalid backup file.");
      return;
    }

    // For version 6+ backups (all chains), delete ALL databases
    const isAllChainsBackup = data?.version >= 6 && data?.exportedChain === 'ALL';
    console.log('[Import] isAllChainsBackup:', isAllChainsBackup);

    if (isAllChainsBackup) {
      window.importProgress.updateProgress(20, 'Preparing for complete data restore...');
      console.log('[Import] Deleting all databases for complete restore...');

      // First, close all open database connections
      console.log('[Import] Closing all open database connections...');
      window.importProgress.updateProgress(25, 'Closing database connections...');
      await closeOpenConnections();

      // Wait a moment for connections to fully close
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('[Import] Waiting for connections to close...');

      // Delete all chain-specific databases for complete restore (ALL 7 CHAINS)
      window.importProgress.updateProgress(30, 'Clearing existing databases...');
      const allDatabases = [
        // Ethereum
        'ETH_DB_Cointool', 'ETH_DB_Xenft', 'ETH_DB_XenftStake', 'ETH_DB_XenStake',
        // Base
        'BASE_DB_Cointool', 'BASE_DB_Xenft', 'BASE_DB_XenftStake', 'BASE_DB_XenStake',
        // Avalanche
        'AVAX_DB_Cointool', 'AVAX_DB_Xenft', 'AVAX_DB_XenftStake', 'AVAX_DB_XenStake',
        // BSC (BNB Smart Chain)
        'BSC_DB_Cointool', 'BSC_DB_Xenft', 'BSC_DB_XenftStake', 'BSC_DB_XenStake',
        // Moonbeam
        'GLMR_DB_Cointool', 'GLMR_DB_Xenft', 'GLMR_DB_XenftStake', 'GLMR_DB_XenStake',
        // Polygon
        'POL_DB_Cointool', 'POL_DB_Xenft', 'POL_DB_XenftStake', 'POL_DB_XenStake',
        // Optimism
        'OPT_DB_Cointool', 'OPT_DB_Xenft', 'OPT_DB_XenftStake', 'OPT_DB_XenStake',
        // Legacy names that might exist
        'DB_Cointool', 'DB_Xenft', 'DB_XenftStake', 'DB_XenStake'
      ];

      for (let i = 0; i < allDatabases.length; i++) {
        const dbName = allDatabases[i];
        const progress = 30 + (i / allDatabases.length) * 20; // 30-50%
        window.importProgress.updateProgress(progress, `Deleting database: ${dbName.split('_').pop()}`);

        try {
          console.log(`[Import] Deleting database: ${dbName}`);

          // Add timeout to prevent hanging
          const deletePromise = deleteDatabaseByName(dbName);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database deletion timeout')), 10000);
          });

          const result = await Promise.race([deletePromise, timeoutPromise]);
          console.log(`[Import] Deleted database: ${dbName} (result: ${result})`);
        } catch (e) {
          console.log(`[Import] Database ${dbName} deletion failed or timeout:`, e.message || e);
          // Continue with next database even if one fails
        }
      }
      console.log('[Import] Database deletion completed');
  } else {
    // Old behavior for single-chain backups
    const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
    const chainPrefix = getChainPrefix(currentChain) + '_';
    
    // Delete only current chain databases
    const chainDatabases = [
      `${chainPrefix}DB_Cointool`,
      `${chainPrefix}DB_Xenft`,
      `${chainPrefix}DB_XenftStake`,
      `${chainPrefix}DB_XenStake`
    ];
    
    for (const dbName of chainDatabases) {
      try {
        await deleteDatabaseByName(dbName);
        console.log(`[Import] Deleted chain database: ${dbName}`);
      } catch (e) {
        console.warn(`[Import] Could not delete ${dbName}:`, e);
      }
    }
  }
  
  // Clear localStorage but preserve critical items
  const preserveKeys = ['selectedChain', 'privacyAccepted', 'onboardingDismissed'];
  const preserved = {};
  for (const key of preserveKeys) {
    preserved[key] = localStorage.getItem(key);
  }
  localStorage.clear();
  for (const key of preserveKeys) {
    if (preserved[key] !== null) {
      localStorage.setItem(key, preserved[key]);
    }
  }

  // Track if we imported any old databases
  let importedOldDatabases = false;

    // New multi-DB format (supports both "wenxen-backup" and legacy "mintscanner-backup")
    if (data && (data.fileType === "wenxen-backup" || data.fileType === "mintscanner-backup") && Array.isArray(data.databases)) {
      console.log('[Import] Processing multi-DB format, databases count:', data.databases.length);

      window.importProgress.updateProgress(50, 'Restoring settings and preferences...');
      console.log('[Import] Applying settings snapshot...');
      applySettingsSnapshot(data.settings || {}); // settings first
      console.log('[Import] Settings applied');

      window.importProgress.updateProgress(55, 'Importing database content...');
      console.log('[Import] Processing databases...');

      for (let dbIndex = 0; dbIndex < data.databases.length; dbIndex++) {
        const dbDef = data.databases[dbIndex];
        const dbProgress = 55 + (dbIndex / data.databases.length) * 35; // 55-90%
        const dbName = dbDef?.name || `Database ${dbIndex + 1}`;
        window.importProgress.updateProgress(dbProgress, `Importing ${dbName.split('_').pop() || dbName}...`);
      const name = dbDef?.name;
      const stores = dbDef?.stores || {};
      const chain = dbDef?.chain;

      // Check if this is an old database name or legacy chain
      const isOldDatabase = name === "DB_Cointool" || name === "DB_Xenft" ||
                           name === "DB_XenftStake" || name === "DB_XenStake" ||
                           chain === "LEGACY";

      if (isOldDatabase) {
        importedOldDatabases = true;
        console.log(`[Import] Found old/legacy database: ${name}`);
      }

      // For version 6+ backups, directly import to the specified database
      if (data.version >= 6 && !isOldDatabase) {

        // Import directly to the chain-specific database
        if (name.endsWith("DB_Cointool")) {
          const db = await openDatabaseByName(name);
          await clearStore(db, "mints").catch(()=>{});
          await clearStore(db, "scanState").catch(()=>{});
          await clearStore(db, "actionsCache").catch(()=>{});
          await bulkPut(db, "mints", stores.mints || []);
          await bulkPut(db, "scanState", stores.scanState || []);
          if (Array.isArray(stores.actionsCache)) {
            await bulkPut(db, "actionsCache", stores.actionsCache);
          }
          console.log(`[Import] Imported ${name} with ${(stores.mints || []).length} mints`);
        }

        else if (name.endsWith("DB_Xenft")) {
          const db = await openDatabaseByName(name);
          await clearStore(db, "xenfts").catch(()=>{});
          await clearStore(db, "scanState").catch(()=>{});
          await clearStore(db, "processProgress").catch(()=>{});

          const xenftData = stores.xenfts || stores.mints || stores.xenft || [];
          // Ensure each item has Xenft_id field (the correct keyPath)
          const processedData = xenftData.map(item => {
            if (!item.Xenft_id && item.tokenId) {
              return { ...item, Xenft_id: item.tokenId };
            }
            if (!item.Xenft_id && item.ID) {
              return { ...item, Xenft_id: item.ID };
            }
            return item;
          }).filter(item => item.Xenft_id);

          if (processedData.length > 0) {
            await bulkPut(db, "xenfts", processedData);
          }
          await bulkPut(db, "scanState", stores.scanState || []);
          await bulkPut(db, "processProgress", stores.processProgress || []);
          console.log(`[Import] Imported ${processedData.length} XENFTs to ${name} with scan state`);
        }
        else if (name.endsWith("DB_XenftStake")) {
          const db = await openDatabaseByName(name);
          await clearStore(db, "stakes").catch(() => {});
          await clearStore(db, "scanState").catch(() => {});
          await clearStore(db, "processProgress").catch(() => {});
          await bulkPut(db, "stakes", stores.stakes || []);
          await bulkPut(db, "scanState", stores.scanState || []);
          await bulkPut(db, "processProgress", stores.processProgress || []);
          console.log(`[Import] Imported ${(stores.stakes || []).length} XENFT stakes to ${name} with scan state`);
        }
        else if (name.endsWith("DB_XenStake")) {
          const db = await openDatabaseByName(name);
          await clearStore(db, "stakes").catch(() => {});
          await clearStore(db, "scanState").catch(() => {});
          await bulkPut(db, "stakes", stores.stakes || []);
          await bulkPut(db, "scanState", stores.scanState || []);
          console.log(`[Import] Imported ${(stores.stakes || []).length} XEN stakes to ${name}`);
        }

        continue; // Skip old import logic for v6+ backups
      }
      
      // Handle legacy databases and old backup formats
      if (isOldDatabase) {
        // Import legacy format databases for migration
        if (name === "DB_Cointool" || chain === "LEGACY") {
          const legacyDb = await openDatabaseByName("DB_Cointool");
          await clearStore(legacyDb, "mints").catch(()=>{});
          await clearStore(legacyDb, "scanState").catch(()=>{});
          await clearStore(legacyDb, "actionsCache").catch(()=>{});
          await bulkPut(legacyDb, "mints", stores.mints || []);
          await bulkPut(legacyDb, "scanState", stores.scanState || []);
          if (Array.isArray(stores.actionsCache)) {
            await bulkPut(legacyDb, "actionsCache", stores.actionsCache);
          }
        }
        else if (name === "DB_Xenft") {
          const xenftData = stores.xenfts || stores.mints || stores.xenft || [];
          const legacyDb = await openDatabaseByName("DB_Xenft");
          await clearStore(legacyDb, "xenfts").catch(()=>{});
          await clearStore(legacyDb, "scanState").catch(()=>{});
          await clearStore(legacyDb, "processProgress").catch(()=>{});

          const processedData = xenftData.map(item => {
            if (!item.Xenft_id && item.tokenId) {
              return { ...item, Xenft_id: item.tokenId };
            }
            if (!item.Xenft_id && item.ID) {
              return { ...item, Xenft_id: item.ID };
            }
            return item;
          }).filter(item => item.Xenft_id);

          if (processedData.length > 0) {
            await bulkPut(legacyDb, "xenfts", processedData);
          }
          await bulkPut(legacyDb, "scanState", stores.scanState || []);
          await bulkPut(legacyDb, "processProgress", stores.processProgress || []);
        }
        else if (name === "DB_XenftStake") {
          const legacyDb = await openDatabaseByName("DB_XenftStake");
          await clearStore(legacyDb, "stakes").catch(() => {});
          await clearStore(legacyDb, "scanState").catch(() => {});
          await clearStore(legacyDb, "processProgress").catch(() => {});
          await bulkPut(legacyDb, "stakes", stores.stakes || []);
          await bulkPut(legacyDb, "scanState", stores.scanState || []);
          await bulkPut(legacyDb, "processProgress", stores.processProgress || []);
        }
        else if (name === "DB_XenStake") {
          const legacyDb = await openDatabaseByName("DB_XenStake");
          await clearStore(legacyDb, "stakes").catch(() => {});
          await clearStore(legacyDb, "scanState").catch(() => {});
          await bulkPut(legacyDb, "stakes", stores.stakes || []);
          await bulkPut(legacyDb, "scanState", stores.scanState || []);
        }
      }
    }

      // Force migration if we imported old databases or if old databases exist
      window.importProgress.updateProgress(90, 'Finalizing import...');

      if (importedOldDatabases || await checkIfMigrationNeeded()) {
        window.importProgress.updateProgress(95, 'Preparing data migration...');
        console.log("[Import] Forcing migration on reload due to old databases");
        // Clear ALL migration flags to force migration
        localStorage.removeItem('dbMigrationCompleted');
        localStorage.removeItem('ETH_dbMigrationCompleted');
        localStorage.removeItem('BASE_dbMigrationCompleted');
        localStorage.removeItem('localStorageMigrated');
        localStorage.removeItem('ETH_localStorageMigrated');
        localStorage.removeItem('BASE_localStorageMigrated');
      }

      window.importProgress.updateProgress(100, 'Import completed! Reloading application...');

      // Navigate to dashboard after a brief delay to show completion
      setTimeout(() => {
        window.importProgress.hide();
        // Use URL with hash to go directly to dashboard
        window.location.href = window.location.origin + window.location.pathname + '#dashboard';
        window.location.reload();
      }, 1500); // Give user time to see completion
      return;
    }

    // Legacy single-DB format (always uses old DB_Cointool)
    if (!data || data.fileType !== "cointool-backup" || !data.stores) {
      window.importProgress.hide();
      alert("Invalid backup structure.");
      return;
    }

  // Import to legacy DB_Cointool database
  const legacyDb = await openDatabaseByName("DB_Cointool");
  await clearStore(legacyDb, "mints");
  await clearStore(legacyDb, "scanState");
  await bulkPut(legacyDb, "mints", data.stores.mints || []);
  await bulkPut(legacyDb, "scanState", data.stores.scanState || []);
  applySettingsSnapshot(data.settings || {});

  // Legacy format always needs migration
  alert("Legacy backup imported. Migration will run on reload.");
  console.log("[Import] Legacy backup format detected, forcing migration on reload");
  
  // Clear ALL migration flags to force migration
  localStorage.removeItem('dbMigrationCompleted');
  localStorage.removeItem('ETH_dbMigrationCompleted');
  localStorage.removeItem('BASE_dbMigrationCompleted');
  localStorage.removeItem('localStorageMigrated');
  localStorage.removeItem('ETH_localStorageMigrated');
  localStorage.removeItem('BASE_localStorageMigrated');
  
  // Navigate to dashboard
  setTimeout(() => {
    window.importProgress.hide();
    // Use URL with hash to go directly to dashboard
    window.location.href = window.location.origin + window.location.pathname + '#dashboard';
    window.location.reload();
  }, 100);

  } catch (error) {
    console.error('[Import] Import failed:', error);
    window.importProgress.hide();
    alert(`Import failed: ${error.message || 'Unknown error'}`);
    throw error; // Re-throw for the outer handler
  }
}

// Promise-based DB deletion with blocked handling and timeout
function deleteDatabaseByName(name) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`[DB Delete] Attempting to delete database: ${name}`);
      const req = indexedDB.deleteDatabase(name);

      req.onsuccess = () => {
        console.log(`[DB Delete] Successfully deleted: ${name}`);
        resolve('success');
      };

      req.onerror = (e) => {
        console.warn(`[DB Delete] Error deleting ${name}:`, e.target?.error?.message || 'Unknown error');
        reject(e.target?.error || new Error('delete failed'));
      };

      req.onblocked = () => {
        console.warn(`[DB Delete] Deletion blocked for ${name} (another tab has it open)`);
        resolve('blocked'); // another tab holds it open
      };

      // Add internal timeout for this specific operation
      setTimeout(() => {
        console.warn(`[DB Delete] Internal timeout for ${name}`);
        resolve('timeout');
      }, 8000);

    } catch (e) {
      console.warn(`[DB Delete] Exception deleting ${name}:`, e.message || e);
      resolve('success'); // if deleteDatabase throws (rare), treat as best-effort
    }
  });
}

// Helper function to open database by name with schema
function openDatabaseByName(name) {
  return new Promise((resolve, reject) => {
    // Determine version and schema based on database name
    let version = 1;
    if (name.includes("Cointool")) version = 3;
    else if (name.includes("XenftStake")) version = 2;
    else if (name.includes("Xenft")) version = 3; // Updated for scanState and processProgress stores
    
    const request = indexedDB.open(name, version);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create stores based on database type
      if (name.includes("Cointool")) {
        if (!db.objectStoreNames.contains("mints")) {
          db.createObjectStore("mints", { keyPath: "ID" });
        }
        if (!db.objectStoreNames.contains("scanState")) {
          db.createObjectStore("scanState", { keyPath: "address" });
        }
        if (!db.objectStoreNames.contains("actionsCache")) {
          db.createObjectStore("actionsCache", { keyPath: "address" });
        }
      } else if (name.includes("XenftStake")) {
        if (!db.objectStoreNames.contains("stakes")) {
          db.createObjectStore("stakes", { keyPath: "tokenId" });
        }
        if (!db.objectStoreNames.contains("scanState")) {
          db.createObjectStore("scanState", { keyPath: "address" });
        }
        if (!db.objectStoreNames.contains("processProgress")) {
          db.createObjectStore("processProgress", { keyPath: "id" });
        }
      } else if (name.includes("Xenft")) {
        if (!db.objectStoreNames.contains("xenfts")) {
          db.createObjectStore("xenfts", { keyPath: "Xenft_id" });
        }
        if (!db.objectStoreNames.contains("scanState")) {
          db.createObjectStore("scanState", { keyPath: "address" });
        }
        if (!db.objectStoreNames.contains("processProgress")) {
          db.createObjectStore("processProgress", { keyPath: "id" });
        }
      } else if (name.includes("XenStake")) {
        if (!db.objectStoreNames.contains("stakes")) {
          const store = db.createObjectStore("stakes", { keyPath: "id" });
          store.createIndex("byOwner", "owner", { unique: false });
        }
        if (!db.objectStoreNames.contains("scanState")) {
          db.createObjectStore("scanState", { keyPath: "address" });
        }
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = () => reject(new Error(`Failed to open database: ${name}`));
  });
}

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

// Wire up the chips once
(function initStatusChips(){
  const container = document.querySelector('.filter-chips');
  if (!container) return;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    const downloadOption = e.target.closest('.download-option');

    // Handle download option clicks
    if (downloadOption && window.innerWidth <= 768) {
      const action = downloadOption.dataset.action;
      if (action === 'csv' && window.cointoolTable) {
        window.cointoolTable.download("csv", "cointool-mints-detailed.csv");
      } else if (action === 'json' && window.cointoolTable) {
        window.cointoolTable.download("json", "cointool-mints-detailed.json");
      }
      container.classList.remove('expanded');
      return;
    }

    if (!btn) return;

    // Check if mobile view and handle dropdown
    if (window.innerWidth <= 768) {
      const currentActive = container.querySelector('.chip.active');
      if (btn === currentActive) {
        // Toggle dropdown
        container.classList.toggle('expanded');

        if (container.classList.contains('expanded')) {
          updateMobileDropdownContent();
        }
        return;
      } else if (container.classList.contains('expanded')) {
        // Select option and close dropdown
        container.classList.remove('expanded');
      }
    }

    // Toggle active highlight
    container.querySelectorAll('.chip').forEach(chip => {
      chip.classList.toggle('active', chip === btn);
      // Remove mobile-visible class since we now have an active chip
      if (chip !== btn) {
        chip.classList.remove('mobile-visible');
      }
    });

    const action = btn.dataset.filter || '';

    if (action === '') {
      // All: clear all header filters and ensure Status is set to All
      if (window.cointoolTable && window.tableReady) {
        window.cointoolTable.clearHeaderFilter();
        try { window.cointoolTable.setHeaderFilterValue('Status', ''); } catch (_) {}
        try { window.cointoolTable.setSort('Maturity_Date_Fmt', 'asc'); } catch (_) {}
        console.log('[Filter] Applied "All" filter immediately');
        // Force immediate XEN badge update
        setTimeout(() => updateXENTotalBadge(), 100);
      } else {
        console.log('[Filter] Table not ready - queueing "All" filter');
        // Queue the action to run when table is ready
        setTimeout(() => {
          if (window.cointoolTable && window.tableReady) {
            window.cointoolTable.clearHeaderFilter();
            try { window.cointoolTable.setHeaderFilterValue('Status', ''); } catch (_) {}
            try { window.cointoolTable.setSort('Maturity_Date_Fmt', 'asc'); } catch (_) {}
            console.log('[Filter] Applied queued "All" filter');
            // Force immediate XEN badge update
            setTimeout(() => updateXENTotalBadge(), 100);
          }
        }, 500);
      }
      return;
    }

    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth(); // 0..11
    let maturityValue;
    let statusValue = ''; // Default to no status filter

    switch (action) {
      case 'all-maturing':
        maturityValue = ''; // No date filter
        statusValue = 'Maturing';
        break;
      case 'this-month':
        maturityValue = `${y} ${MONTHS[m]}`;
        statusValue = 'Maturing';
        break;
      case 'next-month':
        m = (m + 1) % 12;
        if (m === 0) y += 1;
        maturityValue = `${y} ${MONTHS[m]}`;
        break;
      case 'this-year':
        maturityValue = String(y);
        statusValue = 'Maturing';
        break;
      case 'next-year':
        maturityValue = String(y + 1);
        break;
      case 'year-plus-2':
        maturityValue = String(y + 2);
        break;
      case 'year-plus-3':
        maturityValue = String(y + 3);
        break;
      default:
        maturityValue = '';
    }

    // Apply the maturity filter (month/year or year only; no day part)
    if (window.tableReady) {
      setMaturityHeaderFilterText(maturityValue);
      // Apply the status filter
      try { window.cointoolTable?.setHeaderFilterValue('Status', statusValue); } catch (_) {}
      // For 'this-year' filter, also reset Type to 'All'
      if (action === 'this-year') {
        try { window.cointoolTable?.setHeaderFilterValue('SourceType', ''); } catch (_) {}
      }
      try { window.cointoolTable?.setSort('Maturity_Date_Fmt', 'asc'); } catch (_) {}
      console.log(`[Filter] Applied "${btn.textContent.trim()}" filter immediately`);
      // Force immediate XEN badge update
      setTimeout(() => updateXENTotalBadge(), 100);
    } else {
      console.log(`[Filter] Table not ready - queueing "${btn.textContent.trim()}" filter`);
      // Queue the action to run when table is ready
      setTimeout(() => {
        if (window.tableReady) {
          setMaturityHeaderFilterText(maturityValue);
          try { window.cointoolTable?.setHeaderFilterValue('Status', statusValue); } catch (_) {}
          if (action === 'this-year') {
            try { window.cointoolTable?.setHeaderFilterValue('SourceType', ''); } catch (_) {}
          }
          try { window.cointoolTable?.setSort('Maturity_Date_Fmt', 'asc'); } catch (_) {}
          console.log(`[Filter] Applied queued "${btn.textContent.trim()}" filter`);
          // Force immediate XEN badge update
          setTimeout(() => updateXENTotalBadge(), 100);
        }
      }, 500);
    }
  });

  // Handle window resize to close mobile dropdown when switching to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      container.classList.remove('expanded');
      // Remove download options when switching to desktop
      container.querySelectorAll('.download-option').forEach(option => option.remove());
    }
    initMobileState();
  });
})();

// Backup & Restore wiring (runs after DOM is available)
(function wireBackupRestore(){
  const exportBtn  = document.getElementById("exportBackupBtn");
  const importInput = document.getElementById("importBackupInput");
  const importBtn = document.getElementById("importBackupBtn"); // The import button

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const ok = confirm("Export backup of your data?");
      if (ok) {
        exportBackup();
      }
    });
  }

  if (importBtn && importInput) {
    // For iOS compatibility, we need to trigger file input on the first user interaction
    // iOS Safari blocks file input clicks that come after async operations like confirm()
    
    // Handle clicks on the button.
    importBtn.addEventListener("click", (e) => {
      // Show confirmation dialog
      const ok = confirm(
        "This will permanently DELETE your current databases before importing.\n\nContinue?"
      );
      if (!ok) return;
      
      // Trigger file input immediately to maintain user gesture context
      importInput.click();
    });

    // Handle keyboard accessibility (Enter/Space).
    importBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        importBtn.click(); // Trigger the same click handler
      }
    });

    // The actual import happens when a file is selected via the input.
    importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0];
      if (file) {
        try {
          console.log('[Import] Starting import process...');

          // Add timeout protection to prevent hanging (increased for large datasets)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Import timeout after 120 seconds')), 120000);
          });

          // Race between import and timeout
          await Promise.race([
            importBackupFromFile(file),
            timeoutPromise
          ]);

          console.log('[Import] Import process completed successfully');
        } catch (error) {
          console.error('[Import] Import failed:', error);
          alert(`Import failed: ${error.message || 'Unknown error'}`);
        }
      }
      // Reset the input so the user can select the same file again if needed.
      importInput.value = "";
    });
  }
})();




try { updateNetworkBadge(); } catch {}
document.getElementById('connectWalletBtn')?.addEventListener('click', handleWalletConnectClick);

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
  
  // Initialize estXenTotal tooltip - replaced by xen-breakdown.js
  // initializeXenTotalTooltip();

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

  // wire refresh button next to estXenUsd
  const refreshBtn = document.getElementById('refreshXenBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      refreshBtn.disabled = true;
      refreshBtn.classList.add('refreshing');
      
      try {
        // Refresh both XEN price and crank data, with minimum 1-second delay for visual feedback
        await Promise.all([
          Promise.all([
            fetchXenUsdPrice(),
            fetchXenGlobalRank()
          ]),
          new Promise(resolve => setTimeout(resolve, 1000))
        ]);
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('refreshing');
      }
    });
  }

  // wire GitHub button
  const githubBtn = document.getElementById('githubBtn');
  if (githubBtn) {
    githubBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.open('https://github.com/JozefJarosciak/wenxen.com', '_blank', 'noopener,noreferrer');
    });
  }

  // wire summary container collapse/expand
  const summaryContainer = document.getElementById('summaryContainer');
  const summaryToggle = document.getElementById('summaryToggle');
  if (summaryContainer && summaryToggle) {
    // Load saved state from localStorage
    const savedState = localStorage.getItem('summaryCollapsed');
    const isCollapsed = savedState === 'true';
    
    if (isCollapsed) {
      summaryContainer.style.display = 'none';
      summaryToggle.textContent = '+ Show Details';
      summaryToggle.title = 'Show summary details';
    }

    summaryToggle.addEventListener('click', (e) => {
      e.preventDefault();
      const isCurrentlyHidden = summaryContainer.style.display === 'none';
      
      if (isCurrentlyHidden) {
        // Show
        summaryContainer.style.display = 'block';
        summaryToggle.textContent = '− Hide Details';
        summaryToggle.title = 'Hide summary details';
        localStorage.setItem('summaryCollapsed', 'false');
      } else {
        // Hide
        summaryContainer.style.display = 'none';
        summaryToggle.textContent = '+ Show Details';
        summaryToggle.title = 'Show summary details';
        localStorage.setItem('summaryCollapsed', 'true');
      }
    });
  }

  // initial fetch + periodic refresh (optional)
  fetchXenUsdPrice();
  setInterval(fetchXenUsdPrice, 60_000);
  
  // Refresh XEN price when chain changes
  if (window.chainManager) {
    window.chainManager.onChainChange(() => {
      console.log('Chain changed, refreshing XEN/CBXEN price');
      fetchXenUsdPrice();
    });
  }
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
    // Get chain-specific RPCs
    if (window.chainManager) {
      const rpcs = window.chainManager.getRPCEndpoints();
      return rpcs.length > 0 ? rpcs : [DEFAULT_RPC];
    }
    // Fallback to DEFAULT_RPC if chainManager not available
    console.log(`[RPC Util] Chain manager not available, using DEFAULT_RPC`);
    return [DEFAULT_RPC];
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
    const currentChain = window.chainManager?.getCurrentChain() || 'ETHEREUM';
    //console.log(`Gas Watcher: Fetching gas for ${currentChain} using RPCs:`, rpcList);
    
    if (!rpcList.length) {
      console.warn("Gas Watcher: No RPC endpoints configured.");
      updateDisplay(null, "No RPCs configured");
      return;
    }

    // Always create new Web3 instance with current RPC to ensure we're using the right chain
    web3Gas = new Web3(rpcList[0]);
    currentRpcIndex = 0;

    const maxAttempts = rpcList.length * 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const startTime = performance.now();
        const wei = await web3Gas.eth.getGasPrice();
        const latency = Math.round(performance.now() - startTime);
        const gwei = parseFloat(Web3.utils.fromWei(wei, 'gwei'));
        //console.log(`Gas Watcher: Got gas price ${gwei} gwei from ${rpcList[currentRpcIndex]} (latency: ${latency}ms)`);

        if (isFinite(gwei)) {
          updateDisplay(gwei, null, rpcList[currentRpcIndex], latency);
          startHeaderGasCountdown(getGasRefreshMs()); // Use the dynamic value
          return;
        }
      } catch (error) {
        //console.warn(`Gas Watcher: Failed to get gas price from ${rpcList[currentRpcIndex]}.`);
        switchRpc(); // Try next RPC
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    updateDisplay(null, "All RPCs failed");
  }

  function updateDisplay(gwei, errorMsg = null, rpcUrl = null, latency = null) {
    const now = new Date();
    const chainName = window.chainManager?.getCurrentConfig()?.name || 'Ethereum';
    const tooltip = document.getElementById('gasTooltip');
    
    if (gwei !== null) {
      headerGasEl.textContent = `${gwei.toFixed(2)} gwei`;
      
      // Update HTML tooltip elements
      if (tooltip) {
        const latencyEl = document.getElementById('gasLatency');
        const priceEl = document.getElementById('gasPrice');
        const rpcEl = document.getElementById('gasRpcEndpoint');
        const updateEl = document.getElementById('gasLastUpdate');
        
        if (latencyEl) latencyEl.textContent = latency ? `${latency} ms` : '-';
        if (priceEl) priceEl.textContent = `${gwei.toFixed(2)} Gwei`;
        if (rpcEl) {
          rpcEl.textContent = rpcUrl ? new URL(rpcUrl).hostname : '-';
          rpcEl.title = rpcUrl || '';
        }
        if (updateEl) updateEl.textContent = now.toLocaleTimeString();
        
        // Show tooltip on hover
        tooltip.removeAttribute('hidden');
      }
      
      // Keep native tooltip as fallback
      headerGasEl.title = `${chainName} Gas: ${gwei.toFixed(2)} gwei`;
    } else {
      headerGasEl.textContent = '... gwei';
      headerGasEl.title = `Failed to refresh ${chainName} gas price. ${errorMsg || ''}`;
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

  // Wait for chainManager to be ready before starting
  function startWhenReady() {
    if (window.chainManager && window.chainManager.initialized) {
      startWatcher(); // Initial start after chain is properly loaded
    } else {
      // Try again in a moment
      setTimeout(startWhenReady, 50);
    }
  }
  startWhenReady();
  
  // Restart gas watcher when chain changes
  if (window.chainManager) {
    window.chainManager.onChainChange(() => {
      console.log('Chain changed, restarting gas price watcher');
      // Reset web3 instance to force new RPC
      web3Gas = null;
      currentRpcIndex = 0;
      startWatcher();
    });
  }

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
    // Don't remove chainChanged listeners - networkSelector needs them for app/wallet sync
    try { window.ethereum?.removeAllListeners?.('accountsChanged'); } catch {}
  } catch (e) { console.warn('disconnectWallet: ', e); }
}

function handleWalletConnectClick(){
  try {
    if (!isPrivacyAccepted()) { openPrivacyModal(); return; }
    if (isWalletConnected()) { disconnectWallet(); } else { connectWallet(); }
  } catch {}
}

// Utility function to force database migration (for debugging)
window.forceDatabaseMigration = async function() {
  console.log('Forcing database migration...');
  
  // Clear the migration flag to force re-migration
  localStorage.removeItem('dbMigrationCompleted');
  
  // Import and run the migrator
  try {
    const { dbMigrator } = await import('./js/utils/databaseMigration.js');
    const results = await dbMigrator.migrate();
    console.log('Migration results:', results);
    
    // Reload the page to use the new databases
    setTimeout(() => {
      console.log('Reloading page to apply changes...');
      window.location.reload();
    }, 2000);
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

// Utility function to list all IndexedDB databases (for debugging)
window.listAllDatabases = async function() {
  try {
    if (indexedDB.databases) {
      const databases = await indexedDB.databases();
      console.log('Current IndexedDB databases:');
      databases.forEach(db => {
        console.log(`  - ${db.name} (version ${db.version})`);
      });
      return databases;
    } else {
      console.log('Browser does not support indexedDB.databases()');
      
      // Try to open known databases (including old hyphenated names for cleanup)
      const knownDbs = [
        // Legacy correct names
        'DB_Cointool', 'DB_Xenft', 'DB_XenStake', 'DB_XenftStake',
        // Old incorrect hyphenated names (for cleanup)
        'DB-Xen-Stake', 'DB-Xenft-Stake',
        // Current chain-specific names
        'ETH_DB_Cointool', 'ETH_DB_Xenft', 'ETH_DB_XenStake', 'ETH_DB_XenftStake',
        'BASE_DB_Cointool', 'BASE_DB_Xenft', 'BASE_DB_XenStake', 'BASE_DB_XenftStake'
      ];
      
      console.log('Checking known database names:');
      for (const name of knownDbs) {
        try {
          const request = indexedDB.open(name);
          await new Promise((resolve, reject) => {
            request.onsuccess = () => {
              const db = request.result;
              console.log(`  - ${name} exists (version ${db.version})`);
              db.close();
              resolve();
            };
            request.onerror = () => resolve();
          });
        } catch (e) {
          // Database doesn't exist
        }
      }
    }
  } catch (error) {
    console.error('Error listing databases:', error);
  }
};
