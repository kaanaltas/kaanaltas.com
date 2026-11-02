// Motion for the header's Compass mark (markup in src/components/BrandCompass.astro).
//
// Intro, on every fresh open of the page (1.04 s). The stem and the A's legs are
// drawn down from the cap line like pen strokes, the arm from the cap into
// the stem's mid-axis J. There a hairline radius appears from the A's apex to
// J, with a faint construction arc, and swings about the apex like a compass
// arm: the K's leg draws behind its tip, runs on through the A's left leg and
// becomes the crossbar, stopping inside the right leg. The guides fade as it
// lands, and the rest path takes over. The page sets html[data-cm-intro]
// before first paint on a fresh open (first launch, reload, arrival from
// another site); moving between the site's own pages shows the rest mark.
//
// Hover, keyboard focus and touch press (1.05 s): the arc retracts into the
// joint and is swept again about the apex, the way the intro drew it, with
// no construction shown. The stems stay still; the K's leg is empty only
// around the turn. One-shot: it runs to its end even if the pointer leaves,
// and a new trigger waits for it.
//
// Only transform, opacity and stroke-dashoffset animate. It plays whatever the
// OS motion setting (the site's policy). Every story ends on the rest path.
import { compass } from '../lib/compass-mark';

const [AX, AY] = compass.apex;
const START = compass.a0; // the radius leaves the joint at 143.13°
const END = 64; // the half-plane's edge past the arc's hidden end (70°)

const OUT = 'cubic-bezier(.23,1,.32,1)'; // --ease-out
const SWING = 'cubic-bezier(.55,0,.15,1)'; // the compass starts from rest and settles

// The same function list at every keyframe: from 'none', the translates would
// interpolate on their own and the pivot would slide off the apex.
const turn = (deg: number) => `translate(${AX}px, ${AY}px) rotate(${deg}deg) translate(${-AX}px, ${-AY}px)`;

type Story = 'intro' | 'hover';
type Run = { kind: Story; anims: Animation[]; ink: Animation[] };
const running = new WeakMap<SVGSVGElement, Run>();

function stop(svg: SVGSVGElement) {
  running.get(svg)?.anims.forEach((a) => a.cancel());
  running.delete(svg);
  delete svg.dataset.mode;
  delete svg.dataset.ink;
}

function play(svg: SVGSVGElement, kind: Story) {
  stop(svg);
  const anims: Animation[] = [];
  const ink: Animation[] = [];
  const add = (sel: string, keys: Keyframe[], o: KeyframeAnimationOptions, isInk = false) => {
    for (const el of svg.querySelectorAll<SVGElement>(sel)) {
      const a = el.animate(keys, { fill: 'both', ...o });
      anims.push(a);
      if (isInk) ink.push(a);
    }
  };

  if (kind === 'intro') {
    const pen = (r: string, at: number, dur: number, easing: string) =>
      add(`[data-rv=${r}]`, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { delay: at, duration: dur, easing }, true);
    pen('stem', 0, 380, OUT);
    pen('legL', 60, 400, OUT);
    pen('legR', 60, 400, OUT);
    pen('arm', 200, 320, OUT);
    pen('arc', 400, 560, SWING);
    add('.cm-spin', [{ transform: turn(0) }, { transform: turn(compass.sweepEnd - START) }], {
      delay: 400,
      duration: 560,
      easing: SWING,
    });
    add(
      '.cm-guides',
      [
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: 0.16, easing: 'linear' },
        { opacity: 1, offset: 0.68, easing: 'cubic-bezier(.4,0,.6,1)' },
        { opacity: 0, offset: 1 },
      ],
      { delay: 300, duration: 740 },
    );
  } else {
    // Into the joint accelerating, out again at once and easing into the
    // stop: the K's leg (the arc from the stem to the A's left leg, 143° to
    // 114°) is empty only around the turn.
    const back = 330;
    const t = 1050;
    add(
      '.cm-sweeper',
      [
        { transform: turn(END), offset: 0, easing: 'cubic-bezier(.55,0,.9,.4)' },
        { transform: turn(START), offset: back / t, easing: 'cubic-bezier(.2,.65,.3,1)' },
        { transform: turn(END), offset: 1 },
      ],
      { duration: t },
      true,
    );
  }

  const run: Run = { kind, anims, ink };
  running.set(svg, run);
  svg.dataset.mode = kind;
  svg.dataset.ink = kind === 'intro' ? 'draw' : 'parts';
  // The ink lands on the rest path the moment its last motion ends.
  Promise.all(ink.map((a) => a.finished)).then(
    () => running.get(svg) === run && (svg.dataset.ink = 'rest'),
    () => {},
  );
  Promise.all(anims.map((a) => a.finished)).then(
    () => running.get(svg) === run && stop(svg),
    () => {},
  );
  return anims;
}

