// Command-palette index. Built at build time from cv.ts + site.ts and
// serialized into every page by CommandPalette.astro (no fetch at runtime).
import {
  activities,
  bio,
  certificateLink,
  certificates,
  education,
  experience,
  fellowships,
  honors,
  person,
  publications,
  research,
  researchInterests,
  skills,
  socials,
  talks,
  teaching,
  type Entry,
} from './cv';
import { currently, interests } from './interests';
import { gallery, galleryIntro } from './gallery';
import { apps, appsIntro, projects, researchIntro, statusLabel } from './projects';
import { nav } from './site';
import type { MicroName } from '../lib/micro-icons';

export type GroupId = 'pages' | 'sections' | 'work' | 'cv' | 'actions' | 'links';

export const groups: { id: GroupId; label: string }[] = [
  { id: 'pages', label: 'Pages' },
  { id: 'sections', label: 'Sections' },
  { id: 'work', label: 'Projects & tools' },
  { id: 'cv', label: 'On the CV' },
  { id: 'actions', label: 'Actions' },
  { id: 'links', label: 'Links' },
];

/**
 * Every row leads with a micro-icon (src/lib/micro-icons.ts), which plays its
 * story when the row is selected; social rows use their brand glyph instead.
 */
export type BrandKey = 'github' | 'googlescholar' | 'linkedin' | 'x';
export type IconKey = MicroName | BrandKey;

export type ActionId = 'download-cv' | 'toggle-theme' | 'copy-email';

export interface PaletteItem {
  id: string;
  group: GroupId;
  title: string;
  subtitle?: string;
  /** Short right-aligned mono meta, e.g. a year. */
  meta?: string;
  /** Hidden search text: matched by word prefix / substring only. */
  keywords: string;
  icon: IconKey;
  href?: string;
  external?: boolean;
  action?: ActionId;
  /** Ranking nudge added to the match score. */
  boost: number;
  /** Shown when the query is empty. */
  suggested?: boolean;
}

// TODO(owner): point this at the site's repository once it is public.
// Until then "View source" opens the GitHub profile.
export const SOURCE_URL = 'https://github.com/kaanaltas';

// Page blurbs, keyed by path. Pages not listed here still get indexed from site.ts.
const pageInfo: Record<string, { title?: string; subtitle: string; icon: IconKey; keywords: string }> = {
  '/': {
    title: 'Home',
    subtitle: 'The front door',
    icon: 'home',
    keywords: `index start landing ${person.name} ${person.tagline}`,
  },
  '/interests': {
    subtitle: "What I'm curious about",
    icon: 'sparkle',
    keywords: [
      'about me bio curious ideas',
      ...researchInterests,
      'energy efficiency decarbonization sustainable energy systems product design generalist',
      bio.join(' '),
    ].join(' '),
  },
  '/work': {
    subtitle: 'Research projects and the tools I build',
    icon: 'layers',
    keywords: [
      'projects apps software ios macos swift research papers portfolio built side',
      researchIntro,
      appsIntro,
      projects.map((p) => p.title).join(' '),
      apps.map((a) => a.name).join(' '),
    ].join(' '),
  },
  '/gallery': {
    subtitle: 'Every drawing on the site',
    icon: 'compass',
    keywords: [
      'figures drawings illustrations diagrams technical engineering blueprint art grid zoom',
      galleryIntro.lede,
      gallery.map((f) => f.title).join(' '),
    ].join(' '),
  },
  '/cv': {
    subtitle: 'Education, research, experience, publications',
    icon: 'doc',
    keywords: 'resume résumé curriculum vitae experience education publications honors skills',
  },
};

const year = (s: string) => s.match(/\d{4}/)?.[0] ?? '';

/** "2026", "2024–2025", "2026–now". */
function span(start: string, end: string): string {
  const a = year(start);
  const b = end === 'Present' ? 'now' : year(end);
  if (!a) return b;
  if (!b || a === b) return a;
  return `${a}–${b}`;
}

