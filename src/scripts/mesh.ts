// Equation mesh: a quiet Canvas 2D network of math glyphs with a few
// free-floating equations. Spec: docs/design-system.md section 7.
//
// Each host is an element with [data-mesh] holding one <canvas>. Options come
// from data attributes (see EquationMesh.astro). Glyphs link to each other;
// equations join the same network through a few links each, attached to the
// edge of their box. Nodes steer clear of the page text via a mask of padded
// text rects, no edge crosses it, and everything is drawn in one ink read
// from --mesh-ink.

// Glyphs and equations are typeset in TeX at build time (src/data/equations.ts
// via src/lib/tex.ts, MathJax in Computer Modern) and arrive as JSON in a
// <script type="application/json" data-mesh-tex>. Here they become Path2D
// outlines, drawn into per-node sprites, so the canvas shows real LaTeX
// without any font or math library in the browser.

/** Mirrors MeshTex in src/lib/tex.ts. */
interface TexData {
  q: number;
  d: string[];
  i: { v: [number, number, number, number]; u: number[]; r?: number[] }[];
  g: number[];
  k: (number | number[])[];
  f: (number | number[])[];
  p: number[];
  /** Expandable equations: flat pairs of closed and open item indices. */
  o?: number[];
}

let texData: TexData | null | undefined;
const texPaths: Path2D[] = [];

function readTex(): TexData | null {
  if (texData !== undefined) return texData;
  const el = document.querySelector<HTMLScriptElement>('script[data-mesh-tex]');
  try {
    texData = el?.textContent ? (JSON.parse(el.textContent) as TexData) : null;
  } catch {
    texData = null;
  }
  return texData;
}

const glyphPath = (tex: TexData, gi: number) => (texPaths[gi] ??= new Path2D(tex.d[gi]));

/**
 * Paint formula `idx` with its top-left at (x, y), 1em = `size` px, in the
 * current fill style. Glyph outlines are y-up in font units; the item's
 * positions are y-down with the baseline at 0.
 */
function paintTex(g: CanvasRenderingContext2D, tex: TexData, idx: number, x: number, y: number, size: number) {
  const it = tex.i[idx];
  const k = size / 1000;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.translate(-it.v[0], -it.v[1]);
  const u = it.u;
  for (let j = 0; j < u.length; ) {
    let gi = u[j];
    let s = 1;
    const px = u[j + 1];
    const py = u[j + 2];
    if (gi < 0) {
      gi = -1 - gi;
      s = u[j + 3] / 1000;
      j += 4;
    } else j += 3;
    const a = s * tex.q;
    g.save();
    g.transform(a, 0, 0, -a, px, py);
    g.fill(glyphPath(tex, gi));
    g.restore();
  }
  const r = it.r;
  if (r) for (let j = 0; j < r.length; j += 4) g.fillRect(r[j], r[j + 1], r[j + 2], r[j + 3]);
  g.restore();
}

const K = {
  glyphArea: 26000,
  glyphMin: 18,
  // Large and ultrawide screens keep the laptop density (up to ~2.9 Mpx of
  // viewport); beyond that the field thins out gently.
  glyphMax: 110,
  eqMin: 7,
  /** Glyph em size in px, times U(.8, 1.4). */
  glyphSize: 16.5,
  /** Equation em size range in px. */
  eqSize: [14, 15.5] as const,
  // Computer Modern strokes are finer than the old Geist Mono, so these sit
  // a touch above the spec's .30/.26 for the same visual weight.
  glyphAlpha: 0.34,
  eqAlpha: 0.32,
  speed: 0.25,
  maxSpeed: 0.7,
  wrap: 40,
  link: 140,
  linkAlpha: 0.12,
  /** Equation link reach, measured from the edge of its box. */
  eqLink: 196,
  /** Links per equation, so the math joins the network without a hairball. */
  eqCap: 3,
  /** Distance over which a capped link hands over to the next candidate. */
  eqBand: 24,
  /** Gap between an equation's ink box and where its links attach. */
  attachPad: 6,
  /** Radius of the ink dot where a link meets an equation. */
  port: 1.25,
  cursor: 160,
  cursorAlpha: 0.35,
  maskPad: 16,
  maskFade: 0.08,
  /** Nodes within this distance of a mask rect fade toward haloFade. */
  halo: 56,
  haloFade: 0.4,
  buckets: 12,
  // Expandable equations (closed form <-> open form).
  /** Pointer dwell over an equation's attach box before it opens, ms. */
  dwell: 220,
  /** Time the pointer must stay away before it closes again, ms. */
  linger: 600,
  /** Extra hover tolerance around an open equation, px. */
  lingerPad: 12,
  /** Alpha added to a hovered (or open) equation's ink. */
  hotAlpha: 0.2,
  /** Spring for the open/close morph, per second (zeta about 0.77). */
  stiffness: 170,
  damping: 20,
  /** Clearance kept between an open equation and the viewport edge. */
  edge: 10,
  /** Fade of nodes an opening equation is passing over. */
  coverFade: 0.1,
};

/** Targets that keep their normal hover and tap behaviour. */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"], [contenteditable]';

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface MeshOptions {
  /** Multiplies node counts (after the clamps). Default 1. */
  density?: number;
  /** Elements the nodes avoid. */
  mask?: string;
  /** Cursor lines on fine pointers. Default true. */
  interactive?: boolean;
}

// Text blocks plus the page chrome (header controls, floating buttons such as
// the command-palette trigger), so no glyph sits under a control.
const DEFAULT_MASK = 'h1, p, nav, header a, button, .links, .meta, [data-mesh-mask]';

interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Cruise velocity, eased back to after the mask slows a node down. */
  cx: number;
  cy: number;
  /** Index of the typeset formula in the TeX payload. */
  tex: number;
  /** Em size in px. */
  size: number;
  eq: boolean;
  fade: number;
  /** Radius used to trim link ends so lines stop short of the glyph. */
  r: number;
  sprite?: Sprite;
  /** Current box size: the sprite's, or between the two forms while morphing. */
  w: number;
  h: number;
  /** Expandable equations: the open form's TeX index and sprite. */
  open?: number;
  spriteO?: Sprite;
  /** Morph spring: progress (0 closed, 1 open; may overshoot), velocity, goal. */
  p: number;
  pv: number;
  goal: number;
  /** Hover hint, 0 to 1. */
  hot: number;
  /** Where an opening equation started and where it settles (kept clear of text). */
  ax: number;
  ay: number;
  tx: number;
  ty: number;
  /** Visibility while an open equation covers this node (1 = clear). */
  clr: number;
  /** Pushed by an opening equation this frame (allowed to move faster). */
  fast: boolean;
}

interface Rect {
  x: number;
  y: number;
  r: number;
  b: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The owner's picks first, then the featured set, then the pool; each group
// shuffled, and a slot with alternatives picks one of them.
function equationOrder(tex: TexData): number[] {
  const pick = (list: (number | number[])[]) =>
    shuffle(list).map((e) => (Array.isArray(e) ? e[Math.floor(Math.random() * e.length)] : e));
  return [...pick(tex.k), ...pick(tex.f), ...shuffle(tex.p)];
}

export function mountMesh(host: HTMLElement, opts: MeshOptions = {}): () => void {
  const canvas = host.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  const tex = readTex();
  if (!canvas || !ctx || !tex) return () => {};

  const density = opts.density ?? 1;
  const maskSel = opts.mask || DEFAULT_MASK;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const interactive = (opts.interactive ?? true) && !coarse;
  const fixed = getComputedStyle(host).position === 'fixed';

  let W = 0;
  let H = 0;
  let dpr = 1;
  let ox = 0; // host offset in the viewport
  let oy = 0;
  let ink = '26,26,26';
  let nodes: Node[] = [];
  const eqOrder = equationOrder(tex);
  const openOf = new Map<number, number>();
  for (let j = 0; tex.o && j < tex.o.length; j += 2) openOf.set(tex.o[j], tex.o[j + 1]);
  let rects: Rect[] = [];
  let raf = 0;
  let last = 0;
  let running = false;
  let inView = true;
  const mouse = { x: 0, y: 0, on: false, k: 0, text: false };
  let eqN = 0; // equations lead the node list
  // Expandable equations: at most one open (or opening) at a time.
  const expandable = opts.interactive ?? true;
  let active: Node | null = null;
  let hoverNode: Node | null = null;
  let hoverSince = 0;
  let leaveSince = 0;
  /** Opened by a tap: stays open until the next tap (no hover to leave). */
  let tapOpen = false;

  // Scratch buffers for bucketed line batches: one path per alpha step.
  const segs: number[][] = Array.from({ length: K.buckets + 1 }, () => []);
  const dots: number[][] = Array.from({ length: K.buckets + 1 }, () => []);

  /* ---------- theme ---------- */

  const readInk = () => {
    const v = getComputedStyle(host).getPropertyValue('--mesh-ink').trim();
    const parts = v.split(/[\s,]+/).filter(Boolean);
    return parts.length === 3 ? parts.join(',') : '26,26,26';
  };

  /* ---------- sprites ---------- */

  // Each node gets its own sprite at its own size, so outlines are
  // rasterised once per theme (and DPR) and every frame is a drawImage.
  const makeSprite = (idx: number, size: number): Sprite => {
    const v = tex.i[idx].v;
    const pad = 2;
    const w = Math.ceil((v[2] * size) / 1000 + pad * 2);
    const h = Math.ceil((v[3] * size) / 1000 + pad * 2);
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.fillStyle = `rgb(${ink})`;
    paintTex(g, tex, idx, pad, pad, size);
    return { canvas: c, w, h };
  };

  // The open form shares the closed form's em size, shrunk only if it would
  // not fit the host's width (narrow phones).
  const openSize = (n: Node) => {
    const ow = (tex.i[n.open!].v[2] * n.size) / 1000 + 4 + 2 * (K.attachPad + K.edge);
    return n.size * Math.min(1, W / ow);
  };

  // Box size from the morph progress: the attach box, mask and collision
  // tests all read n.w/n.h, so links and neighbours follow the growing box.
  const setBox = (n: Node) => {
    const s = n.sprite;
    if (!s) return;
    const o = n.spriteO;
    if (!o || n.p <= 0) {
      n.w = s.w;
      n.h = s.h;
      return;
    }
    const t = Math.min(n.p, 1.08);
    n.w = s.w + (o.w - s.w) * t;
    n.h = s.h + (o.h - s.h) * t;
  };

  const paintNode = (n: Node) => {
    n.sprite = makeSprite(n.tex, n.size);
    if (n.open !== undefined) n.spriteO = makeSprite(n.open, openSize(n));
    if (!n.eq) n.r = Math.max(n.sprite.w, n.sprite.h) * 0.5 + 2;
    setBox(n);
  };

  const renderSprites = () => {
    for (const n of nodes) paintNode(n);
  };

  /* ---------- text mask ---------- */

  const measureMask = () => {
    const hostRect = host.getBoundingClientRect();
    ox = hostRect.left;
    oy = hostRect.top;
    const p = K.maskPad;
    const out: Rect[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(maskSel)) {
      if (host.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const x = r.left - ox - p;
      const y = r.top - oy - p;
      const rr = r.right - ox + p;
      const b = r.bottom - oy + p;
      if (rr < -50 || b < -50 || x > W + 50 || y > H + 50) continue;
      out.push({ x, y, r: rr, b });
    }
    rects = out;
  };

  const over = (x: number, y: number): Rect | null => {
    for (const r of rects) if (x > r.x && x < r.r && y > r.y && y < r.b) return r;
    return null;
  };

  // Half extents used for mask tests. Every node is tested as its whole box
  // rather than its center point, so a glyph's edge (or a long equation's
  // tail) never slides into the padding around the text.
  const ext = (n: Node) => [n.w / 2, n.h / 2];

  const hit = (n: Node): Rect | null => {
    const [hw, hh] = ext(n);
    for (const r of rects) if (n.x + hw > r.x && n.x - hw < r.r && n.y + hh > r.y && n.y - hh < r.b) return r;
    return null;
  };

  // Distance from a node's box to the nearest mask rect (0 when touching).
  const nearest = (n: Node) => {
    const [hw, hh] = ext(n);
    let d = Infinity;
    for (const r of rects) {
      const dx = Math.max(r.x - (n.x + hw), n.x - hw - r.r, 0);
      const dy = Math.max(r.y - (n.y + hh), n.y - hh - r.b, 0);
      d = Math.min(d, Math.hypot(dx, dy));
    }
    return d;
  };

  // Resting fade outside the mask: a soft halo near the text, so the page
  // copy sits in a calm pocket instead of a glyph stopping right at its edge.
  const restFade = (n: Node) => {
    const t = clamp(nearest(n) / K.halo, 0, 1);
    return K.haloFade + (1 - K.haloFade) * t;
  };

  // Extra clearance around an equation box (on top of both boxes).
  const gap = (n: Node) => (n.eq ? 12 : 6);

  const onEquation = (n: Node) => {
    const [hw, hh] = ext(n);
    for (const e of nodes) {
      if (!e.eq || e === n || !e.sprite) continue;
      if (Math.abs(n.x - e.x) < e.w / 2 + hw + gap(n) && Math.abs(n.y - e.y) < e.h / 2 + hh + gap(n))
        return true;
    }
    return false;
  };

  /* ---------- nodes ---------- */

  const counts = () => {
    const glyphs0 = Math.round(clamp((W * H) / K.glyphArea, K.glyphMin, K.glyphMax));
    const eqs0 = clamp(Math.round(glyphs0 / 6), K.eqMin, eqOrder.length);
    const f = density * (coarse ? 0.5 : 1);
    return {
      glyphs: Math.max(1, Math.round(glyphs0 * f)),
      eqs: Math.min(eqOrder.length, Math.max(1, Math.round(eqs0 * f))),
    };
  };

  const place = (n: Node) => {
    // Start outside the text so nothing is ever drawn over it, and fully on
    // screen so nothing is cut by the viewport edge, even in a static frame
    // drawn while the loop is paused.
    const [hw, hh] = ext(n);
    for (let t = 0; t < 40; t++) {
      n.x = W > hw * 2 ? rand(hw, W - hw) : W / 2;
      n.y = H > hh * 2 ? rand(hh, H - hh) : H / 2;
      if (!hit(n) && !onEquation(n)) break;
    }
    n.fade = hit(n) ? K.maskFade : restFade(n);
  };

  const makeNode = (eq: boolean, idx: number): Node => {
    const vx = rand(-K.speed, K.speed);
    const vy = rand(-K.speed, K.speed);
    const n: Node = {
      x: 0,
      y: 0,
      vx,
      vy,
      cx: vx,
      cy: vy,
      tex: idx,
      eq,
      size: eq ? rand(K.eqSize[0], K.eqSize[1]) : K.glyphSize * rand(0.8, 1.4),
      fade: 1,
      r: 8,
      w: 0,
      h: 0,
      open: eq ? openOf.get(idx) : undefined,
      p: 0,
      pv: 0,
      goal: 0,
      hot: 0,
      ax: 0,
      ay: 0,
      tx: 0,
      ty: 0,
      clr: 1,
      fast: false,
    };
    paintNode(n);
    place(n);
    return n;
  };

  const syncCounts = () => {
    const { glyphs, eqs } = counts();
    const g = nodes.filter((n) => !n.eq);
    const e = nodes.filter((n) => n.eq);
    while (e.length > eqs) e.pop();
    while (e.length < eqs) {
      const used = new Set(e.map((n) => n.tex));
      const next = eqOrder.find((t) => !used.has(t));
      if (!next) break;
      // Keep the list current so each new equation is placed clear of the
      // ones before it.
      nodes = e.concat(g);
      e.push(makeNode(true, next));
    }
    // Equations first: glyphs are placed clear of them, and drawn on top.
    nodes = e.concat(g);
    while (g.length > glyphs) g.pop();
    while (g.length < glyphs) g.push(makeNode(false, tex.g[Math.floor(Math.random() * tex.g.length)]));
    nodes = e.concat(g);
    eqN = e.length;
    if (active && !e.includes(active)) active = null;
    if (hoverNode && !e.includes(hoverNode)) hoverNode = null;
  };

  /* ---------- size ---------- */

  const resize = () => {
    const r = host.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width));
    const nh = Math.max(1, Math.round(r.height));
    // Render at the real device density, including browser zoom (which
    // raises devicePixelRatio) and trackpad pinch-zoom (visualViewport.scale,
    // which doesn't), so the equations and their links stay sharp when
    // zoomed in. Quarter steps avoid re-rendering on every tiny change; 3x
    // keeps the canvas affordable. A phone's full-screen layer is redrawn
    // every frame, so unzoomed it renders at 2x: at the mesh's faint ink a
    // 3x screen shows no difference, and each frame fills 2.25x fewer pixels
    // (the cost WebKit feels most). Pinch-zoomed, it goes up to 3x again.
    const pinch = Math.max(1, window.visualViewport?.scale ?? 1);
    const cap = coarse && pinch <= 1 ? 2 : 3;
    const ndpr = Math.min(Math.ceil((window.devicePixelRatio || 1) * pinch * 4) / 4, cap);
    if (nw === W && nh === H && ndpr === dpr) return;
    // Keep nodes where they are, relative to the new size (no re-seed flash
    // when a mobile URL bar shows or hides).
    if (W && H) {
      const sx = nw / W;
      const sy = nh / H;
      for (const n of nodes) {
        n.x *= sx;
        n.y *= sy;
      }
    }
    const repaint = ndpr !== dpr || (nw !== W && nodes.some((n) => n.open !== undefined));
    W = nw;
    H = nh;
    dpr = ndpr;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureMask();
    if (repaint) renderSprites();
    syncCounts();
  };

