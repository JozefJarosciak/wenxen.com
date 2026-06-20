// Hosted usage tracking manager.
// On wenxen.com tracking is enabled by default; elsewhere it is opt-in.

(function() {
  'use strict';

  const GA_ID = 'G-333LEVEH6W';
  const TRACKING_KEY = 'trackingEnabled';
  const STATCOUNTER = {
    project: 13304969,
    security: '9b8b4d99'
  };

  let loaded = false;

  function isHostedDomain() {
    const host = String(window.location.hostname || '').toLowerCase();
    return host === 'wenxen.com' || host === 'www.wenxen.com';
  }

  function getStoredPreference() {
    try {
      const raw = localStorage.getItem(TRACKING_KEY);
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    } catch (_) {}
    return null;
  }

  function isTrackingEnabled() {
    const stored = getStoredPreference();
    return stored === null ? isHostedDomain() : stored;
  }

  function setGaDisabled(disabled) {
    window[`ga-disable-${GA_ID}`] = !!disabled;
  }

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }

  function initGoogleAnalytics() {
    if (!window.dataLayer) window.dataLayer = [];
    if (!window.gtag) {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }

    setGaDisabled(false);
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      page_title: document.title,
      page_location: window.location.href,
      anonymize_ip: true,
      allow_ad_personalization_signals: false
    });

    loadScript('wenxen-ga-script', `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
  }

  function initStatcounter() {
    window.sc_project = STATCOUNTER.project;
    window.sc_invisible = 1;
    window.sc_security = STATCOUNTER.security;
    loadScript('wenxen-statcounter-script', 'https://www.statcounter.com/counter/counter.js');
  }

  function loadTracking() {
    if (loaded || !isTrackingEnabled()) return;
    loaded = true;
    initGoogleAnalytics();
    initStatcounter();
  }

  function unloadTracking() {
    setGaDisabled(true);
    document.getElementById('wenxen-ga-script')?.remove();
    document.getElementById('wenxen-statcounter-script')?.remove();
    loaded = false;
  }

  function setTrackingEnabled(enabled) {
    const on = !!enabled;
    try {
      localStorage.setItem(TRACKING_KEY, on ? 'true' : 'false');
    } catch (_) {}
    if (!on) unloadTracking();
    else setGaDisabled(false);
    syncTrackingToggle();
    if (on) loadTracking();
  }

  function syncTrackingToggle() {
    const checkbox = document.getElementById('trackingEnabled');
    if (checkbox) checkbox.checked = isTrackingEnabled();
    const status = document.getElementById('trackingStatus');
    if (status) {
      status.textContent = isTrackingEnabled()
        ? 'Usage analytics are enabled on this browser.'
        : 'Usage analytics are disabled on this browser.';
    }
  }

  function wireTrackingToggle() {
    const checkbox = document.getElementById('trackingEnabled');
    if (!checkbox || checkbox.dataset.trackingWired === '1') return;
    checkbox.dataset.trackingWired = '1';
    syncTrackingToggle();
    checkbox.addEventListener('change', () => {
      setTrackingEnabled(checkbox.checked);
      if (typeof window.showToast === 'function') {
        window.showToast(`Usage analytics ${checkbox.checked ? 'enabled' : 'disabled'}`, 'success');
      }
    });
  }

  window.isTrackingEnabled = isTrackingEnabled;
  window.setTrackingEnabled = setTrackingEnabled;
  window.trackEvent = function(action, category, label, value) {
    if (!isTrackingEnabled() || !window.gtag) return;
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value
    });
  };
  window.trackPageView = function(pageTitle, pageLocation) {
    if (!isTrackingEnabled() || !window.gtag) return;
    window.gtag('config', GA_ID, {
      page_title: pageTitle || document.title,
      page_location: pageLocation || window.location.href
    });
  };

  setGaDisabled(!isTrackingEnabled());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wireTrackingToggle();
      loadTracking();
    });
  } else {
    wireTrackingToggle();
    loadTracking();
  }
})();
