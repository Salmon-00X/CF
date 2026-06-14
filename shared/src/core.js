/* =========================================================================
 * CF Wavescan Analyzer — core engine (parser + analytics)
 * Environment-agnostic: attaches to `window.CFCore` in the browser and
 * exports via `module.exports` in Node (for unit tests).
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CFCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ----------------------------------------------------------------------
   * Reference data
   * -------------------------------------------------------------------- */

  // Wavescan target values (Ford Production + Minimums), per Color Family.
  // Source: corporate Wavescan Target Values table. Editable in the UI;
  // edits are persisted inside the history file.
  var DEFAULT_STANDARDS = {
    'Light Metallics':  { fordH: 57, fordV: 44, minH: 50, minV: 37 },
    'Medium Metallics': { fordH: 60, fordV: 47, minH: 53, minV: 40 },
    'Dark Metallics':   { fordH: 62, fordV: 49, minH: 55, minV: 42 },
    'Light Solids':     { fordH: 62, fordV: 49, minH: 55, minV: 42 },
    'Medium Solids':    { fordH: 65, fordV: 52, minH: 58, minV: 45 },
    'Dark Solids':      { fordH: 67, fordV: 54, minH: 60, minV: 47 }
  };

  // Color -> Family map (Color Family - IMG Plants document).
  // Keys are lower-case canonical names; aliases are resolved first.
  var COLOR_FAMILY = {
    'white platinum': 'Light Metallics',
    'moon dust silver': 'Light Metallics',
    'aluminium metallic': 'Light Metallics',
    'ingot silver': 'Light Metallics',
    'silver metallic': 'Light Metallics',
    'white gold': 'Light Metallics',
    'snow flake white': 'Light Metallics',
    'iconic silver': 'Light Metallics',
    'canyon ridge': 'Medium Metallics',
    'saber': 'Medium Metallics',
    'sedona orange': 'Medium Metallics',
    'smoke': 'Medium Metallics',
    'meteor grey': 'Medium Metallics',
    'sea grey': 'Medium Metallics',
    'magnetic grey': 'Medium Metallics',
    'diffuse silver': 'Medium Metallics',
    'luxe yellow': 'Medium Metallics',
    'equinox bronze': 'Medium Metallics',
    'vapor blue': 'Medium Metallics',
    'agacia green': 'Medium Metallics',
    'carbonized grey': 'Medium Metallics',
    'cyber orange': 'Medium Metallics',
    'cyclone terra green': 'Medium Metallics',
    'code orange': 'Medium Solids',
    'true red': 'Medium Solids',
    'race red': 'Medium Solids',
    'seismic tan': 'Medium Solids',
    'command grey': 'Medium Solids',
    'ignite orange': 'Medium Solids', // FTM runs the Medium Solids variant
    'traction green': 'Medium Solids',
    'ruby red': 'Dark Metallics',
    'sunset': 'Dark Metallics',
    'lucid red': 'Dark Metallics',
    'redfire': 'Dark Metallics',
    'bari red ii': 'Dark Metallics',
    'shadow black': 'Dark Metallics',
    'agate black': 'Dark Metallics',
    'black pearl': 'Dark Metallics',
    'blue metallic': 'Dark Metallics',
    'blue lightning': 'Dark Metallics',
    'deep impact blue': 'Dark Metallics',
    'deep crystal blue': 'Dark Metallics',
    'performance blue': 'Dark Metallics',
    'caribou': 'Dark Metallics',
    'pace red': 'Dark Metallics',
    'desert island blue': 'Dark Metallics',
    'diamond white': 'Light Solids',
    'arctic white': 'Light Solids',
    'frozen white': 'Light Solids',
    'oxford white': 'Light Solids',
    'chill grey': 'Light Solids',
    'conquer': 'Dark Solids'
  };

  // Alternate spellings seen in plant data.
  var COLOR_ALIASES = {
    'aluminum metallic': 'aluminium metallic',
    'absolute black': 'shadow black',
    'absolute black / shadow black': 'shadow black',
    'deep imapct blue': 'deep impact blue', // typo present in source doc
    'grey': null, 'gray': null // guard: never match a bare grey/gray
  };

  // Colors that are actively run at FTM (✓ in the Color Family - IMG Plants
  // reference PDF). Used purely as a hint in the Standards dialog so the
  // operator can see "this color is expected here" — it never filters data,
  // an AAT-only color still surfaces if a file carries it.
  var FTM_COLORS = {
    'aluminium metallic': 1, 'saber': 1, 'sedona orange': 1, 'code orange': 1,
    'meteor grey': 1, 'shadow black': 1, 'luxe yellow': 1, 'blue lightning': 1,
    'performance blue': 1, 'arctic white': 1, 'snow flake white': 1,
    'conquer': 1, 'command grey': 1, 'ignite orange': 1, 'desert island blue': 1
  };

  // Spelling variants normalised before lookup ("Gray" -> "Grey").
  function canonSpelling(s) { return s.replace(/\bgray\b/g, 'grey'); }

  var MONTHS = ['january','february','march','april','may','june','july',
                'august','september','october','november','december'];

  /* ----------------------------------------------------------------------
   * Small utilities
   * -------------------------------------------------------------------- */
  var EPS = 1e-9;

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function toNum(v) {
    if (isNum(v)) return v;
    if (typeof v === 'string') {
      var t = v.trim();
      // European locale "55,4" = decimal comma (single comma, no dot):
      // converting it by stripping commas would silently produce 554 — a
      // 10x data corruption. Treat it as a decimal point instead.
      if (/^[+-]?\d+,\d+$/.test(t)) t = t.replace(',', '.');
      else t = t.replace(/,/g, ''); // thousands separators
      if (t === '' || /[^0-9.+\-eE]/.test(t)) return null;
      var n = Number(t);
      return isFinite(n) ? n : null;
    }
    return null;
  }

  function txt(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

  function round1(n) { return Math.round(n * 10) / 10; }

  // Display formatter for averages/readings. Calculations stay full-precision;
  // this only controls how a number is shown. Matches Minitab's label style:
  // up to 4 decimal places with trailing zeros trimmed (59.2571, 48.12, 54).
  function fmtCF(x) {
    if (x === null || x === undefined || !isFinite(x)) return '\u2014';
    return String(Math.round(x * 10000) / 10000);
  }

  function mean(a) {
    var s = 0; for (var i = 0; i < a.length; i++) s += a[i];
    return a.length ? s / a.length : NaN;
  }

  /* ----------------------------------------------------------------------
   * Color name normalisation
   * "LS-A4 Arctic White BC" / "A4 Arctic White BC" / "5C Command Grey BC"
   *   -> { color: 'Arctic White', family: 'Light Solids' }
   * -------------------------------------------------------------------- */
  function normalizeColor(raw) {
    var s = txt(raw);
    if (!s || s.length > 64) return null;
    s = canonSpelling(s.toLowerCase());
    s = s.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
    // strip trailing coat suffixes ("Arctic White BC" -> "Arctic White")
    var stripped = s.replace(/\s+(bc|cc|b\/c|basecoat|tricoat)$/i, '').trim();

    var candidates = [stripped];
    // also try removing 1-2 leading code tokens (e.g. "ls-a4 arctic white")
    var parts = stripped.split(' ');
    if (parts.length > 2) candidates.push(parts.slice(1).join(' '));
    if (parts.length > 3) candidates.push(parts.slice(2).join(' '));

    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (COLOR_ALIASES.hasOwnProperty(c)) {
        var a = COLOR_ALIASES[c];
        if (a === null) continue;
        c = a;
      }
      if (COLOR_FAMILY.hasOwnProperty(c)) {
        return { color: titleCase(c), family: COLOR_FAMILY[c] };
      }
    }
    // last resort: find a known color name contained in the string
    var keys = Object.keys(COLOR_FAMILY);
    for (var k = 0; k < keys.length; k++) {
      if (stripped.indexOf(keys[k]) !== -1) {
        return { color: titleCase(keys[k]), family: COLOR_FAMILY[keys[k]] };
      }
    }
    var ak = Object.keys(COLOR_ALIASES);
    for (var j = 0; j < ak.length; j++) {
      var al = COLOR_ALIASES[ak[j]];
      if (al && stripped.indexOf(ak[j]) !== -1) {
        return { color: titleCase(al), family: COLOR_FAMILY[al] };
      }
    }
    return null;
  }

  function titleCase(s) {
    return s.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); })
            .replace(/\bIi\b/g, 'II');
  }

  /* ----------------------------------------------------------------------
   * Checkzone helpers
   * -------------------------------------------------------------------- */
  var ZONE_WORDS = /(HOOD|ROOF|FENDER|FEND|DOOR|PILLAR|BOX|TGATE|TAILGATE|TAILGTE|FUEL|QTR|QUARTER|BUMPER|DECK|LIFTGATE|ROCKER)/i;

  function isZoneName(s) {
    var t = txt(s);
    if (!t || t.length > 40) return false;
    if (/^(horizontal|vertical)$/i.test(t)) return false;        // group rows
    if (/^(groups?|match to standard|checkzone|status)$/i.test(t)) return false;
    // typical zones: "01HOOD", "05 LFHOOD", "46 Door Fuel Lid", "22RTBOXSD"
    if (/^\d{1,2}\s*[A-Za-z]/.test(t)) return true;
    return ZONE_WORDS.test(t);
  }

  function orientationOf(zone) {
    return /(HOOD|ROOF)/i.test(txt(zone)) ? 'H' : 'V';
  }

  // A cell the export uses for sub-total / grand-total rows: "[All]" or "All".
  // Per plant rule these rows are aggregates and must never be treated as data.
  function isAllToken(v) {
    return /^\[?\s*all\s*\]?$/i.test(txt(v));
  }

  // The flat export's "Tolerance Group" column states the orientation directly
  // (Horizontal / Vertical) — authoritative, used in preference to guessing
  // from the checkzone name.
  function orientFromTolerance(v) {
    var t = txt(v).toLowerCase();
    if (t === 'horizontal' || t === 'h') return 'H';
    if (t === 'vertical' || t === 'v') return 'V';
    return null;
  }

  /* ----------------------------------------------------------------------
   * Model detection ("P703 DBL-RANGER", "Raptor", ...)
   * -------------------------------------------------------------------- */
  function detectModel(s) {
    var t = txt(s).toLowerCase();
    if (!t) return null;
    if (t.indexOf('raptor') !== -1) return 'Raptor';
    if (t.indexOf('ranger') !== -1) return 'Ranger';
    // "DBL" (double-cab) is the plant's name for the Ranger — the Minitab
    // "FTM P703 DBL" slide IS the Ranger report, and some exports label the
    // model just "P703 DBL" with no "Ranger" token. Without this, those rows
    // fall through to Unspecified and split a color's data into two boxes with
    // two wrong means. Matched on a token boundary so it can't hit substrings.
    if (/(^|[^a-z])dbl([^a-z]|$)/.test(t)) return 'Ranger';
    return null;
  }

  // Display name for a model key. Internally the Ranger standard is keyed
  // 'Ranger'; the plant (and its Minitab decks) call it "DBL", so that is what
  // the operator sees. null/'?' -> "Unspecified".
  function modelLabel(m) {
    if (m === 'Ranger') return 'DBL';
    if (m === 'Raptor') return 'Raptor';
    return 'Unspecified';
  }

  // Known assembly plants. A "Plant" column value or a filename token is
  // matched against these so data can be separated per plant (like models).
  var PLANTS = ['FTM', 'AAT', 'FVL', 'SAP'];
  function normalizePlant(s) {
    var t = txt(s).toUpperCase();
    if (!t || isAllToken(t)) return null;
    for (var i = 0; i < PLANTS.length; i++) {
      if (t === PLANTS[i]) return PLANTS[i];
    }
    return detectPlant(t);
  }
  function detectPlant(s) {
    var t = txt(s).toUpperCase();
    for (var i = 0; i < PLANTS.length; i++) {
      if (new RegExp('(^|[^A-Z])' + PLANTS[i] + '([^A-Z]|$)').test(t)) return PLANTS[i];
    }
    return null;
  }

  /* ----------------------------------------------------------------------
   * Month from filename, e.g. "04__June26_CF_data.xlsx",
   * "03__March_26_CF_data.xlsx", "CF May 2026.xlsx"
   * -------------------------------------------------------------------- */
  function monthFromFilename(name) {
    var s = txt(name).toLowerCase();
    var mi = -1, mlen = 0, pos = -1;
    for (var i = 0; i < 12; i++) {
      var full = MONTHS[i], ab = full.slice(0, 3);
      var p = s.indexOf(full);
      if (p !== -1 && full.length > mlen) { mi = i; mlen = full.length; pos = p; }
      else if (mi !== i) {
        var re = new RegExp('(^|[^a-z])' + ab + '([^a-z]|$)');
        var m = re.exec(s);
        if (m && mlen < 3) { mi = i; mlen = 3; pos = m.index + m[1].length; }
      }
    }
    if (mi === -1) return null;
    // find a year near (after, else before) the month token
    var after = s.slice(pos + mlen);
    var y = matchYear(after) || matchYear(s);
    if (y === null) return null;
    return { year: y, month: mi + 1 }; // month: 1..12
  }

  function matchYear(s) {
    var m4 = /(?:^|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/.exec(s);
    if (m4) return Number(m4[1]);
    // 2-digit year must sit against a letter (e.g. "june26", "_26_") so a leading
    // file index like "04__June26" cannot be misread as the year 2004.
    var m2 = /(?:[a-z_]|^)(\d{2})(?:[^0-9]|$)/.exec(s);
    if (m2) {
      var n = Number(m2[1]);
      if (n >= 20 && n <= 79) return 2000 + n;
    }
    return null;
  }

  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  function monthKey(y, m) { return y + '-' + pad2(m); }
  function monthLabel(y, m) {
    return MONTHS[m - 1].charAt(0).toUpperCase() + MONTHS[m - 1].slice(1, 3) + ' ' + y;
  }

  /* ----------------------------------------------------------------------
   * Workbook parsing
   * Input: array of sheets [{ name, rows }] where rows = array of arrays
   * (use XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null})).
   * Output: { records, warnings, limitsSeen, modelDetected }
   *   record = { model, color, family, zone, orient, cf }
   * -------------------------------------------------------------------- */
  function parseSheets(sheets, opts) {
    opts = opts || {};
    var out = { records: [], warnings: [], limitsSeen: [], modelDetected: null, plantDetected: null };
    var fileModel = detectModel(opts.filename || '');
    var filePlant = detectPlant(opts.filename || '');

    for (var s = 0; s < sheets.length; s++) {
      var sheet = sheets[s];
      var rows = sheet.rows || [];
      if (!rows.length) continue;
      var sheetModel = detectModel(sheet.name) || fileModel;
      var sheetPlant = detectPlant(sheet.name) || filePlant;

      if (looksFlat(rows)) parseFlatSheet(sheet, sheetModel, sheetPlant, out);
      else parseBlockSheet(sheet, sheetModel, sheetPlant, out);
    }

    // Resolve a single detected model if every record agrees
    var models = {};
    out.records.forEach(function (r) { if (r.model) models[r.model] = 1; });
    var keys = Object.keys(models);
    out.modelDetected = keys.length === 1 ? keys[0] : (keys.length ? 'Mixed' : null);
    var plants = {};
    out.records.forEach(function (r) { if (r.plant) plants[r.plant] = 1; });
    var pk = Object.keys(plants);
    out.plantDetected = pk.length === 1 ? pk[0] : (pk.length ? 'Mixed' : null);

    // Deduplicate: one value per (model,color,zone) measurement row set —
    // duplicate export rows ([All]/Booth/serial levels) collapse to one;
    // genuinely different duplicate values are averaged (per plant rule).
    out.records = dedupe(out.records, out.warnings);
    return out;
  }

  /* Header cell canonical form: lowercase, ALL whitespace removed, trailing
   * colon dropped — so "Check zone", "CHECKZONE", "Checkzone:" all match. */
  function hdr(c) {
    return txt(c).toLowerCase().replace(/\s+/g, '').replace(/:$/, '');
  }

  /* Flat table detection: a header row holding checkzone + color + cf */
  function looksFlat(rows) {
    for (var i = 0; i < Math.min(rows.length, 25); i++) {
      var low = (rows[i] || []).map(hdr);
      if (low.some(function (c) { return c.indexOf('checkzone') === 0; }) &&
          low.some(function (c) { return c.indexOf('color') === 0 || c.indexOf('colour') === 0; }) &&
          low.some(function (c) { return c === 'cf' || (c.indexOf('cf') === 0 && c.length <= 3); })) {
        return true;
      }
    }
    return false;
  }

  function colIndex(headerLow, names) {
    for (var i = 0; i < headerLow.length; i++) {
      for (var n = 0; n < names.length; n++) {
        var nm = names[n];
        if (headerLow[i] === nm || headerLow[i].indexOf(nm) === 0) return i;
      }
    }
    return -1;
  }

  /* May-style pivot export: Month/Model/Checkzone/Color/.../CF columns with
   * the same checkzone repeated at several filter levels ("[All]" rows). */
  function parseFlatSheet(sheet, sheetModel, sheetPlant, out) {
    var rows = sheet.rows, hi = -1, header = null;
    for (var i = 0; i < Math.min(rows.length, 25); i++) {
      var low = (rows[i] || []).map(hdr);
      if (low.some(function (c) { return c.indexOf('checkzone') === 0; })) { hi = i; header = low; break; }
    }
    if (hi === -1) return;

    var cZone  = colIndex(header, ['checkzone']);
    var cColor = colIndex(header, ['color', 'colour']);
    var cModel = colIndex(header, ['model']);
    var cTol   = colIndex(header, ['tolerancegroup', 'tolerance']);
    var cPlant = colIndex(header, ['plant']);
    var cCF    = header.indexOf('cf');
    if (cCF === -1) cCF = colIndex(header, ['cf']);
    if (cZone === -1 || cColor === -1 || cCF === -1) {
      out.warnings.push('Sheet "' + sheet.name + '": flat layout detected but required columns are missing — skipped.');
      return;
    }

    var skippedAll = 0;
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var zone = txt(row[cZone]), colorRaw = txt(row[cColor]);
      var modelRaw = cModel !== -1 ? txt(row[cModel]) : '';
      var tolRaw   = cTol   !== -1 ? txt(row[cTol])   : '';
      var plantRaw = cPlant !== -1 ? txt(row[cPlant]) : '';
      if (!zone || !colorRaw) continue;
      // Drop any aggregate row: a focus column (Model, Checkzone, Color,
      // Tolerance Group, Plant) holding "[All]" means this is a roll-up.
      if (isAllToken(zone) || isAllToken(colorRaw) ||
          (modelRaw && isAllToken(modelRaw)) || (tolRaw && isAllToken(tolRaw)) ||
          (plantRaw && isAllToken(plantRaw))) {
        skippedAll++; continue;
      }
      if (!isZoneName(zone)) continue;
      var cf = toNum(row[cCF]);
      if (cf === null) continue;
      var col = normalizeColor(colorRaw);
      if (!col) {
        out.warnings.push('Sheet "' + sheet.name + '" row ' + (r + 1) +
          ': unrecognised color "' + colorRaw + '" — row skipped.');
        continue;
      }
      var model = detectModel(modelRaw) || sheetModel;
      // Orientation: trust the Tolerance Group column when present, else infer
      // from the checkzone name (hood/roof = horizontal, everything else vertical).
      var orient = orientFromTolerance(tolRaw) || orientationOf(zone);
      out.records.push({
        model: model, plant: normalizePlant(plantRaw) || sheetPlant || null,
        color: col.color, family: col.family,
        zone: zone, orient: orient, cf: cf
      });
    }
  }

  /* June/March-style block report: color title rows, optional embedded
   * Warning Low / Fail Low limits, "Match to Standard" checkzone rows,
   * and a trailing "Groups" aggregate section (skipped — we recompute). */
  function parseBlockSheet(sheet, sheetModel, sheetPlant, out) {
    var rows = sheet.rows;
    var cur = null;            // current color block { color, family }
    var cfCol = -1, zoneCol = 0;
    var inGroups = false;
    var limitCtx = null;       // 'H' | 'V' while reading limits
    var pendingLimits = null;

    // March layout: locate "Checkzone" + "CF" header once per sheet,
    // plus a model column ("Parameter 1") if present.
    var modelCol = -1;

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r] || [];

      // (a) header row mapping ("Checkzone", "Check zone", with/without colon)
      var lowRow = row.map(hdr);
      var zi = lowRow.indexOf('checkzone');
      if (zi !== -1) {
        zoneCol = zi;
        var ci = lowRow.indexOf('cf');
        if (ci !== -1) cfCol = ci;
        var pi = -1;
        for (var pix = 0; pix < lowRow.length; pix++) {
          if (lowRow[pix].indexOf('parameter1') === 0 || lowRow[pix] === 'model') { pi = pix; break; }
        }
        if (pi !== -1) modelCol = pi;
        inGroups = false;
        continue;
      }

      // (b) color block header — any cell resolving to a known color
      var foundColor = null;
      for (var c = 0; c < row.length && c < 8; c++) {
        var t = txt(row[c]);
        if (t.length >= 6 && /[a-z]/i.test(t)) {
          var nc = normalizeColor(t);
          if (nc) { foundColor = nc; break; }
        }
      }
      // A resolved color name always wins over the zone-name pattern:
      // paint codes like "5C Command Grey BC" would otherwise match the
      // "digits + letters" checkzone heuristic. Real checkzone labels never
      // resolve to a known color, so this ordering is safe.
      if (foundColor) {
        if (cur && pendingLimits) flushLimits(out, cur, pendingLimits, sheet.name);
        cur = foundColor;
        pendingLimits = { color: cur.color, family: cur.family };
        inGroups = false; limitCtx = null;
        // CF column may be declared on the same title row (June layout)
        var ci2 = lowRow.indexOf('cf');
        if (ci2 !== -1) cfCol = ci2;
        continue;
      }

      // (c) section markers / embedded limits (June layout)
      var first = txt(row[0]) || txt(row[zoneCol]);
      var firstLow = first.toLowerCase();
      if (/^horizontal$/.test(firstLow) && !inGroups) { limitCtx = 'H'; continue; }
      if (/^vertical$/.test(firstLow) && !inGroups)   { limitCtx = 'V'; continue; }
      if (/^groups?$/.test(firstLow)) { inGroups = true; limitCtx = null; continue; }
      if (/^match to standard$/.test(firstLow)) { inGroups = false; limitCtx = null; continue; }

      var lim = /^(warning low|fail low)$/.exec(rowLabel(row));
      if (lim && limitCtx && pendingLimits) {
        var val = firstNumber(row);
        if (val !== null) {
          var key = (lim[1] === 'warning low' ? 'ford' : 'min') + limitCtx;
          pendingLimits[key] = val;
        }
        continue;
      }

      if (inGroups) continue; // skip pre-aggregated Horizontal/Vertical rows

      // (d) data rows
      var zone = txt(row[zoneCol]);
      if (!cur || !isZoneName(zone)) continue;
      var cf = (cfCol !== -1) ? toNum(row[cfCol]) : null;
      if (cf === null) cf = firstNumberAfter(row, zoneCol);
      if (cf === null) continue;
      var model = (modelCol !== -1 ? detectModel(row[modelCol]) : null) || sheetModel;
      out.records.push({
        model: model, plant: sheetPlant || null, color: cur.color, family: cur.family,
        zone: zone, orient: orientationOf(zone), cf: cf
      });
    }
    if (cur && pendingLimits) flushLimits(out, cur, pendingLimits, sheet.name);
  }

  function rowLabel(row) {
    for (var i = 0; i < row.length; i++) {
      var t = txt(row[i]).toLowerCase();
      if (t) return t;
    }
    return '';
  }

  function firstNumber(row) {
    for (var i = 0; i < row.length; i++) {
      var n = toNum(row[i]);
      if (n !== null) return n;
    }
    return null;
  }

  function firstNumberAfter(row, idx) {
    for (var i = idx + 1; i < row.length; i++) {
      var n = toNum(row[i]);
      if (n !== null) return n;
    }
    return null;
  }

  function flushLimits(out, color, lim, sheetName) {
    if (lim.fordH !== undefined || lim.fordV !== undefined ||
        lim.minH !== undefined || lim.minV !== undefined) {
      lim.sheet = sheetName;
      out.limitsSeen.push(lim);
    }
  }

  function dedupe(records, warnings) {
    var map = {};
    var order = [];
    records.forEach(function (rec) {
      var key = [rec.model || '?', rec.plant || '?', rec.color, rec.orient,
                 rec.zone.toUpperCase().replace(/\s+/g, '')].join('|');
      if (!map[key]) { map[key] = { rec: rec, vals: [] }; order.push(key); }
      map[key].vals.push(rec.cf);
    });
    return order.map(function (k) {
      var e = map[k];
      var distinct = e.vals.filter(function (v, i) { return e.vals.indexOf(v) === i; });
      if (distinct.length > 1) {
        e.rec.cf = mean(distinct);   // full precision, like every other average
        warnings.push('Duplicate readings for ' + e.rec.color + ' / ' + e.rec.zone +
          ' (' + distinct.join(', ') + ') — averaged to ' + fmtCF(e.rec.cf) + '.');
      }
      return e.rec;
    });
  }

  /* ----------------------------------------------------------------------
   * Analytics
   *
   * Status rule (v2 — proximity-to-minimum):
   *   avg < Min            -> FAIL    (below the floor)
   *   Min <= avg < Min+W   -> WARNING (within the warning band of the floor)
   *   avg >= Min + W       -> PASS    (comfortably above the minimum)
   * where W = WARNING_BAND (default 2 CF units, plant-tunable in future).
   *
   * The Ford "Average Target" is still drawn as the upper reference line on
   * every chart so the aspirational goal is visible, but it no longer drives
   * the pass/warn/fail decision. That was the previous rule's flaw: a color
   * sitting comfortably 7 CF above its minimum was flagged WARNING for not
   * touching an aspirational target, and the real signal (proximity to the
   * actual failure threshold) got buried.
   * -------------------------------------------------------------------- */
  var WARNING_BAND = 2;

  function statusOf(value, ford, minStd) {
    if (value === null || !isFinite(value)) return null;
    if (value < minStd - EPS) return 'FAIL';
    if (value < minStd + WARNING_BAND - EPS) return 'WARNING';
    return 'PASS';
  }

  /**
   * Resolve the target pair (Ford & Min) for an analysis row.
   *
   * The `standards` object now has two layers:
   *   { families: { 'Light Solids': {fordH,fordV,minH,minV}, ... },
   *     colors:   { 'Arctic White': {fordH,fordV,minH,minV}, ... } }
   * A per-color entry, when present, completely overrides the family default
   * — that is how a one-off variant (e.g. an FTM Ignite Orange that runs as
   * Medium Solids but takes Medium Metallics targets) gets the right grading.
   * An older flat-shape history object is still accepted ("families is the
   * whole object") so existing JSON files load unchanged.
   */
  function targetsFor(family, standards, colorName) {
    var col = colorName, fams;
    if (!standards) {
      fams = DEFAULT_STANDARDS;
    } else if (standards.families) {
      if (col && standards.colors && standards.colors[col]) return standards.colors[col];
      fams = standards.families;
    } else {
      fams = standards;  // legacy flat shape
    }
    return fams[family] || DEFAULT_STANDARDS[family] || null;
  }

  // Standards lookup keyed by orientation — both core analytics and the chart
  // builders share this; defining it once keeps H/V routing in lockstep.
  function stdPair(std, orient) {
    if (!std) return { ford: null, min: null };
    return orient === 'H'
      ? { ford: std.fordH, min: std.minH }
      : { ford: std.fordV, min: std.minV };
  }

  /**
   * Group records into per (model, color, orientation) stats with statuses.
   * Returns array of groups:
   * { model, color, family, orient, n, avg, min, max, values, zones,
   *   ford, minStd, status }
   */
  function analyze(records, standards) {
    var groups = {}, order = [];
    records.forEach(function (rec) {
      var key = [rec.model || '?', rec.color, rec.orient].join('|');
      if (!groups[key]) {
        groups[key] = {
          model: rec.model, color: rec.color, family: rec.family,
          orient: rec.orient, values: [], zones: []
        };
        order.push(key);
      }
      groups[key].values.push(rec.cf);
      groups[key].zones.push(rec.zone);
    });

    var list = order.map(function (k) {
      var g = groups[k];
      var pair = stdPair(targetsFor(g.family, standards, g.color), g.orient);
      g.n = g.values.length;
      // Full-precision mean — every digit of every reading participates, so the
      // average (and the Pass/Warning/Fail decision drawn from it) matches a
      // hand/Minitab calculation exactly. Rounding happens only at display time.
      g.avg = mean(g.values);
      g.min = Math.min.apply(null, g.values);
      g.max = Math.max.apply(null, g.values);
      g.ford = pair.ford;
      g.minStd = pair.min;
      g.status = pair.ford !== null ? statusOf(g.avg, pair.ford, pair.min) : null;
      return g;
    });

    return { groups: list };
  }

  /** Per-checkzone statuses for the detail table (June-style view). */
  function zoneStatuses(records, standards) {
    return records.map(function (rec) {
      var pair = stdPair(targetsFor(rec.family, standards, rec.color), rec.orient);
      var hasStd = pair.ford !== null;
      return {
        model: rec.model, plant: rec.plant || null, color: rec.color, family: rec.family,
        zone: rec.zone, orient: rec.orient, cf: rec.cf,
        ford: pair.ford, minStd: pair.min,
        status: hasStd ? statusOf(rec.cf, pair.ford, pair.min) : null,
        devFord: hasStd ? round1(rec.cf - pair.ford) : null,
        devMin:  hasStd ? round1(rec.cf - pair.min)  : null
      };
    });
  }

  /** Compare limits embedded in an uploaded file against active standards. */
  function checkLimits(limitsSeen, standards) {
    var notes = [];
    (limitsSeen || []).forEach(function (lim) {
      var std = targetsFor(lim.family, standards, lim.color);
      if (!std) return;
      [['fordH', 'Ford H'], ['fordV', 'Ford V'], ['minH', 'Min H'], ['minV', 'Min V']]
        .forEach(function (p) {
          var k = p[0];
          if (lim[k] !== undefined && Math.abs(lim[k] - std[k]) > EPS) {
            notes.push(lim.color + ': file says ' + p[1] + ' = ' + lim[k] +
              ', app standard is ' + std[k] + ' (' + lim.family + ').');
          }
        });
    });
    return notes;
  }

  return {
    DEFAULT_STANDARDS: DEFAULT_STANDARDS,
    COLOR_FAMILY: COLOR_FAMILY,
    FTM_COLORS: FTM_COLORS,
    WARNING_BAND: WARNING_BAND,
    normalizeColor: normalizeColor,
    isZoneName: isZoneName,
    orientationOf: orientationOf,
    detectModel: detectModel,
    modelLabel: modelLabel,
    normalizePlant: normalizePlant,
    detectPlant: detectPlant,
    PLANTS: PLANTS,
    fmtCF: fmtCF,
    monthFromFilename: monthFromFilename,
    monthKey: monthKey,
    monthLabel: monthLabel,
    parseSheets: parseSheets,
    analyze: analyze,
    zoneStatuses: zoneStatuses,
    statusOf: statusOf,
    targetsFor: targetsFor,
    checkLimits: checkLimits,
    stdPair: stdPair,
    _internal: { toNum: toNum, mean: mean, round1: round1 }
  };
});


