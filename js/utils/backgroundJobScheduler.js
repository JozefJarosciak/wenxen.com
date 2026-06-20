// Cooperative scheduler for low-priority background work.
(function () {
  const root = window.wenxen = window.wenxen || {};
  if (root.backgroundJobs) return;

  const jobs = new Map();
  let busyReasons = new Set();

  function isBusy() {
    return busyReasons.size > 0 || !!window.__scanAllActive || document.body?.dataset?.wenxenBusy === 'true';
  }

  function setBusy(reason, busy = true) {
    const key = String(reason || 'app');
    if (busy) busyReasons.add(key);
    else busyReasons.delete(key);
  }

  function getDelayMs(job) {
    try {
      const raw = typeof job.delayMs === 'function' ? job.delayMs() : job.delayMs;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : 60000;
    } catch {
      return 60000;
    }
  }

  function stop(name) {
    const job = jobs.get(name);
    if (!job) return;
    job.stopped = true;
    if (job.timerId) clearTimeout(job.timerId);
    jobs.delete(name);
  }

  function schedule(job, delayMs) {
    if (job.stopped) return;
    if (job.timerId) clearTimeout(job.timerId);
    job.timerId = setTimeout(() => run(job), Math.max(0, delayMs));
  }

  async function run(job) {
    if (job.stopped) return;

    if (job.lowPriority && isBusy()) {
      schedule(job, Math.min(5000, Math.max(1000, getDelayMs(job))));
      return;
    }

    if (job.skipWhenHidden && document.hidden) {
      schedule(job, getDelayMs(job));
      return;
    }

    try {
      await job.fn();
    } catch (error) {
      if (job.onError) job.onError(error);
      else console.warn(`[BackgroundJobs] ${job.name} failed:`, error?.message || error);
    } finally {
      schedule(job, getDelayMs(job));
    }
  }

  function start(name, fn, delayMs, options = {}) {
    stop(name);
    const job = {
      name,
      fn,
      delayMs,
      lowPriority: options.lowPriority !== false,
      skipWhenHidden: !!options.skipWhenHidden,
      onError: options.onError,
      stopped: false,
      timerId: null
    };
    jobs.set(name, job);
    schedule(job, options.immediate ? 0 : getDelayMs(job));
    return job;
  }

  function runSoon(name, delayMs = 0) {
    const job = jobs.get(name);
    if (job) schedule(job, delayMs);
  }

  root.backgroundJobs = {
    start,
    stop,
    runSoon,
    setBusy,
    isBusy,
    list: () => Array.from(jobs.keys())
  };

  window.wenxenBackgroundJobs = root.backgroundJobs;
})();
