// Shared worker RPC helper for CPU-heavy WenXen tasks.
(function () {
  const root = window.wenxen = window.wenxen || {};
  if (root.workerClient) return;

  let worker = null;
  let seq = 0;
  const pending = new Map();

  function getWorkerUrl() {
    const script = document.currentScript;
    const version = script?.src?.match(/[?&]v=([^&]+)/)?.[1] || Date.now();
    return `./js/workers/wenxenWorker.js?v=${encodeURIComponent(version)}`;
  }

  let workerUrl = './js/workers/wenxenWorker.js';

  function ensureWorker() {
    if (typeof Worker !== 'function') throw new Error('Worker is not available');
    if (worker) return worker;
    worker = new Worker(workerUrl);
    window.wenxen?.perf?.set?.('workerAvailable', true);

    worker.onmessage = event => {
      const msg = event.data || {};
      const item = pending.get(msg.id);
      if (!item) return;

      if (msg.type === 'progress') {
        item.job?.progress(msg.percent || 0, msg.detail || {});
        item.onProgress?.(msg.percent || 0, msg.detail || {});
        window.wenxen?.perf?.set?.('workerLastProgress', `${item.type}: ${Math.round(msg.percent || 0)}%`);
        return;
      }

      pending.delete(msg.id);
      if (msg.ok) {
        item.job?.done({ type: item.type });
        item.resolve(msg.value);
      } else {
        const error = new Error(msg.message || `${item.type} worker task failed`);
        item.job?.fail(error);
        item.reject(error);
      }
    };

    worker.onerror = event => {
      const error = event.error || new Error(event.message || 'Worker failed');
      for (const item of pending.values()) {
        item.job?.fail(error);
        item.reject(error);
      }
      pending.clear();
      terminateWorker();
      window.wenxen?.perf?.set?.('workerAvailable', false);
    };

    return worker;
  }

  function terminateWorker() {
    if (worker) {
      try { worker.terminate(); } catch (_) {}
      worker = null;
    }
  }

  function run(type, payload = {}, options = {}) {
    if (options.fallbackOnly || typeof Worker !== 'function') {
      return Promise.reject(new Error('Worker is not available'));
    }
    const id = ++seq;
    const job = window.wenxen?.perf?.startJob?.(options.jobName || type, {
      workerTask: type,
      ...(options.meta || {})
    });

    return new Promise((resolve, reject) => {
      pending.set(id, {
        id,
        type,
        resolve,
        reject,
        onProgress: options.onProgress,
        job
      });

      try {
        ensureWorker().postMessage({ id, type, payload });
      } catch (error) {
        pending.delete(id);
        job?.fail(error);
        reject(error);
      }
    });
  }

  function cancelAll(reason = 'cancelled') {
    const error = new Error(reason);
    for (const item of pending.values()) {
      item.job?.fail(error);
      item.reject(error);
    }
    pending.clear();
    terminateWorker();
    window.wenxen?.perf?.event?.({ type: 'worker-cancel', reason });
  }

  function pendingCount() {
    return pending.size;
  }

  try { workerUrl = getWorkerUrl(); } catch (_) {}

  root.workerClient = {
    run,
    cancelAll,
    pendingCount,
    isAvailable: () => typeof Worker === 'function'
  };
  window.wenxenWorkerClient = root.workerClient;

  const installChainCancel = () => {
    try {
      window.chainManager?.onChainChange?.(() => cancelAll('chain-change'));
    } catch (_) {}
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(installChainCancel, 0), { once: true });
  } else {
    setTimeout(installChainCancel, 0);
  }
})();
