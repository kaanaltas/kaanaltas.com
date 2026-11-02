// Build-time TeX -> SVG for the equation mesh. Runs only in Astro frontmatter,
// so MathJax never ships to the browser: the page gets a compact JSON payload
// of Computer Modern outlines that src/scripts/mesh.ts turns into canvas
// sprites (see buildSvg there).
//
// Payload shape, kept small on purpose:
// - every glyph outline is stored once (`d`), as a relative path quantised to
//   `q` font units (1000 units = 1em), shared by all formulas;
// - each formula is its viewBox plus a flat list of placed glyphs and rules,
//   with MathJax's nested groups folded into absolute positions.
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor, type LiteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/base/BaseConfiguration.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import { MESH_FEATURED, MESH_GLYPHS, MESH_KEY, MESH_POOL, type MeshEq } from '../data/equations';

/** One typeset formula, in font units with y pointing down. */
export interface TexItem {
  /** viewBox: min-x, min-y, width, height. */
  v: [number, number, number, number];
  /** Placed glyphs, stride 3 or 4 per entry: glyph index, x, y[, scale ×1000 if not 1]. Scaled entries use a negative glyph index (-1 - index). */
  u: number[];
  /** Rules (fraction bars, radical overbars), stride 4: x, y, width, height. */
  r?: number[];
}

export interface MeshTex {
  /** Quantum of the glyph paths, in font units. */
  q: number;
  /** Glyph outlines. */
  d: string[];
  /** Typeset formulas; the lists below index into this. */
  i: TexItem[];
  /** Glyph nodes. */
  g: number[];
  /** The owner's picks, always placed first (an inner array is one slot with alternatives). */
  k: (number | number[])[];
  /** Featured equations, placed next. */
  f: (number | number[])[];
  /** Pool equations. */
  p: number[];
  /** Expandable equations, flat pairs: closed item index, open item index. */
  o: number[];
}

/** Path quantum. 1em = 1000 units, so 5 units is 0.08px on a 16px glyph. */
const Q = 5;

type Matrix = [number, number, number, number, number, number];
type LiteNode = Parameters<LiteAdaptor['getAttribute']>[0];

const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

function parseTransform(t: string | null): Matrix {
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  if (!t) return m;
  for (const [, fn, args] of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const a = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (fn === 'translate') m = mul(m, [1, 0, 0, 1, a[0], a[1] ?? 0]);
    else if (fn === 'scale') m = mul(m, [a[0], 0, 0, a[1] ?? a[0], 0, 0]);
    else if (fn === 'matrix') m = mul(m, a as Matrix);
    else throw new Error(`tex: unsupported transform ${fn}`);
  }
  return m;
}

/**
 * Rewrite an absolute M/L/H/V/Q/T/Z outline (MathJax's TeX fonts use only
 * these) as a relative path on a grid of `q` units, which roughly halves it.
 */
function compactPath(d: string, q: number): string {
  const tok = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, T: 2, Z: 0 };
  let out = '';
  let last = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const g = (v: number) => Math.round(v / q);
  const emit = (cmd: string, nums: number[]) => {
    // A repeated command letter can be dropped (an implicit repeat), except
    // after a moveto, whose repeats would mean lineto.
    if (cmd !== last || cmd === 'm') out += cmd;
    for (const n of nums) {
      if (n >= 0 && /\d$/.test(out)) out += ' ';
      out += n;
    }
    last = cmd;
  };
  let i = 0;
  let cmd = '';
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    if (!(cmd in arity)) throw new Error(`tex: unsupported path command ${cmd}`);
    const a = tok.slice(i, i + arity[cmd]).map(Number);
    i += arity[cmd];
    switch (cmd) {
      case 'M':
        emit('m', [g(a[0]) - cx, g(a[1]) - cy]);
        cx = sx = g(a[0]);
        cy = sy = g(a[1]);
        cmd = 'L';
        last = 'm';
        break;
      case 'L':
        emit('l', [g(a[0]) - cx, g(a[1]) - cy]);
        cx = g(a[0]);
        cy = g(a[1]);
        break;
      case 'H':
        emit('h', [g(a[0]) - cx]);
        cx = g(a[0]);
        break;
      case 'V':
        emit('v', [g(a[0]) - cy]);
        cy = g(a[0]);
        break;
      case 'Q':
        emit('q', [g(a[0]) - cx, g(a[1]) - cy, g(a[2]) - cx, g(a[3]) - cy]);
        cx = g(a[2]);
        cy = g(a[3]);
        break;
      case 'T':
        emit('t', [g(a[0]) - cx, g(a[1]) - cy]);
        cx = g(a[0]);
        cy = g(a[1]);
        break;
      case 'Z':
        out += 'z';
        last = 'z';
        cx = sx;
        cy = sy;
        break;
    }
  }
  return out;
}

let cached: MeshTex | null = null;

