// The footer's art: the owner's photograph of the Koç University campus at
// Rumelifeneri (the clock tower, terracotta roofs, the forest, the Black Sea
// along the top), dithered at runtime.
//
// The photo is graded offline per theme and shipped at its native 1834 px
// (public/footer/koc-{light,dark}.avif, .webp fallback) with a presence alpha (the sea band
// fades into the page; the tower is exempt, so it stands crisp against it),
// plus a material map (koc-mat.webp). At layout the photo is drawn once into a
// canvas of one pixel per dot cell (the browser's high-quality downscale),
// sharpened there with an unsharp mask at the cell scale, and uploaded.
//
// One WebGL2 pass, one fragment per cell, runs an ordered dither (8 x 8
// Bayer): the cell's colour is offset in OKLab lightness by the threshold,
// then snapped to the nearest swatch of a ~40-colour palette (k-means per
// material in OKLab), searching only the ramps the cell's material may use,
// so no stray orange in the stone or blue in the trees. Presence is a second
// threshold (blue noise, nudged by a slow value noise): the fades into --bg,
// at the top through the sea and at the bottom above the sign-off row,
// dissolve irregularly into scattered dots, never blends and never a
// straight row.
//
// The canvas holds one pixel per cell and is scaled up pixelated by a whole
// number of device pixels (a cell is 2 CSS px rounded to device pixels),
// snapped to the device grid, so every cell is a crisp square at any DPR.
// Frames run only during the reveal on arrival (the image develops from the
// bottom up, sparse to full); at rest nothing runs. Without WebGL2 (or after
// a lost context) the host gets data-state="static" and a pre-dithered image
// shows instead.

import { PAL_DARK, PAL_LIGHT, type Swatch } from './palette';

type V3 = [number, number, number];

const BASE = '/footer/';
/** Dot cell, CSS px. */
const PITCH = 2;
/** The clock tower's centre, as a fraction of the photo's width; narrow
 *  screens crop toward it. */
const TOWER_X = 0.505;
const REVEAL_MS = 1600;
/** Dark theme: the lights come up after the land: windows in a staggered,
 *  organic order, then the tower from its base, then the lantern and the
 *  clocks. Starts LIGHT_DELAY ms into the reveal, lasts LIGHT_T s (+0.45 s
 *  for the last to ease in); the start times are baked in koc-mat-dark. */
const LIGHT_DELAY = 1000;
const LIGHT_T = 2.4;
/** Rows of sea added above the photo by the pipeline (source px). */
const SRC_PAD = 70;
/** Dark glass (OKLab), as baked by the pipeline. */
const GLASS = '0.22, -0.006, -0.018';
/** Ordered-dither strength: OKLab lightness spread across the matrix. */
const SPREAD = 0.11;
/** Unsharp amount at the cell scale. */
const SHARP = 0.7;
/** The bottom dissolve above the sign-off row, CSS px. */
const FADE_BOTTOM = 64;
const MAXP = 48;

