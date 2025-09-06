// Minimal minting for Cointool: VMUs, Term, live gas, single tx per click.
// Depends on globals from app.js & cointool-ABI.js: web3, web3Wallet, connectedAccount,
// COINTOOL_MAIN, cointoolAbi.

const XEN_MAIN = '0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8';
const DEFAULT_RPC_READ = 'https://ethereum-rpc.publicnode.com';

function fmtTs(){ return new Date().toLocaleString(); }

// Require connected wallet on Ethereum Mainnet
async function requireWalletMainnet(){
  if (!window.ethereum || !web3Wallet || !connectedAccount) {
    console.warn("Connect your wallet first.");
    throw new Error('no-wallet');
  }
  const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
  if (parseInt(chainIdHex, 16) !== 1) {
    console.warn("Switch your wallet to Ethereum Mainnet to mint.");
    throw new Error('wrong-chain');
  }
}

// Preview the maturity date: now + termDays
function formatTermDate(termDays) {
  const now = new Date();
  const ms  = Number(termDays) * 24 * 60 * 60 * 1000;
  const target = new Date(now.getTime() + ms);
  // e.g., "Fri, Aug 29, 2025"
  return target.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function updateTermPreview() {
  const termDays = Math.min(999, Math.max(1, parseInt(document.getElementById('mintTermDays').value || '1', 10)));
  const el = document.getElementById('termDatePreview');
  if (el) el.textContent = formatTermDate(termDays);
  try { localStorage.setItem('mintTermDays', String(termDays)); } catch {}
}

function updateStakeTermPreview() {
  const termDays = Math.min(1000, Math.max(1, parseInt(document.getElementById('stakeTermDays').value || '1', 10)));
  const el = document.getElementById('stakeDatePreview');
  if (el) el.textContent = formatTermDate(termDays);
}

// Human-readable short number (max 2 decimals)
function formatShortNumber(n) {
  if (n === null || n === undefined || n === '') return '';
  const v = Number(String(n).replace(/[^0-9.]/g, ''));
  if (!isFinite(v)) return '';
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v/1e12).toFixed(2).replace(/\.00$/,'') + 'T';
  if (abs >= 1e9 ) return (v/1e9 ).toFixed(2).replace(/\.00$/,'') + 'B';
  if (abs >= 1e6 ) return (v/1e6 ).toFixed(2).replace(/\.00$/,'') + 'M';
  if (abs >= 1e3 ) return (v/1e3 ).toFixed(2).replace(/\.00$/,'') + 'K';
  return v.toString();
}

// Fetch current max term (days) from XEN and update preview (no wallet required)
async function setMaxTermFromXEN(){
  try{
    let provider = null;
    // Prefer user RPC if present; fall back to default public mainnet RPC
    try {
      const rpcFromDom = (document.getElementById('customRPC')?.value || '').trim();
      const rpcFromLs  = (localStorage.getItem('customRPC') || '').trim();
      const rpcList = (rpcFromDom || rpcFromLs || DEFAULT_RPC_READ)
        .split(/\r?\n+/)
        .map(s => s.trim())
        .filter(Boolean);
      provider = new Web3(rpcList[0]);
    } catch (_) {
      provider = new Web3(DEFAULT_RPC_READ);
    }

    const xen = new provider.eth.Contract(window.xenAbi, XEN_MAIN);
    const secs = await xen.methods.getCurrentMaxTerm().call();
    const days = Math.max(1, Math.min(999, Math.floor(Number(secs)/86400)));
    document.getElementById('mintTermDays').value = String(days);
    updateTermPreview();
    try { localStorage.setItem('mintTermDays', String(days)); } catch {}
    console.log(`[MINT] Max term from XEN: ${days} day(s).`);
  }catch(e){
    console.warn('Failed to fetch max term from XEN (network/RPC issue?)', e);
  }
}

// Read shared form (platform + common + XENFT options)
function readMintForm(){
  const platform  = (document.getElementById('mintPlatform')?.value || 'cointool'); // cointool | xenft
  const vmu       = Math.max(1, parseInt(document.getElementById('mintVmus').value || '1', 10));
  const termDays  = Math.min(999, Math.max(1, parseInt(document.getElementById('mintTermDays').value || '1', 10)));
  const xenftKind = (document.getElementById('xenftKind')?.value || 'regular');     // regular | apex
  const burnRaw   = String(document.getElementById('xenftBurn')?.value || '').trim(); // XEN tokens to burn
  return { platform, vmu, termDays, xenftKind, burnRaw };
}


