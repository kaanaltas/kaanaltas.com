// Gallery interaction (docs/design-system.md §5e), after Atlas's Grid view:
// zoom is density (pinch, ⌘±, slider) anchored on the drawing under the
// pointer; every re-layout springs each tile from where it is to where it
// belongs (transform only); click/⇧/⌘ and a marquee select; dragging a
// selection reorders it live; a double-click or Space opens Quick Look (one and
// the same action), which grows out of the tile; a double-click or Space inside
// closes it. The layout itself is gallery-core.js (inlined).
//
// Performance: while anything moves, tiles move by transform only, against
// the box last written to the DOM (Tile.A). Real sizes are written (`commit`)
// a few times per gesture and once when everything settles, never per frame,
// and the grid's position is cached, so a frame is springs + transforms with
// no forced layout and no SVG re-render.

import { applyKeyLabels } from './platform';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  ah: number;
  row: number;
}
interface Metrics {
  compact: boolean;
  gap: number;
  px: number;
  pt: number;
  pb: number;
  cap: number;
  radius: number;
}
interface Layout {
  rects: Rect[];
  rows: { from: number; to: number; y: number; h: number; mode: string }[];
  height: number;
  m: Metrics;
  T: number;
}
interface Core {
  target(vw: number): number;
  layout(r: number[], W: number, T: number, vh: number): Layout;
  zoomRange(vw: number, W: number): { min: number; max: number };
  apply(grid: HTMLElement, tiles: HTMLElement[], L: Layout): void;
  renumber(tiles: HTMLElement[]): void;
  read(key: string): string | null;
  ORDER_KEY: string;
  ZOOM_KEY: string;
  clamp(v: number, a: number, b: number): number;
  boot?: { z: number; L: Layout };
}
declare global {
  interface Window {
    __gallery?: Core;
  }
}

interface Tile {
  el: HTMLElement;
  slug: string;
  title: string;
  r: number;
  fig: HTMLElement;
  hit: HTMLButtonElement;
  L: Rect;
  /** The box last written to the DOM; transforms are relative to it. */
  A: Rect;
  // Visual box (grid coordinates) and its velocity; the spring pulls it to L.
  x: number;
  y: number;
  w: number;
  vx: number;
  vy: number;
  vw: number;
  // While dragged: where the pointer wants it.
  tx: number | null;
  ty: number | null;
  tw: number | null;
  still: boolean;
}

// Springs (mass 1). Layout: period .36 s, damping .9 (snappy, a hair of
// overshoot); drag and the zoom's spring back are stiffer still.
const K = (2 * Math.PI / 0.36) ** 2;
const C = (4 * Math.PI * 0.9) / 0.36;
const K_DRAG = 1600;
const C_DRAG = 2 * Math.sqrt(K_DRAG);
const K_ZOOM = 420;
const C_ZOOM = 2 * Math.sqrt(K_ZOOM);

const store = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private mode: fine, nothing is remembered */
  }
};

