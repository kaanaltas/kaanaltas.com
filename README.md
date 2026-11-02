# kaanaltas.com

The source of [kaanaltas.com](https://kaanaltas.com), the personal site of Kaan Altaş: research in process systems engineering, optimization and machine learning, the tools I build, a CV and a gallery of technical drawings.

Built with [Astro](https://astro.build) as a static site and served from Cloudflare.

```bash
npm ci
npx astro dev     # http://localhost:4321
npx astro build   # static site in dist/
```

- `src/pages`: the five pages (home, interests, work, CV, gallery)
- `src/data`: the content (CV entries, projects, interests, the gallery)
- `src/figures`: the drawings, as SVG, with their interactive layers in `src/figures/live`
- `src/scripts`: the interactions (gallery zoom and Quick Look, touch handling, theme, the equation mesh)
- `docs/design-system.md`: tokens, type, motion and the rules behind them

This repository is published from a private one, so its history starts at each export.

See [LICENSE.md](LICENSE.md) for what you may reuse.
