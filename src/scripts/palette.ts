// Command palette: native <dialog> + ARIA combobox/listbox, fuzzy search over an
// index serialized at build time (see src/data/search-index.ts).
import type { GroupId, PaletteItem } from '../data/search-index';
import { downloadCV } from './download-cv';
import { currentTheme, toggleTheme } from './theme';
import { applyKeyLabels, isMac, watchHardwareKeyboard } from './platform';

interface Payload {
  items: PaletteItem[];
  groups: { id: GroupId; label: string }[];
}

interface Result {
  item: PaletteItem;
  score: number;
  title: Set<number>;
  subtitle: Set<number>;
}

/* ------------------------------------------------------------------------ */
/* Text normalization: lowercase, no diacritics, with a map back to source.  */
/* ------------------------------------------------------------------------ */

interface Norm {
  text: string;
  map: number[];
}

const cache = new Map<string, Norm>();

function norm(s: string): Norm {
  const hit = cache.get(s);
  if (hit) return hit;
  let text = '';
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let n = c === 'ı' || c === 'İ' ? 'i' : c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (n === '') continue;
    for (const ch of n) {
      text += ch;
      map.push(i);
    }
  }
  const out = { text, map };
  cache.set(s, out);
  return out;
}

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
const isBoundary = (t: string, j: number) => j === 0 || !isWordChar(t[j - 1]);

/**
 * Fuzzy subsequence match (small DP). Rewards word starts and consecutive runs,
 * penalizes gaps. Scattered matches are rejected unless every run starts a word.
 */
function fuzzy(q: string, t: string, strict = false): { score: number; pos: number[] } | null {
  const m = q.length;
  const n = t.length;
  if (!m || m > n) return null;

  // Fast path: contiguous substring, prefer an occurrence at a word start.
  let at = -1;
  for (let k = t.indexOf(q); k !== -1; k = t.indexOf(q, k + 1)) {
    if (isBoundary(t, k)) {
      at = k;
      break;
    }
    if (at === -1) at = k;
  }
  if (at !== -1 && (m > 1 || isBoundary(t, at))) {
    const b = isBoundary(t, at);
    // Mid-word hits ("print" in "Sprint") count less than a word start anywhere.
    let score = m * (b ? 8 : 6) + (b ? 12 : 0) + (at === 0 ? 8 : 0) - Math.min(at, 40) * 0.1;
    if (m === n) score += 16;
    else if (b && !isWordChar(t[at + m])) score += 6; // whole word
    return { score, pos: Array.from({ length: m }, (_, i) => at + i) };
  }
  if (strict || m < 2) return null;

  const NEG = -1e9;
  const S = Array.from({ length: m }, () => new Float64Array(n).fill(NEG));
  const P = Array.from({ length: m }, () => new Int32Array(n).fill(-1));
  const bonus = (j: number) => (j === 0 ? 10 : isBoundary(t, j) ? 8 : 0);

  for (let j = 0; j < n; j++) if (t[j] === q[0]) S[0][j] = 2 + bonus(j) - Math.min(j, 20) * 0.2;

  for (let i = 1; i < m; i++) {
    let best = NEG;
    let bestAt = -1;
    for (let j = i; j < n; j++) {
      // best predecessor ending at or before j-2 (a gap)
      if (j - 2 >= 0 && S[i - 1][j - 2] > best) {
        best = S[i - 1][j - 2];
        bestAt = j - 2;
      }
      if (t[j] !== q[i]) continue;
      const run = S[i - 1][j - 1] + 2 + bonus(j) + 6;
      const gap = best + 2 + bonus(j) - 4;
      if (run >= gap && S[i - 1][j - 1] > NEG) {
        S[i][j] = run;
        P[i][j] = j - 1;
      } else if (bestAt >= 0) {
        S[i][j] = gap;
        P[i][j] = bestAt;
      }
    }
  }

  let end = -1;
  let score = NEG;
  for (let j = 0; j < n; j++) {
    if (S[m - 1][j] > score) {
      score = S[m - 1][j];
      end = j;
    }
  }
  if (end < 0 || score <= NEG / 2) return null;

  const pos: number[] = new Array(m);
  for (let i = m - 1, j = end; i >= 0; i--) {
    pos[i] = j;
    j = P[i][j];
  }

  // Quality gate: the match must start a word, and stay in a few runs unless
  // every run starts a word (acronyms like "sm" -> "Stochastic MILP").
  if (!isBoundary(t, pos[0])) return null;
  let runs = 0;
  let allWordStarts = true;
  for (let i = 0; i < m; i++) {
    if (i === 0 || pos[i] !== pos[i - 1] + 1) {
      runs++;
      if (!isBoundary(t, pos[i])) allWordStarts = false;
    }
  }
  if (!allWordStarts && runs > Math.max(2, Math.ceil(m / 3))) return null;
  if (!allWordStarts && m <= 3 && runs > 1) return null;

  return { score: score - n * 0.02, pos };
}

