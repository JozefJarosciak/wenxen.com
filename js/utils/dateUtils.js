// Date utilities - shared date formatting and parsing functions
export const dateUtils = {
  // Format timestamp to local date-time string
  formatLocalDateTime(ts) {
    if (!Number.isFinite(ts) || ts <= 0) return "";
    if (typeof window.luxon !== "undefined" && window.luxon.DateTime) {
      try {
        return window.luxon.DateTime.fromSeconds(ts)
          .setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
          .toFormat("yyyy LLL dd, hh:mm a");
      } catch {}
    }
    const d = new Date(ts * 1000);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dd = String(d.getDate()).padStart(2, "0");
    let h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${d.getFullYear()} ${months[d.getMonth()]} ${dd}, ${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
  },

  // Format to local date only (YYYY-MM-DD)
  formatLocalDateKey(ts) {
    if (!Number.isFinite(ts) || ts <= 0) return "";
    if (typeof window.luxon !== "undefined" && window.luxon.DateTime) {
      try {
        return window.luxon.DateTime.fromSeconds(ts)
          .setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
          .toFormat("yyyy-MM-dd");
      } catch {}
    }
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },

  // Format local date for display
  formatLocalDate(date) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleString("en-US", options).replace(/\s[A-Z]{3,4}$/, "");
  },

  // Format UTC date
  formatUTCDate(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`;
  },

  // Get local date string (YYYY-MM-DD format from Date object)
  getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Build day key from Date object in local time
  buildDayKeyFromDate(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  },

  // Parse "YYYY Mon DD" format into Date
  parseYearMonDay(str) {
    const m = String(str || "").trim().match(/^(\d{4})\s+([A-Za-z]{3})(?:\s+(\d{1,2}))?$/);
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const monAbbr = m[2].toLowerCase();
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const mi = months.indexOf(monAbbr);
    if (mi < 0) return null;
    const day = m[3] ? Math.max(1, Math.min(31, parseInt(m[3], 10))) : 1;
    return new Date(year, mi, day);
  },

  // Parse maturity format to key
  parseMaturityFmtToKey(fmt) {
    if (!fmt) return "";
    const m = String(fmt).match(/^(\d{4})\s+([A-Za-z]{3})\s+(\d{1,2})/);
    if (!m) return "";
    const map = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
    const y = m[1], mo = map[m[2]] || "01", d = String(m[3]).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  },

  // Format term date preview (now + termDays)
  formatTermDate(termDays) {
    const now = new Date();
    const ms = Number(termDays) * 24 * 60 * 60 * 1000;
    const target = new Date(now.getTime() + ms);
    return target.toLocaleDateString(undefined, { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  },

  // Current timestamp in readable format
  formatCurrentTimestamp() {
    return new Date().toLocaleString();
  }
};

// Legacy global functions for backward compatibility
window.fmtLocalDateTime = dateUtils.formatLocalDateTime;
window.dayKeyLocal = dateUtils.formatLocalDateKey;
window.formatLocalDate = dateUtils.formatLocalDate;
window.formatUTCDate = dateUtils.formatUTCDate;
window.getLocalDateString = dateUtils.getLocalDateString;
window.buildDayKeyFromDate = dateUtils.buildDayKeyFromDate;
window.parseYearMonDay = dateUtils.parseYearMonDay;
window.parseMaturityFmtToKey = dateUtils.parseMaturityFmtToKey;
window.formatTermDate = dateUtils.formatTermDate;
window.fmtTs = dateUtils.formatCurrentTimestamp;