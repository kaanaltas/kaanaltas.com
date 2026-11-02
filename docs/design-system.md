# Kaan Altaş: Design System Spec (v1)

Stack: Astro plus vanilla CSS, with no UI framework and no animation library. The only runtime JS is about 2 KB for the nav pill and figure in-view handling, plus about 11 KB (5 KB gzipped) for the mesh canvas on the landing page (and its inline TeX outline JSON, about 13 KB gzipped). Tokens live in `src/styles/tokens.css`. Fonts: Inter's Latin file is preloaded; Turkish and Departure Mono ship as subsets with identical glyphs (`scripts/subset-fonts.py`, `src/styles/fonts.css`), and until Inter arrives, text is set in a metric-matched Arial (`Inter Fallback`), so the swap shifts nothing. The ⌘K index is a static, cached `/search-index.json`, fetched when the browser is idle or on the first intent to search. Theme is set by `data-theme` on `<html>`, applied by an inline pre-paint script that reads `localStorage.theme` and falls back to `prefers-color-scheme`. Until the reader picks one, the theme follows the system live; a pick is saved and kept (reloads, system changes), shared across open tabs (`storage` event) and re-applied to pages restored from the back/forward cache (`pageshow`), and the `theme-color` metas follow it so the browser's own bar matches (`src/scripts/theme.ts`). Keyboard labels are per platform: `[data-mod-key]` shows ⌘ on Apple systems and Ctrl elsewhere, `[data-alt-key]` ⌥/Option or Alt (`src/scripts/platform.ts`); every handler already accepts `metaKey || ctrlKey`. A hardware keyboard on a touch device (an iPad with a Magic Keyboard) is inferred from the first key only a hardware keyboard sends (arrows, Esc, Tab, a ⌘/Ctrl/⌥ shortcut): `html.kbd` (kept for the session) brings back the keyboard hints touch layouts hide (the palette's esc and ↵ bar, Quick Look's esc). With an on-screen keyboard up, the palette caps its list to the visible viewport above it.

---

## 1. Typography

**Primary: Inter Variable** (`@fontsource-variable/inter`, already installed, OFL). The owner likes jakub.kr's type, and Inter is that face. With `cv01` (flat-top 1) and `ss03` (round quotes) it reads more "engineered" than the stock version. It has true tabular figures for dates and numbers, and it supports the in-between weights (450 and 550) that carry this system's quiet hierarchy. We take leerob's calm without his serif: the brief asks for a sans, and a serif would push the site toward "blog".

**Alternative to try: Geist** (`@fontsource-variable/geist`, installed). It is more geometric and more "design-engineer". Swap `--font-sans` only and leave the rest of the scale as is. Decide on a real screenshot of the landing page at 1440 and 390 px.

**Mono (UI labels): Geist Mono** (`@fontsource-variable/geist-mono`, installed). Use it for dates, tags, figure numbers, units, and keyboard hints.

**Pixel mono (illustrations only): Departure Mono** (OFL). Self-host `DepartureMono-Regular.woff2` in `/public/fonts/`. Use it only inside figures and figure captions, never for body UI. Preload it only on pages that contain figures.

```css
:root{
  --font-sans:"Inter Variable",system-ui,-apple-system,"Segoe UI",sans-serif;
  --font-mono:"Geist Mono Variable",ui-monospace,SFMono-Regular,Menlo,monospace;
  --font-pixel:"Departure Mono",var(--font-mono);
}
html{font-family:var(--font-sans);font-feature-settings:"cv01","ss03";
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
*{font-variant-ligatures:none}
code,kbd,.mono{font-family:var(--font-mono);font-feature-settings:normal}
time,.num{font-variant-numeric:tabular-nums}
```

| Token | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|
| `--t-display` | `clamp(2rem,1.4rem+2.4vw,2.75rem)` / 1.1 | 550 | -0.025em | Landing name only |
| `--t-h1` | 1.75rem / 1.2 | 550 | -0.02em | Subpage title |
| `--t-h2` | 1rem / 1.5 | 550 | 0 | Section heads, same size as body (jakub) |
| `--t-body` | 1rem (16px) / 1.625 | 400 | 0 | Prose |
| `--t-lede` | 1.125rem / 1.55 | 400 | -0.005em | Landing sentence |
| `--t-sm` | 0.875rem / 1.5 | 400/450 | 0 | Meta, nav tabs |
| `--t-label` | 0.75rem / 1.4, **mono**, uppercase | 450 | +0.04em | Technical labels |
| `--t-fig` | 10–12 user units, **pixel**, uppercase | 400 | +0.02em | Figure labels and captions |

Links and list titles use weight 450, headings 550, and body 400. Avoid 700. Use `text-wrap:balance` on headings and `text-wrap:pretty` on paragraphs.

---

## 2. Color

Neutral grayscale with **one accent: cobalt**, taken from makingsoftware. The accent appears only in:
- focus rings
- the active-nav dot
- illustration ink
- `::selection`
- link underlines on hover, prose only

Body links stay neutral.

```css
:root,[data-theme="light"]{
  --bg:#FCFCFC; --surface:#FFFFFF; --surface-2:#F4F4F5;
  --text:#1A1A1A; --text-2:#6F6F6F; --text-3:#8F8F8F;
  --line:#EBEBEB; --line-strong:#D9D9D9;
  --ul-rest:#D9D9D9; --ul-hover:#6F6F6F;
  --accent:#1342FF; --accent-soft:#E6EBFF; --on-accent:#FFFFFF;
  --focus:var(--accent); --selection:#E6EBFF;
  --shadow-hair:0 0 0 1px #0000000f,0 1px 2px -1px #0000000f,0 2px 4px 0 #0000000a;
  --mesh-ink:26 26 26;             /* rgb triplet for canvas */
  color-scheme:light;
}
[data-theme="dark"]{
  --bg:#0F0F10; --surface:#161618; --surface-2:#1C1C1F;
  --text:#EDEDED; --text-2:#A1A1A1; --text-3:#7A7A7A;
  --line:#232326; --line-strong:#2E2E32;
  --ul-rest:#3A3A3E; --ul-hover:#A1A1A1;
  --accent:#7B93FF; --accent-soft:#1C2340; --on-accent:#0F0F10;
  --selection:#243063;
  --shadow-hair:0 0 0 1px #ffffff12,0 1px 2px -1px #00000066,0 2px 4px 0 #00000040;
  --mesh-ink:237 237 237;
  color-scheme:dark;
}
@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]){ /* same as [data-theme=dark] */ } }
body{background:var(--bg);color:var(--text)}
::selection{background:var(--selection)}
```

