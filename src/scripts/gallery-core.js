// Gallery layout core (docs/design-system.md §5e). Plain JS, inlined right
// after the grid in pages/gallery.astro so the first paint already shows the
// justified rows (no jump from the CSS fallback). src/scripts/gallery.ts
// drives everything interactive through window.__gallery.
//
// Rows are an optimal linear partition of the sequence (Knuth–Plass style DP):
// every row is scaled so its tiles exactly fill the width, and the partition
// minimises Σ ln(h/T)², T being the target row height (zoom × a width-based
// default). The last row may stay ragged at T when it cannot fill.
(function (g) {
  var clamp = function (v, a, b) {
    return Math.min(Math.max(v, a), b);
  };
  var ORDER_KEY = 'gallery-order';
  var ZOOM_KEY = 'gallery-zoom';

  /** Default target row height for a viewport width (zoom 1). */
  function target(vw) {
    return clamp(0.11 * vw + 140, 200, 460);
  }

  /** Spacing scales with density: Atlas-small gaps zoomed out, roomier in. */
  function metrics(T) {
    var compact = T < 170;
    var px = compact ? clamp(Math.round(T / 28), 3, 8) : 12;
    return {
      compact: compact,
      gap: clamp(Math.round(T / 24), 4, 16),
      px: px,
      pt: compact ? px : 34,
      pb: compact ? px : 12,
      cap: compact ? 0 : 44,
      radius: compact ? clamp(Math.round(T / 18), 4, 10) : 14,
    };
  }

  /** r: art aspect ratios in order. Returns tile rects in grid coordinates. */
  function layout(r, W, T, vh) {
    var m = metrics(T);
    var n = r.length;
    var maxH = Math.max(160, vh - 200);
    var best = [0];
    var from = [0];
    var info = [];
    function row(i, j) {
      var R = 0;
      var rmin = Infinity;
      for (var q = i; q < j; q++) {
        R += r[q];
        rmin = Math.min(rmin, r[q]);
      }
      var k = j - i;
      var h = (W - (k - 1) * m.gap - k * 2 * m.px) / R;
      if (h <= 0 || (k > 1 && rmin * h < 0.7 * T)) return null;
      if (j === n && h > 1.4 * T && (k > 1 || h > maxH)) {
        // Ragged last row: kept at T, left-aligned; mildly penalise the gap.
        var fill = (R * T + k * 2 * m.px + (k - 1) * m.gap) / W;
        return { cost: 1.2 * (1 - fill) * (1 - fill), h: Math.min(T, maxH), mode: 'ragged' };
      }
      var cost = Math.pow(Math.log(h / T), 2);
      // Zoomed in, a tall drawing alone on its row is capped to the screen.
      if (h > maxH) return { cost: cost, h: maxH, mode: 'center' };
      return { cost: cost, h: h, mode: 'fill' };
    }
    for (var j = 1; j <= n; j++) {
      best[j] = Infinity;
      for (var i = Math.max(0, j - 24); i < j; i++) {
        if (best[i] === Infinity) continue;
        var ri = row(i, j);
        if (!ri) continue;
        var c = best[i] + ri.cost;
        if (c < best[j]) {
          best[j] = c;
          from[j] = i;
          info[j] = ri;
        }
      }
      if (best[j] === Infinity) {
        // Nothing fits (absurdly narrow): fall back to one per row.
        best[j] = best[j - 1] + 1;
        from[j] = j - 1;
        info[j] = { cost: 1, h: Math.max(1, (W - 2 * m.px) / r[j - 1]), mode: 'fill' };
      }
    }
    var cuts = [];
    for (var e = n; e > 0; e = from[e]) cuts.unshift([from[e], e, info[e]]);
    var rects = new Array(n);
    var rows = [];
    var y = 0;
    for (var c2 = 0; c2 < cuts.length; c2++) {
      var a = cuts[c2][0];
      var b = cuts[c2][1];
      var it = cuts[c2][2];
      var h2 = it.h;
      var used = -m.gap;
      for (var q2 = a; q2 < b; q2++) used += r[q2] * h2 + 2 * m.px + m.gap;
      var x = it.mode === 'center' ? (W - used) / 2 : 0;
      var th = h2 + m.pt + m.pb + m.cap;
      for (var q3 = a; q3 < b; q3++) {
        var w = r[q3] * h2 + 2 * m.px;
        rects[q3] = { x: x, y: y, w: w, h: th, ah: h2, row: rows.length };
        x += w + m.gap;
      }
      rows.push({ from: a, to: b, y: y, h: th, mode: it.mode });
      y += th + m.gap;
    }
    return { rects: rects, rows: rows, height: Math.max(0, y - m.gap), m: m, T: T, cost: best[n] };
  }

  /** Zoom bounds for a grid width: from "everything at once" to one per row. */
  function zoomRange(vw, W) {
    var T0 = target(vw);
    return { min: 56 / T0, max: Math.max(1.5, W / 1.05 / T0) };
  }

  function read(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function savedOrder(slugs) {
    try {
      var o = JSON.parse(read(ORDER_KEY) || 'null');
      if (!Array.isArray(o) || o.length !== slugs.length) return null;
      var set = {};
      for (var i = 0; i < slugs.length; i++) set[slugs[i]] = 1;
      for (var k = 0; k < o.length; k++) if (!set[o[k]]) return null;
      return o;
    } catch (e) {
      return null;
    }
  }

  /** Write a layout to the DOM: grid height, spacing vars, tile boxes. Only
   *  what changed is written: the spacing vars and --art-h inherit through
   *  every node of the drawings, so a needless write restyles thousands. */
  function put(style, key, value) {
    if (style.getPropertyValue(key) !== value) style.setProperty(key, value);
  }
  function apply(grid, tiles, L) {
    var m = L.m;
    var s = grid.style;
    put(s, 'height', L.height + 'px');
    put(s, '--g-px', m.px + 'px');
    put(s, '--g-pt', m.pt + 'px');
    put(s, '--g-pb', m.pb + 'px');
    put(s, '--g-radius', m.radius + 'px');
    if (grid.hasAttribute('data-compact') !== m.compact) grid.toggleAttribute('data-compact', m.compact);
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i].style;
      var R = L.rects[i];
      put(t, 'left', R.x + 'px');
      put(t, 'top', R.y + 'px');
      put(t, 'width', R.w + 'px');
      put(t, 'height', R.h + 'px');
      put(t, '--art-h', R.ah + m.pt + m.pb + 'px');
    }
  }

  function tag(n) {
    return 'FIG_' + String(n).padStart(3, '0');
  }

  /** Number the tiles in their current (DOM) order. */
  function renumber(tiles) {
    for (var i = 0; i < tiles.length; i++) {
      var el = tiles[i].querySelector('.fig-tag');
      if (el) el.textContent = tag(i + 1);
    }
  }

  var api = {
    target: target,
    metrics: metrics,
    layout: layout,
    zoomRange: zoomRange,
    apply: apply,
    renumber: renumber,
    savedOrder: savedOrder,
    read: read,
    ORDER_KEY: ORDER_KEY,
    ZOOM_KEY: ZOOM_KEY,
    clamp: clamp,
  };
  g.__gallery = api;

  // First layout, before paint.
  var doc = g.document;
  var grid = doc && doc.querySelector('[data-gallery]');
  if (!grid) return;
  var tiles = Array.prototype.slice.call(grid.querySelectorAll('[data-tile]'));
  var slugs = tiles.map(function (t) {
    return t.id;
  });
  var order = savedOrder(slugs);
  if (order) {
    var by = {};
    tiles.forEach(function (t) {
      by[t.id] = t;
    });
    tiles = order.map(function (s) {
      return by[s];
    });
    tiles.forEach(function (t) {
      grid.appendChild(t);
    });
    renumber(tiles);
  }
  var vw = g.innerWidth;
  var W = grid.clientWidth;
  var zr = zoomRange(vw, W);
  var z = clamp(parseFloat(read(ZOOM_KEY) || '1') || 1, zr.min, zr.max);
  var ratios = tiles.map(function (t) {
    return parseFloat(t.getAttribute('data-r'));
  });
  grid.classList.add('is-laid');
  var L = layout(ratios, grid.clientWidth, target(vw) * z, g.innerHeight);
  apply(grid, tiles, L);
  api.boot = { z: z, L: L };
})(globalThis);
