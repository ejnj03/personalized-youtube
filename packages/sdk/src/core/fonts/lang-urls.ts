/**
 * Family name → Google Fonts URL spec for non-Latin fonts referenced as
 * `fallbacks` values in catalog entries. The loader unions these with the
 * Latin font URLs into one Google Fonts <link>.
 *
 * Default ships with Korean partners (so `fallbacks.ko` values resolve out
 * of the box). Hosts extend by spreading this map and adding new entries —
 * e.g. for Japanese add `'Noto Sans JP': 'Noto+Sans+JP:wght@400;500;700'`.
 *
 * Only families that ARE actually referenced by some catalog entry's
 * `fallbacks` get included in the eventual <link> URL — unused entries here
 * are harmless but never fetched.
 */
export const LANG_FONT_URLS: Record<string, string> = {
  // ─── Korean (ships by default) ─────────────────────────────────────────
  'Noto Sans KR':       'Noto+Sans+KR:wght@400;500;700',
  'IBM Plex Sans KR':   'IBM+Plex+Sans+KR:wght@400;500;700',
  'Black Han Sans':     'Black+Han+Sans',
  'Gasoek One':         'Gasoek+One',
  'Do Hyeon':           'Do+Hyeon',
  'Moirai One':         'Moirai+One',
  'Hahmlet':            'Hahmlet:wght@400;500;700',
  'Nanum Myeongjo':     'Nanum+Myeongjo:wght@400;700',
  'Gowun Batang':       'Gowun+Batang:wght@400;700',
  'Song Myung':         'Song+Myung',
  'Nanum Pen Script':   'Nanum+Pen+Script',
  'Bagel Fat One':      'Bagel+Fat+One',
  'Yeon Sung':          'Yeon+Sung',
};