/** Keywords: substring only, word starts preferred. */
function keywordScore(q: string, t: string): number {
  let k = t.indexOf(q);
  let best = 0;
  while (k !== -1) {
    const b = isBoundary(t, k);
    if (q.length === 1 && !b) {
      k = t.indexOf(q, k + 1);
      continue;
    }
    const s = q.length * 3 + (b ? 6 : 0) + (b && !isWordChar(t[k + q.length]) ? 3 : 0);
    if (s > best) best = s;
    if (b) break;
    k = t.indexOf(q, k + 1);
  }
  return best;
}

export function search(items: PaletteItem[], raw: string): Result[] {
  const query = norm(raw.trim()).text;
  const tokens = query.split(/\s+/).filter(Boolean);
  const out: Result[] = [];

  for (const item of items) {
    const title = norm(item.title);
    const sub = norm(item.subtitle ?? '');
    const kw = norm(item.keywords).text;
    const hlTitle = new Set<number>();
    const hlSub = new Set<number>();
    let total = 0;
    let ok = true;

    for (const tok of tokens) {
      const a = fuzzy(tok, title.text);
      const b = sub.text ? fuzzy(tok, sub.text, true) : null;
      const sa = a ? a.score : 0;
      const sb = b ? b.score * 0.55 : 0;
      const sk = keywordScore(tok, kw) * 0.6;
      const best = Math.max(sa, sb, sk);
      if (best <= 0) {
        ok = false;
        break;
      }
      total += best;
      if (a && sa >= sb && sa >= sk) a.pos.forEach((p) => hlTitle.add(title.map[p]));
      else if (b && sb >= sk) b.pos.forEach((p) => hlSub.add(sub.map[p]));
    }
    if (!ok) continue;
    if (tokens.length > 1 && title.text.includes(query)) total += 20;
    out.push({ item, score: total + item.boost, title: hlTitle, subtitle: hlSub });
  }
  return out.sort((x, y) => y.score - x.score);
}

/* ------------------------------------------------------------------------ */
/* DOM                                                                        */
/* ------------------------------------------------------------------------ */

const BRANDS = new Set<string>(['github', 'googlescholar', 'linkedin', 'x']);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function highlight(s: string, marks: Set<number>): string {
  if (!marks.size) return esc(s);
  let html = '';
  let open = false;
  for (let i = 0; i < s.length; i++) {
    const on = marks.has(i);
    if (on && !open) html += '<mark>';
    if (!on && open) html += '</mark>';
    open = on;
    html += esc(s[i]);
  }
  return open ? html + '</mark>' : html;
}

const coarse = matchMedia('(hover: none), (pointer: coarse)');

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) &&
  !(el instanceof HTMLInputElement && /^(button|checkbox|radio|submit|reset|range|color|file)$/.test(el.type));

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {}
    ta.remove();
    return ok;
  }
}

/**
 * The floating desktop trigger steps aside while the reader scrolls down, so
 * it never covers the line they are reading, and comes back on scroll up, near
 * the top and at the end of the page (where the in-flow spacer gives it room).
 * On windows wide enough for the pill to sit in the empty margin beside the
 * content column it simply stays put.
 */
