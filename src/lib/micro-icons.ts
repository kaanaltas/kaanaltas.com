// Micro-icons (docs/design-system.md §8). One source of truth for the
// markup, so the same glyph can be rendered by MicroIcon.astro, by string
// helpers that build HTML (inline prose links in data/interests.ts) and by
// the command palette's client-side renderer.
//
// Grammar: 24×24 viewBox, fill none, stroke currentColor 1.5, round caps and
// joins, drawn by hand (slightly bowed shafts, barbs that don't quite
// mirror) rather than copied from a stock set. Motion lives in
// src/styles/micro.css: every part that moves carries an `m-*` class, and
// detail paths stay in the DOM at rest (opacity 0), so nothing shifts.

export type MicroName =
  | 'arrow-right'
  | 'arrow-up-right'
  | 'download'
  | 'mail'
  | 'copy'
  | 'sparkle'
  | 'flask'
  | 'hand'
  | 'book'
  | 'code'
  | 'trophy'
  | 'home'
  | 'doc'
  | 'layers'
  | 'cap'
  | 'briefcase'
  | 'mic'
  | 'board'
  | 'calendar'
  | 'chat'
  | 'badge'
  | 'theme'
  | 'sliders'
  | 'bolt'
  | 'globe'
  | 'phone'
  | 'window'
  | 'compass';

export type MicroSize = 16 | 20 | 24;

