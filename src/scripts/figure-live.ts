// Live layers for figures (experiments/figure-interactive/SHIP.md): a figure
// whose generator also emits src/figures/live/<slug>.js gets that module,
// fetched as it nears the viewport and mounted on its <svg>. Each module reads
// the input mode from the nearest [data-live] at event time: 'hover' (gallery
// tiles), 'pointer' (Quick Look) or, with none, 'full' (placed on a page).
// A gallery tile drawn too small to read (data-live-auto: below 0.4 of its
// native size, labels under ~4.5px) switches its layer 'off' until the
// gallery zooms it back up.
const MIN_SCALE = 0.4;
// Drawings whose live layer needs no labels to make sense keep it smaller:
// the valve's hover is a quarter turn of the ball, readable at any size.
const MIN_SCALE_BY_FIG: Record<string, number> = { 'ball-valve': 0.22 };
type Mount = (svg: SVGSVGElement) => void;
const mods = import.meta.glob<Mount>('../figures/live/*.js', { import: 'default' });
const load = new Map(Object.entries(mods).map(([p, f]) => [p.slice(p.lastIndexOf('/') + 1, -3), f]));

export function initFigureLive() {
  const svgs = [...document.querySelectorAll<SVGSVGElement>('svg[data-fig]')].filter((s) => load.has(s.dataset.fig!));
  if (!svgs.length) return;
  const mount = (svg: SVGSVGElement) => load.get(svg.dataset.fig!)!().then((m) => m(svg));
  const auto = svgs.filter((s) => s.closest('[data-live-auto]'));
  if (auto.length && 'ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const svg = e.target as SVGSVGElement;
        const host = svg.closest<HTMLElement>('[data-live-auto]');
        const vb = svg.viewBox.baseVal;
        if (!host || !vb?.width) continue; // in Quick Look: the stage decides
        const min = MIN_SCALE_BY_FIG[svg.dataset.fig!] ?? MIN_SCALE;
        const mode = e.contentRect.width / vb.width >= min ? 'hover' : 'off';
        if (host.dataset.live !== mode) host.dataset.live = mode;
      }
    });
    auto.forEach((s) => ro.observe(s));
  }
  if (!('IntersectionObserver' in window)) return svgs.forEach(mount);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        mount(e.target as SVGSVGElement);
      }
    },
    { rootMargin: '50% 0px' },
  );
  svgs.forEach((s) => io.observe(s));
}
