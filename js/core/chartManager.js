// Chart Management Module - complete VMU Chart functionality with stacking, theming, and tooltips
// Restored from main_app.js to preserve all sophisticated chart features

// ===== Chart Variables =====
let vmuChart = null;
let _vmuChartReady = false;
let _vmuChartMetric = 'vmus';
let _vmuChartInitPending = false; // if true, (re)init when Dashboard becomes visible

// Make globally accessible immediately
window.vmuChart = vmuChart;

// ===== Chart Utility Functions =====

function _fmtAxisDateLabel(key){
  // Input key is 'YYYY-MM-DD'; output 'YYYY-Mon-DD'
  try {
    const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(key || '');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monIdx = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1));
    return `${m[1]}-${months[monIdx]}-${m[3]}`;
  } catch { return String(key || ''); }
}

function _collectActiveRows() {
  // Return ALL rows that are currently active (post-filter, post-sort), across all pages.
  try {
    const t = window.cointoolTable;
    if (!t) return [];
    // Preferred: data snapshot of all active rows
    try {
      const activeData = typeof t.getData === 'function' ? t.getData('active') : null;
      if (Array.isArray(activeData) && activeData.length >= 0) {
        console.debug('[VMU-CHART] _collectActiveRows source=data(active) count=', activeData.length);
        return activeData;
      }
    } catch {}
    // Fallback: RowComponents of active rows
    try {
      if (typeof t.getRows === 'function') {
        const rows = t.getRows('active');
        if (Array.isArray(rows)) {
          const out = rows.map(r => (typeof r.getData === 'function' ? r.getData() : r)).filter(Boolean);
          console.debug('[VMU-CHART] _collectActiveRows source=rows(active) count=', out.length);
          return out;
        }
      }
    } catch {}
    console.debug('[VMU-CHART] _collectActiveRows fallback to empty array');
    return [];
  } catch(e) {
    console.warn('[VMU-CHART] _collectActiveRows failed', e);
    return [];
  }
}

function _getTooltipDataByDateAndType(rows, dateKey) {
  const types = (window.innerWidth <= 768) ? ['CT', 'XNFT', 'S.XNFT', 'Stk'] : ['Cointool', 'XENFT', 'Stake XENFT', 'Stake'];
  const typeData = {};

  // Initialize type data
  types.forEach(type => {
    typeData[type] = { vmus: 0, xen: 0 };
  });

  for (const r of rows) {
    // Match the date logic from the chart functions
    let rowDateKey = r?.maturityDateOnly;
    if (!rowDateKey) {
      const t = Number(r?.Maturity_Timestamp || 0);
      if (Number.isFinite(t) && t > 0) {
        rowDateKey = window.getLocalDateString?.(new Date(t * 1000)) || '';
      } else if (typeof window.rowToLocalKey === 'function') {
        rowDateKey = window.rowToLocalKey(r);
      } else {
        continue;
      }
    }

    if (rowDateKey !== dateKey) continue;

    // Get VMUs and XEN
    const vmu = Number(r?.VMUs || 0);
    const xen = Number(window.estimateXENForRow?.(r) || 0);

    if (!Number.isFinite(vmu) || vmu <= 0) continue;

    let sourceType = String(r?.SourceType || 'Cointool');
    // Map to mobile abbreviations
    if (window.innerWidth <= 768) {
      if (sourceType === 'Cointool') sourceType = 'CT';
      else if (sourceType === 'XENFT') sourceType = 'XNFT';
      else if (sourceType === 'Stake XENFT') sourceType = 'S.XNFT';
      else if (sourceType === 'Stake') sourceType = 'Stk';
    }

    if (typeData[sourceType]) {
      typeData[sourceType].vmus += vmu;
      typeData[sourceType].xen += xen;
    }
  }

  return typeData;
}

