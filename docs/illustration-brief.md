# Illustration brief: technical figures for kaanaltas.com

This brief is self-contained. The same text goes to every model that draws figures, so the outputs can be compared fairly.

## Context

This is the personal site of Kaan Altaş: a process systems engineering (PSE) researcher (optimization, ML, AI for chemical/energy systems), Fulbright scholar, and iOS/macOS builder. The site is very clean: neutral palette, one accent (cobalt), Inter + Geist Mono, generous whitespace. Illustrations are the one place the site gets rich.

The visual reference is **makingsoftware.com** (Dan Hollick). Read `docs/research/makingsoftware.md` for the full technical teardown, and `docs/design-system.md` §6 for our adaptation. In short: hand-crafted inline SVG line art, one cobalt hue with a 5-step tint ramp, crisp 1px hairlines, true 30° isometric for objects, orthographic for mechanisms, exploded views with dashed assembly guides, 45° hatching on cut surfaces, ordered-dither patterns instead of gradients, pixel-grid elements, and small uppercase pixel-font labels with straight leader lines ending in tiny triangles. It must feel **pixelated yet razor sharp**: precise vector geometry plus deliberate pixel/dither texture.

## Deliverable

For each figure below, write ONE standalone SVG file to `<OUT_DIR>/<slug>.svg`, where `<OUT_DIR>` is given in your task prompt. Also write `<OUT_DIR>/NOTES.md` with a short note per figure: what it shows and any trade-offs.

### Hard technical rules

