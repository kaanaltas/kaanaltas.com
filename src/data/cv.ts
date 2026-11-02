// Single source of truth for CV content. The /cv page, the command palette
// index and structured data all read from here.

export type LogoKey =
  | 'koc'
  | 'fulbright'
  | 'climalign'
  | 'hyundai'
  | 'tupras'
  | 'eth'
  | 'mackie'
  | 'kfl'
  | 'google'
  | 'deeplearningai';

export interface Entry {
  id: string;
  org: string;
  role: string;
  logo?: LogoKey;
  start: string;
  end: string;
  place?: string;
  note?: string;
  bullets?: string[];
  tags?: string[];
  highlight?: string;
  href?: string;
}

export const person = {
  name: 'Kaan Altaş',
  givenName: 'Kaan',
  email: 'kaanaltas10@gmail.com',
  tagline:
    'Researcher in process systems engineering, working on optimization, machine learning and AI for complex engineering systems.',
  /** The one first-person landing sentence. */
  intro: 'I work on optimization and machine learning for chemical and energy systems, as a researcher in process systems engineering at Koç University.',
  location: 'İstanbul, Türkiye',
  affiliation: 'Koç University',
  cvPdf: '/cv-kaan-altas.pdf',
};

export const bio = [
  "I'm a systems thinker and researcher in process systems engineering, focusing on optimization, machine learning, and AI for complex engineering systems. My interests lie in developing data-driven and decision-making methods that connect rigorous modeling with practical applications. I'm also interested in energy efficiency, industrial decarbonization, and sustainable energy systems, and alongside my research I work part-time in sustainability consulting, on energy efficiency assessments, emissions calculations and technical reporting.",
  "I also enjoy building software, especially for iOS and macOS, and exploring ideas across engineering, computing, and product design. More broadly, I'm interested in becoming an interdisciplinary, architect-minded generalist who can connect different fields and turn ideas into well-designed systems.",
];

export type SocialIcon = 'github' | 'googlescholar' | 'linkedin' | 'x';

export interface Social {
  id: string;
  icon: SocialIcon;
  label: string;
  /** Compact label for tight rows (e.g. "Scholar"). Falls back to `label`. */
  short?: string;
  handle: string;
  href: string;
}

export const socials: readonly Social[] = [
  { id: 'github', icon: 'github', label: 'GitHub', handle: 'kaanaltas', href: 'https://github.com/kaanaltas' },
  { id: 'scholar', icon: 'googlescholar', label: 'Google Scholar', short: 'Scholar', handle: 'Kaan Altaş', href: 'https://scholar.google.com/citations?hl=en&user=vBHelK8AAAAJ' },
  { id: 'linkedin', icon: 'linkedin', label: 'LinkedIn', handle: 'kaanaltas', href: 'https://www.linkedin.com/in/kaanaltas/' },
  { id: 'x', icon: 'x', label: 'X', handle: '@kaanaltas14', href: 'https://x.com/kaanaltas14' },
];

export const fellowships: Entry[] = [
  {
    id: 'fulbright',
    org: 'Fulbright Commission in Türkiye',
    role: 'Fulbright PhD Scholarship Candidate, 2027–2028',
    logo: 'fulbright',
    start: 'Aug 2026',
    end: 'Present',
  },
];

export const education: Entry[] = [
  {
    id: 'msc',
    org: 'Koç University',
    role: 'M.Sc. in Chemical & Biological Engineering',
    logo: 'koc',
    start: 'Feb 2026',
    end: 'Feb 2027',
    note: 'expected',
    place: 'İstanbul, Türkiye',
    bullets: ['Advisors: Prof. Alper Uzun, Assoc. Prof. Erdal Aydın'],
  },
  {
    id: 'bsc',
    org: 'Koç University',
    role: 'B.Sc. in Chemical & Biological Engineering and Computer Engineering (Double Major)',
    logo: 'koc',
    start: 'Sep 2021',
    end: 'Feb 2026',
    place: 'İstanbul, Türkiye',
    bullets: ['Magna Cum Laude', 'Tracks: Energy and Process Systems Engineering, Artificial Intelligence'],
  },
  {
    id: 'highschool',
    org: 'Kocaeli Science High School',
    role: 'High school',
    logo: 'kfl',
    start: 'Sep 2017',
    end: 'Jun 2021',
    place: 'Kocaeli, Türkiye',
  },
];