// Build data hex (Python parity) with term injected
function buildCointoolDataHex(termDays){
  const term3 = Number(termDays).toString(16).toLowerCase().padStart(3, '0');
  const term4 = term3.padStart(4, '0');
  const base =
    "0x" +
    "59635f6f" + // selector
    "00000000000000000000000006450dee7fd2fb8e39061434babcfc05599a6fb8" + // XEN
    "0000000000000000000000000000000000000000000000000000000000000040" +
    "0000000000000000000000000000000000000000000000000000000000000024" +
    "9ff054df" + // inner selector
    "00000000000000000000000000000000000000000000000000000000" +
    "0000XXXX" + // ← term placeholder
    "00000000000000000000000000000000000000000000000000000000";
  return base.replace('XXXX', term4);
}


// === XENFT support ===
const APEX_PRESETS = {
  rare: 500000000,
  epic: 1000000000,
  legendary: 2500000000,
  exotic: 5000000000,
  xunicorn: 10000000000,
};


const XENFT_TORRENT = '0x0a252663DBCc0b073063D6420a40319e438Cfa59';

function presetBurnForSelection(){
  const kind = (document.getElementById('xenftKind')?.value || 'regular');
  const burnEl = document.getElementById('xenftBurn');
  if (!burnEl) return;

  if (kind === 'apex') {
    const tier = (document.getElementById('apexTier')?.value || 'rare');
    burnEl.value = String(APEX_PRESETS[tier] || APEX_PRESETS.rare);
  }

  const hr = document.getElementById('xenftBurnHuman');
  if (hr) hr.textContent = formatShortNumber(burnEl.value);
}

function parseBurnToWei(burnRaw){
  if (!burnRaw) return "0";
  return Web3.utils.toWei(String(burnRaw), 'ether'); // XEN has 18 decimals
}

async function ensureXenApprovalIfNeeded(spender, requiredWei){
  const token = new web3Wallet.eth.Contract(window.xenAbi, XEN_MAIN);
  const current = await token.methods.allowance(connectedAccount, spender).call();
  if (Web3.utils.toBN(current).gte(Web3.utils.toBN(requiredWei))) return;
  await token.methods.approve(spender, requiredWei).send({ from: connectedAccount });
}

async function startCointoolMint(vmu, termDays){
  const contract = new web3Wallet.eth.Contract(cointoolAbi, COINTOOL_MAIN);
  const dataHex  = buildCointoolDataHex(termDays);
  const saltHex  = "0x01";
  let est = await contract.methods.t(vmu, dataHex, saltHex).estimateGas({ from: connectedAccount });
  est = Math.ceil(est * 1.2);
  const receipt = await contract.methods.t(vmu, dataHex, saltHex).send({ from: connectedAccount, gas: est });
  console.log(`[MINT/COINTOOL] https://etherscan.io/tx/${receipt?.transactionHash || '(pending)'}`);
}

async function startXenftMint(vmu, termDays, kind, burnRaw){
  const xenft = new web3Wallet.eth.Contract(window.xenftAbi, XENFT_TORRENT);
  if (kind === 'apex') {
    if (vmu <= 99) {
      alert("XENFT APEX requires min. 100 VMUs (contract rule). Please increase VMUs.");
      throw new Error('vmu-too-low');
    }
    const burnWei = parseBurnToWei(burnRaw);
    if (Web3.utils.toBN(burnWei).lte(Web3.utils.toBN('0'))) { alert("Enter XEN amount to burn."); throw new Error('no-burn'); }
    await ensureXenApprovalIfNeeded(XENFT_TORRENT, burnWei);
    let est = await xenft.methods.bulkClaimRankLimited(vmu, termDays, burnWei).estimateGas({ from: connectedAccount });
    est = Math.ceil(est * 1.2);
    const r = await xenft.methods.bulkClaimRankLimited(vmu, termDays, burnWei).send({ from: connectedAccount, gas: est });
    console.log(`[MINT/XENFT-APEX] https://etherscan.io/tx/${r?.transactionHash || '(pending)'}`);
    return;
  }
  // Regular XENFT
  let est = await xenft.methods.bulkClaimRank(vmu, termDays).estimateGas({ from: connectedAccount });
  est = Math.ceil(est * 1.2);
  const r = await xenft.methods.bulkClaimRank(vmu, termDays).send({ from: connectedAccount, gas: est });
  console.log(`[MINT/XENFT] https://etherscan.io/tx/${r?.transactionHash || '(pending)'}`);
}

