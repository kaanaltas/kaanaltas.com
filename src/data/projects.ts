// Content for /work. Facts come from ./cv.ts (imported where possible so
// dates and links stay in sync), docs/research/profiles.json (GitHub and
// Scholar), and the READMEs of the project repos. Anything not backed by
// those sources is left as a `todo` note, which is never rendered.

import { activities, experience, honors, publications, research, talks } from './cv';

export type Status =
  | 'published'
  | 'active'
  | 'won'
  | 'awarded'
  | 'open-source'
  | 'done'
  | 'building'
  | 'planned';

/** Short, clear status words (heyderekj-style). */
export const statusLabel: Record<Status, string> = {
  published: 'Published',
  active: 'Active',
  won: 'Won',
  awarded: 'Awarded',
  'open-source': 'Open source',
  done: 'Done',
  building: 'Building',
  planned: 'Planned',
};

export interface ProjectLink {
  label: string;
  /** Omitted when the link is not known yet (see `todo`). */
  href?: string;
  /** Small mono note shown when there is no href, e.g. "soon". */
  note?: string;
}

export interface Project {
  id: string;
  title: string;
  /** One or two plain sentences, first person where it fits. */
  blurb: string;
  tags: string[];
  status: Status;
  /** Year or range, mono tabular. Empty when unknown. */
  when: string;
  /** The whole row links here. */
  href?: string;
  /** Small context line under the blurb, e.g. venue. */
  meta?: string;
  /** Links appended to the meta line, e.g. the conference a talk was given
   *  at. The row's own link then moves onto the title, stretched over the
   *  row, so the two links never nest. */
  metaLinks?: ProjectLink[];
  /** A win worth a quiet badge. */
  highlight?: string;
  /** A technical figure shown under the row (numbered in page order). */
  figure?: ProjectFigure;
  /** Owner-facing note, never rendered. */
  todo?: string;
}

export interface ProjectFigure {
  /** src/figures/<slug>.svg */
  slug: string;
  caption: string;
  size?: 'wide' | 'compact';
}

export type Platform = 'macOS' | 'iOS' | 'watchOS';

export interface App {
  id: string;
  name: string;
  blurb: string;
  platforms: Platform[];
  status: Status;
  /** Which icon to show (src/assets/apps). */
  icon: 'snaplayouts' | 'seemantic' | 'monix' | 'quotlas';
  /** Extra mono facts, e.g. system requirement. */
  meta?: string;
  store: ProjectLink;
  todo?: string;
}

const paper = publications.find((p) => p.id === 'ijhe-2026');
const talk = talks.find((t) => t.id === 'mackie-2025');
const grad = research.find((r) => r.id === 'grad-research');
const eth = activities.find((a) => a.id === 'eth-beyond-visible');
const hyundai = experience.find((e) => e.id === 'hyundai');
const ammonia = honors.find((h) => h.id === 'sustainability-award');

// Koç University news story on the award (27 June 2025).
const ammoniaNews =
  'https://www.ku.edu.tr/engineering-the-future-green-ammonia-project-wins-kuos-sustainability-award/';

const year = (s?: string) => s?.match(/\d{4}/)?.[0] ?? '';

export const intro = {
  title: 'Work',
  lede: 'Research projects, from optimization models to machine learning, and the tools I build on the side.',
};

export const researchIntro =
  'Optimization and machine learning for energy and chemical systems.';

export const appsIntro = 'Tools for the Mac and iPhone, mostly built because I wanted them myself. None is out yet.';