export const researchInterests = [
  'Process Systems Engineering',
  'Stochastic Optimization',
  'Mixed-Integer Programming',
  'Machine Learning',
  'Deep Learning',
  'Large Language Models',
  'Energy Systems Design & Control',
];

export const research: Entry[] = [
  {
    id: 'grad-research',
    org: 'Koç University, Chemical & Biological Engineering',
    role: 'Graduate Researcher',
    logo: 'koc',
    start: 'Feb 2026',
    end: 'Present',
    place: 'İstanbul, Türkiye',
    note: 'Advisors: Prof. Alper Uzun, Assoc. Prof. Erdal Aydın',
    bullets: [
      'Research at the intersection of catalysis, machine learning and mathematical optimization.',
      'Machine learning models that link catalyst design to catalyst performance, brought into optimization-based process decisions.',
    ],
    tags: ['Catalysis', 'Machine learning', 'Optimization'],
  },
  {
    id: 'ug-research',
    org: 'Koç University, Chemical & Biological Engineering',
    role: 'Undergraduate Researcher',
    logo: 'koc',
    start: 'Oct 2024',
    end: 'Feb 2026',
    place: 'İstanbul, Türkiye',
    note: 'Advisor: Assoc. Prof. Erdal Aydın',
    bullets: [
      'Two-stage stochastic MILP models for Power-to-X systems that integrate renewable energy with water–food–energy nexus considerations.',
      'Uncertainty modeling of renewable-energy-driven production systems.',
      'The work became a first-author paper in the International Journal of Hydrogen Energy (2026).',
    ],
    tags: ['Stochastic MILP', 'Power-to-X', 'WEF nexus'],
  },
];

export const experience: Entry[] = [
  {
    id: 'climalign',
    org: 'ClimAlign',
    role: 'Project Assistant (part-time)',
    logo: 'climalign',
    start: 'Jul 2025',
    end: 'Present',
    place: 'İstanbul, Türkiye',
    bullets: [
      'Calculation tools for emissions, energy use and financed-emissions assessments.',
      'Reviewing energy efficiency audits and compiling the findings into comprehensive technical reports and seminar materials.',
      'Technical sections of tender proposals for international financial institutions.',
      'Reviewing sector guidelines and assessment tools for completeness and consistency across sectors.',
    ],
    tags: ['Energy efficiency', 'GHG accounting', 'Climate finance'],
  },
  {
    id: 'hyundai',
    org: 'Hyundai Assan Otomotiv',
    role: 'Production IT Intern',
    logo: 'hyundai',
    start: 'Jul 2024',
    end: 'Aug 2024',
    place: 'Kocaeli, Türkiye',
    bullets: [
      'Combined a PyTorch model with Gurobi optimization to sequence car bodies and cut paint color changeovers.',
      'Worked with IT, chemical and industrial engineers on production planning data.',
    ],
    tags: ['PyTorch', 'Gurobi', 'Scheduling'],
  },
  {
    id: 'tupras',
    org: 'Tüpraş',
    role: 'Process Engineering Intern',
    logo: 'tupras',
    start: 'Aug 2023',
    end: 'Sep 2023',
    place: 'Kocaeli, Türkiye',
    bullets: [
      'Studied the crude distillation and product separation units at the İzmit refinery, following how feed, operating conditions and energy use connect across the units.',
      'Took part in daily operations with the process engineers, with hands-on experience of plant equipment and unit performance data.',
    ],
    tags: ['Distillation', 'Refining'],
  },
];

