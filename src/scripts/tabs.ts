// Liquid-glass pill that follows the hovered tab and rests on the current one.
// A finger can press a tab and slide along the row, the pill following, and
// lifting opens the tab under it (src/scripts/scrub.ts).
import { initScrub } from './scrub';

export function initTabs() {
  const nav = document.querySelector<HTMLElement>('[data-tabs]');
  const pill = nav?.querySelector<HTMLElement>('.glass');
  if (!nav || !pill) return;

  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a')];
  const current = () => links.find((a) => a.getAttribute('aria-current') === 'page');
  const canTilt = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

  let target: HTMLAnchorElement | undefined;
  let leaveTimer = 0;

  const place = (a: HTMLAnchorElement | undefined, instant = false) => {
    target = a;
    if (!a) {
      pill.style.setProperty('--o', '0');
      return;
    }
    if (instant) pill.classList.add('no-anim');
    pill.style.setProperty('--x', `${a.offsetLeft}px`);
    pill.style.setProperty('--y', `${a.offsetTop}px`);
    pill.style.setProperty('--w', `${a.offsetWidth}px`);
    pill.style.setProperty('--h', `${a.offsetHeight}px`);
    pill.style.setProperty('--o', '1');
    if (instant) {
      pill.getBoundingClientRect();
      requestAnimationFrame(() => pill.classList.remove('no-anim'));
    }
  };

  const resetTilt = () => {
    pill.style.setProperty('--rx', '0deg');
    pill.style.setProperty('--ry', '0deg');
  };

  // Across pages the pill is one object: the page being left records where
  // it is (mid-slide included), and the new page starts it there and lets it
  // finish the slide to its own tab, instead of cutting to it.
  const KEY = 'nav-pill';
  const save = () => {
    if (pill.style.getPropertyValue('--o') !== '1') return;
    const n = nav.getBoundingClientRect();
    const r = pill.getBoundingClientRect();
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ x: r.left - n.left, w: r.width, t: Date.now() }));
    } catch {}
  };
  addEventListener('pageswap', save);
  addEventListener('pagehide', save);
  let from: { x: number; w: number; t: number } | null = null;
  try {
    from = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    sessionStorage.removeItem(KEY);
  } catch {}
  const cur = current();
  // While the carried slide runs, layout checks re-aim it rather than snap.
  let carrying = false;
  if (from && cur && Date.now() - from.t < 2500 && Math.abs(from.x - cur.offsetLeft) > 1) {
    pill.classList.add('no-anim');
    pill.style.setProperty('--x', `${from.x}px`);
    pill.style.setProperty('--y', `${cur.offsetTop}px`);
    pill.style.setProperty('--w', `${from.w}px`);
    pill.style.setProperty('--h', `${cur.offsetHeight}px`);
    pill.style.setProperty('--o', '1');
    // Two style flushes in one go: the pill is first resolved where it was,
    // then, with transitions back on, sent to its tab. No frame is awaited,
    // so nothing (fonts, a resize) can snap it there first.
    pill.getBoundingClientRect();
    pill.classList.remove('no-anim');
    getComputedStyle(pill).translate;
    carrying = true;
    window.setTimeout(() => (carrying = false), 900);
    place(cur);
  } else place(cur, true);

  for (const a of links) {
    // Mouse and pen: follow the pointer. A finger is the scrub's (below).
    a.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      clearTimeout(leaveTimer);
      place(a);
    });
    a.addEventListener('focus', () => {
      if (a.matches(':focus-visible')) place(a);
    });
    a.addEventListener('blur', () => place(current()));
  }

  nav.addEventListener('pointermove', (e) => {
    if (!canTilt() || !target) return;
    const r = pill.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    const nx = px * 2 - 1;
    const ny = py * 2 - 1;
    const k = Math.min(1.6, 0.7 + (0.18 * r.width) / r.height);
    pill.style.setProperty('--rx', `${(-ny * k).toFixed(2)}deg`);
    pill.style.setProperty('--ry', `${(0.8 * nx).toFixed(2)}deg`);
    pill.style.setProperty('--ox', `${30 + 40 * px}%`);
    pill.style.setProperty('--oy', `${30 + 40 * py}%`);
  });

  nav.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    resetTilt();
    leaveTimer = window.setTimeout(() => place(current()), 300);
  });

  initScrub(nav, links, {
    enter: (a) => {
      clearTimeout(leaveTimer);
      place(a);
    },
    cancel: () => place(current()),
  });

  const settle = () => place(target ?? current(), !carrying);
  new ResizeObserver(settle).observe(nav);
  document.fonts?.ready.then(settle);
}
