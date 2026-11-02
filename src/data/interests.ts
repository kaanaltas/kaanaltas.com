// Content for /interests. Facts come from ./cv.ts (imported where they can
// be, so dates and links stay in sync). Paragraphs are first-person drafts
// written from the bio and the research/experience entries; nothing here
// should claim more than cv.ts supports. Inline links use [label](href).

import { education, fellowships, research, teaching } from './cv';
import { apps } from './projects';
import { microSvg } from '../lib/micro-icons';

export interface InterestFigure {
  slug: string;
  n: number;
  caption: string;
  /** wide: breaks out to --wide. compact: native 480px art in a prose-width frame. */
  size: 'wide' | 'compact';
  /** Paragraph index (0-based) the figure follows. Defaults to the last one. */
  after?: number;
}

export interface Interest {
  id: string;
  title: string;
  tags: string[];
  body: string[];
  /** Only where the prose is about the drawing; every figure, these included,
   *  is also in the Gallery (data/gallery.ts). In reading order; always keep
   *  text between two figures. */
  figures?: InterestFigure[];
  /** Owner-facing note, never rendered. */
  todo?: string;
}

export interface NowItem {
  kind: string;
  text: string;
  /** Display date from cv.ts, e.g. "Feb 2026" or "2026". */
  since: string;
  /** Owner-facing note, never rendered. */
  todo?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Feb 2026" -> "2026-02", "2026" -> "2026", for <time datetime>. */
export function isoMonth(date: string): string | undefined {
  const m = date.match(/^(?:([A-Z][a-z]{2}) )?(\d{4})$/);
  if (!m) return undefined;
  const i = m[1] ? MONTHS.indexOf(m[1]) : -1;
  return i >= 0 ? `${m[2]}-${String(i + 1).padStart(2, '0')}` : m[2];
}

export const intro = {
  title: 'Interests',
  lede: 'Who I am, and the things I keep coming back to.',
};

const grad = research.find((r) => r.id === 'grad-research');
const fulbright = fellowships.find((f) => f.id === 'fulbright');
const ta = teaching.find((t) => t.id === 'ta-491');
const bsc = education.find((e) => e.id === 'bsc');
const tools = apps.map((a) => a.name);

// "Tracks: Energy and Process Systems Engineering, Artificial Intelligence"
const tracks = bsc?.bullets
  ?.find((b) => b.startsWith('Tracks:'))
  ?.replace('Tracks:', '')
  .split(',')
  .map((t) => t.trim());

/** "A, B and C" */
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export const currently: NowItem[] = [
  {
    kind: 'Research',
    text: 'M.Sc. research at Koç University, where catalysis meets machine learning and mathematical optimization.',
    since: grad?.start ?? '',
  },
  {
    kind: 'Fellowship',
    text: 'Fulbright PhD Scholarship candidate, for doctoral study in the United States from 2027.',
    since: fulbright?.start ?? '',
  },
  {
    kind: 'Teaching',
    text: 'Teaching assistant for CHBI 491 (Senior Design Project), leading sessions with senior teams on their capstone designs.',
    since: ta?.start ?? '',
  },
];

// The page reads as one line of thought: a plant as a system, then choosing
// its design (optimization), then choosing when the numbers are uncertain
// (stochastic models), then learning from data (ML, LLMs). Projects stay on
// /work; here they only appear as a link. Figures are numbered in page order.
export const interests: Interest[] = [
  {
    id: 'pse',
    title: 'Process systems engineering',
    tags: ['PSE', 'Modeling', 'Design', 'Control'],
    body: [
      '[Process systems engineering](https://www.cheme.engineering.cmu.edu/research/process-systems.html) looks at a plant as one connected system rather than a row of separate units: reactors, separators and heat exchangers, each with its own physics, tied together by streams, recycles and constraints. It asks for rigorous modeling and a practical decision at the same time.',
      'Separation is often where most of the energy goes, and even the order of the cuts is a design decision. A four-component feed can be split by three simple columns in five different sequences; the direct sequence, which takes the lightest component off the top first, is only one of them.',
      'Underneath every model is hardware that moves fluids and holds a setpoint. A control loop ends in a valve: the controller computes an opening, and a quarter turn of a ball sets how much of the line is open.',
      'Most of the plants I think about are energy systems in the end. The questions I keep returning to are where the heat goes, how much of it can be won back, and how to make the same product with less energy and fewer emissions.',
    ],
    figures: [
      {
        slug: 'process-flowsheet',
        n: 1,
        size: 'wide',
        after: 0,
        caption:
          'Process flowsheet: feed, catalytic reactor, cooler and flash separator, with recycle compressor and purge.',
      },
      {
        slug: 'distillation-sequence',
        n: 2,
        size: 'wide',
        after: 1,
        caption: 'Direct distillation sequence for a four-component feed: A | BCD, then B | CD, then C | D.',
      },
    ],
  },
  {
    id: 'optimization',
    title: 'Mathematical optimization',
    tags: ['MILP', 'Superstructures', 'Multi-objective'],
    body: [
      'Once a process can be written down, designing it becomes a question of choosing. Optimization makes the choice exact: variables, constraints and an objective, and a solver that searches a space far too large to try by hand. I like how much engineering judgment turns out to fit in that form.',
      'The discrete choices are what make it hard. Whether to build a unit at all is a yes-or-no variable, so a design problem becomes a mixed-integer program, and the solver has to reason about a lattice of integer points instead of a smooth region.',
      'A superstructure takes that to the whole flowsheet. It holds every candidate technology and every link between them, and the solver keeps only the ones worth building.',
      'Real objectives also pull against each other. Cost and emissions rarely fall together, so the useful answer is the whole curve of trade-offs, and a decision maker picks a point on it.',
    ],
    figures: [
      {
        slug: 'milp-lattice',
        n: 3,
        size: 'compact',
        after: 1,
        caption: 'Mixed-integer program: integer lattice, LP relaxation, a valid cut and the branch-and-bound tree.',
      },
      {
        slug: 'ptx-superstructure',
        n: 4,
        size: 'wide',
        after: 2,
        caption:
          'Superstructure optimization for a Power-to-X system: every candidate technology and link, with the selected design (y = 1) drawn solid.',
      },
      {
        slug: 'pareto-front',
        n: 5,
        size: 'wide',
        after: 3,
        caption: 'Cost versus emissions: candidate designs, the Pareto front, and solutions found with the ε-constraint method.',
      },
    ],
  },
  {
    id: 'stochastic',
    title: 'Stochastic models',
    tags: ['Uncertainty', 'Two-stage programs', 'MPC'],
    body: [
      'Optimization quietly assumes the numbers are known. They rarely are: renewable supply moves by the hour, prices and demand drift, and a plant designed for the average day can fail on the real one. Stochastic models put that randomness into the problem itself.',
      'My favourite form is the two-stage program. Fix the design now, let the operation adapt once each scenario plays out, and optimize the expected cost over all of them together. The value of doing so can be measured as the gap between the stochastic answer and the deterministic one. It was the core of my [undergraduate research](/work).',
      'The same idea carries into control. Model predictive control solves a small optimization at every step over a moving horizon, applies only the first move, and plans again once new measurements arrive, which is how it absorbs disturbances it could not predict.',
    ],
    figures: [
      {
        slug: 'stochastic-scenario-tree',
        n: 6,
        size: 'wide',
        after: 1,
        caption:
          'Two-stage stochastic program: one first-stage design x, scenarios ξₛ with probabilities pₛ, recourse yₛ, and the expected recourse cost.',
      },
      {
        slug: 'mpc-horizon',
        n: 7,
        size: 'wide',
        after: 2,
        caption:
          'Model predictive control: the prediction and control horizons at time k, the predicted output, and the first planned move that is applied.',
      },
    ],
  },
  {
    id: 'ml',
    title: 'Machine learning',
    tags: ['ML', 'Deep learning', 'PyTorch'],
    body: [
      'I came to machine learning from the computer engineering half of my degree and stayed because it changes the modeling question. Where a first-principles model is weak or too slow, a learned one can fill the gap, as long as it respects the physics and the constraints around it. Underneath almost all of it is one loop: follow the gradient of a loss downhill, a small step at a time.',
      'The simplest learners are still the clearest way to see what a model does. k-nearest neighbours has no training step at all: a new point takes the vote of the k closest examples, and the decision boundary is simply where that vote changes.',
      'Knowing how sure a model is matters as much as the prediction, which is where learning meets the stochastic side again. Conformal prediction wraps any forecaster in an interval with guaranteed coverage, built from nothing but its past errors.',
    ],
    figures: [
      {
        slug: 'gradient-descent',
        n: 8,
        size: 'compact',
        after: 0,
        caption: 'Gradient descent on a quadratic loss surface: iterates θₖ₊₁ = θₖ − η∇L(θₖ) converging to the minimum.',
      },
      {
        slug: 'knn-classifier',
        n: 9,
        size: 'wide',
        after: 1,
        caption: 'k-nearest-neighbour classification: three classes, the decision regions for k = 5, and one query’s vote.',
      },
      {
        slug: 'conformal-forecast',
        n: 10,
        size: 'wide',
        after: 2,
        caption:
          'Day-ahead forecast with a split-conformal interval: the band half-width is the calibrated quantile q̂ of past residuals.',
      },
    ],
  },
  {
    id: 'llms',
    title: 'Language models',
    tags: ['LLMs', 'Transformers', 'Agents'],
    body: [
      'Language models are the newest piece, and the one I use every day. Inside, a transformer is attention repeated many times: each token looks back at the ones before it and takes a weighted mix of what it finds.',
      'What interests me most is putting them to work on science, reading papers at scale and turning text into data that other models can use.',
    ],
    figures: [
      {
        slug: 'attention-head',
        n: 11,
        size: 'wide',
        after: 0,
        caption:
          'One causal self-attention head: queries, keys and values, the softmax(QKᵀ/√d) weights with the causal mask, and one output as a weighted sum.',
      },
    ],
  },
  {
    id: 'software',
    title: 'Building tools',
    tags: ['Swift', 'macOS', 'iOS', 'Product design'],
    body: [
      'Outside research I build the software I want to use, mostly for the Mac and iPhone in Swift, and I care as much about how it feels as about what it does.',
      `${tools.length ? `Right now that means ${list(tools)}. ` : ''}They are on the [work page](/work).`,
    ],
  },
  {
    id: 'generalist',
    title: 'Connecting fields',
    tags: ['Systems thinking', 'Generalist'],
    body: [
      'I studied chemical and biological engineering alongside computer engineering, and I want to be an interdisciplinary, architect-minded generalist who connects fields and turns ideas into well-designed systems.',
      tracks && tracks.length >= 2
        ? `My degree tracks were ${tracks[0]} on one side and ${tracks[1]} on the other, and this page sits between the two.`
        : 'This page sits between those fields.',
    ],
  },
];

export const closing = 'If any of this overlaps with what you’re working on, I’d be glad to hear from you.';

/**
 * Escape text, then turn [label](href) into links. Content is authored above,
 * never user input. Each link ends in a micro-icon (§8): ↗ when it leaves the
 * site (plus a new tab and a hidden "(opens in a new tab)"), → when it goes
 * to another page here. The last word and the icon never wrap apart.
 */
export function inlineLinks(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const external = /^https?:\/\//.test(href);
    const attrs = external ? ' target="_blank" rel="noopener"' : '';
    const sr = external ? '<span class="sr-only"> (opens in a new tab)</span>' : '';
    const icon = microSvg(external ? 'arrow-up-right' : 'arrow-right', { class: 'micro--inline link-icon' });
    const cut = label.lastIndexOf(' ') + 1;
    const text = `${label.slice(0, cut)}<span class="nowrap">${label.slice(cut)}${icon}</span>`;
    return `<a href="${href.replace(/"/g, '&quot;')}"${attrs}>${text}${sr}</a>`;
  });
}