// --- Staking ---
async function startStakeFlow(){
  if (typeof isPrivacyAccepted === 'function' && typeof openPrivacyModal === 'function') {
    if (!isPrivacyAccepted()) { openPrivacyModal(); return; }
  }
  // If wallet not connected, prompt to connect first
  if (!window.web3Wallet || !window.connectedAccount) {
    const proceed = window.confirm('Wallet not connected. Connect wallet now?');
    if (!proceed) return;
    try { await (typeof connectWallet === 'function' ? connectWallet() : Promise.resolve()); } catch {}
    if (!window.web3Wallet || !window.connectedAccount) return;
  }
  try { await requireWalletMainnet(); } catch { return; }
  const amtStr = String(document.getElementById('stakeAmount')?.value || '').trim();
  const termDays = Math.max(1, Math.min(1000, parseInt(document.getElementById('stakeTermDays')?.value || '1', 10)));
  if (!amtStr || isNaN(Number(amtStr)) || Number(amtStr) <= 0) { alert('Enter XEN amount to stake.'); return; }
  let amountWei;
  try {
    amountWei = Web3.utils.toWei(amtStr, 'ether');
  } catch(_) { alert('Invalid amount.'); return; }

  try {
    const xen = new web3Wallet.eth.Contract(window.xenAbi, XEN_MAIN);
    let est = await xen.methods.stake(amountWei, termDays).estimateGas({ from: connectedAccount });
    est = Math.ceil(est * 1.2);
    const tx = await xen.methods.stake(amountWei, termDays).send({ from: connectedAccount, gas: est });
    if (typeof showToast === 'function') showToast(`Stake submitted: ${tx.transactionHash}`, 'success');
    else alert(`Stake submitted: ${tx.transactionHash}`);
    try { if (typeof window.refreshUnified === 'function') await window.refreshUnified(); } catch {}
  } catch (err) {
    console.error('[STAKE] failed', err);
    alert(err?.message || 'Stake failed.');
  }
}

// --- Stake helpers: balance + percent shortcuts ---
window._stakeXenBalanceWei = null;

async function fetchXenBalanceWei(){
  if (!window.connectedAccount) return null;
  try {
    const acct = window.connectedAccount;
    console.debug('[STAKE] Fetching XEN balance for', acct);

    let provider = null;
    if (window.web3Wallet) {
      try {
        const cid = await window.web3Wallet.eth.getChainId();
        if (Number(cid) === 1) provider = window.web3Wallet; // use wallet if on mainnet
      } catch (_) {}
    }
    if (!provider) {
      // Fallback to read-only mainnet RPC
      provider = new Web3(DEFAULT_RPC_READ);
    }

    const token = new provider.eth.Contract(window.xenAbi, XEN_MAIN);
    const bal = await token.methods.balanceOf(acct).call();
    console.debug('[STAKE] XEN balance (wei):', bal);
    return bal; // wei string
  } catch (e) {
    console.warn('[STAKE] Failed to fetch XEN balance:', e?.message || e);
    return null;
  }
}

function updateStakeStartEnabled(){
  const btn = document.getElementById('startStakeBtn');
  const amtStr = String(document.getElementById('stakeAmount')?.value || '').trim();
  const ok = amtStr !== '' && Number(amtStr) > 0;
  if (btn) btn.disabled = !ok;
}

async function prefillStakeAmountFromBalance(showAlert){
  const amountEl = document.getElementById('stakeAmount');
  const pctWrap = document.getElementById('stakePercentOptions');
  if (!amountEl) return;

  if (!window.web3Wallet || !window.connectedAccount) {
    console.debug('[STAKE] Get Balance clicked but wallet not connected.');
    if (showAlert) alert('Connect your wallet to retrieve XEN balance.');
    if (pctWrap) pctWrap.style.display = 'none';
    return;
  }

  const wei = await fetchXenBalanceWei();
  window._stakeXenBalanceWei = wei;
  if (wei && Web3.utils.toBN(wei).gt(Web3.utils.toBN('0'))) {
    // Only prefill if empty or zero
    if (!amountEl.value || Number(amountEl.value) <= 0) {
      const BN = Web3.utils.toBN;
      const ONE = BN('1000000000000000000');
      const rounded = BN(wei).div(ONE).toString(); // round down to whole token
      amountEl.value = rounded;
    }
    if (pctWrap) pctWrap.style.display = '';
  } else {
    console.debug('[STAKE] Zero or missing XEN balance.');
    if (pctWrap) pctWrap.style.display = 'none';
  }
  updateStakeStartEnabled();
}