**Contrast (WCAG 2.x)**
- Light theme:
  - `--text` on `--bg` is 16.9:1.
  - `--text-2` (#6F6F6F) on `--bg` is 4.9:1, which passes AA for body text.
  - `--accent` #1342FF on `--bg` is 6.4:1, which passes AA.
  - `--text-3` is 3.3:1, so use it **only** for icons, disabled items, and large or non-essential meta. Never use it for prose.
- Dark theme:
  - `--text` on `--bg` is 16.3:1.
  - `--text-2` is 7.2:1.
  - `--accent` #7B93FF is 6.8:1.
  - The dark theme's accent is lighter because the light cobalt only reaches 2.6:1 on dark.

---

## 3. Spacing and layout

A 4px base scale: `--s-1:4px --s-2:8px --s-3:12px --s-4:16px --s-5:24px --s-6:32px --s-7:48px --s-8:64px --s-9:96px --s-10:128px`.

| Token | Value |
|---|---|
| `--measure` | 640px (prose column, about 72 characters) |
| `--wide` | 960px (figures break out of the prose column) |
| `--landing` | 560px |
| `--gutter` | 16px below 640px, 24px from 640px up |
| Page padding (block) | 48px on mobile, 96px from 640px up |
| Section gap | 64px on mobile, 128px on desktop |
| Paragraph gap | 16px |
| Heading gap | h2 margin-bottom 16px |
| Radii | `--r-sm:6px`, `--r-md:12px`, `--r-lg:16px`, `--r-pill:999px`; nested radius = outer minus padding |

Breakpoints: 640px and 1024px, mobile-first. Never allow horizontal scroll (`overflow-x:clip` on body).

**Landing page.** It fits in one viewport: `min-height:100svh`, with the block in the middle row of `grid-template-rows: 1fr auto 1.7fr`, so the free space splits 1 : 1.7 above and below it (a slight optical lift that holds with the header in flow and collapses gracefully on short screens). From top to bottom:
1. The name in `--t-display`.
2. One `--t-lede` sentence in `--text-2`.
3. A row of 4–5 links (Research · Apps · CV · GitHub · Email), 12px gap, wrapping on phones.
4. A mono meta line, for example `PSE · OPTIMIZATION · ML · SWIFT`.

The nav tabs sit top-right, with the glass pill (§5b).

**Subpages** ("About", "Interests", "Work") use the `--measure` column, a jakub-style header, and leerob-style hairline rows for lists: rows are separated by `1px var(--line)`, dates sit on the right in mono tabular figures, and hovering one row dims its siblings to 0.6 opacity.

---

## 4. Motion

Springs are expressed as CSS `linear()` curves, generated from a damped-oscillator model (framer-style duration and bounce). The duration listed is the settle time, and the motion reads as about 60% of that.

```css
:root{
  --ease-out:cubic-bezier(.23,1,.32,1);
  --ease-in-out:cubic-bezier(.77,0,.175,1);
  --ease-exit:cubic-bezier(.4,0,1,1);
  /* quick: d .35 bounce .1, 330ms */
  --spring-quick:linear(0,.056,.179,.325,.467,.593,.698,.782,.847,.895,.931,.956,.973,.984,.992,.996,1);
  --dur-quick:330ms;
  /* snappy: d .5 bounce .2, 650ms (nav pill, toggles) */
  --spring-snappy:linear(0,.048,.16,.298,.441,.573,.687,.781,.855,.911,.951,.978,.996,1.007,1.013,1.015,1.015,1.014,1.012,1.009,1.007,1.005,1.004,1.003,1);
  --dur-snappy:650ms;
  /* bounce: d .45 bounce .35, 710ms (icon pops) */
  --spring-bounce:linear(0,.071,.234,.43,.618,.778,.901,.985,1.036,1.061,1.068,1.063,1.052,1.039,1.026,1.015,1.007,1.001,.997,.996,.995,.996,.996,.997,1);
  --dur-bounce:710ms;
  /* soft: d .6 bounce 0, 820ms (entrances, figure assembly) */
  --spring-soft:linear(0,.05,.161,.29,.418,.533,.631,.712,.778,.83,.871,.903,.927,.946,.959,.97,.978,.984,.988,.991,.994,.995,.997,.997,1);
  --dur-soft:820ms;
  --dur-fade:200ms; --dur-exit:160ms;
}
```

**Rules**
- Hover color and underline changes: 200ms `--ease-out`.
- Press: `scale:.97` over `--dur-quick`.
- Entrance: once per page load, children go from `opacity:0; translate:0 8px; filter:blur(4px)` to rest over `--dur-soft` with `--spring-soft`, staggered 60ms, capped at 6 items.
- Nothing loops on the page chrome.
- Never animate layout properties except the nav pill's `width`.
- Hover effects go only inside `@media (hover:hover) and (pointer:fine)`.

**Reduced-motion policy.** The site does not inherit `prefers-reduced-motion`; every visitor gets the same motion.

---

## 5. Component CSS

### a) In-text link underline (jakub)

```css
.prose a,.link{
  color:var(--text);font-weight:450;
  text-decoration-line:underline;text-decoration-color:var(--ul-rest);
  text-decoration-thickness:1px;text-underline-offset:3px;text-decoration-skip-ink:auto;
  transition:color 200ms var(--ease-out),text-decoration-color 200ms var(--ease-out);
}
@media (hover:hover){ .prose a:hover,.link:hover{text-decoration-color:var(--ul-hover)} }
.prose a:hover{text-decoration-color:var(--accent)} /* prose only: the accent moment */
:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:2px}
.link svg{display:inline-block;width:1em;height:1em;margin-right:.25em;vertical-align:-.125em}
.link{white-space:nowrap}
```

Body copy is `--text-2`, so a link reads darker and heavier than the text around it.

### b) Clear glass, and the nav pill

> Revised (Oct 2026, the "Clear" recipe; audit and measurements in `experiments/glass-audit/README.md`). Every floating surface uses **one** glass: a thin tint of the theme's surface colour, clearly see-through, with a small blur, a mild saturation, **one** 1px edge and a soft shadow. There is no lens, no rim gradient and no inset shadow (inset shadows with an offset made the inner shape sit off centre), and it is never white in dark. It replaces the nelson pill recipe and the Spotlight panel recipe.

**Tokens** (`src/styles/global.css`, `:root` and `:root[data-theme='dark']`; every surface points its own hooks at them):

| Token | Light | Dark |
|---|---|---|
| `--glass-tint` (RGB triplet) | `255 255 255` | `22 22 24` (`#161618`, the surface) |
| `--glass-alpha` | .32 (nav pill, zoom dock) | same |
| `--glass-text-alpha` | .6 (the nav pill, in an ellipse behind its label) | same |
| `--glass-label-alpha` | .45 (surfaces that are mostly label) | same |
| `--glass-panel-alpha` | .56 (the ⌘K panel) | same |
| `--glass-blur` / `--glass-panel-blur` | 3px / 24px | same |
| `--glass-saturate` | 1.3 | same |
| `--glass-edge` | `rgb(20 20 40 / .1)` | `rgb(255 255 255 / .09)` |
| `--glass-shadow` | `0 1px 2px rgb(20 20 40/.05), 0 6px 16px -8px rgb(20 20 40/.18)` | black .5 / .7 |
| `--glass-shadow-lg` (the panel) | `0 2px 6px -2px rgb(20 20 40/.08), 0 24px 56px -24px rgb(20 20 40/.3)` | black .5 / .75 |
| `--glass-sel` (the palette's selected row) | `rgb(20 20 40 / .06)` | `rgb(255 255 255 / .07)` |
| `--glass-solid` | `#fff` | `#1b1b1e` |
| `--glass-scrim` (the header's fade) | `--bg` 85% → 45% at 50% → clear | same |

**Per surface:**

| Surface | Fill | Blur | Edge |
|---|---|---|---|
| Nav pill (`Nav.astro` `.glass`) | `radial-gradient(62% 80% at 50% 50%, tint/--glass-text-alpha, tint/--glass-alpha)` | 3px | `border: 1px solid` |
| "Jump to… ⌘K" (`.palette-trigger`) | tint / `--glass-label-alpha` | 3px | flat 1px on `::before` |
| ⌘K panel (`.palette`, §5 b2) | tint / `--glass-panel-alpha` | 24px: a list of text over the page needs more blur, not more fill | flat 1px on `::before` |
| Selected row (`.pill`) | `--glass-sel` | n/a | `inset 0 0 0 .5px` edge |
| Figure Open/Close (`.fig-toggle`) | tint / `--glass-label-alpha` | 3px | `0 0 0 1px` ring |
| Gallery zoom dock (`.g-dock`) | tint / `--glass-alpha` (icons only) | 3px | `inset 0 0 0 1px` |

All of them use `backdrop-filter: blur(…) saturate(var(--glass-saturate))` (plus `-webkit-`) and take `--glass-shadow`; the panel takes `--glass-shadow-lg`.

**The header.** `.site-header` fades with `--glass-scrim`, thin enough that the page reaches the pill. It carries **no** `view-transition-name` in CSS: a named element is a Backdrop Root, and the pill's blur would then see only the header and never the page. `Base.astro` names it `site-header` on `pageswap` and `pagereveal` and clears the name when the transition finishes, so the bar still holds still between pages (§4, `global.css`). Never put a filter, opacity < 1, mask or view-transition-name on anything above a glass surface.

**Fallbacks** (in the tokens). Without `backdrop-filter` every alpha becomes 1 and the header returns to `linear-gradient(var(--bg) 40%, transparent)`. Under `prefers-reduced-transparency: reduce` or `prefers-contrast: more` the same happens, and both blurs go to 0. More contrast also takes a firm edge (`#a8a8ae` / `#5a5a60`). There is no reduced-motion branch (§4).

**Contrast** (worst pixel under each text run, glass composited with the text hidden, DPR 2):
- The selected tab is ≥ 4.9:1 in every scene, both themes, 1440 and 390: 15.7+ plain, 11.8+ over a figure, 5.1 over a block of `--text` right under the bar.
- "Jump to…" 7.24 / 8.38, Open/Close 4.99 / 6.92, palette lowest text 5.69 / 6.60 (light / dark), over a busy stage.
- **Accepted trade-off:** the unselected tabs sit on the thin fade with no protection band. Over a figure their worst pixel falls to 1.42 (light) and 1.75 (dark); over text and plain page they stay at 4.86 / 7.36. The owner chose this for a see-through bar.
- If a selected label ever drops below 4.5, raise the alpha behind its glyphs (the ellipse), not the whole surface; never lighten the text.

**Transmission** (σL* of the page seen through the nav pill ÷ σL* of what is behind it, flowsheet scrolling under the pill): 0.295 light / 0.357 dark, against 0.037 / 0.120 before.

**The nav pill's markup and motion:**

```html
<nav class="tabs" aria-label="Primary">
  <span class="glass" aria-hidden="true"></span>
  <a href="/interests" aria-current="page">Interests</a><a href="/work">Work</a>
  <a href="/cv">CV</a><a href="/gallery">Gallery</a>
</nav>
```

```css
.tabs{position:relative;display:flex;gap:2px;perspective:1400px;isolation:isolate}
.tabs a{position:relative;padding:6px 12px;font-size:var(--t-sm);color:var(--text-2);
  text-decoration:none;border-radius:12px;transition:color 200ms var(--ease-out)}
.tabs a[aria-current="page"],.tabs a:hover{color:var(--text)}
.glass{
  position:absolute;z-index:-1;top:0;left:0;height:var(--h,32px);width:var(--w,0);
  translate:var(--x,0) var(--y,0);
  transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));
  transform-origin:var(--ox,50%) var(--oy,50%);
  border-radius:12px;pointer-events:none;opacity:var(--o,0);
  background:radial-gradient(62% 80% at 50% 50%,
    rgb(var(--glass-tint) / var(--glass-text-alpha)), rgb(var(--glass-tint) / var(--glass-alpha)));
  -webkit-backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border:1px solid var(--glass-edge);box-shadow:var(--glass-shadow);
  transition:translate var(--dur-snappy) var(--spring-snappy),width var(--dur-snappy) var(--spring-snappy),
    transform 450ms var(--spring-quick),opacity 300ms var(--ease-out);
}
```

The radius is 12px on a 32px pill, deliberately not a capsule.

JavaScript (about 30 lines, `src/scripts/tabs.ts`):
- On load, place the pill on `[aria-current]` with `--o:1`.
- On `pointerenter` of a tab, set `--x`, `--y` and `--w` from `offsetLeft`, `offsetTop` and `offsetWidth`.
- On `pointerleave` of the nav, after 300ms, return the pill to the current tab.
- On `pointermove`, compute nx and ny in [-1, 1] relative to the pill:
  - `--rx = -ny*min(1.6,.7+.18*w/h)deg`
  - `--ry = .8*nx deg`
  - `--ox = 30+40*px01 %` (and `--oy` the same way)
- Skip the tilt entirely under `(any-hover:none)`.
- Re-measure with a `ResizeObserver`.

The first placement sets `transition:none` for one frame so the pill does not fly in from the left.

### b2) Command palette (⌘K)

> macOS 26 Spotlight's layout with Raycast's list inside, in the clear glass (§5 b). **One** rounded-rect piece of glass (never a capsule, never split into a field and a detached panel): it opens as the search field and grows down to show the results.

The palette (`CommandPalette.astro`) and its bottom-right "Jump to… ⌘K" trigger keep their `--g-*` hooks. `--g-fill`, `--g-blur`, `--g-edge`, `--g-shadow`, `--g-sel` and `--g-sel-shadow` point at the `--glass-*` tokens: the panel takes the panel alpha and blur, the trigger the label alpha and the small blur. The text and keycap colours stay as the palette's own, light on `.palette, .palette-trigger` and dark under `html[data-theme='dark']`. They follow `data-theme` only, so "Switch theme" restyles the open palette at once.

| Part | Light | Dark |
|---|---|---|
| Page behind (`::backdrop`) | `rgb(24 24 30/.06)` + `blur(2px)` | `rgb(0 0 0/.30)` + `blur(2px)` |
| Text / secondary / tertiary | `#161618` / `#56565b` / `#5c5c61` | `#f2f2f4` / `#b1b1b6` / `#9c9ca1` |
| Matched characters (the accent) | `--accent` `#1342ff`, weight 560 | `#9db0ff` (the site's `#7b93ff` is 3.8:1 on the selected row) |
| Selection | `--glass-sel` + `inset 0 0 0 .5px` `--glass-edge` | same tokens |

- **Shape.** 640px wide, 15vh from the top, radius 20px (18px on phones). The field is 56px (52px on phones) with a 20px magnifier and 19px query text (17px on phones, so iOS does not zoom); the caret is the accent. A 1px `--g-line` hairline separates it from the list. Results padding 6px, rows 44px (52px on phones) with radius 10px. Keycaps are 6px, icon tiles 7px, the trigger 12px.
- **Raycast list.** Each row: a 24px glass icon tile (micro-icon at 16px, brand glyph at 12px), the title in regular weight, the subtitle on the same line in the secondary grey, then right-aligned accessories: the mono meta (a year, `PDF`, the parent page) and a type label in the tertiary grey: Page, Section, Project, App, Education, Research, Experience, Teaching, Activity, Publication, Talk, Award, Certificate, Action, Link, Email (`kindLabel()` in `palette.ts`, derived from the group and id). Last, a fixed 16px trailing slot: `↗` on external rows, `→` sliding in on the selected on-site row. Section headers are the mono `.label` at 10.5px, `.07em`. The selection is a quiet filled rounded rect that slides between rows (`translate`, 240ms `--spring-quick`).
- **Action bar** (40px, replaces the old hint bar). Left: the `KA` mark (Departure Mono on a 20px tile) and "Kaan Altaş". Right: the selected row's primary verb with `↵` (Open, Open in new tab, Write email, Download, Copy → "Copied", Switch theme), then a hairline and "Open in new tab ⌘↵" for on-site links only (`verbs()` in `palette.ts`). Hidden on touch, where there are no keys and the list needs the room above the keyboard.
- **Motion.** Opening: opacity 160ms and scale .97 → 1 over 300ms `--spring-quick`, while the glass grows from the field's height to its full height: a WAAPI `clip-path: inset(… <old-to-new>px … round 20px)` reveal over 380ms `--spring-quick` (`grow()` in `palette.ts`). The same reveal runs whenever the results get taller while typing; shrinking is immediate. No layout property animates, and nothing above the glass carries opacity or a filter (that would make it a backdrop root and the glass would stop seeing the page). Closing: 120ms `--ease-exit`, opacity and scale .98.
- **Fallbacks.** Through the tokens (§5 b): opaque, no blur, without `backdrop-filter` or under reduced transparency or more contrast.
- **Mobile.** Full width minus the gutters, 12px (or the safe area) from the top; the list is capped at `min(400px, 46dvh)` so it stays above the on-screen keyboard; titles and subtitles stack, and the meta and type label are dropped (the `→`/`↗` stays). The field shows a "Close" word instead of the esc cap.
- **Contrast**, measured over a busy stage (the equation mesh, prose and two figures) with every visible text run sampled against the composited glass (`experiments/glass-audit/surf.mjs` + `surfcontrast.py`): lowest text 5.69 (light subtitle) and 6.60 (dark type label); titles 14.1 / 13.4. If translucency ever breaks 4.5, raise the fill opacity or the blur; do not lighten the text.
- **Skipped on purpose.** No SVG `feDisplacementMap` refraction: it works only in Chromium and costs a filter pass per frame over a scrolling list.

### b3) Page links with a rising tab (landing)

The landing's three page links (Interests, Work, CV). Markup and CSS are in `src/pages/index.astro`, behaviour in `src/scripts/dock.ts`. The owner rejected a recessed track with the nav's glass lens (too much like the nav, too capsule-like); this keeps the old underlined links and gives them their own, lighter material.

- **Rest, touch, no JS.** The plain underlined links (`.link`) with the `arrow-right` micro-icon in `--text-3`. This is the whole design on touch and without JavaScript.
- **Tab.** With a mouse or keyboard focus, the hovered item's underline rises into a tab: it starts as exactly that 1px `--ul-rest` rule (measured from the text's box: baseline + the 3px underline offset) and grows to the item on `--spring-bounce` (a small overshoot). The open tab is clear, neutral gloss, no cobalt (the owner wants it uncoloured): a translucent white body (`#ffffff8c`; dark `#ffffff0f`), a sheen over its top half (`::before`, white .9 to .2; dark .09 to 0), a bright 1px top edge, a hairline and a soft drop, `blur(8px) saturate(1.6)`, so the equation mesh still shows through. Corners are 8px, never a capsule. The item's own underline goes transparent while the tab is on it, and the arrow darkens to `--text` and plays its story.
- **Between items** the tab slides (translate on the bounce spring, width on `--spring-snappy`), like the nav pill.
- **Leaving.** After 150ms (120ms for focus) the tab sinks back into the underline it is on: the rise played back, slower (480ms, `--ease-in-out`, no overshoot). It keeps its gloss and outline until it is nearly a line, turns underline grey as it lands, then fades as the real underline returns.
- **Items** are 36px tall with 10px side padding; the dock's negative margin keeps the first label on the lede's left edge.
- **Press.** The item and the tab scale to .97 together.

### c) Logo grayscale to color on hover (affiliations: Fulbright, Koç, Tüpraş…)

```css
.logo{
  --g:1;--b:1;--i:0;--o:.55;
  filter:grayscale(var(--g)) brightness(var(--b)) invert(var(--i)) opacity(var(--o));
  transition:filter 240ms var(--ease-out),scale var(--dur-quick) var(--spring-quick);
  height:24px;width:auto;
}
@media (hover:hover){ a:hover>.logo,.logo:hover{--g:0;--o:1;scale:1.03} }
/* dark: flatten every logo to a white silhouette; color only if the logo is flagged safe */
[data-theme="dark"] .logo{--b:0;--i:1;--o:.5}
@media (hover:hover){
  [data-theme="dark"] a:hover>.logo{--o:.95}
  [data-theme="dark"] a:hover>.logo[data-color-safe]{--b:1;--i:0;--g:0;--o:1}
}
```

Keep the function list identical in every state so `filter` interpolates.

### d) Icon bounce (link icons and toggles)

```css
.icon{display:inline-block;transition:translate var(--dur-bounce) var(--spring-bounce),
  scale var(--dur-bounce) var(--spring-bounce)}
@media (hover:hover){ a:hover .icon,button:hover .icon{translate:0 -2px;scale:1.08} }
a:active .icon,button:active .icon{scale:.92;transition-duration:var(--dur-quick);transition-timing-function:var(--spring-quick)}
.icon--nudge-x{} @media (hover:hover){ a:hover .icon--nudge-x{translate:2px 0;scale:1} }   /* arrows */
.icon--nudge-ne{} @media (hover:hover){ a:hover .icon--nudge-ne{translate:1.5px -1.5px;scale:1} } /* external */
```

### e) Gallery (justified grid, after Atlas's Grid view)

`/gallery` shows every figure once (`src/data/gallery.ts`), edge to edge inside the page gutter at every width. Layout: `src/scripts/gallery-core.js`; interaction: `src/scripts/gallery.ts`.

- **Rows: optimal linear partition.** The figures keep a fixed sequence; a Knuth–Plass-style DP chooses where rows break. A row of tiles `i..j` gets the art height `h = (W − (k−1)·gap − k·2·px) / Σ rᵢ` (rᵢ = viewBox width/height), so it fills the width exactly and every drawing keeps its exact aspect ratio. The DP minimises `Σ ln(h/T)²`. Constraints: no tile narrower than `0.7·T` when it shares a row (so phones get one per row); a lone drawing taller than the window minus 200px is capped and centred; the last row may stay ragged at `T` only when it holds two or more tiles and would otherwise grow past `1.4·T` (cost `1.2·(1−fill)²`).
- **Target row height.** `T = zoom × clamp(200px, 0.11·vw + 140px, 460px)`: one per row on phones, mostly 2–3 per row at 1280–1920, 3–4 at 2560.
- **Spacing scales with density** (`metrics(T)`): gap `clamp(4, T/24, 16)`. From `T ≥ 170` the tile is the figure frame unframed: art on its own light tile (`--surface`, the cobalt dot grid, `--shadow-hair`, radius 14, padding 34/12/12 so the `FIG_` tag and the open/close toggle clear the art), with a two-line caption under it (12px mono, `--text-2`, fixed 36px, so every tile in a row ends together and the layout needs no text measurement; Quick Look shows the whole caption). Below 170 the tiles go Atlas-small: padding `T/28`, radius `T/18`, no tag, toggle or caption (captions stay for screen readers).
- **Order** is chosen for packing: a seeded local search over the partition cost summed across 13 widths (768–3440), with the flowsheet pinned first and a small bonus for keeping themes together (`.work/gallery/order2.mjs`). FIG numbers follow the gallery order (`FIG_001…`), as every page numbers its own figures. A reader's own order (drag) is kept in `localStorage['gallery-order']` and renumbers the tags; "Reset order" in the dock clears it.
- **No jump.** Without JS the grid is `flex-wrap` with `flex: r 1 calc(r·--row-h + 2·px)`, which justifies every line at exact aspect ratios. With JS, the core is inlined right after the grid and lays it out (absolute boxes) before the first paint: CLS 0, also under a 4× CPU throttle.
- **Zoom is density.** Range: `T = 56px` (everything at once) to one drawing per row at full width. Pinch (ctrl-wheel; Safari's gesture events; two touch pointers), ⌘± / + / − / ⌘0, or the dock slider. Pinch and ⌘± belong to the gallery only while the grid is on screen; elsewhere they stay the browser's. Zoom is anchored: the drawing under the pointer (or the focused one, or the one mid-screen) keeps its point on screen, so rows re-pack around it. A flick glides (velocity × e^(−7t)); past a limit it stretches (`c·(1 − 1/(1 + x/c))`, c = .22 in log-zoom) and springs back (k 260, critical).
- **Reflow.** Every layout change (zoom, resize, reorder) moves each tile from where it *is* to where it belongs on one spring per tile (k = (2π/.36)², c = 4π·.9/.36: period .36 s, damping .9, faster and crisper than `--spring-snappy`), interruptible, keeping velocity. Transform only (`translate + scale`, origin top-left, `will-change` only while moving), so the art moves as a layer and settles crisp.
- **Selection.** Click selects, ⌘-click toggles, ⇧-click extends; dragging on blank canvas draws a marquee (accent at 13%, 1px accent border, radius 4) that selects live. The ring is 2px accent, 3px outside the tile, radius `r + 5` (1.5px, 2px out when compact). Esc clears; ⌘A selects all.
- **Reorder.** Drag a tile (or the selection) by more than 4px (touch: hold 380ms). The group lifts into a small deck (×1.03, `--shadow-float`, followers a step smaller and 10px behind, a count badge) that follows the pointer on a stiff critically damped spring; the rest re-pack live around the insertion point (before/after the tile under the pointer, outside its middle 20%, at most every 90ms); the page auto-scrolls near the edges. ⌥←/→ moves by keyboard.
- **Double-click is Space.** It opens the drawing in Quick Look, and a double-click inside closes it, as Space does. Click and dblclick target the grid while the pointer is captured, so the tile is found by hit-testing its visual box.
- **Quick Look.** Space or a double-click (tile under the pointer, else focused, else selected), Enter or a tap. The figure itself moves into a `<dialog>` and grows out of its tile (shared-element FLIP, 460ms `--spring-snappy`) over a 90% `--bg` scrim with a 14px blur; ←/→ step through, Space/Esc/click outside close it back into the tile (420ms `--spring-quick`, exact at both ends: the figure switches to its tile's layout and starts under a transform that makes it look as large as it was, with the unscaled spacing (registered `--g-px/pt/pb/radius`, tag, toggle) starting at the large view's values over that scale; everything runs to the tile's own values, so the last frame is the tile and the hand-back is invisible), focus returns to the tile.
- **Keyboard and screen readers.** One tab stop (roving): ←/→ in reading order, ↑/↓ to the nearest tile in the next row, Home/End. DOM order follows the visual order. Tiles are list items; each has a hit button named by the figure's short title; selection, lifts and drops are announced in a polite live region.
- **Performance.** While anything moves, tiles move by transform only, relative to the box last written to the DOM; the real boxes are written (`commit`) when a tile drifts 15% from its real size, or 3% with 160ms since the last write during a zoom, when the thumbnail mode flips, and once when everything settles. That is a handful of SVG re-renders per pinch instead of one per frame. The grid's page position is cached (no layout reads mid-frame), `apply()` writes only values that changed (the spacing vars and `--art-h` inherit through every node of the drawings), and the drawings' ambient loops pause while tiles move (`.is-moving`) and in the thumbnail wall. A live window resize re-packs every frame with no spring (tiles snap to the new rows by transform) and writes the real boxes once the resize has rested 160ms; `.g-page` clips horizontally, so nothing in the grid can ever add a sideways scrollbar.

---

## 6. Illustration grammar (makingsoftware, redrawn for PSE and ML)

Every figure is an **inline SVG Astro component**, one per figure in `src/components/figures/`. No raster images and no canvas.

**Subjects:**
- distillation column (exploded trays)
- shell-and-tube heat exchanger (section)
- jacketed CSTR with impeller
- McCabe–Thiele stair-step (pixel grid)
- MPC receding horizon
- neural net / attention
- MILP branch-and-bound tree

**Canvas**
- `viewBox` widths: 960 for hero figures (`--wide`), 360 for margin figures. Author so that 1 unit equals 1 CSS px on desktop.
- `fill="none"` on the root.
- `shape-rendering="geometricPrecision"` for line art; `crispEdges` on pixel groups.
- **Grid unit: 10 units.** All part dimensions, gaps, label baselines and pixel cells snap to multiples of 10 (5 allowed for small parts).

**Strokes**
- 1 unit is the default for every edge, with butt caps and miter joins.
- 2 units only for the single hero line, for example the operating line or the flow path.
- 3 units for springs and shafts.
- All strokes carry `vector-effect="non-scaling-stroke"` so hairlines stay 1 CSS px when the figure scales down on phones. This is a deliberate deviation from makingsoftware, which is desktop-first.

**Construction order per part**
1. Fill paths, with no stroke.
2. Optional hatch or dither overlay, same geometry.
3. **One** stroke path holding every visible edge as `M…L…` subpaths.
4. Hidden edges: the same ink, `stroke-dasharray="4 4"`.
5. Assembly guides: `"24 6"`.

**Palette:** themed via classes, never hard-coded hex.

```css
:root{--fig-ink:#1342FF;--fig-lit:#FFFFFF;--fig-50:#F4F5F9;--fig-100:#E6EBFF;--fig-200:#B9C7FD;
  --fig-300:#97ACFF;--fig-400:#607FFD;--fig-dot:rgb(19 66 255/.15);--fig-bg:var(--bg)}
[data-theme="dark"]{--fig-ink:#8FA3FF;--fig-lit:#1B1F2B;--fig-50:#161924;--fig-100:#1C2236;
  --fig-200:#25305A;--fig-300:#34479A;--fig-400:#5872F0;--fig-dot:rgb(143 163 255/.14)}
.fig .s{stroke:var(--fig-ink)} .fig .i{fill:var(--fig-ink)}
.fig .fl{fill:var(--fig-lit)} .fig .f0{fill:var(--fig-50)} .fig .f1{fill:var(--fig-100)}
.fig .f2{fill:var(--fig-200)} .fig .f3{fill:var(--fig-300)} .fig .g{stroke:var(--fig-400)}
```

| Role | Class | Use |
|---|---|---|
| Lit | `fl` | lit top faces, paper |
| Body | `f0` | body faces |
| Secondary | `f1` | inner walls |
| Shadow | `f2` | shadowed sides, liquid, cut surfaces |
| Subject | `f3` | the subject: packing, catalyst bed, active neuron |
| Ink | `s` / `i` | edges, labels, arrowheads, solid pixels |

Never introduce a second hue. Show state changes with a tint step or a dither.

**Projection**
- Equipment uses true isometric: `iso(x,y,z) = [(x−y)·0.8660, (x+y)·0.5 − z]`, so edges run at ±30°.
- Horizontal circles become ellipses with `ry/rx = 0.577`.
- A cylinder is drawn as the top ellipse, two tangent verticals, and the front half of the bottom ellipse; the back half is dashed `4 4`.
- Mechanism views (tray hydraulics, exchanger section, McCabe–Thiele, networks, MPC) are orthographic.
- Exploded views separate internals along z by 40–120 units, with `24 6` guides between them.

**Pixel and dither technique.** This is the "pixelated yet sharp" look; there are no noise filters.
1. **Grid-snapped rects.** Pixel graphics (the McCabe–Thiele staircase, input images to the net, tray liquid levels) are `<rect>`s on the 10-unit grid in `f2`/`f3`/`i`. A 10-unit `g` grid pattern at 0.4 opacity sits under them.
2. **Ordered dither instead of gradients.** Shading on cylinders and liquid depth uses three 4-unit Bayer patterns in `--fig-ink`:
   ```svg
   <pattern id="d25" width="4" height="4" patternUnits="userSpaceOnUse"><rect class="i" width="2" height="2"/></pattern>
   <pattern id="d50" width="4" height="4" patternUnits="userSpaceOnUse"><rect class="i" width="2" height="2"/><rect class="i" x="2" y="2" width="2" height="2"/></pattern>
   <pattern id="d75" width="4" height="4" patternUnits="userSpaceOnUse"><rect class="i" width="4" height="2"/><rect class="i" x="2" y="2" width="2" height="2"/></pattern>
   ```
   Apply each as a second fill at `fill-opacity:.35` over the face tint, stepping d25, then d50, then d75 across the shadow side in bands 10–20 units wide.
3. **Hatch on cut surfaces** (shell walls, tube sheets, flanges): a 10×10 tile with one 45° line, `f2` base, hatch at 0.5 opacity. Use a 5×5 tile for parts under 30 units.
4. **Ornaments:** section dividers built from tiled `░` in `--font-pixel` at 14px in `--text-3`. Reading progress on long pages is `██████▒░░░` text in accent.

Pattern ids are namespaced per figure (`fig03-d50`) to avoid id collisions on the page.

**Labels**
- Departure Mono, 11 units, uppercase, `class="i"`, placed in left and right gutter columns and left-aligned.
- Leaders are 1-unit horizontal or vertical lines starting 8 units from the text, ending in a filled triangle `M0 0h6l-3 5z` (rotate as needed) touching the part.
- No crossings and no diagonal leaders.
- Vocabulary: REFLUX DRUM, SIEVE TRAY, DOWNCOMER, REBOILER, FEED; SHELL, TUBE BUNDLE, BAFFLE, TUBE SHEET; IMPELLER, COOLING JACKET; INPUT, WEIGHTS, RELU, SOFTMAX; HORIZON N, u(k).
- Labels stay live `<text>` so they can be read and translated.
- The figure gets `role="img"` and a `<title>` and `<desc>`.

**Frame**
- `<figure class="fig">` has `background:url(/texture.svg)` (a 3×3 tile with one dot in `--fig-dot`, inlined as a CSS mask so it themes). It also gets 2px texture strips on all four edges.
- Three rotated captions in Departure Mono, 10px, `--text-2`, each with a `--fig-bg` knockout: `FIG_003` top-left, `[ SIEVE TRAY COLUMN ]` top-right, `© 2026` bottom-right.

**Animation.** CSS, not SMIL.
- **Assembly, once.** When an `IntersectionObserver` fires (threshold 0.35), it adds `.is-in`. Each `[data-part]` then goes from `translate:0 calc(var(--lift,-60)*1px)` and `opacity:0` to rest over `--dur-soft` with `--spring-soft`. Stagger: `transition-delay:calc(var(--i)*120ms)`, with a maximum of 6 parts. Guide lines draw in over the same time via `pathLength="1"` and `stroke-dashoffset:1` to 0.
- **At most one ambient loop per figure**, only while it is in view (`animation-play-state` toggled by the observer):
  - flow: `stroke-dasharray:4 4`, `stroke-dashoffset` 16 to 0, 1.2s linear
  - vapour/liquid counterflow: two paths, one reversed
  - impeller: `rotate` 360deg, 3s linear, `transform-box:fill-box; transform-origin:center`
  - a signal through the net: dashes on the hero path
- There is no flicker. Loops stop after 20s of no scroll activity.

---

## 7. Equation-mesh background (victor-alves, re-themed)

Landing page only; subpages have none. It is a single `<canvas>` in `<div class="mesh" aria-hidden="true">` with `position:fixed; inset:0; z-index:-1; pointer-events:none`. The background color lives on `html`, and `body` is transparent. The mesh is loaded with `requestIdleCallback` after first paint and uses Canvas 2D with no library.

**Typesetting (real LaTeX, not a code font)**
- All math is TeX, typeset at build time by MathJax (`mathjax-full`, devDependency only) in Computer Modern. Sources live in `src/data/equations.ts`; `src/lib/tex.ts` converts them.
- Variables are italic, operators and digits upright. Fractions, sub- and superscripts, `\sum` with limits and sized delimiters are all typeset by TeX. Equations use display style.
- The page receives one inline `<script type="application/json" data-mesh-tex>` (about 43 KB raw, 16 KB gzipped, open forms included). Every glyph outline is stored once as a relative path on a 0.005 em grid, and each formula is its viewBox plus flat glyph placements and rules.
- In the browser, `src/scripts/mesh.ts` turns the outlines into `Path2D` and fills each node into its own offscreen sprite. No math JS, no web font and no image decode are needed.
- To add an equation, add its TeX to `equations.ts`. The build fails on any TeX error.

**Nodes**
- **Glyphs**: count = `round(clamp(W·H/26000, 18, 56))`.
  - Symbols (TeX): `\partial \nabla \Sigma \int \Delta \rho \mu \lambda \theta \eta \alpha \gamma \varepsilon \rightleftharpoons \approx \infty \dot m`
  - Em size `16.5·U(.8,1.4)`px, alpha 0.34.
- **Equations**: count `clamp(round(glyphs/6), 7, pool)`, no repeats. Em size `U(14, 15.5)`px, alpha 0.32.
  - Alphas sit a little above the old Geist Mono values (.30/.26) because Computer Modern's strokes are finer.
- The order is set per visit. Each group is shuffled, and a slot with alternatives picks one of them:
  1. **Key** (owner's picks, always shown; 7 = `eqMin`, so they appear at every desktop size):
     - `S = k_B\ln\Omega`, or `\Delta S = k_B\ln\frac{\Omega_2}{\Omega_1}`
     - `\Delta G = \Delta H - T\,\Delta S`
     - min over x of f(x), s.t. g(x) ≤ 0, h(x) = 0 (two lines)
     - `\theta_{k+1} = \theta_k - \eta\,\nabla_\theta L(\theta_k)`
     - the Cauchy momentum balance `\rho\,\frac{D\mathbf u}{Dt} = \nabla\cdot\boldsymbol\sigma + \mathbf f`
     - van 't Hoff `\frac{d\ln K}{dT} = \frac{\Delta H^\circ}{RT^2}`
     - Fourier's law `\mathbf q = -k\,\nabla T`
  2. **Featured**: Bernoulli. Key + featured = 8, which is exactly the count at 1440×900.
  3. **Pool**:
     - the expanded Navier–Stokes and continuity equations
     - Arrhenius, KKT stationarity, `dS \ge \delta Q/T`, `\Delta G^\circ = -RT\ln K`, the MILP
     - the mass balance, relative volatility, Antoine, modified Raoult, `Q = UA\,\Delta T_{\text{lm}}` and advection–diffusion–reaction
     - MPC tracking cost, attention.
- The page's dark-theme opacity factor is 0.88, not 0.8. On a dark ground the hairlines thin out more than a sans does.

**Physics**
- Velocity `U(−.25,.25)` px per frame, clamped to 0.7.
- Wrap around edges with a 40px margin.
- Glyphs are pushed around equation boxes, so they never print over the math.
- Click ripples are omitted as too loud.

**Links (one network)**
- **Glyph ↔ glyph**: link when d < 140px (center to center). Alpha is `.12·(1−d/140)·min(fade)`, the line is 1px, and it is trimmed at each glyph's radius.
- **Equations** are first-class nodes and link to glyphs and to other equations.
  - Distance is measured from the edge of the equation's *attach box*: its ink box grown by 6px. Reach is 196px (1.4×), with the same linear alpha falloff.
  - Each equation keeps at most its **3 nearest** neighbours.
  - A kept link fades out over 24px as the 4th candidate closes in, so links hand over instead of popping.
  - An equation–equation link is drawn only when both ends keep it.
- **Attach point**: where the center-to-center segment leaves the attach box. Lines never run into the typeset glyphs. A 1.25px ink dot ("port") marks the attach point, at the line's alpha.
- **Cursor lines** go to glyphs within 160px at alpha `.35·(1−d/160)`. They also go to equations within 160px of their box edge, attached and dotted the same way.
- **Blocking**: an edge is dropped if any part of it crosses a padded text-mask rect, or crosses an equation box other than its own endpoints. The whole segment is tested (Liang–Barsky), which covers the old midpoint rule.

**Expandable equations (closed form ⇄ open form)**
- An entry in `equations.ts` can be `{ tex, open }`. The open form is a genuine expansion or generalisation of the closed one, never a different law. It is typeset at build time with everything else, and the payload's `o` lists the closed/open item pairs. Pairs:

  | Closed | Open | Relation |
  |---|---|---|
  | `S = k_B\ln\Omega` | `S = -k_B\sum_i p_i\ln p_i` | Gibbs entropy; `p_i = 1/\Omega` gives back the closed form |
  | `\Delta S = k_B\ln\frac{\Omega_2}{\Omega_1}` | `\Delta S = S_2 - S_1 = k_B\ln\Omega_2 - k_B\ln\Omega_1` | difference of two Boltzmann entropies |
  | `\Delta G = \Delta H - T\,\Delta S` | `dG = dH - T\,dS - S\,dT` / `= V\,dp - S\,dT` (aligned) | differential of `G = H - TS`; the closed form is its isothermal case. Chosen over `\Delta G^\circ + RT\ln Q`, which adds composition but not the T-dependence |
  | min f(x) s.t. g ≤ 0, h = 0 | `\nabla f(x^*) + \sum_i\lambda_i\nabla g_i(x^*) + \sum_j\mu_j\nabla h_j(x^*) = 0` / `\lambda_i \ge 0,\ \lambda_i g_i(x^*) = 0,\ g(x^*) \le 0,\ h(x^*) = 0` | KKT conditions |
  | `\theta_{k+1} = \theta_k - \eta\,\nabla_\theta L(\theta_k)` | `\theta_{k+1,j} = \theta_{k,j} - \frac{\eta}{n}\sum_{i=1}^n \frac{\partial\,\ell(\theta_k;\,x_i)}{\partial\theta_j}` | componentwise, with `L = \frac1n\sum_i \ell` |
  | `\rho\,\frac{D\mathbf u}{Dt} = \nabla\cdot\boldsymbol\sigma + \mathbf f` | `\rho\big(\frac{\partial\mathbf u}{\partial t} + (\mathbf u\cdot\nabla)\mathbf u\big) = -\nabla p + \mu\nabla^2\mathbf u + \mathbf f` | Navier–Stokes (Newtonian, constant ρ and μ) |
  | `\frac{d\ln K}{dT} = \frac{\Delta H^\circ}{RT^2}` | `\ln\frac{K_2}{K_1} = -\frac{\Delta H^\circ}{R}\big(\frac1{T_2} - \frac1{T_1}\big)` | integrated, ΔH° constant |
  | `\mathbf q = -k\,\nabla T` | `q_x = -k\,\frac{\partial T}{\partial x}`, same for y and z (stacked) | components |
  | `P + \tfrac12\rho v^2 + \rho g h = \text{const}` | `P_1 + \tfrac12\rho v_1^2 + \rho g h_1 = P_2 + \tfrac12\rho v_2^2 + \rho g h_2` | two points on one streamline |
  | continuity `\frac{\partial\rho}{\partial t} + \nabla\cdot(\rho\mathbf u) = 0` (pool) | the Cartesian divergence written out | components |
  | attention `\operatorname{softmax}(QK^\top/\sqrt d)V` (pool) | `\mathbf o_i = \sum_j \frac{\exp(\mathbf q_i^\top\mathbf k_j/\sqrt d)}{\sum_l \exp(\mathbf q_i^\top\mathbf k_l/\sqrt d)}\,\mathbf v_j` | row i |
- **Cue**: none drawn. The owner removed the dotted underline; an expandable equation is found by the hover lift (the halo fade lifts and the ink darkens) and opens on dwell or tap.
- **Hover (fine pointer)**: the canvas stays `pointer-events:none`, and the mesh's own document-level `pointermove` drives this.
  - When the pointer enters an expandable equation's attach box, that equation holds still, its halo fade lifts, and its ink gains +0.2 alpha (eased, about 0.18 per frame).
  - This does not happen over the padded text mask or over a link, button or other control (`closest('a, button, input, …')`).
  - After **220ms** of dwell, the equation opens.
  - It stays open while the pointer is within its box + 12px. **600ms** after the pointer leaves, it closes.
  - Only one equation is open at a time. Dwelling on another opens it and closes the first.
- **Touch and pen**: a passive document `pointerdown` is used, with no `preventDefault`, and taps on text and controls are ignored.
  - A tap on an equation (box + 10px) toggles it. A tap elsewhere closes the open one.
  - There is no linger timer for taps.
- **Placement**: the open form settles where its whole attach box is on screen (10px margin) and clear of the padded text mask.
  - If it fits, it opens in place. If not, the nearest free spot is found on rings out to 420px, and it glides there as it opens.
  - If no spot is found, it does not open.
  - It closes in place. If the text later moves under it (resize, fonts), it closes.
  - The open form keeps the closed form's em size, and shrinks only if it is wider than the viewport.
- **Morph**: a spring with stiffness 170 and damping 20 (ζ ≈ 0.77; about 450ms to settle with a slight overshoot) drives progress p. The box is interpolated closed → open by p, which has these effects:
  - links re-attach to the growing edge every frame;
  - the attach box, collisions and blocking all use it;
  - neighbours are pushed aside with a stronger push (0.22 instead of 0.05, speed cap 2.4) and fade to 0.1 while the open box covers them.
  - The closed sprite fades out over p 0 to 0.55 while scaling 1 → 1.08. The open sprite fades in over p 0.25 to 1 while scaling 0.9 → 1, and carries the spring's overshoot.
  - The open equation is drawn last, above the glyphs.
- Both sprites are pre-rendered per node, theme and DPR, so a frame mid-morph is two `drawImage` calls for that node. A debug probe (`window.__mesh`: equation boxes, frame cost, open and close) exists only with `?meshdebug`.

**Text mask (required)**
- Collect rects for `h1, p, nav, header a, button, .links, .meta, [data-mesh-mask]`, padded by 16px. Recompute on resize, on load, and when fonts finish loading (`document.fonts.ready`).
- A node inside a mask rect:
  - velocity ×0.9
  - a push of 0.07 toward the nearest edge
  - fade eases toward 0.08
- Outside, fade eases back toward its rest value. Nodes within 56px of the text rest at 0.4, rising to 1 further out.

**Theming and performance**
- Ink is `rgb(var(--mesh-ink) / a)`. It is read once and re-read through a `MutationObserver` on `data-theme` and on `themechange`, which re-fills the sprites.
- DPR is capped at 2.
- Each node's sprite is rendered once per theme and DPR. A frame is one `drawImage` per node plus batched line and dot paths, bucketed by alpha.
- Pause on `visibilitychange`.
- On `(pointer:coarse)`, halve the counts and drop cursor lines.
- While the loop is paused (off-screen, hidden tab), draw one static frame.
- Budget: under 1.5ms per frame at 1440×900. Measured at about 0.2ms median (p95 0.3ms) headless at DPR 2, with an equation opening and closing during the sample.

---

## 8. Micro-icons (nan.fyi rules)

**Grammar**
- `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.5"`, round caps and joins.
- Coordinates on the .25/.75 grid, with a 4.75 inset from the edge.
- **Pixel grid.** Axis-aligned strokes (box edges, tray bottoms, text lines) sit on the odd multiples of .75: 3.75, 5.25, 6.75 … 17.25, 18.75, 20.25. At 16px those land on half pixels at 1x and whole device pixels at 2x, and at 24px@2x on half device pixels, so the 1.5 stroke stays crisp everywhere the set is used. A vertical on the centre line (12) is crisp at 2x only. Curves and diagonals are free.
- Optical size: glyphs are centred on (12, 12) at rest (a detail that pops in may sit off to one side; the base glyph does not). Filled brand glyphs run edge to edge of their box, so next to micro-icons they render at 12px where the micro-icon is 16px.
- Render at 16, 20 or 24px only. Status marks at 16px may use a 2–2.5 stroke.
- One weight across the whole site; never mix in filled icons.
- Brand icons (GitHub, Scholar) are the exception: filled `currentColor`, same box.
- Decorative icons get `aria-hidden="true"`; icon-only buttons get a visually hidden label.

**Motion stories** (CSS only, triggered on hover or a state change, never ambient):
- **Detail paths stay in the DOM** at `opacity:0; translate:0 3px`. On parent hover they settle with `--spring-bounce`, staggered with `transition-delay: 0, 50ms, 100ms`, so there is no layout shift.
  - flask: bubbles rise
  - coffee or reboiler: steam
  - theme toggle: sun rays appear one after another, and the moon rotates -20°
  - sparkle: two stars pop from `scale:.5`
- **Draw-in:** check, cross and "copied" marks use `pathLength="1"` with `stroke-dasharray:1; stroke-dashoffset:1` going to 0 over 400ms `--ease-out`. A two-stroke X uses 200ms per stroke, the second delayed 200ms.
- **Nudges:**
  - arrow-right `translate:2px 0`
  - external arrow `1.5px -1.5px`
  - gear `rotate:45deg` with `--spring-snappy`
  - download arrow `translate:0 2px`
- **Press:** `scale:.92` with `--spring-quick`.
- **Feedback:** inline, with no toasts. A confirmation line tucks under its control (`margin-top:-8px; padding-top:16px`), and the button label switches to past tense ("Copied").
  - **The one deliberate exception: Download CV.** It confirms with a small toast (`src/scripts/toast.ts`), because the button appears in several places (CV header, command palette) and the download itself happens outside the page, so there is no stable inline spot for the line. Nothing else uses the toast.

**The set** (`src/components/MicroIcon.astro`, props `name`, `size` 16|20|24, optional `label`; paths in `src/lib/micro-icons.ts`, motion in `src/styles/micro.css`). Paths are drawn by hand: shafts bow a little and barbs don't quite mirror, so they read as drawn rather than stock.

*Trigger.* Each icon plays when its nearest interactive ancestor (`a`, `button`, `[data-micro-trigger]`) is hovered (fine pointers only) or keyboard-focused, or when it sits in a selected `[role=option]` (the palette). It works through one inherited custom property: every interactive element sets `--micro:0`, and `--micro:1` while it is active, and each moving part computes its pose from it, so one rule covers rest and active and the transition runs both ways. One-shots (poke, squash, page turn, swing, flip, spin, flash) are keyframes on the same triggers. `.micro--reveal` hides the whole glyph until its trigger is active, and `.micro--inline` sits it in running text.

| Icon | Motion story | Used on |
|---|---|---|
| `arrow-right` | The shaft draws 3 units longer (dash offset, `--spring-quick`, 300ms: a dash never overshoots, or it wraps and flashes a gap) while the head nudges 3 units to meet it (`--spring-bounce`) | Landing page links (Interests, Work, CV); internal prose links on /interests ("work page"); internal-link rows on /work; the palette, where it slides in on a selected on-site row |
| `arrow-up-right` | Nudges 2 units ↗; a short trailing dash fades in behind the tail, sliding back as it appears | `ExtLink` (footer profiles on hover only, App Store link); outbound prose links on /interests; external rows on /work; the palette's trailing indicator on every external row |
| `mail` | The flap folds up over the top edge (scaleY 1 to −0.6, `--spring-snappy`, 380ms), then two letter lines rise in, staggered | Footer "Email" (hover only); CV header; palette "Email me" |
| `hand` (manicule ☞) | Pokes twice toward its target (keyframes, 450ms) | /interests closing line, pointing at the email address |
| `book` | One page lifts off the right leaf, turns over the spine and lands left (scaleX 1 to −1, 450ms, once) | Publication venue lines on /work and /cv; palette: Publications, each paper, "Read the paper" |
| `trophy` | The cup lifts 1 unit; two small sparkles pop from half size (staggered 70ms) | MINERVA's "1st prize" badge on /work; palette: Honors & awards and each honor |
| `sparkle` | Centred at rest; the star steps aside (−1.25, .75) and turns 12° while two small stars pop in from half size | Palette: Interests, Currently, Machine learning, and any interest section without its own icon |
| `flask` | Three bubbles rise into place through a wavy surface, 60ms apart | Palette: Research experience and each research entry; the PSE interest |
| `download` | The arrow drops 2 units into the tray; the tray gives (squash and rebound, 380ms, once) | Palette "Download CV". The Download CV button has its own flip confirmation. |
| `copy` | The two sheets slide apart; with `.is-done` on an ancestor a check draws on the front sheet (400ms `--ease-out`) | Palette "Copy email": the check draws and the label reads "Copied" |
| `code` | The brackets spread 1.25 units each; the slash stays | Palette: View source, Skills, the software interest |
| `home` | The front door swings open on its left hinge (the leaf narrows to 38%), and shut again | Palette: Home |
| `doc` | The half-written last line writes itself out to the margin (dash, `--spring-quick`) | Palette: CV |
| `layers` | The stack fans apart: top sheet −1.5, middle −.5, bottom +.5, 30ms apart | Palette: Work, Research & projects, each project |
| `cap` | The mortarboard lifts 1.25 and tips −8°, as if tossed; the tassel swings behind it (16°, 50ms late) | Palette: Education and each degree |
| `briefcase` | Picked up by the handle: one swing −7°, back 4.5°, settle (keyframes, 520ms, once) | Palette: Experience and each job |
| `mic` | A sound wave ripples out on each side (from 1.5 units in, 60ms apart) | Palette: Talks and each talk |
| `board` | A line of chalk writes itself across the board (dash, 420ms `--ease-out`) | Palette: Teaching & service and each role |
| `calendar` | The rings lift .75 and a day is checked off (dash, 90ms late) | Palette: Activities and each activity |
| `chat` | Three typing dots pop in one after another (70ms apart) | Palette: Languages |
| `badge` | The medal turns edge-on and back once, catching the light (scaleX, 460ms) | Palette: Certificates, each certificate and "View certificate" |
| `theme` | Shows the current theme at rest and morphs to the target: in light the rays pull in (staggered), the core shrinks and a moon turns in from 60°; in dark the moon turns away and the rays come out one after another. Reads `html[data-theme]`, no JS | Palette "Switch to dark/light theme" (the header toggle keeps its own drawing) |
| `sliders` | The two fader knobs slide 4.5 units past each other | Palette: Optimization under uncertainty |
| `bolt` | Flashes once (scale 1.14, dip, settle, 360ms) and two sparks fly off the tip | Palette: Energy |
| `globe` | The meridian slides off one side and comes back from the other, as if the globe spun once (520ms) | Palette: Generalist |
| `phone` | A notification drops 2 units into the top of the screen | Palette: Apps and each iOS app |
| `window` | A pane snaps into the left half (scaleX from .4, `--spring-bounce`), SnapLayouts' own trick | Palette: each macOS app |
| `compass` | The drafting compass opens its legs ±7° and the arc between them draws | Palette: Figures (the /interests#figures gallery) |

**In the palette** (`CommandPalette.astro`, `scripts/palette.ts`). Every row leads with a micro-icon at 16px in a 24px tile; social rows use their brand glyph at 12px instead. At rest the glyph is `--g-icon` on a glass tile; on the selected row it turns `--g-text` and the tile's hairline darkens (§5 b2). Brand glyphs are the only colour: Scholar and LinkedIn take their brand blue when selected (light theme), and they pop to 1.1 with `--spring-bounce`. Rows map by meaning, and individual entries inherit their section's icon (a degree gets `cap`, a talk `mic`, a certificate link `badge`, a DOI link `book`). On the selected row a `→` slides in for on-site links; external rows keep the `↗` and nudge it. What `↵` does is shown in the action bar (§5 b2).

The story plays once each time a row becomes selected, by arrow keys or by the mouse. It is re-armed when the selection leaves: sticky stories transition back, one-shots lose their animation, so moving quickly never leaves a pose half-way. When the list re-renders (typing, Copy, a theme switch) and the same row stays selected, `palette.ts` marks it `.is-settled`: it keeps its selected pose without replaying. A new top row, or a fresh open, commits its resting style before it is selected, so its story plays from rest.

**External links.** `src/components/ExtLink.astro` handles external links automatically. For an http(s) href it sets `target="_blank"`, `rel="noopener"`, appends the ↗ (aria-hidden) and a visually hidden "(opens in a new tab)". `arrow="hover"` shows the ↗ only while the link is active, in the gap after it. Prose authored as `[label](href)` in `data/interests.ts` gets the same treatment from `inlineLinks()`, with → for on-site links. The last word and its icon never wrap apart. `/lab/micro` (not linked, noindex) shows every icon at 16, 20 and 24px for review.