export const publications = [
  {
    id: 'ijhe-2026',
    authors: ['Kaan Altaş', 'B.K. Tekkeşin', 'E. Aydın', 'M. Türkay'],
    title: 'Design & Optimization of a Hydrogen Integrated Water–Energy–Food Nexus Under Uncertainty',
    venue: 'International Journal of Hydrogen Energy',
    details: 'vol. 252, 2026, art. 156061',
    year: 2026,
    doi: '10.1016/j.ijhydene.2026.156061',
    href: 'https://doi.org/10.1016/j.ijhydene.2026.156061',
  },
];

export const talks = [
  {
    id: 'mackie-2025',
    authors: ['Kaan Altaş', 'B.K. Tekkeşin', 'E. Aydın'],
    title: 'Stochastic Optimization of Water–Energy Networks with Renewable Energy Integration',
    venue: 'MaCKiE 2025, International Conference on Mathematics in (Bio/Food) Chemical Kinetics and Engineering',
    details: 'İzmir, Türkiye · September 2025 · Oral presentation',
    year: 2025,
    href: 'http://www.mackieturkey.com/',
    logo: 'mackie' as LogoKey,
  },
];

export const teaching: Entry[] = [
  {
    id: 'ta-491',
    org: 'Koç University, Chemical & Biological Engineering',
    role: 'Teaching Assistant, CHBI 491: Senior Design Project',
    logo: 'koc',
    start: 'Feb 2026',
    end: 'Present',
    place: 'İstanbul, Türkiye',
    bullets: [
      'Lead regular sessions with senior capstone teams and guide their process design projects through to the final report.',
      'Feedback on their technical work, reports and presentations, and grading of the deliverables.',
    ],
  },
  {
    id: 'student-rep',
    org: 'Chemical & Biological Engineering Department',
    role: 'Student Representative',
    logo: 'koc',
    start: '2024',
    end: '2025',
    bullets: [
      'Bridge between students and faculty on academic and administrative concerns.',
      'Worked with faculty and department heads on course structure and student engagement.',
    ],
  },
];

export const activities: Entry[] = [
  {
    id: 'eth-beyond-visible',
    org: 'ETH Zurich, Campus Heilbronn',
    role: 'International Summer School “Beyond the Visible”: AI, Sensing, and the Future of Terrestrial Resources',
    logo: 'eth',
    start: '2026',
    end: '2026',
    place: 'Heilbronn, Germany',
    highlight: '1st Prize · Venture Sprint',
    bullets: [
      'Co-built MINERVA (Mine Identification and Evaluation via Remote Vision Analytics), which uses remote sensing and computer vision to identify and evaluate mines.',
      'MINERVA won 1st prize in the Venture Sprint; the team was invited to Zurich by the European Space Agency (ESA) to discuss funding and implementation.',
    ],
    tags: ['Remote sensing', 'Computer vision', 'Earth observation'],
  },
  {
    id: 'ai-lab',
    org: 'Koç University, Artificial Intelligence Laboratory',
    role: 'Data Annotator (volunteer), under Prof. Deniz Yüret',
    logo: 'koc',
    start: 'May 2024',
    end: 'Sep 2024',
    bullets: ['English-to-Turkish prompt translation and evaluation in Label Studio for Turkish LLM benchmarks.'],
  },
];

export interface Honor {
  id: string;
  title: string;
  /** Optional one-line detail; omitted when it would only repeat the title. */
  detail?: string;
  when: string;
  featured?: boolean;
  /** Organisation mark shown in the logo column (same tile as the timeline rows). */
  logo?: LogoKey;
  /** A public write-up, e.g. the university's news story. */
  href?: string;
  /** Placing, shown as the blue pixel-trophy badge above the title. */
  badge?: string;
}

