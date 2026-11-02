// Landing page links (docs/design-system.md §5 b3): three underlined page
// links whose underline, under a mouse or keyboard focus, rises into a small
// translucent tab. There is no current page here, so the tab has no resting
// place: it rises out of the hovered item's underline, slides between items
// like the nav pill (src/scripts/tabs.ts), and fades out where it stands
// when the pointer leaves, as the underline comes back. A finger gets the
// same tab while it presses: it can slide along the row, the tab following,
// and lifting opens the link under it (src/scripts/scrub.ts).
//
// The item under the tab gets .is-on (its own underline gives way to the tab)
// and .is-micro-on (the arrow's draw/nudge story, src/styles/micro.css).

import { initScrub } from './scrub';

export function initDock() {
  const dock = document.querySelector<HTMLElement>('[data-dock]');
  const tab = dock?.querySelector<HTMLElement>('.dock-tab');
  if (!dock || !tab) return;

  const items = [...dock.querySelectorAll<HTMLAnchorElement>('.dock-item')];

  let target: HTMLAnchorElement | undefined;
  let hovering = false;
  let leaveTimer = 0;
  let sinkTimer = 0;

  const set = (k: string, v: string) => tab.style.setProperty(k, v);

  const mark = (a: HTMLAnchorElement | undefined) => {
    for (const el of items) {
      const on = el === a;
      el.classList.toggle('is-on', on);
      el.classList.toggle('is-micro-on', on);
    }
  };

  const box = (x: number, y: number, w: number, h: number) => {
    set('--x', `${x}px`);
    set('--y', `${y}px`);
    set('--w', `${w}px`);
    set('--h', `${h}px`);
  };

  // The item itself (the open tab).
  const full = (a: HTMLAnchorElement) => box(a.offsetLeft, a.offsetTop, a.offsetWidth, a.offsetHeight);

  // The label's underline: the text's own box, at the underline's position
  // (alphabetic baseline + the 3px text-underline-offset from .link), 1px tall.
  const line = (a: HTMLAnchorElement) => {
    const text = [...a.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
    if (!text) return full(a);
    const range = document.createRange();
    range.selectNodeContents(text);
    const r = range.getBoundingClientRect();
    const d = dock.getBoundingClientRect();
    const cs = getComputedStyle(a);
    const size = parseFloat(cs.fontSize);
    const offset = parseFloat(cs.textUnderlineOffset) || 3;
    // Inter's descent is 0.2421875 em below the baseline.
    const baseline = r.bottom - 0.2421875 * size;
    box(r.left - d.left, baseline + offset - d.top, r.width, 1);
  };

  // Apply geometry with no transition, then let later changes animate again.
  const jump = (fn: () => void) => {
    tab.classList.add('no-anim');
    fn();
    tab.getBoundingClientRect();
    tab.classList.remove('no-anim');
  };

  const rise = (a: HTMLAnchorElement) => {
    clearTimeout(leaveTimer);
    clearTimeout(sinkTimer);
    const leaving = tab.classList.contains('is-leaving');
    tab.classList.remove('is-leaving');
    set('--s', '1');
    if (!target || (leaving && target !== a)) {
      // Start from this item's underline, then rise out of it.
      jump(() => {
        tab.classList.add('is-line');
        line(a);
        set('--o', '1');
      });
    }
    target = a;
    mark(a);
    tab.classList.remove('is-line');
    set('--o', '1');
    full(a);
  };

  const sink = () => {
    if (!target) return;
    // The label's underline and arrow return as the tab fades in place.
    mark(undefined);
    tab.classList.add('is-leaving');
    set('--o', '0');
    set('--s', '0.97');
    sinkTimer = window.setTimeout(() => {
      target = undefined;
      tab.classList.remove('is-leaving');
      jump(() => set('--s', '1'));
    }, 180);
  };

  const leave = (delay: number) => {
    clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(sink, delay);
  };

  const focused = () => items.find((a) => a.matches(':focus-visible'));

  for (const a of items) {
    // Mouse and hovering pens only, so a tap never leaves a sticky tab.
    a.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      hovering = true;
      rise(a);
    });
    a.addEventListener('focus', () => {
      if (a.matches(':focus-visible')) rise(a);
    });
    a.addEventListener('blur', () => {
      if (!hovering) leave(120);
    });
  }

  dock.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    hovering = false;
    // Keyboard focus keeps the tab; otherwise it sinks after a beat, so a
    // pointer that slips out for a moment doesn't make it flicker.
    const f = focused();
    if (f) rise(f);
    else leave(150);
  });

  initScrub(dock, items, { enter: rise, cancel: () => leave(0) });

  // Back/forward cache: come back to plain links, not the clicked item.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    hovering = false;
    clearTimeout(leaveTimer);
    clearTimeout(sinkTimer);
    target = undefined;
    mark(undefined);
    tab.classList.remove('is-leaving');
    set('--o', '0');
  });

  new ResizeObserver(() => {
    if (target && !tab.classList.contains('is-leaving')) jump(() => full(target!));
  }).observe(dock);
}
