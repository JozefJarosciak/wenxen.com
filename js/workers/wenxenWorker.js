// WenXen worker: CPU-only jobs. IndexedDB and DOM stay on the main thread.
const dedupePlans = new Map();

const LOCAL_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

function localDatePartsFromSeconds(ts) {
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

function localDateKeyFromSeconds(ts) {
  const parts = localDatePartsFromSeconds(ts);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.monthIndex + 1)}-${pad2(parts.day)}`;
}

function localMaturityDisplayFromSeconds(ts) {
  const parts = localDatePartsFromSeconds(ts);
  if (!parts) return '';
  const hour12 = parts.hour24 % 12 || 12;
  const ampm = parts.hour24 >= 12 ? 'PM' : 'AM';
  return `${parts.year} ${LOCAL_MONTHS_SHORT[parts.monthIndex]} ${pad2(parts.day)}, ${pad2(hour12)}:${pad2(parts.minute)} ${ampm}`;
}

function effectiveStatusFromProxy(p, nowSec) {
  const status = p && p.Status;
  if (status !== 'Maturing') return status || '';
  const ts = Number(p && p.Maturity_TS);
  if (Number.isFinite(ts) && ts > 0 && ts <= nowSec) return 'Claimable';
  return status;
}

function emptyCounter() {
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

function addCounter(counter, status, vmus, hasHistory) {
  counter.totalVMUs += vmus;
  if (hasHistory) counter.remints += vmus;
  if (status === 'Maturing') counter.maturing += vmus;
  else if (status === 'Claimable') counter.claimable += vmus;
  else if (status === 'Mintable') counter.mintable += vmus;
  else if (status === 'Failed') counter.failed += vmus;
  else if (status === 'Claimed') counter.claimed += vmus;
  else counter.unknown += vmus;
}

function buildCointoolSummaryIndexFromProxies(proxies, maxPerBatch, options = {}) {
  const nowSec = Number(options.nowSec || Math.floor(Date.now() / 1000));
  const typeStats = emptyCounter();
  const statusMap = new Map();
  const dayMap = new Map();
  const ownerMap = new Map();
  const groupMap = new Map();
  const dateKeyCache = new Map();

  const getCachedDateKey = (ts) => {
    const n = Number(ts) || 0;
    if (n <= 0) return '';
    if (!dateKeyCache.has(n)) dateKeyCache.set(n, localDateKeyFromSeconds(n));
    return dateKeyCache.get(n);
  };

  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[i];
    const owner = String(proxy?.Owner || '').toLowerCase();
    const status = effectiveStatusFromProxy(proxy, nowSec) || 'Unknown';
    const dayKey = getCachedDateKey(proxy?.Maturity_TS);
    const hasHistory = Array.isArray(proxy?.History) && proxy.History.length > 0;
    const vmus = 1;

    addCounter(typeStats, status, vmus, hasHistory);

    if (!statusMap.has(status)) {
      statusMap.set(status, { ...emptyCounter(), id: `Cointool|${status}|${maxPerBatch}`, type: 'Cointool', status, maxPerBatch });
    }
    addCounter(statusMap.get(status), status, vmus, hasHistory);

    if (owner) {
      if (!ownerMap.has(owner)) {
        ownerMap.set(owner, { ...emptyCounter(), id: `Cointool|${owner}|${maxPerBatch}`, type: 'Cointool', owner, maxPerBatch });
      }
      addCounter(ownerMap.get(owner), status, vmus, hasHistory);
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
  return {
    metadata: {
      id: 'cointool',
      version: 1,
      type: 'Cointool',
      maxPerBatch,
      proxyCount: proxies.length,
      groupCount: groupMap.size,
      builtAt,
      invalidatedAt: Number(options.invalidatedAt || 0),
      updatedAt: builtAt
    },
    byType: [{
      id: `Cointool|${maxPerBatch}`,
      type: 'Cointool',
      maxPerBatch,
      ...typeStats,
      updatedAt: builtAt
    }],
    byStatus: Array.from(statusMap.values()).map(row => ({ ...row, updatedAt: builtAt })),
    byDay: Array.from(dayMap.values()).map(row => ({ ...row, updatedAt: builtAt })),
    byOwner: Array.from(ownerMap.values()).map(row => ({ ...row, updatedAt: builtAt }))
  };
}

function groupAndChunkProxies(proxies, maxPerBatch, options = {}, progress) {
  const nowSec = Number(options.nowSec || Math.floor(Date.now() / 1000));
  const groups = new Map();
  const dateKeyCache = new Map();
  const getCachedDateKey = (ts) => {
    const n = Number(ts) || 0;
    if (n <= 0) return '';
    if (!dateKeyCache.has(n)) dateKeyCache.set(n, localDateKeyFromSeconds(n));
    return dateKeyCache.get(n);
  };

  for (let i = 0; i < proxies.length; i++) {
    const p = proxies[i];
    const dayKey = getCachedDateKey(p.Maturity_TS);
    const effStatus = effectiveStatusFromProxy(p, nowSec);
    const key = `${(p.Owner || '').toLowerCase()}|${(p.Salt || '').toLowerCase()}|${effStatus}|${p.Term || 0}|${dayKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
    if (i > 0 && i % 10000 === 0) progress(5 + (i / proxies.length) * 35, { stage: 'grouping', processed: i });
  }

  const rows = [];
  let processedGroups = 0;
  const totalGroups = Math.max(1, groups.size);
  for (const [, list] of groups) {
    list.sort((a, b) => (Number(a.Maturity_TS || 0) - Number(b.Maturity_TS || 0)) || (Number(a.Index || 0) - Number(b.Index || 0)));
    for (let i = 0; i < list.length; i += maxPerBatch) {
      const chunk = list.slice(i, i + maxPerBatch);
      const first = chunk[0];
      const last = chunk[chunk.length - 1];

      let minRank = null;
      let maxRank = null;
      for (const p of chunk) {
        let rank = 0n;
        try { rank = BigInt(p.Rank || '0'); } catch (_) {}
        if (rank <= 0n) continue;
        if (minRank === null || rank < minRank) minRank = rank;
        if (maxRank === null || rank > maxRank) maxRank = rank;
      }
      const rankRange = minRank !== null ? `${minRank.toString()}-${maxRank.toString()}` : 'N/A';
      const matFmt = localMaturityDisplayFromSeconds(last.Maturity_TS);
      const matKey = localDateKeyFromSeconds(last.Maturity_TS);
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
      const rowStatus = effectiveStatusFromProxy(first, nowSec);

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
        MaturityByDay: matKey ? { [matKey]: chunk.length } : {},
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
    processedGroups++;
    if (processedGroups % 50 === 0) progress(45 + (processedGroups / totalGroups) * 45, { stage: 'chunking', groups: processedGroups });
  }

  return rows;
}