export function initGallery() {
  const maybeCore = window.__gallery;
  const maybeGrid = document.querySelector<HTMLElement>('[data-gallery]');
  if (!maybeCore?.boot || !maybeGrid?.classList.contains('is-laid')) return;
  // Re-bound so the hoisted helpers below see them as defined.
  const core: Core = maybeCore;
  const grid: HTMLElement = maybeGrid;

  applyKeyLabels(document.querySelector('.g-page') ?? document);
  const live = document.querySelector<HTMLElement>('[data-g-live]');
  const say = (s: string) => {
    if (!live) return;
    live.textContent = '';
    window.setTimeout(() => (live.textContent = s), 30);
  };

  // ---------------------------------------------------------------- model
  const defaultOrder = (grid.dataset.order ?? '').split(' ');
  let tiles: Tile[] = [...grid.querySelectorAll<HTMLElement>('[data-tile]')].map((el, i) => {
    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'g-hit';
    hit.tabIndex = i === 0 ? 0 : -1;
    hit.setAttribute('aria-label', el.dataset.title ?? el.id);
    hit.setAttribute('aria-describedby', 'g-help');
    el.prepend(hit);
    const L = core.boot!.L.rects[i];
    return {
      el,
      slug: el.id,
      title: el.dataset.title ?? el.id,
      r: parseFloat(el.dataset.r ?? '1'),
      fig: el.querySelector<HTMLElement>('figure')!,
      hit,
      L,
      A: L,
      x: L.x,
      y: L.y,
      w: L.w,
      vx: 0,
      vy: 0,
      vw: 0,
      tx: null,
      ty: null,
      tw: null,
      still: true,
    };
  });
  const byEl = new Map(tiles.map((t) => [t.el, t]));
  const tileOf = (n: EventTarget | null) => {
    const el = (n as Element | null)?.closest?.<HTMLElement>('[data-tile]');
    return el ? byEl.get(el) : undefined;
  };
  let L: Layout = core.boot!.L;
  let z = core.boot!.z;
  let zr = core.zoomRange(innerWidth, grid.clientWidth);
  let lz = Math.log(z); // raw log-zoom, may run past the bounds (rubber band)

  // The grid's place on the page, cached: reading it live after a style write
  // would force a full layout in the middle of a frame. Zoom never moves the
  // grid's top-left (only what is above it can, on resize or a font swap).
  let gx0 = 0;
  let gy0 = 0;
  let gW = grid.clientWidth;
  function measureGrid() {
    const r = grid.getBoundingClientRect();
    gx0 = r.left + scrollX;
    gy0 = r.top + scrollY;
    gW = grid.clientWidth;
  }
  measureGrid();
  const gridBox = () => {
    const top = gy0 - scrollY;
    const left = gx0 - scrollX;
    return { top, left, width: gW, height: L.height, bottom: top + L.height, right: left + gW };
  };
  window.addEventListener('load', measureGrid);
  document.fonts?.ready.then(measureGrid);

  // ------------------------------------------------------------- springs
  let raf = 0;
  let last = 0;
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };

  function render(t: Tile) {
    const s = t.el.style;
    if (t.still && t.A === t.L) {
      s.transform = '';
      s.willChange = '';
      return;
    }
    s.willChange = 'transform';
    s.transform = `translate(${t.x - t.A.x}px, ${t.y - t.A.y}px) scale(${t.w / t.A.w})`;
  }

  function step(now: number) {
    raf = 0;
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    let busy = zoomTick(dt);
    busy = scrollTick(dt) || busy;
    for (const t of tiles) {
      const gx = t.tx ?? t.L.x;
      const gy = t.ty ?? t.L.y;
      const gw = t.tw ?? t.L.w;
      const dragged = t.tx != null;
      const k = dragged ? K_DRAG : K;
      const c = dragged ? C_DRAG : C;
      const h = dt / 3;
      for (let i = 0; i < 3; i++) {
        t.vx += (k * (gx - t.x) - c * t.vx) * h;
        t.vy += (k * (gy - t.y) - c * t.vy) * h;
        t.vw += (k * (gw - t.w) - c * t.vw) * h;
        t.x += t.vx * h;
        t.y += t.vy * h;
        t.w += t.vw * h;
      }
      const settled =
        t.tx == null &&
        Math.abs(gx - t.x) < 0.1 &&
        Math.abs(gy - t.y) < 0.1 &&
        Math.abs(gw - t.w) < 0.1 &&
        Math.abs(t.vx) + Math.abs(t.vy) + Math.abs(t.vw) < 1;
      if (settled) {
        t.x = gx;
        t.y = gy;
        t.w = gw;
        t.vx = t.vy = t.vw = 0;
      }
      t.still = settled;
      render(t);
      if (!settled) busy = true;
    }
    maybeCommit(now, busy);
    setMoving(busy);
    if (busy) {
      last = now;
      kick();
    } else last = 0;
  }

  // ------------------------------------------------------------- commit
  // Write the target layout to the DOM. Visual positions are kept (the
  // transforms are recomputed against the new boxes), so nothing jumps.
  let committed = L;
  let lastCommit = 0;
  function commit(now = performance.now()) {
    core.apply(
      grid,
      tiles.map((t) => t.el),
      L,
    );
    committed = L;
    lastCommit = now;
    for (const t of tiles) {
      t.A = t.L;
      render(t);
    }
  }
  // A live window resize re-packs every frame by transform only; the real
  // boxes are written once the resize has rested (RESIZE_REST), unless a
  // tile has drifted far from its real size or the thumbnail mode flipped.
  const RESIZE_REST = 160;
  let lastResize = 0;
  function maybeCommit(now: number, busy: boolean) {
    if (committed === L) return;
    if (now - lastResize < RESIZE_REST && L.m.compact === committed.m.compact) {
      let drift = 0;
      for (const t of tiles) drift = Math.max(drift, Math.abs(t.L.w / t.A.w - 1));
      if (drift > 0.35) commit(now);
      else window.setTimeout(kick, RESIZE_REST + 10);
      return;
    }
    if (!busy || L.m.compact !== committed.m.compact) return commit(now);
    // In motion: only when a box has drifted far from its real size, or a
    // little but a while ago (a pinch re-renders a few times, not 60/s).
    let drift = 0;
    for (const t of tiles) drift = Math.max(drift, Math.abs(t.L.w / t.A.w - 1), Math.abs(t.L.h / t.A.h - 1));
    const zooming = gesture.active || !!glide;
    if (drift > 0.15 || (zooming && drift > 0.03 && now - lastCommit > 120)) commit(now);
  }

  // The drawings' ambient loops hold still while tiles move (each loop would
  // otherwise re-render its moving layer every frame).
  let movingOff = 0;
  function setMoving(on: boolean) {
    if (on) {
      window.clearTimeout(movingOff);
      movingOff = 0;
      if (!grid.classList.contains('is-moving')) grid.classList.add('is-moving');
    } else if (grid.classList.contains('is-moving') && !movingOff) {
      movingOff = window.setTimeout(() => {
        movingOff = 0;
        grid.classList.remove('is-moving');
      }, 160);
    }
  }

  // -------------------------------------------------------------- layout
  interface Anchor {
    t: Tile;
    fy: number;
    clientY: number;
  }

  /** The tile under a viewport point (or the nearest one), as a zoom anchor. */
  function anchorAt(cx: number, cy: number): Anchor | undefined {
    const g = gridBox();
    const px = cx - g.left;
    const py = cy - g.top;
    let best: Tile | undefined;
    let bd = Infinity;
    for (const t of tiles) {
      const h = (t.L.h * t.w) / t.L.w;
      const dx = Math.max(t.x - px, 0, px - (t.x + t.w));
      const dy = Math.max(t.y - py, 0, py - (t.y + h));
      const d = dx * dx + dy * dy * 4;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    if (!best) return;
    const h = (best.L.h * best.w) / best.L.w;
    return { t: best, fy: Math.min(Math.max((py - best.y) / h, 0), 1), clientY: cy };
  }

  const centerAnchor = () => {
    const g = gridBox();
    const cy = Math.min(Math.max(innerHeight / 2, g.top), g.bottom);
    return anchorAt(innerWidth / 2, cy);
  };

  function relayout(opts: { anchor?: Anchor; instant?: boolean; snap?: boolean } = {}) {
    const vw = innerWidth;
    const W = gW;
    const before = scrollY;
    L = core.layout(
      tiles.map((t) => t.r),
      W,
      core.target(vw) * z,
      innerHeight,
    );
    // Only the page height now (so the anchor can scroll); the tiles' real
    // boxes follow in commit().
    if (grid.style.height !== `${L.height}px`) grid.style.height = `${L.height}px`;
    tiles.forEach((t, i) => {
      t.L = L.rects[i];
      if (opts.instant || opts.snap) {
        t.x = t.L.x;
        t.y = t.L.y;
        t.w = t.L.w;
        t.vx = t.vy = t.vw = 0;
      }
    });
    const a = opts.anchor;
    if (a) {
      // Keep the anchored drawing's point where it was on screen: rows
      // re-pack around it, not from the top.
      const py = gridBox().top + a.t.L.y + a.fy * a.t.L.h;
      const d = py - a.clientY;
      if (Math.abs(d) > 0.5) window.scrollTo({ top: before + d, behavior: 'instant' });
      const moved = scrollY - before;
      // The page moved under the tiles; hold them still on screen and let
      // the springs carry them the rest of the way.
      if (moved && !opts.instant && !opts.snap) for (const t of tiles) t.y += moved;
    }
    for (const t of tiles) t.still = false;
    if (opts.instant) commit();
    kick();
  }

  // ----------------------------------------------------------------- zoom
  const lo = () => Math.log(zr.min);
  const hi = () => Math.log(zr.max);
  /** Past a limit the zoom stretches a little, then springs back. */
  const band = (l: number) => {
    const c = 0.22;
    if (l > hi()) return hi() + c * (1 - 1 / ((l - hi()) / c + 1));
    if (l < lo()) return lo() - c * (1 - 1 / ((lo() - l) / c + 1));
    return l;
  };

  let saveTimer = 0;
  function setZoom(l: number, anchor?: Anchor, instant = false, force = false) {
    lz = l;
    const nz = Math.exp(band(lz));
    if (Math.abs(nz - z) < (force ? 1e-9 : 1e-4)) return;
    z = nz;
    relayout({ anchor, instant });
    syncSlider();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => store(core.ZOOM_KEY, Math.exp(Math.min(Math.max(lz, lo()), hi())).toFixed(4)), 300);
  }

  // A continuous gesture (pinch on a trackpad or touch screen, Safari's
  // gesture events) feeds `pending`; its end hands over to momentum and/or
  // the spring back from the rubber band.
  const gesture = {
    active: false,
    anchor: undefined as Anchor | undefined,
    pending: 0,
    v: 0,
    t: 0,
    end: 0,
  };
  let glide: { v: number; back: boolean; vb: number } | null = null;

  function feed(dl: number, anchorFn: () => Anchor | undefined) {
    if (!gesture.active) {
      gesture.active = true;
      gesture.anchor = anchorFn();
      gesture.v = 0;
      glide = null;
    }
    // Resistance past the limits: the further out, the less each step counts.
    const out = lz > hi() ? lz - hi() : lz < lo() ? lo() - lz : 0;
    const resist = out && Math.sign(dl) === Math.sign(lz - (lz > hi() ? hi() : lo())) ? 1 / (1 + out * 6) : 1;
    gesture.pending += dl * resist;
    const now = performance.now();
    const dt = Math.max(8, now - (gesture.t || now - 16)) / 1000;
    gesture.v = 0.6 * gesture.v + 0.4 * (dl / dt);
    gesture.t = now;
    window.clearTimeout(gesture.end);
    gesture.end = window.setTimeout(endGesture, 80);
    kick();
  }

  function endGesture() {
    gesture.active = false;
    gesture.t = 0;
    const v = Math.abs(gesture.v) > 0.6 ? Math.max(-6, Math.min(6, gesture.v)) : 0;
    glide = { v, back: false, vb: 0 };
    kick();
  }

  /** Per frame: apply pending gesture input, glide, spring back. */
  function zoomTick(dt: number): boolean {
    if (gesture.pending) {
      const p = gesture.pending;
      gesture.pending = 0;
      setZoom(lz + p, gesture.anchor);
    }
    if (gesture.active) return true;
    if (!glide) return false;
    const g = glide;
    let l = lz;
    if (!g.back && g.v) {
      l += g.v * dt;
      g.v *= Math.exp(-dt * 9);
      if (Math.abs(g.v) < 0.05) g.v = 0;
      if (l > hi() || l < lo()) {
        // Momentum runs into the limit: stretch, and let the spring win.
        g.v *= Math.exp(-dt * 30);
      }
    }
    const bound = l > hi() ? hi() : l < lo() ? lo() : null;
    if (bound != null && Math.abs(g.v) < 0.4) {
      g.back = true;
      g.vb += (K_ZOOM * (bound - l) - C_ZOOM * g.vb) * dt;
      l += g.vb * dt;
      if (Math.abs(bound - l) < 0.002 && Math.abs(g.vb) < 0.01) l = bound;
    }
    const done = !g.v && (bound == null || l === bound);
    setZoom(l, gesture.anchor, false, done);
    if (done) glide = null;
    return !done;
  }

  // The canvas: the grid, its gutters and the blank page around it. Pinch
  // and ⌘± belong to the gallery while the grid is on screen (zoomed out it
  // can be shorter than the window); above it, they are the browser's.
  const page = grid.closest<HTMLElement>('.g-page') ?? grid;
  const overGrid = (_cx: number, cy: number) => {
    const g = gridBox();
    return g.bottom > 0 && g.top < innerHeight && cy >= Math.min(g.top, innerHeight * 0.5) - 24;
  };

  // Trackpad pinch (Chrome, Firefox, Edge): wheel with ctrlKey. Over the
  // grid only, so the browser's own zoom still works on the rest of the page.
  window.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey || ql || !overGrid(e.clientX, e.clientY)) return;
      e.preventDefault();
      const d = Math.max(-60, Math.min(60, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
      feed(-d * 0.011, () => anchorAt(e.clientX, e.clientY));
    },
    { passive: false },
  );

  // Safari: gesture events carry the pinch scale.
  let g0 = 0;
  let gs = 1;
  const onGesture = (e: Event & { scale?: number; clientX?: number; clientY?: number }) => {
    if (ql) return;
    const cx = e.clientX ?? innerWidth / 2;
    const cy = e.clientY ?? innerHeight / 2;
    if (e.type === 'gesturestart') {
      if (!overGrid(cx, cy)) return;
      g0 = 1;
      gs = 1;
    }
    if (!g0) return;
    e.preventDefault();
    if (e.type === 'gestureend') {
      g0 = 0;
      return;
    }
    const s = e.scale ?? 1;
    feed(Math.log(s / gs), () => anchorAt(cx, cy));
    gs = s;
  };
  for (const type of ['gesturestart', 'gesturechange', 'gestureend'])
    window.addEventListener(type, onGesture as EventListener, { passive: false });

  /** Discrete steps (keys, buttons): one re-layout, the springs do the rest. */
  const STEP = Math.log(1.45);
  let lastPointer: { x: number; y: number } | null = null;
  const keyAnchor = () => {
    const f = focusedTile();
    if (lastPointer && overGrid(lastPointer.x, lastPointer.y)) return anchorAt(lastPointer.x, lastPointer.y);
    if (f) {
      const r = f.hit.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) return anchorAt(r.left + r.width / 2, r.top + r.height / 2);
    }
    return centerAnchor();
  };
  const zoomBy = (d: number) => {
    glide = null;
    setZoom(Math.min(Math.max(Math.log(z) + d, lo()), hi()), keyAnchor());
  };

  // -------------------------------------------------------- dock (slider)
  const dock = document.querySelector<HTMLElement>('[data-g-dock]');
  const slider = dock?.querySelector<HTMLInputElement>('[data-zoom]');
  const resetBtn = dock?.querySelector<HTMLButtonElement>('[data-reset]');
  function syncSlider() {
    if (!slider) return;
    const l = Math.min(Math.max(Math.log(z), lo()), hi());
    slider.value = String(Math.round(((l - lo()) / (hi() - lo())) * 1000));
    slider.setAttribute('aria-valuetext', `${Math.round(z * 100)}%`);
  }
  if (dock && slider) {
    dock.hidden = false;
    syncSlider();
    slider.addEventListener('input', () => {
      glide = null;
      setZoom(lo() + ((hi() - lo()) * Number(slider.value)) / 1000, centerAnchor());
    });
    dock.querySelector('[data-zoom-out]')?.addEventListener('click', () => zoomBy(-STEP));
    dock.querySelector('[data-zoom-in]')?.addEventListener('click', () => zoomBy(STEP));
    resetBtn?.addEventListener('click', () => {
      const by = new Map(tiles.map((t) => [t.slug, t]));
      tiles = defaultOrder.map((s) => by.get(s)!).filter(Boolean);
      commitOrder();
      store(core.ORDER_KEY, null);
      relayout();
      say('Original order restored.');
    });
    // Shown while the grid is on screen.
    new IntersectionObserver(([e]) => dock.classList.toggle('is-shown', e.isIntersecting), {
      rootMargin: '0px 0px -40px 0px',
    }).observe(grid);
  }
  const syncReset = () => {
    const custom = tiles.some((t, i) => t.slug !== defaultOrder[i]);
    if (resetBtn) resetBtn.hidden = !custom;
    dock?.classList.toggle('has-reset', custom);
  };
  syncReset();
  document.querySelector('[data-g-hint]')?.removeAttribute('hidden');

  // ------------------------------------------------------------ selection
  const sel = new Set<Tile>();
  let selAnchor: Tile | null = null;
  function setSel(list: Iterable<Tile>, announce = false) {
    const next = new Set(list);
    for (const t of tiles) t.el.classList.toggle('is-selected', next.has(t));
    sel.clear();
    next.forEach((t) => sel.add(t));
    if (announce) say(sel.size ? `${sel.size} selected.` : 'Selection cleared.');
  }

  // Roving focus over the tiles' hit buttons, in the current order.
  let focusIdx = 0;
  const focusedTile = () => (grid.contains(document.activeElement) ? tiles[focusIdx] : undefined);
  function focusTile(t: Tile, scroll = true) {
    focusIdx = tiles.indexOf(t);
    for (const u of tiles) u.hit.tabIndex = u === t ? 0 : -1;
    t.hit.focus({ preventScroll: true });
    if (scroll) {
      const r = t.hit.getBoundingClientRect();
      const top = 72;
      if (r.top < top || r.bottom > innerHeight - 64)
        window.scrollTo({
          top: scrollY + r.top - Math.max(top, (innerHeight - r.height) / 2),
          behavior: 'smooth',
        });
    }
  }
  grid.addEventListener('focusin', (e) => {
    const t = tileOf(e.target);
    if (t && e.target === t.hit) {
      focusIdx = tiles.indexOf(t);
      for (const u of tiles) u.hit.tabIndex = u === t ? 0 : -1;
    }
  });

  function clickSelect(t: Tile, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) {
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(sel);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      setSel(next);
      selAnchor = t;
    } else if (e.shiftKey && selAnchor) {
      const a = tiles.indexOf(selAnchor);
      const b = tiles.indexOf(t);
      setSel(tiles.slice(Math.min(a, b), Math.max(a, b) + 1));
    } else {
      setSel([t]);
      selAnchor = t;
    }
  }

  // ------------------------------------------------- pointer: press, drag
  interface Press {
    t?: Tile;
    id: number;
    x: number;
    y: number;
    type: string;
    mods: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean };
    timer: number;
    moved: boolean;
    at: number;
  }
  let press: Press | null = null;
  interface Drag {
    group: Tile[];
    gx: number; // grab offset inside the primary tile, px
    gy: number;
    cx: number;
    cy: number;
    lastSwap: number;
  }
  let drag: Drag | null = null;
  interface Marquee {
    sx: number; // grid coords
    sy: number;
    cx: number;
    cy: number;
    base: Set<Tile>;
    box: HTMLElement;
  }
  let marquee: Marquee | null = null;
  let hover: Tile | undefined;

  // Touch pinch.
  const touches = new Map<number, { x: number; y: number }>();
  let pinch: { d0: number; l0: number; applied: number } | null = null;

  const dist = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  page.addEventListener('pointerdown', (e) => {
    const target = e.target as Element;
    if (ql) return;
    // Blank canvas only: the grid, or the page itself (gutters, the space
    // between the header and the grid); never text, links or the dock.
    if (target !== page && !grid.contains(target)) return;
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        cancelPress();
        if (drag) drop();
        pinch = { d0: dist(), l0: lz, applied: 0 };
        const [a, b] = [...touches.values()];
        gesture.active = false;
        feed(0, () => anchorAt((a.x + b.x) / 2, (a.y + b.y) / 2));
        return;
      }
    }
    if (e.button !== 0 || target.closest('.fig-toggle')) return;
    const t = tileOf(target);
    if (!t && e.pointerType === 'touch') return;
    if (!t) {
      // Marquee on the empty canvas between and around the tiles.
      e.preventDefault();
      const g = gridBox();
      const box = document.createElement('div');
      box.className = 'g-marquee';
      grid.append(box);
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      marquee = {
        sx: e.clientX - g.left,
        sy: e.clientY - g.top,
        cx: e.clientX,
        cy: e.clientY,
        base: additive ? new Set(sel) : new Set(),
        box,
      };
      if (!additive) setSel([]);
      grid.setPointerCapture(e.pointerId);
      return;
    }
    press = {
      t,
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      type: e.pointerType,
      mods: { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey },
      timer: 0,
      moved: false,
      at: performance.now(),
    };
    if (e.pointerType === 'touch') {
      // Long-press lifts; a short tap opens Quick Look.
      t.el.classList.add('is-pressing');
      press.timer = window.setTimeout(() => {
        if (!press || press.moved) return;
        navigator.vibrate?.(8);
        press.t?.el.classList.remove('is-pressing');
        startDrag(press);
      }, 380);
    } else {
      grid.setPointerCapture(e.pointerId);
    }
  });

  function cancelPress() {
    if (press?.timer) window.clearTimeout(press.timer);
    press?.t?.el.classList.remove('is-pressing');
    press = null;
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
        lastPointer = { x: e.clientX, y: e.clientY };
        hover = grid.contains(e.target as Node) ? tileOf(e.target) : undefined;
      }
    },
    { passive: true },
  );

  grid.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) {
        const target = Math.log(dist() / pinch.d0);
        feed(target - pinch.applied, () => gesture.anchor);
        pinch.applied = target;
        return;
      }
    }
    if (marquee) {
      marquee.cx = e.clientX;
      marquee.cy = e.clientY;
      updateMarquee();
      return;
    }
    if (drag) {
      drag.cx = e.clientX;
      drag.cy = e.clientY;
      updateDrag();
      return;
    }
    if (press && e.pointerId === press.id) {
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      if (press.type === 'touch') {
        if (moved > 8) {
          press.moved = true;
          cancelPress();
        }
      } else if (moved > 4) {
        startDrag(press);
        // startDrag set it; TS still has it narrowed to null from above.
        const started = drag as Drag | null;
        if (started) {
          started.cx = e.clientX;
          started.cy = e.clientY;
          updateDrag();
        }
      }
    }
  });

  const endPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      touches.delete(e.pointerId);
      if (pinch) {
        if (touches.size < 2) {
          pinch = null;
          window.clearTimeout(gesture.end);
          endGesture();
        }
        return;
      }
    }
    if (marquee) {
      marquee.box.remove();
      if (sel.size) say(`${sel.size} selected.`);
      marquee = null;
      return;
    }
    if (drag) {
      drop();
      cancelPress();
      return;
    }
    if (press && e.pointerId === press.id && e.type === 'pointerup') {
      const p = press;
      cancelPress();
      if (p.t) {
        if (p.type === 'touch') {
          if (!p.moved && performance.now() - p.at < 380) openQL(p.t, true);
        } else {
          clickSelect(p.t, p.mods);
          focusTile(p.t, false);
        }
      }
    }
    cancelPress();
  };
  grid.addEventListener('pointerup', endPointer);
  grid.addEventListener('pointercancel', endPointer);

  // While a touch drag is on, the finger moves the tile, not the page.
  grid.addEventListener(
    'touchmove',
    (e) => {
      if (drag || pinch) e.preventDefault();
    },
    { passive: false },
  );

  // Double-click is Space: it opens the drawing in Quick Look.
  // The tile drawn under a viewport point (its visual box, springs included).
  // Needed because a pressed pointer is captured by the grid, so click and
  // dblclick events target the grid, not the tile.
  function tileAt(cx: number, cy: number): Tile | undefined {
    const g = gridBox();
    const px = cx - g.left;
    const py = cy - g.top;
    for (const t of tiles) {
      const h = (t.L.h * t.w) / t.L.w;
      if (px >= t.x && px <= t.x + t.w && py >= t.y && py <= t.y + h) return t;
    }
  }
  grid.addEventListener('dblclick', (e) => {
    const t = tileOf(e.target) ?? tileAt(e.clientX, e.clientY);
    if (!t || (e.target as Element).closest('.fig-toggle') || ql || drag) return;
    e.preventDefault();
    openQL(t);
  });

  function updateMarquee() {
    const m = marquee!;
    const g = gridBox();
    const px = Math.min(Math.max(m.cx - g.left, 0), g.width);
    const py = Math.min(Math.max(m.cy - g.top, -8), g.height + 8);
    const x = Math.min(m.sx, px);
    const y = Math.min(m.sy, py);
    const w = Math.abs(px - m.sx);
    const h = Math.abs(py - m.sy);
    Object.assign(m.box.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    const next = new Set(m.base);
    for (const t of tiles) {
      const r = t.L;
      const ah = r.ah + L.m.pt + L.m.pb;
      if (r.x < x + w && r.x + r.w > x && r.y < y + h && r.y + ah > y) next.add(t);
    }
    if (next.size !== sel.size || [...next].some((t) => !sel.has(t))) setSel(next);
    edgeScroll(m.cy);
  }

  function startDrag(p: Press) {
    const t = p.t!;
    if (!sel.has(t)) {
      setSel([t]);
      selAnchor = t;
    }
    const group = tiles.filter((u) => sel.has(u));
    const g = gridBox();
    drag = {
      group,
      gx: p.x - (g.left + t.x),
      gy: p.y - (g.top + t.y),
      cx: p.x,
      cy: p.y,
      lastSwap: 0,
    };
    // The primary rides on top; the rest of the group stacks under it.
    group.sort((a, b) => (a === t ? -1 : b === t ? 1 : tiles.indexOf(a) - tiles.indexOf(b)));
    group.forEach((u, i) => {
      u.el.classList.add('is-lifted');
      u.el.style.zIndex = String(50 - i);
    });
    if (group.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'g-count num';
      badge.textContent = String(group.length);
      badge.setAttribute('aria-hidden', 'true');
      t.el.append(badge);
    }
    grid.classList.add('is-dragging');
    cancelPress();
    updateDrag();
    say(`Lifted ${group.length === 1 ? t.title : `${group.length} figures`}. Move, then release to drop.`);
  }

  function updateDrag() {
    const d = drag!;
    const g = gridBox();
    const px = d.cx - g.left;
    const py = d.cy - g.top;
    // The group rides as a small deck: the grabbed tile on top, the rest
    // behind it at the same height, each a step smaller and lower.
    const lift = 1.03;
    const p0 = d.group[0];
    const box = (u: Tile) => u.L.ah + L.m.pt + L.m.pb;
    const x0 = px - d.gx - (p0.L.w * (lift - 1)) / 2;
    const y0 = py - d.gy - (box(p0) * (lift - 1)) / 2;
    d.group.forEach((u, i) => {
      const k = i === 0 ? lift : (box(p0) / box(u)) * lift * (1 - 0.06 * Math.min(i, 3));
      u.tw = u.L.w * k;
      u.tx = x0 + Math.min(i, 3) * 10;
      u.ty = y0 + Math.min(i, 3) * 10 + (box(p0) * lift - box(u) * k) / 2;
      u.still = false;
    });
    // Insertion point: before or after the tile under the pointer.
    const now = performance.now();
    if (now - d.lastSwap > 90) {
      const rest = tiles.filter((u) => !d.group.includes(u));
      const m = L.m.gap / 2;
      const over = rest.find((u) => px >= u.L.x - m && px <= u.L.x + u.L.w + m && py >= u.L.y - m && py <= u.L.y + u.L.h + m);
      let idx = -1;
      if (over) {
        const f = (px - over.L.x) / over.L.w;
        if (f < 0.4 || f > 0.6) idx = rest.indexOf(over) + (f > 0.5 ? 1 : 0);
      } else if (py > L.height) idx = rest.length;
      else if (py < 0) idx = 0;
      if (idx >= 0) {
        const keep = [...d.group].sort((a, b) => tiles.indexOf(a) - tiles.indexOf(b));
        const next = [...rest.slice(0, idx), ...keep, ...rest.slice(idx)];
        if (next.some((u, i) => u !== tiles[i])) {
          tiles = next;
          d.lastSwap = now;
          relayout();
        }
      }
    }
    edgeScroll(d.cy);
    kick();
  }

  function drop() {
    const d = drag!;
    drag = null;
    for (const u of d.group) {
      u.tx = u.ty = u.tw = null;
      u.el.classList.remove('is-lifted');
      u.still = false;
      window.setTimeout(() => {
        if (!u.el.classList.contains('is-lifted')) u.el.style.zIndex = '';
      }, 500);
    }
    grid.classList.remove('is-dragging');
    grid.querySelectorAll('.g-count').forEach((b) => b.remove());
    scrollV = 0;
    commitOrder();
    persistOrder();
    relayout();
    const pos = tiles.indexOf(d.group[0]) + 1;
    say(`Dropped at position ${pos} of ${tiles.length}.`);
  }

  /** DOM order follows the visual order (reading order, tab order, tags). */
  function commitOrder() {
    const active = document.activeElement as HTMLElement | null;
    const move = (grid as HTMLElement & { moveBefore?: (n: Node, r: Node | null) => void }).moveBefore;
    for (const t of tiles) {
      if (move) move.call(grid, t.el, null);
      else grid.append(t.el);
    }
    if (active && grid.contains(active) && document.activeElement !== active) active.focus({ preventScroll: true });
    core.renumber(tiles.map((t) => t.el));
    focusIdx = Math.max(0, tiles.findIndex((t) => t.hit.tabIndex === 0));
    syncReset();
  }
  const persistOrder = () => {
    const custom = tiles.some((t, i) => t.slug !== defaultOrder[i]);
    store(core.ORDER_KEY, custom ? JSON.stringify(tiles.map((t) => t.slug)) : null);
  };

  // Auto-scroll while dragging or drawing a marquee near the top or bottom.
  let scrollV = 0;
  function edgeScroll(cy: number) {
    const band = 64;
    const top = 56;
    scrollV = cy < top + band ? -((top + band - cy) / band) * 900 : cy > innerHeight - band ? ((cy - (innerHeight - band)) / band) * 900 : 0;
    if (scrollV) kick();
  }
  function scrollTick(dt: number): boolean {
    if (!scrollV || (!drag && !marquee)) return false;
    const before = scrollY;
    window.scrollBy({ top: scrollV * dt, behavior: 'instant' });
    if (scrollY === before) return false;
    if (drag) updateDrag();
    if (marquee) updateMarquee();
    return true;
  }

  // ------------------------------------------------------------- keyboard
  function rowNeighbour(t: Tile, dir: 1 | -1): Tile | undefined {
    const row = t.L.row + dir;
    const cx = t.L.x + t.L.w / 2;
    let best: Tile | undefined;
    let bd = Infinity;
    for (const u of tiles) {
      if (u.L.row !== row) continue;
      const d = Math.abs(u.L.x + u.L.w / 2 - cx);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  function moveBy(group: Tile[], dir: 1 | -1) {
    const ordered = [...group].sort((a, b) => tiles.indexOf(a) - tiles.indexOf(b));
    const rest = tiles.filter((u) => !group.includes(u));
    const first = tiles.indexOf(ordered[0]);
    const idx = Math.min(Math.max(first + dir, 0), rest.length);
    if (idx === first) return;
    tiles = [...rest.slice(0, idx), ...ordered, ...rest.slice(idx)];
    commitOrder();
    persistOrder();
    relayout();
    say(`Moved to position ${idx + 1} of ${tiles.length}.`);
  }

  grid.addEventListener('keydown', (e) => {
    const t = tileOf(e.target);
    if (!t || e.target !== t.hit) return;
    const i = tiles.indexOf(t);
    let next: Tile | undefined;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (e.altKey) {
          e.preventDefault();
          moveBy(sel.has(t) ? tiles.filter((u) => sel.has(u)) : [t], dir);
          focusTile(t);
          return;
        }
        next = tiles[i + dir];
        break;
      }
      case 'ArrowDown':
      case 'ArrowUp':
        next = rowNeighbour(t, e.key === 'ArrowDown' ? 1 : -1);
        break;
      case 'Home':
        next = tiles[0];
        break;
      case 'End':
        next = tiles[tiles.length - 1];
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        openQL(t);
        return;
      case 'a':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          setSel(tiles, true);
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    if (!next) return;
    if (e.shiftKey) {
      selAnchor ??= t;
      const a = tiles.indexOf(selAnchor);
      const b = tiles.indexOf(next);
      setSel(tiles.slice(Math.min(a, b), Math.max(a, b) + 1));
    } else {
      setSel([next]);
      selAnchor = next;
    }
    focusTile(next);
  });
  // Keyboard activation of a hit button (Enter/Space are handled above; a
  // screen reader's activate arrives as a click with detail 0).
  grid.addEventListener('click', (e) => {
    const t = tileOf(e.target);
    if (t && e.target === t.hit && e.detail === 0) openQL(t);
  });

  const typing = (n: EventTarget | null) =>
    n instanceof HTMLElement && (n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)) && n !== slider;

  document.addEventListener('keydown', (e) => {
    if (ql || typing(e.target) || document.querySelector('dialog[open]')) return;
    const mod = e.metaKey || e.ctrlKey;
    const inGrid = grid.contains(document.activeElement) || overGrid(0, lastPointer?.y ?? innerHeight / 2);
    if ((e.key === '=' || e.key === '+' || e.key === '-' || e.key === '_' || (mod && e.key === '0')) && !e.altKey) {
      // ⌘± zooms the grid while you are on it; elsewhere it is the browser's.
      if (mod && !inGrid) return;
      e.preventDefault();
      if (e.key === '0') {
        glide = null;
        setZoom(0, keyAnchor());
      } else zoomBy(e.key === '-' || e.key === '_' ? -STEP : STEP);
      return;
    }
    if (e.key === ' ' && !mod && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) {
      const t = hover ?? focusedTile() ?? tiles.find((u) => sel.has(u));
      if (t) {
        e.preventDefault();
        openQL(t);
      }
      return;
    }
    if (e.key === 'Escape' && sel.size) setSel([], true);
  });

  // --------------------------------------------------------- Quick Look
  const dialog = document.querySelector<HTMLDialogElement>('[data-ql]');
  const stage = dialog?.querySelector<HTMLElement>('[data-ql-stage]');
  const qlTitle = dialog?.querySelector<HTMLElement>('[data-ql-title]');
  const qlCount = dialog?.querySelector<HTMLElement>('[data-ql-count]');
  const scrim = dialog?.querySelector<HTMLElement>('[data-ql-scrim]');
  const chrome = dialog ? [...dialog.querySelectorAll<HTMLElement>('[data-ql-chrome]')] : [];
  let ql: { t: Tile; closing: boolean; touch?: boolean } | null = null;
  const springEase = () => getComputedStyle(document.documentElement).getPropertyValue('--spring-snappy').trim() || 'ease-out';

  /** Size and place the figure in the stage: as large as fits, centred. */
  function place(t: Tile) {
    const f = t.fig;
    const narrow = innerWidth < 640;
    const side = narrow ? 12 : 88;
    const top = narrow ? 56 : 64;
    const bottom = narrow ? 72 : 40;
    const availW = innerWidth - 2 * side;
    const availH = innerHeight - top - bottom;
    const native = parseFloat(getComputedStyle(f).getPropertyValue('--fig-native')) || 960;
    const pads = narrow ? 24 : 40;
    // Compact (480-wide) art gets the same ceiling as wide art, so it fills the
    // stage instead of stopping at 1.6× its viewBox.
    let w = Math.min(availW, Math.max(native, 960) * 1.6 + pads, (availH - 120) * t.r + pads);
    w = Math.max(w, Math.min(availW, 280));
    f.style.width = `${w}px`;
    let h = f.offsetHeight;
    if (h > availH) {
      w = Math.max(200, w - (h - availH) * t.r);
      f.style.width = `${w}px`;
      h = f.offsetHeight;
    }
    f.style.left = `${(innerWidth - w) / 2}px`;
    f.style.top = `${top + Math.max(0, (availH - h) / 2)}px`;
  }

  function put(t: Tile) {
    stage!.append(t.fig);
    t.el.classList.add('is-out');
    place(t);
    const n = tiles.indexOf(t) + 1;
    if (qlTitle) qlTitle.textContent = t.title;
    if (qlCount) qlCount.textContent = `${String(n).padStart(2, '0')} / ${tiles.length}`;
  }

  // While it flies home, the figure takes its tile's exact layout (width, the
  // grid's padding and radius, tag and toggle positions, the two-line caption,
  // thumbnail mode), so the last frame of the flight is the tile itself.
  const TILE_VARS = ['--g-px', '--g-pt', '--g-pb', '--g-radius'];
  function toTileLayout(t: Tile) {
    const f = t.fig;
    const gs = getComputedStyle(grid);
    for (const k of TILE_VARS) f.style.setProperty(k, gs.getPropertyValue(k).trim());
    f.classList.add('ql-landing');
    f.classList.toggle('is-compact', grid.hasAttribute('data-compact'));
    f.style.width = `${t.el.offsetWidth}px`;
  }

  function giveBack(t: Tile) {
    const f = t.fig;
    f.getAnimations().forEach((a) => a.cancel());
    f.querySelectorAll<HTMLElement>('figcaption, .fig-tag, .fig-toggle').forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    f.style.removeProperty('width');
    f.style.removeProperty('left');
    f.style.removeProperty('top');
    f.style.removeProperty('transform');
    for (const k of TILE_VARS) f.style.removeProperty(k);
    f.classList.remove('ql-landing', 'is-compact');
    t.el.append(f);
    t.el.classList.remove('is-out');
  }

  const artOf = (f: HTMLElement) => (f.querySelector('.fig-art') ?? f).getBoundingClientRect();

  function openQL(t: Tile, byTouch = false) {
    if (!dialog || !stage || ql) return;
    if (drag) return;
    const from = t.hit.getBoundingClientRect();
    ql = { t, closing: false, touch: byTouch };
    setSel([t]);
    selAnchor = t;
    focusIdx = tiles.indexOf(t);
    dialog.showModal();
    document.documentElement.classList.add('ql-open');
    put(t);
    // A finger gets no focus ring on Done; the keyboard still lands there.
    if (byTouch) dialog.focus({ preventScroll: true });
    else dialog.querySelector<HTMLElement>('[data-ql-close]')?.focus({ preventScroll: true });
    resetView();
    const to = artOf(t.fig);
    const s = from.width / to.width;
    t.fig.animate(
      [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${s})` }, { transform: 'none' }],
      { duration: 460, easing: springEase() },
    );
    t.fig.querySelector('figcaption')?.animate({ opacity: [0, 0, 1] }, { duration: 300, easing: 'ease-out' });
    scrim?.animate({ opacity: [0, 1] }, { duration: 180, easing: 'ease-out' });
    chrome.forEach((c) => c.animate({ opacity: [0, 1] }, { duration: 180, delay: 80, easing: 'ease-out', fill: 'backwards' }));
  }

  function closeQL() {
    if (!dialog || !ql || ql.closing) return;
    const q = ql;
    q.closing = true;
    const t = q.t;
    const finish = () => {
      giveBack(t);
      dialog.close();
      document.documentElement.classList.remove('ql-open');
      ql = null;
      // A finger leaves no selection behind (as Photos); a keyboard or mouse
      // comes back to the drawing it opened.
      if (q.touch) {
        setSel([]);
        (document.activeElement as HTMLElement | null)?.blur();
      } else focusTile(t, false);
    };
    // Bring the tile on screen first, so the figure has somewhere to land.
    let r = t.el.getBoundingClientRect();
    if (r.bottom < 64 || r.top > innerHeight - 40) {
      window.scrollTo({ top: scrollY + r.top - Math.max(72, (innerHeight - r.height) / 2), behavior: 'instant' });
      r = t.el.getBoundingClientRect();
    }
    // FLIP into the tile, exact at both ends. The figure switches to its
    // tile's layout; a transform makes it look as large as it is now, and the
    // spacing that does not scale (padding, radius, tag, toggle) starts at the
    // large view's values over that scale. Everything then runs to the tile's
    // own values, so the last frame is the tile and handing it back changes
    // nothing on screen.
    const f = t.fig;
    stopView();
    f.getAnimations().forEach((x) => x.cancel());
    const big = artOf(f);
    // A swipe or a pinch left the figure moved; the flight starts from there.
    f.style.removeProperty('transform');
    const fs = getComputedStyle(f);
    const from = Object.fromEntries(TILE_VARS.map((k) => [k, parseFloat(fs.getPropertyValue(k)) || 0]));
    const tag = f.querySelector<HTMLElement>('.fig-tag');
    const tog = f.querySelector<HTMLElement>('.fig-toggle');
    const pos = (el: HTMLElement | null) => {
      if (!el) return null;
      const c = getComputedStyle(el);
      return { top: parseFloat(c.top), left: parseFloat(c.left), right: parseFloat(c.right) };
    };
    const tag0 = pos(tag);
    const tog0 = pos(tog);
    toTileLayout(t);
    const box = f.getBoundingClientRect();
    const s0 = big.width / f.offsetWidth;
    const to = Object.fromEntries(TILE_VARS.map((k) => [k, parseFloat(f.style.getPropertyValue(k)) || 0]));
    const tag1 = pos(tag);
    const tog1 = pos(tog);
    const dest = t.el.getBoundingClientRect();
    const ease = getComputedStyle(document.documentElement).getPropertyValue('--spring-quick').trim() || 'ease-out';
    const timing: KeyframeAnimationOptions = { duration: 420, easing: ease, fill: 'forwards' };
    const px = (v: number) => `${v}px`;
    const a = f.animate(
      [
        {
          transform: `translate(${big.left - box.left}px, ${big.top - box.top}px) scale(${s0})`,
          ...Object.fromEntries(TILE_VARS.map((k) => [k, px(from[k] / s0)])),
        },
        {
          transform: `translate(${dest.left - box.left}px, ${dest.top - box.top}px)`,
          ...Object.fromEntries(TILE_VARS.map((k) => [k, px(to[k])])),
        },
      ],
      timing,
    );
    if (tag && tag0 && tag1)
      tag.animate(
        [
          { top: px(tag0.top / s0), left: px(tag0.left / s0), scale: String(1 / s0), transformOrigin: '0 0' },
          { top: px(tag1.top), left: px(tag1.left), scale: '1', transformOrigin: '0 0' },
        ],
        timing,
      );
    if (tog && tog0 && tog1)
      tog.animate(
        [
          { top: px(tog0.top / s0), right: px(tog0.right / s0), scale: String(1 / s0), transformOrigin: '100% 0' },
          { top: px(tog1.top), right: px(tog1.right), scale: '1', transformOrigin: '100% 0' },
        ],
        timing,
      );
    // The full caption leaves at once; the tile's two lines arrive with it.
    f.querySelector('figcaption')?.animate({ opacity: [0, 0, 1] }, { duration: 420, easing: 'ease-out', fill: 'forwards' });
    const fade = (el: HTMLElement | undefined | null, ms: number) => {
      if (!el) return;
      const o = parseFloat(getComputedStyle(el).opacity);
      el.style.removeProperty('opacity');
      el.animate({ opacity: [o, 0] }, { duration: ms, easing: 'ease-out', fill: 'forwards' });
    };
    fade(scrim, 260);
    chrome.forEach((c) => fade(c, 120));
    a.finished.then(() => {
      scrim?.getAnimations().forEach((x) => x.cancel());
      chrome.forEach((c) => c.getAnimations().forEach((x) => x.cancel()));
      finish();
    }, finish);
  }

  function navQL(dir: 1 | -1, swiped = false) {
    if (!ql || ql.closing) return;
    stopView();
    const prev = ql.t;
    const next = tiles[(tiles.indexOf(prev) + dir + tiles.length) % tiles.length];
    giveBack(prev);
    ql.t = next;
    put(next);
    setSel([next]);
    selAnchor = next;
    focusIdx = tiles.indexOf(next);
    for (const u of tiles) u.hit.tabIndex = u === next ? 0 : -1;
    resetView();
    next.fig.animate(
      swiped
        ? [
            { opacity: 0.4, transform: `translateX(${dir * Math.min(innerWidth * 0.5, 320)}px)` },
            { opacity: 1, transform: 'none' },
          ]
        : [
            { opacity: 0, transform: `translateX(${dir * 24}px)` },
            { opacity: 1, transform: 'none' },
          ],
      { duration: swiped ? 420 : 220, easing: swiped ? springEase() : 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  }

  // ------------------------------------------------- Quick Look, by finger
  // The drawing in Quick Look follows the finger the way a photo does on an
  // iPhone: it pages sideways under the finger, comes down with it to close,
  // pinches to zoom about the fingers, pans when zoomed, and a double tap
  // zooms to where it landed. Every release hands the finger's velocity to a
  // spring (critically damped, ~0.35 s), whose target is chosen from where
  // the motion was going (momentum projected), not where it stopped; a new
  // touch catches the drawing wherever it is. Transform and opacity only.
  const view = { tx: 0, ty: 0, s: 1, vx: 0, vy: 0, vs: 0 };
  const goal = { tx: 0, ty: 0, s: 1 };
  let viewRaf = 0;
  let viewDone: (() => void) | null = null;
  let response = 0.35;
  let dismiss = 0; // 0–1: how far a pull down has gone toward closing

  const MAX_ZOOM = 4;
  const project = (v: number, d = 0.998) => ((v / 1000) * d) / (1 - d);
  const rubber = (over: number, dim: number) => (over * dim * 0.55) / (dim + 0.55 * Math.abs(over));

  function paintView() {
    const f = ql?.t.fig;
    if (!f) return;
    const still = view.tx === 0 && view.ty === 0 && view.s === 1;
    if (still) f.style.removeProperty('transform');
    else f.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
    const o = 1 - Math.min(1, dismiss) * 0.95;
    if (scrim) scrim.style.opacity = dismiss ? String(o) : '';
    for (const c of chrome) c.style.opacity = dismiss ? String(Math.max(0, 1 - dismiss * 2.5)) : '';
    // Zoomed in, the bar becomes a glass strip over the drawing and the
    // arrows step aside (a finger pans now; paging waits for 1x).
    dialog?.classList.toggle('is-zoomed', view.s > 1.02);
  }

  function stopView() {
    if (viewRaf) cancelAnimationFrame(viewRaf);
    viewRaf = 0;
    viewDone = null;
  }

  function resetView() {
    stopView();
    Object.assign(view, { tx: 0, ty: 0, s: 1, vx: 0, vy: 0, vs: 0 });
    Object.assign(goal, { tx: 0, ty: 0, s: 1 });
    dismiss = 0;
    if (scrim) scrim.style.removeProperty('opacity');
    for (const c of chrome) c.style.removeProperty('opacity');
  }

  /** Spring the view to `to` from where it is, at the velocity it has. */
  function springView(to: Partial<typeof goal>, opts: { response?: number; done?: () => void } = {}) {
    Object.assign(goal, to);
    response = opts.response ?? 0.35;
    viewDone = opts.done ?? null;
    if (viewRaf) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.064, (now - last) / 1000);
      last = now;
      const k = (2 * Math.PI) / response;
      const stiff = k * k;
      const damp = 2 * k; // damping ratio 1
      const n = 4;
      for (let i = 0; i < n; i++) {
        const h = dt / n;
        view.vx += (-stiff * (view.tx - goal.tx) - damp * view.vx) * h;
        view.vy += (-stiff * (view.ty - goal.ty) - damp * view.vy) * h;
        view.vs += (-stiff * (view.s - goal.s) - damp * view.vs) * h;
        view.tx += view.vx * h;
        view.ty += view.vy * h;
        view.s += view.vs * h;
      }
      // The pull-down fade follows the drawing home.
      if (dismiss) dismiss = Math.max(0, Math.min(1, view.ty / (innerHeight * 0.35)));
      const settled =
        Math.abs(view.tx - goal.tx) < 0.3 &&
        Math.abs(view.ty - goal.ty) < 0.3 &&
        Math.abs(view.s - goal.s) < 0.001 &&
        Math.abs(view.vx) + Math.abs(view.vy) < 8 &&
        Math.abs(view.vs) < 0.01;
      if (settled) {
        view.tx = goal.tx;
        view.ty = goal.ty;
        view.s = goal.s;
        view.vx = view.vy = view.vs = 0;
        if (goal.ty === 0) dismiss = 0;
      }
      paintView();
      if (settled) {
        viewRaf = 0;
        const d = viewDone;
        viewDone = null;
        d?.();
      } else viewRaf = requestAnimationFrame(step);
    };
    viewRaf = requestAnimationFrame(step);
  }

  /** The figure's box as placed (no gesture transform), in viewport px. */
  function baseBox() {
    const f = ql!.t.fig;
    return {
      left: f.offsetLeft,
      top: f.offsetTop,
      w: f.offsetWidth,
      h: f.offsetHeight,
    };
  }

  /** Where a zoomed drawing may rest: filling the screen where it is larger
   *  than the screen, centred on its own centre where it is not. */
  function clampPan(tx: number, ty: number, sc: number) {
    const b = baseBox();
    const fit = (t: number, size: number, start: number, vp: number) => {
      const vis = size * sc;
      if (vis <= vp) return (size - vis) / 2;
      return Math.min(-start, Math.max(vp - start - vis, t));
    };
    return {
      tx: fit(tx, b.w, b.left, innerWidth),
      ty: fit(ty, b.h, b.top, innerHeight),
    };
  }

  /** Scale to `sc` about the viewport point (px, py), from the current view. */
  function zoomAbout(sc: number, px: number, py: number, from = view) {
    const b = baseBox();
    const cx = (px - b.left - from.tx) / from.s;
    const cy = (py - b.top - from.ty) / from.s;
    return { tx: px - b.left - cx * sc, ty: py - b.top - cy * sc };
  }

  if (dialog) {
    type Pt = { x: number; y: number };
    const pts = new Map<number, Pt>();
    let mode: 'none' | 'pending' | 'page' | 'dismiss' | 'pan' | 'pinch' | 'layer' | 'done' = 'none';
    let start: Pt & { t: number; tx: number; ty: number; s: number } = {
      x: 0,
      y: 0,
      t: 0,
      tx: 0,
      ty: 0,
      s: 1,
    };
    let pinch0: {
      d: number;
      mx: number;
      my: number;
      tx: number;
      ty: number;
      s: number;
    } | null = null;
    let hist: { x: number; y: number; t: number }[] = [];
    let lastTap: { x: number; y: number; t: number } | null = null;
    let swallowClick = false;
    let lastPointerTouch = false;

    const mid = () => {
      const [a, b] = [...pts.values()];
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        d: Math.hypot(a.x - b.x, a.y - b.y),
      };
    };
    const velocity = () => {
      const now = performance.now();
      const recent = hist.filter((h) => now - h.t < 90);
      if (recent.length < 2) return { vx: 0, vy: 0 };
      const a = recent[0];
      const b = recent[recent.length - 1];
      const dt = Math.max(16, b.t - a.t) / 1000;
      return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
    };
    const beginPinch = () => {
      const m = mid();
      stopView();
      pinch0 = {
        d: Math.max(1, m.d),
        mx: m.x,
        my: m.y,
        tx: view.tx,
        ty: view.ty,
        s: view.s,
      };
      mode = 'pinch';
      dismiss = 0;
    };

    // Capture phase: the drawing's live layer may capture a finger on its
    // own element, and a second finger must still reach the pinch.
    dialog.addEventListener(
      'pointerdown',
      (e) => {
        lastPointerTouch = e.pointerType === 'touch';
        if (e.pointerType !== 'touch' || !ql || ql.closing) return;
        if ((e.target as Element).closest('button, a')) return;
        // Fingers left over from an earlier gesture (lifted elsewhere) go.
        if (!pts.size) mode = 'none';
        if (mode === 'none') pts.clear();
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
          // Two fingers are always the pinch: the layer lets go of the first.
          for (const id of pts.keys()) {
            for (const el of [e.target as Element, ...dialog.querySelectorAll('*')])
              if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id);
          }
          beginPinch();
          // Keep the layer from taking the second finger.
          e.stopPropagation();
          return;
        }
        if (pts.size > 2) return;
        ql.t.fig.getAnimations().forEach((a) => a.cancel());
        start = {
          x: e.clientX,
          y: e.clientY,
          t: performance.now(),
          tx: view.tx,
          ty: view.ty,
          s: view.s,
        };
        hist = [{ x: e.clientX, y: e.clientY, t: start.t }];
        mode = 'pending';
      },
      true,
    );

    // A press a live drawing took stays the drawing's. Its layer takes a
    // finger by capturing it on its own element; iOS also captures every
    // touch on the element it landed on, so only an explicit capture, made
    // inside the stage, counts.
    const layerTook = new Set<number>();
    const setCapture = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = function (this: Element, id: number) {
      if (stage?.contains(this)) layerTook.add(id);
      return setCapture.call(this, id);
    };
    const layerHolds = (id: number) => layerTook.has(id);

    dialog.addEventListener(
      'pointermove',
      (e) => {
        if (!pts.has(e.pointerId) || !ql || mode === 'layer') return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (mode === 'pending' && pts.size === 1 && layerHolds(e.pointerId)) {
          mode = 'layer';
          return;
        }
        if (mode === 'pinch' && pinch0 && pts.size >= 2) {
          e.stopPropagation();
          const m = mid();
          let sc = pinch0.s * (m.d / pinch0.d);
          // Past the limits the drawing still answers, ever more stiffly.
          if (sc > MAX_ZOOM) sc = MAX_ZOOM + rubber(sc - MAX_ZOOM, MAX_ZOOM);
          if (sc < 1) sc = 1 - rubber(1 - sc, 1) * 0.9;
          const b = baseBox();
          const cx = (pinch0.mx - b.left - pinch0.tx) / pinch0.s;
          const cy = (pinch0.my - b.top - pinch0.ty) / pinch0.s;
          view.s = sc;
          view.tx = m.x - b.left - cx * sc;
          view.ty = m.y - b.top - cy * sc;
          // Pinching in below its size reads as closing: the backdrop thins.
          dismiss = sc < 1 ? Math.min(1, (1 - sc) * 2.2) : 0;
          paintView();
          return;
        }
        if (e.pointerId !== [...pts.keys()][0]) return;
        const now = performance.now();
        hist.push({ x: e.clientX, y: e.clientY, t: now });
        if (hist.length > 8) hist.shift();
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (mode === 'pending') {
          if (Math.hypot(dx, dy) < 10) return;
          swallowClick = true;
          if (start.s > 1.02) mode = 'pan';
          else if (Math.abs(dx) > Math.abs(dy)) mode = 'page';
          else mode = dy > 0 ? 'dismiss' : 'pan';
        }
        if (mode === 'page') {
          view.tx = dx;
          view.ty = 0;
        } else if (mode === 'dismiss') {
          // The drawing comes down under the finger, shrinking a little.
          const p = Math.max(0, dy) / innerHeight;
          const sc = 1 - Math.min(0.35, p * 0.6);
          const z = zoomAbout(sc, start.x, start.y, {
            tx: 0,
            ty: 0,
            s: 1,
            vx: 0,
            vy: 0,
            vs: 0,
          });
          view.s = sc;
          view.tx = z.tx + dx;
          view.ty = z.ty + Math.max(dy, rubber(dy, innerHeight));
          dismiss = Math.min(1, Math.max(0, dy) / (innerHeight * 0.35));
        } else if (mode === 'pan') {
          const want = { tx: start.tx + dx, ty: start.ty + dy };
          const ok = clampPan(want.tx, want.ty, view.s);
          view.tx = ok.tx + rubber(want.tx - ok.tx, innerWidth);
          view.ty = ok.ty + rubber(want.ty - ok.ty, innerHeight);
        }
        paintView();
      },
      true,
    );

    const release = (e: PointerEvent) => {
      layerTook.delete(e.pointerId);
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (!ql || ql.closing) {
        mode = pts.size ? 'done' : 'none';
        return;
      }
      if (mode === 'pinch') {
        if (pts.size >= 2) return;
        // One finger left: the pinch is over (the other finger is ignored).
        mode = pts.size ? 'done' : 'none';
        pinch0 = null;
        if (e.type !== 'pointercancel' && view.s < 0.86) {
          dismiss = 0;
          closeQL();
          return;
        }
        const sc = Math.min(MAX_ZOOM, Math.max(1, view.s));
        const m = { x: e.clientX, y: e.clientY };
        const z = sc === view.s ? { tx: view.tx, ty: view.ty } : zoomAbout(sc, m.x, m.y);
        const rest = sc <= 1.001 ? { tx: 0, ty: 0 } : clampPan(z.tx, z.ty, sc);
        dismiss = 0;
        springView({ ...rest, s: sc });
        return;
      }
      if (pts.size) return;
      const m = mode;
      mode = 'none';
      if (e.type === 'pointercancel') {
        if (m !== 'layer') springView({ tx: 0, ty: 0, s: view.s > 1.02 ? view.s : 1 });
        return;
      }
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const { vx, vy } = velocity();
      if (m === 'pending') {
        // A tap. Two in quick succession zoom in on the spot, or back out.
        const now = performance.now();
        if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
          lastTap = null;
          swallowClick = true;
          if (view.s > 1.05) springView({ tx: 0, ty: 0, s: 1 });
          else {
            const z = zoomAbout(2.5, e.clientX, e.clientY);
            springView({ ...clampPan(z.tx, z.ty, 2.5), s: 2.5 });
          }
        } else lastTap = { x: e.clientX, y: e.clientY, t: now };
        return;
      }
      lastTap = null;
      if (m === 'page') {
        view.vx = vx;
        const land = dx + project(vx, 0.99);
        const dir: 1 | -1 = land < 0 ? 1 : -1;
        if (Math.abs(land) > innerWidth * 0.28 && Math.sign(vx || land) === Math.sign(land)) {
          // Thrown: off it goes at the finger's speed, and the next one follows.
          let handed = false;
          const hand = () => {
            if (handed) return;
            handed = true;
            navQL(dir, true);
          };
          springView({ tx: -dir * innerWidth, ty: 0, s: 1 }, { response: 0.28, done: hand });
          window.setTimeout(hand, 170);
        } else springView({ tx: 0, ty: 0, s: 1 });
        return;
      }
      if (m === 'dismiss') {
        view.vx = vx;
        view.vy = vy;
        if (dy + project(vy, 0.99) > 160 && vy > -200) closeQL();
        else springView({ tx: 0, ty: 0, s: 1 });
        return;
      }
      if (m === 'pan') {
        view.vx = vx;
        view.vy = vy;
        const to = clampPan(view.tx + project(vx, 0.995), view.ty + project(vy, 0.995), view.s);
        springView({ ...to, s: view.s }, { response: 0.55 });
      }
    };
    dialog.addEventListener('pointerup', release, true);
    dialog.addEventListener('pointercancel', release, true);
    // A finger lifted after Quick Look closed under it never reaches the
    // dialog; forget it here, or the next touch would count it as a pinch.
    for (const type of ['pointerup', 'pointercancel'] as const)
      window.addEventListener(type, (e) => {
        if (!dialog.open && pts.delete(e.pointerId) && !pts.size) mode = 'none';
      });

    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeQL();
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        navQL(e.key === 'ArrowRight' ? 1 : -1);
      } else if (e.key === ' ' && !(e.target as Element).closest('.fig-toggle, [data-ql-prev], [data-ql-next]')) {
        e.preventDefault();
        closeQL();
      }
    });
    // Inside, a double-click closes, as Space does (not on the controls).
    dialog.addEventListener('dblclick', (e) => {
      if (lastPointerTouch || (e.target as Element).closest('button, a, .fig-toggle')) return;
      closeQL();
    });
    dialog.querySelector('[data-ql-close]')?.addEventListener('click', closeQL);
    dialog.querySelector('[data-ql-prev]')?.addEventListener('click', () => navQL(-1));
    dialog.querySelector('[data-ql-next]')?.addEventListener('click', () => navQL(1));
    // A click on the empty backdrop closes, like Quick Look.
    dialog.addEventListener('click', (e) => {
      if (swallowClick) {
        swallowClick = false;
        return;
      }
      // A tap is held back a moment on touch, so a double tap can zoom
      // instead of closing.
      if (e.target === dialog || e.target === stage || e.target === scrim) {
        if (!lastPointerTouch) return closeQL();
        const t0 = lastTap?.t;
        window.setTimeout(() => {
          if (lastTap && lastTap.t === t0 && view.s <= 1.02) closeQL();
        }, 330);
      }
    });
  }

  // --------------------------------------------------------------- resize
  let lastW = grid.clientWidth;
  let lastH = innerHeight;
  let rq = 0;
  new ResizeObserver(() => {
    if (rq) return;
    rq = requestAnimationFrame(() => {
      rq = 0;
      measureGrid();
      const W = gW;
      if (W === lastW && Math.abs(innerHeight - lastH) < 80) return;
      lastW = W;
      lastH = innerHeight;
      zr = core.zoomRange(innerWidth, W);
      lz = Math.min(Math.max(lz, lo()), hi());
      z = Math.exp(lz);
      lastResize = performance.now();
      relayout({ anchor: centerAnchor(), snap: true });
      syncSlider();
      if (ql) place(ql.t);
    });
  }).observe(grid);

  // Arriving on /gallery#slug (the palette): bring the drawing into view.
  const hashTile = tiles.find((t) => `#${t.slug}` === decodeURIComponent(location.hash));
  if (hashTile) {
    requestAnimationFrame(() => {
      const r = hashTile.el.getBoundingClientRect();
      window.scrollTo({ top: scrollY + r.top - Math.max(80, (innerHeight - r.height) / 3), behavior: 'instant' });
      setSel([hashTile]);
      selAnchor = hashTile;
      focusIdx = tiles.indexOf(hashTile);
      for (const u of tiles) u.hit.tabIndex = u === hashTile ? 0 : -1;
    });
  }

  // For the captures in .work/gallery (and curious readers in devtools).
  (window as unknown as { __galleryState: unknown }).__galleryState = {
    get z() {
      return z;
    },
    get L() {
      return L;
    },
    get tiles() {
      return tiles;
    },
    get selected() {
      return [...sel].map((t) => t.slug);
    },
    zoomTo: (zz: number) => setZoom(Math.log(zz), centerAnchor()),
  };
}