function _groupVMUsByDateAndType(rows) {
  const typeMap = {};
  const types = (window.innerWidth <= 768) ? ['CT', 'XNFT', 'S.XNFT', 'Stk'] : ['Cointool', 'XENFT', 'Stake XENFT', 'Stake'];

  for (const r of rows) {
    const vmu = Number(r?.VMUs || 0);
    if (!Number.isFinite(vmu) || vmu <= 0) continue;

    let dateStr = r?.maturityDateOnly;
    if (!dateStr) {
      const t = Number(r?.Maturity_Timestamp || 0);
      if (Number.isFinite(t) && t > 0) {
        dateStr = window.getLocalDateString?.(new Date(t * 1000)) || '';
      } else {
        continue;
      }
    }

    let sourceType = String(r?.SourceType || 'Cointool');
    // Map to mobile abbreviations
    if (window.innerWidth <= 768) {
      if (sourceType === 'Cointool') sourceType = 'CT';
      else if (sourceType === 'XENFT') sourceType = 'XNFT';
      else if (sourceType === 'Stake XENFT') sourceType = 'S.XNFT';
      else if (sourceType === 'Stake') sourceType = 'Stk';
    }

    if (!typeMap[dateStr]) {
      typeMap[dateStr] = {};
      types.forEach(type => typeMap[dateStr][type] = 0);
    }

    typeMap[dateStr][sourceType] = (typeMap[dateStr][sourceType] || 0) + vmu;
  }

  const dates = Object.keys(typeMap).sort();
  const seriesData = types.map(type => ({
    name: type,
    data: dates.map(d => typeMap[d] ? (typeMap[d][type] || 0) : 0)
  }));

  console.debug('[VMU-CHART] _groupVMUsByDateAndType days=', dates.length, 'types=', types.length);
  return { dates, seriesData };
}

// ===== Chart Initialization =====

function initVmuChartSection() {
  if (_vmuChartReady) return;
  const wrap  = document.getElementById('vmu-chart-wrap');
  const body  = document.getElementById('vmuChartBody');
  const btn   = document.getElementById('vmuChartToggle');
  const node  = document.getElementById('vmuChart');
  if (!wrap || !body || !btn || !node) return;

  // Toggle behavior
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const next = !expanded;
    setVmuChartExpandedState(next);
  });

  // Metric toggle wiring
  const vmusBtn = document.getElementById('vmuChartModeVMUs');
  const usdBtn  = document.getElementById('vmuChartModeUSD');
  if (vmusBtn && usdBtn) {
    const applyUi = () => {
      vmusBtn.classList.toggle('active', _vmuChartMetric === 'vmus');
      usdBtn.classList.toggle('active', _vmuChartMetric === 'usd');
      vmusBtn.setAttribute('aria-selected', String(_vmuChartMetric === 'vmus'));
      usdBtn.setAttribute('aria-selected', String(_vmuChartMetric === 'usd'));
    };
    const setMetric = (m) => {
      if (m !== 'vmus' && m !== 'usd') m = 'vmus';
      _vmuChartMetric = m;
      try { localStorage.setItem('vmuChartMetric', m); } catch {}
      applyUi();
      updateVmuChart();
    };
    vmusBtn.addEventListener('click', () => setMetric('vmus'));
    usdBtn.addEventListener('click', () => setMetric('usd'));
    // initial from storage
    try { _vmuChartMetric = (localStorage.getItem('vmuChartMetric') || 'vmus'); } catch {}
    if (_vmuChartMetric !== 'vmus' && _vmuChartMetric !== 'usd') _vmuChartMetric = 'vmus';
    applyUi();
  }

  // Defer ECharts init until expanded
  window.addEventListener('resize', () => { try { if (vmuChart) vmuChart.resize(); } catch {} });

  _vmuChartReady = true;
  // Initialize from saved state (default collapsed on first load)
  try {
    const saved = (localStorage.getItem('vmuChartExpanded') || '0') === '1';
    setVmuChartExpandedState(saved);
  } catch (_) {}
}

// ===== Main Chart Update Function =====