  /* ---------- expandable equations ---------- */

  // Is (x, y) inside n's attach box, grown by `pad`?
  const inBox = (n: Node, x: number, y: number, pad: number) =>
    Math.abs(x - n.x) < n.w / 2 - 2 + K.attachPad + pad && Math.abs(y - n.y) < n.h / 2 - 2 + K.attachPad + pad;

  // The expandable equation under a point: the open one first (it is drawn
  // on top), then the others, last drawn first.
  const eqAt = (x: number, y: number, pad: number): Node | null => {
    if (active && inBox(active, x, y, pad)) return active;
    for (let i = eqN - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.spriteO && inBox(n, x, y, pad)) return n;
    }
    return null;
  };

  // Is the open form, centered at (x, y), fully on screen and clear of the
  // padded text mask?
  const openFree = (n: Node, x: number, y: number) => {
    const o = n.spriteO!;
    const hw = o.w / 2 - 2 + K.attachPad;
    const hh = o.h / 2 - 2 + K.attachPad;
    if (x - hw < K.edge || x + hw > W - K.edge || y - hh < K.edge || y + hh > H - K.edge) return false;
    for (const r of rects) if (x + hw > r.x && x - hw < r.r && y + hh > r.y && y - hh < r.b) return false;
    return true;
  };

  // Where the open form settles: in place if it fits, else the nearest free
  // spot on growing rings around it (null if there is none within reach).
  const openSpot = (n: Node): [number, number] | null => {
    const o = n.spriteO!;
    const hw = o.w / 2 - 2 + K.attachPad + K.edge;
    const hh = o.h / 2 - 2 + K.attachPad + K.edge;
    const x0 = W > hw * 2 ? clamp(n.x, hw, W - hw) : W / 2;
    const y0 = H > hh * 2 ? clamp(n.y, hh, H - hh) : H / 2;
    if (openFree(n, x0, y0)) return [x0, y0];
    for (let r = 12; r <= 420; r += 12) {
      const steps = Math.max(12, Math.round(r / 6));
      for (let a = 0; a < steps; a++) {
        const t = (a / steps) * Math.PI * 2;
        const x = x0 + Math.cos(t) * r;
        const y = y0 + Math.sin(t) * r;
        if (openFree(n, x, y)) return [x, y];
      }
    }
    return null;
  };

  const collapse = (instant: boolean) => {
    const n = active;
    if (!n) return;
    active = null;
    tapOpen = false;
    leaveSince = 0;
    // Close in place: the closed box fits inside the open one.
    n.goal = 0;
    n.ax = n.tx = n.x;
    n.ay = n.ty = n.y;
    if (instant) {
      n.p = n.pv = 0;
      setBox(n);
    }
  };

  const expand = (n: Node, instant: boolean) => {
    if (active === n) return true;
    if (!n.spriteO) return false;
    const spot = openSpot(n);
    if (!spot) return false;
    collapse(instant);
    active = n;
    leaveSince = 0;
    n.goal = 1;
    n.ax = n.x;
    n.ay = n.y;
    [n.tx, n.ty] = spot;
    n.vx = n.vy = 0;
    if (instant) {
      n.p = 1;
      n.pv = 0;
      n.x = n.tx;
      n.y = n.ty;
      setBox(n);
    }
    return true;
  };

  // Dwell to open, linger to close. Runs every frame, and from pointer
  // events and timers when the loop is off (off-screen or hidden tab).
  const tickHover = (now: number) => {
    if (!expandable) return;
    const can = mouse.on && !mouse.text && !over(mouse.x, mouse.y);
    const under = can ? eqAt(mouse.x, mouse.y, 0) : null;
    if (under !== hoverNode) {
      hoverNode = under;
      hoverSince = now;
    }
    if (hoverNode && hoverNode !== active && now - hoverSince >= K.dwell) expand(hoverNode, !running);
    if (active && !tapOpen) {
      if (can && inBox(active, mouse.x, mouse.y, K.lingerPad)) leaveSince = 0;
      else if (!leaveSince) leaveSince = now;
      else if (now - leaveSince >= K.linger) collapse(!running);
    }
  };

  // The next time tickHover has something to decide, for the static timer.
  const nextDeadline = () => {
    let t = Infinity;
    if (hoverNode && hoverNode !== active) t = hoverSince + K.dwell;
    if (active && leaveSince) t = Math.min(t, leaveSince + K.linger);
    return t;
  };

  const hotGoal = (n: Node) => (n.spriteO && (n === hoverNode || n === active) ? 1 : 0);

  // Does n overlap an equation that is open or opening?
  const covered = (n: Node) => {
    const [hw, hh] = ext(n);
    for (let i = 0; i < eqN; i++) {
      const e = nodes[i];
      if (e === n || e.p <= 0.02) continue;
      if (Math.abs(n.x - e.x) < e.w / 2 + hw + 2 && Math.abs(n.y - e.y) < e.h / 2 + hh + 2) return true;
    }
    return false;
  };

  // Without the loop, hover hint and covering apply at once.
  const settleInstant = () => {
    for (const n of nodes) {
      n.hot = hotGoal(n);
      n.clr = covered(n) ? 0 : 1;
    }
  };

  const spring = (n: Node, k: number) => {
    if (n.p === n.goal && !n.pv) return;
    // Two half steps keep the integration stable on slow frames.
    const dt = k / 120;
    for (let i = 0; i < 2; i++) {
      n.pv += (K.stiffness * (n.goal - n.p) - K.damping * n.pv) * dt;
      n.p += n.pv * dt;
    }
    if (Math.abs(n.goal - n.p) < 0.002 && Math.abs(n.pv) < 0.02) {
      n.p = n.goal;
      n.pv = 0;
    }
    setBox(n);
  };

  /* ---------- simulation ---------- */

  const step = (k: number, now: number) => {
    const damp = Math.pow(0.9, k);
    const inEase = 1 - Math.pow(1 - 0.12, k);
    const outEase = 1 - Math.pow(1 - 0.08, k);
    const cruise = 1 - Math.pow(1 - 0.01, k);
    const hotEase = 1 - Math.pow(1 - 0.18, k);
    tickHover(now);
    for (let i = 0; i < eqN; i++) spring(nodes[i], k);
    for (const n of nodes) {
      n.hot += (hotGoal(n) - n.hot) * hotEase;
      n.clr += ((covered(n) ? K.coverFade : 1) - n.clr) * hotEase;
      n.fast = false;
    }
    for (const n of nodes) {
      // A hovered or open equation holds still, so it can be read.
      const held = n.hot > 0.02 || n.p > 0.001;
      // An open equation was placed clear of the text; it ignores the mask.
      const r = n.p > 0.001 ? null : hit(n);
      if (r) {
        n.vx *= damp;
        n.vy *= damp;
        const [hw, hh] = ext(n);
        const dl = n.x + hw - r.x;
        const dr = r.r - (n.x - hw);
        const dt = n.y + hh - r.y;
        const db = r.b - (n.y - hh);
        const m = Math.min(dl, dr, dt, db);
        const push = 0.07 * k;
        if (m === dl) n.vx -= push;
        else if (m === dr) n.vx += push;
        else if (m === dt) n.vy -= push;
        else n.vy += push;
        n.fade += (K.maskFade - n.fade) * inEase;
      } else {
        n.fade += (restFade(n) - n.fade) * outEase;
        if (!held) {
          n.vx += (n.cx - n.vx) * cruise;
          n.vy += (n.cy - n.vy) * cruise;
        }
      }
      if (held) {
        n.vx *= damp;
        n.vy *= damp;
        if (n.goal === 1) {
          // Opening: glide from where it was to its clear spot.
          const t = clamp(n.p, 0, 1);
          n.x = n.ax + (n.tx - n.ax) * t;
          n.y = n.ay + (n.ty - n.ay) * t;
          n.vx = n.vy = 0;
        }
        n.x += n.vx * k;
        n.y += n.vy * k;
        continue;
      }
      // Nodes slide around equations instead of printing over them; an
      // opening equation shoulders its neighbours aside a little faster.
      const [nw, nh] = ext(n);
      for (const e of nodes) {
        if (!e.eq) break; // equations come first in the list
        if (e === n || !e.sprite) continue;
        const hw = e.w / 2 + nw + gap(n);
        const hh = e.h / 2 + nh + gap(n);
        const dx = n.x - e.x;
        const dy = n.y - e.y;
        if (Math.abs(dx) >= hw || Math.abs(dy) >= hh) continue;
        const opening = e.p > 0.02;
        if (opening) n.fast = true;
        const push = (opening ? 0.22 : 0.05) * k;
        if (hw - Math.abs(dx) < hh - Math.abs(dy)) n.vx += dx < 0 ? -push : push;
        else n.vy += dy < 0 ? -push : push;
      }
      const sp = Math.hypot(n.vx, n.vy);
      const max = n.fast ? 2.4 : K.maxSpeed;
      if (sp > max) {
        n.vx = (n.vx / sp) * max;
        n.vy = (n.vy / sp) * max;
      }
      n.x += n.vx * k;
      n.y += n.vy * k;
      // Wrap once the whole sprite is off-canvas, so nothing pops in view.
      const mx = Math.max(K.wrap, n.w / 2 + 4);
      const my = Math.max(K.wrap, n.h / 2 + 4);
      if (n.x < -mx) n.x = W + mx;
      else if (n.x > W + mx) n.x = -mx;
      if (n.y < -my) n.y = H + my;
      else if (n.y > H + my) n.y = -my;
    }
    const target = mouse.on && !over(mouse.x, mouse.y) ? 1 : 0;
    mouse.k += (target - mouse.k) * (1 - Math.pow(1 - 0.15, k));
  };

  /* ---------- drawing ---------- */

  const pushSeg = (a: number, max: number, x1: number, y1: number, x2: number, y2: number) => {
    const b = Math.round((a / max) * K.buckets);
    if (b > 0) segs[b].push(x1, y1, x2, y2);
  };

  const pushDot = (a: number, max: number, x: number, y: number) => {
    const b = Math.round((a / max) * K.buckets);
    if (b > 0) dots[b].push(x, y);
  };

  const flushSegs = (max: number) => {
    for (let b = 1; b <= K.buckets; b++) {
      const s = segs[b];
      const p = dots[b];
      if (!s.length && !p.length) continue;
      const color = `rgba(${ink},${((b / K.buckets) * max).toFixed(3)})`;
      if (s.length) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 0; i < s.length; i += 4) {
          ctx.moveTo(s[i], s[i + 1]);
          ctx.lineTo(s[i + 2], s[i + 3]);
        }
        ctx.stroke();
        s.length = 0;
      }
      if (p.length) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < p.length; i += 2) {
          ctx.moveTo(p[i] + K.port, p[i + 1]);
          ctx.arc(p[i], p[i + 1], K.port, 0, Math.PI * 2);
        }
        ctx.fill();
        p.length = 0;
      }
    }
  };

  // Does the segment cross the box [l, r] x [t, b]? (Liang–Barsky clip.)
  const segBox = (x1: number, y1: number, x2: number, y2: number, l: number, t: number, r: number, b: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;
    const clip = (p: number, q: number) => {
      if (p === 0) return q >= 0;
      const u = q / p;
      if (p < 0) {
        if (u > t1) return false;
        if (u > t0) t0 = u;
      } else {
        if (u < t0) return false;
        if (u < t1) t1 = u;
      }
      return true;
    };
    return clip(-dx, x1 - l) && clip(dx, r - x1) && clip(-dy, y1 - t) && clip(dy, b - y1);
  };

  // An edge is dropped if any part of it would cross the page text (the
  // padded mask) or run through an equation other than its own endpoints.
  const blocked = (x1: number, y1: number, x2: number, y2: number, a: Node | null, b: Node | null) => {
    for (const r of rects) if (segBox(x1, y1, x2, y2, r.x, r.y, r.r, r.b)) return true;
    for (let i = 0; i < eqN; i++) {
      const e = nodes[i];
      if (e === a || e === b || !e.sprite) continue;
      const hw = e.w / 2 + 2;
      const hh = e.h / 2 + 2;
      if (segBox(x1, y1, x2, y2, e.x - hw, e.y - hh, e.x + hw, e.y + hh)) return true;
    }
    return false;
  };

  // Distance from an equation's center, along unit direction (ux, uy), to the
  // edge of its attach box: the typeset ink box grown by K.attachPad. Sprites
  // carry 2px of padding around the ink. While an equation morphs, this is
  // the growing box, so its links re-attach to the new edge every frame.
  const reach = (n: Node, ux: number, uy: number) => {
    const hw = n.w / 2 - 2 + K.attachPad;
    const hh = n.h / 2 - 2 + K.attachPad;
    return Math.min(ux ? hw / Math.abs(ux) : Infinity, uy ? hh / Math.abs(uy) : Infinity);
  };

  // Per equation, the K.eqCap + 1 nearest candidates (node index, gap),
  // sorted; the extra one sets where the last kept link fades out.
  const slot = K.eqCap + 1;
  const topJ: number[] = [];
  const topD: number[] = [];
  const topN: number[] = [];

  const collectEq = () => {
    const R = K.eqLink;
    for (let e = 0; e < eqN; e++) {
      const a = nodes[e];
      topN[e] = 0;
      if (!a.sprite) continue;
      const ra = Math.hypot(a.w, a.h) / 2 + K.attachPad;
      for (let j = 0; j < nodes.length; j++) {
        if (j === e) continue;
        const b = nodes[j];
        if (!b.sprite) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const D = Math.hypot(dx, dy);
        const rb = b.eq ? Math.hypot(b.w, b.h) / 2 + K.attachPad : 0;
        if (!D || D - ra - rb >= R) continue;
        const ux = dx / D;
        const uy = dy / D;
        // Gap between the two boxes (equation) or box and center (glyph).
        const d = D - reach(a, ux, uy) - (b.eq ? reach(b, ux, uy) : 0);
        if (d <= 0 || d >= R) continue;
        // Insert into this equation's short sorted list.
        const base = e * slot;
        let k = Math.min(topN[e], slot - 1);
        if (topN[e] === slot && d >= topD[base + k]) continue;
        while (k > 0 && topD[base + k - 1] > d) {
          topD[base + k] = topD[base + k - 1];
          topJ[base + k] = topJ[base + k - 1];
          k--;
        }
        topD[base + k] = d;
        topJ[base + k] = j;
        if (topN[e] < slot) topN[e]++;
      }
    }
  };

  // Soft cap: a kept link fades out as the first rejected candidate closes
  // in, so links hand over instead of popping.
  const capFade = (e: number, d: number) =>
    topN[e] < slot ? 1 : clamp((topD[e * slot + K.eqCap] - d) / K.eqBand, 0, 1);

  const kept = (e: number, j: number) => {
    const n = Math.min(topN[e], K.eqCap);
    for (let k = 0; k < n; k++) if (topJ[e * slot + k] === j) return true;
    return false;
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    eqN = 0;
    while (eqN < nodes.length && nodes[eqN].eq) eqN++;

    // Glyph links
    const L2 = K.link * K.link;
    for (let i = eqN; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= L2) continue;
        const d = Math.sqrt(d2);
        if (d <= a.r + b.r + 4) continue;
        const ux = dx / d;
        const uy = dy / d;
        const x1 = a.x + ux * a.r;
        const y1 = a.y + uy * a.r;
        const x2 = b.x - ux * b.r;
        const y2 = b.y - uy * b.r;
        if (blocked(x1, y1, x2, y2, a, b)) continue;
        const alpha = K.linkAlpha * (1 - d / K.link) * Math.min(a.fade * a.clr, b.fade * b.clr);
        pushSeg(alpha, K.linkAlpha, x1, y1, x2, y2);
      }
    }

    // Equation links: each equation keeps its K.eqCap nearest neighbours,
    // measured and drawn from the edge of its box, never through the math.
    collectEq();
    for (let e = 0; e < eqN; e++) {
      const a = nodes[e];
      const n = Math.min(topN[e], K.eqCap);
      for (let k = 0; k < n; k++) {
        const j = topJ[e * slot + k];
        const d = topD[e * slot + k];
        const b = nodes[j];
        let f = capFade(e, d);
        if (b.eq) {
          // Equation pairs: drawn once, and only if both ends keep the link.
          if (j < e || !kept(j, e)) continue;
          f = Math.min(f, capFade(j, d));
        }
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const D = Math.hypot(dx, dy);
        const ux = dx / D;
        const uy = dy / D;
        const ta = reach(a, ux, uy);
        const tb = b.eq ? reach(b, ux, uy) : b.r;
        if (D - ta - tb < 6) continue;
        const x1 = a.x + ux * ta;
        const y1 = a.y + uy * ta;
        const x2 = b.x - ux * tb;
        const y2 = b.y - uy * tb;
        if (blocked(x1, y1, x2, y2, a, b)) continue;
        const alpha = K.linkAlpha * (1 - d / K.eqLink) * Math.min(a.fade * a.clr, b.fade * b.clr) * f;
        pushSeg(alpha, K.linkAlpha, x1, y1, x2, y2);
        pushDot(alpha, K.linkAlpha, x1, y1);
        if (b.eq) pushDot(alpha, K.linkAlpha, x2, y2);
      }
    }
    flushSegs(K.linkAlpha);

    // Cursor lines, to glyph centers and to equation box edges.
    if (interactive && mouse.k > 0.01) {
      for (const n of nodes) {
        if (!n.sprite) continue;
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const D = Math.hypot(dx, dy);
        if (!D) continue;
        const ux = dx / D;
        const uy = dy / D;
        const t = n.eq ? reach(n, -ux, -uy) : n.r;
        const d = n.eq ? D - t : D;
        if (d >= K.cursor || D - t <= 2) continue;
        const x2 = n.x - ux * t;
        const y2 = n.y - uy * t;
        if (blocked(mouse.x, mouse.y, x2, y2, n, null)) continue;
        const alpha = K.cursorAlpha * (1 - d / K.cursor) * n.fade * n.clr * mouse.k;
        pushSeg(alpha, K.cursorAlpha, mouse.x, mouse.y, x2, y2);
        if (n.eq) pushDot(alpha, K.cursorAlpha, x2, y2);
      }
      flushSegs(K.cursorAlpha);
    }

    // Nodes (pre-rendered sprites); an open or opening equation goes last,
    // on top of anything it has not pushed aside yet.
    for (const n of nodes) if (n !== active) drawNode(n);
    if (active) drawNode(active);
    ctx.globalAlpha = 1;
  };

  const blit = (s: Sprite, x: number, y: number, scale: number, alpha: number) => {
    if (alpha <= 0.002) return;
    const w = s.w * scale;
    const h = s.h * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(s.canvas, x - w / 2, y - h / 2, w, h);
  };

  const drawNode = (n: Node) => {
    const s = n.sprite;
    if (!s) return;
    if (!n.eq) {
      blit(s, n.x, n.y, 1, K.glyphAlpha * n.fade * n.clr);
      return;
    }
    // Hover hint: the halo fade lifts and the ink gains K.hotAlpha.
    const a = Math.min(1, K.eqAlpha * (n.fade + (1 - n.fade) * n.hot) + K.hotAlpha * n.hot) * n.clr;
    const o = n.spriteO;
    if (!o || n.p <= 0.001) blit(s, n.x, n.y, 1, a);
    else {
      // Morph: the closed form swells slightly as it fades out, the open
      // form settles in from 90% (the spring's overshoot carries through).
      const t = clamp(n.p, 0, 1);
      blit(s, n.x, n.y, 1 + 0.08 * t, a * (1 - smooth(0, 0.55, t)));
      blit(o, n.x, n.y, 0.9 + 0.1 * n.p, a * smooth(0.25, 1, t));
    }
  };

  /* ---------- loop ---------- */

  // Frame cost (step + draw), sampled only with ?meshdebug.
  const debug = new URLSearchParams(location.search).has('meshdebug');
  const cost: number[] = [];

  const frame = (t: number) => {
    const k = last ? clamp((t - last) / (1000 / 60), 0, 3) : 1;
    last = t;
    const t0 = debug ? performance.now() : 0;
    step(k, t);
    draw();
    if (debug) {
      cost.push(performance.now() - t0);
      if (cost.length > 600) cost.shift();
    }
    raf = requestAnimationFrame(frame);
  };

  const canRun = () => !document.hidden && inView;

  const sync = () => {
    if (canRun() && !running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    } else if (!canRun() && running) {
      running = false;
      cancelAnimationFrame(raf);
      // A morph caught mid-way snaps to where it was going.
      for (let i = 0; i < eqN; i++) {
        const n = nodes[i];
        n.p = n.goal;
        n.pv = 0;
        if (n.goal === 1) {
          n.x = n.tx;
          n.y = n.ty;
        }
        setBox(n);
      }
    }
    if (!running) {
      settleInstant();
      draw(); // loop paused: one static frame
    }
  };

  /* ---------- events ---------- */

  // Without the loop nothing moves out of the text on its own, so after the
  // mask or size changes (font swap, resize) re-place any node now under it.
  const settleStatic = () => {
    if (active && !openFree(active, active.x, active.y)) collapse(true);
    for (const n of nodes) {
      if (hit(n)) place(n);
      else n.fade = restFade(n);
    }
    settleInstant();
    draw();
  };

  let maskQueued = false;
  const queueMask = () => {
    if (maskQueued) return;
    maskQueued = true;
    requestAnimationFrame(() => {
      maskQueued = false;
      measureMask();
      // The text moved under an open equation: close it.
      if (active && active.goal === 1 && active.p > 0.98 && !openFree(active, active.x, active.y)) collapse(!running);
      if (!running) settleStatic();
    });
  };

  const onTheme = () => {
    const next = readInk();
    if (next === ink) return;
    ink = next;
    renderSprites();
    if (!running) draw();
  };

  // Without the loop (off-screen or hidden tab), hover is decided here and on a timer
  // at the next dwell or linger deadline, and the frame is redrawn only when
  // the hovered or open equation changes. The swap is instant.
  let staticTimer = 0;
  const staticHover = () => {
    if (running || !expandable) return;
    const was = [hoverNode, active];
    tickHover(performance.now());
    if (was[0] !== hoverNode || was[1] !== active) {
      settleInstant();
      draw();
    }
    clearTimeout(staticTimer);
    const next = nextDeadline();
    if (next < Infinity) staticTimer = window.setTimeout(staticHover, Math.max(0, next - performance.now()) + 5);
  };

  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX - ox;
    mouse.y = e.clientY - oy;
    mouse.on = true;
    // Links, buttons and text keep the pointer: no equation opens under them.
    mouse.text = !!(e.target as Element | null)?.closest?.(INTERACTIVE);
    tapOpen = false;
    staticHover();
  };
  const onPointerOut = (e: PointerEvent | MouseEvent) => {
    if (!e.relatedTarget) {
      mouse.on = false;
      staticHover();
    }
  };
  const onBlur = () => {
    mouse.on = false;
    staticHover();
  };

  // Touch and pen: a tap on an equation (not on text or a control) toggles
  // it, a tap elsewhere closes the open one. Passive, never preventDefault,
  // so taps on links and text behave exactly as before.
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    const x = e.clientX - ox;
    const y = e.clientY - oy;
    if ((e.target as Element | null)?.closest?.(INTERACTIVE) || over(x, y)) return;
    const n = eqAt(x, y, 10);
    if (n && n === active) collapse(!running);
    else if (n) {
      if (expand(n, !running)) tapOpen = true;
    } else collapse(!running);
    if (!running) {
      settleInstant();
      draw();
    }
  };

  const ro = new ResizeObserver(() => {
    resize();
    if (!running) settleStatic();
  });
  const mo = new MutationObserver(onTheme);
  const io = fixed
    ? null
    : new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        sync();
      });

  ink = readInk();
  resize();
  ro.observe(host);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  io?.observe(host);
  window.addEventListener('themechange', onTheme);
  window.addEventListener('resize', queueMask, { passive: true });
  // Density changes with no size change (pinch-zoom, moving to another
  // display): re-render once the gesture settles.
  let densityTimer = 0;
  const onDensity = () => {
    clearTimeout(densityTimer);
    densityTimer = window.setTimeout(() => {
      resize();
      if (!running) settleStatic();
    }, 140);
  };
  window.visualViewport?.addEventListener('resize', onDensity);
  window.addEventListener('resize', onDensity, { passive: true });
  window.addEventListener('scroll', queueMask, { passive: true });
  window.addEventListener('load', queueMask);
  document.addEventListener('visibilitychange', sync);
  if (interactive) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('pointerout', onPointerOut);
    window.addEventListener('blur', onBlur);
  }
  if (expandable) document.addEventListener('pointerdown', onDown, { passive: true });
  if (debug) {
    // Read-only probe for capture scripts: equation boxes in viewport px,
    // the frame cost, and direct open/close.
    (window as unknown as { __mesh: unknown }).__mesh = {
      eqs: () =>
        nodes.slice(0, eqN).map((n, i) => ({
          i,
          tex: n.tex,
          open: n.open !== undefined,
          x: n.x + ox,
          y: n.y + oy,
          w: n.w,
          h: n.h,
          p: n.p,
          hot: n.hot,
          fade: n.fade,
          active: n === active,
        })),
      cost: () => {
        const c = cost.slice().sort((a, b) => a - b);
        return { n: c.length, median: c[c.length >> 1], p95: c[Math.floor(c.length * 0.95)], max: c[c.length - 1] };
      },
      resetCost: () => (cost.length = 0),
      // Opens like a tap: stays open until collapse() or a pointer move.
      expand: (i: number) => {
        const ok = expand(nodes[i], !running);
        if (ok) tapOpen = true;
        if (!running) {
          settleInstant();
          draw();
        }
        return ok;
      },
      collapse: () => {
        collapse(!running);
        if (!running) {
          settleInstant();
          draw();
        }
      },
    };
  }
  // Page text settles after fonts load and the entrance stagger ends.
  document.fonts?.ready.then(queueMask);
  const settle = window.setTimeout(queueMask, 1200);

  sync();
  host.classList.add('is-ready');

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    clearTimeout(settle);
    ro.disconnect();
    mo.disconnect();
    io?.disconnect();
    window.removeEventListener('themechange', onTheme);
    window.removeEventListener('resize', queueMask);
    window.visualViewport?.removeEventListener('resize', onDensity);
    window.removeEventListener('resize', onDensity);
    clearTimeout(densityTimer);
    window.removeEventListener('scroll', queueMask);
    window.removeEventListener('load', queueMask);
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('pointerout', onPointerOut);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('pointerdown', onDown);
    clearTimeout(staticTimer);
  };
}

/** Mount every [data-mesh] host once, when the browser is idle after first paint. */
export function initMeshes() {
  const start = () => {
    for (const host of document.querySelectorAll<HTMLElement>('[data-mesh]:not([data-mesh-on])')) {
      host.dataset.meshOn = '';
      mountMesh(host, {
        density: Number(host.dataset.density) || 1,
        mask: host.dataset.mask,
        interactive: host.dataset.interactive !== 'false',
      });
    }
  };
  // The math is outlines in the page's JSON, so there is nothing to wait
  // for beyond the idle slot.
  const idle = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 });
    else setTimeout(start, 200);
  };
  // Two frames: the first paint has happened by the second callback.
  requestAnimationFrame(() => requestAnimationFrame(idle));
}
