// Lightweight in-app performance collector and diagnostics panel.
(function () {
  const root = window.wenxen = window.wenxen || {};
  if (root.perf) return;

  const metrics = Object.create(null);
  const jobs = new Map();
  const events = [];
  let jobSeq = 0;

  function nowMs() {
    return (window.performance && typeof window.performance.now === 'function')
      ? window.performance.now()
      : Date.now();
  }

  function wallTime() {
    return Date.now();
  }

  function rememberEvent(event) {
    events.push({ at: new Date().toISOString(), ...event });
    if (events.length > 80) events.shift();
  }

  function setMetric(key, value) {
    metrics[key] = value;
    scheduleRender();
    return value;
  }

  function addMetric(key, amount = 1) {
    const next = Number(metrics[key] || 0) + amount;
    return setMetric(key, next);
  }

  function startJob(name, meta = {}) {
    const id = `${name}-${++jobSeq}`;
    const startedAt = nowMs();
    const job = {
      id,
      name,
      meta,
      progress: 0,
      status: 'running',
      startedAt: wallTime(),
      elapsedMs: 0
    };
    jobs.set(id, job);
    setMetric('pendingBackgroundJobs', jobs.size);
    rememberEvent({ type: 'job-start', name, id, meta });
    scheduleRender();

    return {
      id,
      progress(percent, detail = {}) {
        const current = jobs.get(id);
        if (!current) return;
        current.progress = Math.max(0, Math.min(100, Number(percent) || 0));
        current.meta = { ...current.meta, ...detail };
        current.elapsedMs = Math.round(nowMs() - startedAt);
        scheduleRender();
      },
      done(extra = {}) {
        const current = jobs.get(id);
        const elapsedMs = Math.round(nowMs() - startedAt);
        jobs.delete(id);
        setMetric('pendingBackgroundJobs', jobs.size);
        rememberEvent({ type: 'job-complete', name, id, elapsedMs, ...extra });
        scheduleRender();
        return elapsedMs;
      },
      fail(error) {
        const elapsedMs = Math.round(nowMs() - startedAt);
        jobs.delete(id);
        setMetric('pendingBackgroundJobs', jobs.size);
        rememberEvent({
          type: 'job-error',
          name,
          id,
          elapsedMs,
          message: error?.message || String(error || 'unknown')
        });
        scheduleRender();
      }
    };
  }

  async function time(name, fn, options = {}) {
    const started = nowMs();
    try {
      return await fn();
    } finally {
      const elapsedMs = Math.round(nowMs() - started);
      setMetric(name, elapsedMs);
      if (options.event !== false) rememberEvent({ type: 'timing', name, elapsedMs });
    }
  }

  function getSnapshot() {
    const chain = window.chainManager?.getCurrentChain?.() || 'Unknown';
    const scheduledJobs = window.wenxen?.backgroundJobs?.list?.() || [];
    return {
      capturedAt: new Date().toISOString(),
      chain,
      metrics: {
        currentChain: chain,
        proxyRecordCount: metrics.proxyRecordCount ?? null,
        groupedCointoolRowCount: metrics.groupedCointoolRowCount ?? null,
        totalUnifiedRowCount: metrics.totalUnifiedRowCount ?? null,
        renderCacheStatus: metrics.renderCacheStatus ?? null,
        renderCacheVersion: metrics.renderCacheVersion ?? null,
        lastUnifiedRefreshMs: metrics.lastUnifiedRefreshMs ?? null,
        lastCointoolGroupingMs: metrics.lastCointoolGroupingMs ?? null,
        lastCointoolGroupingSource: metrics.lastCointoolGroupingSource ?? null,
        lastSummaryRebuildMs: metrics.lastSummaryRebuildMs ?? null,
        lastCalendarUpdateMs: metrics.lastCalendarUpdateMs ?? null,
        lastTableApplyMs: metrics.lastTableApplyMs ?? null,
        lastBackupExportMs: metrics.lastBackupExportMs ?? null,
        lastBackupImportMs: metrics.lastBackupImportMs ?? null,
        lastBackupCompression: metrics.lastBackupCompression ?? null,
        lastBackupRawBytes: metrics.lastBackupRawBytes ?? null,
        lastBackupDownloadBytes: metrics.lastBackupDownloadBytes ?? null,
        lastBackupCompressedBytes: metrics.lastBackupCompressedBytes ?? null,
        lastBackupDecompressedBytes: metrics.lastBackupDecompressedBytes ?? null,
        lastDedupeMs: metrics.lastDedupeMs ?? null,
        pendingBackgroundJobs: jobs.size,
        scheduledBackgroundJobs: scheduledJobs,
        workerAvailable: metrics.workerAvailable ?? (typeof Worker === 'function'),
        workerLastProgress: metrics.workerLastProgress ?? null,
        debugLogging: localStorage.getItem('wenxenPerfDebug') === 'true'
      },
      jobs: Array.from(jobs.values()).map(job => ({ ...job }))
        .concat(scheduledJobs.map(name => ({ id: `scheduled:${name}`, name, status: 'scheduled', progress: 0 }))),
      recentEvents: events.slice(-20)
    };
  }

  let renderTimer = null;
  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(() => {
      renderTimer = null;
      renderPanel();
    }, 120);
  }

  function formatValue(value) {
    if (value == null || value === '') return 'n/a';
    if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : 'n/a';
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    return String(value);
  }

  function formatBytes(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 'n/a';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderPanel() {
    const panel = document.getElementById('performanceMetrics');
    if (!panel) return;
    const snapshot = getSnapshot();
    const rows = [
      ['Chain', snapshot.metrics.currentChain],
      ['Proxy records', snapshot.metrics.proxyRecordCount],
      ['Grouped Cointool rows', snapshot.metrics.groupedCointoolRowCount],
      ['Unified rows', snapshot.metrics.totalUnifiedRowCount],
      ['Render cache', snapshot.metrics.renderCacheStatus],
      ['Unified refresh', snapshot.metrics.lastUnifiedRefreshMs == null ? null : `${snapshot.metrics.lastUnifiedRefreshMs} ms`],
      ['Cointool grouping', snapshot.metrics.lastCointoolGroupingMs == null ? null : `${snapshot.metrics.lastCointoolGroupingMs} ms (${snapshot.metrics.lastCointoolGroupingSource || 'unknown'})`],
      ['Summary rebuild', snapshot.metrics.lastSummaryRebuildMs == null ? null : `${snapshot.metrics.lastSummaryRebuildMs} ms`],
      ['Calendar update', snapshot.metrics.lastCalendarUpdateMs == null ? null : `${snapshot.metrics.lastCalendarUpdateMs} ms`],
      ['Table apply', snapshot.metrics.lastTableApplyMs == null ? null : `${snapshot.metrics.lastTableApplyMs} ms`],
      ['Backup export/import', `${formatValue(snapshot.metrics.lastBackupExportMs)} / ${formatValue(snapshot.metrics.lastBackupImportMs)} ms`],
      ['Backup size', snapshot.metrics.lastBackupRawBytes == null && snapshot.metrics.lastBackupDownloadBytes == null ? null : `${formatBytes(snapshot.metrics.lastBackupRawBytes)} -> ${formatBytes(snapshot.metrics.lastBackupDownloadBytes)} (${snapshot.metrics.lastBackupCompression || 'none'})`],
      ['Dedupe', snapshot.metrics.lastDedupeMs == null ? null : `${snapshot.metrics.lastDedupeMs} ms`],
      ['Pending jobs', snapshot.metrics.pendingBackgroundJobs],
      ['Worker available', snapshot.metrics.workerAvailable]
    ];
    panel.innerHTML = rows.map(([label, value]) => `
      <div class="perf-metric-row">
        <span class="perf-metric-label">${label}</span>
        <span class="perf-metric-value">${formatValue(value)}</span>
      </div>
    `).join('');

    const jobsEl = document.getElementById('performanceJobs');
    if (jobsEl) {
      jobsEl.textContent = snapshot.jobs.length
        ? snapshot.jobs.map(job => `${job.name}: ${Math.round(job.progress || 0)}%`).join(' | ')
        : 'No background jobs';
    }
  }

  async function copyDiagnostics() {
    const text = JSON.stringify(getSnapshot(), null, 2);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    const status = document.getElementById('performanceCopyStatus');
    if (status) {
      status.textContent = 'Diagnostics copied';
      setTimeout(() => { status.textContent = ''; }, 2500);
    }
  }

  function wirePanel() {
    const refreshBtn = document.getElementById('refreshPerformanceBtn');
    const copyBtn = document.getElementById('copyPerformanceBtn');
    const debugToggle = document.getElementById('perfDebugLogging');

    refreshBtn?.addEventListener('click', renderPanel);
    copyBtn?.addEventListener('click', () => copyDiagnostics().catch(error => {
      const status = document.getElementById('performanceCopyStatus');
      if (status) status.textContent = error?.message || 'Copy failed';
    }));
    if (debugToggle) {
      debugToggle.checked = localStorage.getItem('wenxenPerfDebug') === 'true';
      debugToggle.addEventListener('change', () => {
        localStorage.setItem('wenxenPerfDebug', debugToggle.checked ? 'true' : 'false');
        setMetric('debugLogging', debugToggle.checked);
      });
    }
    renderPanel();
  }

  document.addEventListener('DOMContentLoaded', wirePanel);
  setInterval(renderPanel, 5000);

  root.perf = {
    set: setMetric,
    add: addMetric,
    startJob,
    time,
    event: rememberEvent,
    getSnapshot,
    render: renderPanel,
    copyDiagnostics
  };
  window.wenxenPerf = root.perf;
})();
