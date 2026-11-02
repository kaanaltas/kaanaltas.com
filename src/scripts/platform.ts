// Keyboard labels per platform: ⌘ and ⌥ on Apple systems, Ctrl and Alt on
// Windows and Linux (the handlers already accept metaKey || ctrlKey).
//
//   [data-mod-key]   ⌘ / Ctrl   (add data-mod-space for "Ctrl " in running text)
//   [data-alt-key]   ⌥ / Alt    (its own text is kept on Apple systems, e.g.
//                                "Option" in a sentence)

export const isMac = () => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || navigator.platform || navigator.userAgent);
};

export function applyKeyLabels(root: ParentNode = document) {
  const mac = isMac();
  root.querySelectorAll<HTMLElement>('[data-mod-key]').forEach((el) => {
    el.textContent = mac ? '⌘' : el.hasAttribute('data-mod-space') ? 'Ctrl ' : 'Ctrl';
    el.classList.toggle('is-word', !mac);
  });
  if (!mac) root.querySelectorAll<HTMLElement>('[data-alt-key]').forEach((el) => (el.textContent = 'Alt'));
}

// A hardware keyboard on a touch device (an iPad with a Magic Keyboard): there
// is no API for it, so the first key only a hardware keyboard sends (arrows,
// Esc, Tab, a ⌘/Ctrl/⌥ shortcut) adds html.kbd, and the keyboard hints that
// touch layouts hide (esc keycaps, the palette's ↵ bar) come back. Kept for
// the session (Base.astro re-applies it before first paint).
const HARD_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'Tab', 'PageUp', 'PageDown', 'Home', 'End']);
export function watchHardwareKeyboard() {
  const root = document.documentElement;
  addEventListener(
    'keydown',
    (e) => {
      if (root.classList.contains('kbd')) return;
      if (!(e.metaKey || e.ctrlKey || e.altKey || HARD_KEYS.has(e.key))) return;
      root.classList.add('kbd');
      try {
        sessionStorage.setItem('kbd', '1');
      } catch {}
    },
    { capture: true },
  );
}
