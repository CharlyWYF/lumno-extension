#!/usr/bin/env python3
"""Rebuild the digit-only clock faces used by the New Tab time.

Requires fonttools and brotli (pip install fonttools brotli). Inputs are the
variable TTFs from https://github.com/google/fonts/tree/main/ofl:
  geist/Geist[wght].ttf
  jetbrainsmono/JetBrainsMono[wght].ttf
  bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf
  unbounded/Unbounded[wght].ttf
  bitcountsingle/BitcountSingle[CRSV,ELSH,ELXP,slnt,wght].ttf

Each face keeps only the digits and the colon, keeps its weight axis (limited
to the range the clock allows for it), and pins every other axis to the look
the clock uses, so a face is a few KB.

Usage: python3 scripts/subset-clock-fonts.py <dir containing the five TTFs>
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT_DIR = Path(__file__).resolve().parent.parent / 'assets' / 'fonts' / 'clock'
CLOCK_CHARS = '0123456789:'

# Weight ranges must match NEWTAB_TIME_FONTS in src/shared/settings.js.
FACES = (
    ('geist', 'Geist[wght].ttf', 'Lumno Clock Geist', {'wght': (300, 800)}),
    ('jetbrains-mono', 'JetBrainsMono[wght].ttf', 'Lumno Clock JetBrains Mono', {'wght': (300, 800)}),
    ('bricolage-grotesque', 'BricolageGrotesque[opsz,wdth,wght].ttf', 'Lumno Clock Bricolage Grotesque',
     {'wght': (300, 800), 'opsz': 96, 'wdth': 100}),
    ('unbounded', 'Unbounded[wght].ttf', 'Lumno Clock Unbounded', {'wght': (300, 800)}),
    # Solid round dots (ELSH 0); past wght 550 the dots run into each other.
    ('bitcount', 'BitcountSingle[CRSV,ELSH,ELXP,slnt,wght].ttf', 'Lumno Clock Bitcount',
     {'wght': (300, 550), 'ELSH': 0, 'ELXP': 0, 'slnt': 0, 'CRSV': 0.5}),
)


def build_face(source, axes, out):
    font = TTFont(source)
    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_languages = ['*']
    options.notdef_outline = True
    options.hinting = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes={ord(char) for char in CLOCK_CHARS})
    subsetter.subset(font)
    # Subset before pinning axes: some gvar tables omit .notdef, which the
    # subsetter trips over once the instancer has rewritten them.
    font = instancer.instantiateVariableFont(font, axes)
    font.flavor = 'woff2'
    font.save(out)


def main(source_dir):
    source_dir = Path(source_dir)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    faces = []
    for face_id, filename, family, axes in FACES:
        out = OUT_DIR / f'{face_id}.woff2'
        build_face(source_dir / filename, axes, out)
        low, high = axes['wght']
        faces.append(
            '@font-face {\n'
            f'  font-family: "{family}";\n'
            f'  src: url("./{face_id}.woff2") format("woff2");\n'
            '  font-style: normal;\n'
            f'  font-weight: {low} {high};\n'
            '  font-display: block;\n'
            '  unicode-range: U+30-3A;\n'
            '}\n'
        )
        print(f'{face_id}: {out.stat().st_size} bytes')
    header = ('/* Digit-only clock faces for the New Tab time (SIL OFL 1.1, see OFL-*.txt).\n'
              '   Rebuild with scripts/subset-clock-fonts.py. */\n')
    (OUT_DIR / 'clock-fonts.css').write_text(header + ''.join(faces), encoding='utf-8')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