1. Root element: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" fill="none" class="fig" data-fig="<slug>" role="img" aria-labelledby="<slug>-title <slug>-desc">`, followed by `<title id="<slug>-title">` and `<desc id="<slug>-desc">`. Do not set width or height attributes. W is 960 for "wide" figures and 480 for "compact" figures. Pick H to fit, and keep it tight.
2. **Colors only through classes**, which are defined in an internal `<style>` scoped to `[data-fig="<slug>"]`. Never hard-code hex on elements. Each class uses a CSS variable with a light-mode fallback:
   ```css
   [data-fig="slug"] .s  { stroke: var(--fig-ink, #1342ff); }      /* every edge */
   [data-fig="slug"] .i  { fill:   var(--fig-ink, #1342ff); }      /* labels, arrowheads, solid pixels */
   [data-fig="slug"] .fl { fill:   var(--fig-lit, #ffffff); }      /* lit top faces */
   [data-fig="slug"] .f0 { fill:   var(--fig-50,  #f4f5f9); }      /* body faces */
   [data-fig="slug"] .f1 { fill:   var(--fig-100, #e6ebff); }      /* secondary / inner walls */
   [data-fig="slug"] .f2 { fill:   var(--fig-200, #b9c7fd); }      /* shadow sides, liquid, cut surfaces */
   [data-fig="slug"] .f3 { fill:   var(--fig-300, #97acff); }      /* THE subject: packing, catalyst, active neuron */
   [data-fig="slug"] .g  { stroke: var(--fig-400, #607ffd); }      /* faint grids / guides */
   ```
   The dark theme overrides these variables from outside, so your SVG must look right on both a near-white background (#fcfcfc) and a near-black one (#0f0f10) purely through those variables. Dark values for reference: ink #8fa3ff, lit #1b1f2b, 50 #161924, 100 #1c2236, 200 #25305a, 300 #34479a, 400 #5872f0.
3. **One hue only.** No other colors, no gradients, no filters, no drop shadows, no raster images, no `<foreignObject>`.
4. Strokes are 1 unit by default, with butt caps and miter joins. Use 2 units only for the single hero line, and 3 only for shafts or springs. Put `vector-effect="non-scaling-stroke"` on stroked elements. Hidden edges use `stroke-dasharray="4 4"`, and assembly guides use `"24 6"`.
5. **Construction order per part:** fill paths without stroke first, then the optional hatch or dither overlay on the same geometry, then ONE stroke path holding all visible edges as `M…L…` subpaths. Group each part in `<g data-part style="--i:N">`, where N is its assembly order (0–5).
6. **Grid:** snap geometry to a 10-unit grid, with 5 allowed for small parts. Isometric projection: `iso(x,y,z) = [ox + (x−y)·0.8660, oy + (x+y)·0.5 − z]`. Horizontal circles become ellipses with ry/rx = 0.577. You may compute coordinates with a script (Node or Python) and hand-tune; generated geometry is encouraged, since precision matters.
7. **Patterns** go in `<defs>` with ids prefixed by the slug (for example `slug-d50`, so there are no collisions when many figures are inlined into one page):
   - Bayer dither at 25%, 50% and 75% (4×4 tiles made of 2×2 `.i` rects), applied at `fill-opacity: .35` over a tint for shading bands.
   - Hatch: a 10×10 tile holding one 45° `.s` line, or 5×5 for small parts.
   - An optional faint 10-unit grid in `.g` at opacity .35.
8. **Labels:** live `<text>` in `font-family: 'Departure Mono', ui-monospace, monospace`, size 11, uppercase, `letter-spacing: .02em`, class `i`. Place them in clean left and right gutter columns. Leaders are straight horizontal or vertical 1px `.s` lines ending in a filled triangle about 6×5 (class `i`) that touches the part. Leaders never cross or run diagonally. Use 3–7 labels per figure, and use real engineering vocabulary.
9. **Animation:** pure CSS inside the SVG's `<style>`, scoped by `[data-fig]`. No `prefers-reduced-motion` query: the site gives every visitor the same motion. Two kinds:
   - **Assembly (once):** `:where(.fig-frame) [data-fig=slug] [data-part]` starts at `opacity:0; translate: 0 calc(var(--lift, -40) * 1px)` and transitions to rest when an ancestor has class `.is-in` (`.is-in [data-fig=slug] [data-part]` or `[data-fig=slug].is-in [data-part]`). Use `transition: translate 820ms var(--spring-soft, cubic-bezier(.23,1,.32,1)) calc(var(--i)*110ms), opacity 400ms ease calc(var(--i)*110ms)`. Only that starting rule is gated, on the host frame and with zero specificity: inside a `.fig-frame` parts are hidden until `.is-in`, then fly in; a raw embed (no frame) renders fully assembled.
   - **At most ONE subtle ambient loop** (for example flow dashes moving along a pipe via `stroke-dashoffset`, an impeller rotating with `transform-box: fill-box`, a signal pulse through a network, or bubbles rising). It should be slow and calm (1.2–4 s), and gated by `.is-in` too.
10. **Size budget:** at most 25 KB per SVG. Round coordinates to at most 2 decimals.
11. Must validate: well-formed XML, unique ids, and rendering in Chrome.
12. **Markers are round.** This is the owner's preference. Nodes, points, optima and stream-number tags are circles or pills. Squares are reserved for pixels and bitmaps.
13. **Direction arrows are computed:** arrowheads are built from the shaft's direction vector. An objective arrow (cᵀx) is perpendicular to a dashed iso-objective line through the optimum, and has a small tail circle.
15. **Two-state unit drawings (closed ↔ open).** Equipment figures can carry an assembled CLOSED form and an exploded or cut-away OPEN form. `src/components/Figure.astro` switches between them:
    - The figure starts closed and opens about 1.9 s after it scrolls into view (after the closed form has assembled).
    - A toggle button switches between the two.
    - Without JS it stays OPEN.
    
    The contract:
    - Put `data-states` on the SVG root.
    - Moving parts are plain `<g data-move style="--cx:…px;--cy:…px;--m:N">` wrappers with **no transform attribute**. They are drawn at their OPEN position and slide by (--cx, --cy) user units when closed. `--m` is the stagger order.
    - `data-open-only` marks elements that exist only in the open state (cut-away faces, exploded guides, interior visible through the cut).
    - `data-closed-only` marks elements that exist only in the closed state (the intact outer shell covering the cut, a closed lid, compressed-stack edges).
    - The CLOSED form must be a correct, complete assembled unit: parts seated, no gaps, no floating pieces, flanges meeting, hidden interiors covered. Labels and leaders must stay valid in both states, or be `data-open-only`.
    - **Choreography: closing is a real sequence, not opening in reverse playback and never a cross-fade.** The rule of thumb is that nothing pops while it can be seen. Closing: callouts and flows out → moving parts travel home and seat → the shell closes over them → the interior is dropped only once it is covered. Opening runs that backwards. Aim for 0.8–1.4 s in total. Each element can set its own timing with these custom properties (registered by `Figure.astro`, not inherited, and all optional, so older figures keep the old behaviour):
      - `--d-open` / `--d-close`: the delay when the figure opens / closes. These work on `[data-move]` (added to the `--m` stagger), `[data-open-only]` and `[data-closed-only]`.
      - `--t-move` / `--ease-move`: the slide's duration and easing. The default is 720 ms `--spring-snappy`. Use `--spring-soft` for anything that seats against another part, because it never overshoots, so a lid or tray never dips through its seat.
      - `--t-fade`: the fade duration (default 260 ms). Use `0s` to swap something that is under cover at that moment.
      Set these in the figure's own CSS, by class.
    - **Shells close as a sleeve or sweep, not a fade.** Wrap the `data-closed-only` shell in a `<mask>` whose window is itself a `[data-move]` (open: parked off the shell; closed: covering it). Shape the window's leading edge as the shell's own section, for example the iso front arc of a cylinder, so the moving edge reads as the rim of a sleeve sliding down. A 1-unit rim line can ride that edge if it is clipped to the shell silhouette, so it is invisible at both rests. Keep the shell's opacity at 1 for the whole wipe (`--t-fade:0s`, `--d-close` = wipe start, `--d-open` = wipe end).
    - Stagger stacked parts so they never cross. With one monotone easing (no overshoot), closing bottom-first and opening top-first keeps every gap at or above its seated value.
    - Keep the existing `.is-in` assembly and the ambient loop working. Nothing may be hidden in a raw embed.
16. **Render check:** `experiments/tools/render.sh <svg> <out.png> [light|dark]` renders with the real fonts at 2x.

### Composition rules

- Generous negative space. The object should occupy about 60–70% of the canvas, with labels in the gutters.
- Exploded views separate parts along the iso Z axis by 40–120 units, with `24 6` dashed guides between them.
- Keep enough detail to reward a close look (bolts, flanges, weir lips, tube holes, nozzles), but never clutter. Precision over quantity.
- Optional pixel ornaments: tiny ░▒▓ strips, a figure number `FIG_0N` in the corner in the label style, a small unit or scale bar.

## Figures

| # | slug | size | subject | notes |
|---|------|------|---------|-------|
| 1 | `distillation-column` | wide | **Exploded isometric distillation column** | Shell cylinder split open. Inside, 3–4 sieve trays are exploded apart (perforation holes as a pixel dot grid, downcomers, weirs). Top: condenser and reflux drum; bottom: reboiler. Labels: FEED, SIEVE TRAY, DOWNCOMER, REFLUX DRUM, REBOILER, DISTILLATE, BOTTOMS. Ambient: vapour dashes rising and liquid dashes falling (counter-flow). This is the hero figure. |
| 2 | `heat-exchanger` | wide | **Shell-and-tube heat exchanger**, isometric cut-away or orthographic section | Shell with hatch on the cut walls, tube bundle, baffles, tube sheets, and nozzles for the hot and cold streams. Labels: SHELL, TUBE BUNDLE, BAFFLE, TUBE SHEET, HOT IN, COLD OUT. Ambient: flow dashes. |
| 3 | `cstr-reactor` | compact | **Jacketed CSTR** | Isometric vessel with cooling jacket, impeller shaft (3 u), agitator blades, and liquid level (dither shading), with inlet and outlet nozzles. Labels: FEED, IMPELLER, COOLING JACKET, PRODUCT. Ambient: slow impeller rotation. |
| 4 | `neural-network` | wide | **Neural network**, orthographic | Input is a small pixel-grid image (for example an 8×8 bitmap of a molecule or a catalyst pellet), then 3 layers of nodes (squares or circles) with 1px edges, then an output bar chart made of pixel blocks. Activation shown as `.f3` fill on some nodes. Labels: INPUT, HIDDEN, WEIGHTS, SOFTMAX, OUTPUT. Ambient: a signal pulse travelling along a few edges. |
| 5 | `milp-lattice` | compact | **Mixed-integer program**, orthographic | Integer lattice as a pixel dot grid, a polytope feasible region (hatched), the LP relaxation optimum vertex vs. the integer optimum (solid pixel), a cutting plane (dashed), and the objective direction arrow (2 u hero line). Labels: FEASIBLE REGION, LP OPTIMUM, INTEGER OPTIMUM, CUT, cᵀx. Optional inset: a small branch-and-bound tree. Ambient: the objective line sliding slightly, or the cut drawing in. |
| 6 | `gradient-descent` | compact | **Gradient descent on a loss landscape** | Either an isometric surface patch (grid mesh) or top-down contour bands drawn as dither steps (d25/d50/d75 quantized, pixel-stepped contours). A descent path of dots and short segments converging to the minimum. Labels: θ₀, ∇L(θ), η, MINIMUM. Ambient: a dot stepping down the path. |
| 7 | `electrolyzer-stack` | wide | **PEM electrolyzer stack, exploded isometric (Power-to-X)** | End plates, bipolar plates with flow-field channels (pixel serpentine), MEA layers (`.f3`), and tie rods, with H₂ and O₂ outlets and a water inlet. Labels: END PLATE, BIPOLAR PLATE, MEMBRANE (MEA), H₂ OUT, O₂ OUT, H₂O IN. Ambient: bubbles rising at the outlets. |
| 8 | `process-flowsheet` | wide | **Process flowsheet (PFD)**, orthographic | Feed → mixer → reactor → heat exchanger → flash separator → product, with a recycle loop and purge. Use equipment symbols in the same line language (not ISO-standard clip-art), with stream numbers in small pixel tags, and a tiny ░ ornament. Labels: FEED, REACTOR, FLASH, RECYCLE, PURGE, PRODUCT. Ambient: flow dashes along the streams. |

## Quality bar

Before finishing, render every SVG to PNG and inspect it closely. Use `rsvg-convert -w 1920 file.svg -o file.png`, or headless Chrome with an isolated profile: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --user-data-dir=$(mktemp -d) --window-size=1400,900 --screenshot=out.png file://…`. Fix anything that looks off:
- misaligned iso edges
- faces that don't meet
- labels colliding
- leaders crossing
- a dark-mode check (render once with the dark variable values substituted)

The result should be something Dan Hollick would nod at: calm, exact, and beautiful.