function identityFor(record, primaryKey, keyField, ownerField) {
  const identity =
    record?.[keyField] ??
    record?.TX_Hash ??
    record?.hash ??
    record?.mintTxHash ??
    record?.txHash ??
    record?.tokenId ??
    record?.Xenft_id ??
    record?.id ??
    primaryKey;
  const owner = record?.[ownerField] ?? record?.Owner ?? record?.owner ?? record?.Address ?? '';
  if (identity == null || identity === '') return '';
  return `${String(identity).toLowerCase()}-${String(owner || '').toLowerCase()}`;
}

function handleDedupeStart(payload) {
  const planId = String(payload.planId || 'default');
  dedupePlans.set(planId, new Set());
  return { planId };
}

function handleDedupeBatch(payload) {
  const planId = String(payload.planId || 'default');
  const seen = dedupePlans.get(planId) || new Set();
  dedupePlans.set(planId, seen);

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  const duplicatesToRemove = [];

  for (let i = 0; i < rows.length; i++) {
    const compositeKey = identityFor(rows[i] || {}, keys[i], payload.keyField, payload.ownerField);
    if (!compositeKey) continue;
    if (seen.has(compositeKey)) duplicatesToRemove.push(keys[i]);
    else seen.add(compositeKey);
  }

  return {
    records: rows.length,
    duplicatesToRemove,
    seenCount: seen.size
  };
}

function handleDedupeFinish(payload) {
  const planId = String(payload.planId || 'default');
  dedupePlans.delete(planId);
  return { planId };
}

self.onmessage = function (event) {
  const { id, type, payload = {} } = event.data || {};
  const progress = (percent, detail = {}) => {
    self.postMessage({ id, type: 'progress', percent, detail });
  };

  try {
    let value;
    if (type === 'parseJson') {
      progress(5, { stage: 'parse' });
      value = JSON.parse(payload.text || '');
      progress(100, { stage: 'done' });
    } else if (type === 'buildCointoolSummary') {
      progress(10, { stage: 'summary' });
      value = buildCointoolSummaryIndexFromProxies(payload.proxies || [], Number(payload.maxPerBatch || 64), payload);
      progress(100, { stage: 'done' });
    } else if (type === 'buildCointoolRenderData') {
      const proxies = payload.proxies || [];
      progress(1, { stage: 'start', proxies: proxies.length });
      const summary = buildCointoolSummaryIndexFromProxies(proxies, Number(payload.maxPerBatch || 64), payload);
      progress(45, { stage: 'summary', proxies: proxies.length });
      const rows = groupAndChunkProxies(proxies, Number(payload.maxPerBatch || 64), payload, progress);
      progress(100, { stage: 'done', rows: rows.length });
      value = { rows, summary };
    } else if (type === 'dedupeStart') {
      value = handleDedupeStart(payload);
    } else if (type === 'dedupeBatch') {
      value = handleDedupeBatch(payload);
    } else if (type === 'dedupeFinish') {
      value = handleDedupeFinish(payload);
    } else {
      throw new Error(`Unknown worker task: ${type}`);
    }
    self.postMessage({ id, ok: true, value });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      message: error?.message || String(error || 'Worker task failed')
    });
  }
};
