export type Theme = 'light' | 'dark';

export const currentTheme = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

const BG: Record<Theme, string> = { light: '#fcfcfc', dark: '#0f0f10' };

/** The browser's own bar follows the page's theme, not only the system's. */
function syncThemeColor(theme: Theme) {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => (m.content = BG[theme]));
}

/** The theme to show: an explicit choice if one was saved, else the system's. */
const resolved = (): Theme => {
  let pref: string | null = null;
  try {
    pref = localStorage.getItem('theme');
  } catch {}
  if (pref === 'light' || pref === 'dark') return pref;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Re-read the saved choice (another tab changed it, or this page came back
 *  from the back/forward cache with an older theme). */
function resync() {
  const t = resolved();
  syncThemeColor(t);
  if (currentTheme() === t) return;
  document.documentElement.dataset.theme = t;
  window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  const apply = () => {
    root.dataset.theme = theme;
    syncThemeColor(theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {}
    window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  };
  // Cross-fade the whole page, header included, as one snapshot when
  // supported; plain swap otherwise. html.vt-theme switches off the page
  // transition's held header and delayed blur (global.css) for this one.
  if ('startViewTransition' in document) {
    root.classList.add('vt-theme');
    const vt = (
      document as Document & {
        startViewTransition: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
      }
    ).startViewTransition(apply);
    // A second toggle mid-fade skips this one; the theme is still applied.
    vt.ready.catch(() => {});
    vt.finished.finally(() => root.classList.remove('vt-theme'));
  } else {
    apply();
  }
}

export const toggleTheme = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');

// Follow the OS setting until the user makes an explicit choice.
if (typeof window !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let pref: string | null = null;
    try {
      pref = localStorage.getItem('theme');
    } catch {}
    if (pref) return;
    document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
    syncThemeColor(e.matches ? 'dark' : 'light');
    window.dispatchEvent(new CustomEvent('themechange', { detail: e.matches ? 'dark' : 'light' }));
  });
  // The choice is shared by every open tab, and survives the back button.
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme' || e.key === null) resync();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) resync();
  });
  syncThemeColor(currentTheme());
}
