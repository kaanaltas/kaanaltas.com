// Touch scrubbing for a row of page links (the landing dock, the header tabs):
// press a link and slide the finger along the row, and the highlight follows
// the finger from link to link; lifting it opens the link under it. Lifting
// it off the row cancels. The same gesture as dragging across an iOS menu.
//
// Mouse, pen and keyboard are left to the caller; only touch is handled here.
// The row needs `touch-action` that keeps sideways moves for the page
// (pan-y or none), or the browser takes the gesture as a scroll.
import { prefetch } from 'astro:prefetch';

interface Scrub {
  /** The finger is over this link (called again only when it changes). */
  enter: (a: HTMLAnchorElement) => void;
  /** The gesture ended without opening anything. */
  cancel: () => void;
}

export function initScrub(row: HTMLElement, links: HTMLAnchorElement[], { enter, cancel }: Scrub) {
  let id: number | null = null;
  let over: HTMLAnchorElement | undefined;
  // The click that follows a touch on a link is the gesture's: it navigates
  // itself, so the browser's own click (to the press point) must not.
  let swallowClick = false;

  const at = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('a');
    return links.find((a) => a === el);
  };

  const move = (a: HTMLAnchorElement | undefined) => {
    if (a === over) return;
    over = a;
    if (!a) return;
    enter(a);
    prefetch(a.href);
  };

  const end = () => {
    id = null;
    over = undefined;
  };

  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || id !== null || !e.isPrimary) return;
    const a = at(e.clientX, e.clientY);
    if (!a) return;
    id = e.pointerId;
    swallowClick = true;
    move(a);
    // Moves keep coming here even when the finger leaves the link it started on.
    try {
      row.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone; its pointerup or pointercancel still ends the gesture.
    }
  });

  row.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    move(at(e.clientX, e.clientY));
  });

  row.addEventListener('pointerup', (e) => {
    if (e.pointerId !== id) return;
    const a = at(e.clientX, e.clientY);
    end();
    if (a) {
      enter(a);
      location.assign(a.href);
    } else cancel();
  });

  row.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== id) return;
    end();
    swallowClick = false;
    cancel();
  });

  row.addEventListener(
    'click',
    (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
    },
    true,
  );

  // Back/forward cache: a page left mid-gesture comes back with none.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    end();
    swallowClick = false;
    cancel();
  });

  // A long press would otherwise open the link preview or the copy menu.
  row.addEventListener('contextmenu', (e) => {
    if (id !== null || swallowClick) e.preventDefault();
  });
}