function tuckOnScroll(pill: HTMLElement | null) {
  if (!pill) return;
  const roomy = matchMedia('(min-width: 1360px)');
  const THRESHOLD = 12; // px of travel before the direction counts
  let lastY = window.scrollY;
  let tucked = false;
  let ticking = false;

  const set = (next: boolean) => {
    // Never hide it from under the pointer or keyboard focus.
    if (next && (pill.matches(':hover') || pill.matches(':focus-visible'))) return;
    if (next === tucked) return;
    tucked = next;
    pill.classList.toggle('is-tucked', next);
  };

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const atTop = y < 64;
    const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 48;
    if (roomy.matches || atTop || atEnd) {
      set(false);
      lastY = y;
      return;
    }
    const dy = y - lastY;
    if (Math.abs(dy) < THRESHOLD) return;
    set(dy > 0);
    lastY = y;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  roomy.addEventListener('change', update);
  pill.addEventListener('focus', () => set(false));
}

export function initPalette() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-palette]');
  if (!dialog) return;

  const input = dialog.querySelector<HTMLInputElement>('[data-palette-input]')!;
  const field = input.closest<HTMLElement>('.field') ?? input;
  const scroller = dialog.querySelector<HTMLElement>('[data-palette-scroll]')!;
  const listbox = dialog.querySelector<HTMLElement>('[role="listbox"]')!;
  const pill = dialog.querySelector<HTMLElement>('[data-palette-pill]')!;
  const empty = dialog.querySelector<HTMLElement>('[data-palette-empty]')!;
  const emptyQuery = dialog.querySelector<HTMLElement>('[data-palette-empty-q]')!;
  const status = dialog.querySelector<HTMLElement>('[data-palette-status]')!;
  const barPrimary = dialog.querySelector<HTMLElement>('[data-palette-primary]')!;
  const barPrimaryLabel = dialog.querySelector<HTMLElement>('[data-palette-primary-label]')!;
  const barSecondary = dialog.querySelector<HTMLElement>('[data-palette-secondary]')!;
  const barSep = dialog.querySelector<HTMLElement>('[data-palette-sep]')!;
  const iconTpl = document.getElementById('palette-icons') as HTMLTemplateElement | null;
  const triggers = document.querySelectorAll<HTMLElement>('[data-palette-open]');

  // The index is a static file (src/pages/search-index.json.ts), fetched while the
  // browser is idle after load, or at once on the first intent to search (hover or
  // focus on a trigger, ⌘K). Until it is in, an open palette shows just the field.
  let items: PaletteItem[] = [];
  let groupLabel = new Map<GroupId, string>();
  let groupOrder = new Map<GroupId, number>();
  let indexReady: Promise<void> | null = null;
  const loadIndex = () =>
    (indexReady ??= fetch('/search-index.json')
      .then((r) => r.json() as Promise<Payload>)
      .then((p) => {
        items = p.items;
        groupLabel = new Map(p.groups.map((g) => [g.id, g.label]));
        groupOrder = new Map(p.groups.map((g, i) => [g.id, i]));
        // Opened before the index arrived: show the results now.
        if (dialog.open && !dialog.classList.contains('is-closing')) render(input.value, undefined, false);
      })
      .catch(() => {
        indexReady = null; // try again on the next intent
      }));
  const idle = (fn: () => void) =>
    'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1200);
  if (document.readyState === 'complete') idle(loadIndex);
  else addEventListener('load', () => idle(loadIndex), { once: true });

  const iconMarkup = new Map<string, string>();
  iconTpl?.content.querySelectorAll<SVGElement>('[data-icon]').forEach((svg) => {
    iconMarkup.set(svg.dataset.icon!, svg.outerHTML);
  });
  const icon = (key: string) => iconMarkup.get(key) ?? '';

  // Keyboard hints: ⌘/⌥ on Apple platforms, Ctrl/Alt elsewhere (every
  // [data-mod-key] and [data-alt-key] on the page, src/scripts/platform.ts).
  applyKeyLabels();
  watchHardwareKeyboard();
  triggers.forEach((t) => t.setAttribute('aria-keyshortcuts', isMac() ? 'Meta+K' : 'Control+K'));

  let visible: Result[] = [];
  let active = -1;
  let closeTimer = 0;
  let statusTimer = 0;
  let copiedTimer = 0;
  let copiedId = '';

  const dynamicTitle = (item: PaletteItem) =>
    item.action === 'toggle-theme' ? (currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme') : item.title;

  const dynamicSubtitle = (item: PaletteItem) =>
    item.action === 'toggle-theme' ? `Currently ${currentTheme()}` : item.subtitle;

  function results(q: string): Result[] {
    if (!q.trim()) {
      const order = ['pages', 'actions', 'links'];
      return items
        .filter((i) => i.suggested)
        .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
        .map((item) => ({ item, score: 0, title: new Set(), subtitle: new Set() }));
    }
    const found = search(
      items.map((i) => ({ ...i, title: dynamicTitle(i), subtitle: dynamicSubtitle(i) })),
      q,
    );
    // Order groups by their best hit; keep items ranked inside each group.
    const top = new Map<GroupId, number>();
    for (const r of found) if (!top.has(r.item.group)) top.set(r.item.group, r.score);
    return found.sort(
      (a, b) =>
        (top.get(b.item.group)! - top.get(a.item.group)! ||
          groupOrder.get(a.item.group)! - groupOrder.get(b.item.group)!) ||
        b.score - a.score,
    );
  }

  const optId = (item: PaletteItem) => `pal-${item.id.replace(/[^\w-]/g, '')}`;

  // Raycast-style accessory: the row's type, right-aligned and muted.
  const CV_KIND: Record<string, string> = {
    education: 'Education',
    research: 'Research',
    experience: 'Experience',
    teaching: 'Teaching',
    activities: 'Activity',
    publications: 'Publication',
    talks: 'Talk',
    honors: 'Award',
    certificates: 'Certificate',
  };

  function kindLabel(item: PaletteItem): string {
    switch (item.group) {
      case 'pages':
        return 'Page';
      case 'sections':
        return 'Section';
      case 'work':
        return item.id.startsWith('work-app-') ? 'App' : 'Project';
      case 'cv':
        return CV_KIND[item.id.split('-')[1]] ?? 'CV entry';
      case 'actions':
        return item.href ? 'Link' : 'Action';
      case 'links':
        return item.href?.startsWith('mailto:') ? 'Email' : 'Link';
    }
  }

  /** The action bar's verbs for a row: what ↵ does, and ⌘↵ where it differs. */
  function verbs(item: PaletteItem): { primary: string; secondary?: string } {
    switch (item.action) {
      case 'download-cv':
        return { primary: 'Download' };
      case 'copy-email':
        return { primary: item.id === copiedId ? 'Copied' : 'Copy' };
      case 'toggle-theme':
        return { primary: 'Switch theme' };
    }
    if (item.href?.startsWith('mailto:')) return { primary: 'Write email' };
    if (item.external) return { primary: 'Open in new tab' };
    return { primary: 'Open', secondary: 'Open in new tab' };
  }

  function metaHtml(item: PaletteItem): string {
    const meta = item.meta ? `<span class="opt-meta">${esc(item.meta)}</span>` : '';
    // Copied: the type label turns past tense; the check draws on the copy icon.
    const kind =
      item.id === copiedId
        ? `<span class="opt-kind is-copied">Copied</span>`
        : `<span class="opt-kind">${kindLabel(item)}</span>`;
    // Trailing slot (always reserved, so the labels line up): ↗ on external
    // rows, a → that slides in on the selected on-site row.
    const trail = item.external
      ? `<span class="opt-trail opt-ext">${icon('arrow-up-right')}</span>`
      : item.href
        ? `<span class="opt-trail opt-go">${icon('arrow-right')}</span>`
        : `<span class="opt-trail"></span>`;
    return `<span class="opt-acc">${meta}${kind}</span>${trail}`;
  }

  function updateBar(item: PaletteItem | undefined) {
    const v = item ? verbs(item) : null;
    barPrimary.hidden = !v;
    barPrimaryLabel.textContent = v?.primary ?? '';
    barSecondary.hidden = !v?.secondary;
    barSep.hidden = !v?.secondary;
  }

  /**
   * Spotlight's expand: one piece of glass that grows down to its new height.
   * The box takes its new size at once; a clip reveals it from the old
   * height (no layout animation, and the glass keeps seeing the page, which
   * opacity or a filter on a wrapper would break). Shrinking is immediate.
   */
  let growAnim: Animation | null = null;
  const OUT = 72; // px of room for the shadow outside the box
  function grow(from: number) {
    const to = dialog!.offsetHeight;
    growAnim?.cancel();
    growAnim = null;
    if (to - from < 2) return;
    const r = getComputedStyle(dialog!).borderTopLeftRadius;
    const clip = (bottom: number) => `inset(-${OUT}px -${OUT}px ${bottom}px -${OUT}px round ${r})`;
    const spring = getComputedStyle(document.documentElement).getPropertyValue('--spring-quick').trim();
    const timing = { duration: 380, easing: spring || 'cubic-bezier(.23,1,.32,1)' };
    try {
      growAnim = dialog!.animate({ clipPath: [clip(to - from), clip(-OUT)] }, timing);
    } catch {
      growAnim = dialog!.animate({ clipPath: [clip(to - from), clip(-OUT)] }, { ...timing, easing: 'cubic-bezier(.23,1,.32,1)' });
    }
    growAnim.onfinish = () => (growAnim = null);
  }

  /** `announce: false` for re-renders that keep the same results (copy, theme). */
  function render(q: string, keepId?: string, announce = true, from = dialog!.offsetHeight) {
    // The row that was selected before this render, so its icon story is not
    // replayed when the same row stays on top (typing, copy, theme).
    const prevId = visible[active]?.item.id;
    visible = results(q);
    let html = '';
    let group: GroupId | null = null;
    visible.forEach((r, i) => {
      const { item } = r;
      if (item.group !== group) {
        if (group) html += '</div>';
        group = item.group;
        html += `<div role="group" class="grp" aria-labelledby="pal-g-${group}"><div class="grp-label label" role="presentation" id="pal-g-${group}">${esc(groupLabel.get(group) ?? '')}</div>`;
      }
      const title = dynamicTitle(item);
      const sub = dynamicSubtitle(item);
      const brand = BRANDS.has(item.icon);
      html +=
        `<div role="option" class="opt" id="${optId(item)}" data-i="${i}" data-kind="${item.icon}" aria-selected="false">` +
        `<span class="opt-icon${brand ? ' is-brand' : ''}${item.id === copiedId ? ' is-done' : ''}" aria-hidden="true">${icon(item.icon)}</span>` +
        `<span class="opt-text"><span class="opt-title">${highlight(title, r.title)}</span>` +
        (sub ? `<span class="opt-sub">${highlight(sub, r.subtitle)}</span>` : '') +
        `</span>${metaHtml(item)}</div>`;
    });
    if (group) html += '</div>';
    listbox.innerHTML = html;

    const none = visible.length === 0;
    // Before the index has arrived nothing is "not found" yet: just the field.
    empty.hidden = !none || !items.length;
    scroller.hidden = none;
    if (none) emptyQuery.textContent = q.trim();
    input.setAttribute('aria-expanded', String(!none));
    grow(from);

    const keep = keepId ? visible.findIndex((r) => r.item.id === keepId) : -1;
    // On touch, an empty query selects nothing: a pre-lit row is a keyboard
    // cue (↵ opens it) and only looks stuck under a finger. Typing selects the
    // top result again, so the keyboard's Go key opens it.
    const idleTouch = coarse.matches && !q.trim();
    const next = keep >= 0 ? keep : none || idleTouch ? -1 : 0;
    const nextEl = optionAt(next);
    if (nextEl && visible[next].item.id === prevId) {
      // Same row: hold its selected pose, no replay.
      nextEl.classList.add('is-settled');
    } else if (nextEl) {
      // A new row: commit its resting style first, so selecting it below
      // plays the story from rest (transitions need a before-state).
      void nextEl.offsetWidth;
    }
    select(next, { instant: true, scroll: keep < 0 ? 'top' : 'nearest' });

    if (!announce) return;
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.textContent = none
        ? 'No results'
        : `${visible.length} result${visible.length === 1 ? '' : 's'}`;
    }, 350);
  }

  const optionAt = (i: number) => listbox.querySelector<HTMLElement>(`[data-i="${i}"]`);

  function placePill(el: HTMLElement | null, instant: boolean) {
    if (!el) {
      pill.style.opacity = '0';
      return;
    }
    // Layout offsets, not rects: rects are scaled while the dialog is still
    // animating in (scale .98), which would park the pill a few px off.
    // Rows are offset from .results, the pill's positioned parent.
    const top = el.offsetTop;
    if (instant) pill.classList.add('no-anim');
    pill.style.setProperty('--y', `${top}px`);
    pill.style.setProperty('--h', `${el.offsetHeight}px`);
    pill.style.opacity = '1';
    if (instant) {
      pill.getBoundingClientRect();
      requestAnimationFrame(() => pill.classList.remove('no-anim'));
    }
  }

  function select(i: number, opts: { instant?: boolean; scroll?: 'nearest' | 'top' | 'none' } = {}) {
    const prev = optionAt(active);
    if (prev && i !== active) {
      prev.setAttribute('aria-selected', 'false');
      // Re-armed: the next time this row is selected its story plays again.
      prev.classList.remove('is-settled');
    }
    active = i;
    const el = optionAt(i);
    updateBar(visible[i]?.item);
    if (!el) {
      input.removeAttribute('aria-activedescendant');
      placePill(null, true);
      return;
    }
    el.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', el.id);
    placePill(el, !!opts.instant);

    const mode = opts.scroll ?? 'nearest';
    if (mode === 'top' || i === 0) {
      scroller.scrollTop = 0;
    } else if (mode === 'nearest') {
      // Keep the group label in view when landing on a group's first row.
      const label = el.previousElementSibling?.classList.contains('grp-label') ? (el.previousElementSibling as HTMLElement) : null;
      const topEl = label ?? el;
      const sr = scroller.getBoundingClientRect();
      const a = topEl.getBoundingClientRect().top - sr.top;
      const b = el.getBoundingClientRect().bottom - sr.top;
      const pad = 6;
      if (a < pad) scroller.scrollTop += a - pad;
      else if (b > scroller.clientHeight - pad) scroller.scrollTop += b - scroller.clientHeight + pad;
    }
  }

  function move(delta: number) {
    if (!visible.length) return;
    const n = visible.length;
    select((active + delta + n) % n);
  }

  /* ---- open / close ---- */

  // With an on-screen keyboard up (phones, iPads without a hardware
  // keyboard) the visible viewport shrinks: the list is capped to what is
  // left above the keyboard, so no result hides behind it.
  const footer = dialog.querySelector<HTMLElement>('.bar');
  function fitList() {
    const vv = window.visualViewport;
    if (!vv || !dialog!.open) return;
    if (innerHeight - vv.height < 120) {
      scroller.style.removeProperty('max-height');
      return;
    }
    const top = scroller.getBoundingClientRect().top;
    const below = footer && footer.offsetParent ? footer.offsetHeight : 0;
    scroller.style.maxHeight = `${Math.max(132, vv.offsetTop + vv.height - top - below - 12)}px`;
  }
  window.visualViewport?.addEventListener('resize', fitList);
  window.visualViewport?.addEventListener('scroll', fitList);

  function open(q = '') {
    loadIndex();
    clearTimeout(closeTimer);
    dialog!.classList.remove('is-closing');
    if (!dialog!.open) dialog!.showModal();
    // A fresh open: the first row plays its story even if it was selected
    // when the palette last closed.
    visible = [];
    active = -1;
    input.value = q;
    // Opens as the search field alone, then grows down to the results.
    render(q, undefined, true, field.offsetHeight);
    input.focus();
    fitList();
  }

  function close(opts: { instant?: boolean } = {}) {
    if (!dialog!.open) return;
    clearTimeout(closeTimer);
    growAnim?.cancel();
    if (opts.instant) {
      dialog!.classList.remove('is-closing');
      dialog!.close();
      return;
    }
    dialog!.classList.add('is-closing');
    closeTimer = window.setTimeout(() => {
      dialog!.close();
      dialog!.classList.remove('is-closing');
    }, 130);
  }

  const isOpen = () => dialog.open && !dialog.classList.contains('is-closing');

  /* ---- activation ---- */

  function go(href: string, newTab: boolean) {
    const url = new URL(href, location.href);
    if (newTab || (url.origin !== location.origin && url.protocol.startsWith('http'))) {
      close({ instant: true });
      window.open(url.href, '_blank', 'noopener');
      return;
    }
    close({ instant: true });
    if (url.pathname === location.pathname && url.hash) {
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      history.pushState(null, '', url.hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Move focus for screen readers, without a ring around a whole section.
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.setAttribute('data-palette-target', '');
        target.addEventListener('blur', () => target.removeAttribute('data-palette-target'), { once: true });
        target.focus({ preventScroll: true });
      }
      return;
    }
    location.assign(url.href);
  }

  async function activate(i: number, newTab = false) {
    const r = visible[i];
    if (!r) return;
    const { item } = r;
    if (item.href) return go(item.href, newTab);

    switch (item.action) {
      case 'download-cv':
        close();
        downloadCV();
        break;
      case 'toggle-theme':
        toggleTheme();
        break;
      case 'copy-email': {
        const email = item.subtitle ?? '';
        const ok = await copyText(email);
        copiedId = ok ? item.id : '';
        clearTimeout(statusTimer);
        status.textContent = ok ? `Copied ${email} to the clipboard` : 'Could not copy. The address is ' + email;
        render(input.value, item.id, false);
        clearTimeout(copiedTimer);
        copiedTimer = window.setTimeout(() => {
          copiedId = '';
          if (dialog!.open) render(input.value, visible[active]?.item.id, false);
        }, 1800);
        break;
      }
    }
  }

  /* ---- events ---- */

  input.addEventListener('input', () => render(input.value));

  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        if (!visible.length) break;
        e.preventDefault();
        select(0);
        break;
      case 'End':
        if (!visible.length) break;
        e.preventDefault();
        select(visible.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        activate(active, e.metaKey || e.ctrlKey);
        break;
    }
  });

  // Keep focus in the input while clicking rows.
  listbox.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.opt')) e.preventDefault();
  });
  // Mouse only: a finger dragging the list to scroll should not drag the
  // selection along. Also ignore the synthetic move some browsers fire when
  // the list scrolls under a resting pointer (keyboard scrolling), so the
  // arrow-key selection is not stolen by a mouse that never moved.
  let lastX = -1;
  let lastY = -1;
  listbox.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.clientX === lastX && e.clientY === lastY) return;
    lastX = e.clientX;
    lastY = e.clientY;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.opt');
    if (!el) return;
    const i = Number(el.dataset.i);
    if (i !== active) select(i, { scroll: 'none' });
  });
  listbox.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.opt');
    if (el) activate(Number(el.dataset.i), e.metaKey || e.ctrlKey);
  });

  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });

  // The browser may still close it directly (e.g. a second Esc); tidy up.
  dialog.addEventListener('close', () => {
    clearTimeout(closeTimer);
    dialog.classList.remove('is-closing');
  });

  // Backdrop click: the pointer lands on the <dialog> itself, outside its box.
  dialog.addEventListener('pointerdown', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) close();
  });

  dialog.querySelectorAll('[data-palette-close]').forEach((b) => b.addEventListener('click', () => close()));
  dialog.querySelectorAll<HTMLElement>('[data-palette-suggest]').forEach((b) =>
    b.addEventListener('click', () => {
      input.value = b.dataset.paletteSuggest ?? '';
      render(input.value);
      input.focus();
    }),
  );

  triggers.forEach((t) => {
    t.addEventListener('click', () => (isOpen() ? close() : open()));
    // Intent: start the fetch before the click lands.
    t.addEventListener('pointerenter', loadIndex, { once: true });
    t.addEventListener('focus', loadIndex, { once: true });
  });

  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isOpen() ? close() : open();
      return;
    }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !dialog.open && !isEditable(e.target)) {
      e.preventDefault();
      open();
    }
  });

  window.addEventListener('themechange', () => {
    if (!dialog.open) return;
    render(input.value, visible[active]?.item.id, false);
    // The selected row keeps its id, so a screen reader would not re-read it.
    clearTimeout(statusTimer);
    status.textContent = `Switched to the ${currentTheme()} theme`;
  });

  tuckOnScroll(document.querySelector<HTMLElement>('[data-palette-pill-trigger]'));

  // Re-measure the pill if fonts or the viewport shift the rows.
  new ResizeObserver(() => {
    if (dialog.open) placePill(optionAt(active), true);
  }).observe(listbox);

  // Handy for screenshots and deep links: ?palette=open&q=fulbright
  const params = new URLSearchParams(location.search);
  if (params.get('palette') === 'open') open(params.get('q') ?? '');
}