function attachStakePercentHandlers(){
  const wrap = document.getElementById('stakePercentOptions');
  if (!wrap) return;
  wrap.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t && t.matches && t.matches('button[data-pct]'))) return;
    const pct = parseInt(t.getAttribute('data-pct'), 10);
    if (!window._stakeXenBalanceWei || !Number.isFinite(pct)) return;
    const BN = Web3.utils.toBN;
    const ONE = BN('1000000000000000000');
    const wei = BN(window._stakeXenBalanceWei);
    const val = wei.mul(BN(String(pct))).div(BN('100'));
    const rounded = val.div(ONE).toString(); // round down to whole token
    const amountEl = document.getElementById('stakeAmount');
    if (amountEl) amountEl.value = rounded;
    console.debug('[STAKE] Percent click set amount to', pct + '% =', rounded, 'XEN');
    updateStakeStartEnabled();
  });
}

function roundStakeAmountFieldToWhole(){
  const el = document.getElementById('stakeAmount');
  if (!el) return;
  const v = String(el.value || '').trim();
  if (!v) return;
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  const rounded = Math.floor(n);
  el.value = String(Math.max(0, rounded));
}




// Start mint flow: route to Cointool or XENFT (Regular/APEX)
async function startMintingFlow(){
  if (typeof isPrivacyAccepted === 'function' && typeof openPrivacyModal === 'function') {
    if (!isPrivacyAccepted()) { openPrivacyModal(); return; }
  }
  // If wallet not connected, prompt to connect first
  if (!window.web3Wallet || !window.connectedAccount) {
    const proceed = window.confirm('Wallet not connected. Connect wallet now?');
    if (!proceed) return;
    try { await (typeof connectWallet === 'function' ? connectWallet() : Promise.resolve()); } catch {}
    // If still not connected after attempting, stop here
    if (!window.web3Wallet || !window.connectedAccount) return;
  }
  try { await requireWalletMainnet(); } catch { return; }
  const { platform, vmu, termDays, xenftKind, burnRaw } = readMintForm();

  try {
    if (platform === 'xenft') {
      await startXenftMint(vmu, termDays, xenftKind, burnRaw);
    } else {
      await startCointoolMint(vmu, termDays);
    }
  } catch (err) {
    console.error("[MINT] Error:", err?.message || err);
    alert(err?.message || String(err));
  }
}


// Init
(function initMintTab(){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMintTab);
    return;
  }
  document.getElementById('startMintBtn')?.addEventListener('click', startMintingFlow);
  document.getElementById('startStakeBtn')?.addEventListener('click', startStakeFlow);
  document.getElementById('btnSetMaxTerm')?.addEventListener('click', setMaxTermFromXEN);
  document.getElementById('mintTermDays')?.addEventListener('input', updateTermPreview);
  document.getElementById('btnStakeSetMaxTerm')?.addEventListener('click', () => {
    const el = document.getElementById('stakeTermDays'); if (!el) return;
    el.value = '1000'; updateStakeTermPreview();
  });
  document.getElementById('stakeTermDays')?.addEventListener('input', updateStakeTermPreview);
  document.getElementById('stakeAmount')?.addEventListener('input', updateStakeStartEnabled);
  document.getElementById('stakeAmount')?.addEventListener('blur', roundStakeAmountFieldToWhole);
  attachStakePercentHandlers();
  document.getElementById('btnStakeGetBalance')?.addEventListener('click', () => prefillStakeAmountFromBalance(true));


