// Scenario data: sample videos, scripted patches & chat scripts for the
// /scenarios demo page.

export type Surface = 'Home' | 'Watch';
export type ScenarioKind = 'aesthetic' | 'utility';

export interface Video {
  id: string;
  title: string;
  channel: string;
  avatar: string;
  duration: string;
  views: string;
  age: string;
  tags: string[];
  thumbI: number;
  watched: boolean;
}

export interface NowPlayingVideo {
  id: string;
  title: string;
  channel: string;
  avatar: string;
  duration: string;
  views: string;
  age: string;
  description: string;
  thumbI: number;
}

export interface SuggestionVideo {
  id: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  age: string;
  thumbI: number;
}

export type ChapterKind = 'intro' | 'sponsor' | 'outro' | 'recap' | 'selfPromo';

export interface SkippableChapter {
  kind: ChapterKind;
  start: number;
  end: number;
  label: string;
}

export type ChatMessageRole = 'agent' | 'tool';

export interface AgentChatMessage {
  who: 'agent';
  text: string;
}

export interface ToolChatMessage {
  who: 'tool';
  name: string;
  args: Record<string, unknown>;
}

export type ChatMessage = AgentChatMessage | ToolChatMessage;

export interface Scenario {
  id: string;
  num: string;
  surface: Surface;
  kind: ScenarioKind;
  title: string;
  eyebrow: string;
  lede: string;
  prompt: string;
  chat: ChatMessage[];
  friendlyMessages: string[];
  technicalMessages: string[];
  state: { before: string; after: string };
}

const THUMB_PALETTE: Array<[string, string]> = [
  ['#3a4a6b', '#7e9bd1'], ['#6b3a4a', '#d17e9b'], ['#3a6b4a', '#7ed19b'],
  ['#6b5a3a', '#d1b87e'], ['#5a3a6b', '#b87ed1'], ['#3a5a6b', '#7eb8d1'],
  ['#6b3a3a', '#d17e7e'], ['#3a6b6b', '#7ed1d1'], ['#5a6b3a', '#b8d17e'],
  ['#6b3a5a', '#d17eb8'], ['#1f2330', '#3d4860'], ['#2a1f30', '#503d60'],
  ['#1f302a', '#3d6050'], ['#302a1f', '#60503d'], ['#251f30', '#453d60'],
];