export const intro = (svg: SVGSVGElement) => play(svg, 'intro');

/** The hover story; ignored while a story plays unless forced. */
export function hover(svg: SVGSVGElement, force = false) {
  if (svg.dataset.mode && !force) return [];
  return play(svg, 'hover');
}

// Test hooks (experiments/logo-lab/motion/live.mjs): a story's length, and a
// story frozen at t ms with its landing (t past the end shows rest).
const endOf = (a: Animation) => {
  const t = a.effect!.getComputedTiming();
  return (t.delay ?? 0) + Number(t.activeDuration ?? 0);
};
export function storyLength(svg: SVGSVGElement, kind: Story) {
  const total = Math.max(...play(svg, kind).map(endOf));
  stop(svg);
  return total;
}
export function seek(svg: SVGSVGElement, kind: Story, t: number) {
  let r = running.get(svg);
  if (!r || r.kind !== kind) {
    play(svg, kind);
    r = running.get(svg)!;
  }
  if (t >= Math.max(...r.anims.map(endOf))) return stop(svg);
  r.anims.forEach((a) => {
    a.pause();
    a.currentTime = t;
  });
  svg.dataset.ink = t >= Math.max(...r.ink.map(endOf)) ? 'rest' : kind === 'intro' ? 'draw' : 'parts';
}

export function initBrandCompass() {
  const link = document.querySelector<HTMLAnchorElement>('[data-brand-compass]');
  const svg = link?.querySelector<SVGSVGElement>('svg');
  if (!link || !svg) return;

  // The header is centred, so on an odd-width window the mark can start on a
  // half pixel and blur at 1x. Shift it onto the device grid; re-measured on
  // resize and on a move to a screen with another pixel ratio.
  const snap = () => {
    svg.style.translate = '';
    const r = svg.getBoundingClientRect();
    const d = devicePixelRatio || 1;
    const off = (v: number) => (Math.round(v * d) - v * d) / d;
    const x = off(r.left);
    const y = off(r.top);
    if (x || y) svg.style.translate = `${x}px ${y}px`;
  };
  snap();
  addEventListener('resize', snap, { passive: true });

  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  link.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'touch' && fine.matches) hover(svg);
  });
  link.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') hover(svg);
  });
  link.addEventListener('focus', () => {
    if (link.matches(':focus-visible')) hover(svg);
  });

  // The intro waits, on its first frame (the empty mark), until the page is
  // actually painted and on screen: a tab opened in the background or a
  // first load still settling would otherwise play it unseen. Frames do not
  // run in a hidden page, so two of them mean it is being shown.
  const root = document.documentElement;
  if ('cmIntro' in root.dataset) {
    const anims = intro(svg);
    anims.forEach((a) => a.pause());
    delete root.dataset.cmIntro;
    const go = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', go);
      requestAnimationFrame(() => requestAnimationFrame(() => anims.forEach((a) => a.play())));
    };
    document.addEventListener('visibilitychange', go);
    go();
  }
}
