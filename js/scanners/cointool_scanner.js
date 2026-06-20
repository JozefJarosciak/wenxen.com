// Cointool scanner — per-proxy storage model.
//
// Each row in the `proxies` store represents ONE on-chain CoinTool proxy
// (one (owner, salt, index) tuple). The unified view groups eligible
// proxies into virtual batch rows of size up to `cointoolMaxVmuPerTx` for
// display and execution.
//
// DB v5 schema:
//   proxies   keyPath: id  ("ownerLc-saltLc-index")
//             indices:
//               byOwner                  on Owner
//               byOwnerStatus            on [Owner, Status]
//               byOwnerSaltStatusTerm    on [Owner, Salt, Status, Term]
//               byMaturity               on Maturity_TS
//   scanState keyPath: address
//   summaryByType     keyPath: id
//   summaryByStatus   keyPath: id
//   summaryByDay      keyPath: id
//   summaryByOwner    keyPath: id
//   summaryMetadata   keyPath: id
//
// Wrapped in IIFE to avoid global variable conflicts.

(function () {
  // -----------------------------
  // Constants & helpers
  // -----------------------------

  const DB_VERSION = 5;

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

  function getCointoolAddress() {
    return (window.chainManager?.getContractAddress('COINTOOL')
         || window.appConfig?.contracts?.COINTOOL
         || '0x0dE8bf93dA2f7eecb3d9169422413A9bef4ef628').toLowerCase();
  }

  function getCointoolMintTopic() {
    return (window.chainManager?.getCurrentConfig()?.events?.COINTOOL_MINT_TOPIC
         || '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37').toLowerCase();
  }

  function getDefaultSaltBytes() {
    return (window.chainManager?.getCurrentConfig()?.constants?.COINTOOL_SALT_BYTES
         || '0x29A2241A010000000000');
  }

  // CoinTool method selectors
  const SEL_T       = '0xb1ae2ed1'; // t(uint256, bytes, bytes)
  const SEL_T_ARRAY = '0x9108e811'; // t_(uint256[], bytes, bytes)
  const SEL_F       = '0xd21ba82f'; // f(uint256[], bytes, bytes)
  // Cointool also exposes an undocumented batch method whose selector is
  // chain-config'd as REMINT_SELECTOR (0xc2580804 on Ethereum/Base/etc).
  // It takes the same (uint256[], bytes, bytes) args as f()/t_() and
  // operates on existing proxies — used by the official cointool.app for
  // its Remint action. We treat it identically to f() for decoding.
  function getRemintSelector() {
    return (window.chainManager?.getCurrentConfig()?.events?.REMINT_SELECTOR
         || '0xc2580804').toLowerCase();
  }
  // Inner cointool selectors (decoded from `data` arg of t/t_/f)
  const INNER_SEL_C    = '59635f6f'; // c(address, bytes) — used by mint and claim
  const INNER_SEL_DKILL = '5d8d647f'; // dKill — selfdestruct flavour (not used by app)
  const INNER_SEL_CKILL = 'd8156e66'; // cKill — selfdestruct external_call (claim path)
  const XEN_CLAIM_RANK_SELECTOR    = '9ff054df'; // claimRank(uint256)
  const XEN_CLAIM_REWARD_SELECTOR  = '1c560305'; // claimMintReward(uint256)
  const XEN_CLAIM_REMINT_SELECTOR  = '68154343'; // claimMintRewardAndShare(address, uint256)

  function lc(s) { return String(s || '').toLowerCase(); }

  function normalizeSaltHex(salt) {
    if (typeof salt !== 'string') return '';
    let out = salt.trim().toLowerCase();
    if (!out.startsWith('0x')) out = '0x' + out;
    let body = out.slice(2);
    if (body.length % 2 === 1) body = '0' + body;
    return '0x' + body;
  }

  function makeProxyId(owner, salt, index) {
    return `${lc(owner)}-${normalizeSaltHex(salt)}-${Number(index)}`;
  }

  function dateFmtFromTs(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return { fmt: '', key: '' };
    const dt = luxon.DateTime.fromSeconds(n);
    return { fmt: dt.toFormat('yyyy LLL dd, hh:mm a'), key: dt.toFormat('yyyy-MM-dd') };
  }

  function classifyInnerData(dataHex) {
    const s = lc(dataHex);
    if (!s) return 'unknown';
    if (s.includes(XEN_CLAIM_RANK_SELECTOR)) return 'mint';
    if (s.includes(XEN_CLAIM_REMINT_SELECTOR)) return 'remint';
    if (s.includes(XEN_CLAIM_REWARD_SELECTOR)) return 'claim';
    return 'unknown';
  }

  // CREATE2 proxy address derivation matching cointool.sol:t/t_/f.
  //   saltForHash = keccak256(salt ‖ index ‖ user)
  //   initCode    = EIP-1167 minimal proxy targeting the cointool contract
  //   address     = keccak256(0xff ‖ deployer ‖ saltForHash ‖ keccak256(initCode))[-20:]
  function computeProxyAddress(web3, deployer, index, saltHex, owner) {
    const safeSalt = normalizeSaltHex(saltHex);
    if (!safeSalt) return null;
    const dep = lc(deployer);
    if (!dep.startsWith('0x') || dep.length !== 42) return null;
    const minter = lc(owner);
    if (!minter.startsWith('0x') || minter.length !== 42) return null;

    const saltBody = safeSalt.slice(2);
    const idHex = BigInt(index).toString(16).padStart(64, '0');
    const minterHex = minter.slice(2).padStart(40, '0');
    const packed = '0x' + saltBody + idHex + minterHex;
    const saltForHash = web3.utils.keccak256(packed);

    const initCode = '0x3d602d80600a3d3981f3363d3d373d3d3d363d73' + dep.slice(2) + '5af43d82803e903d91602b57fd5bf3';
    const initCodeHash = web3.utils.keccak256(initCode);
    const combined = '0xff' + dep.slice(2) + saltForHash.slice(2) + initCodeHash.slice(2);
    return '0x' + web3.utils.keccak256(combined).slice(-40);
  }

  // -----------------------------
  // DB
  // -----------------------------

  function dbName() {
    const chain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
    return `${getChainPrefix(chain)}_DB_Cointool`;
  }

  function invalidateRenderCache() {
    try {
      if (typeof window.invalidateCointoolRenderCache === 'function') {
        window.invalidateCointoolRenderCache();
        return;
      }
      const chain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
      localStorage.setItem(`${chain}_cointoolRenderCacheInvalidatedAt`, String(Date.now()));
    } catch (_) {}
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName(), DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Drop legacy stores if upgrading from v3 or earlier.
        for (const oldName of ['mints', 'mintProgress', 'actionsCache']) {
          if (db.objectStoreNames.contains(oldName)) {
            try { db.deleteObjectStore(oldName); } catch (_) {}
          }
        }
        if (!db.objectStoreNames.contains('proxies')) {
          const s = db.createObjectStore('proxies', { keyPath: 'id' });
          s.createIndex('byOwner', 'Owner', { unique: false });
          s.createIndex('byOwnerStatus', ['Owner', 'Status'], { unique: false });
          s.createIndex('byOwnerSaltStatusTerm', ['Owner', 'Salt', 'Status', 'Term'], { unique: false });
          s.createIndex('byMaturity', 'Maturity_TS', { unique: false });
        }
        if (!db.objectStoreNames.contains('scanState')) {
          db.createObjectStore('scanState', { keyPath: 'address' });
        }
        if (!db.objectStoreNames.contains('summaryByType')) {
          const s = db.createObjectStore('summaryByType', { keyPath: 'id' });
          s.createIndex('byType', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('summaryByStatus')) {
          const s = db.createObjectStore('summaryByStatus', { keyPath: 'id' });
          s.createIndex('byType', 'type', { unique: false });
          s.createIndex('byStatus', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('summaryByDay')) {
          const s = db.createObjectStore('summaryByDay', { keyPath: 'id' });
          s.createIndex('byDate', 'date', { unique: false });
          s.createIndex('byType', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('summaryByOwner')) {
          const s = db.createObjectStore('summaryByOwner', { keyPath: 'id' });
          s.createIndex('byOwner', 'owner', { unique: false });
          s.createIndex('byType', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('summaryMetadata')) {
          db.createObjectStore('summaryMetadata', { keyPath: 'id' });
        }
      };
      req.onsuccess = (event) => resolve(event.target.result);
      req.onerror = (event) => reject(event.target.error);
      req.onblocked = () => {
        console.warn('[COINTOOL] DB open blocked — another tab/connection is holding an older version. Close other tabs of this app.');
      };
    });
  }

  function getScanState(db, address) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('scanState', 'readonly');
        const r = tx.objectStore('scanState').get(lc(address));
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      } catch (e) { resolve(null); }
    });
  }

  function putScanState(db, address, state) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('scanState', 'readwrite');
      tx.objectStore('scanState').put({
        address: lc(address),
        ...state,
        updatedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function getProxiesForOwner(db, ownerLc) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('proxies', 'readonly');
        const idx = tx.objectStore('proxies').index('byOwner');
        const req = idx.getAll(ownerLc);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (e) { resolve([]); }
    });
  }

  function getProxyById(db, id) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('proxies', 'readonly');
        const r = tx.objectStore('proxies').get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      } catch (e) { resolve(null); }
    });
  }

  // Bulk write — caps each transaction to TX_BATCH puts to avoid
  // TransactionInactiveError on huge writes.
  async function bulkPutProxies(db, records) {
    const TX_BATCH = 5000;
    if (Array.isArray(records) && records.length > 0) invalidateRenderCache();
    for (let i = 0; i < records.length; i += TX_BATCH) {
      const slice = records.slice(i, i + TX_BATCH);
      await new Promise((resolve, reject) => {
        const tx = db.transaction('proxies', 'readwrite');
        const store = tx.objectStore('proxies');
        for (const r of slice) store.put(r);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('aborted'));
      });
    }
  }

  // -----------------------------
  // Etherscan pagination
  // -----------------------------

  // Etherscan's txlist endpoint caps cumulative results at 10,000 records
  // per (address, range) regardless of pagination. For active wallets, the
  // cap fills before the range is exhausted — so we recursively split the
  // block range whenever a single page maxes out. Boundary handling: we
  // recurse INCLUDING the last block we saw, so any tx at that block that
  // didn't fit in the page still gets fetched. Final dedupe by tx hash.
  async function fetchTxsInRange(address, etherscanApiKey, fromBlock, toBlock, out, ui, depth = 0) {
    const chainId = window.chainManager?.getCurrentConfig()?.id || 1;
    const cointool = getCointoolAddress();
    const PAGE_SIZE = 10000;
    const MAX_DEPTH = 30; // safety net

    if (fromBlock > toBlock) return;

    let rows;
    if (window.explorerApiClient?.request) {
      rows = await window.explorerApiClient.request({
        module: 'account',
        action: 'txlist',
        address,
        startblock: fromBlock,
        endblock: toBlock,
        page: 1,
        offset: PAGE_SIZE,
        sort: 'asc'
      }, etherscanApiKey, { timeoutMs: 60000 });
    } else {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=${fromBlock}&endblock=${toBlock}&page=1&offset=${PAGE_SIZE}&sort=asc&apikey=${etherscanApiKey}`;
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 60000);
      try {
        const res = await fetch(url, { signal: ctl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        rows = data.status === '1' && Array.isArray(data.result) ? data.result : [];
      } catch (e) {
        clearTimeout(t);
        throw e;
      }
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      ui?.setStage?.(`Fetching ${address}: blocks ${fromBlock}-${toBlock} → 0 txs (${out.length} cointool so far)`, 0, 1);
      return;
    }

    const filtered = rows.filter(tx =>
      lc(tx.to) === cointool &&
      String(tx.isError || '0') === '0' &&
      lc(tx.from) === lc(address)
    );
    out.push(...filtered);

    if (rows.length >= PAGE_SIZE && depth < MAX_DEPTH) {
      const lastBlock = Number(rows[rows.length - 1].blockNumber);
      if (!Number.isFinite(lastBlock)) return;

      if (lastBlock >= toBlock) {
        // Pathological: 10K+ txs all within [fromBlock, toBlock] and lastBlock
        // == toBlock. Bisect to make progress.
        if (fromBlock < toBlock) {
          const mid = Math.floor((fromBlock + toBlock) / 2);
          console.log(`[COINTOOL] ${address}: blocks ${fromBlock}-${toBlock} dense (lastBlock=${lastBlock}=toBlock), bisecting at ${mid}`);
          await new Promise(r => setTimeout(r, 200));
          await fetchTxsInRange(address, etherscanApiKey, fromBlock, mid, out, ui, depth + 1);
          await new Promise(r => setTimeout(r, 200));
          await fetchTxsInRange(address, etherscanApiKey, mid + 1, toBlock, out, ui, depth + 1);
        } else {
          console.warn(`[COINTOOL] ${address}: 10K+ txs in single block ${fromBlock}, may miss some`);
        }
        return;
      }

      // Recurse INCLUDING lastBlock so any txs there that didn't fit in
      // this page are fetched. Final dedupe is done by fetchAllCointoolTxs.
      console.log(`[COINTOOL] ${address}: blocks ${fromBlock}-${toBlock} hit 10K cap (lastBlock=${lastBlock}), recursing from ${lastBlock} (depth ${depth + 1}, cointool so far ${out.length})`);
      ui?.setStage?.(`Fetching ${address}: blocks ${lastBlock}-${toBlock} (${out.length} cointool so far)`, 0, 1);
      await new Promise(r => setTimeout(r, 200));
      await fetchTxsInRange(address, etherscanApiKey, lastBlock, toBlock, out, ui, depth + 1);
      return;
    }

    console.log(`[COINTOOL] ${address}: blocks ${fromBlock}-${toBlock} → ${filtered.length}/${rows.length} cointool txs (total ${out.length})`);
    ui?.setStage?.(`Fetching ${address}: blocks ${fromBlock}-${toBlock} (${out.length} cointool txs)`, 0, 1);
  }

  async function fetchAllCointoolTxs(address, etherscanApiKey, fromBlock, toBlock, ui) {
    const out = [];
    await fetchTxsInRange(address, etherscanApiKey, fromBlock, toBlock, out, ui, 0);
    out.sort((a, b) => (Number(a.blockNumber) - Number(b.blockNumber)) || (Number(a.transactionIndex || 0) - Number(b.transactionIndex || 0)));
    // Dedupe in case range overlap produced duplicates.
    const seen = new Set();
    return out.filter(tx => {
      const h = lc(tx.hash);
      if (seen.has(h)) return false;
      seen.add(h);
      return true;
    });
  }

  // -----------------------------
  // Tx decoding
  // -----------------------------

  // Returns { kind, indices[], salt, dataHex, payloadKind } for a tx, or null.
  function decodeCointoolTx(web3, tx, countersBySalt) {
    const input = String(tx.input || '');
    if (!input.startsWith('0x') || input.length < 10) return null;
    const sel = input.slice(0, 10).toLowerCase();
    const body = '0x' + input.slice(10);

    try {
      if (sel === SEL_T) {
        const decoded = web3.eth.abi.decodeParameters(['uint256', 'bytes', 'bytes'], body);
        const total = Number(decoded[0]);
        const dataHex = decoded[1];
        const salt = normalizeSaltHex(decoded[2]);
        // Defer index assignment — we need on-chain map at block-1 to know
        // the real start index. Caller fills indices[] after probing.
        return { kind: 'create-new', indices: [], total, salt, dataHex, payloadKind: classifyInnerData(dataHex) };
      }
      if (sel === SEL_T_ARRAY) {
        const decoded = web3.eth.abi.decodeParameters(['uint256[]', 'bytes', 'bytes'], body);
        const indices = (decoded[0] || []).map(v => Number(v)).filter(Number.isFinite);
        const dataHex = decoded[1];
        const salt = normalizeSaltHex(decoded[2]);
        if (indices.length > 0) {
          const last = indices[indices.length - 1];
          if (last > (countersBySalt.get(salt) || 0)) countersBySalt.set(salt, last);
        }
        return { kind: 'create-at', indices, salt, dataHex, payloadKind: classifyInnerData(dataHex) };
      }
      if (sel === SEL_F || sel === getRemintSelector()) {
        const decoded = web3.eth.abi.decodeParameters(['uint256[]', 'bytes', 'bytes'], body);
        const indices = (decoded[0] || []).map(v => Number(v)).filter(Number.isFinite);
        const dataHex = decoded[1];
        const salt = normalizeSaltHex(decoded[2]);
        return { kind: 'act', indices, salt, dataHex, payloadKind: classifyInnerData(dataHex) };
      }
    } catch (e) {
      console.warn(`[COINTOOL] decode failed for tx ${tx.hash}:`, e?.message || e);
    }
    return null;
  }

  // Build a quick lookup of CoinTool mint events in a receipt by proxy address.
  // Each event yields term and rank for ONE proxy. The protocol emits these in
  // the same order proxies were created/acted on.
  function indexMintEventsByProxy(receipt, mintTopic) {
    const out = new Map();
    for (const log of (receipt?.logs || [])) {
      if (!log.topics || log.topics.length < 2) continue;
      if (lc(log.topics[0]) !== mintTopic) continue;
      const proxy = '0x' + log.topics[1].slice(26).toLowerCase();
      out.set(proxy, log);
    }
    return out;
  }

  // -----------------------------
  // Scanner
  // -----------------------------

  async function rpcWithRetry(fn, attempts = 3) {
    let last;
    for (let i = 1; i <= attempts; i++) {
      try { return await fn(); }
      catch (e) {
        last = e;
        if (i < attempts) await new Promise(r => setTimeout(r, 600 * i));
      }
    }
    throw last;
  }

  // Pool of independent Web3 instances backed by different RPC endpoints,
  // round-robin distributed for parallel calls. Records failures and skips
  // rate-limited endpoints. Critical when probing tens of thousands of
  // userMints calls during XEN verification.
  // Hostnames that don't serve generic eth_call (MEV relays, bundle endpoints).
  // They typically return 403 / CORS-blocked responses and waste retries.
  const RPC_DENY_HOSTS = [
    'rpc.mevblocker.io',
    'rpc.flashbots.net',
    'relay.flashbots.net',
    'rpc.titanbuilder.xyz',
    'rpc.beaverbuild.org',
    'rpc.rsync-builder.xyz',
    'rpc.payload.de',
    'builder0x69.io',
    'rpc.f1b.io',
    'rpc.lightspeedbuilder.info',
    'rpc.nfactorial.xyz'
  ];

  function isUsableRpcUrl(url) {
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) return false;
      const host = u.hostname.toLowerCase();
      for (const bad of RPC_DENY_HOSTS) if (host.endsWith(bad)) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function createRpcPool(primaryWeb3) {
    const list = (window.chainManager?.getRPCEndpoints?.() || []).filter(Boolean);
    const seen = new Set();
    const rpcs = list.filter(u => {
      const k = String(u).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return isUsableRpcUrl(u);
    });
    const skipped = list.length - rpcs.length;
    if (skipped > 0) {
      console.log(`[COINTOOL] Skipped ${skipped} unusable RPC endpoint(s) (MEV relay / bundler)`);
    }
    const pool = [];
    for (const url of rpcs) {
      try {
        const provider = new window.Web3.providers.HttpProvider(url);
        const w3 = new window.Web3(provider);
        pool.push({ url, web3: w3, cooldownUntil: 0, failures: 0, banned: false });
      } catch (_) {}
    }
    if (pool.length === 0 && primaryWeb3) {
      pool.push({ url: 'primary', web3: primaryWeb3, cooldownUntil: 0, failures: 0, banned: false });
    }
    let cursor = 0;

    function pickEntry() {
      const now = Date.now();
      const live = pool.filter(e => !e.banned);
      if (live.length === 0) return null;
      // Try one full lap around the pool, picking the first non-cooling entry.
      for (let i = 0; i < live.length; i++) {
        const idx = (cursor + i) % live.length;
        const e = live[idx];
        if (e.cooldownUntil <= now) {
          cursor = (idx + 1) % live.length;
          return e;
        }
      }
      // All cooling — pick the soonest-available one and wait for its cooldown.
      let best = live[0];
      for (const e of live) if (e.cooldownUntil < best.cooldownUntil) best = e;
      return best;
    }

    function recordFailure(entry, err) {
      const msg = String(err?.message || err || '').toLowerCase();
      const is429 = msg.includes('429') || msg.includes('too many') || msg.includes('rate limit');
      const isCors = msg.includes('cors') || msg.includes('failed to fetch') || msg.includes('network request failed') || msg.includes('err_failed');
      const is403 = msg.includes('403') || msg.includes('forbidden');
      const isTimeout = msg.includes('timeout');
      entry.failures += 1;

      // Permanent-style failures: CORS, 403. Don't retry this endpoint at
      // all for the rest of the session — it's structurally broken for our
      // use case (MEV relay, geo block, etc).
      if (isCors || is403) {
        entry.banned = true;
        console.warn(`[COINTOOL] RPC ${entry.url} banned (CORS/403) — won't retry this session`);
        return;
      }

      // 429: longer cooldown that escalates with consecutive failures.
      // Don't permanently ban — Alchemy & Tenderly recover after a pause.
      if (is429) {
        const cool = Math.min(60000, 8000 + entry.failures * 4000);
        entry.cooldownUntil = Date.now() + cool;
        if (entry.failures % 5 === 0) {
          console.warn(`[COINTOOL] RPC ${entry.url} 429 ×${entry.failures}, cooling ${Math.round(cool/1000)}s`);
        }
        return;
      }

      // Transient: short cooldown.
      entry.cooldownUntil = Date.now() + (isTimeout ? 1500 : 800);
    }

    function recordSuccess(entry) {
      entry.failures = Math.max(0, entry.failures - 1);
    }

    async function withEntry(attempts, op) {
      let lastErr;
      for (let i = 0; i < attempts; i++) {
        const entry = pickEntry();
        if (!entry) throw lastErr || new Error('All RPCs banned/exhausted');
        const wait = entry.cooldownUntil - Date.now();
        if (wait > 0) await new Promise(r => setTimeout(r, Math.min(wait, 5000)));
        try {
          const res = await op(entry);
          recordSuccess(entry);
          return res;
        } catch (e) {
          lastErr = e;
          recordFailure(entry, e);
        }
      }
      throw lastErr || new Error('RPC pool exhausted');
    }

    async function callContract(abi, address, method, args, attempts = 6) {
      return withEntry(attempts, async (entry) => {
        const c = new entry.web3.eth.Contract(abi, address);
        return await c.methods[method](...args).call();
      });
    }

    async function getBlockNumber(attempts = 6) {
      return withEntry(attempts, (entry) => entry.web3.eth.getBlockNumber());
    }

    async function getTransactionReceipt(hash, attempts = 6) {
      return withEntry(attempts, (entry) => entry.web3.eth.getTransactionReceipt(hash));
    }

    async function getCode(addr, attempts = 6) {
      return withEntry(attempts, (entry) => entry.web3.eth.getCode(addr));
    }

    // Read a contract method's value at a specific historic block.
    async function callContractAtBlock(abi, address, method, args, blockNum, attempts = 6) {
      return withEntry(attempts, async (entry) => {
        const c = new entry.web3.eth.Contract(abi, address);
        return await c.methods[method](...args).call({}, blockNum);
      });
    }

    function size() { return pool.length; }
    function liveSize() { return pool.filter(p => !p.banned).length; }
    function summary() {
      return pool.map(p => ({ url: p.url, failures: p.failures, banned: p.banned, coolingFor: Math.max(0, p.cooldownUntil - Date.now()) }));
    }

    return { callContract, callContractAtBlock, getBlockNumber, getTransactionReceipt, getCode, size, liveSize, summary };
  }

  // Minimal XEN ABI for userMints probe — used to verify whether a proxy
  // truly has a pending mint at XEN. If term==0, the proxy was already
  // claimed (either via cKill which selfdestructed, or via c() where the
  // claim cleared XEN.userMints[proxy] but the proxy still has bytecode).
  const XEN_USERMINTS_ABI = [{
    inputs: [{ name: '', type: 'address' }],
    name: 'userMints',
    outputs: [
      { name: 'user',       type: 'address' },
      { name: 'term',       type: 'uint256' },
      { name: 'maturityTs', type: 'uint256' },
      { name: 'rank',       type: 'uint256' },
      { name: 'amplifier',  type: 'uint256' },
      { name: 'eaaRate',    type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  }];

  function getXenAddress() {
    return (window.chainManager?.getContractAddress('XEN_CRYPTO')
         || window.appConfig?.contracts?.XEN_CRYPTO
         || '0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8').toLowerCase();
  }

  function getCointoolAbi() {
    // ABI/cointool-ABI.js exposes `cointoolAbi` as a script-scope const;
    // depending on script load order it may be on window or only globally.
    if (window.cointoolAbi) return window.cointoolAbi;
    try { if (typeof cointoolAbi !== 'undefined') return cointoolAbi; } catch (_) {}
    // Minimal fallback — only the `map(address, bytes)` view call we need.
    return [{
      inputs: [
        { internalType: 'address', name: '', type: 'address' },
        { internalType: 'bytes',   name: '', type: 'bytes'   }
      ],
      name: 'map',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    }];
  }

  async function scanAddress(web3, db, address, etherscanApiKey, forceRescan, ui) {
    const ownerLc = lc(address);
    const cointoolAddr = getCointoolAddress();
    const mintTopic = getCointoolMintTopic();

    const pool = createRpcPool(web3);
    console.log(`[COINTOOL] RPC pool initialized with ${pool.size()} endpoint(s)`);

    const deploymentBlock = window.chainManager?.getDeploymentBlock?.('COINTOOL') || window.chainManager?.getXenDeploymentBlock?.() || 15704871;
    const toBlock = await pool.getBlockNumber();

    // Honor the user's `rescanBlockDepth` setting (default 1000 blocks).
    // For an incremental rescan we just need to walk recent blocks since
    // the last successful scan; deep history is already in the DB.
    const rescanDepthRaw = parseInt(localStorage.getItem('rescanBlockDepth') || '', 10);
    const rescanDepth = Number.isFinite(rescanDepthRaw) && rescanDepthRaw > 0 ? rescanDepthRaw : 1000;

    const prior = forceRescan ? null : await getScanState(db, ownerLc);
    const lastTxBlock = prior?.lastTransactionBlock || 0;
    let fromBlock;
    if (forceRescan) {
      fromBlock = deploymentBlock;
      console.log(`[COINTOOL] ${address}: force rescan from deployment block ${deploymentBlock}`);
    } else {
      // Honor rescanBlockDepth (default 1000 blocks ≈ 3.3h). But never miss
      // anything since the last successful scan: also include a small
      // overlap with lastTransactionBlock if that cursor sits earlier than
      // the depth window. Walk from whichever is earlier.
      const safetyOverlap = 50;
      const fromDepth = toBlock - rescanDepth;
      const fromCursor = lastTxBlock > 0 ? (lastTxBlock - safetyOverlap) : Number.MAX_SAFE_INTEGER;
      fromBlock = Math.max(deploymentBlock, Math.min(fromDepth, fromCursor));
      console.log(`[COINTOOL] ${address}: incremental rescan from block ${fromBlock} (depth=${rescanDepth}, lastTxBlock=${lastTxBlock || 'none'}, toBlock=${toBlock})`);
    }

    if (fromBlock > toBlock) {
      console.log(`[COINTOOL] ${address}: nothing to scan`);
      return { newOrUpdated: 0, total: 0 };
    }

    ui?.setStage?.(`Scanning Cointool txs for ${address}`, 0, 1);

    const txs = await fetchAllCointoolTxs(address, etherscanApiKey, fromBlock, toBlock, ui);
    if (txs.length === 0) {
      await putScanState(db, ownerLc, { lastScannedBlock: toBlock, lastTransactionBlock: lastTxBlock });
      console.log(`[COINTOOL] ${address}: 0 cointool txs in range`);
      return { newOrUpdated: 0, total: 0 };
    }
    ui?.setStage?.(`Loaded ${txs.length} Cointool txs; reading existing proxies...`, 0, txs.length);

    // Seed per-salt counters from existing DB state, then verify against
    // on-chain map(user, salt). On-chain map is THE source of truth for
    // the next index a t() call will use — DB max-index can be polluted
    // by phantom records (mis-decoded txs in past runs creating Index >
    // on-chain map).
    const existing = await getProxiesForOwner(db, ownerLc);
    const proxiesById = new Map();
    for (const p of existing) proxiesById.set(p.id, p);

    const saltsSeen = new Set();
    for (const p of existing) saltsSeen.add(normalizeSaltHex(p.Salt));

    const countersBySalt = new Map();
    const phantomIds = [];
    for (const salt of saltsSeen) {
      let onchainMax = null;
      try {
        const v = await pool.callContract(getCointoolAbi(), cointoolAddr, 'map', [address, salt], 8);
        onchainMax = Number(v);
      } catch (e) {
        console.warn(`[COINTOOL] ${address} map(${salt}) probe failed; falling back to DB max-index`, e?.message || e);
      }

      let dbMax = 0;
      for (const p of existing) {
        if (normalizeSaltHex(p.Salt) !== salt) continue;
        if (Number(p.Index) > dbMax) dbMax = Number(p.Index);
      }

      if (Number.isFinite(onchainMax) && onchainMax >= 0) {
        if (dbMax > onchainMax) {
          // Phantoms — DB has indices the contract never produced.
          for (const p of existing) {
            if (normalizeSaltHex(p.Salt) !== salt) continue;
            if (Number(p.Index) > onchainMax) phantomIds.push(p.id);
          }
          console.warn(`[COINTOOL] ${address} salt ${salt}: on-chain map=${onchainMax}, DB max=${dbMax} — ${phantomIds.length} phantom record(s) will be deleted`);
        }
        countersBySalt.set(salt, onchainMax);
      } else {
        countersBySalt.set(salt, dbMax);
      }
    }

    // Delete phantom records before processing new txs.
    if (phantomIds.length > 0) {
      ui?.setStage?.(`Deleting ${phantomIds.length} phantom record(s)`, 0, phantomIds.length);
      await new Promise((resolve, reject) => {
        const tx = db.transaction('proxies', 'readwrite');
        const store = tx.objectStore('proxies');
        for (const id of phantomIds) store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      invalidateRenderCache();
      // Also remove from in-memory state.
      for (const id of phantomIds) proxiesById.delete(id);
      console.log(`[COINTOOL] ${address}: deleted ${phantomIds.length} phantom records`);
    }

    const updates = new Map(); // id -> record
    let highestBlock = lastTxBlock;
    let processed = 0;

    function getRecord(id) {
      return updates.get(id) || proxiesById.get(id) || null;
    }

    function commitRecord(rec) {
      updates.set(rec.id, rec);
    }

    for (const tx of txs) {
      processed += 1;
      if (processed === 1 || processed % 5 === 0 || processed === txs.length) {
        ui?.setStage?.(`Cointool: processing tx ${processed}/${txs.length} (${updates.size} proxies updated)`, processed, txs.length);
        // Yield to the browser so the progress bar repaints.
        await new Promise(r => setTimeout(r, 0));
      }

      const decoded = decodeCointoolTx(web3, tx, countersBySalt);
      if (!decoded) continue;

      // For t() (create-new), determine the actual indices used by querying
      // on-chain map at block-1 — that was the counter at tx execution
      // time. indices = mapAtPrev+1 .. mapAtPrev+total.
      if (decoded.kind === 'create-new' && Number.isFinite(decoded.total) && decoded.total > 0) {
        try {
          const prevBlock = Number(tx.blockNumber) - 1;
          const mapAtPrev = await pool.callContractAtBlock(getCointoolAbi(), cointoolAddr, 'map', [address, decoded.salt], prevBlock, 8);
          const start = Number(mapAtPrev) + 1;
          const ids = [];
          for (let i = 0; i < decoded.total; i++) ids.push(start + i);
          decoded.indices = ids;
          if (start + decoded.total - 1 > (countersBySalt.get(decoded.salt) || 0)) {
            countersBySalt.set(decoded.salt, start + decoded.total - 1);
          }
        } catch (e) {
          console.warn(`[COINTOOL] historic map() at block ${Number(tx.blockNumber) - 1} failed for ${tx.hash}; falling back to counter`, e?.message || e);
          const start = (countersBySalt.get(decoded.salt) || 0) + 1;
          const ids = [];
          for (let i = 0; i < decoded.total; i++) ids.push(start + i);
          decoded.indices = ids;
          countersBySalt.set(decoded.salt, start + decoded.total - 1);
        }
      }

      if (decoded.indices.length === 0) continue;

      const blockNum = Number(tx.blockNumber);
      const txTs = Number(tx.timeStamp) || 0;
      if (blockNum > highestBlock) highestBlock = blockNum;

      // Receipt fetch is the expensive part. Only fetch when we expect events.
      let mintLogsByProxy = null;
      const needsReceipt = decoded.kind !== 'act' || decoded.payloadKind === 'remint' || decoded.payloadKind === 'mint';
      if (needsReceipt) {
        try {
          const receipt = await pool.getTransactionReceipt(tx.hash);
          mintLogsByProxy = indexMintEventsByProxy(receipt, mintTopic);
        } catch (e) {
          console.warn(`[COINTOOL] receipt fetch failed ${tx.hash}:`, e?.message || e);
          mintLogsByProxy = new Map();
        }
      }

      for (const idx of decoded.indices) {
        const proxyAddr = computeProxyAddress(web3, cointoolAddr, idx, decoded.salt, address);
        const id = makeProxyId(address, decoded.salt, idx);
        let rec = getRecord(id);
        const isNewRecord = !rec;

        // For 'act' txs we only create a NEW record if the receipt has a
        // matching XEN event for this exact CREATE2 address. Otherwise
        // we'd be writing phantom records for any tx whose calldata we
        // mis-decoded (or whose indices the contract never deployed).
        if (isNewRecord && decoded.kind === 'act') {
          const hasMatch = mintLogsByProxy && mintLogsByProxy.has(lc(proxyAddr));
          if (!hasMatch) continue; // skip — don't pollute DB
        }

        if (!rec) {
          rec = {
            id,
            Owner: ownerLc,
            Salt: normalizeSaltHex(decoded.salt),
            Index: Number(idx),
            ProxyAddress: lc(proxyAddr || ''),
            Status: 'Maturing',
            Term: 0,
            Rank: '0',
            Mint_TS: 0,
            Maturity_TS: 0,
            Last_Action_Block: 0,
            History: [],
            SourceType: 'Cointool'
          };
        }

        if (decoded.kind === 'create-new' || decoded.kind === 'create-at') {
          // Mint or remint event expected for this proxy.
          const log = mintLogsByProxy && mintLogsByProxy.get(lc(proxyAddr));
          if (log) {
            const dec = web3.eth.abi.decodeParameters(['uint256', 'uint256'], log.data);
            const term = Number(dec[0]) || 0;
            const rank = String(dec[1]);
            const maturityTs = txTs + term * 86400;
            const isRemint = (rec.History || []).length > 0;
            rec.History.push({
              type: isRemint ? 'remint' : 'mint',
              txHash: tx.hash,
              block: blockNum,
              ts: txTs,
              term,
              rank
            });
            rec.Status = 'Maturing';
            rec.Term = term;
            rec.Rank = rank;
            rec.Mint_TS = txTs;
            rec.Maturity_TS = maturityTs;
            rec.Last_Action_Block = blockNum;
          } else {
            // Sub-call reverted inside the batch (most common cause: contract
            // failure mid-batch) — record the attempt but leave rec status
            // alone. If the proxy never had a successful mint at all, mark
            // as Failed so it surfaces in a "needs attention" group.
            rec.History.push({
              type: (rec.History || []).length === 0 ? 'mint_failed' : 'remint_failed',
              txHash: tx.hash,
              block: blockNum,
              ts: txTs
            });
            if ((rec.History || []).filter(h => h.type === 'mint' || h.type === 'remint').length === 0) {
              rec.Status = 'Failed';
            }
            rec.Last_Action_Block = blockNum;
          }
        } else if (decoded.kind === 'act') {
          // Acting on existing proxies. Three flavours by inner data:
          //   payloadKind === 'claim'  → c+claimMintReward, proxy stays
          //                              alive but XEN.userMints[proxy]=0.
          //   payloadKind === 'remint' → c+claimMintRewardAndShare via the
          //                              REMINT_HELPER, claims and starts a
          //                              new mint atomically.
          //   payloadKind === 'mint'   → c+claimRank, reuses an existing
          //                              live proxy to start a fresh mint
          //                              after a previous claim cleared
          //                              userMints. CoinTool's "reuse mint"
          //                              path uses this.
          if (decoded.payloadKind === 'claim') {
            rec.History.push({
              type: 'claim',
              txHash: tx.hash,
              block: blockNum,
              ts: txTs
            });
            rec.Status = 'Claimed';
            rec.Last_Action_Block = blockNum;
            // Keep Term/Rank as-is (history of the just-claimed mint).
          } else if (decoded.payloadKind === 'remint' || decoded.payloadKind === 'mint') {
            const log = mintLogsByProxy && mintLogsByProxy.get(lc(proxyAddr));
            if (log) {
              const dec = web3.eth.abi.decodeParameters(['uint256', 'uint256'], log.data);
              const term = Number(dec[0]) || 0;
              const rank = String(dec[1]);
              const maturityTs = txTs + term * 86400;
              const histType = decoded.payloadKind === 'remint' ? 'remint' : 'mint';
              rec.History.push({
                type: histType,
                txHash: tx.hash,
                block: blockNum,
                ts: txTs,
                term,
                rank
              });
              rec.Status = 'Maturing';
              rec.Term = term;
              rec.Rank = rank;
              rec.Mint_TS = txTs;
              rec.Maturity_TS = maturityTs;
              rec.Last_Action_Block = blockNum;
            } else {
              rec.History.push({
                type: decoded.payloadKind === 'remint' ? 'remint_failed' : 'mint_failed',
                txHash: tx.hash,
                block: blockNum,
                ts: txTs
              });
              rec.Last_Action_Block = blockNum;
            }
          } else {
            // Unknown payload: record as raw action.
            rec.History.push({
              type: 'act_unknown',
              txHash: tx.hash,
              block: blockNum,
              ts: txTs
            });
            rec.Last_Action_Block = blockNum;
          }
        }

        commitRecord(rec);
      }
    }

    // Maturity sweep: bump Maturing → Claimable for matured proxies (only
    // touch records we wrote this run; on next scan others get re-evaluated).
    const nowSec = Math.floor(Date.now() / 1000);
    const allRecs = new Map(proxiesById);
    for (const [k, v] of updates) allRecs.set(k, v);
    for (const rec of allRecs.values()) {
      if (rec.Status === 'Maturing' && Number(rec.Maturity_TS) > 0 && Number(rec.Maturity_TS) <= nowSec) {
        rec.Status = 'Claimable';
        updates.set(rec.id, rec);
      } else if (rec.Status === 'Claimable' && Number(rec.Maturity_TS) > 0 && Number(rec.Maturity_TS) > nowSec) {
        // Edge case: clock skew — demote back if we got it wrong.
        rec.Status = 'Maturing';
        updates.set(rec.id, rec);
      }
    }

    // Bulk write all updated records.
    if (updates.size > 0) {
      ui?.setStage?.(`Writing ${updates.size} proxies to DB`, 0, updates.size);
      await bulkPutProxies(db, Array.from(updates.values()));
    }

    // Verify against XEN: for every record we believe is Claimable or
    // Maturing, check if XEN.userMints[proxy] still has a pending mint. If
    // term==0 there, the proxy was claimed previously and we missed it.
    //
    // For incremental scans (no forceRescan), only verify records that
    // were touched by this run — there's no reason to re-probe the whole
    // history every time, the slow XEN sweep is what makes incremental
    // scans painful for whales.
    const toVerify = [];
    if (forceRescan) {
      for (const rec of allRecs.values()) {
        if (rec.Status === 'Claimable' || rec.Status === 'Maturing') toVerify.push(rec);
      }
    } else {
      for (const rec of updates.values()) {
        if (rec.Status === 'Claimable' || rec.Status === 'Maturing') toVerify.push(rec);
      }
      console.log(`[COINTOOL] ${address}: incremental scan — verifying ${toVerify.length} touched records (skipping ${allRecs.size - updates.size} unchanged)`);
    }
    if (toVerify.length > 0) {
      ui?.setStage?.(`Verifying ${toVerify.length} proxy state(s) against XEN`, 0, toVerify.length);
      const xenAddr = getXenAddress();
      const live = Math.max(1, pool.liveSize());
      const PARALLEL = Math.max(2, Math.min(live * 2, 12));
      console.log(`[COINTOOL] verification: ${PARALLEL}-way parallelism over ${live} live RPC(s) (pool size ${pool.size()})`);
      const corrections = new Map();
      const failedVerify = []; // records where every RPC retry failed
      let probed = 0;
      let lastLog = Date.now();
      for (let i = 0; i < toVerify.length; i += PARALLEL) {
        const batch = toVerify.slice(i, i + PARALLEL);
        await Promise.all(batch.map(async (rec) => {
          try {
            const info = await pool.callContract(XEN_USERMINTS_ABI, xenAddr, 'userMints', [rec.ProxyAddress], 12);
            const term = Number(info.term);
            const matTs = Number(info.maturityTs);
            const rank = String(info.rank);
            if (!Number.isFinite(term) || term <= 0) {
              // XEN has no pending mint here — proxy was claimed already.
              if (rec.Status !== 'Claimed') {
                rec.Status = 'Claimed';
                if (!Array.isArray(rec.History)) rec.History = [];
                rec.History.push({ type: 'claim_inferred', ts: Math.floor(Date.now() / 1000) });
                corrections.set(rec.id, rec);
              }
            } else {
              // XEN confirms a pending mint. Refresh term/maturity/rank to
              // reflect the actual on-chain state (heals any drift).
              const drift = (Number(rec.Term) !== term)
                || (Number(rec.Maturity_TS) !== matTs)
                || (String(rec.Rank) !== rank);
              if (drift) {
                rec.Term = term;
                rec.Maturity_TS = matTs;
                rec.Rank = rank;
                corrections.set(rec.id, rec);
              }
              const newStatus = matTs <= nowSec ? 'Claimable' : 'Maturing';
              if (rec.Status !== newStatus) {
                rec.Status = newStatus;
                corrections.set(rec.id, rec);
              }
            }
          } catch (e) {
            // RPC retries exhausted. Track for second-pass at slower pace.
            failedVerify.push(rec);
          }
        }));
        probed += batch.length;
        if (probed === toVerify.length || Date.now() - lastLog > 300) {
          lastLog = Date.now();
          ui?.setStage?.(`Verifying proxy state ${probed}/${toVerify.length} (${corrections.size} corrections, ${pool.liveSize()}/${pool.size()} RPCs live)`, probed, toVerify.length);
          await new Promise(r => setTimeout(r, 0));
        }
        // Always pace between batches so we don't burst into 429s.
        // Adaptive pacing: 50–250ms based on how stressed the pool looks.
        const stressed = pool.summary().some(p => p.failures > 2 && !p.banned);
        const delay = stressed ? 250 : 50;
        await new Promise(r => setTimeout(r, delay + Math.floor(Math.random() * 50)));
        // If we lost too many RPCs, pause to give them a chance to recover.
        if (pool.liveSize() === 0) {
          console.warn('[COINTOOL] All RPCs cooling/banned — pausing 5s');
          await new Promise(r => setTimeout(r, 5000));
        }
      }
      // Second pass: serial + slow pace for the records whose verification
      // failed during the bursty first pass. These are typically what was
      // missed during 429 storms.
      if (failedVerify.length > 0) {
        console.log(`[COINTOOL] ${address}: ${failedVerify.length} proxies failed first-pass verification, retrying serially`);
        ui?.setStage?.(`Retrying ${failedVerify.length} verification(s) at slow pace`, 0, failedVerify.length);
        let retryDone = 0;
        let retrySuccess = 0;
        for (const rec of failedVerify) {
          try {
            const info = await pool.callContract(XEN_USERMINTS_ABI, xenAddr, 'userMints', [rec.ProxyAddress], 20);
            const term = Number(info.term);
            const matTs = Number(info.maturityTs);
            const rank = String(info.rank);
            if (!Number.isFinite(term) || term <= 0) {
              if (rec.Status !== 'Claimed') {
                rec.Status = 'Claimed';
                if (!Array.isArray(rec.History)) rec.History = [];
                rec.History.push({ type: 'claim_inferred', ts: Math.floor(Date.now() / 1000) });
                corrections.set(rec.id, rec);
              }
            } else {
              const drift = (Number(rec.Term) !== term)
                || (Number(rec.Maturity_TS) !== matTs)
                || (String(rec.Rank) !== rank);
              if (drift) {
                rec.Term = term;
                rec.Maturity_TS = matTs;
                rec.Rank = rank;
                corrections.set(rec.id, rec);
              }
              const newStatus = matTs <= nowSec ? 'Claimable' : 'Maturing';
              if (rec.Status !== newStatus) {
                rec.Status = newStatus;
                corrections.set(rec.id, rec);
              }
            }
            retrySuccess += 1;
          } catch (_) {
            // Still failing — we tried.
          }
          retryDone += 1;
          if (retryDone % 25 === 0 || retryDone === failedVerify.length) {
            ui?.setStage?.(`Retry verification ${retryDone}/${failedVerify.length} (${retrySuccess} succeeded)`, retryDone, failedVerify.length);
          }
          // Slow pace: 350ms minimum between retries (well under any RPC's rate limit).
          await new Promise(r => setTimeout(r, 350));
        }
        const stillFailed = failedVerify.length - retrySuccess;
        console.log(`[COINTOOL] ${address}: retry pass — ${retrySuccess} verified, ${stillFailed} still failed`);
        if (stillFailed > 0) {
          console.warn(`[COINTOOL] ${stillFailed} proxies could not be verified — their status may be stale. Run another scan or claim with JIT verification.`);
        }
      }

      if (corrections.size > 0) {
        console.log(`[COINTOOL] ${address}: XEN verification corrected ${corrections.size}/${toVerify.length} proxy states`);
        await bulkPutProxies(db, Array.from(corrections.values()));
      } else {
        console.log(`[COINTOOL] ${address}: XEN verification confirmed all ${toVerify.length} proxy states`);
      }
    }

    ui?.setStage?.(`Validating ${countersBySalt.size} salt(s) against on-chain map(...)`, 0, countersBySalt.size);
    // Final validation: re-fetch on-chain map(user, salt) and warn if our
    // walk drifted from truth (Etherscan lag, missed txs, etc).
    for (const [salt, maxIndex] of countersBySalt.entries()) {
      try {
        const onchain = await pool.callContract(getCointoolAbi(), cointoolAddr, 'map', [address, salt]);
        const onchainNum = Number(onchain);
        if (Number.isFinite(onchainNum) && onchainNum > maxIndex) {
          console.warn(`[COINTOOL] ${address} salt ${salt}: on-chain map=${onchainNum}, scanned highest=${maxIndex}. ${onchainNum - maxIndex} new mint(s) since last txlist refresh; rescan again in a moment.`);
        } else if (Number.isFinite(onchainNum) && onchainNum < maxIndex) {
          console.warn(`[COINTOOL] ${address} salt ${salt}: on-chain map=${onchainNum} but scanner counter=${maxIndex}. ${maxIndex - onchainNum} phantom record(s) may have been created — next scan will clean up.`);
        }
      } catch (e) {
        console.warn(`[COINTOOL] map(${address}, ${salt}) call failed:`, e?.message || e);
      }
    }

    await putScanState(db, ownerLc, {
      lastScannedBlock: toBlock,
      lastTransactionBlock: highestBlock || lastTxBlock
    });

    console.log(`[COINTOOL] ${address}: scanned ${txs.length} txs, wrote ${updates.size} proxy updates, total proxies for this owner: ${allRecs.size}`);
    return { newOrUpdated: updates.size, total: allRecs.size };
  }

  // -----------------------------
  // Public entry points
  // -----------------------------

  async function scan() {
    const addressEl = document.getElementById('ethAddress');
    const rpcEl = document.getElementById('customRPC');
    const addressInput = (window.normalizeMultiLineValue ? window.normalizeMultiLineValue(addressEl?.value || '', 'address') : (addressEl?.value || '')).trim();
    const rpcInput = (window.normalizeMultiLineValue ? window.normalizeMultiLineValue(rpcEl?.value || '', 'rpc') : (rpcEl?.value || '')).trim();
    if (addressEl) addressEl.value = addressInput;
    if (rpcEl) rpcEl.value = rpcInput;
    const etherscanApiKey = (document.getElementById('etherscanApiKey')?.value || '').trim();
    const forceRescan = !!document.getElementById('forceRescan')?.checked;

    if (!addressInput) { alert('Please enter at least one wallet address.'); return; }
    if (!etherscanApiKey) { alert('Please enter an Etherscan Multichain API key.'); return; }

    const addresses = window.splitMultiLineValue ? window.splitMultiLineValue(addressInput, 'address') : addressInput.split(/\s+|\n+/).map(s => s.trim()).filter(Boolean);
    const rpcEndpoints = window.splitMultiLineValue ? window.splitMultiLineValue(rpcInput, 'rpc') : rpcInput.split(/\s+|\n+/).map(s => s.trim()).filter(Boolean);

    const web3 = window.newWeb3
      ? window.newWeb3(rpcEndpoints[0] || null)
      : new Web3(rpcEndpoints[0] || (window.DEFAULT_RPC || 'https://ethereum-rpc.publicnode.com'));

    const db = await openDB();
    // Expose DB so the unified view's fetch helper can read it without
    // re-opening (and so legacy code paths see the new schema).
    window.dbInstance = db;
    window.cointoolDb = db;

    if (window.progressUI) {
      window.progressUI.show(true);
      window.progressUI.setType('Cointool');
      window.progressUI.setStage?.(`Starting Cointool scan for ${addresses.length} address(es)`, 0, addresses.length);
    }

    console.log(`[COINTOOL] Starting scan for ${addresses.length} address(es), forceRescan=${forceRescan}`);

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      window.progressUI?.setAddress?.(i + 1, addresses.length, address);
      window.progressUI?.setStage?.(`Address ${i + 1}/${addresses.length}: ${address}`, i, addresses.length);
      try {
        await scanAddress(web3, db, address, etherscanApiKey, forceRescan, window.progressUI);
      } catch (e) {
        console.error(`[COINTOOL] scan failed for ${address}:`, e);
        alert(`Cointool scan failed for ${address}: ${e?.message || e}`);
      }
    }

    setTimeout(() => {
      if (!window.__scanAllActive && document.getElementById('progressContainer')) {
        document.getElementById('progressContainer').style.display = 'none';
      }
    }, 800);
  }

  // -----------------------------
  // Exports
  // -----------------------------

  // JIT verification: for an array of (owner, salt, indices), probe XEN
  // and (when needed) eth_getCode to classify each proxy. Returns:
  //   recoverable     [int]  — XEN has matured pending mint → claim with f()
  //   pendingMaturity [int]  — XEN has unmatured pending mint → wait
  //   mintableF       [int]  — no pending mint AND proxy has bytecode → start fresh mint with f()
  //   mintableT       [int]  — no pending mint AND proxy bytecode is gone → redeploy with t_()
  //   unverified      [int]  — RPC call failed, can't classify
  // Also patches local DB so table reflects truth on next refresh.
  async function verifyProxiesAtClaimTime(web3, owner, saltHex, indices) {
    const cointoolAddr = getCointoolAddress();
    const db = window.cointoolDb || window.dbInstance || (await openDB());
    window.cointoolDb = db;
    const pool = createRpcPool(web3);
    const xenAddr = getXenAddress();
    const recoverable = [];
    const pendingMaturity = [];
    const mintableF = [];
    const mintableT = [];
    const unverified = [];
    const corrections = new Map();
    const ownerLc = lc(owner);
    const saltNorm = normalizeSaltHex(saltHex);

    // Step 1: per-proxy XEN.userMints probe. Classifies into recoverable /
    // pendingMaturity / claimed-no-mint / unverified.
    const claimedCandidates = []; // [{idx, proxyAddr, rec}]
    const PARALLEL = Math.max(1, Math.min(pool.liveSize() * 2, 8));
    for (let i = 0; i < indices.length; i += PARALLEL) {
      const slice = indices.slice(i, i + PARALLEL);
      await Promise.all(slice.map(async (idx) => {
        const proxyAddr = computeProxyAddress(web3, cointoolAddr, idx, saltNorm, ownerLc);
        try {
          const info = await pool.callContract(XEN_USERMINTS_ABI, xenAddr, 'userMints', [proxyAddr], 20);
          const term = Number(info.term);
          const matTs = Number(info.maturityTs);
          const nowSec = Math.floor(Date.now() / 1000);
          if (!Number.isFinite(term) || term <= 0) {
            const id = makeProxyId(ownerLc, saltNorm, idx);
            const rec = await getProxyById(db, id);
            claimedCandidates.push({ idx, proxyAddr, rec });
          } else if (matTs > nowSec) {
            pendingMaturity.push(idx);
          } else {
            recoverable.push(idx);
          }
        } catch (_) {
          unverified.push(idx);
        }
      }));
      await new Promise(r => setTimeout(r, 60));
    }

    // Step 2: for proxies XEN says have no pending mint, probe eth_getCode
    // to decide whether to remint via f() (proxy still exists) or t_()
    // (proxy bytecode gone, must redeploy).
    for (let i = 0; i < claimedCandidates.length; i += PARALLEL) {
      const slice = claimedCandidates.slice(i, i + PARALLEL);
      await Promise.all(slice.map(async ({ idx, proxyAddr, rec }) => {
        try {
          const code = await pool.getCode(proxyAddr, 20);
          const hasCode = !!(code && code !== '0x' && code !== '0x0');
          if (hasCode) mintableF.push(idx);
          else mintableT.push(idx);
          if (rec) {
            const nowSec = Math.floor(Date.now() / 1000);
            if (rec.Status !== 'Claimed') {
              rec.Status = 'Claimed';
              if (!Array.isArray(rec.History)) rec.History = [];
              rec.History.push({ type: 'claim_inferred', ts: nowSec });
              corrections.set(rec.id, rec);
            }
            if (rec.ProxyCodeExists !== hasCode) {
              rec.ProxyCodeExists = hasCode;
              corrections.set(rec.id, rec);
            }
          }
        } catch (_) {
          // Can't determine — default to t_() (recreate is always safe).
          mintableT.push(idx);
        }
      }));
      await new Promise(r => setTimeout(r, 60));
    }

    if (corrections.size > 0) {
      try { await bulkPutProxies(db, Array.from(corrections.values())); } catch (_) {}
    }

    // Backwards-compat alias used by older callers.
    const alreadyClaimed = mintableF.concat(mintableT);
    return { recoverable, pendingMaturity, mintableF, mintableT, alreadyClaimed, unverified };
  }

  const cointoolScanner = {
    getInfo() {
      return {
        name: 'Cointool',
        type: 'cointool',
        description: 'Per-proxy Cointool scanner (DB v5)',
        contractAddress: getCointoolAddress()
      };
    },
    scan,
    openDB,
    // utilities exposed for unified_view and main_app
    getProxiesForOwner,
    getProxyById,
    bulkPutProxies,
    verifyProxiesAtClaimTime,
    computeProxyAddress: (web3, deployer, idx, salt, owner) => computeProxyAddress(web3, deployer, idx, salt, owner),
    normalizeSaltHex,
    makeProxyId,
    dateFmtFromTs,
    classifyInnerData,
    SELECTORS: { SEL_T, SEL_T_ARRAY, SEL_F }
  };

  window.cointool = cointoolScanner;
  window.cointoolDbVersion = DB_VERSION;
})();