export function thumb(i: number, label: string): string {
  const pair = THUMB_PALETTE[i % THUMB_PALETTE.length] ?? THUMB_PALETTE[0]!;
  const [a, b] = pair;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/>
    </linearGradient></defs>
    <rect width='320' height='180' fill='url(#g)'/>
    <text x='160' y='100' text-anchor='middle' font-family='Inter' font-size='14' font-weight='600' fill='white' opacity='0.85'>${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function avatar(seed: number): string {
  const palette = ['#5d8aa8', '#a85d8a', '#8aa85d', '#a8855d', '#5da885', '#855da8'];
  const c = palette[seed % palette.length] ?? palette[0]!;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='${c}'/><circle cx='16' cy='13' r='5' fill='rgba(255,255,255,0.7)'/><rect x='6' y='20' width='20' height='12' rx='6' fill='rgba(255,255,255,0.7)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_VIDEOS: Video[] = [
  { id: 'v1', title: 'Why the Voyager probes still work — 47 years later', channel: 'Real Engineering', avatar: avatar(0), duration: '18:42', views: '2.1M', age: '3 weeks ago', tags: ['space', 'engineering', 'documentary'], thumbI: 0, watched: false },
  { id: 'v2', title: 'I tried to make sourdough every day for 100 days', channel: 'Brad Leone', avatar: avatar(1), duration: '24:11', views: '890K', age: '5 days ago', tags: ['cooking', 'vlog'], thumbI: 1, watched: false },
  { id: 'v3', title: 'lo-fi beats to study to · 3 hour mix', channel: 'cafe del paris', avatar: avatar(2), duration: '3:01:22', views: '4.4M', age: '2 months ago', tags: ['lofi', 'music', 'focus'], thumbI: 2, watched: true },
  { id: 'v4', title: '100% Mahjong World Championship Final Hand', channel: 'Riichi Reviews', avatar: avatar(3), duration: '32:08', views: '410K', age: '1 week ago', tags: ['mahjong', 'games'], thumbI: 3, watched: false },
  { id: 'v5', title: 'Miles Davis — Kind of Blue (full album, 1959)', channel: 'JazzVault', avatar: avatar(4), duration: '45:44', views: '12M', age: '5 years ago', tags: ['jazz', 'music', 'chill'], thumbI: 4, watched: false },
  { id: 'v6', title: 'Why every grocery store looks the same now', channel: 'Vox', avatar: avatar(5), duration: '11:23', views: '3.4M', age: '4 days ago', tags: ['news', 'culture'], thumbI: 5, watched: false },
  { id: 'v7', title: 'Slow morning routine — autumn in Kyoto', channel: 'still mornings', avatar: avatar(0), duration: '14:02', views: '720K', age: '2 weeks ago', tags: ['vlog', 'slow', 'calm'], thumbI: 6, watched: false },
  { id: 'v8', title: 'The political philosophy of Hannah Arendt — debate', channel: 'Philosophy Tube', avatar: avatar(1), duration: '54:17', views: '1.1M', age: '1 month ago', tags: ['philosophy', 'debate', 'longform'], thumbI: 7, watched: true },
  { id: 'v9', title: 'Building a chair from a single board (no plans)', channel: 'Rex Krueger', avatar: avatar(2), duration: '22:55', views: '650K', age: '6 days ago', tags: ['woodworking', 'craft'], thumbI: 8, watched: false },
  { id: 'v10', title: 'Sleepy Korean drama recap (whisper voice)', channel: 'soft tellings', avatar: avatar(3), duration: '1:12:40', views: '230K', age: '3 weeks ago', tags: ['asmr', 'sleep', 'calm'], thumbI: 9, watched: false },
  { id: 'v11', title: 'How "Severance" hides clues in the office furniture', channel: 'Filmento', avatar: avatar(4), duration: '19:33', views: '1.9M', age: '2 weeks ago', tags: ['film', 'analysis', 'longform'], thumbI: 10, watched: false },
  { id: 'v12', title: 'Live: SpaceX Starship Flight 12 — engine relight', channel: 'NASASpaceflight', avatar: avatar(5), duration: 'LIVE', views: '94K watching', age: 'live', tags: ['space', 'live'], thumbI: 11, watched: false },
];

export const NOW_PLAYING: NowPlayingVideo = {
  id: 'v5',
  title: 'Miles Davis — Kind of Blue (full album, 1959)',
  channel: 'JazzVault',
  avatar: avatar(4),
  duration: '45:44',
  views: '12,041,002 views',
  age: '5 years ago',
  description: 'The Miles Davis sextet — Coltrane, Cannonball Adderley, Bill Evans, Paul Chambers, Jimmy Cobb. Recorded over two sessions at Columbia 30th Street Studio.',
  thumbI: 4,
};

export const NOW_PLAYING_LANGCLASS: NowPlayingVideo = {
  id: 'k1',
  title: '한국 카페에서 라떼 주문하기 — 초급 회화',
  channel: 'TalkToMeInKorean',
  avatar: avatar(2),
  duration: '12:44',
  views: '420K views',
  age: '8 months ago',
  description: 'Listen to a real conversation at a Korean café. Slow speed first, then natural speed. Vocabulary list in description.',
  thumbI: 2,
};

export const NOW_PLAYING_TUTORIAL: NowPlayingVideo = {
  id: 't1',
  title: 'Building a CRDT from scratch (with sponsor reads, of course)',
  channel: 'Jonathan Blow',
  avatar: avatar(0),
  duration: '38:14',
  views: '380K views',
  age: '2 weeks ago',
  description: 'A walkthrough of last-writer-wins maps, hybrid logical clocks, and why "automatic merge" is mostly a vibe.',
  thumbI: 10,
};

export const SUGGESTIONS_JAZZ: SuggestionVideo[] = [
  { id: 's1', title: 'John Coltrane — A Love Supreme (1965)', channel: 'JazzVault', duration: '32:50', views: '8.2M', age: '4 yrs ago', thumbI: 4 },
  { id: 's2', title: 'Bill Evans — Sunday at the Village Vanguard', channel: 'JazzVault', duration: '47:22', views: '3.1M', age: '6 yrs ago', thumbI: 9 },
  { id: 's3', title: 'Stan Getz / Joao Gilberto — Getz/Gilberto', channel: 'Bossa Archive', duration: '34:01', views: '5.8M', age: '3 yrs ago', thumbI: 1 },
  { id: 's4', title: 'How modal jazz quietly broke bebop', channel: 'PolyphonicHQ', duration: '14:28', views: '780K', age: '1 yr ago', thumbI: 7 },
  { id: 's5', title: 'Late-night Tokyo jazz bar live set (1979)', channel: 'Vinyl Atlas', duration: '1:12:04', views: '410K', age: '2 yrs ago', thumbI: 11 },
];

export const SUGGESTIONS_KOREAN: SuggestionVideo[] = [
  { id: 'k2', title: '편의점에서 도시락 사기 — 일상 회화', channel: 'TalkToMeInKorean', duration: '9:11', views: '290K', age: '6 mo', thumbI: 1 },
  { id: 'k3', title: 'Korean grammar: 은/는 vs 이/가', channel: 'Sweet & Tasty TV', duration: '14:32', views: '1.3M', age: '3 yrs', thumbI: 3 },
  { id: 'k4', title: '서울 시장 인터뷰 (자막)', channel: '한국일보', duration: '22:08', views: '110K', age: '4 mo', thumbI: 8 },
];

export const SKIPPABLE_CHAPTERS: SkippableChapter[] = [
  { kind: 'intro', start: 0, end: 28, label: 'Intro' },
  { kind: 'sponsor', start: 95, end: 175, label: 'Sponsor: Squarespace' },
  { kind: 'sponsor', start: 1320, end: 1395, label: 'Sponsor: NordVPN' },
  { kind: 'outro', start: 2200, end: 2294, label: 'Outro' },
];

export const SCENARIOS: Scenario[] = [
  {
    id: 'ambient',
    num: '01',
    surface: 'Watch',
    kind: 'aesthetic',
    title: "Make the page breathe with what I'm watching",
    eyebrow: 'Ambient · Synesthetic',
    lede: "A jazz album glows midnight indigo with film grain; a mountain vlog goes alpine grey-green with cool contrast. The chrome of YouTube fades into ambient color sampled from the playing video, with a gentle particle drift cued by the video's mood tags.",
    prompt: "When I'm playing a video, make the whole page breathe with it — color, grain, mood. Subtle, not casino.",
    chat: [
      { who: 'agent', text: "Got it — a sampled ambient theme that follows the playing video. I'll extract palette from the thumbnail, add film grain at 18%, and dim the chrome 12% so it doesn't fight the player." },
      { who: 'tool', name: 'add_section', args: { type: 'AmbientBackground', position: { before: 'topbar' }, props: { source: 'playingVideo', intensity: 0.7, grain: 0.18, particles: 'mood' } } },
      { who: 'tool', name: 'update_theme', args: { mode: 'dark', background: { kind: 'sampled', source: 'playingVideo' }, chromeDim: 0.12 } },
      { who: 'agent', text: "Done. I tied it to the player's `playingVideoId`, so it crossfades each time you switch tracks." },
    ],
    friendlyMessages: [
      'Reading the album cover for color cues…',
      'Mixing midnight indigo with a touch of dusk orange.',
      'Drifting a little grain over the top so it feels filmic.',
    ],
    technicalMessages: [
      'extractPalette(thumbnail) → [#1a1a3a, #4a3060, #ffac6e]',
      'patch theme.background = { kind: "sampled", source: "playingVideo" }',
      'add_section AmbientBackground before TopBar',
      'subscribe AmbientBackground to store.playingVideoId',
    ],
    state: { before: 'ambient-before', after: 'ambient-after' },
  },
  {
    id: 'subtitles',
    num: '02',
    surface: 'Watch',
    kind: 'utility',
    title: 'Dual subtitles in Korean and English, side by side',
    eyebrow: 'Language · Comprehension',
    lede: 'Two stacked subtitle tracks render in real time — target language on top, native language below — with hover-to-define vocabulary, pinned grammar notes, and a per-word audio loop. Designed for language learners watching in the wild.',
    prompt: "I'm learning Korean. Show subtitles in both Korean and English at the same time, with a hover dictionary on the Korean words.",
    chat: [
      { who: 'agent', text: "Adding a dual-track subtitle overlay. Korean on top (since it's your target language), English below as a soft reference. I'll wire hover-define against the captions track's timing — no API needed for the v0 dictionary, just a static lookup." },
      { who: 'tool', name: 'add_section', args: { type: 'SubtitleTrack', props: { primary: 'ko', secondary: 'en', hoverDefine: true, vocabPin: true, position: 'overlay' } } },
      { who: 'tool', name: 'update_section', args: { sectionId: 'topbar', patch: { compactSearch: true } } },
      { who: 'agent', text: 'When you hover a Korean word the bubble shows reading + part-of-speech + a 1-line gloss. Click to pin it to a vocab list in the side rail.' },
    ],
    friendlyMessages: [
      'Pulling captions in Korean and English…',
      'Stacking them so the Korean leads.',
      'Wiring up a little hover-dictionary just for you.',
    ],
    technicalMessages: [
      'fetchCaptions(videoId, ["ko", "en"])',
      'add_section SubtitleTrack { primary:"ko", secondary:"en" }',
      'register CaptionAdapter.onCue → renderOverlay()',
      'attach hoverDefine handler → /api/dict/ko',
    ],
    state: { before: 'subtitles-before', after: 'subtitles-after' },
  },
  {
    id: 'sponsorskip',
    num: '03',
    surface: 'Watch',
    kind: 'utility',
    title: 'Skip the sponsor reads. Skip the intro. Skip the outro.',
    eyebrow: 'Time · Attention',
    lede: 'Imported chapter data marks sponsors, intros, outros, recap segments, and self-promo. The player jumps over them automatically; a soft toast confirms each skip with an undo. Total time saved is tallied in the sidebar.',
    prompt: 'Skip sponsor segments and intros for me automatically. Show me what got skipped.',
    chat: [
      { who: 'agent', text: "I'll subscribe to the chapters track for the playing video and auto-seek past anything tagged `sponsor`, `intro`, or `outro`. A toast confirms each skip — click it to undo or whitelist that channel." },
      { who: 'tool', name: 'set_filter', args: { chapterFilters: ['sponsor', 'intro', 'outro'], autoSkip: true, showToast: true } },
      { who: 'tool', name: 'add_section', args: { type: 'TimeSavedTally', props: { visible: true, position: 'sidebar' } } },
      { who: 'agent', text: "I've also added a \"Time saved this week\" widget to the sidebar so you can see what it adds up to." },
    ],
    friendlyMessages: [
      "Asking the chapter track what's a sponsor and what's the actual show…",
      'Setting up auto-skip with a soft little toast for transparency.',
      'Hooking up a "time saved" counter for the sidebar.',
    ],
    technicalMessages: [
      'fetchChapters(videoId) → 4 segments',
      'set_filter chapterFilters=[sponsor,intro,outro]',
      'player.on("timeupdate") → maybeSeekPast(chapter)',
      'add_section TimeSavedTally',
    ],
    state: { before: 'sponsorskip-before', after: 'sponsorskip-after' },
  },
  {
    id: 'mood',
    num: '04',
    surface: 'Home',
    kind: 'utility',
    title: "Group my feed by what I'm in the mood for, not by recency",
    eyebrow: 'Feed · Reorganization',
    lede: 'The grid dissolves into mood-shaped collections — Focus, Wind down, Sharpen, Curious — each with its own pacing and density. Category chips become moods; the whole feed re-sorts every time you pick one.',
    prompt: 'My feed is too random. Group it by mood — focus, wind down, sharpen — instead of recency.',
    chat: [
      { who: 'agent', text: 'Replacing the VideoGrid with a MoodBoard. I classified your 12 visible videos into four moods based on tags + duration + pacing. Chips become moods; clicking one zooms its mood block to full width.' },
      { who: 'tool', name: 'remove_section', args: { sectionId: 'videogrid' } },
      { who: 'tool', name: 'add_section', args: { type: 'MoodBoard', props: { moods: ['focus', 'winddown', 'sharpen', 'curious'], densityPerMood: { focus: 'cozy', winddown: 'comfortable', sharpen: 'compact', curious: 'cozy' } } } },
      { who: 'tool', name: 'update_section', args: { sectionId: 'chips', patch: { mode: 'mood' } } },
      { who: 'agent', text: 'Mood classification is content-only (tags, duration, channel) — no inference about you. If you want, I can also bias which mood lands first based on time-of-day.' },
    ],
    friendlyMessages: [
      'Reading the room — sorting your feed into four moods…',
      "Putting the calmer stuff lower so it doesn't shout.",
      'Turning your category chips into mood chips.',
    ],
    technicalMessages: [
      'classifyMood(video) for v ∈ feed',
      'remove_section videogrid',
      'add_section MoodBoard { moods: [...] }',
      'update_section chips { mode: "mood" }',
    ],
    state: { before: 'mood-before', after: 'mood-after' },
  },
  {
    id: 'bookshop',
    num: '05',
    surface: 'Home',
    kind: 'aesthetic',
    title: 'Make YouTube feel like a quiet bookshop',
    eyebrow: 'Aesthetic · Reset',
    lede: 'Cream paper, serif body type, hand-drawn rule lines between sections, thumbnails desaturated to a soft sepia, view counts and sub-counters hidden. Two-column "shelves" replace the dense grid. The whole page lowers its voice.',
    prompt: 'Make YouTube feel like a quiet independent bookshop. Cream paper, serif type, no view counts. Two-column shelves.',
    chat: [
      { who: 'agent', text: 'Switching to a paper-textured cream background, Source Serif for body type, and a 2-column "shelves" layout. Hiding view counts and posted-ago since those are the loudest pieces of metadata.' },
      { who: 'tool', name: 'update_theme', args: { mode: 'light', fontFamily: 'serif', radius: 'sm', background: { kind: 'paper', from: '#f3eee0' }, cardOverrides: { showStats: false, showTimestamp: false } } },
      { who: 'tool', name: 'update_section', args: { sectionId: 'videogrid', patch: { layout: 'shelves', columns: 2 } } },
      { who: 'tool', name: 'update_section', args: { sectionId: 'chips', patch: { visible: false } } },
      { who: 'agent', text: 'I left the search bar and sidebar functional but desaturated. The thumbnails are CSS-filtered to 25% saturation so they read as illustrations, not posters.' },
    ],
    friendlyMessages: [
      'Pulling out the warm paper background…',
      'Swapping in serif type — the kind a small press would use.',
      'Quieting the thumbnails to 25% saturation.',
    ],
    technicalMessages: [
      'update_theme { fontFamily: "serif", background: { kind:"paper" } }',
      'update_section videogrid { layout: "shelves" }',
      'add filter: saturate(0.25) on thumbnails',
      'hide chips section',
    ],
    state: { before: 'bookshop-before', after: 'bookshop-after' },
  },
  {
    id: 'unwatched',
    num: '06',
    surface: 'Home',
    kind: 'utility',
    title: "Only what I haven't watched, with the deep-dives on top",
    eyebrow: 'Feed · Filtering',
    lede: 'Every video the user has watched (or even partially watched) is dimmed and tagged. A toggle hides them entirely. The remaining feed re-sorts so long-form deep-dives — high "topical density" videos — float to the top.',
    prompt: "Only show me what I haven't watched. And put the long deep-dives on top, not the short stuff.",
    chat: [
      { who: 'agent', text: "I'll dim watched videos first so you can sanity-check the history match, then add a toggle to hide them entirely. Sort key becomes `(unwatched, densityScore desc, duration desc)`." },
      { who: 'tool', name: 'set_filter', args: { hideWatched: true, showWatchedOverlay: true } },
      { who: 'tool', name: 'set_sort', args: { by: 'density', order: 'desc', secondary: 'duration' } },
      { who: 'tool', name: 'add_section', args: { type: 'WatchHistoryToggle', props: { visible: true, defaultHidden: true } } },
      { who: 'agent', text: 'Density is computed as `unique_topic_tags / runtime_minutes`, normalized — so a 45-min deep-dive on one topic ranks higher than a 4-min trending clip with five tags.' },
    ],
    friendlyMessages: [
      'Cross-checking your history against the feed…',
      "Dimming the ones you've already seen.",
      'Re-sorting so the chunkier videos rise.',
    ],
    technicalMessages: [
      'set_filter hideWatched=true',
      'set_sort by=density secondary=duration',
      'add_section WatchHistoryToggle',
      'feed.sort((a,b) => density(b) - density(a))',
    ],
    state: { before: 'unwatched-before', after: 'unwatched-after' },
  },
];

// Notes drawer per scenario
export type NoteFile = [path: string, op: 'add' | 'edit', desc: string];

export interface ScenarioNote {
  summary: string;
  files: NoteFile[];
  schemaDelta: string;
  risks: string;
}

export const NOTES: Record<string, ScenarioNote> = {
  ambient: {
    summary: "A new section type plus a theme-background variant. The personalization layer subscribes to the player's current video and recomputes the page's ambient background each time the visitor switches tracks.",
    files: [
      ['packages/shared/src/schemas/sections.ts', 'add', 'New AmbientBackground section'],
      ['packages/shared/src/schemas/theme.ts', 'edit', 'BackgroundSchema gains kind: "sampled"'],
      ['apps/web/components/templates/AmbientBackground.tsx', 'add', 'Reads playingVideoId, samples palette, renders blob+grain+particles'],
      ['apps/web/lib/palette.ts', 'add', 'extractPalette(thumbnailUrl) → 3-color array via canvas k-means'],
      ['apps/web/lib/store.tsx', 'edit', 'Expose subscribePlayingVideo for AmbientBackground'],
      ['apps/web/lib/prompts/schema-catalog.ts', 'edit', 'Add AmbientBackground to the catalog so the model can call add_section'],
    ],
    schemaDelta: `// schemas/sections.ts
export const AmbientBackground = baseSection('AmbientBackground', {
  source: z.enum(['playingVideo', 'thumbnailGrid', 'fixed']).default('playingVideo'),
  intensity: z.number().min(0).max(1).default(0.7),
  grain: z.number().min(0).max(1).default(0.18),
  particles: z.enum(['none', 'mood', 'beat']).default('mood'),
});

// schemas/theme.ts
export const BackgroundSchema = z.union([
  z.object({ kind: z.literal('solid'), color: HEX }),
  z.object({ kind: z.literal('gradient'), from: HEX, to: HEX, angle: z.number() }),
  z.object({ kind: z.literal('sampled'), source: z.enum(['playingVideo', 'thumbnailGrid']) }), // NEW
]);`,
    risks: 'Palette extraction must be cached per video (canvas+image fetch is ~200ms each). The grain SVG should be a single instance, not a per-section asset. Be careful in dark mode — full-screen radial blobs at >0.7 intensity wash out card text.',
  },
  subtitles: {
    summary: 'A net-new section, plus a captions adapter that returns dual tracks. Lookup-based hover dictionary as v0; punt the OpenAI grammar-explainer to v1.',
    files: [
      ['packages/shared/src/schemas/sections.ts', 'add', 'New SubtitleTrack section type'],
      ['apps/web/lib/adapters/captions.ts', 'add', 'getCaptions(videoId, ["ko","en"]) wrapping youtubei v3'],
      ['apps/web/components/templates/SubtitleTrack.tsx', 'add', 'Stacked overlay with hover-define + pin handlers'],
      ['apps/web/lib/dict/ko-en.json', 'add', 'Static dictionary for v0 hover bubbles (~5k common entries)'],
      ['apps/web/lib/store.tsx', 'edit', 'pinnedVocab: Vocab[] and addPin(word) action'],
      ['apps/web/lib/prompts/schema-catalog.ts', 'edit', 'Register SubtitleTrack so the model can invoke it'],
    ],
    schemaDelta: `// schemas/sections.ts
export const SubtitleTrack = baseSection('SubtitleTrack', {
  primary: z.string().regex(/^[a-z]{2}$/),     // "ko"
  secondary: z.string().regex(/^[a-z]{2}$/).optional(), // "en"
  hoverDefine: z.boolean().default(true),
  vocabPin: z.boolean().default(true),
  position: z.enum(['overlay','below']).default('overlay'),
  size: z.enum(['sm','md','lg']).default('md'),
});`,
    risks: "YouTube's caption coverage is uneven for non-English. For videos without an official `ko` track we should fall back to auto-translate (`tlang=ko`), which is lower quality — surface this in the UI as \"auto-translated\" so learners aren't misled. Hover-define needs IME-aware tokenization for Korean (split on 어절 not character).",
  },
  sponsorskip: {
    summary: "Two parts: a chapters adapter (SponsorBlock-style data plus YouTube's native chapter markers), and a player-side handler that listens to timeupdate and seeks past the matching chapters.",
    files: [
      ['apps/web/lib/adapters/chapters.ts', 'add', 'getChapters(videoId) merging SponsorBlock API + native ytChapters'],
      ['apps/web/components/site/PlayerSkipper.tsx', 'add', 'Hooks into the YT iframe API; auto-seeks; renders toast'],
      ['packages/shared/src/page-config.ts', 'edit', 'FilterStateSchema gains chapterFilters: string[] and autoSkip: boolean'],
      ['apps/web/lib/queries/timeSaved.ts', 'add', 'SQL view: SUM(skip.duration) GROUP BY visitor_id, week'],
      ['supabase/migrations/0007_skip_log.sql', 'add', 'Append-only skip-event log table'],
      ['apps/web/components/templates/TimeSavedTally.tsx', 'add', 'New section showing the rolling weekly tally'],
    ],
    schemaDelta: `// page-config.ts → FilterStateSchema
{
  ...existing,
  chapterFilters: z.array(z.enum([
    'sponsor', 'intro', 'outro', 'recap', 'selfPromo', 'interaction'
  ])).default([]),
  autoSkip: z.boolean().default(false),
  showSkipToast: z.boolean().default(true),
}

-- supabase migration
CREATE TABLE skip_log (
  id BIGSERIAL PRIMARY KEY,
  visitor_id UUID NOT NULL REFERENCES visitors(id),
  video_id TEXT NOT NULL,
  chapter_kind TEXT NOT NULL,
  duration_seconds INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX skip_log_visitor_week ON skip_log (visitor_id, date_trunc('week', created_at));`,
    risks: "Mid-roll seek can break ads in monetized videos — must respect the iframe's ad state events. SponsorBlock data is community-edited and occasionally wrong; the toast must offer one-click \"this wasn't a sponsor\" reporting back upstream.",
  },
  mood: {
    summary: "A reorganization section that replaces VideoGrid's single-stream layout with mood-segmented blocks. Moods are derived from existing tags + duration heuristics — no new ML models, no per-visitor inference.",
    files: [
      ['packages/shared/src/schemas/sections.ts', 'add', 'New MoodBoard section'],
      ['apps/web/components/templates/MoodBoard.tsx', 'add', 'Renders mood blocks; reuses VideoCard'],
      ['apps/web/lib/mood.ts', 'add', 'classifyMood(video) → "focus"|"winddown"|... (deterministic)'],
      ['apps/web/components/templates/CategoryChips.tsx', 'edit', 'Add `mode: "category" | "mood"` prop'],
      ['apps/web/lib/prompts/editing-rules.ts', 'edit', 'Mood replaces grid; do not stack both. Document in few-shots.'],
    ],
    schemaDelta: `// schemas/sections.ts
export const MoodBoard = baseSection('MoodBoard', {
  moods: z.array(z.enum([
    'focus', 'winddown', 'sharpen', 'curious', 'social', 'physical'
  ])).default(['focus','winddown','sharpen','curious']),
  densityPerMood: z.record(z.enum(['compact','cozy','comfortable'])).default({}),
  timeOfDayBias: z.boolean().default(false),
});

// CategoryChips
{ ...existing, mode: z.enum(['category','mood']).default('category') }`,
    risks: "The mood classifier is content-only. The moment we start using watch history to predict mood, we're in a different product (and a different privacy posture). Keep the classifier deterministic and visible — let the user override the mood of any video by long-pressing it.",
  },
  bookshop: {
    summary: 'No new sections, but a new theme primitive (paper background) and a layout variant on VideoGrid. The thumbnail desaturation is pure CSS — no image transform on the server.',
    files: [
      ['packages/shared/src/schemas/theme.ts', 'edit', 'BackgroundSchema kind="paper"; add font: "serif" wired to Source Serif 4'],
      ['apps/web/components/templates/VideoGrid.tsx', 'edit', 'Add `layout: "grid" | "shelves"` branch'],
      ['apps/web/app/globals.css', 'edit', 'Paper texture as CSS noise + grain SVG, --yt-card-saturate var'],
      ['apps/web/components/templates/VideoCard.tsx', 'edit', 'Wire saturation + serif title font from theme vars'],
      ['apps/web/lib/prompts/schema-catalog.ts', 'edit', 'Document the "shelves" layout so the model can request it'],
    ],
    schemaDelta: `// schemas/theme.ts
export const BackgroundSchema = z.union([
  // ...existing
  z.object({
    kind: z.literal('paper'),
    from: HEX.default('#f3eee0'),
    grain: z.number().default(0.4),
  })
]);

// VideoGrid props
{ ...existing, layout: z.enum(['grid','shelves']).default('grid') }`,
    risks: 'Light-mode contrast: the cream background pushes #aaaaaa text below 4.5:1 — bump --yt-muted-fg to #6b6457 in light variants. Section dividers (the hand-drawn rule) need to be SVG, not CSS borders, to survive dark-mode toggling without re-rendering.',
  },
  unwatched: {
    summary: "Two pieces: (1) a watch-history table with a join into the feed query so VideoCard knows what's been watched, and (2) a `density` sort key derived from the existing tags + duration fields. No new content adapter required.",
    files: [
      ['supabase/migrations/0008_watch_history.sql', 'add', 'watch_history (visitor_id, video_id, fraction, last_watched_at)'],
      ['apps/web/lib/queries/feed.ts', 'edit', 'LEFT JOIN watch_history; expose fractionWatched on each Video'],
      ['apps/web/lib/sort.ts', 'add', 'densityScore(video) = uniqueTags / runtimeMin, normalized'],
      ['packages/shared/src/page-config.ts', 'edit', 'FilterStateSchema.hideWatched, SortStateSchema.by += "density"'],
      ['apps/web/components/templates/VideoCard.tsx', 'edit', 'Render dim+overlay when fractionWatched > 0.85'],
      ['apps/web/components/templates/WatchHistoryToggle.tsx', 'add', 'New section — pinnable toggle for hideWatched'],
    ],
    schemaDelta: `// page-config.ts
FilterStateSchema = z.object({
  ...existing,
  hideWatched: z.boolean().default(false),
  showWatchedOverlay: z.boolean().default(true),
  watchedThreshold: z.number().min(0).max(1).default(0.85),
});
SortStateSchema = z.object({
  by: z.enum(['recommended','recent','popular','duration','density']),
  secondary: z.enum(['recommended','recent','popular','duration','density']).optional(),
  order: z.enum(['asc','desc']),
});`,
    risks: "Watch-history is sensitive — must follow the existing visitor_id (cookie) scope, never leak across visitors. The density score is a heuristic, not truth; users will sometimes disagree (their favorite 4-min Vox explainer is \"denser\" to them than a 90-min lecture). Document the formula in the agent's editing rules so it can be explained.",
  },
};
