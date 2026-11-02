"""Font subsets for the site (run after changing fonts: python3 scripts/subset-fonts.py).

The web fonts are trimmed to what the site writes, with the same outlines, kerning and
variable weight axis, so nothing renders differently:

- Inter / Geist Mono "latin-ext": fontsource's file covers all of Latin Extended
  (Vietnamese, African, phonetic...), 85 KB for Inter. Turkish needs only Latin
  Extended-A. The subset covers U+0100-017F (all of Extended-A) plus a few used
  extras (ŷ, ℓ, the modifier letters math captions use, e.g. cᵀx); src/styles/fonts.css declares it after fontsource's faces, so it wins for
  those characters and the full file only loads if a rarer letter ever appears.
- Departure Mono: the full font (1,079 characters, box drawing and more) is kept in
  experiments/fonts; the shipped file keeps Latin, Latin-1, Extended-A, Greek, general
  punctuation, sub/superscripts, arrows, math and technical symbols, blocks/shapes.

All three fonts are SIL OFL 1.1 with no Reserved Font Names, so subsetting is allowed.
"""
from pathlib import Path
from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
NM = ROOT / 'node_modules/@fontsource-variable'
JOBS = [
    (NM / 'inter/files/inter-latin-ext-wght-normal.woff2', ROOT / 'src/assets/fonts/inter-latin-ext-tr-wght.woff2',
     'U+0100-017F,U+0218-021B,U+0177,U+2113,U+1D2C-1D6A'),
    (NM / 'geist-mono/files/geist-mono-latin-ext-wght-normal.woff2', ROOT / 'src/assets/fonts/geist-mono-latin-ext-tr-wght.woff2',
     'U+0100-017F,U+0218-021B,U+0177'),
    (ROOT / 'experiments/fonts/DepartureMono-Regular.full.woff2', ROOT / 'public/fonts/DepartureMono-Regular.woff2',
     'U+0020-007E,U+00A0-017F,U+0218-021B,U+0300-036F,U+0370-03FF,U+2000-206F,U+2070-209F,U+20AC,U+2113,'
     'U+2190-21FF,U+2200-22FF,U+2300-23FF,U+2580-259F,U+25A0-25FF,U+2726'),
]
for src, dst, uni in JOBS:
    opts = subset.Options()
    opts.layout_features = ['*']
    opts.flavor = 'woff2'
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(str(src), opts)
    s = subset.Subsetter(opts)
    s.populate(unicodes=subset.parse_unicodes(uni))
    s.subset(font)
    subset.save_font(font, str(dst), opts)
    print(f'{dst.relative_to(ROOT)}  {src.stat().st_size:>7} -> {dst.stat().st_size:>6} bytes')