export const honors: Honor[] = [
  {
    id: 'minerva-prize',
    title: 'Venture Sprint: ETH Zurich “Beyond the Visible”',
    badge: '1st Prize',
    logo: 'eth',
    detail: 'An ETH Zurich summer school on AI, remote sensing and Earth observation. Our team built MINERVA, which uses drone and satellite imagery with computer vision to find and assess landmines for humanitarian demining; ESA invited the team to Zurich to discuss next steps.',
    when: '2026',
    featured: true,
  },
  {
    id: 'fulbright',
    title: 'Fulbright PhD Scholarship Candidate, 2027–2028',
    logo: 'fulbright',
    detail: 'Selected as a candidate for the Fulbright Türkiye PhD Scholarship, for doctoral study in the United States starting in the 2027–2028 academic year.',
    when: '2026',
    featured: true,
  },
  {
    id: 'sustainability-award',
    title: 'Koç University Office of Sustainability Award',
    badge: 'Winner',
    logo: 'koc',
    detail: 'Inaugural award for engineering graduation projects, for our senior design project on a renewable-powered green ammonia plant with no direct CO₂ emissions.',
    when: '2025',
    href: 'https://www.ku.edu.tr/engineering-the-future-green-ammonia-project-wins-kuos-sustainability-award/',
  },
  {
    id: 'vehbi-koc',
    title: 'Vehbi Koç Scholar',
    logo: 'koc',
    detail: 'Semester GPA of 3.75 or higher.',
    when: 'Multiple semesters',
  },
  {
    id: 'deans-list',
    title: "Dean's Honor Roll",
    logo: 'koc',
    detail: 'Semester GPA of 3.3 or higher.',
    when: 'Multiple semesters',
  },
];

export const skills = {
  programming: ['Python', 'C', 'C#', 'C++', 'Java', 'JavaScript', 'TypeScript', 'Swift', 'LaTeX', 'Assembly', 'Shell'],
  tools: ['Gurobi', 'PyTorch', 'TensorFlow', 'Aspen HYSYS', 'Microsoft Office'],
  languages: [
    { name: 'Turkish', level: 'native' },
    { name: 'English', level: 'fluent · IELTS Academic 7.0' },
    { name: 'German', level: 'beginner' },
  ],
};

export interface Certificate {
  id: string;
  title: string;
  issuer: 'Google' | 'DeepLearning.AI';
  logo: LogoKey;
  platform: 'Coursera';
  /** Month and year it was earned, e.g. 'Oct 2026'. */
  issued: string;
  /** Coursera certificate URL (e.g. https://www.coursera.org/account/accomplishments/...). */
  href?: string;
  /** Optional PDF in /public/certificates/, e.g. '/certificates/google-project-management.pdf'. Used when href is empty. */
  pdf?: string;
}

export const certificates: Certificate[] = [
  {
    id: 'deep-learning',
    title: 'Deep Learning Specialization',
    issuer: 'DeepLearning.AI',
    logo: 'deeplearningai',
    platform: 'Coursera',
    issued: 'Oct 2026',
    href: 'https://www.coursera.org/account/accomplishments/specialization/certificate/8IH487EX8P7M',
  },
  {
    id: 'machine-learning',
    title: 'Machine Learning Specialization',
    issuer: 'DeepLearning.AI',
    logo: 'deeplearningai',
    platform: 'Coursera',
    issued: 'Oct 2026',
    href: 'https://www.coursera.org/account/accomplishments/specialization/certificate/2PIWZGJ8E02B',
  },
  {
    id: 'google-advanced-data-analytics',
    title: 'Google Advanced Data Analytics Specialization',
    issuer: 'Google',
    logo: 'google',
    platform: 'Coursera',
    issued: 'Jul 2025',
    href: 'https://www.coursera.org/account/accomplishments/specialization/IYQNRLNTRLAH',
  },
  {
    id: 'google-project-management',
    title: 'Google Project Management Specialization',
    issuer: 'Google',
    logo: 'google',
    platform: 'Coursera',
    issued: 'Jul 2025',
    href: 'https://www.coursera.org/account/accomplishments/specialization/G7XR3772IGOB',
  },
];

/** Where a certificate links to, if anywhere yet: the Coursera URL, else the PDF. */
export const certificateLink = (c: Certificate): string | undefined => c.href || c.pdf || undefined;