const VERT = `#version 300 es
in vec2 aP;
void main() { gl_Position = vec4(aP, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImg, uMat, uNoise;
uniform vec2 uGrid;
uniform int uN;
uniform vec3 uPal[${MAXP}];
uniform vec3 uRGB[${MAXP}];
uniform int uFam[${MAXP}];
uniform int uMatFam[10];
uniform vec3 uBg;
uniform float uDark, uP, uSpread, uFadeBot, uLight;
out vec4 o;

float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a) + 0.5 / 64.0; }

// Blue noise, 64 x 64 cells, tiled (void and cluster, public/footer/bluenoise.png).
float bn(vec2 c) { return texelFetch(uNoise, ivec2(mod(c, 64.0)), 0).r; }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 oklab(vec3 srgb) {
  vec3 c = toLin(srgb);
  vec3 lms = mat3(0.4122214708, 0.2119034982, 0.0883024619,
                  0.5363325363, 0.6806995451, 0.2817188376,
                  0.0514459929, 0.1073969566, 0.6299787005) * c;
  lms = sign(lms) * pow(abs(lms), vec3(1.0 / 3.0));
  return mat3(0.2104542553, 1.9779984951, 0.0259040371,
              0.7936177850, -2.4285922050, 0.7827717662,
              -0.0040720468, 0.4505937099, -0.8086757660) * lms;
}

void main() {
  // Cell coordinates, y down from the top of the art.
  vec2 cell = vec2(gl_FragCoord.x - 0.5, uGrid.y - 0.5 - gl_FragCoord.y);
  ivec2 ic = ivec2(cell);
  vec4 s = texelFetch(uImg, ic, 0);
  vec4 mt = texelFetch(uMat, ic, 0);
  int mat = int(mt.r * 255.0 / 30.0 + 0.5);
  int famOk = uMatFam[clamp(mat, 0, 9)];
  float thr = bayer8(cell);
  // Presence (the fades into the page) thresholds on blue noise, nudged by a
  // slow value noise (~30 px), so both edges dissolve irregularly: no row of
  // first dots at the top of the sea, no last straight row above the sign-off.
  float vn = 0.65 * vnoise(cell * 0.07) + 0.35 * vnoise(cell * 0.19 + 17.0);
  float thrP = clamp(bn(cell) + (vn - 0.5) * 0.45, 0.004, 0.996);
  // Reveal: a soft front rising from the bottom; behind it the lattice fills in.
  float yN = (cell.y + 0.5) / uGrid.y;
  float band = 0.45;
  float v = uP < 0.0 ? 0.0 : clamp((uP * (1.0 + band) - (1.0 - yN)) / band, 0.0, 1.0);
  // The bottom edge dissolves into the page above the sign-off row.
  float fb = clamp((uGrid.y - cell.y - 0.5) / uFadeBot, 0.0, 1.0);
  fb = fb * fb * (3.0 - 2.0 * fb);
  // (Alpha within 2 % of opaque is opaque: webp's alpha jitter must not punch
  // a lattice of holes into the picture.)
  float a = clamp((s.a - 0.02) / 0.96, 0.0, 1.0) * v * fb;
  vec3 col = uBg;
  if (a > thrP) {
    vec3 x = oklab(s.rgb);
    // Dark theme: the lights.
    if (uDark > 0.5 && mat == 8) {
      // A window cell: G its light (0 = dark glass or a bar), B its start;
      // the exact R carries the room's colour temperature (-1 cool .. 1
      // warm). It eases in over ~0.45 s and only ever gains light.
      float u = mt.g;
      float st = mt.b * ${LIGHT_T.toFixed(2)};
      float on = u > 0.0 ? smoothstep(st, st + 0.45, uLight) : 0.0;
      float tp = clamp((mt.r * 255.0 - 240.0) / 4.0, -1.0, 1.0);
      tp = u > 0.5 ? tp : max(tp, 0.2); // dim rooms are lamplit, never screen-cool
      float warm = fract(mt.b * 157.31);
      vec3 lamp = vec3(0.30 + 0.40 * u,
                       mix(0.000, 0.009 + 0.008 * warm, smoothstep(-1.0, 0.2, tp)),
                       mix(-0.004, 0.050 + 0.026 * warm, smoothstep(-1.0, 0.2, tp)));
      lamp.x -= 0.06 * step(tp, -0.35);
      x = mix(vec3(${GLASS}), lamp, on);
    } else if (uDark > 0.5 && mt.g > 0.0 && (mat == 2 || mat == 3 || mat == 5)) {
      // Sill and spill: the window's light added to the wall, warm.
      float g = mt.g;
      float st = mt.b * ${LIGHT_T.toFixed(2)};
      float on = smoothstep(st, st + 0.45, uLight);
      x.x += 0.42 * g * on;
      x.yz = mix(x.yz, vec2(0.012, 0.062), clamp(g * 2.2, 0.0, 0.85) * on);
      famOk |= (1 << 9);
    } else if (uDark > 0.5 && mt.g > 0.0) {
      // The tower's light (baked into the image): G the lightness it adds
      // (0..0.5), B when it comes on; before its time the pixel is its
      // unlit self, and it only ever gains light.
      float g = mt.g * 0.5;
      float st = mt.b * ${LIGHT_T.toFixed(2)};
      float off = 1.0 - smoothstep(st, st + 0.45, uLight);
      x.x -= g * off;
      x.yz = mix(x.yz, vec2(-0.006, -0.014), off * clamp(g * 3.0, 0.0, 1.0));
    }
    // In the bottom dissolve the canopy also lifts toward the page, so it
    // thins out rather than ending on a band of dark specks.
    float lift = pow(1.0 - fb, 0.7);
    x = mix(x, oklab(uBg), lift * (uDark > 0.5 ? 0.55 : 0.6));
    if (lift > 0.15) famOk |= (1 << 7);
    x.x += (thr - 0.5) * uSpread;
    int idx = 1;
    float d1 = 1e9;
    for (int i = 1; i < ${MAXP}; i++) {
      if (i >= uN) break;
      if (((famOk >> uFam[i]) & 1) == 0) continue;
      vec3 e = x - uPal[i];
      // Lightness counts a little more than hue: the lattice reads as tone.
      float d = e.x * e.x * 1.4 + e.y * e.y + e.z * e.z;
      if (d < d1) { d1 = d; idx = i; }
    }
    col = uRGB[idx];
  }
  o = vec4(col, 1.0);
}`;

