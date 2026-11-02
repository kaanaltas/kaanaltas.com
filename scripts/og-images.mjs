// Social preview cards (Open Graph / X) for each page, 1200 x 630, in the
// site's own language: the page's title and lede set in Inter, and one of the
// site's figures on its light tile. Rendered once with headless Chrome into
// public/og/; rerun after changing a page's title, lede or figure:
//   node scripts/og-images.mjs
// Copy is kept in sync with src/data by hand (the cards are static images).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/og');
mkdirSync(OUT, { recursive: true });

const CARDS = [
  {
    slug: 'home',
    title: 'Kaan Altaş',
    lede: 'I work on optimization and machine learning for chemical and energy systems, and I build apps for iOS and macOS.',
    figure: 'process-flowsheet',
  },
  {
    slug: 'interests',
    title: 'Interests',
    lede: 'Who I am, and the things I keep coming back to.',
    figure: 'gradient-descent',
  },
  {
    slug: 'work',
    title: 'Work',
    lede: 'Things I’ve worked on, from optimization models to LLM agents, and the apps I build on the side.',
    figure: 'electrolyzer-stack',
  },
  {
    slug: 'cv',
    title: 'CV',
    lede: 'Researcher in process systems engineering, working on optimization, machine learning and AI for complex engineering systems.',
    figure: 'milp-lattice',
  },
  {
    slug: 'gallery',
    title: 'Gallery',
    lede: 'Every drawing on this site in one place, fitted together edge to edge.',
    figure: 'distillation-column',
  },
];

const font = (p) => `file://${join(ROOT, p)}`;
const css = `
@font-face{font-family:'Inter Variable';font-weight:100 900;src:url('${font('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')}') format('woff2-variations');unicode-range:U+0000-00FF,U+0131,U+2000-206F}
@font-face{font-family:'Inter Variable';font-weight:100 900;src:url('${font('src/assets/fonts/inter-latin-ext-tr-wght.woff2')}') format('woff2-variations');unicode-range:U+0100-017F}
@font-face{font-family:'Geist Mono Variable';font-weight:100 900;src:url('${font('node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2')}') format('woff2-variations')}
@font-face{font-family:'Departure Mono';src:url('${font('public/fonts/DepartureMono-Regular.woff2')}') format('woff2')}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;background:#fcfcfc;color:#1a1a1a;
  --fig-ink:#1342ff;--fig-lit:#ffffff;--fig-50:#f4f5f9;--fig-100:#e6ebff;--fig-200:#b9c7fd;--fig-300:#97acff;--fig-400:#607ffd;--fig-dot:#1342ff1f}
.card{position:relative;display:grid;grid-template-columns:470px 1fr;gap:44px;height:630px;padding:56px 56px 56px 64px}
.text{display:flex;flex-direction:column;min-width:0}
.mark{display:flex;align-items:center;gap:14px;font:400 15px/1 'Geist Mono Variable',monospace;letter-spacing:.04em;color:#6f6f6f;text-transform:uppercase}
.mark b{font:400 26px/1 'Departure Mono',monospace;letter-spacing:-.02em;color:#1a1a1a}
.mid{margin-top:auto;margin-bottom:auto}
h1{font:600 76px/1.04 'Inter Variable',sans-serif;letter-spacing:-.035em}
p{margin-top:22px;font:400 27px/1.42 'Inter Variable',sans-serif;letter-spacing:-.01em;color:#6f6f6f;text-wrap:pretty}
.url{font:400 17px/1 'Geist Mono Variable',monospace;color:#8f8f8f;letter-spacing:.02em}
.tile{align-self:center;display:grid;place-items:center;height:518px;border-radius:22px;background-color:#fff;
  background-image:radial-gradient(var(--fig-dot) .9px,transparent 1px);background-size:8px 8px;
  box-shadow:0 0 0 1px #ebebeb,0 1px 2px #0000000a,0 12px 32px -18px #35354f40;padding:26px;overflow:hidden}
.tile svg{width:100%;height:100%;max-height:466px;display:block}
`;

function chrome(html, png) {
  const dir = mkdtempSync(join(tmpdir(), 'og-'));
  const page = join(dir, 'card.html');
  writeFileSync(page, html);
  rmSync(png, { force: true });
  return new Promise((resolve) => {
    const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-prefers-reduced-motion',
      '--allow-file-access-from-files', `--user-data-dir=${join(dir, 'profile')}`,
      '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=3000',
      `--screenshot=${png}`, `file://${page}`,
    ]);
    const t0 = Date.now();
    const poll = setInterval(() => {
      let ok = false;
      try { ok = statSync(png).size > 0; } catch {}
      if (ok || Date.now() - t0 > 30000) {
        clearInterval(poll);
        setTimeout(() => { ch.kill('SIGKILL'); rmSync(dir, { recursive: true, force: true }); resolve(); }, 400);
      }
    }, 200);
  });
}

for (const c of CARDS) {
  const svg = readFileSync(join(ROOT, 'src/figures', `${c.figure}.svg`), 'utf8').replace(/^<\?xml[^>]*>\s*/, '');
  const html = `<!doctype html><meta charset="utf-8"><style>${css}</style>
<div class="card is-in"><div class="text">
  <div class="mark"><b>KA</b>${c.slug === 'home' ? '' : '<span>Kaan Altaş</span>'}</div>
  <div class="mid"><h1>${c.title}</h1><p>${c.lede}</p></div>
  <div class="url">kaanaltas.com${c.slug === 'home' ? '' : '/' + c.slug}</div>
</div><div class="tile is-in">${svg}</div></div>`;
  const png = join(OUT, `${c.slug}.png`);
  await chrome(html, png);
  console.log(`public/og/${c.slug}.png  ${statSync(png).size} bytes`);
}
