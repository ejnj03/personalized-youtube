import type { FontCatalog } from './types';

/**
 * The 24-font default catalog. Pairings between Latin fonts and Korean
 * fallbacks are vibe-matched: clean modern sans ↔ Noto Sans KR; editorial
 * serif ↔ Hahmlet; handwritten ↔ Nanum Pen Script; etc. Mixed Latin+Hangul
 * text reads coherently because cross-script weights and styles match.
 *
 * Each entry's `description` is what Claude reads to pick a font for a
 * prompt — edit those to retune Claude's font-picking behavior without
 * touching any code that consumes the catalog.
 */
export const DEFAULT_FONTS: FontCatalog = {
  // ─── Sans ──────────────────────────────────────────────────────────────
  inter: {
    family: 'Inter',
    google: 'Inter:wght@400;500;700',
    fallbacks: { ko: 'Noto Sans KR' },
    description: 'Clean modern sans-serif. The default safe choice; works for productivity vibes.',
    category: 'sans',
  },
  'space-grotesk': {
    family: 'Space Grotesk',
    google: 'Space+Grotesk:wght@400;500;700',
    fallbacks: { ko: 'IBM Plex Sans KR' },
    description: 'Geometric sans with subtle wide letterforms. Tech/startup feel.',
    category: 'sans',
  },
  bricolage: {
    family: 'Bricolage Grotesque',
    google: 'Bricolage+Grotesque:wght@400;500;700',
    fallbacks: { ko: 'Noto Sans KR' },
    description: 'Warm humanist sans with subtle wobble. Friendly, contemporary, slightly playful.',
    category: 'sans',
  },
  geist: {
    family: 'Geist',
    google: 'Geist:wght@400;500;700',
    fallbacks: { ko: 'IBM Plex Sans KR' },
    description: 'Vercel-designed modern sans. Crisp, neutral, technical.',
    category: 'sans',
  },

  // ─── Display / condensed ───────────────────────────────────────────────
  anton: {
    family: 'Anton',
    google: 'Anton',
    fallbacks: { ko: 'Black Han Sans' },
    description: 'Ultra-condensed display sans. Bold magazine headlines, posters.',
    category: 'display',
  },
  'big-shoulders': {
    family: 'Big Shoulders Display',
    google: 'Big+Shoulders+Display:wght@400;700',
    fallbacks: { ko: 'Gasoek One' },
    description: 'Tall, condensed, industrial. Strong newsprint or athletic energy.',
    category: 'display',
  },
  unbounded: {
    family: 'Unbounded',
    google: 'Unbounded:wght@400;700',
    fallbacks: { ko: 'Do Hyeon' },
    description: 'Wide geometric display. Modern brand, fashion-forward, slightly futuristic.',
    category: 'display',
  },
  syne: {
    family: 'Syne',
    google: 'Syne:wght@400;700',
    fallbacks: { ko: 'Moirai One' },
    description: 'Quirky geometric display with personality. Editorial, art-book, contemporary.',
    category: 'display',
  },

  // ─── Display serif ─────────────────────────────────────────────────────
  fraunces: {
    family: 'Fraunces',
    google: 'Fraunces:wght@400;500;700',
    fallbacks: { ko: 'Hahmlet' },
    description: 'Editorial display serif. Magazine vibes, soft elegance.',
    category: 'serif',
  },
  'dm-serif': {
    family: 'DM Serif Display',
    google: 'DM+Serif+Display',
    fallbacks: { ko: 'Nanum Myeongjo' },
    description: 'Tall, dramatic, high-contrast serif. Luxurious, editorial.',
    category: 'serif',
  },
  'bodoni-moda': {
    family: 'Bodoni Moda',
    google: 'Bodoni+Moda:wght@400;700',
    fallbacks: { ko: 'Nanum Myeongjo' },
    description: 'Classic Bodoni — high-contrast, fashion-magazine elegance.',
    category: 'serif',
  },
  cormorant: {
    family: 'Cormorant',
    google: 'Cormorant:wght@400;500;700',
    fallbacks: { ko: 'Gowun Batang' },
    description: 'Refined, calligraphic serif. Boutique, perfumery, soft luxury.',
    category: 'serif',
  },

  // ─── Body serif ────────────────────────────────────────────────────────
  newsreader: {
    family: 'Newsreader',
    google: 'Newsreader:wght@400;500;700',
    fallbacks: { ko: 'Song Myung' },
    description: 'Modern news/longform serif. Readable, balanced, journalistic.',
    category: 'serif',
  },
  lora: {
    family: 'Lora',
    google: 'Lora:wght@400;500;700',
    fallbacks: { ko: 'Gowun Batang' },
    description: 'Warm, contemporary body serif. Personal blogs, journals.',
    category: 'serif',
  },
  'eb-garamond': {
    family: 'EB Garamond',
    google: 'EB+Garamond:wght@400;700',
    fallbacks: { ko: 'Nanum Myeongjo' },
    description: 'Classic old-style Garamond. Traditional, scholarly, book-like.',
    category: 'serif',
  },

  // ─── Mono ──────────────────────────────────────────────────────────────
  jetbrains: {
    family: 'JetBrains Mono',
    google: 'JetBrains+Mono:wght@400;500;700',
    fallbacks: { ko: 'IBM Plex Sans KR' },
    description: 'Coder-friendly monospace. Technical, terminal vibes, ligatures.',
    category: 'mono',
  },
  'ibm-plex-mono': {
    family: 'IBM Plex Mono',
    google: 'IBM+Plex+Mono:wght@400;500;700',
    fallbacks: { ko: 'IBM Plex Sans KR' },
    description: 'IBM corporate monospace. Restrained, professional, archival.',
    category: 'mono',
  },
  'space-mono': {
    family: 'Space Mono',
    google: 'Space+Mono:wght@400;700',
    fallbacks: { ko: 'IBM Plex Sans KR' },
    description: 'Retro-future monospace. Slightly quirky, terminal nostalgia.',
    category: 'mono',
  },

  // ─── Handwritten ───────────────────────────────────────────────────────
  caveat: {
    family: 'Caveat',
    google: 'Caveat:wght@400;500;700',
    fallbacks: { ko: 'Nanum Pen Script' },
    description: 'Handwritten cursive. Casual, friendly notes.',
    category: 'handwritten',
  },
  'permanent-marker': {
    family: 'Permanent Marker',
    google: 'Permanent+Marker',
    fallbacks: { ko: 'Nanum Pen Script' },
    description: 'Bold marker-pen scrawl. Energetic, punk, protest-poster.',
    category: 'handwritten',
  },
  'architects-daughter': {
    family: 'Architects Daughter',
    google: 'Architects+Daughter',
    fallbacks: { ko: 'Nanum Pen Script' },
    description: 'Quirky architect-style handwriting. Notebook, sketchy, indie.',
    category: 'handwritten',
  },

  // ─── Rounded ───────────────────────────────────────────────────────────
  fredoka: {
    family: 'Fredoka',
    google: 'Fredoka:wght@400;500;700',
    fallbacks: { ko: 'Bagel Fat One' },
    description: 'Rounded, friendly sans. Children/games/playful brand.',
    category: 'rounded',
  },

  // ─── Decorative ────────────────────────────────────────────────────────
  monoton: {
    family: 'Monoton',
    google: 'Monoton',
    fallbacks: { ko: 'Yeon Sung' },
    description: 'Outlined retro-neon display. 80s, marquee, sign-painter.',
    category: 'decorative',
  },
  bungee: {
    family: 'Bungee',
    google: 'Bungee',
    fallbacks: { ko: 'Black Han Sans' },
    description: 'Chunky, sign-painter, vertical-stack display. Bold, retail, urban.',
    category: 'decorative',
  },
};
