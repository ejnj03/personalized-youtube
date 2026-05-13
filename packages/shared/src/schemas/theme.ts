import { z } from 'zod';

export const VideoCardDefaults = z.object({
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '3:4']).default('16:9'),
  thumbnailScale: z.number().min(0.5).max(2).default(1),
  titleWeight: z.number().int().min(100).max(900).default(500),
  channelNameWeight: z.number().int().min(100).max(900).default(400),
  showDescription: z.boolean().default(false),
  showViewCount: z.boolean().default(true),
  showPostedAgo: z.boolean().default(true),
  showDuration: z.boolean().default(true),
  cardLayout: z.enum(['vertical', 'horizontal']).default('vertical'),
  hoverEffect: z.enum(['none', 'lift', 'zoom']).default('lift'),
  // 0..1.5 — applied as CSS filter: saturate(...) on every thumbnail.
  // 0.25 gives the bookshop "soft sepia" look; 1.0 is unchanged.
  thumbnailSaturate: z.number().min(0).max(1.5).default(1),
  // Hides the {views · age} line under the title (bookshop scenario, etc.).
  hideMeta: z.boolean().default(false),
});
export type VideoCardDefaults = z.infer<typeof VideoCardDefaults>;

const HEX = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const BackgroundSchema = z
  .object({
    // 'solid' / 'gradient' set the bg via from/to/angle.
    // 'paper'  — cream texture preset (bookshop / quiet aesthetic).
    // 'sampled'— colors extracted from a content source (the watch page's
    //            playing video thumbnail). Renders as a soft radial blob bg
    //            and is animated when the source changes.
    kind: z.enum(['solid', 'gradient', 'paper', 'sampled']).default('solid'),
    from: HEX.optional(),
    to: HEX.optional(),
    angle: z.number().int().min(0).max(360).default(180),
    // Source for kind='sampled'. 'playingVideo' uses the watch-page video.
    sampleSource: z.enum(['playingVideo', 'topVideo']).optional(),
    // Sampled-bg intensity, 0..1. Default 0.7 reads as ambient, not casino.
    intensity: z.number().min(0).max(1).default(0.7),
  })
  .default({ kind: 'solid', angle: 180, intensity: 0.7 });
export type Background = z.infer<typeof BackgroundSchema>;

const fontFamily =  z.enum([
  // Legacy keys — kept so existing saved patches in the DB still validate.
  'sans', 'serif', 'mono', 'rounded',
  // Sans
  'inter', 'space-grotesk', 'bricolage', 'geist',
  // Display / condensed
  'anton', 'big-shoulders', 'unbounded', 'syne',
  // Display serif
  'fraunces', 'dm-serif', 'bodoni-moda', 'cormorant',
  // Body serif
  'newsreader', 'lora', 'eb-garamond',
  // Mono
  'jetbrains', 'ibm-plex-mono', 'space-mono',
  // Handwritten
  'caveat', 'permanent-marker', 'architects-daughter',
  // Rounded
  'fredoka',
  // Decorative
  'monoton', 'bungee',
]).default('sans');

export const ThemeSchema = z.object({
  mode: z.enum(['light', 'dark']).default('light'),
  accent: HEX.default('#FF0000'),
  fontScale: z.enum(['0.875', '1', '1.125', '1.25']).default('1'),
  fontFamily,
  radius: z.enum(['none', 'sm', 'md', 'lg', 'xl']).default('md'),
  background: BackgroundSchema,
  videoCardDefaults: VideoCardDefaults.default({}),
  // 0..1 — dims TopBar + Sidebar so they recede when an ambient bg is
  // doing the talking. 0 = full-strength chrome; 0.5 = noticeably faded.
  chromeDim: z.number().min(0).max(1).default(0),
  // 0..1 — global film grain overlay on the page (looks great with sampled
  // backgrounds). 0 = off (default); 0.18 is the "filmic" sweet spot.
  grain: z.number().min(0).max(1).default(0),
});
export type Theme = z.infer<typeof ThemeSchema>;
