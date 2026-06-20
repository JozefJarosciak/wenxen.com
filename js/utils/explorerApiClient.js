// Shared Etherscan V2 client for classic scanner scripts.
(function () {
  if (window.explorerApiClient) return;

  const API_URL = "https://api.etherscan.io/v2/api";
  const PAGE_SIZE = 10000;
  const MAX_DEPTH = 30;
  const REQUEST_TIMEOUT_MS = 45000;
  const RATE_PER_SECOND = 4;

  let lastCallAt = 0;
  let queue = Promise.resolve();

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function getChainId() {
    return window.chainManager?.getCurrentConfig?.()?.id || 1;
  }

  function appendParam(url, key, value) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  function buildUrl(params, apiKey) {
    const url = new URL(API_URL);
    appendParam(url, "chainid", params.chainid || getChainId());
    Object.entries(params).forEach(([key, value]) => {
      if (key !== "chainid") appendParam(url, key, value);
    });
    appendParam(url, "apikey", apiKey || params.apikey || "");
    return url.toString();
  }

  async function waitForSlot() {
    const interval = Math.ceil(1000 / RATE_PER_SECOND);
    const run = queue.catch(() => {}).then(async () => {
      const wait = Math.max(0, lastCallAt + interval - Date.now());
      if (wait > 0) await sleep(wait);
      lastCallAt = Date.now();
    });
    queue = run;
    return run;
  }

  function isEmptyExplorerResult(data) {
    const msg = `${data?.message || ""} ${data?.result || ""}`;
    return /no transactions found|no records found/i.test(msg) ||
      (Array.isArray(data?.result) && data.result.length === 0);
  }

  function isRateLimitError(value) {
    return /rate limit|Max calls per sec/i.test(String(value?.message || value || ""));
  }

  function normalizeRows(data) {
    if (data?.status === "1") {
      if (Array.isArray(data.result)) return data.result;
      return data.result ? [data.result] : [];
    }

    if (isEmptyExplorerResult(data)) return [];

    const msg = `${data?.message || ""} ${data?.result || ""}`.trim();
    if (isRateLimitError(msg)) {
      throw new Error(`RATE_LIMIT: ${msg}`);
    }
    throw new Error(`Explorer API error: ${msg || "unexpected response"}`);
  }

  async function request(params, apiKey, options = {}) {
    const attempts = Number(options.attempts || 4);
    const timeoutMs = Number(options.timeoutMs || REQUEST_TIMEOUT_MS);
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        await waitForSlot();
        const response = await fetch(buildUrl(params, apiKey), { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return normalizeRows(data);
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;
        if (attempt >= attempts) break;

        const backoff = isRateLimitError(error)
          ? Math.min(10000, 1000 * 2 ** attempt)
          : Math.min(5000, 500 * attempt);
        await sleep(backoff);
      }
    }

    throw lastError || new Error("Explorer API request failed");
  }

  function rowKey(row) {
    const key = [
      row.hash || row.transactionHash || "",
      row.logIndex || row.transactionIndex || "",
      row.tokenID || row.tokenId || "",
      row.blockNumber || "",
      row.nonce || ""
    ].join(":");
    return key === "::::" ? JSON.stringify(row) : key.toLowerCase();
  }

  function sortAndDedupe(rows) {
    const seen = new Set();
    return rows
      .filter(row => {
        const key = rowKey(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) =>
        (Number(a.blockNumber || 0) - Number(b.blockNumber || 0)) ||
        (Number(a.transactionIndex || 0) - Number(b.transactionIndex || 0)) ||
        (Number(a.logIndex || 0) - Number(b.logIndex || 0))
      );
  }

  async function fetchAccountActionSplit(options, depth = 0) {
    const pageSize = Number(options.pageSize || PAGE_SIZE);
    const startBlock = Number(options.startBlock ?? options.startblock ?? 0);
    const endValue = options.endBlock ?? options.endblock ?? "latest";
    const endBlock = Number(endValue);
    const numericRange = Number.isFinite(startBlock) && Number.isFinite(endBlock);

    const params = {
      module: "account",
      action: options.action,
      address: options.address,
      contractaddress: options.contractAddress || options.contractaddress,
      startblock: numericRange ? startBlock : (options.startBlock ?? options.startblock ?? 0),
      endblock: numericRange ? endBlock : endValue,
      page: 1,
      offset: pageSize,
      sort: options.sort || "asc"
    };

    const rows = await request(params, options.apiKey, options);
    options.onProgress?.({ startBlock: params.startblock, endBlock: params.endblock, rows, depth });

    if (!numericRange || rows.length < pageSize || depth >= (options.maxDepth || MAX_DEPTH)) {
      if (rows.length >= pageSize && depth >= (options.maxDepth || MAX_DEPTH)) {
        console.warn(`[ExplorerAPI] ${options.action} hit cap at max depth for blocks ${startBlock}-${endBlock}`);
      }
      return sortAndDedupe(rows);
    }

    if (startBlock >= endBlock) {
      console.warn(`[ExplorerAPI] ${options.action} hit cap in single block ${startBlock}`);
      return sortAndDedupe(rows);
    }

    const lastBlock = Number(rows[rows.length - 1]?.blockNumber);
    if (Number.isFinite(lastBlock) && lastBlock > startBlock && lastBlock < endBlock) {
      const tail = await fetchAccountActionSplit({
        ...options,
        startBlock: lastBlock,
        endBlock
      }, depth + 1);
      return sortAndDedupe(rows.concat(tail));
    }

    const mid = Math.floor((startBlock + endBlock) / 2);
    const left = await fetchAccountActionSplit({ ...options, startBlock, endBlock: mid }, depth + 1);
    const right = await fetchAccountActionSplit({ ...options, startBlock: mid + 1, endBlock }, depth + 1);
    return sortAndDedupe(left.concat(right));
  }

  function fetchTokenNftTxs(options) {
    return fetchAccountActionSplit({
      ...options,
      action: "tokennfttx"
    });
  }

  function fetchTxList(options) {
    return fetchAccountActionSplit({
      ...options,
      action: "txlist"
    });
  }

  async function fetchLogs(params, apiKey, options = {}) {
    return request({
      module: "logs",
      action: "getLogs",
      ...params
    }, apiKey, options);
  }

  window.explorerApiClient = {
    request,
    fetchAccountActionSplit,
    fetchTokenNftTxs,
    fetchTxList,
    fetchLogs
  };
})();
