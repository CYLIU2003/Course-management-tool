"""Recover absent PDF ToUnicode maps from outline-identical installed fonts.

Only Identity CID mappings and exactly matching glyph outlines are accepted.
The downloaded PDF is never modified. This is deterministic decoding, not OCR.
"""
import hashlib
import io
from functools import lru_cache
from pathlib import Path

from fontTools.ttLib import TTFont

FONT_FILES = {'MS-Mincho': ('msmincho.ttc', 0), 'MS-PMincho': ('msmincho.ttc', 1),
              'MS-Gothic': ('msgothic.ttc', 0), 'MS-PGothic': ('msgothic.ttc', 2),
              'YuGothic-Regular': ('YuGothR.ttc', 0), 'YuMincho-Regular': ('yumin.ttf', 0)}


@lru_cache(maxsize=6)
def load_reference_font(filename, font_number):
    path = Path('C:/Windows/Fonts') / filename
    font = TTFont(path, fontNumber=font_number)
    glyph_unicode = {}
    for codepoint, name in sorted(font.getBestCmap().items()):
        if 32 <= codepoint < 0xFFFF:
            glyph_unicode.setdefault(font.getGlyphID(name), codepoint)
    return font, glyph_unicode, hashlib.sha256(path.read_bytes()).hexdigest()


def recover_unicode(document):
    repairs = []
    fonts = {font[0]: font for page in document for font in page.get_fonts()}
    for xref, font in fonts.items():
        if document.xref_get_key(xref, 'ToUnicode')[0] != 'null':
            continue
        reference_info = next((info for family, info in FONT_FILES.items() if family in font[3]), None)
        if not reference_info or font[1] != 'ttf' or font[5] != 'Identity-H':
            continue
        descendants = document.xref_get_key(xref, 'DescendantFonts')[1]
        descendant = int(descendants.lstrip('[').split()[0])
        if document.xref_get_key(descendant, 'CIDToGIDMap')[1] != '/Identity':
            continue
        filename, font_number = reference_info
        reference, glyph_unicode, reference_hash = load_reference_font(filename, font_number)
        embedded = TTFont(io.BytesIO(document.extract_font(xref)[3]))
        mappings = []
        rejected = []
        for glyph_id in range(embedded['maxp'].numGlyphs):
            glyph = embedded['glyf'][embedded.getGlyphName(glyph_id)]
            if glyph.numberOfContours == 0:
                continue
            if glyph_id not in glyph_unicode:
                rejected.append(glyph_id)
                continue
            source_glyph = reference['glyf'][reference.getGlyphName(glyph_id)]
            if glyph.getCoordinates(embedded['glyf']) != source_glyph.getCoordinates(reference['glyf']):
                rejected.append(glyph_id)
                continue
            mappings.append(f'<{glyph_id:04X}> <{glyph_unicode[glyph_id]:04X}>')
        # Space has no outline; its Unicode value is verified in the reference cmap.
        if reference.getGlyphID(reference.getBestCmap()[32]) == 3:
            mappings.append('<0003> <0020>')
        if not mappings:
            continue
        chunks = ['\n'.join([f'{len(mappings[i:i+100])} beginbfchar', *mappings[i:i+100], 'endbfchar'])
                  for i in range(0, len(mappings), 100)]
        cmap = '\n'.join(['/CIDInit /ProcSet findresource begin', '12 dict begin', 'begincmap',
                          '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
                          '/CMapName /RecoveredUnicode def', '/CMapType 2 def',
                          '1 begincodespacerange', '<0000> <FFFF>', 'endcodespacerange', *chunks,
                          'endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end'])
        cmap_xref = document.get_new_xref()
        document.update_object(cmap_xref, '<<>>')
        document.update_stream(cmap_xref, cmap.encode('ascii'))
        document.xref_set_key(xref, 'ToUnicode', f'{cmap_xref} 0 R')
        repairs.append(dict(font=font[3], mappedGlyphs=len(mappings), rejectedGlyphs=rejected,
                            referenceFont=filename, referenceFontSha256=reference_hash))
    return repairs