function updateVmuChart() {
  if (!document.getElementById('vmuChart')) return;
  // Check if vmuChart exists or needs initialization
  if (typeof vmuChart === 'undefined' || (!vmuChart && !window.vmuChart)) {
    if (window.echarts) {
      // lazy init if needed
      initVmuChartSection();
    } else {
      return;  // ECharts not loaded yet
    }
  }
  if (!vmuChart && !window.vmuChart) return;
  const node = document.getElementById('vmuChart');
  const w = node ? node.offsetWidth : 0;
  const h = node ? node.offsetHeight : 0;
  console.debug('[VMU-CHART] updateVmuChart size:', {w,h});
  if (!(node && w > 0 && h > 0)) {
    console.debug('[VMU-CHART] skip update due to zero size, will retry in 100ms');
    // If container has no size yet, retry after a short delay
    setTimeout(() => {
      const retryW = node ? node.offsetWidth : 0;
      const retryH = node ? node.offsetHeight : 0;
      if (retryW > 0 && retryH > 0) {
        console.debug('[VMU-CHART] retry successful, size:', {w: retryW, h: retryH});
        updateVmuChart();
      }
    }, 100);
    return;
  }
  const rows = _collectActiveRows();
  let dates, seriesData;
  if (_vmuChartMetric === 'usd') {
    const out = window._groupXenUsdByDateAndType?.(rows);
    if (out) {
      dates = out.dates;
      seriesData = out.series || out.seriesData;
    } else {
      dates = [];
      seriesData = [];
    }
  } else {
    const out = _groupVMUsByDateAndType(rows);
    dates = out.dates;
    seriesData = out.seriesData;
  }
  console.debug('[VMU-CHART] metric=', _vmuChartMetric, 'points=', dates.length, 'series=', seriesData.length);
  if ((dates.length === 0) && rows && rows.length) {
    try {
      console.debug('[VMU-CHART] rows present but no dates. Sample row keys:', Object.keys(rows[0] || {}));
      console.debug('[VMU-CHART] sample rows[0..2]:', rows.slice(0,3));
    } catch {}
  }
  const empty = !dates || dates.length === 0;

  // Preserve current series type (line/bar) across updates (works with both custom and magicType toggles)
  let currentSeriesType = 'bar';
  try {
    const cur = vmuChart.getOption();
    if (cur && cur.series && cur.series[0] && cur.series[0].type) {
      currentSeriesType = cur.series[0].type;
    }
  } catch {}

  // Create stacked series with theme-dependent colors
  const isDark = document.body.classList.contains('theme-dark') || document.body.classList.contains('dark-mode');

  let typeColors;
  if (isDark) {
    typeColors = {
      'Cointool': '#60a5fa',    // soft blue
      'XENFT': '#f472b6',       // pastel pink
      'Stake XENFT': '#fbbf24', // warm yellow
      'Stake': '#34d399',       // mint green
      // Mobile abbreviations
      'CT': '#60a5fa',          // soft blue (same as Cointool)
      'XNFT': '#f472b6',        // pastel pink (same as XENFT)
      'S.XNFT': '#fbbf24',      // warm yellow (same as Stake XENFT)
      'Stk': '#34d399'          // mint green (same as Stake)
    };
  } else {
    // Light theme
    typeColors = {
      'Cointool': '#2563eb',    // darker blue
      'XENFT': '#dc2626',       // darker red
      'Stake XENFT': '#ea580c', // darker orange
      'Stake': '#16a34a',       // darker green
      // Mobile abbreviations
      'CT': '#2563eb',          // darker blue (same as Cointool)
      'XNFT': '#dc2626',        // darker red (same as XENFT)
      'S.XNFT': '#ea580c',      // darker orange (same as Stake XENFT)
      'Stk': '#16a34a'          // darker green (same as Stake)
    };
  }

  const series = seriesData.map(typeData => ({
    name: typeData.name,
    type: currentSeriesType,
    stack: 'total',
    data: typeData.data,
    itemStyle: { color: typeColors[typeData.name] || '#6b7280' }
  }));

  const opts = {
    title: { text: (_vmuChartMetric === 'usd' ? 'Value by Type' : 'VMUs by Type'), subtext: empty ? 'No data for current view' : '', top: -5 },
    xAxis: { data: dates, axisLabel: { formatter: function(value){ return _fmtAxisDateLabel(value); } } },
    series: series,
    yAxis: { type: 'value', name: (_vmuChartMetric === 'usd' ? 'USD' : 'VMUs'), nameGap: 12 },
    legend: {
      data: (window.innerWidth <= 768) ? ['CT', 'XNFT', 'S.XNFT', 'Stk'] : ['Cointool', 'XENFT', 'Stake XENFT', 'Stake'],
      top: 10,
      textStyle: {
        fontSize: (window.innerWidth <= 768) ? 12 : 14
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: function(params){
        try {
          var dateKey = (params && params[0] && (params[0].axisValue || params[0].name)) || '';
          var d = new Date(dateKey + 'T00:00:00');
          var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          var fmtDate = isNaN(d.getTime())
            ? dateKey
            : (weekdays[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear());

          var result = '<strong>Date: ' + fmtDate + '</strong><br/>';

          // Get detailed data for this date
          var activeRows = _collectActiveRows();
          var typeData = _getTooltipDataByDateAndType(activeRows, dateKey);

          var totalUsd = 0;
          var totalVmus = 0;
          var totalXen = 0;

          // Start table
          result += '<table style="border-collapse: collapse; width: 100%; margin-top: 8px;">';

          // Show breakdown by type with VMUs and XEN
          for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param.value > 0) {
              var seriesTypeData = typeData[param.seriesName];
              var vmus = seriesTypeData ? seriesTypeData.vmus : 0;
              var xen = seriesTypeData ? seriesTypeData.xen : 0;
              var xenShort = window.formatXenShort?.(xen) || String(xen);

              totalUsd += param.value;
              totalVmus += vmus;
              totalXen += xen;

              result += '<tr>';
              result += '<td style="padding: 2px 8px 2px 0; vertical-align: top;">' + param.marker + '<strong>' + param.seriesName + ':</strong></td>';

              if (_vmuChartMetric === 'usd') {
                // $value mode: $3,778.92, Xen: x, VMUs: y
                result += '<td style="padding: 2px 8px 2px 0; text-align: right;">' + (window.formatUSD?.(param.value) || '$' + param.value) + '</td>';
                result += '<td style="padding: 2px 8px 2px 0; text-align: right;">Xen: ' + xenShort + '</td>';
                result += '<td style="padding: 2px 0 2px 0; text-align: right;">VMUs: ' + Number(vmus).toLocaleString() + '</td>';
              } else {
                // VMU mode: VMUs: y, Xen: x, $3,778.92
                var usdValue = (typeof window.xenUsdPrice === 'number' && window.xenUsdPrice > 0) ? xen * window.xenUsdPrice : 0;
                result += '<td style="padding: 2px 8px 2px 0; text-align: right;">VMUs: ' + Number(vmus).toLocaleString() + '</td>';
                result += '<td style="padding: 2px 8px 2px 0; text-align: right;">Xen: ' + xenShort + '</td>';
                result += '<td style="padding: 2px 0 2px 0; text-align: right;">' + (window.formatUSD?.(usdValue) || '$' + usdValue) + '</td>';
              }
              result += '</tr>';
            }
          }

          // Total row with separator
          result += '<tr><td colspan="4" style="border-top: 1px solid rgba(255,255,255,0.2); padding: 4px 0 2px 0;"></td></tr>';
          result += '<tr>';
          result += '<td style="padding: 2px 8px 2px 0; vertical-align: top;"><strong>Total:</strong></td>';

          var totalXenShort = window.formatXenShort?.(totalXen) || String(totalXen);
          if (_vmuChartMetric === 'usd') {
            // $value mode: Total: $6,690.57, Xen: x, VMUs: y
            result += '<td style="padding: 2px 8px 2px 0; text-align: right;"><strong>' + (window.formatUSD?.(totalUsd) || '$' + totalUsd) + '</strong></td>';
            result += '<td style="padding: 2px 8px 2px 0; text-align: right;"><strong>Xen: ' + totalXenShort + '</strong></td>';
            result += '<td style="padding: 2px 0 2px 0; text-align: right;"><strong>VMUs: ' + Number(totalVmus).toLocaleString() + '</strong></td>';
          } else {
            // VMU mode: Total: VMUs: y, Xen: x, $6,690.57
            var totalUsdFromXen = (typeof window.xenUsdPrice === 'number' && window.xenUsdPrice > 0) ? totalXen * window.xenUsdPrice : 0;
            result += '<td style="padding: 2px 8px 2px 0; text-align: right;"><strong>VMUs: ' + Number(totalVmus).toLocaleString() + '</strong></td>';
            result += '<td style="padding: 2px 8px 2px 0; text-align: right;"><strong>Xen: ' + totalXenShort + '</strong></td>';
            result += '<td style="padding: 2px 0 2px 0; text-align: right;"><strong>' + (window.formatUSD?.(totalUsdFromXen) || '$' + totalUsdFromXen) + '</strong></td>';
          }
          result += '</tr>';
          result += '</table>';

          return result;
        } catch (e) {
          return 'Date: ' + (params && params[0] && params[0].axisValue) + '<br/>Error loading details';
        }
      }
    }
  };

  // Apply light/dark theming to chart, including metric-sensitive colors
  try {
    const textColor = isDark ? '#e5e7eb' : '#111827';
    const axisColor = isDark ? '#9aa4b2' : '#6b7280';
    const splitColor = isDark ? '#2a3341' : '#e5e7eb';

    // Subtle dark gradient background
    if (isDark && window.echarts && window.echarts.graphic) {
      const topC = '#0b1220';
      const botC = '#0a0f1a';
      opts.backgroundColor = new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: topC },
        { offset: 1, color: botC },
      ]);
    } else {
      opts.backgroundColor = isDark ? '#111827' : '#ffffff';
    }

    opts.textStyle = Object.assign({}, opts.textStyle || {}, {
      color: textColor,
      fontFamily: (opts.textStyle && opts.textStyle.fontFamily) || undefined,
    });
    opts.title.textStyle = Object.assign({}, opts.title.textStyle || {}, {
      color: textColor,
      fontFamily: (opts.title.textStyle && opts.title.textStyle.fontFamily) || undefined,
    });
    opts.legend = Object.assign({}, opts.legend || {}, {
      textStyle: {
        color: textColor,
        fontFamily: undefined
      }
    });
    opts.xAxis = Object.assign({}, opts.xAxis, {
      axisLabel: Object.assign({}, opts.xAxis.axisLabel || {}, { color: axisColor, fontFamily: undefined }),
      axisLine: { lineStyle: { color: axisColor } },
      splitLine: { show: true, lineStyle: { color: splitColor } }
    });
    opts.yAxis = Object.assign({}, opts.yAxis, {
      axisLabel: Object.assign({}, (opts.yAxis && opts.yAxis.axisLabel) || {}, { color: axisColor, fontFamily: undefined }),
      axisLine: { lineStyle: { color: axisColor } },
      splitLine: { show: true, lineStyle: { color: splitColor } }
    });

    // Tooltip styling for dark mode
    if (isDark && opts.tooltip) {
      opts.tooltip.backgroundColor = 'rgba(47, 54, 66, 0.96)';
      opts.tooltip.borderColor = '#4b5563';
      opts.tooltip.textStyle = { color: textColor };
      opts.tooltip.borderWidth = 1;
      opts.tooltip.borderRadius = 10;
      opts.tooltip.extraCssText = 'box-shadow: 0 8px 20px rgba(0,0,0,.45); padding:8px 10px;';
      opts.axisPointer = {
        lineStyle: { color: axisColor, type: 'dashed', width: 1 }
      };
    }
  } catch {}

  try {
    // Merge update to preserve series.type and axes configuration
    vmuChart.setOption(opts);
    // Ensure chart properly sizes after option update
    setTimeout(() => {
      try {
        if (vmuChart) {
          vmuChart.resize();
          console.debug('[VMU-CHART] post-update resize completed');
        }
      } catch(e) {
        console.warn('[VMU-CHART] post-update resize failed', e);
      }
    }, 50);
  } catch(e) {
    console.warn('[VMU-CHART] setOption(data) failed', e);
  }
}

