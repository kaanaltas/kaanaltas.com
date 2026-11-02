// Touch has no hover, so the small hover stories (an arrow that draws on, a
// trophy that hops, a chip that takes its brand colour) get two stand-ins on
// touch screens, both as the class .is-hot (micro.css and the components
// style it as they style :hover):
// - the press: whatever a finger lands on gets it after a beat (so the start
//   of a scroll does not flash it) and keeps it a moment after the finger
//   lifts, long enough for the story to read;
// - the reading line: rows in a list (projects, tools, the CV's entries) get
//   it while they cross the middle of the screen, as if a pointer rested on
//   the one being read.
// The dock and the header tabs have their own touch handling (scrub.ts).

const PRESSABLE = 'a, button, [data-micro-trigger], [data-logo-hover], .chip--brand';
const ROWS = '.rows > .row, .apps > .app, .timeline > li';

export function initTouchHot() {
  if (!matchMedia('(hover: none)').matches) return;

  let pressed: Element | null = null;
  let on = 0;
  let off = 0;
  // Rows on the reading line keep their story when a press on them ends.
  const inBand = new WeakSet<Element>();
  const drop = (el: Element | null) => {
    if (el && !inBand.has(el)) el.classList.remove('is-hot');
  };

  addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      const el = (e.target as Element).closest(PRESSABLE);
      if (!el || el.closest('[data-dock], [data-tabs], [data-ql]')) return;
      clearTimeout(on);
      clearTimeout(off);
      if (pressed !== el) drop(pressed);
      pressed = el;
      on = window.setTimeout(() => el.classList.add('is-hot'), 70);
    },
    { passive: true, capture: true },
  );
  addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType !== 'touch' || !pressed) return;
      const el = pressed;
      // A tap shorter than the beat still gets its story.
      clearTimeout(on);
      el.classList.add('is-hot');
      off = window.setTimeout(() => {
        drop(el);
        if (pressed === el) pressed = null;
      }, 520);
    },
    { passive: true, capture: true },
  );
  // The browser took the finger for a scroll: no story.
  addEventListener(
    'pointercancel',
    () => {
      clearTimeout(on);
      drop(pressed);
      pressed = null;
    },
    { passive: true, capture: true },
  );

  const rows = document.querySelectorAll(ROWS);
  if (!rows.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) inBand.add(en.target);
        else inBand.delete(en.target);
        en.target.classList.toggle('is-hot', en.isIntersecting || en.target === pressed);
      }
    },
    { rootMargin: '-44% 0px -44% 0px' },
  );
  rows.forEach((r) => io.observe(r));
}
