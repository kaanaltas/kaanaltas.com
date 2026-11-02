// The pixel "KA" sign-off's hover story (Footer.astro, PixelKA.astro): a
// wave runs through the letters' pixel columns, the way a ripple runs down a
// plucked string. Departure Mono is
// drawn on an 11-unit grid, so each glyph is a few columns of square pixels;
// each column steps up one pixel, two, one, and lands, a little after its
// neighbour. It runs away from the side the pointer came in from (left to
// right for keyboard focus), plays once per hover and never loops. Motion
// lives in PixelKA.astro; this file only lays out the columns and starts it.
//
// How it stays exact. The mark is the real text at rest. For the story, ten
// copies of that same text are shown, each clipped to one pixel column, and
// the original is hidden. Clip edges and the step are snapped to whole
// device pixels, so each copy rasterises exactly like the original, the ten
// columns add up to the original, and a column that has stepped up is the
// same pixels, moved. When the last column lands the copies are hidden
// again, so the hand-off is invisible both ways.
//
// Font pixels rarely land on device pixels, so the device pixel on each
// column edge holds antialiased ink from one side or the other. Each cut is
// therefore a staircase: row by row it keeps that sliver with the column
// whose ink it is (read off the glyph bitmaps below), so nothing is left
// behind when the columns part.

const GRID = 11; // Departure Mono: 550 units per em, 50-unit pixels, 8 rows to the cap
const ASCENT = 1; // hhea ascent 550 / 550: baseline sits 1em below the content-box top

// Glyph bitmaps, rasterised from DepartureMono-Regular.woff2 (7-pixel advance;
// ink in columns 1–5, rows top to bottom).
const K = ['.#...#.', '.#..#..', '.#.#...', '.###...', '.#..#..', '.#..#..', '.#...#.', '.#...#.'];
const A = ['...#...', '..#.#..', '.#...#.', '.#...#.', '.#####.', '.#...#.', '.#...#.', '.#...#.'];
const ROWS = K.length;

type Side = 'l' | 'r';

// For the cut between glyph columns c and c+1: which side owns the edge
// sliver in each row (whichever is inked when the other is not; blank or
// solid rows follow their neighbours, so the staircase has few steps).
const sides = (g: string[], c: number): Side[] => {
  const raw = g.map((row): Side | null =>
    row[c] === '#' && row[c + 1] !== '#' ? 'l' : row[c] !== '#' && row[c + 1] === '#' ? 'r' : null,
  );
  let last: Side = raw.find((s) => s) ?? 'l';
  return raw.map((s) => (last = s ?? last));
};

/**
 * Binds the wave to any pixel KA: `host` holds .brand-text and .brand-wave and
 * gets data-wave while it plays (its CSS keys off that); `trigger` is the
 * element whose hover, keyboard focus or touch press plays it. Returns the
 * story's player, for a host that also plays it on its own cue.
 */
export function initWave(host: HTMLElement, trigger: HTMLElement = host): ((from?: 'left' | 'right') => void) | undefined {
  const brand = host;
  const text = brand.querySelector<HTMLElement>('.brand-text');
  const wave = brand.querySelector<HTMLElement>('.brand-wave');
  if (!text || !wave) return;

  const cols = [...wave.children] as HTMLElement[];
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let playing = false;
  let guard = 0;

  const end = () => {
    clearTimeout(guard);
    delete brand.dataset.wave;
    playing = false;
  };

  const layout = () => {
    const node = text.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const fs = parseFloat(getComputedStyle(text).fontSize);
    if (!document.fonts.check(`${fs}px "Departure Mono"`)) return false;

    const dpr = devicePixelRatio || 1;
    const px = fs / GRID;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 1);
    const k = range.getBoundingClientRect(); // K's glyph box (the font's content area)
    range.setStart(node, 1);
    range.setEnd(node, 2);
    const a = range.getBoundingClientRect().left;
    // Blink paints text on a whole-pixel baseline (measured: 33.5 paints at 34).
    const base = Math.round(k.top + ASCENT * fs);
    const origin = wave.getBoundingClientRect(); // the copies' own box, which the clips are drawn in

    const snapX = (x: number, side: Side) =>
      (side === 'l' ? Math.ceil(x * dpr - 0.01) : Math.floor(x * dpr + 0.01)) / dpr - origin.left;
    const rowY = (r: number) => Math.round((base - (ROWS - r) * px) * dpr) / dpr - origin.top;

    // A cut is one x per row. Columns 1–5 of each glyph are inked; the cut
    // between K and A sits mid-gap, where there is no ink to share.
    const stair = (g: string[], left: number, c: number) =>
      sides(g, c).map((side) => snapX(left + (c + 1) * px, side));
    const gap = snapX((k.left + 6 * px + a + px) / 2, 'l');
    const cuts: (number[] | null)[] = [
      null,
      ...[1, 2, 3, 4].map((c) => stair(K, k.left, c)),
      Array<number>(ROWS).fill(gap),
      ...[1, 2, 3, 4].map((c) => stair(A, a, c)),
      null,
    ];

    const pt = (x: number, y: number | string) =>
      `${x.toFixed(3)}px ${typeof y === 'number' ? `${y.toFixed(3)}px` : y}`;
    // Walk a cut top to bottom (or back up), stepping at row boundaries.
    const edge = (xs: number[] | null, far: number, down: boolean) => {
      const out = xs ? [pt(xs[0], '-100%')] : [pt(far, '-100%')];
      if (xs) {
        for (let r = 1; r < ROWS; r++) {
          if (xs[r] !== xs[r - 1]) out.push(pt(xs[r - 1], rowY(r)), pt(xs[r], rowY(r)));
        }
      }
      out.push(xs ? pt(xs[ROWS - 1], '200%') : pt(far, '200%'));
      return down ? out : out.reverse();
    };

    cols.forEach((col, i) => {
      const poly = [...edge(cuts[i + 1], origin.width * 2, true), ...edge(cuts[i], -origin.width, false)];
      col.style.clipPath = `polygon(${poly.join(',')})`;
    });
    brand.style.setProperty('--step', `${Math.max(1, Math.round(px * dpr)) / dpr}px`);
    return true;
  };

  const play = (from: 'left' | 'right' = 'left') => {
    if (playing || !layout()) return;
    playing = true;
    brand.dataset.wave = from;
    guard = window.setTimeout(end, 1000); // in case no animationend arrives
  };

  // The last column to land ends the story.
  wave.addEventListener('animationend', (e) => {
    const last = brand.dataset.wave === 'right' ? cols[0] : cols[cols.length - 1];
    if (e.target === last) end();
  });

  trigger.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch' || !fine.matches) return;
    const r = brand.getBoundingClientRect();
    play(e.clientX > r.left + r.width / 2 ? 'right' : 'left');
  });

  // Touch: the press plays it (the :active equivalent).
  trigger.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') play('left');
  });

  trigger.addEventListener('focus', () => {
    if (trigger.matches(':focus-visible')) play('left');
  });

  return play;
}