// NEW: toggle XENFT UI
  document.getElementById('mintPlatform')?.addEventListener('change', () => {
    const show = (document.getElementById('mintPlatform').value === 'xenft');
    if (document.getElementById('xenftOptionsRow')) document.getElementById('xenftOptionsRow').style.display = show ? '' : 'none';

    const kind = (document.getElementById('xenftKind')?.value || 'regular');
    if (document.getElementById('xenftBurnWrap')) document.getElementById('xenftBurnWrap').style.display = (show && kind === 'apex') ? '' : 'none';
    if (document.getElementById('apexTierWrap')) document.getElementById('apexTierWrap').style.display = (show && kind === 'apex') ? '' : 'none';

    if (show && kind === 'apex') presetBurnForSelection();
  });


  document.getElementById('xenftKind')?.addEventListener('change', () => {
    const kind = (document.getElementById('xenftKind')?.value || 'regular');
    const showBurn = (kind === 'apex');

    if (document.getElementById('xenftBurnWrap')) document.getElementById('xenftBurnWrap').style.display = showBurn ? '' : 'none';
    if (document.getElementById('apexTierWrap')) document.getElementById('apexTierWrap').style.display = (kind === 'apex') ? '' : 'none';

    if (showBurn) presetBurnForSelection();
  });



  document.getElementById('apexTier')?.addEventListener('change', () => {
    presetBurnForSelection();
  });
  document.getElementById('xenftBurn')?.addEventListener('input', () => {
    const hr = document.getElementById('xenftBurnHuman');
    if (hr) hr.textContent = formatShortNumber(document.getElementById('xenftBurn').value);
  });

  // Inline hint for wallet connection near Start Minting button
  window.updateMintConnectHint = function(){
    const hint = document.getElementById('mintConnectHint');
    if (!hint) return;
    const connected = !!window.connectedAccount;
    hint.style.display = connected ? 'none' : '';
  };
  window.updateMintConnectHint();

  // Inline hint for wallet connection near Start Staking button
  window.updateStakeConnectHint = function(){
    const hint = document.getElementById('stakeConnectHint');
    if (!hint) return;
    const connected = !!window.connectedAccount;
    hint.style.display = connected ? 'none' : '';
  };
  window.updateStakeConnectHint();

// first render: load saved term or fetch current max on first load
  (function(){
    const el = document.getElementById('mintTermDays');
    if (!el) return;
    const saved = (localStorage.getItem('mintTermDays') || '').trim();
    if (saved) {
      el.value = saved;
      updateTermPreview();
    } else {
      // try to fetch from XEN; if it fails, still show preview for default value
      setMaxTermFromXEN().catch(() => updateTermPreview());
    }
  })();

  // Default stake preview
  (function(){
    const el = document.getElementById('stakeTermDays');
    if (!el) return;
    el.value = '1000';
    updateStakeTermPreview();
  })();
  // DELETED: updateMintGasBadge();
  // DELETED: setInterval(updateMintGasBadge, 5000);
// initial toggle state
  (function(){
    const show = (document.getElementById('mintPlatform')?.value === 'xenft');
    const kind = (document.getElementById('xenftKind')?.value || 'regular');
    const showBurn = (kind === 'apex');
    if (document.getElementById('xenftOptionsRow')) document.getElementById('xenftOptionsRow').style.display = show ? '' : 'none';
    if (document.getElementById('xenftBurnWrap')) document.getElementById('xenftBurnWrap').style.display = showBurn ? '' : 'none';
    if (document.getElementById('apexTierWrap')) document.getElementById('apexTierWrap').style.display = (kind === 'apex') ? '' : 'none';
    if (show && showBurn) presetBurnForSelection();
  })();

  // Action toggle (Mint vs Stake)
  (function(){
    const sel = document.getElementById('mintAction');
    const onChange = () => {
      const mode = sel?.value || 'mint';
      const showStake = (mode === 'stake');
      // Hide/show minting controls/actions (not the action selector row)
      const mintCtrls = document.getElementById('mintControls');
      if (mintCtrls) mintCtrls.style.display = showStake ? 'none' : '';
      const mintActs = document.getElementById('mintActions');
      if (mintActs) mintActs.style.display = showStake ? 'none' : '';
      // Show/hide stake controls/actions
      document.getElementById('stakeControls').style.display = showStake ? '' : 'none';
      document.getElementById('stakeActions').style.display = showStake ? '' : 'none';
      if (showStake) prefillStakeAmountFromBalance();
    };
    if (sel) { sel.addEventListener('change', onChange); onChange(); }
  })();

  // Expose helpers so wallet connect flow can trigger prefill
  window.prefillStakeAmountFromBalance = prefillStakeAmountFromBalance;
  window.updateStakeStartEnabled = updateStakeStartEnabled;
})();