const dates = (e: Entry) => (e.start === e.end ? e.start : `${e.start} – ${e.end}`) + (e.note === 'expected' ? ' (expected)' : '');
// Hidden search text: unique words only (matching is per word), minus filler.
const stop = new Set(
  'a an and are as at be by for from i in is it its my of on or than that the this to we with what who into over under'.split(' '),
);
const words = (...parts: (string | readonly string[] | undefined)[]) => {
  const seen = new Set<string>();
  for (const w of parts.flat().filter(Boolean).join(' ').split(/[\s,;:()“”"'.]+/)) {
    const k = w.toLowerCase();
    if (k && !stop.has(k)) seen.add(k);
  }
  return [...seen].join(' ');
};
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

export function buildIndex(): PaletteItem[] {
  const items: PaletteItem[] = [];

  // Pages ------------------------------------------------------------------
  const pages = [{ href: '/', label: 'Home' }, ...nav];
  for (const p of pages) {
    const info = pageInfo[p.href];
    items.push({
      id: `page-${p.href.replace(/\W+/g, '') || 'home'}`,
      group: 'pages',
      title: info?.title ?? p.label,
      subtitle: info?.subtitle,
      keywords: words('page', info?.keywords),
      icon: info?.icon ?? 'doc',
      href: p.href,
      boost: 4,
      suggested: true,
    });
  }

  // CV sections (ids agreed with the CV page) --------------------------------
  const allSkills = [...skills.programming, ...skills.tools, ...skills.languages.map((l) => l.name)];
  const sections: { id: string; title: string; subtitle: string; icon: IconKey; keywords: string }[] = [
    {
      id: 'education',
      title: 'Education',
      subtitle: uniq(education.map((e) => e.org)).join(', '),
      icon: 'cap',
      keywords: words('school degree university msc bsc masters bachelor gpa', education.map((e) => e.role), fellowships.map((f) => f.org)),
    },
    {
      id: 'research',
      title: 'Research experience',
      subtitle: uniq(research.map((e) => e.role)).join(', '),
      icon: 'flask',
      keywords: words('lab advisor', researchInterests, research.flatMap((e) => e.tags ?? [])),
    },
    {
      id: 'experience',
      title: 'Experience',
      subtitle: experience.map((e) => e.org).join(', '),
      icon: 'briefcase',
      keywords: words('work jobs industry internship', experience.map((e) => e.role), experience.flatMap((e) => e.tags ?? [])),
    },
    {
      id: 'publications',
      title: 'Publications',
      subtitle: publications.map((p) => p.venue).join(', '),
      icon: 'book',
      keywords: words('papers journal articles doi', publications.map((p) => p.title)),
    },
    {
      id: 'talks',
      title: 'Talks',
      subtitle: talks.map((t) => t.venue.split(',')[0]).join(', '),
      icon: 'mic',
      keywords: words('conference presentations oral', talks.map((t) => t.title)),
    },
    {
      id: 'teaching',
      title: 'Teaching & service',
      subtitle: teaching.map((t) => t.role.split(',')[0]).join(', '),
      icon: 'board',
      keywords: words('ta teaching assistant service mentoring', teaching.map((t) => t.role)),
    },
    {
      id: 'activities',
      title: 'Activities',
      subtitle: activities.map((a) => a.org.split(',')[0]).join(', '),
      icon: 'calendar',
      keywords: words('summer school webinar volunteer', activities.map((a) => a.role), activities.flatMap((a) => a.tags ?? [])),
    },
    {
      id: 'honors',
      title: 'Honors & awards',
      // "1st Prize, Venture Sprint: ETH Zurich …" alone would read "1st Prize".
      subtitle: honors.map((h) => (h.id === 'minerva-prize' ? 'ETH Zurich Venture Sprint 1st Prize' : h.title)).join(', '),
      icon: 'trophy',
      keywords: words('prizes awards scholarships fellowship', honors.map((h) => h.title)),
    },
    {
      id: 'skills',
      title: 'Skills',
      subtitle: [...skills.programming.slice(0, 3), ...skills.tools.slice(0, 2)].join(', ') + ', and more',
      icon: 'code',
      keywords: words('programming tools software stack coding', allSkills),
    },
    {
      id: 'languages',
      title: 'Languages',
      subtitle: skills.languages.map((l) => l.name).join(', '),
      icon: 'chat',
      keywords: words('spoken languages ielts', skills.languages.map((l) => `${l.name} ${l.level}`)),
    },
    {
      id: 'certificates',
      title: 'Certificates',
      subtitle: certificates.map((c) => c.title.split(':')[0]).join(', '),
      icon: 'badge',
      keywords: words('certificate certification course google coursera', certificates.map((c) => c.title)),
    },
  ];
  for (const s of sections) {
    items.push({
      id: `section-${s.id}`,
      group: 'sections',
      title: s.title,
      subtitle: s.subtitle,
      meta: 'CV',
      keywords: words('cv section', s.keywords),
      icon: s.icon,
      href: `/cv#${s.id}`,
      boost: 2,
    });
  }

  // Interests page sections ---------------------------------------------------
  // Interest sections keep their own meaning; anything new falls back to the
  // Interests page's sparkle.
  const interestIcon: Record<string, IconKey> = {
    pse: 'flask',
    uncertainty: 'sliders',
    energy: 'bolt',
    ml: 'sparkle',
    software: 'code',
    generalist: 'globe',
  };
  const plain = (t: string) => t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  items.push({
    id: 'interests-now',
    group: 'sections',
    title: 'Currently',
    subtitle: currently.map((c) => c.kind).join(', '),
    meta: 'Interests',
    keywords: words('now these days at the moment current', currently.map((c) => plain(c.text))),
    icon: 'sparkle',
    href: '/interests#now-title',
    boost: 2,
  });
  for (const it of interests) {
    items.push({
      id: `interests-${it.id}`,
      group: 'sections',
      title: it.title,
      subtitle: it.tags.join(', '),
      meta: 'Interests',
      keywords: words('interest', it.tags, it.body.map(plain)),
      icon: interestIcon[it.id] ?? 'sparkle',
      href: `/interests#${it.id}`,
      boost: 2.5,
    });
  }

  // Gallery: every figure, by its short name; the caption is the subtitle.
  for (const f of gallery) {
    items.push({
      id: `gallery-${f.slug}`,
      group: 'sections',
      title: f.title,
      subtitle: f.caption,
      meta: 'Gallery',
      keywords: words('figure drawing illustration diagram', f.slug.replace(/-/g, ' '), f.caption),
      icon: 'compass',
      href: `/gallery#${f.slug}`,
      boost: 1,
    });
  }

  // Work page ----------------------------------------------------------------
  items.push(
    {
      id: 'work-research',
      group: 'sections',
      title: 'Research & projects',
      subtitle: projects.map((p) => p.title).join(', '),
      meta: 'Work',
      keywords: words('work projects research', researchIntro, projects.flatMap((p) => p.tags)),
      icon: 'layers',
      href: '/work#research-title',
      boost: 2.5,
    },
    {
      id: 'work-apps',
      group: 'sections',
      title: 'Tools',
      subtitle: apps.map((a) => a.name).join(', '),
      meta: 'Work',
      keywords: words('tools apps applications software swift swiftui ios macos watchos iphone mac app store', appsIntro),
      icon: 'phone',
      href: '/work#apps-title',
      boost: 2.5,
    },
  );
  for (const p of projects) {
    const external = !!p.href && /^https?:/.test(p.href);
    items.push({
      id: `work-project-${p.id}`,
      group: 'work',
      title: p.title,
      subtitle: p.blurb,
      meta: p.when || statusLabel[p.status],
      keywords: words('project', p.tags, statusLabel[p.status], p.meta, p.highlight),
      icon: 'layers',
      href: p.href ?? '/work#research-title',
      external,
      boost: p.highlight ? 2 : 1,
    });
  }
  for (const a of apps) {
    items.push({
      id: `work-app-${a.id}`,
      group: 'work',
      title: a.name,
      subtitle: a.blurb,
      meta: statusLabel[a.status],
      keywords: words('app application', a.platforms, a.platforms.includes('iOS') ? 'iphone ipad' : 'mac', a.meta, statusLabel[a.status]),
      icon: a.platforms.includes('macOS') ? 'window' : 'phone',
      href: `/work#app-${a.id}`,
      boost: 2,
    });
  }

  // Individual CV entries (the CV page gives each row its data id as anchor) ----------------------------------------------------
  const entry = (e: Entry, section: string, icon: IconKey, title: string, subtitle: string, boost = 0) =>
    items.push({
      id: `cv-${section}-${e.id}`,
      group: 'cv',
      title,
      subtitle,
      meta: span(e.start, e.end),
      keywords: words(section, e.org, e.role, e.place, e.note, e.highlight, e.tags, e.bullets),
      icon,
      href: `/cv#${e.id}`,
      boost,
    });

  for (const e of education) entry(e, 'education', 'cap', e.role, `${e.org} · ${dates(e)}`);
  for (const e of research) entry(e, 'research', 'flask', e.role, `${e.org.split(',')[0]} · ${dates(e)}`);
  for (const e of experience) entry(e, 'experience', 'briefcase', e.org, `${e.role} · ${dates(e)}`);
  for (const e of teaching) entry(e, 'teaching', 'board', e.role, `${e.org.split(',')[0]} · ${dates(e)}`);
  for (const e of activities) {
    const short = e.role.split(/[“:]/)[0].replace(/,\s*$/, '').trim();
    entry(e, 'activities', 'calendar', e.org, [e.highlight ?? short, dates(e)].join(' · '), e.highlight ? 1 : 0);
  }

  for (const p of publications) {
    items.push({
      id: `cv-publications-${p.id}`,
      group: 'cv',
      title: p.title,
      subtitle: `${p.venue} · ${p.year}`,
      meta: String(p.year),
      keywords: words('publication paper journal article', p.authors, p.venue, p.details, p.doi),
      icon: 'book',
      href: `/cv#${p.id}`,
      boost: 1.5,
    });
  }

  for (const t of talks) {
    items.push({
      id: `cv-talks-${t.id}`,
      group: 'cv',
      title: t.title,
      subtitle: `${t.venue.split(',')[0]} · ${t.details.split('·').slice(0, 2).join('·').trim()}`,
      meta: String(t.year),
      keywords: words('talk presentation conference oral', t.authors, t.venue, t.details),
      icon: 'mic',
      href: `/cv#${t.id}`,
      boost: 1,
    });
  }

  for (const h of honors) {
    items.push({
      id: `cv-honors-${h.id}`,
      group: 'cv',
      title: h.badge ? `${h.badge}, ${h.title}` : h.title,
      // One-line row: drop the sentence's closing period.
      subtitle: h.detail?.replace(/\.$/, ''),
      meta: /^\d{4}$/.test(h.when) ? h.when : undefined,
      keywords: words(
        'honor award prize',
        h.detail,
        h.when,
        h.id === 'minerva-prize' ? 'minerva winner first 1st place eth zurich esa european space agency heilbronn venture sprint remote sensing' : '',
        h.id === 'fulbright' ? 'fellowship grant usa' : '',
      ),
      icon: 'trophy',
      href: `/cv#honor-${h.id}`,
      boost: h.featured ? 2 : 0.5,
    });
  }

  // Certificates: the row on the CV, plus the certificate itself once linked.
  for (const c of certificates) {
    const link = certificateLink(c);
    items.push({
      id: `cv-certificates-${c.id}`,
      group: 'cv',
      title: c.title,
      subtitle: `${c.issuer} · ${c.platform}`,
      keywords: words('certificate certification course credential', c.issuer, c.platform, c.id.replace(/-/g, ' ')),
      icon: 'badge',
      href: `/cv#cert-${c.id}`,
      boost: 0.5,
    });
    if (link) {
      items.push({
        id: `link-certificate-${c.id}`,
        group: 'links',
        title: 'View certificate',
        subtitle: c.title,
        keywords: words('certificate credential verify pdf', c.issuer, c.platform, c.title),
        icon: 'badge',
        href: link,
        external: true,
        boost: 0.5,
      });
    }
  }

  // Actions ------------------------------------------------------------------
  items.push(
    {
      id: 'action-download-cv',
      group: 'actions',
      title: 'Download CV',
      // No page count here: the PDF in /public is two pages today and may change.
      subtitle: 'To save or print',
      meta: 'PDF',
      keywords: 'download save pdf resume résumé curriculum vitae print',
      icon: 'download',
      action: 'download-cv',
      boost: 3,
      suggested: true,
    },
    {
      id: 'action-copy-email',
      group: 'actions',
      title: 'Copy email',
      subtitle: person.email,
      keywords: 'copy email address contact clipboard mail reach',
      icon: 'copy',
      action: 'copy-email',
      boost: 3,
      suggested: true,
    },
    {
      id: 'action-toggle-theme',
      group: 'actions',
      title: 'Toggle theme',
      subtitle: 'Light or dark',
      keywords: 'theme dark light mode appearance toggle switch night colors',
      icon: 'theme',
      action: 'toggle-theme',
      boost: 3,
      suggested: true,
    },
    {
      id: 'action-view-source',
      group: 'actions',
      title: 'View source',
      subtitle: SOURCE_URL.replace(/^https?:\/\//, ''),
      keywords: 'source code github repository repo how built astro',
      icon: 'code',
      href: SOURCE_URL,
      external: true,
      boost: 2,
      suggested: true,
    },
  );

  // Links --------------------------------------------------------------------
  for (const s of socials) {
    items.push({
      id: `link-${s.id}`,
      group: 'links',
      title: s.label,
      subtitle: s.handle,
      keywords: words('social profile', s.id, s.href.replace(/^https?:\/\//, ''), s.id === 'x' ? 'twitter' : '', s.id === 'scholar' ? 'citations papers' : ''),
      icon: s.icon,
      href: s.href,
      external: true,
      boost: 2.5,
      suggested: true,
    });
  }
  items.push({
    id: 'link-email',
    group: 'links',
    title: 'Email me',
    subtitle: person.email,
    keywords: 'email mail contact write message reach hello',
    icon: 'mail',
    href: `mailto:${person.email}`,
    boost: 2.5,
    suggested: true,
  });
  for (const p of publications) {
    if (!p.href) continue;
    items.push({
      id: `link-doi-${p.id}`,
      group: 'links',
      title: 'Read the paper',
      subtitle: `doi.org/${p.doi}`,
      keywords: words('doi paper publication article read full text journal', p.title, p.venue),
      icon: 'book',
      href: p.href,
      external: true,
      boost: 1,
    });
  }

  return items;
}
