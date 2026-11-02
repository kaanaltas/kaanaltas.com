// Shared "Download CV" action. Used by the CV page button and the command palette.
// Contract: downloadCV() starts the PDF download and shows a small, friendly toast
// whose message changes every time (optionally a beat later, see toastDelay).
import { person } from '../data/cv';
import { cvMessages } from '../data/cv-messages';
import { showToast } from './toast';

const STORE_KEY = 'cv-toast';
const FILE_NAME = 'Kaan-Altas-CV.pdf';

interface Cycle {
  order: number[];
  i: number;
}

// In-memory fallback when sessionStorage is unavailable (private mode, blocked).
let memory: Cycle | null = null;

function shuffle(n: number, avoidFirst?: number): number[] {
  const a = Array.from({ length: n }, (_, k) => k);
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  // Never open a new cycle with the line that closed the previous one.
  if (n > 1 && a[0] === avoidFirst) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

function load(): Cycle | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as Cycle;
      if (Array.isArray(c.order) && c.order.length === cvMessages.length && Number.isInteger(c.i)) return c;
    }
  } catch {}
  return memory;
}

function save(c: Cycle) {
  memory = c;
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(c));
  } catch {}
}

/** Next toast line: walks a shuffled cycle, reshuffling at the end. */
export function nextCvMessage(): string {
  let c = load() ?? { order: shuffle(cvMessages.length), i: 0 };
  if (c.i >= c.order.length) c = { order: shuffle(cvMessages.length, c.order[c.order.length - 1]), i: 0 };
  const msg = cvMessages[c.order[c.i]] ?? cvMessages[0];
  save({ order: c.order, i: c.i + 1 });
  return msg;
}

// A sheet drops into a tray, then a check draws in (design-system section 8).
// The <style> travels with the icon so the toast works on any page.
const icon = /* html */ `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
<style>
.tt-fill{fill:var(--surface-2)}
.tt-sheet{animation:tt-drop var(--dur-bounce) var(--spring-bounce) 80ms both}
.tt-check{stroke:var(--accent);stroke-dasharray:1;stroke-dashoffset:1;animation:tt-draw 320ms var(--ease-out) 420ms both}
.tt-tray{animation:tt-bump 420ms var(--ease-out) 260ms both}
@keyframes tt-drop{from{translate:0 -9px;opacity:0}40%{opacity:1}}
@keyframes tt-draw{to{stroke-dashoffset:0}}
@keyframes tt-bump{40%{translate:0 .75px}}
</style>
<g class="tt-sheet"><path class="tt-fill" d="M7.75 15V4.75a1 1 0 0 1 1-1h6.5a1 1 0 0 1 1 1V15"/><path class="tt-check" pathLength="1" d="M9.75 8.75l1.5 1.5 3-3"/></g>
<path class="tt-tray tt-fill" d="M4.75 13.75h3.5l1.25 2h5l1.25-2h3.5v4.5a1 1 0 0 1-1 1H5.75a1 1 0 0 1-1-1z"/>
</svg>`;

export interface DownloadOptions {
  /**
   * Delay before the toast, in ms. The CV button passes the flip duration so
   * the toast arrives just after its own confirmation lands; the palette
   * leaves it at 0.
   */
  toastDelay?: number;
}

let toastTimer: number | undefined;

export function downloadCV({ toastDelay = 0 }: DownloadOptions = {}): void {
  const a = document.createElement('a');
  a.href = person.cvPdf;
  a.download = FILE_NAME;
  a.rel = 'noopener';
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  window.clearTimeout(toastTimer);
  const toast = () => showToast({ message: nextCvMessage(), icon });
  if (toastDelay > 0) toastTimer = window.setTimeout(toast, toastDelay);
  else toast();
}