// Persist and apply expanded state; init chart on expand
function setVmuChartExpandedState(open) {
  const body = document.getElementById('vmuChartBody');
  const btn  = document.getElementById('vmuChartToggle');
  const node = document.getElementById('vmuChart');
  if (!btn || !body || !node) return;
  try { localStorage.setItem('vmuChartExpanded', open ? '1' : '0'); } catch {}

  btn.setAttribute('aria-expanded', String(!!open));
  btn.textContent = open ? '- Hide Chart' : '+ Show Chart';
  body.hidden = !open;

  if (!open) return;

  console.debug('[VMU-CHART] setExpandedState -> open. node size before:', { w: node.offsetWidth, h: node.offsetHeight });

  if (!vmuChart && window.echarts && typeof window.echarts.init === 'function') {
    const dashVisible = document.getElementById('tab-dashboard')?.classList.contains('active');
    const hasSize = (node.offsetWidth > 0 && node.offsetHeight > 0);
    if (!dashVisible || !hasSize) {
      // Defer init until the chart becomes visible and has layout size
      _vmuChartInitPending = true;
      return;
    }
    if (!hasSize) {
      node.style.width = '100%';
      node.style.height = node.style.height || '260px';
    }
    try {
      vmuChart = window.echarts.init(node, null, { useDirtyRect: true });
      window.vmuChart = vmuChart;  // Store globally too
      console.debug('[VMU-CHART] echarts.init OK');
    } catch(e) {
      console.warn('[VMU-CHART] echarts.init failed', e);
    }

    const options = {
      title: { text: 'VMUs', left: 'center', top: 6, textStyle: { fontSize: 12 } },
      tooltip: { trigger: 'axis' },
      toolbox: {
        right: 10,
        itemSize: 18,  // Larger touch target for mobile
        itemGap: 10,   // More spacing between buttons
        feature: (function(){
          const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
          // Helper: set series type without losing data
          function setSeriesType(kind){
            try {
              if (vmuChart) {
                vmuChart.setOption({ series: [{ type: kind }] });
                // Ensure future updates respect the chosen type
                updateVmuChart();
              }
            } catch(e) { console.warn('[VMU-CHART] setSeriesType failed', e); }
          }
          const myFullscreen = {
            show: true,
            title: 'Toggle Fullscreen',
            icon: 'path://M2,2 L10,2 L10,10 L2,10 Z M4,4 L8,4 L8,8 L4,8 Z',
            onclick: function() {
              const el = node;
              const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

              if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                // Use current page background for fullscreen backdrop
                try { el.style.backgroundColor = getComputedStyle(document.body).backgroundColor; } catch {}

                // iOS Safari uses webkit prefix
                if (isIOS && el.webkitRequestFullscreen) {
                  el.webkitRequestFullscreen();
                } else if (el.requestFullscreen) {
                  el.requestFullscreen();
                } else if (el.webkitRequestFullscreen) {
                  el.webkitRequestFullscreen();
                } else if (el.mozRequestFullScreen) {
                  el.mozRequestFullScreen();
                } else if (el.msRequestFullscreen) {
                  el.msRequestFullscreen();
                }
              } else {
                if (document.exitFullscreen) {
                  document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                  document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                  document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                  document.msExitFullscreen();
                }
              }
              // Clean up background on exit
              const tidy = () => {
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                  try { el.style.backgroundColor = ''; } catch {}
                  try { vmuChart && vmuChart.resize(); } catch {}
                  document.removeEventListener('fullscreenchange', tidy);
                  document.removeEventListener('webkitfullscreenchange', tidy);
                }
              };
              document.addEventListener('fullscreenchange', tidy);
              document.addEventListener('webkitfullscreenchange', tidy);
              setTimeout(() => { vmuChart && vmuChart.resize(); }, 100);
            }
          };
          if (isMobile) {
            return {
              myLine:    { show: true, title: 'Line', icon: 'path://M2,12 L6,8 L10,10 L14,6', onclick: () => setSeriesType('line') },
              myBar:     { show: true, title: 'Bar',  icon: 'path://M3,12 L3,6 L5,6 L5,12 Z M7,12 L7,4 L9,4 L9,12 Z M11,12 L11,8 L13,8 L13,12 Z', onclick: () => setSeriesType('bar') },
              myFullscreen
            };
          }
          // Desktop: remove zoom buttons, keep magicType, saveAsImage, fullscreen.
          return {
            magicType: { type: ['line', 'bar'] },
            saveAsImage: {},
            myFullscreen
          };
        })()
      },
      xAxis: { type: 'category', data: [], axisLabel: { formatter: function(value){ return _fmtAxisDateLabel(value); } } },
      yAxis: { type: 'value', name: 'VMUs', nameGap: 12 },
      series: [{ type: 'bar', data: [] }]
    };
    try { vmuChart && vmuChart.setOption(options); console.debug('[VMU-CHART] setOption(base) done'); } catch(e) { console.warn('[VMU-CHART] setOption(base) failed', e); }
  } else if (!window.echarts) {
    try { node.textContent = 'Chart library failed to load.'; } catch {}
  }

  requestAnimationFrame(() => {
    try { if (vmuChart) { console.debug('[VMU-CHART] rAF update pass (setter)'); updateVmuChart(); vmuChart.resize(); } } catch(e) { console.warn('[VMU-CHART] rAF update failed (setter)', e); }
    requestAnimationFrame(() => { try { if (vmuChart) { console.debug('[VMU-CHART] rAF resize pass2 (setter)'); vmuChart.resize(); } } catch(e) { console.warn('[VMU-CHART] rAF resize2 failed (setter)', e); } });
  });
}

