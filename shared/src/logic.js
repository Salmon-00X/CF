/* =========================================================================
 * CF Wavescan Analyzer — app logic (pure, DOM-free)
 * History model, import merging, filtering, and Plotly data builders.
 * Browser: window.CFLogic.  Node: module.exports (unit tests).
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'));
  } else {
    root.CFLogic = factory(root.CFCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  // schema 1 was a flat { 'Light Solids': {fordH,...} }; schema 2 split
  // family defaults from per-color overrides:
  //   { families: { 'Light Solids': {fordH,...} },
  //     colors:   { 'Arctic White': {fordH,...} } }
  // loadHistory() migrates an older file in place; serialize always emits v2.
  var SCHEMA = 2;

  function normalizeModel(m) {
    if (m === 'Raptor' || m === 'Ranger') return m;
    return null;
  }

  // Standards lookup keyed by orientation — same pair used by every chart
  // builder and the detail table; extracted to keep H/V matching in lockstep.
  function stdPair(std, orient) {
    if (!std) return { ford: null, min: null };
    return orient === 'H'
      ? { ford: std.fordH, min: std.minH }
      : { ford: std.fordV, min: std.minV };
  }

  // When the chart's whole point is comparing plants against each other, a
  // single-plant sidebar filter would collapse it to one series — drop the
  // plant restriction (copy, never mutate the caller's filter object).
  function filtersForPlantCompare(filters) {
    var f = {};
    for (var k in filters) if (filters.hasOwnProperty(k)) f[k] = filters[k];
    f.plant = 'All';   // legacy single-plant string
    f.plants = null;   // multi-plant set
    return f;
  }

  /* ------------------------------ history ------------------------------ */
  function defaultStandards() {
    return { families: deepCopy(C.DEFAULT_STANDARDS), colors: {} };
  }

  function newHistory() {
    return {
      app: 'cf-wavescan-analyzer',
      schema: SCHEMA,
      savedAt: null,
      standards: defaultStandards(),
      months: {}
    };
  }

  // Validate a {fordH,fordV,minH,minV} block and return a clean copy, or null.
  function cleanStd(s) {
    if (!s) return null;
    var keys = ['fordH','fordV','minH','minV'];
    for (var i = 0; i < 4; i++) {
      var k = keys[i];
      if (typeof s[k] !== 'number' || !isFinite(s[k])) return null;
    }
    return { fordH: s.fordH, fordV: s.fordV, minH: s.minH, minV: s.minV };
  }

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  /** Validate + upgrade a parsed history JSON. Returns {history, error}. */
  function loadHistory(obj) {
    if (!obj || typeof obj !== 'object') {
      return { history: null, error: 'Not a history file (invalid JSON object).' };
    }
    if (obj.app !== 'cf-wavescan-analyzer') {
      return { history: null, error: 'Not a CF Analyzer history file (missing app marker).' };
    }
    var h = newHistory();
    if (obj.standards && typeof obj.standards === 'object') {
      // Accept both v2 ({families, colors}) and v1 (flat family map) shapes.
      var src = obj.standards;
      var famSrc = src.families && typeof src.families === 'object' ? src.families : src;
      var colSrc = src.colors   && typeof src.colors   === 'object' ? src.colors   : {};
      Object.keys(h.standards.families).forEach(function (fam) {
        var c = cleanStd(famSrc[fam]);
        if (c) h.standards.families[fam] = c;
      });
      Object.keys(colSrc).forEach(function (col) {
        var c = cleanStd(colSrc[col]);
        if (c) h.standards.colors[col] = c;
      });
    }
    var months = obj.months || {};
    Object.keys(months).forEach(function (key) {
      if (!/^\d{4}-\d{2}$/.test(key)) return;
      var m = months[key];
      if (!m || !Array.isArray(m.records)) return;
      var clean = [];
      m.records.forEach(function (r) {
        if (!r || typeof r.cf !== 'number' || !isFinite(r.cf)) return;
        var col = C.normalizeColor(r.color);
        if (!col) return;
        var zone = String(r.zone || '').trim();
        if (!zone) return;
        // Trust the saved orient when present — it carried the authoritative
        // Tolerance Group value from the source export. Falling back to
        // zone-name inference here silently flipped any zone whose tolerance
        // disagreed with HOOD/ROOF detection.
        var savedOrient = (r.orient === 'H' || r.orient === 'V') ? r.orient : C.orientationOf(zone);
        clean.push({
          model: normalizeModel(r.model),
          plant: C.normalizePlant(r.plant) || null,
          color: col.color, family: col.family,
          zone: zone, orient: savedOrient, cf: r.cf,
          file: (typeof r.file === 'string' && r.file) ? r.file : null
        });
      });
      h.months[key] = {
        label: m.label || keyToLabel(key),
        files: Array.isArray(m.files) ? m.files.slice(0, 50) : [],
        records: clean
      };
    });
    return { history: h, error: null };
  }

  function keyToLabel(key) {
    var p = key.split('-');
    return C.monthLabel(Number(p[0]), Number(p[1]));
  }

  function serializeHistory(h) {
    var copy = deepCopy(h);
    copy.savedAt = new Date().toISOString();
    return JSON.stringify(copy, null, 1);
  }

  /**
   * Merge an import into history.
   * Replaces existing records for every (model, color) pair present in the
   * import (a re-upload corrects earlier data); other pairs are kept.
   * Returns { added, replacedPairs }.
   */
  function mergeImport(history, monthKey, filename, records, modelOverride, detectedModel, detectedPlant) {
    // File-level fallbacks: a file may carry no model/plant column even when the
    // model/plant was detected from the file or sheet name. Without these the
    // records store null and vanish under a filter (the "graphs disappear" bug).
    var fileModel = (detectedModel === 'Ranger' || detectedModel === 'Raptor')
      ? detectedModel : null;
    var filePlant = (C.PLANTS.indexOf(detectedPlant) !== -1) ? detectedPlant : null;
    var recs = records.map(function (r) {
      var m = modelOverride && modelOverride !== 'auto'
        ? modelOverride
        : (r.model || fileModel);
      return {
        model: normalizeModel(m),
        plant: r.plant || filePlant || null,
        color: r.color, family: r.family, zone: r.zone, orient: r.orient, cf: r.cf,
        file: filename || null
      };
    });
    if (!history.months[monthKey]) {
      history.months[monthKey] = { label: keyToLabel(monthKey), files: [], records: [] };
    }
    var month = history.months[monthKey];
    var before = month.records.length;
    // A re-upload of the SAME file replaces only that file's rows; every other
    // previously uploaded file in this month is retained.
    if (filename) {
      month.records = month.records.filter(function (r) { return r.file !== filename; });
    }
    var replaced = before - month.records.length;
    month.records = month.records.concat(recs);
    if (filename && month.files.indexOf(filename) === -1) month.files.push(filename);
    return { added: recs.length, replacedPairs: replaced };
  }

  function sortedMonthKeys(history) {
    return Object.keys(history.months).sort(); // ISO keys sort chronologically
  }

  /* ------------------------------ filtering ----------------------------- */
  /** filters = { model, plant, plants, file, colors }. Unknown (null) model/plant
   *  match every filter so such rows are labelled rather than vanishing.
   *  `plant` (string) is single-plant legacy; `plants` (set: {FTM:true,...}) is
   *  the new multi-select. Both are honoured; a row passes when it satisfies
   *  whichever filter is present. Empty/null set = no restriction. */
  function filterRecords(records, filters) {
    var plants = filters.plants;
    var anyPlant = plants && Object.keys(plants).some(function (k) { return plants[k]; });
    return records.filter(function (r) {
      if (filters.model && filters.model !== 'Both' &&
          r.model && r.model !== filters.model) return false;
      if (filters.plant && filters.plant !== 'All' &&
          r.plant && r.plant !== filters.plant) return false;
      if (anyPlant && r.plant && !plants[r.plant]) return false;
      if (filters.file && r.file !== filters.file) return false;
      if (filters.colors && !filters.colors[r.color]) return false;
      return true;
    });
  }

  /**
   * Pool filtered records across a list of month keys (the "period" feature).
   * Every analysis card — andon ribbon, problem digest, charts, detail — runs
   * against the pooled list so a single user picks "April + May" once and
   * every view follows.
   */
  function periodRecords(history, periodKeys, filters) {
    var out = [];
    (periodKeys || []).forEach(function (k) {
      var mo = history.months[k];
      if (mo) out = out.concat(filterRecords(mo.records, filters));
    });
    return out;
  }

  function colorsIn(records) {
    var seen = {}, list = [];
    records.forEach(function (r) {
      if (!seen[r.color]) { seen[r.color] = true; list.push(r.color); }
    });
    return list.sort();
  }

  function plantsIn(records) {
    var seen = {}, list = [];
    records.forEach(function (r) {
      if (r.plant && !seen[r.plant]) { seen[r.plant] = true; list.push(r.plant); }
    });
    return list.sort();
  }

  /** Every uploaded file across history: [{name, monthKey, monthLabel}]. */
  function filesIn(history) {
    var out = [], seen = {};
    sortedMonthKeys(history).forEach(function (k) {
      (history.months[k].files || []).forEach(function (name) {
        var id = k + '|' + name;
        if (!seen[id]) { seen[id] = true; out.push({ name: name, monthKey: k, monthLabel: keyToLabel(k) }); }
      });
    });
    return out;
  }

  /* ------------------------- summary (andon) data ----------------------- */
  function summarize(records, standards) {
    var a = C.analyze(records, standards);
    var sum = { PASS: [], WARNING: [], FAIL: [], NA: [] };
    a.groups.forEach(function (g) {
      (sum[g.status || 'NA']).push(g);
    });
    var sev = { FAIL: 0, WARNING: 1, PASS: 2, NA: 3 };
    ['FAIL', 'WARNING', 'PASS'].forEach(function (k) {
      sum[k].sort(function (x, y) {
        return (x.color + x.orient).localeCompare(y.color + y.orient);
      });
    });
    return { groups: a.groups, byStatus: sum, severity: sev };
  }

  /**
   * Worst-offender digest: every checkzone whose own reading misses the
   * target, FAIL before WARNING, then deepest deficit below the minimum
   * first — the plant's "what do I fix first" list.
   */
  function problemZones(records, standards, limit) {
    var bad = C.zoneStatuses(records, standards).filter(function (z) {
      return z.status === 'FAIL' || z.status === 'WARNING';
    });
    bad.sort(function (a, b) {
      var sa = a.status === 'FAIL' ? 0 : 1, sb = b.status === 'FAIL' ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return (a.devMin - b.devMin) || a.zone.localeCompare(b.zone);
    });
    return { list: limit ? bad.slice(0, limit) : bad, total: bad.length };
  }

  /**
   * Zone-level rollup per (model, color, orient): how many checkzones of the
   * group pass/warn/fail on their own reading. Complements the group-average
   * status — an average can PASS while individual zones are failing.
   */
  function zoneCounts(records, standards) {
    var map = {};
    C.zoneStatuses(records, standards).forEach(function (z) {
      var k = [z.model || '?', z.color, z.orient].join('|');
      var e = map[k] || (map[k] = { total: 0, pass: 0, warn: 0, fail: 0 });
      e.total++;
      if (z.status === 'FAIL') e.fail++;
      else if (z.status === 'WARNING') e.warn++;
      else if (z.status === 'PASS') e.pass++;
    });
    return map;
  }

  /**
   * Month-over-month deltas for the andon ribbon: average CF of the previous
   * month (same filters) keyed by model|color|orient. The ribbon draws
   * an up/down flag from current avg minus this.
   */
  function momDeltas(history, monthKey, filters, standards) {
    var keys = sortedMonthKeys(history);
    var i = keys.indexOf(monthKey);
    if (i <= 0) return { prevKey: null, prevLabel: null, map: {} };
    var prevKey = keys[i - 1];
    var prev = C.analyze(
      filterRecords(history.months[prevKey].records, filters), standards);
    var map = {};
    prev.groups.forEach(function (g) {
      map[[g.model || '?', g.color, g.orient].join('|')] = g.avg;
    });
    return { prevKey: prevKey, prevLabel: keyToLabel(prevKey), map: map };
  }

  /* ------------------------- Plotly data builders ----------------------- */
  var STATUS_COLOR = { PASS: '#0e9f6e', WARNING: '#d97706', FAIL: '#dc2626' };

  /**
   * Box plot for one orientation of one month.
   * Returns { traces, layout } or null when no data.
   */
  /* ---- Minitab-style box rendering -------------------------------------
   * Deterministic numeric x positions (no category-group offset guessing):
   * category i, series t of n  ->  x = i + (t-(n-1)/2)*step.  This lets the
   * rotated mean labels sit exactly beside their own box, like the plant's
   * Minitab reports.  Outliers are asterisks; axes are framed; red dashed =
   * Ford target, green dashed = minimum (the plant's legend convention). */
  var MT = {
    series: ['#1F4E79', '#C55A11', '#538135', '#7030A0', '#2E9BA6', '#A02B58', '#7F6000', '#3B3838'],
    model: { Ranger: '#2E74B5', Raptor: '#C55A11', '?': '#7f7f7f' },
    frame: '#7f7f7f', grid: '#e3e3e3', label: '#595959'
  };
  function posEngine(n) {
    if (n <= 1) return { step: 0, boxW: 0.32, off: function () { return 0; } };
    var W = 0.8, step = W / n;
    return {
      step: step,
      boxW: step * 0.72,
      off: function (t) { return (t - (n - 1) / 2) * step; }
    };
  }
  function r1(x) { return Math.round(x * 10) / 10; }
  function meanOf(a) {
    var s = 0; for (var i = 0; i < a.length; i++) s += a[i];
    return a.length ? s / a.length : null;
  }
  function mtAxes(colors, yLo, yHi) {
    return {
      xaxis: {
        tickvals: colors.map(function (_, i) { return i; }),
        ticktext: colors,
        range: [-0.6, colors.length - 0.4],
        tickangle: colors.length > 5 ? -28 : 0,
        showline: true, mirror: true, linecolor: MT.frame, linewidth: 1,
        ticks: 'outside', tickcolor: MT.frame, showgrid: false,
        tickfont: { size: 11.5 }, automargin: true
      },
      yaxis: {
        title: { text: 'CF', font: { size: 12.5 } },
        range: [yLo, yHi], dtick: (yHi - yLo) > 32 ? 10 : 5, zeroline: false,
        showline: true, mirror: true, linecolor: MT.frame, linewidth: 1,
        ticks: 'outside', tickcolor: MT.frame, gridcolor: MT.grid
      }
    };
  }
  function mtBoxTrace(name, xs, ys, color, boxW) {
    return {
      type: 'box', name: name, x: xs, y: ys, width: boxW,
      boxpoints: 'outliers', boxmean: true,
      hoverinfo: 'skip',                 // hover handled by the layer below
      marker: { symbol: 'asterisk', size: 7, color: color,
                line: { width: 1.2, color: color } },
      line: { color: color, width: 1.5 },
      fillcolor: hexA(color, 0.45)
    };
  }
  // Evenly spaced y-values across [lo,hi] (at least 2), so a transparent hover
  // point sits near wherever the cursor lands on the box.
  function spreadY(lo, hi, n) {
    if (hi <= lo) return [lo];
    var out = [], i;
    for (i = 0; i < n; i++) out.push(lo + (hi - lo) * (i / (n - 1)));
    return out;
  }
  // Invisible scatter that owns the concise Min/Avg/Max tooltip.
  // customdata = [color, modelLabel, min, avg, max].
  function hoverLayer(xs, ys, cd) {
    return {
      type: 'scatter', mode: 'markers', x: xs, y: ys, customdata: cd,
      showlegend: false,
      marker: { size: 16, color: 'rgba(0,0,0,0)', line: { width: 0 } },
      hovertemplate:
        '<b>%{customdata[0]}</b> · %{customdata[1]}<br>' +
        'Min %{customdata[2]} · Avg %{customdata[3]} · Max %{customdata[4]}' +
        '<extra></extra>'
    };
  }
  function meanLabel(x, y, text, color) {           // rotated (trend chart)
    return { x: x, y: y, xref: 'x', yref: 'y', text: text,
             textangle: -90, showarrow: false,
             xanchor: 'center', yanchor: 'middle',
             font: { size: 10, color: color } };
  }
  function meanLabelH(x, y, text, color) {          // horizontal (monthly chart)
    return { x: x, y: y, xref: 'x', yref: 'y', text: text,
             showarrow: false, xanchor: 'left', yanchor: 'middle',
             font: { size: 10.5, color: color } };
  }
  function yBounds(allY, refLines) {
    var lo = Math.min.apply(null, allY.concat(refLines));
    var hi = Math.max.apply(null, allY.concat(refLines));
    return [Math.floor(lo / 5) * 5 - 3, Math.ceil(hi / 5) * 5 + 4];
  }

  function buildOrientPlot(records, standards, orient, opts) {
    opts = opts || {};
    var recs = records.filter(function (r) { return r.orient === orient; });
    if (!recs.length) return null;

    var colors = colorsIn(recs);
    var models = [];
    recs.forEach(function (r) {
      var m = r.model || '?';
      if (models.indexOf(m) === -1) models.push(m);
    });
    models.sort();

    var pe = posEngine(models.length);
    var refLines = [], annotations = [], traces = [];
    var hoverX = [], hoverY = [], hoverCd = [];   // transparent min/max/avg layer

    models.forEach(function (m, t) {
      var rs = recs.filter(function (r) { return (r.model || '?') === m; });
      var xs = [], ys = [];
      rs.forEach(function (r) {
        xs.push(colors.indexOf(r.color) + pe.off(t));
        ys.push(r.cf);
      });
      // Minitab look: single series is always steel blue with navy border;
      // model colors only matter when two series must be distinguished.
      var lineCol = models.length === 1
        ? '#1F4E79'
        : (MT.model[m] || MT.series[t % MT.series.length]);
      // Box carries no per-point hover (that was the over-busy tooltip); the
      // box shape, mean marker and outliers stay visible, hover is handled by
      // the transparent min/max/avg layer below.
      var tr = mtBoxTrace(C.modelLabel(m === '?' ? null : m), xs, ys, lineCol, pe.boxW);
      if (models.length === 1) tr.fillcolor = hexA('#5B9BD5', 0.55);
      traces.push(tr);

      // One concise hover entry per (model,color) box: Min · Avg · Max.
      colors.forEach(function (col, i) {
        var vals = rs.filter(function (r) { return r.color === col; })
                     .map(function (r) { return r.cf; });
        if (!vals.length) return;
        var cx = i + pe.off(t);
        var lo = Math.min.apply(null, vals), hi2 = Math.max.apply(null, vals);
        var av = meanOf(vals);   // full precision; formatted only for display
        var label = C.modelLabel(m === '?' ? null : m);
        spreadY(lo, hi2, 9).forEach(function (yy) {
          hoverX.push(cx); hoverY.push(yy);
          hoverCd.push([col, label, C.fmtCF(lo), C.fmtCF(av), C.fmtCF(hi2)]);
        });
      });

      // Printed mean label beside each box — matches the plant's per-model
      // Minitab pages. Only drawn for a single-model view; in the Both overlay
      // two series share each category slot and printing every mean collides
      // (the cluttered look in the combined chart), so there we rely on the
      // box mean marker + hover and keep the comparison clean.
      if (models.length === 1) {
        colors.forEach(function (col, i) {
          var vals = rs.filter(function (r) { return r.color === col; })
                       .map(function (r) { return r.cf; });
          if (!vals.length) return;
          var mn = meanOf(vals);   // full precision for status + label
          var pair = stdPair(C.targetsFor(familyOf(rs, col), standards, col), orient);
          var status = pair.ford !== null ? C.statusOf(mn, pair.ford, pair.min) : null;
          annotations.push(meanLabelH(
            i + pe.off(t) + pe.boxW / 2 + 0.04,
            mn, C.fmtCF(mn), STATUS_COLOR[status] || MT.label));
        });
      }
    });

    // Stepped dashed limits per color (red = Ford target, green = minimum)
    var shapes = [];
    colors.forEach(function (col, i) {
      var pair = stdPair(C.targetsFor(familyOf(recs, col), standards, col), orient);
      if (pair.ford === null) return;
      refLines.push(pair.ford, pair.min);
      shapes.push(seg(i, pair.ford, '#dc2626'));
      shapes.push(seg(i, pair.min, '#0e9f6e'));
    });
    traces.push(lineProxy('Average Target', '#dc2626'));
    traces.push(lineProxy('Min. Requirement', '#0e9f6e'));
    // Transparent hover layer: shows only Color · Model · Min/Avg/Max.
    traces.push(hoverLayer(hoverX, hoverY, hoverCd));

    var yb = yBounds(recs.map(function (r) { return r.cf; }), refLines);
    var ax = mtAxes(colors, yb[0], yb[1]);
    var layout = {
      margin: { l: 54, r: 14, t: 10, b: 86 },
      xaxis: ax.xaxis,
      yaxis: ax.yaxis,
      shapes: shapes,
      annotations: annotations,
      showlegend: true,
      legend: { orientation: 'h', y: -0.26, x: 0, font: { size: 11 } },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: '#ffffff',
      hovermode: 'closest',
      font: { family: 'inherit', color: '#1d2840' },
      hoverlabel: { bgcolor: '#102a6b', font: { color: '#ffffff', size: 12 } }
    };
    return { traces: traces, layout: layout, colors: colors, kind: 'box' };
  }

  /**
   * Trend / compare chart. opts = { chartKind:'box'|'bar', seriesBy:'month'|'plant' }.
   * - seriesBy 'month' (default): one series per selected month (+ optional YTD).
   * - seriesBy 'plant': one series per plant, pooled over the selected months —
   *   lets plants (FTM/AAT/FVL/SAP) be compared against each other.
   * Both modes draw the red Average-Target and green Min-Requirement lines.
   */
  function buildTrendPlot(history, filters, orient, monthsSel, ytdYear, standards, opts) {
    opts = opts || {};
    var chartKind = opts.chartKind === 'bar' ? 'bar' : 'box';
    var seriesBy = opts.seriesBy === 'plant' ? 'plant' : 'month';
    var series = [];   // [{label, recs}]

    if (seriesBy === 'plant') {
      filters = filtersForPlantCompare(filters);
      var pool = [];
      monthsSel.forEach(function (m) {
        var mo = history.months[m.key];
        if (mo) pool = pool.concat(filterRecords(mo.records, filters));
      });
      pool = pool.filter(function (r) { return r.orient === orient; });
      var byP = {};
      pool.forEach(function (r) {
        var p = r.plant || 'Unspecified';
        (byP[p] = byP[p] || []).push(r);
      });
      Object.keys(byP).sort().forEach(function (p) { series.push({ label: p, recs: byP[p] }); });
    } else {
      monthsSel.forEach(function (m) {
        var month = history.months[m.key];
        if (month) {
          var rs = filterRecords(month.records, filters).filter(function (r) { return r.orient === orient; });
          if (rs.length) series.push({ label: m.label, recs: rs });
        }
      });
      if (ytdYear) {
        var ypool = [];
        sortedMonthKeys(history).forEach(function (k) {
          if (k.indexOf(String(ytdYear) + '-') === 0) {
            ypool = ypool.concat(filterRecords(history.months[k].records, filters));
          }
        });
        ypool = ypool.filter(function (r) { return r.orient === orient; });
        if (ypool.length) series.push({ label: 'YTD ' + ytdYear, recs: ypool });
      }
    }
    if (!series.length) return null;

    var colorSet = {};
    series.forEach(function (s) { s.recs.forEach(function (r) { colorSet[r.color] = true; }); });
    var colors = Object.keys(colorSet).sort();

    var traces = [], annotations = [], refLines = [], allY = [];
    var shapes = [];
    colors.forEach(function (col, i) {
      var fam = (C.normalizeColor(col) || {}).family || C.COLOR_FAMILY[col.toLowerCase()];
      var pair = stdPair(C.targetsFor(fam, standards, col), orient);
      if (pair.ford === null) return;
      refLines.push(pair.ford, pair.min);
      shapes.push(seg(i, pair.ford, '#dc2626'));
      shapes.push(seg(i, pair.min, '#0e9f6e'));
    });

    if (chartKind === 'bar') {
      // Grouped bars: average CF per color per series, with the dashed standard
      // target lines drawn over them.
      series.forEach(function (s, t) {
        var ys = [], cd = [];
        colors.forEach(function (c) {
          var v = s.recs.filter(function (r) { return r.color === c; }).map(function (r) { return r.cf; });
          var mn = v.length ? meanOf(v) : null;
          ys.push(mn); cd.push(mn === null ? '' : C.fmtCF(mn));
          if (mn !== null) allY.push(mn);
        });
        var col = MT.series[t % MT.series.length];
        traces.push({
          type: 'bar', name: s.label, x: colors, y: ys, customdata: cd,
          marker: { color: hexA(col, 0.85), line: { color: col, width: 1 } },
          hovertemplate: '<b>%{x}</b> · ' + s.label + '<br>Avg %{customdata}<extra></extra>'
        });
      });
      traces.push(lineProxy('Average Target', '#dc2626'));
      traces.push(lineProxy('Min. Requirement', '#0e9f6e'));
      var ybB = yBounds(allY, refLines.length ? refLines : allY);
      var layoutB = {
        margin: { l: 54, r: 14, t: 10, b: 92 },
        barmode: 'group', bargap: 0.25, bargroupgap: 0.08,
        xaxis: { type: 'category', tickangle: colors.length > 4 ? -28 : 0,
          showline: true, mirror: true, linecolor: MT.frame, linewidth: 1,
          ticks: 'outside', tickcolor: MT.frame, tickfont: { size: 11.5 }, automargin: true },
        yaxis: { range: [ybB[0], ybB[1]], showline: true, mirror: true,
          linecolor: MT.frame, gridcolor: MT.grid, zeroline: false, title: { text: 'CF', font: { size: 12 } } },
        shapes: shapes, showlegend: true,
        legend: { orientation: 'h', y: -0.28, x: 0, font: { size: 11 } },
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#ffffff', hovermode: 'closest',
        font: { family: 'inherit', color: '#1d2840' },
        hoverlabel: { bgcolor: '#102a6b', font: { color: '#ffffff', size: 12 } }
      };
      return { traces: traces, layout: layoutB, colors: colors, kind: 'trendbar' };
    }

    // box mode
    var pe = posEngine(series.length);
    var hoverX = [], hoverY = [], hoverCd = [];
    series.forEach(function (s, t) {
      var xs = [], ys = [];
      s.recs.forEach(function (r) {
        xs.push(colors.indexOf(r.color) + pe.off(t));
        ys.push(r.cf); allY.push(r.cf);
      });
      var col = MT.series[t % MT.series.length];
      traces.push(mtBoxTrace(s.label, xs, ys, col, pe.boxW));
      colors.forEach(function (c, i) {
        var vals = s.recs.filter(function (r) { return r.color === c; }).map(function (r) { return r.cf; });
        if (!vals.length) return;
        var mn = meanOf(vals);
        var gap = pe.step ? (pe.step - pe.boxW) : 0.3;
        annotations.push(meanLabel(
          i + pe.off(t) + pe.boxW / 2 + Math.max(gap * 0.45, 0.07), mn, C.fmtCF(mn), MT.label));
        var cx = i + pe.off(t);
        var lo = Math.min.apply(null, vals), hi2 = Math.max.apply(null, vals);
        spreadY(lo, hi2, 9).forEach(function (yy) {
          hoverX.push(cx); hoverY.push(yy);
          hoverCd.push([c, s.label, C.fmtCF(lo), C.fmtCF(mn), C.fmtCF(hi2)]);
        });
      });
    });
    traces.push(lineProxy('Average Target', '#dc2626'));
    traces.push(lineProxy('Min. Requirement', '#0e9f6e'));
    traces.push(hoverLayer(hoverX, hoverY, hoverCd));

    var yb = yBounds(allY, refLines.length ? refLines : allY);
    var ax = mtAxes(colors, yb[0], yb[1]);
    var layout = {
      margin: { l: 54, r: 14, t: 10, b: 92 },
      xaxis: ax.xaxis, yaxis: ax.yaxis, shapes: shapes, annotations: annotations,
      showlegend: true, legend: { orientation: 'h', y: -0.28, x: 0, font: { size: 11 } },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#ffffff', hovermode: 'closest',
      font: { family: 'inherit', color: '#1d2840' },
      hoverlabel: { bgcolor: '#102a6b', font: { color: '#ffffff', size: 12 } }
    };
    return { traces: traces, layout: layout, colors: colors, kind: 'trend' };
  }

  /**
   * Point-by-point checkzone comparison for one color: grouped bars of CF per
   * checkzone across the selected months (or plants), with each zone's own
   * Ford (red) and Min (green) target segment drawn over it.
   */
  /**
   * Interval (Ranking) plot — descending mean CF per colour for one
   * orientation, with the H/V Ford and Min reference lines drawn flat across
   * the chart. Matches the "Interval plot of CF by Color" panel in the
   * PowerBI dashboard: a single look ranks colours from best to worst.
   */
  function buildIntervalPlot(records, standards, orient) {
    var recs = records.filter(function (r) { return r.orient === orient; });
    if (!recs.length) return null;

    var byCol = {};
    recs.forEach(function (r) {
      (byCol[r.color] = byCol[r.color] || []).push(r);
    });
    var rows = Object.keys(byCol).map(function (col) {
      var cf = byCol[col].map(function (r) { return r.cf; });
      var fam = byCol[col][0].family;
      var pair = stdPair(C.targetsFor(fam, standards, col), orient);
      return {
        color: col, family: fam,
        mean: meanOf(cf), n: cf.length,
        ford: pair.ford, min: pair.min,
        status: pair.ford !== null ? C.statusOf(meanOf(cf), pair.ford, pair.min) : null
      };
    }).sort(function (a, b) { return b.mean - a.mean; });

    var xs = rows.map(function (r) { return r.color; });
    var ys = rows.map(function (r) { return r.mean; });
    var markerColors = rows.map(function (r) {
      return STATUS_COLOR[r.status] || '#1F4E79';
    });
    var cdRows = rows.map(function (r) {
      return [C.fmtCF(r.mean), r.family, r.n, r.ford === null ? '—' : r.ford,
              r.min === null ? '—' : r.min, r.status || 'No standard'];
    });

    var trace = {
      type: 'scatter', mode: 'lines+markers+text', name: 'Mean CF',
      x: xs, y: ys, text: ys.map(function (v) { return C.fmtCF(v); }),
      textposition: 'top center', textfont: { size: 10, color: MT.label },
      line: { color: '#1F4E79', width: 1.6, shape: 'spline', smoothing: 0.6 },
      marker: { color: markerColors, size: 9, line: { color: '#1F4E79', width: 1.2 } },
      customdata: cdRows,
      hovertemplate:
        '<b>%{x}</b><br>Mean %{customdata[0]} · n=%{customdata[2]}' +
        '<br>%{customdata[1]} · Ford %{customdata[3]} · Min %{customdata[4]}' +
        '<br>Status: %{customdata[5]}<extra></extra>'
    };

    // Reference lines: use the most common family among the colours so the
    // dashed targets are visually meaningful. Colours with their own override
    // are already encoded in the marker colour via status.
    var famCounts = {};
    rows.forEach(function (r) { famCounts[r.family] = (famCounts[r.family] || 0) + 1; });
    var dominantFam = Object.keys(famCounts).sort(function (a, b) {
      return famCounts[b] - famCounts[a];
    })[0];
    var domPair = stdPair(C.targetsFor(dominantFam, standards), orient);
    var refLines = [], shapes = [];
    if (domPair.ford !== null) {
      refLines.push(domPair.ford, domPair.min);
      [['Average Target', domPair.ford, '#dc2626'],
       ['Min. Requirement', domPair.min, '#0e9f6e']].forEach(function (l) {
        shapes.push({ type: 'line', xref: 'paper', yref: 'y',
          x0: 0, x1: 1, y0: l[1], y1: l[1],
          line: { color: l[2], width: 1.6, dash: 'dash' } });
      });
    }

    var traces = [trace,
      lineProxy('Average Target (most common family)', '#dc2626'),
      lineProxy('Min. Requirement (most common family)', '#0e9f6e')];

    var yb = yBounds(ys, refLines.length ? refLines : ys);
    var layout = {
      margin: { l: 54, r: 14, t: 18, b: 96 },
      xaxis: {
        type: 'category', tickangle: xs.length > 4 ? -28 : 0,
        showline: true, mirror: true, linecolor: MT.frame, linewidth: 1,
        ticks: 'outside', tickcolor: MT.frame, tickfont: { size: 11.5 }, automargin: true
      },
      yaxis: {
        title: { text: 'Mean CF', font: { size: 12.5 } },
        range: [yb[0], yb[1]], showline: true, mirror: true,
        linecolor: MT.frame, gridcolor: MT.grid, zeroline: false
      },
      shapes: shapes, showlegend: true,
      legend: { orientation: 'h', y: -0.28, x: 0, font: { size: 11 } },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#ffffff',
      font: { family: 'inherit', color: '#1d2840' }, hovermode: 'closest',
      hoverlabel: { bgcolor: '#102a6b', font: { color: '#ffffff', size: 12 } },
      transition: { duration: 380, easing: 'cubic-in-out' }
    };
    return { traces: traces, layout: layout, colors: xs, kind: 'interval' };
  }

  function buildZoneCompare(history, filters, color, monthsSel, standards, opts) {
    opts = opts || {};
    var seriesBy = opts.seriesBy === 'plant' ? 'plant' : 'month';
    var zonesPick = opts.zones || null;  // {zone:true} multiselect from UI; null = all
    var hasPick = zonesPick && Object.keys(zonesPick).some(function (k) { return zonesPick[k]; });
    var series = [];
    function only(recs) {
      return recs.filter(function (r) {
        if (r.color !== color) return false;
        if (hasPick && !zonesPick[r.zone]) return false;
        return true;
      });
    }

    if (seriesBy === 'plant') {
      filters = filtersForPlantCompare(filters);
      var pool = [];
      monthsSel.forEach(function (m) {
        var mo = history.months[m.key];
        if (mo) pool = pool.concat(filterRecords(mo.records, filters));
      });
      pool = only(pool);
      var byP = {};
      pool.forEach(function (r) { var p = r.plant || 'Unspecified'; (byP[p] = byP[p] || []).push(r); });
      Object.keys(byP).sort().forEach(function (p) { series.push({ label: p, recs: byP[p] }); });
    } else {
      monthsSel.forEach(function (m) {
        var mo = history.months[m.key];
        if (mo) { var rs = only(filterRecords(mo.records, filters)); if (rs.length) series.push({ label: m.label, recs: rs }); }
      });
    }
    if (!series.length) return null;

    var zoneSet = {};
    series.forEach(function (s) { s.recs.forEach(function (r) { zoneSet[r.zone] = true; }); });
    var zones = Object.keys(zoneSet).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true });
    });
    if (!zones.length) return null;

    var traces = [], shapes = [], allY = [];
    zones.forEach(function (z, i) {
      var rec = null;
      for (var si = 0; si < series.length && !rec; si++) {
        rec = series[si].recs.filter(function (r) { return r.zone === z; })[0] || null;
      }
      if (!rec) return;
      var pair = stdPair(C.targetsFor(rec.family, standards, rec.color), rec.orient);
      if (pair.ford === null) return;
      allY.push(pair.ford, pair.min);
      shapes.push(seg(i, pair.ford, '#dc2626'));
      shapes.push(seg(i, pair.min, '#0e9f6e'));
    });

    series.forEach(function (s, t) {
      var ys = [], cd = [];
      zones.forEach(function (z) {
        var v = s.recs.filter(function (r) { return r.zone === z; }).map(function (r) { return r.cf; });
        var mn = v.length ? meanOf(v) : null;
        ys.push(mn); cd.push(mn === null ? '' : C.fmtCF(mn));
        if (mn !== null) allY.push(mn);
      });
      var col = MT.series[t % MT.series.length];
      traces.push({
        type: 'bar', name: s.label, x: zones, y: ys, customdata: cd,
        marker: { color: hexA(col, 0.85), line: { color: col, width: 1 } },
        hovertemplate: '<b>%{x}</b> · ' + s.label + '<br>CF %{customdata}<extra></extra>'
      });
    });
    traces.push(lineProxy('Average Target', '#dc2626'));
    traces.push(lineProxy('Min. Requirement', '#0e9f6e'));

    var yb = yBounds(allY, allY);
    var layout = {
      margin: { l: 50, r: 14, t: 10, b: 104 },
      barmode: 'group', bargap: 0.25, bargroupgap: 0.08,
      xaxis: { type: 'category', tickangle: -32, showline: true, mirror: true,
        linecolor: MT.frame, linewidth: 1, ticks: 'outside', tickcolor: MT.frame,
        tickfont: { size: 10.5 }, automargin: true },
      yaxis: { range: [yb[0], yb[1]], showline: true, mirror: true, linecolor: MT.frame,
        gridcolor: MT.grid, zeroline: false, title: { text: 'CF', font: { size: 12 } } },
      shapes: shapes, showlegend: true,
      legend: { orientation: 'h', y: -0.34, x: 0, font: { size: 11 } },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#ffffff', hovermode: 'closest',
      font: { family: 'inherit', color: '#1d2840' },
      hoverlabel: { bgcolor: '#102a6b', font: { color: '#ffffff', size: 12 } }
    };
    return { traces: traces, layout: layout, colors: zones, kind: 'zonecompare' };
  }

  /**
   * Pareto of out-of-spec checkzones by color (Minitab-style): descending bars
   * of "checkzones below the Ford average target" plus a cumulative-% line on a
   * secondary axis. Directly answers the plant's headline question — which
   * colors most often miss the average target. records are already filtered.
   */
  function buildParetoPlot(records, standards, orient) {
    var recs = records.filter(function (r) { return r.orient === orient; });
    if (!recs.length) return null;

    var byColor = {};
    recs.forEach(function (r) {
      var pair = stdPair(C.targetsFor(r.family, standards, r.color), orient);
      if (pair.ford === null) return;
      if (!byColor[r.color]) byColor[r.color] = { color: r.color, below: 0, total: 0 };
      byColor[r.color].total++;
      var st = C.statusOf(r.cf, pair.ford, pair.min);
      if (st && st !== 'PASS') byColor[r.color].below++;   // Warning or Fail
    });

    // Show EVERY color (sorted worst-first), not only the off-target ones, so
    // the whole field is comparable at a glance. Colors with zero off-target
    // zones appear as empty bars. The cumulative-% line is drawn only when at
    // least one color is below target (otherwise there is nothing to accumulate).
    var arr = Object.keys(byColor).map(function (k) { return byColor[k]; })
      .sort(function (a, b) { return b.below - a.below || a.color.localeCompare(b.color); });

    var baseLayout = {
      margin: { l: 50, r: 54, t: 10, b: 96 },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#ffffff',
      font: { family: 'inherit', color: '#1d2840' },
      hovermode: 'closest',
      hoverlabel: { bgcolor: '#102a6b', font: { color: '#ffffff', size: 12 } }
    };

    if (!arr.length) {
      // No standards/records to grade for this orientation.
      return {
        traces: [], colors: [], kind: 'pareto',
        layout: Object.assign({}, baseLayout, {
          xaxis: { visible: false }, yaxis: { visible: false },
          annotations: [{
            text: 'No gradable readings for this selection', x: 0.5, y: 0.5,
            xref: 'paper', yref: 'paper', showarrow: false,
            font: { size: 14, color: '#5b6880' }
          }]
        })
      };
    }

    var cats = arr.map(function (e) { return e.color; });
    var counts = arr.map(function (e) { return e.below; });
    var total = counts.reduce(function (s, c) { return s + c; }, 0);
    var maxC = Math.max.apply(null, counts);

    // Bar colour leans red for colors that have off-target zones, muted blue
    // for the clean ones — so the problem colors still stand out even with the
    // whole set on screen.
    var barColors = arr.map(function (e) {
      return e.below > 0 ? hexA('#dc2626', 0.82) : hexA('#1F4E79', 0.30);
    });
    var barLines = arr.map(function (e) {
      return e.below > 0 ? '#dc2626' : '#1F4E79';
    });

    var bar = {
      type: 'bar', x: cats, y: counts, name: 'Below target', yaxis: 'y',
      marker: { color: barColors, line: { color: barLines, width: 1 } },
      customdata: arr.map(function (e) { return [e.total]; }),
      hovertemplate: '<b>%{x}</b><br>%{y} of %{customdata[0]} zones below target<extra></extra>'
    };

    var traces = [bar];
    var layout = Object.assign({}, baseLayout, {
      xaxis: {
        tickangle: cats.length > 4 ? -28 : 0,
        showline: true, mirror: true, linecolor: MT.frame, linewidth: 1,
        ticks: 'outside', tickcolor: MT.frame, tickfont: { size: 11.5 }, automargin: true
      },
      yaxis: {
        title: { text: 'Checkzones below target', font: { size: 12 } },
        rangemode: 'tozero', dtick: maxC <= 6 ? 1 : Math.ceil(maxC / 6),
        showline: true, mirror: true, linecolor: MT.frame, gridcolor: MT.grid, zeroline: false
      },
      showlegend: true, legend: { orientation: 'h', y: -0.3, x: 0, font: { size: 11 } }
    });

    if (total > 0) {
      var cum = [], run = 0;
      counts.forEach(function (c) { run += c; cum.push(r1(run / total * 100)); });
      traces.push({
        type: 'scatter', mode: 'lines+markers', x: cats, y: cum,
        name: 'Cumulative %', yaxis: 'y2',
        line: { color: '#102a6b', width: 2 }, marker: { color: '#102a6b', size: 6 },
        hovertemplate: 'Cumulative %{y:.0f}%<extra></extra>'
      });
      layout.yaxis2 = {
        title: { text: 'Cumulative %', font: { size: 12 } },
        overlaying: 'y', side: 'right', range: [0, 105], ticksuffix: '%',
        showgrid: false, zeroline: false
      };
    } else {
      // Every color passes — keep all bars on screen but flag the good news.
      layout.annotations = [{
        text: 'All colors meet the average target', x: 0.5, y: 0.92,
        xref: 'paper', yref: 'paper', showarrow: false,
        font: { size: 13, color: '#0e9f6e' }
      }];
    }
    return { traces: traces, layout: layout, colors: cats, kind: 'pareto' };
  }

  /* ------------------------------ helpers ------------------------------- */
  function familyOf(records, color) {
    for (var i = 0; i < records.length; i++) {
      if (records[i].color === color) return records[i].family;
    }
    return null;
  }

  // Plotly maps numeric shape coordinates on category axes to category
  // indices (0-based), which is exactly what we need for stepped limits.
  function seg(i, y, color) {
    return { type: 'line', xref: 'x', yref: 'y',
             x0: i - 0.46, x1: i + 0.46, y0: y, y1: y,
             line: { color: color, width: 1.6, dash: 'dash' } };
  }

  function lineProxy(name, color) {
    return { type: 'scatter', mode: 'lines', name: name,
             x: [null], y: [null], hoverinfo: 'skip', showlegend: true,
             line: { color: color, dash: 'dash', width: 1.6 } };
  }

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function fmtDelta(d) {
    if (d === null || d === undefined || !isFinite(d)) return '—';
    var r = Math.round(d * 10) / 10;
    return (r > 0 ? '+' : '') + r.toFixed(1);
  }

  return {
    SCHEMA: SCHEMA,
    newHistory: newHistory,
    loadHistory: loadHistory,
    serializeHistory: serializeHistory,
    mergeImport: mergeImport,
    sortedMonthKeys: sortedMonthKeys,
    filterRecords: filterRecords,
    periodRecords: periodRecords,
    colorsIn: colorsIn,
    summarize: summarize,
    problemZones: problemZones,
    zoneCounts: zoneCounts,
    momDeltas: momDeltas,
    buildOrientPlot: buildOrientPlot,
    buildParetoPlot: buildParetoPlot,
    buildTrendPlot: buildTrendPlot,
    buildZoneCompare: buildZoneCompare,
    buildIntervalPlot: buildIntervalPlot,
    defaultStandards: defaultStandards,
    plantsIn: plantsIn,
    filesIn: filesIn,
    keyToLabel: keyToLabel,
    fmtDelta: fmtDelta,
    STATUS_COLOR: STATUS_COLOR
  };
});


