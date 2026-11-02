// Content for /gallery: every figure on the site, once. Captions for the
// figures placed elsewhere come from where they are placed (interests.ts,
// projects.ts), so the two never drift; the rest live here.
//
// Order: chosen for packing, not by theme. It is the result of a seeded
// local search (swaps and moves, 3 restarts) over the justified-row cost of
// src/scripts/gallery-core.js summed across 13 common viewport widths
// (768–3440, weighted toward 1280–1920), with a small bonus for keeping
// figures of one theme next to each other and the flowsheet pinned first.
// Re-run .work/gallery/order2.mjs if figures are added. Readers can drag
// their own order; that is kept in their browser only.
import { interests } from './interests';
import { projects } from './projects';

export interface GalleryFigure {
  slug: string;
  /** Short name: the tile's accessible name and the palette row title. */
  title: string;
  caption: string;
}

const placed = new Map<string, string>([
  ...interests.flatMap((i) => (i.figures ?? []).map((f) => [f.slug, f.caption] as [string, string])),
  ...projects.flatMap((p) => (p.figure ? [[p.figure.slug, p.figure.caption] as [string, string]] : [])),
]);

const own: Record<string, string> = {
  'ball-valve': 'Floating ball valve, DN50 class 150, half-sectioned; a quarter turn of the ball shuts the line.',
  'electrolyzer-stack':
    'PEM electrolyzer stack, exploded: end plates, bipolar plates, membrane electrode assembly, H₂ and O₂ outlets.',
  'distillation-column':
    'Sieve-tray distillation column, exploded: feed, trays and downcomers, reboiler below, condenser and reflux drum above.',
  'mccabe-thiele':
    'McCabe–Thiele construction for a binary column: equilibrium curve, q-line, rectifying and stripping lines, and the theoretical stages stepped off at R = 1.4·R_min.',
  'heat-exchanger':
    'U-tube shell-and-tube heat exchanger, sectioned: shell-side flow across the baffles, counter-current tube-side flow.',
  'packed-bed-reactor':
    'Fixed-bed catalytic reactor, cut away, with the axial conversion and temperature profiles of a 1-D plug-flow model below it.',
  'cstr-reactor':
    'Jacketed continuous stirred-tank reactor, cut away: feed, impeller, baffles, cooling jacket, product outlet.',
  'neural-network':
    'Feed-forward neural network: pixel input, two ReLU hidden layers, softmax output over class probabilities.',
  'knn-classifier':
    "k-nearest-neighbour classification: 42 samples in three classes, the decision regions for k = 5, and the vote among one query's five nearest neighbours.",
  'compass-construction':
    "Construction of the KA monogram: the K's leg is an arc centred on the A's apex that runs on as the crossbar; apex and joint close a 3-4-5 triangle whose hypotenuse is the compass radius.",
};

const order: [slug: string, title: string][] = [
  // Packing search (.work/gallery/order3.mjs; 20 figures, aspects read from the SVGs), process-flowsheet pinned first.
  ['process-flowsheet', 'Process flowsheet'],
  ['packed-bed-reactor', 'Fixed-bed catalytic reactor'],
  ['electrolyzer-stack', 'PEM electrolyzer stack'],
  ['attention-head', 'Self-attention head'],
  ['knn-classifier', 'k-nearest-neighbour classifier'],
  ['gradient-descent', 'Gradient descent'],
  ['conformal-forecast', 'Conformal forecast'],
  ['distillation-column', 'Sieve-tray distillation column'],
  ['distillation-sequence', 'Direct distillation sequence'],
  ['mccabe-thiele', 'McCabe–Thiele construction'],
  ['heat-exchanger', 'Shell-and-tube heat exchanger'],
  ['neural-network', 'Feed-forward neural network'],
  ['ptx-superstructure', 'Power-to-X superstructure'],
  ['ball-valve', 'Floating ball valve'],
  ['cstr-reactor', 'Jacketed stirred-tank reactor'],
  ['pareto-front', 'Cost versus emissions'],
  ['mpc-horizon', 'Model predictive control'],
  ['milp-lattice', 'Mixed-integer program'],
  ['stochastic-scenario-tree', 'Two-stage stochastic program'],
  ['compass-construction', 'Compass monogram construction'],
];

export const gallery: GalleryFigure[] = order.map(([slug, title]) => {
  const caption = placed.get(slug) ?? own[slug];
  if (!caption) throw new Error(`gallery: no caption for ${slug}`);
  return { slug, title, caption };
});

export const galleryIntro = {
  title: 'Gallery',
  lede: 'Every drawing on this site in one place, fitted together edge to edge.',
};
