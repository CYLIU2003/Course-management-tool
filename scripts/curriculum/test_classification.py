import unittest
from classify_pdf_courses import cell_text


def glyph(letter, x, y):
    return {'c': letter, 'origin': (x, y), 'bbox': (x, y-4, x+4, y+1)}


class ClassificationTests(unittest.TestCase):
    def test_vertical_two_columns(self):
        chars = [glyph(c, x, i*8+10) for x, text in [(20, '理工学'), (10, '基礎科目')] for i,c in enumerate(text)]
        self.assertEqual(cell_text(chars, (5, 0, 28, 60), label=True), '理工学基礎科目')

    def test_horizontal_wrapped_group(self):
        chars = [glyph(c, 10+i*4, 10+j*8) for j,line in enumerate(['卒業研','究関連','科目']) for i,c in enumerate(line)]
        self.assertEqual(cell_text(chars, (5, 0, 28, 40), label=True), '卒業研究関連科目')

    def test_neighbor_glyph_crossing_border_is_excluded(self):
        chars = [glyph(c, 10, 10+i*8) for i,c in enumerate('専門科目')]+[glyph('用', 23, 12)]
        self.assertEqual(cell_text(chars, (5, 0, 24, 50), label=True), '専門科目')


if __name__ == '__main__':
    unittest.main()