// Pixel grid. Axis-aligned strokes sit on the odd multiples of .75 (3.75,
// 5.25, 6.75 … 18.75, 20.25): at 16px those land on half pixels at 1x and
// whole device pixels at 2x, and at 24px@2x on half device pixels, so the
// 1.5 stroke stays crisp at every size the palette and the site use. A
// vertical on the centre line (12) is crisp at 2x only.
const icons: Record<MicroName, string> = {
  // Shaft is drawn 3 units past the tip and trimmed by its dash at rest; on
  // hover it draws to full length while the head nudges 3 units to meet it.
  'arrow-right':
    '<path class="m-shaft" pathLength="1" d="M4.75 12c5.8-.12 11.65-.1 17.5 0"/>' +
    '<path class="m-head" d="M13.9 6.75c1.7 1.95 3.45 3.7 5.35 5.25-1.95 1.55-3.7 3.3-5.35 5.25"/>',

  // The arrow nudges up-right; a short dash fades in behind it, a trail.
  'arrow-up-right':
    '<path class="m-tick" d="M4.75 19.25 6.1 17.9"/>' +
    '<g class="m-arrow">' +
    '<path d="M6.75 17.25c3.35-3.55 6.75-6.95 10.1-10.1"/>' +
    '<path d="M9.4 6.9c2.65-.1 5.25-.15 7.85-.15.05 2.6 0 5.2-.1 7.85"/>' +
    '</g>',

  // The arrow drops into the tray, and the tray gives a little.
  download:
    '<g class="m-drop">' +
    '<path d="M12 4.5c.05 3.1.05 6.15 0 9.2"/>' +
    '<path d="M8.6 10.35c1.25 1.05 2.35 2.2 3.4 3.4 1.05-1.2 2.15-2.35 3.4-3.4"/>' +
    '</g>' +
    '<path class="m-tray" d="M5.25 14.25v3c0 .83.67 1.5 1.5 1.5h10.5c.83 0 1.5-.67 1.5-1.5v-3"/>',

  // The flap folds up over the top edge and the letter inside shows.
  mail:
    '<path d="M5.25 8.25c0-.83.67-1.5 1.5-1.5h10.5c.83 0 1.5.67 1.5 1.5v7.5c0 .83-.67 1.5-1.5 1.5H6.75c-.83 0-1.5-.67-1.5-1.5Z"/>' +
    '<path class="m-flap" d="M6.1 7.55c1.95 1.7 3.9 3.2 5.9 4.45 2-1.25 3.95-2.75 5.9-4.45"/>' +
    '<path class="m-line" d="M9 11.25h6"/>' +
    '<path class="m-line" d="M9 14.25h3.75"/>',

  // The two sheets slide apart; once copied (an `.is-done` ancestor) a check
  // draws itself on the front sheet.
  copy:
    '<path class="m-back" d="M14.25 7.5v-.75c0-.83-.67-1.5-1.5-1.5h-6c-.83 0-1.5.67-1.5 1.5v6c0 .83.67 1.5 1.5 1.5h.75"/>' +
    '<path class="m-front" d="M8.25 9.75c0-.83.67-1.5 1.5-1.5h7.5c.83 0 1.5.67 1.5 1.5v7.5c0 .83-.67 1.5-1.5 1.5h-7.5c-.83 0-1.5-.67-1.5-1.5Z"/>' +
    '<path class="m-check" pathLength="1" d="M11.15 13.6l1.6 1.6 3.1-3.45"/>',

  // A four-point star, centred at rest; on hover it steps aside and turns,
  // and two small ones pop in beside it.
  sparkle:
    '<path class="m-star" d="M12 6.75c.45 3.4 1.85 4.8 5.25 5.25-3.4.45-4.8 1.85-5.25 5.25-.45-3.4-1.85-4.8-5.25-5.25 3.4-.45 4.8-1.85 5.25-5.25Z"/>' +
    '<path class="m-pop" d="M17.5 3.9v2.5M16.25 5.15h2.5"/>' +
    '<path class="m-pop" d="M18.4 15.4v2.3M17.25 16.55h2.3"/>',

  // Erlenmeyer flask with a wavy surface; bubbles rise through it.
  flask:
    '<path d="M9.75 5.25h4.5M10.5 5.25v4.1L6.1 16.9c-.55.95.1 1.85 1.2 1.85h9.4c1.1 0 1.75-.9 1.2-1.85L13.5 9.35v-4.1"/>' +
    '<path d="M7.6 14.4c1.45-.55 2.9-.55 4.35 0s2.95.55 4.4 0"/>' +
    '<path class="m-bub" d="M10.6 16.6h.01"/>' +
    '<path class="m-bub" d="M13.6 16.2h.01"/>' +
    '<path class="m-bub" d="M12.1 11.9h.01"/>',

  // A manicule (☞): cuff, index finger out, three curled fingers and the
  // thumb's crease. It pokes twice toward what it points at.
  hand:
    '<g class="m-hand">' +
    '<path d="M4.75 9.5c0-.28.22-.5.5-.5h1.5v9.25h-1.5a.5.5 0 0 1-.5-.5Z"/>' +
    '<path d="M6.75 9.9c1-1.5 2.3-2.4 3.9-2.4h6.85a1.75 1.75 0 0 1 0 3.5H12.4"/>' +
    '<path d="M12.4 11h.6a1.4 1.4 0 0 1 0 2.8h-1.4"/>' +
    '<path d="M12.9 13.8a1.3 1.3 0 0 1 0 2.6h-1.5"/>' +
    '<path d="M12.4 16.4a1.1 1.1 0 0 1 0 2.2H9.1c-.95 0-1.75-.2-2.35-.5"/>' +
    '<path d="M8.6 11.35c1.1.55 2.4.45 3.8-.35"/>' +
    '</g>',

  // An open book; one page turns from the right leaf to the left.
  book:
    '<path d="M12 7.25c-1.6-1.3-3.9-1.8-7.25-1.6v11.8c3.35-.2 5.65.3 7.25 1.55 1.6-1.25 3.9-1.75 7.25-1.55V5.65c-3.35-.2-5.65.3-7.25 1.6Z"/>' +
    '<path d="M12 7.25V19"/>' +
    '<path class="m-page" d="M12 7.25c1.35-1.05 3.2-1.5 5.5-1.45v10.6c-2.3-.05-4.15.4-5.5 1.45"/>',

  // Angle brackets that spread apart; the slash stays put.
  code:
    '<path class="m-lt" d="M8.75 8.25C7.5 9.5 6.25 10.75 5 12c1.25 1.25 2.5 2.5 3.75 3.75"/>' +
    '<path class="m-gt" d="M15.25 8.25c1.25 1.25 2.5 2.5 3.75 3.75-1.25 1.25-2.5 2.5-3.75 3.75"/>' +
    '<path d="M13.25 6.75c-.8 3.5-1.65 7-2.5 10.5"/>',

  // A cup on a stem; it lifts a touch and two sparkles pop by the rim.
  trophy:
    '<g class="m-cup">' +
    '<path d="M8.25 5.25h7.5v4.25c0 2.1-1.7 3.75-3.75 3.75S8.25 11.6 8.25 9.5Z"/>' +
    '<path d="M8.25 6.75H7c-.85 0-1.5.65-1.5 1.5 0 1.3 1.05 2.35 2.35 2.35h.55"/>' +
    '<path d="M15.75 6.75H17c.85 0 1.5.65 1.5 1.5 0 1.3-1.05 2.35-2.35 2.35h-.55"/>' +
    '</g>' +
    '<path d="M12 13.25v2.75M9 18.75h6M9.75 18.75c.05-1.3 1-2.25 2.25-2.25s2.2.95 2.25 2.25"/>' +
    '<path class="m-pop" d="M5.1 2.9v2.6M3.8 4.2h2.6"/>' +
    '<path class="m-pop" d="M19.1 2.6v2.3M17.95 3.75h2.3"/>',

  // ---------------------------------------------------------- palette set

  // A house; its front door swings open on the left hinge (the leaf narrows
  // as it turns inward, the doorway stays drawn behind it).
  home:
    '<path d="M4.9 11.9c2.3-2.2 4.7-4.35 7.1-6.4 2.4 2.05 4.8 4.2 7.1 6.4"/>' +
    '<path d="M6.75 10.4v6.85c0 .83.67 1.5 1.5 1.5h7.5c.83 0 1.5-.67 1.5-1.5V10.4"/>' +
    '<path d="M10.5 18.75v-2.6c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v2.6"/>' +
    '<path class="m-door" d="M10.5 18.75v-2.6c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v2.6"/>',

  // A page with a folded corner; its last line writes itself to the margin.
  doc:
    '<path d="M13.25 5.25h-4.5c-1.1 0-2 .9-2 2v9.5c0 1.1.9 2 2 2h6.5c1.1 0 2-.9 2-2V9.25Z"/>' +
    '<path d="M13.25 5.25v3c0 .55.45 1 1 1h3"/>' +
    '<path d="M9.75 12.75h4.5"/>' +
    '<path class="m-write" pathLength="1" d="M9.75 15.75c1.5-.05 3-.05 4.5 0"/>',

  // Three sheets in a stack; they fan apart, the top one most.
  layers:
    '<path class="m-l1" d="M12 5.25c2.4 1.15 4.8 2.35 7.2 3.6-2.4 1.25-4.8 2.45-7.2 3.6-2.4-1.15-4.8-2.35-7.2-3.6 2.4-1.25 4.8-2.45 7.2-3.6Z"/>' +
    '<path class="m-l2" d="M4.8 12.2c2.4 1.2 4.8 2.4 7.2 3.55 2.4-1.15 4.8-2.35 7.2-3.55"/>' +
    '<path class="m-l3" d="M4.8 15.6c2.4 1.2 4.8 2.4 7.2 3.55 2.4-1.15 4.8-2.35 7.2-3.55"/>',

  // A mortarboard; it lifts and tips as if tossed, and the tassel swings.
  cap:
    '<g class="m-cap">' +
    '<path d="M12 5.5c2.45 1.2 4.85 2.45 7.25 3.75-2.4 1.3-4.8 2.55-7.25 3.75-2.45-1.2-4.85-2.45-7.25-3.75 2.4-1.3 4.8-2.55 7.25-3.75Z"/>' +
    '<path class="m-tassel" d="M19.25 9.25v4.5"/>' +
    '</g>' +
    '<path d="M7.75 11.35v3.4c0 1.35 1.9 2.5 4.25 2.5s4.25-1.15 4.25-2.5v-3.4"/>',

  // A briefcase; picked up by the handle, it swings once and settles.
  briefcase:
    '<g class="m-case">' +
    '<path d="M9.75 8.25v-1.5c0-.83.67-1.5 1.5-1.5h1.5c.83 0 1.5.67 1.5 1.5v1.5"/>' +
    '<path d="M6.75 8.25h10.5c.83 0 1.5.67 1.5 1.5v7.5c0 .83-.67 1.5-1.5 1.5H6.75c-.83 0-1.5-.67-1.5-1.5v-7.5c0-.83.67-1.5 1.5-1.5Z"/>' +
    '<path d="M5.25 12.75h13.5"/>' +
    '</g>',

  // A microphone on its stand; sound waves ripple out on both sides.
  mic:
    '<path d="M12 4.5c1.25 0 2.25 1 2.25 2.25v3.75c0 1.25-1 2.25-2.25 2.25s-2.25-1-2.25-2.25V6.75C9.75 5.5 10.75 4.5 12 4.5Z"/>' +
    '<path d="M6.75 10.5c0 2.9 2.35 5.25 5.25 5.25s5.25-2.35 5.25-5.25"/>' +
    '<path d="M12 15.75v3M9.75 18.75h4.5"/>' +
    '<path class="m-wave m-wave-l" d="M3.9 7.6c-.7 1.55-.7 3.1 0 4.65"/>' +
    '<path class="m-wave m-wave-r" d="M20.1 7.6c.7 1.55.7 3.1 0 4.65"/>',

  // A chalkboard on its easel; a line of chalk writes itself across it.
  board:
    '<path d="M6.75 5.25h10.5c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5H6.75c-.83 0-1.5-.67-1.5-1.5v-6c0-.83.67-1.5 1.5-1.5Z"/>' +
    '<path d="M12 14.25v1.9M9.25 18.9 12 16.15l2.75 2.75"/>' +
    '<path d="M8.25 8.25h3.75"/>' +
    '<path class="m-chalk" pathLength="1" d="M8.25 11.1c.85-.9 1.7-.9 2.55 0s1.7.9 2.55 0 1.7-.9 2.4-.1"/>',

  // A wall calendar; its rings lift and a day gets checked off.
  calendar:
    '<path d="M6.75 6.75h10.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H6.75c-.83 0-1.5-.67-1.5-1.5v-9c0-.83.67-1.5 1.5-1.5Z"/>' +
    '<path d="M5.25 9.75h13.5"/>' +
    '<path class="m-ring" d="M9 5.25v3M15 5.25v3"/>' +
    '<path class="m-check" pathLength="1" d="M9.6 14.2l1.65 1.55 3.15-3.35"/>',

  // A speech bubble; three dots appear one after another, someone typing.
  chat:
    '<path d="M7.25 6h9.5c1.1 0 2 .9 2 2v5.5c0 1.1-.9 2-2 2h-4.1l-3.4 2.9v-2.9h-2c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2Z"/>' +
    '<path class="m-dot" d="M9 10.75h.01"/>' +
    '<path class="m-dot" d="M12 10.75h.01"/>' +
    '<path class="m-dot" d="M15 10.75h.01"/>',

  // A rosette with a check on two ribbons; the medal flips over once.
  badge:
    '<g class="m-medal">' +
    '<path d="M12 5c2.65 0 4.75 2.1 4.75 4.75S14.65 14.5 12 14.5s-4.75-2.1-4.75-4.75S9.35 5 12 5Z"/>' +
    '<path d="M10.1 9.9l1.3 1.25 2.55-2.75"/>' +
    '</g>' +
    '<path d="M9.4 13.8 8.5 19.25l3.5-1.6 3.5 1.6-.9-5.45"/>',

  // Sun and moon in one box. At rest it shows the current theme; on hover
  // it morphs to the one you would switch to (micro.css reads data-theme).
  theme:
    '<g class="m-sun">' +
    '<path class="m-core" d="M12 8.75c1.8 0 3.25 1.45 3.25 3.25S13.8 15.25 12 15.25 8.75 13.8 8.75 12 10.2 8.75 12 8.75Z"/>' +
    '<path class="m-ray" d="M12 3.75v1.5"/>' +
    '<path class="m-ray" d="m17.85 6.15-1.05 1.05"/>' +
    '<path class="m-ray" d="M20.25 12h-1.5"/>' +
    '<path class="m-ray" d="m17.85 17.85-1.05-1.05"/>' +
    '<path class="m-ray" d="M12 20.25v-1.5"/>' +
    '<path class="m-ray" d="m6.15 17.85 1.05-1.05"/>' +
    '<path class="m-ray" d="M3.75 12h1.5"/>' +
    '<path class="m-ray" d="m6.15 6.15 1.05 1.05"/>' +
    '</g>' +
    '<path class="m-moon" d="M18.6 14.4A6.75 6.75 0 0 1 9.6 5.4a6.75 6.75 0 1 0 9 9Z"/>',

  // Two faders; the knobs slide past each other.
  sliders:
    '<path d="M5.25 8.25h13.5M5.25 15.75h13.5"/>' +
    '<path class="m-knob m-knob-a" d="M14.25 6.25v4"/>' +
    '<path class="m-knob m-knob-b" d="M9.75 13.75v4"/>',

  // A lightning bolt; it strikes down a touch and two sparks fly.
  bolt:
    '<path class="m-strike" d="M13.4 4.75c-2.1 2.7-4.3 5.45-6.4 8.25h5c-.35 2.1-.7 4.15-1.05 6.25 2.15-2.75 4.3-5.5 6.35-8.25h-5c.35-2.1.75-4.15 1.1-6.25Z"/>' +
    '<path class="m-spark" d="M8.35 17.8 7 18.3"/>' +
    '<path class="m-spark" d="M9.05 20.1l-.9.85"/>',

  // A globe; the meridian sweeps round once, as if it spun.
  globe:
    '<path d="M12 4.75c4 0 7.25 3.25 7.25 7.25S16 19.25 12 19.25 4.75 16 4.75 12 8 4.75 12 4.75Z"/>' +
    '<path d="M5.25 9.75h13.5M5.25 14.25h13.5"/>' +
    '<path class="m-meridian" d="M12 4.75c-1.85 2.1-2.75 4.5-2.75 7.25s.9 5.15 2.75 7.25c1.85-2.1 2.75-4.5 2.75-7.25S13.85 6.85 12 4.75Z"/>',

  // A phone; a notification drops in at the top of the screen.
  phone:
    '<path d="M9.75 3.75h4.5c1.25 0 2.25 1 2.25 2.25v12c0 1.25-1 2.25-2.25 2.25h-4.5c-1.25 0-2.25-1-2.25-2.25V6c0-1.25 1-2.25 2.25-2.25Z"/>' +
    '<path d="M11.25 17.25h1.5"/>' +
    '<path class="m-note" d="M10.1 7.5h3.8"/>',

  // A window; a pane snaps into its left half (SnapLayouts' own trick).
  window:
    '<path d="M6.75 5.25h10.5c1.1 0 2 .9 2 2v9.5c0 1.1-.9 2-2 2H6.75c-1.1 0-2-.9-2-2v-9.5c0-1.1.9-2 2-2Z"/>' +
    '<path d="M4.75 8.25h14.5"/>' +
    '<path class="m-pane" d="M7.5 10.5h3.75c.41 0 .75.34.75.75v4.5c0 .41-.34.75-.75.75H7.5a.75.75 0 0 1-.75-.75v-4.5c0-.41.34-.75.75-.75Z"/>',

  // A drafting compass; the legs open and the pencil draws an arc.
  compass:
    '<path d="M12 3.75v1.5"/>' +
    '<path d="M12 5.25c.97 0 1.75.78 1.75 1.75S12.97 8.75 12 8.75 10.25 7.97 10.25 7s.78-1.75 1.75-1.75Z"/>' +
    '<path class="m-leg-l" d="M11.3 8.6c-1.3 3.4-2.55 6.8-3.8 10.15"/>' +
    '<path class="m-leg-r" d="M12.7 8.6c1.3 3.4 2.55 6.8 3.8 10.15"/>' +
    '<path class="m-arc" pathLength="1" d="M6.4 15.9c3.6 1.85 7.6 1.85 11.2 0"/>',
};

export const microNames = Object.keys(icons) as MicroName[];

export interface MicroOptions {
  size?: MicroSize;
  /** Accessible name; without one the icon is decorative (aria-hidden). */
  label?: string;
  class?: string;
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The full `<svg>` for one micro-icon, as an HTML string. */
export function microSvg(name: MicroName, { size = 16, label, class: extra }: MicroOptions = {}): string {
  const cls = ['micro', `micro--${name}`, extra].filter(Boolean).join(' ');
  const a11y = label ? `role="img" aria-label="${escAttr(label)}"` : 'aria-hidden="true" focusable="false"';
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${icons[name]}</svg>`
  );
}

/** Just the inner paths, for callers that build their own `<svg>`. */
export const microInner = (name: MicroName) => icons[name];