export function meshTex(): MeshTex {
  if (cached) return cached;

  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const doc = mathjax.document('', {
    InputJax: new TeX({ packages: ['base', 'ams', 'boldsymbol'] }),
    OutputJax: new SVG({ fontCache: 'local' }),
  });

  const glyphs: string[] = [];
  const glyphIndex = new Map<string, number>();
  const items: TexItem[] = [];
  const itemIndex = new Map<string, number>();
  const r = Math.round;

  const typeset = (tex: string, display: boolean): number => {
    const key = `${display ? 'D' : 'I'}${tex}`;
    const seen = itemIndex.get(key);
    if (seen !== undefined) return seen;

    const container = doc.convert(tex, { display });
    const svg = adaptor.firstChild(container) as LiteNode;
    if (/merror|data-mjx-error/.test(adaptor.outerHTML(svg))) throw new Error(`tex: error in mesh equation ${tex}`);

    // MathJax names outlines MJX-<n>-TEX-<variant>-<codepoint>, <n> per formula.
    const local = new Map<string, number>();
    const u: number[] = [];
    const rules: number[] = [];

    const walk = (node: LiteNode, m: Matrix) => {
      const kind = adaptor.kind(node);
      if (kind === '#text' || kind === '#comment' || kind === 'title') return;
      if (kind === 'defs') {
        for (const p of adaptor.childNodes(node) as LiteNode[]) {
          if (adaptor.kind(p) !== 'path') continue;
          const id = adaptor.getAttribute(p, 'id');
          const name = id.replace(/^MJX-\d+-/, '');
          let gi = glyphIndex.get(name);
          if (gi === undefined) {
            gi = glyphs.push(compactPath(adaptor.getAttribute(p, 'd'), Q)) - 1;
            glyphIndex.set(name, gi);
          }
          local.set(id, gi);
        }
        return;
      }
      const mm = mul(m, parseTransform(adaptor.getAttribute(node, 'transform')));
      if (mm[1] || mm[2]) throw new Error('tex: rotation/skew not supported');
      if (kind === 'g') {
        for (const c of adaptor.childNodes(node) as LiteNode[]) walk(c, mm);
      } else if (kind === 'use') {
        const href = (adaptor.getAttribute(node, 'xlink:href') || adaptor.getAttribute(node, 'href')).slice(1);
        const gi = local.get(href);
        if (gi === undefined) throw new Error(`tex: unknown glyph ${href}`);
        const x = Number(adaptor.getAttribute(node, 'x') || 0);
        const y = Number(adaptor.getAttribute(node, 'y') || 0);
        const at = mul(mm, [1, 0, 0, 1, x, y]);
        // Outlines are y-up and the root group flips them: a = s, d = -s.
        const s = at[0];
        if (Math.abs(s + at[3]) > 1e-6) throw new Error('tex: non-uniform glyph scale');
        if (Math.abs(s - 1) < 1e-6) u.push(gi, r(at[4]), r(at[5]));
        else u.push(-1 - gi, r(at[4]), r(at[5]), r(s * 1000));
      } else if (kind === 'rect') {
        const n = (a: string) => Number(adaptor.getAttribute(node, a) || 0);
        const x0 = mm[0] * n('x') + mm[4];
        const y0 = mm[3] * n('y') + mm[5];
        const x1 = mm[0] * (n('x') + n('width')) + mm[4];
        const y1 = mm[3] * (n('y') + n('height')) + mm[5];
        rules.push(r(Math.min(x0, x1)), r(Math.min(y0, y1)), r(Math.abs(x1 - x0)), r(Math.abs(y1 - y0)));
      } else {
        throw new Error(`tex: unsupported element <${kind}> in ${tex}`);
      }
    };

    // defs come first in MathJax's output, so glyph ids resolve before use.
    for (const c of adaptor.childNodes(svg) as LiteNode[]) walk(c, [1, 0, 0, 1, 0, 0]);

    const vb = String(adaptor.getAttribute(svg, 'viewBox')).split(/\s+/).map((n: string) => r(Number(n)));
    const item: TexItem = { v: vb as TexItem['v'], u };
    if (rules.length) item.r = rules;
    itemIndex.set(key, items.push(item) - 1);
    return items.length - 1;
  };

  const g = MESH_GLYPHS.map((t) => typeset(t, false));
  // Expandable equations also typeset their open form (display style).
  const o: number[] = [];
  const eq = (e: MeshEq) => {
    if (typeof e === 'string') return typeset(e, true);
    const closed = typeset(e.tex, true);
    if (e.open) o.push(closed, typeset(e.open, true));
    return closed;
  };
  const slots = (list: (MeshEq | MeshEq[])[]) => list.map((e) => (Array.isArray(e) ? e.map(eq) : eq(e)));
  const k = slots(MESH_KEY);
  const f = slots(MESH_FEATURED);
  const p = MESH_POOL.map(eq);

  cached = { q: Q, d: glyphs, i: items, g, k, f, p, o };
  return cached;
}

/** JSON for an inline <script type="application/json">, safe against `</script>`. */
export function meshTexJson(): string {
  return JSON.stringify(meshTex()).replace(/</g, '\\u003c');
}
