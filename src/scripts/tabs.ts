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

  place(current(), true);

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

  new ResizeObserver(() => place(target ?? current(), true)).observe(nav);
  document.fonts?.ready.then(() => place(target ?? current(), true));
}
