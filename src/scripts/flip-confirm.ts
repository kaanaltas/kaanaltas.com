// Flip-to-confirm for the Download CV button: the button turns over (rotateX)
// to a back face with a drawn-in check, holds, then turns back. The CSS lives
// in DownloadCV.astro; this only toggles two classes:
//   .is-flipped    the card is (or is turning) to its back face
//   .is-confirmed  the check is drawn; cleared only once the card is face-front
//                  again, so the check never visibly un-draws mid-flip.
// The command palette does not use this: it only gets the toast.

/** Flip duration (keep in sync with --flip-dur in DownloadCV.astro). */
export const FLIP_MS = 450;
const HOLD_MS = 2000;

interface FlipState {
  back?: number;
  reset?: number;
}

const states = new WeakMap<HTMLElement, FlipState>();

/**
 * Show the back face of `el`, hold for `hold` ms after it lands, then flip back.
 * Calling again while the back face is showing just restarts the hold.
 * Returns true when this call started a new flip, false when it only extended one
 * (callers use that to ignore rapid double-clicks).
 */
export function flipConfirm(el: HTMLElement, hold = HOLD_MS): boolean {
  let s = states.get(el);
  if (!s) {
    s = {};
    states.set(el, s);
  }
  const showing = el.classList.contains('is-flipped');
  window.clearTimeout(s.back);
  window.clearTimeout(s.reset);
  el.classList.add('is-flipped', 'is-confirmed');

  const state = s;
  state.back = window.setTimeout(
    () => {
      el.classList.remove('is-flipped');
      state.reset = window.setTimeout(() => el.classList.remove('is-confirmed'), FLIP_MS + 80);
    },
    (showing ? 0 : FLIP_MS) + hold,
  );
  return !showing;
}
