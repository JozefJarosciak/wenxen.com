(function () {
  let instance = null;
  let dateCounts = Object.create(null);
  let lastTodayKey = "";
  let dayRolloverTimer = null;
  let autoSelectedToday = true;
  let internalDateRefresh = false;
  let options = {
    firstDayOfWeek: 1,
    hideOtherMonthDays: true,
    onDateClick: null,
    onDateChange: null,
    onClear: null,
    onMonthYearChange: null,
    afterInteraction: null
  };

  function getCalendarElement() {
    return document.getElementById("calendar");
  }

  function normalizeCounts(counts) {
    const out = Object.create(null);
    if (!counts || typeof counts !== "object") return out;
    for (const key of Object.keys(counts)) {
      const n = Number(counts[key]) || 0;
      if (key && n > 0) out[key] = n;
    }
    return out;
  }

  function mergeOptions(nextOptions) {
    if (!nextOptions || typeof nextOptions !== "object") return;
    options = { ...options, ...nextOptions };
  }

  function buildDayKey(date) {
    if (typeof window.buildDayKeyFromDate === "function") {
      return window.buildDayKeyFromDate(date);
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getTodayKey() {
    return buildDayKey(new Date());
  }

  function getNextLocalDayDelay() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 2, 0);
    return Math.max(1000, next.getTime() - now.getTime());
  }

  function scheduleDayRolloverCheck() {
    if (dayRolloverTimer) clearTimeout(dayRolloverTimer);
    dayRolloverTimer = setTimeout(() => {
      refreshTodayState("timer");
      scheduleDayRolloverCheck();
    }, getNextLocalDayDelay());
  }

  function fixHeader(fpInstance) {
    try {
      const root = fpInstance && fpInstance.calendarContainer;
      if (!root) return;
      const hdr = root.querySelector(".flatpickr-current-month");
      if (hdr) {
        hdr.style.paddingTop = "0px";
        hdr.style.padding = "0px";
      }
    } catch (_) {}
  }

  function syncGlobals() {
    window.calendarPicker = instance;
    window._calendar = instance;
  }

  function callHandler(name, ...args) {
    const fn = options[name];
    if (typeof fn !== "function") return;
    try { fn(...args); } catch (_) {}
  }

  function onDayCreate(_dObj, _dStr, _fp, dayElem) {
    const dt = dayElem && dayElem.dateObj;
    if (!dt) return;

    const oldBadge = dayElem.querySelector(".wenxen-calendar-badge");
    if (oldBadge) oldBadge.remove();

    const isOtherMonth = dayElem.classList.contains("prevMonthDay") ||
      dayElem.classList.contains("nextMonthDay");

    if (options.hideOtherMonthDays && isOtherMonth) {
      dayElem.style.visibility = "hidden";
      dayElem.style.pointerEvents = "none";
      dayElem.onclick = null;
      return;
    }

    dayElem.style.visibility = "";
    dayElem.style.pointerEvents = "";
    dayElem.style.position = "relative";
    dayElem.style.overflow = "visible";

    dayElem.onclick = function () {
      autoSelectedToday = false;
      callHandler("onDateClick", dayElem.dateObj || dt, instance);
    };

    const key = buildDayKey(dt);
    dayElem.classList.toggle("today", key === getTodayKey());

    const count = dateCounts[key];
    if (!count) return;

    const badge = document.createElement("span");
    badge.className = "wenxen-calendar-badge";
    badge.textContent = String(count);
    badge.style.position = "absolute";
    badge.style.top = "-2px";
    badge.style.right = "-2px";
    badge.style.minWidth = "18px";
    badge.style.height = "18px";
    badge.style.padding = "0 6px";
    badge.style.lineHeight = "18px";
    badge.style.textAlign = "center";
    badge.style.fontSize = "10px";
    badge.style.backgroundColor = "#063d85";
    badge.style.color = "yellow";
    badge.style.borderRadius = "999px";
    badge.style.cursor = "pointer";
    badge.style.whiteSpace = "nowrap";
    badge.style.zIndex = "2";

    badge.addEventListener("click", function (event) {
      event.stopPropagation();
      autoSelectedToday = false;
      callHandler("onDateClick", dayElem.dateObj || dt, instance);
    });

    dayElem.appendChild(badge);
  }

  function patchInstanceMethods(fp) {
    if (!fp || fp.__wenxenCalendarPatched) return;

    if (typeof fp.setDate === "function") {
      const originalSetDate = fp.setDate.bind(fp);
      fp.setDate = function (...args) {
        if (!internalDateRefresh) autoSelectedToday = false;
        return originalSetDate(...args);
      };
    }

    if (typeof fp.clear === "function") {
      const originalClear = fp.clear.bind(fp);
      fp.clear = function (...args) {
        if (!internalDateRefresh) autoSelectedToday = false;
        return originalClear(...args);
      };
    }

    fp.__wenxenCalendarPatched = true;
  }

  function refreshTodayState(reason, force) {
    const todayKey = getTodayKey();
    const changed = todayKey !== lastTodayKey;
    if (!force && !changed) return false;

    const previousKey = lastTodayKey;
    lastTodayKey = todayKey;

    const fp = instance;
    if (fp) {
      try { fp.now = new Date(); } catch (_) {}
      if (autoSelectedToday && typeof fp.setDate === "function") {
        internalDateRefresh = true;
        try { fp.setDate(new Date(), false); } catch (_) {}
        internalDateRefresh = false;
      }
      try { fp.redraw(); } catch (_) {}
      fixHeader(fp);
      syncGlobals();
    }

    if (changed && previousKey) {
      try {
        window.dispatchEvent(new CustomEvent("wenxen:calendar-day-change", {
          detail: { previousKey, todayKey, reason: reason || "unknown" }
        }));
      } catch (_) {}
    }

    return changed;
  }

  function ensureInstance(nextOptions) {
    mergeOptions(nextOptions);
    if (instance && instance.calendarContainer) {
      syncGlobals();
      return instance;
    }

    const el = getCalendarElement();
    if (!el || typeof window.flatpickr !== "function") return null;
    el.style.display = "block";

    instance = window.flatpickr(el, {
      inline: true,
      defaultDate: "today",
      locale: { firstDayOfWeek: options.firstDayOfWeek },
      onDayCreate,
      onChange: function (selectedDates) {
        if (!internalDateRefresh) autoSelectedToday = false;
        if (selectedDates && selectedDates.length) {
          callHandler("onDateChange", selectedDates[0], instance);
        } else {
          callHandler("onClear", instance);
        }
        callHandler("afterInteraction", instance);
      },
      onMonthChange: function (_selectedDates, _dateStr, fp) {
        fixHeader(fp);
        callHandler("onMonthYearChange", fp.currentYear, fp.currentMonth, fp);
        callHandler("afterInteraction", fp);
      },
      onYearChange: function (_selectedDates, _dateStr, fp) {
        fixHeader(fp);
        callHandler("onMonthYearChange", fp.currentYear, fp.currentMonth, fp);
        callHandler("afterInteraction", fp);
      },
      onReady: function (_selectedDates, _dateStr, fp) {
        fixHeader(fp);
      }
    });

    patchInstanceMethods(instance);
    lastTodayKey = getTodayKey();
    scheduleDayRolloverCheck();
    syncGlobals();
    return instance;
  }

  function update(counts, nextOptions) {
    dateCounts = normalizeCounts(counts);
    mergeOptions(nextOptions);
    const fp = ensureInstance();
    if (!fp) return null;
    try { fp.redraw(); } catch (_) {}
    fixHeader(fp);
    syncGlobals();
    return fp;
  }

  function getInstance() {
    return ensureInstance();
  }

  const api = {
    init: ensureInstance,
    update,
    get: getInstance,
    refreshTodayState(force) {
      const changed = refreshTodayState("manual", force === true);
      scheduleDayRolloverCheck();
      return changed;
    },
    redraw() {
      const fp = getInstance();
      if (!fp) return null;
      refreshTodayState("redraw", false);
      try { fp.redraw(); } catch (_) {}
      fixHeader(fp);
      return fp;
    },
    jumpToDate(date) {
      const fp = getInstance();
      if (!fp || typeof fp.jumpToDate !== "function") return;
      fp.jumpToDate(date);
    },
    clear(triggerChange) {
      const fp = getInstance();
      if (!fp || typeof fp.clear !== "function") return;
      fp.clear(triggerChange === true);
    },
    fixHeader
  };

  window.calendarController = api;
  window.getActiveCalendar = function () {
    return api.get();
  };

  window.addEventListener("focus", () => {
    refreshTodayState("focus");
    scheduleDayRolloverCheck();
  });
  window.addEventListener("pageshow", () => {
    refreshTodayState("pageshow");
    scheduleDayRolloverCheck();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshTodayState("visibility");
      scheduleDayRolloverCheck();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => api.init(), { once: true });
  } else {
    api.init();
  }
})();