function parseColor(s: string): V3 {
  const c = document.createElement('canvas').getContext('2d')!;
  c.fillStyle = s;
  const v = c.fillStyle as string;
  if (v.startsWith('#')) {
    const n = parseInt(v.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = v.match(/[\d.]+/g)!.map(Number);
  return [m[0] / 255, m[1] / 255, m[2] / 255];
}

const hex = (h: string): V3 => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklab([r, g, b]: V3): V3 {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Which ramps (palette families) a cell of each material may use.
 *  Materials (koc-mat*.webp): 1 forest, 2 stone, 3 roofs, 4 sea, 5 shade,
 *  6 far forest under haze, 7 the tower, 8 a window, lit or dark glass
 *  (dark map only), 9 the clock faces (dark map only). Families (palette.ts): 1 forest, 2 stone, 3 roofs, 4 sea,
 *  5 shade, 7 haze, 8 the tower, 9 lamps, 10 the clock white (both dark
 *  only; in light the clock white is in the tower's family). */
const MAT_FAMS: number[][] = [[1, 2, 3, 4, 5, 7], [1], [2, 5], [3, 5], [4], [5, 2], [1, 7], [8, 5], [9, 5], [10, 5, 8]];
const famMask = (fs: number[]) => fs.reduce((m, f) => m | (1 << f), 0);

type Key = 'light' | 'dark' | 'mat' | 'matDark' | 'noise';

/** The photo as AVIF where the browser decodes it (about 30 % lighter), webp
 *  otherwise; the material map and the noise are lossless. */
const SRC: Record<Key, string[]> = {
  light: ['koc-light.avif', 'koc-light.webp'],
  dark: ['koc-dark.avif', 'koc-dark.webp'],
  mat: ['koc-mat.webp'],
  matDark: ['koc-mat-dark.webp'],
  noise: ['bluenoise.png'],
};

export function mountFooterArt(host: HTMLElement) {
  const canvas = host.querySelector('canvas')!;
  const footer = host.closest<HTMLElement>('footer');
  const toStatic = () => {
    host.dataset.state = 'static';
  };
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return toStatic();
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('footer art:', gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, 'aP');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('footer art: shader failed, showing the still', gl.getProgramInfoLog(prog));
    return toStatic();
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(
    ['uImg', 'uMat', 'uNoise', 'uGrid', 'uN', 'uPal', 'uRGB', 'uFam', 'uMatFam', 'uBg', 'uDark', 'uP', 'uSpread', 'uFadeBot', 'uLight'].map((n) => [n, gl.getUniformLocation(prog, n)]),
  );
  const mkTex = (unit: number) => {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const tex = mkTex(0);
  const mtex = mkTex(1);
  const ntex = mkTex(2);
  gl.uniform1i(U.uImg, 0);
  gl.uniform1i(U.uMat, 1);
  gl.uniform1i(U.uNoise, 2);
  gl.uniform1iv(U.uMatFam, new Int32Array(MAT_FAMS.map(famMask)));
  gl.uniform1f(U.uSpread, SPREAD);

  let lost = false;
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    toStatic();
  });

  let dark = false;
  let bg: V3 = [0.99, 0.99, 0.99];
  let NX = 1, NY = 1, cellDev = 2;

  // Images: fetched once the footer is within a viewport of the screen; the
  // other theme's follow when the browser is idle, so a theme switch redraws
  // the footer at once, inside the page's cross-fade, instead of after it.
  const imgs: Partial<Record<Key, HTMLImageElement>> = {};
  const loading: Partial<Record<Key, Promise<HTMLImageElement>>> = {};
  const load = (k: Key) =>
    (loading[k] ??= new Promise<HTMLImageElement>((res, rej) => {
      const urls = [...SRC[k]];
      const next = () => {
        const u = urls.shift();
        if (!u) return rej(new Error(k));
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => {
          imgs[k] = im;
          res(im);
        };
        im.onerror = next;
        im.src = BASE + u;
      };
      next();
    }));

  // Dark theme: the windows (koc-windows.json), each the projected quad of
  // its opening on its facade, in the photo's own pixels: q = [x0, x1, head
  // at x0, head at x1, sill at x0, sill at x1], with its glazing (c lights
  // across, rw down, transoms t), light per light (u), start (s), and its
  // life: a blind drawn at the top (bl), a lamp at one side (sd), colour
  // temperature (tp, -1 cool .. 1 warm), the side whose jamb shows (j).
  interface Win {
    q: [number, number, number, number, number, number];
    c: number;
    rw: number;
    t: number[];
    u: number[];
    s: number;
    bl: number;
    sd: number;
    tp: number;
    j: number;
  }
  let wins: Win[] | null = null;
  let winsLoading: Promise<void> | null = null;
  const loadWins = () =>
    (winsLoading ??= fetch(BASE + 'koc-windows.json')
      .then((r) => r.json())
      .then((w: Win[]) => {
        wins = w;
      }));

  /** Rasterise the windows into the cell-resolution material map (R: 8 =
   *  window, its exact value carrying the colour temperature; G: light;
   *  B: start), and their sills and spill (R: wall, G: light added).
   *  Each quad is sampled 4 x 4 per cell, so slanted heads and sills step
   *  consistently; lights, bars and the transom follow the facade's lines
   *  (a transom at the same fraction between head and sill in every
   *  column). Inside, the light is a room's: brighter low and central,
   *  dimmer under the head, a blind or a side lamp in some; the jamb on the
   *  receding side is one dark cell; the sill below catches the light, and
   *  a faint wash falls on the wall within ~3 cells. Every light and bar is
   *  at least one cell, and separate openings never touch. */
  const paintWindows = (ox: number, pw: number, ph: number, srcW: number, srcH: number) => {
    if (!wins) return;
    const sx = pw / srcW;
    const sy = ph / srcH;
    const fadeCells = (FADE_BOTTOM * Math.max(0.5, devicePixelRatio || 1)) / cellDev;
    const W = NX, H = NY;
    const kind = new Uint8Array(W * H); // 0 none, 1 glass, 2 bar/jamb, 3 sill/spill
    const light = new Float32Array(W * H);
    const temp = new Float32Array(W * H);
    const start = new Float32Array(W * H);
    const owner = new Int32Array(W * H).fill(-1);
    const sorted = [...wins].sort((a, b) => a.q[0] - b.q[0]);
    sorted.forEach((w, wi) => {
      const [x0, x1, t0, t1, b0, b1] = w.q;
      const X0 = ox + x0 * sx, X1 = ox + x1 * sx;
      const T0 = (t0 + SRC_PAD) * sy, T1 = (t1 + SRC_PAD) * sy;
      const B0 = (b0 + SRC_PAD) * sy, B1 = (b1 + SRC_PAD) * sy;
      if (Math.max(B0, B1) > H - fadeCells) return;
      // At least one cell wide and two tall: widen thin panes about their centre.
      let L0 = X0, L1 = X1;
      const need = Math.max(1, w.c * 2 - 1);
      if (L1 - L0 < need) {
        const m = (L0 + L1) / 2;
        L0 = m - need / 2;
        L1 = m + need / 2;
      }
      const head = (x: number) => T0 + ((T1 - T0) * (x - L0)) / Math.max(1e-6, L1 - L0);
      const sill = (x: number) => B0 + ((B1 - B0) * (x - L0)) / Math.max(1e-6, L1 - L0);
      // Columns: the opening's width rounded to whole cells (at least one per
      // light plus one per bar), centred on its true centre; a column that
      // would touch another opening is given up, so piers stay.
      const nWant = Math.max(need, Math.round(L1 - L0));
      const first = Math.round((L0 + L1) / 2 - nWant / 2);
      const rowsAt = (cx: number) => {
        const xc = cx + 0.5;
        return [Math.round(head(xc)), Math.max(Math.round(head(xc)) + 2, Math.round(sill(xc)))];
      };
      const touches = (cx: number) => {
        const [r0, r1] = rowsAt(cx);
        for (const nx of [cx - 1, cx, cx + 1]) {
          if (nx < 0 || nx >= W) continue;
          for (let cy = r0 - 1; cy <= r1; cy++) {
            if (cy < 0 || cy >= H) continue;
            const o = owner[cy * W + nx];
            if (o >= 0 && o !== wi && kind[cy * W + nx] !== 3) return true;
          }
        }
        return false;
      };
      let cols: number[] = [];
      for (let cx = first; cx < first + nWant; cx++) if (cx >= 0 && cx < W) cols.push(cx);
      while (cols.length > need && touches(cols[0])) cols.shift();
      while (cols.length > need && touches(cols[cols.length - 1])) cols.pop();
      if (cols.some(touches)) return;
      // Mullions: c lights across, the bars on whole cells, spread evenly.
      const nc = cols.length;
      const lightCols: number[] = new Array(nc).fill(0);
      if (w.c > 1 && nc >= 2 * w.c - 1) {
        for (let k = 1; k < w.c; k++) {
          const at = Math.round((k * (nc + 1)) / w.c) - 1;
          if (at > 0 && at < nc - 1) lightCols[at] = -1;
        }
      }
      let li = 0;
      for (let a = 0; a < nc; a++) {
        if (lightCols[a] === -1) li++;
        else lightCols[a] = li;
      }
      // Jamb: the receding side's edge column is the reveal, if the window
      // is wide enough to keep two cells of glass per light.
      const jambCol = w.j !== 0 && nc >= 3 + (w.c - 1) * 3 ? (w.j > 0 ? nc - 1 : 0) : -1;
      cols.forEach((cx, a) => {
        const xc = cx + 0.5;
        const hTop = head(xc), hBot = sill(xc);
        let r0 = Math.round(hTop), r1 = Math.round(hBot);
        if (r1 - r0 < 2) r1 = r0 + 2;
        const span = r1 - r0;
        // transoms: at their fraction between head and sill, in this column
        const bars = new Set<number>();
        if (w.rw > 1) for (let k = 1; k < w.rw; k++) bars.add(r0 + Math.round((k * span) / w.rw - 0.5));
        const origH = (w.q[4] + w.q[5] - w.q[2] - w.q[3]) / 2;
        for (const t of w.t) if (origH > 0) bars.add(r0 + Math.round((t / origH) * span - 0.5));
        for (let cy = r0; cy < r1; cy++) {
          if (cy < 0 || cy >= H) continue;
          const id = cy * W + cx;
          if (owner[id] >= 0 && owner[id] !== wi) continue;
          owner[id] = wi;
          start[id] = w.s;
          temp[id] = w.tp;
          if (a === jambCol) {
            kind[id] = 4; // the reveal: dark
            continue;
          }
          if (lightCols[a] === -1 || bars.has(cy)) {
            kind[id] = 2; // a bar: the painted frame, the wall's own tone
            continue;
          }
          kind[id] = 1;
          const u = w.u[lightCols[a]] ?? w.u[0];
          if (u <= 0) continue;
          // the room: brighter low and central, dimmer under the head
          const fy = (cy + 0.5 - hTop) / Math.max(1, hBot - hTop); // 0 head .. 1 sill
          const fx = nc > 1 ? a / (nc - 1) : 0.5; // 0 left .. 1 right
          let v = 0.66 + 0.34 * Math.sin(Math.PI * Math.min(1, 0.15 + fy * 1.05));
          v *= 1 - 0.16 * Math.abs(fx - 0.5);
          if (fy < 0.16) v *= 0.78; // the head's shadow on the glass
          if (w.bl > 0 && fy < w.bl) v *= 0.45;
          if (w.sd) v *= 0.72 + 0.4 * (w.sd > 0 ? fx : 1 - fx);
          light[id] = Math.min(1, u * v);
        }
        // the sill: one cell below, pale stone catching the light, and a
        // faint wash on the wall under it (not for slits: on a one-cell
        // window a lit sill reads as a bulb)
        const uw = Math.max(...w.u);
        if (uw > 0 && nc >= 2) {
          for (let d = 0; d <= 2; d++) {
            const cy = r1 + d;
            if (cy < 0 || cy >= H) continue;
            const id = cy * W + cx;
            if (owner[id] >= 0 && kind[id] !== 3) continue;
            const g = d === 0 ? 0.24 * uw : 0.09 * uw * (d === 1 ? 1 : 0.5);
            if (kind[id] === 0 || g > light[id]) {
              kind[id] = 3;
              owner[id] = wi;
              light[id] = Math.max(light[id], g);
              start[id] = w.s;
              temp[id] = w.tp;
            }
          }
        }
      });
    });
    // Write: windows R 236..244 (8, temperature in the offset), G light,
    // B start; sills and spill keep the wall's material, G the light added.
    const md = mctx.getImageData(0, 0, W, H);
    const d = md.data;
    for (let id = 0; id < W * H; id++) {
      const k = kind[id];
      if (!k) continue;
      const o = id * 4;
      const st = Math.round(start[id] * 255);
      if (k === 2) continue;
      if (k === 1 || k === 4) {
        d[o] = 240 + Math.round(temp[id] * 4);
        d[o + 1] = k === 1 ? Math.round(light[id] * 255) : 0;
        d[o + 2] = st;
      } else {
        const m = Math.round(d[o] / 30);
        if (m !== 2 && m !== 5 && m !== 3) continue;
        d[o + 1] = Math.max(1, Math.round(light[id] * 255));
        d[o + 2] = st;
      }
      d[o + 3] = 255;
    }
    mctx.putImageData(md, 0, 0);
  };

  const cellCanvas = document.createElement('canvas');
  const cctx = cellCanvas.getContext('2d', { willReadFrequently: true })!;
  const matCanvas = document.createElement('canvas');
  const mctx = matCanvas.getContext('2d')!;

  const readTheme = () => {
    const cs = getComputedStyle(host);
    bg = parseColor(cs.getPropertyValue('--bg').trim() || '#fcfcfc');
    dark = 0.3 * bg[0] + 0.59 * bg[1] + 0.11 * bg[2] < 0.5;
    const sw = ([['#000000', 0], ...(dark ? PAL_DARK : PAL_LIGHT)] as Swatch[]).slice(0, MAXP);
    const rgb = sw.map(([h]) => hex(h));
    rgb[0] = bg;
    gl.uniform1i(U.uN, sw.length);
    gl.uniform3fv(U.uPal, new Float32Array(rgb.map(oklab).flat()));
    gl.uniform3fv(U.uRGB, new Float32Array(rgb.flat()));
    gl.uniform1iv(U.uFam, new Int32Array(sw.map(([, f]) => f)));
    gl.uniform3fv(U.uBg, bg);
    gl.uniform1f(U.uDark, dark ? 1 : 0);
  };

  /** Unsharp mask at the cell scale (3 x 3 binomial) on the cell canvas: the
   *  downscale's softness taken back, so roof edges, windows and the clock
   *  stay crisp at one cell. Alpha untouched. */
  const sharpen = () => {
    const id = cctx.getImageData(0, 0, NX, NY);
    const s = id.data;
    const src = new Uint8ClampedArray(s);
    const W = NX, H = NY;
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - 1), y1 = Math.min(H - 1, y + 1);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (src[i + 3] === 0) continue;
        const x0 = Math.max(0, x - 1), x1 = Math.min(W - 1, x + 1);
        for (let c = 0; c < 3; c++) {
          const b =
            (src[(y0 * W + x0) * 4 + c] + 2 * src[(y0 * W + x) * 4 + c] + src[(y0 * W + x1) * 4 + c] +
              2 * src[(y * W + x0) * 4 + c] + 4 * src[i + c] + 2 * src[(y * W + x1) * 4 + c] +
              src[(y1 * W + x0) * 4 + c] + 2 * src[(y1 * W + x) * 4 + c] + src[(y1 * W + x1) * 4 + c]) / 16;
          s[i + c] = src[i + c] + SHARP * (src[i + c] - b);
        }
      }
    }
    cctx.putImageData(id, 0, 0);
  };

  /** Lay the photo into the cell grid: its top (the faded sea band) at the
   *  top of the art, covering the width, the foreground canopy cropped at the
   *  bottom where the art dissolves above the sign-off row. Narrow screens
   *  crop the sides toward the tower; very wide ones let the sides dissolve. */
  let placed = false;
  let noiseUp = false;
  const place = () => {
    const im = imgs[dark ? 'dark' : 'light'];
    const mat = imgs[dark ? 'matDark' : 'mat'];
    if (!im || !mat || !imgs.noise || (dark && !wins) || NX < 2 || NY < 2) return false;
    const cellCss = cellDev / Math.max(1, devicePixelRatio);
    const asp = im.naturalWidth / im.naturalHeight;
    // Phones: a little closer, so the tower carries the frame.
    let ph = NY * (NX * cellCss < 640 ? 1.04 : 1);
    let pw = ph * asp;
    let fadeSides = false;
    if (pw < NX) {
      const need = NX / asp;
      if (need <= NY * 1.3) {
        ph = need;
        pw = NX;
      } else {
        ph = NY * 1.3;
        pw = ph * asp;
        fadeSides = true;
      }
    }
    pw = Math.round(pw);
    ph = Math.round(ph);
    const ox = pw > NX ? Math.min(0, Math.max(NX - pw, Math.round(NX / 2 - TOWER_X * pw))) : Math.round((NX - pw) / 2);
    cellCanvas.width = matCanvas.width = NX;
    cellCanvas.height = matCanvas.height = NY;
    cctx.clearRect(0, 0, NX, NY);
    cctx.imageSmoothingEnabled = true;
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(im, ox, 0, pw, ph);
    mctx.clearRect(0, 0, NX, NY);
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(mat, ox, 0, pw, ph);
    if (dark) paintWindows(ox, pw, ph, im.naturalWidth, im.naturalHeight);
    if (fadeSides) {
      const g = cctx.createLinearGradient(ox, 0, ox + pw, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.12, 'rgba(0,0,0,1)');
      g.addColorStop(0.88, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      cctx.globalCompositeOperation = 'destination-in';
      cctx.fillStyle = g;
      cctx.fillRect(0, 0, NX, NY);
      cctx.globalCompositeOperation = 'source-over';
    }
    sharpen();
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cellCanvas);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mtex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, matCanvas);
    if (!noiseUp && imgs.noise) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, ntex);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, imgs.noise);
      noiseUp = true;
    }
    placed = true;
    return true;
  };

  /** Size the grid to the host: cells of PITCH CSS px rounded to whole device
   *  pixels, one canvas pixel per cell, the canvas scaled up by exactly that
   *  many device pixels and snapped to the device grid. */
  const layout = () => {
    const dpr = Math.max(0.5, devicePixelRatio || 1);
    cellDev = Math.max(1, Math.round(PITCH * dpr));
    const box = host.getBoundingClientRect();
    NX = Math.max(1, Math.ceil((box.width * dpr) / cellDev));
    NY = Math.max(1, Math.ceil((box.height * dpr) / cellDev));
    canvas.width = NX;
    canvas.height = NY;
    canvas.style.width = `${(NX * cellDev) / dpr}px`;
    canvas.style.height = `${(NY * cellDev) / dpr}px`;
    const fx = box.left * dpr - Math.round(box.left * dpr);
    const fy = (box.top + scrollY) * dpr - Math.round((box.top + scrollY) * dpr);
    canvas.style.transform = Math.abs(fx) > 0.01 || Math.abs(fy) > 0.01 ? `translate(${-fx / dpr}px, ${-fy / dpr}px)` : '';
    gl.viewport(0, 0, NX, NY);
    gl.uniform2f(U.uGrid, NX, NY);
    gl.uniform1f(U.uFadeBot, Math.max(2, (FADE_BOTTOM * dpr) / cellDev));
    place();
  };

  // Timeline: hidden until the reader arrives, then the reveal (and, in the
  // dark theme, the lights), then rest.
  let p = -1;
  let light = -1;
  let t0 = 0;
  let raf = 0;
  let stale = false;
  let pending = false;
  const END_LIGHT = LIGHT_T + 0.5;
  const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const draw = () => {
    if (!placed || lost) return;
    gl.uniform1f(U.uP, p < 0 ? -1 : ease(p));
    gl.uniform1f(U.uLight, light);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const tick = (now: number) => {
    raf = 0;
    const el = now - t0;
    p = Math.min(1, el / REVEAL_MS);
    light = dark ? Math.min(END_LIGHT, Math.max(0, (el - LIGHT_DELAY) / 1000)) : END_LIGHT;
    draw();
    if (p < 1 || light < END_LIGHT) raf = requestAnimationFrame(tick);
  };
  const start = () => {
    stale = false;
    if (!placed) {
      pending = true;
      return;
    }
    if (raf) cancelAnimationFrame(raf);
    p = 0;
    light = dark ? 0 : END_LIGHT;
    t0 = performance.now();
    draw();
    raf = requestAnimationFrame(tick);
  };
  // Switching to the dark theme with the footer in view: the campus goes dark
  // inside the page's cross-fade and its windows light up again, as on
  // arrival, the reveal itself left as it is.
  const RELIGHT_DELAY = 300;
  const relight = () => {
    if (raf) cancelAnimationFrame(raf);
    const l0 = performance.now() + RELIGHT_DELAY;
    light = 0;
    draw();
    const step = (now: number) => {
      raf = 0;
      light = Math.min(END_LIGHT, Math.max(0, (now - l0) / 1000));
      draw();
      if (light < END_LIGHT) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const reset = () => {
    stale = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    p = -1;
    light = -1;
    draw();
  };

  const ready = async () => {
    try {
      await Promise.all([load(dark ? 'dark' : 'light'), load(dark ? 'matDark' : 'mat'), load('noise'), ...(dark ? [loadWins()] : [])]);
    } catch {
      return toStatic();
    }
    if (!place()) return;
    host.dataset.state = 'live';
    draw();
    if (pending) {
      pending = false;
      start();
    }
    const other = () =>
      Promise.all([load(dark ? 'light' : 'dark'), load(dark ? 'mat' : 'matDark'), ...(dark ? [] : [loadWins()])]).catch(() => {});
    if ('requestIdleCallback' in window) requestIdleCallback(other, { timeout: 4000 });
    else setTimeout(other, 1500);
  };

  let near = false;
  new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting && !near) {
        near = true;
        ready();
      }
    },
    { rootMargin: '100% 0px 100% 0px' },
  ).observe(host);
  let inView = false;
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (!e.isIntersecting && stale) reset();
  }).observe(host);
  new ResizeObserver(() => {
    layout();
    draw();
  }).observe(host);
  // A move to a screen of another pixel ratio resizes nothing: watch it.
  const watchDpr = () => {
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener(
      'change',
      () => {
        layout();
        draw();
        watchDpr();
      },
      { once: true },
    );
  };
  watchDpr();
  const retheme = () => {
    const wasDark = dark;
    readTheme();
    if (!place()) {
      placed = false;
      if (near) ready();
    }
    draw();
    if (dark && !wasDark && placed && inView && p >= 1) relight();
  };
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  footer?.addEventListener('footer:light', start);
  footer?.addEventListener('footer:rearm', () => {
    stale = true;
  });

  readTheme();
  layout();
}
