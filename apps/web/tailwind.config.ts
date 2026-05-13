import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)',
        'accent-fg': 'var(--accent-fg)',
        bg: 'var(--bg)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        'muted-fg': 'var(--muted-fg)',
        border: 'var(--border)',
      },
      fontSize: {
        scaled: 'calc(1rem * var(--font-scale, 1))',
      },
      fontFamily: {
        // Bridge for the current 4-key schema — kept so saved patches with
        // fontFamily: 'sans' | 'serif' | 'mono' | 'rounded' still render.
        sans: ['var(--font-inter-loaded)', 'var(--font-noto-sans-kr-loaded)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-lora-loaded)', 'var(--font-gowun-batang-loaded)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-loaded)', 'var(--font-ibm-plex-sans-kr-loaded)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        rounded: ['var(--font-fredoka-loaded)', 'var(--font-bagel-fat-one-loaded)', 'ui-rounded', 'system-ui', 'sans-serif'],

        // Per-font keys. Korean fallback is inserted between the Latin font
        // and the system fallback so Hangul glyphs render in a vibe-matched
        // Korean font instead of the OS default.
        inter:               ['var(--font-inter-loaded)',                'var(--font-noto-sans-kr-loaded)',       'system-ui', 'sans-serif'],
        'space-grotesk':     ['var(--font-space-grotesk-loaded)',        'var(--font-ibm-plex-sans-kr-loaded)',   'system-ui', 'sans-serif'],
        bricolage:           ['var(--font-bricolage-loaded)',            'var(--font-noto-sans-kr-loaded)',       'system-ui', 'sans-serif'],
        geist:               ['var(--font-geist-loaded)',                'var(--font-ibm-plex-sans-kr-loaded)',   'system-ui', 'sans-serif'],
        anton:               ['var(--font-anton-loaded)',                'var(--font-black-han-sans-loaded)',     'sans-serif'],
        'big-shoulders':     ['var(--font-big-shoulders-loaded)',        'var(--font-gasoek-one-loaded)',         'sans-serif'],
        unbounded:           ['var(--font-unbounded-loaded)',            'var(--font-do-hyeon-loaded)',           'sans-serif'],
        syne:                ['var(--font-syne-loaded)',                 'var(--font-moirai-one-loaded)',         'sans-serif'],
        fraunces:            ['var(--font-fraunces-loaded)',             'var(--font-hahmlet-loaded)',            'serif'],
        'dm-serif':          ['var(--font-dm-serif-loaded)',             'var(--font-nanum-myeongjo-loaded)',     'serif'],
        'bodoni-moda':       ['var(--font-bodoni-moda-loaded)',          'var(--font-nanum-myeongjo-loaded)',     'serif'],
        cormorant:           ['var(--font-cormorant-loaded)',            'var(--font-gowun-batang-loaded)',       'serif'],
        newsreader:          ['var(--font-newsreader-loaded)',           'var(--font-song-myung-loaded)',         'serif'],
        lora:                ['var(--font-lora-loaded)',                 'var(--font-gowun-batang-loaded)',       'serif'],
        'eb-garamond':       ['var(--font-eb-garamond-loaded)',          'var(--font-nanum-myeongjo-loaded)',     'serif'],
        jetbrains:           ['var(--font-jetbrains-loaded)',            'var(--font-ibm-plex-sans-kr-loaded)',   'ui-monospace', 'monospace'],
        'ibm-plex-mono':     ['var(--font-ibm-plex-mono-loaded)',        'var(--font-ibm-plex-sans-kr-loaded)',   'ui-monospace', 'monospace'],
        'space-mono':        ['var(--font-space-mono-loaded)',           'var(--font-ibm-plex-sans-kr-loaded)',   'ui-monospace', 'monospace'],
        caveat:              ['var(--font-caveat-loaded)',               'var(--font-nanum-pen-script-loaded)',   'cursive'],
        'permanent-marker':  ['var(--font-permanent-marker-loaded)',     'var(--font-nanum-pen-script-loaded)',   'cursive'],
        'architects-daughter':['var(--font-architects-daughter-loaded)', 'var(--font-nanum-pen-script-loaded)',   'cursive'],
        fredoka:             ['var(--font-fredoka-loaded)',              'var(--font-bagel-fat-one-loaded)',      'sans-serif'],
        monoton:             ['var(--font-monoton-loaded)',              'var(--font-yeon-sung-loaded)',          'sans-serif'],
        bungee:              ['var(--font-bungee-loaded)',               'var(--font-black-han-sans-loaded)',     'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