// ===== Export Module Functions =====
export const chartManager = {
  // Chart functions
  updateVmuChart,
  initVmuChartSection,
  setVmuChartExpandedState,

  // Utility functions
  _fmtAxisDateLabel,
  _collectActiveRows,
  _getTooltipDataByDateAndType,
  _groupVMUsByDateAndType,

  // Chart state access
  getVmuChart: () => vmuChart,
  setVmuChart: (chart) => { vmuChart = chart; window.vmuChart = chart; },
  getVmuChartMetric: () => _vmuChartMetric,
  setVmuChartMetric: (metric) => { _vmuChartMetric = metric; }
};

// ===== Global Function Exports for Backward Compatibility =====
window.updateVmuChart = updateVmuChart;
window.initVmuChartSection = initVmuChartSection;
window.setVmuChartExpandedState = setVmuChartExpandedState;
window._fmtAxisDateLabel = _fmtAxisDateLabel;
window._collectActiveRows = _collectActiveRows;
window._getTooltipDataByDateAndType = _getTooltipDataByDateAndType;
window._groupVMUsByDateAndType = _groupVMUsByDateAndType;

// Chart state globals
window._vmuChartMetric = _vmuChartMetric;
window._vmuChartReady = _vmuChartReady;
window._vmuChartInitPending = _vmuChartInitPending;

export default chartManager;