export const projects: Project[] = [
  {
    id: 'wef-nexus',
    // Word joiners (U+2060) keep “water–energy–food” from breaking at the dashes.
    title: 'Hydrogen in the water–\u2060energy–\u2060food nexus',
    blurb:
      'A two-stage stochastic MILP that chooses and sizes a Power-to-X plant, then runs it hour by hour under uncertain renewables. Planning for that uncertainty is worth $12.9M a year over a deterministic design.',
    tags: ['Stochastic MILP', 'Power-to-X', 'Hydrogen', 'Gurobi'],
    status: 'published',
    when: String(paper?.year ?? '2026'),
    href: paper?.href,
    meta: paper?.venue,
    metaLinks: talk ? [{ label: `Talk at ${talk.venue.split(',')[0]}`, href: talk.href }] : undefined,
  },
  {
    id: 'catalysis-ml',
    title: 'Catalysis, machine learning and optimization',
    blurb:
      'My M.Sc. research, where catalyst performance meets machine learning and mathematical optimization: learned models of how catalysts behave, used inside process decisions.',
    tags: ['Catalysis', 'Machine learning', 'Optimization'],
    status: 'active',
    when: `${year(grad?.start) || '2026'}–`,
  },
  {
    id: 'minerva',
    title: 'MINERVA',
    blurb:
      'Mine Identification and Evaluation via Remote Vision Analytics: remote sensing and computer vision to find and assess mines. Co-built at ETH Zurich’s “Beyond the Visible” summer school; the team was invited to Zurich by ESA.',
    tags: eth?.tags ?? ['Remote sensing', 'Computer vision', 'Earth observation'],
    status: 'won',
    when: year(eth?.start) || '2026',
    highlight: eth?.highlight ?? '1st Prize · Venture Sprint',
  },
  {
    id: 'forewatt',
    title: 'ForeWatt',
    blurb:
      'Electricity demand forecasting on Turkish (EPİAŞ) and US (PJM) grid data with N-HiTS and PatchTST, conformal intervals for the uncertainty, anomaly detection, and EV load shifting on top.',
    tags: ['Time series', 'Conformal prediction', 'Anomaly detection', 'Optimization'],
    status: 'open-source',
    when: '2025–26',
    href: 'https://github.com/kaanaltas/ForeWatt',
  },
  {
    id: 'green-ammonia',
    title: 'Green ammonia production',
    blurb:
      'Our senior design project: a carbon-free ammonia plant run on its own wind and solar farm, with water electrolysis, air separation, hydrogen storage and an optimized Haber–\u2060Bosch loop. It won the first KUOS Sustainability Award for engineering graduation projects.',
    tags: ['Process design', 'Haber–Bosch', 'Electrolysis', 'Decarbonization'],
    status: 'awarded',
    when: ammonia?.when || '2025',
    highlight: 'Winner · KUOS Sustainability Award',
    href: ammoniaNews,
    meta: 'Senior design project, Koç University · team of five, advised by Asst. Prof. Erdal Aydın',
  },
  {
    id: 'paint-changeover',
    title: 'Fewer paint changeovers at Hyundai',
    blurb:
      'A summer with IT, chemical and industrial engineers on a PyTorch model and a Gurobi optimization that cut paint color changeovers under real production constraints.',
    tags: hyundai?.tags ?? ['PyTorch', 'Gurobi', 'Scheduling'],
    status: 'done',
    when: year(hyundai?.start) || '2024',
    meta: hyundai ? `${hyundai.role} · ${hyundai.org}` : undefined,
  },
];

export const apps: App[] = [
  {
    id: 'snaplayouts',
    name: 'SnapLayouts',
    blurb:
      'Windows 11-style snap layouts for the Mac. Drag a window to the top of the screen, drop it on a zone, and Snap Assist offers your other windows for the rest.',
    platforms: ['macOS'],
    status: 'building',
    icon: 'snaplayouts',
    meta: 'SwiftUI · Liquid Glass · macOS 26+',
    store: { label: 'App Store', note: 'soon' },
  },
  {
    id: 'seemantic',
    name: 'Seemantic',
    blurb:
      'A study and research companion for papers. Read with dark and sepia themes, keep highlights in sync with Zotero, and lasso a figure or an equation to ask about it, using the AI subscriptions you already have.',
    platforms: ['macOS'],
    status: 'building',
    icon: 'seemantic',
    meta: 'SwiftUI · PDFKit · macOS 27+',
    store: { label: 'Download', note: 'soon' },
  },
  {
    id: 'monix',
    name: 'Monix',
    blurb:
      'A menu bar utility for every connected display: brightness over DDC/CI or by dimming, volume, input source, every resolution and HiDPI mode, refresh rate, rotation and HDR, with a Liquid Glass level indicator. LG monitors without DDC/CI are controlled over the network.',
    platforms: ['macOS'],
    status: 'building',
    icon: 'monix',
    meta: 'SwiftUI · AppKit · macOS 26+',
    store: { label: 'Download', note: 'soon' },
  },
  {
    id: 'quotlas',
    name: 'Quotlas',
    blurb:
      'Sourced quotes from science, film, music, literature and philosophy, connected into a graph. Start from Feynman and a few cards later you are reading Tarkovsky, each card saying how you got there. Fully on device, no account.',
    platforms: ['iOS', 'watchOS'],
    status: 'building',
    icon: 'quotlas',
    meta: 'SwiftUI · WidgetKit · SQLite',
    store: { label: 'App Store', note: 'soon' },
  },
];
