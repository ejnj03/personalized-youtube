export const SCHEMA_CATALOG = `## Section type catalog

Every section in the page has shape \`{ id: string, type: <one of below>, props: <type-specific> }\`. Use update_section to edit props by id.

### TopBar
Top navigation. Props:
  - logoText: string
  - searchPlaceholder: string
  - compactSearch: boolean — true shrinks search bar
  - showProfileChip: boolean

### Sidebar
Left navigation. Props:
  - collapsed: boolean — true hides labels, icon-only
  - pinnedItems: string[] — labels of items pinned at top
  - showSubscriptions: boolean

### CategoryChips
Horizontal filter chips above the grid. Props:
  - active: string — currently selected chip
  - chips: string[] — list of chip labels

### VideoGrid
Main feed grid. Props:
  - columns: 2 | 3 | 4 | 5
  - density: 'compact' | 'cozy' | 'comfortable' — compact hides description, smaller card; cozy is default; comfortable adds whitespace
  - videos: Video[] — managed by adapter; usually do NOT touch directly

### RecommendedRow
Horizontal carousel of recommendations. Props:
  - headline: string
  - videos: Video[] — managed by adapter
  - sources: Array<{ query: string, topN?: number }> — same contract as VideoGrid.sources. When you add_section a topical row ("Lo-fi, acoustic, jazz", "Indie game devlogs"), set \`sources\` with 1–3 concrete search queries; the row will populate from real /search results. Do NOT leave \`videos\` empty without \`sources\` — the row will render blank.

### ShortsRow
Short-form video shelf. Props:
  - visible: boolean — set false to hide entirely (or use remove_section)
  - headline: string
  - shorts: Short[]

### ContinueWatchingRow
Resume-where-you-left-off shelf. Props:
  - visible: boolean
  - headline: string
  - videos: Video[]

### FilterSummary
Pills showing what filters are currently active. Props:
  - visible: boolean
  - active: { label: string, kind: 'include'|'exclude'|'requireTag'|'blockChannel'|'sort' }[]
  Auto-managed when filters change. You can hide it.

### CustomNote
Visitor-defined note pinned to the page. Props:
  - text: string
  - visible: boolean

### MoodBoard
Replaces VideoGrid with mood-grouped sections. Use when visitor wants their feed grouped by vibe instead of recency. Props:
  - moods: { id, label, emoji, description, tags[] }[]   // ANY mood ids work; tags drive classification
  - densityPerMood: { [moodId]: 'compact'|'cozy'|'comfortable' }
  - videos: Video[]   // optional; falls back to the adjacent VideoGrid when empty
Pattern: \`remove_section videogrid\` then \`add_section MoodBoard\` with custom moods. Visitor says "decompress / sharpen / nostalgia"? Emit those exact mood ids.

### SubtitleTrack
Watch-page caption overlay. Props:
  - visible: boolean
  - primary: language code (e.g. 'ko','en','ja','es','fr')
  - secondary: language code (optional)
  - hoverDefine: boolean    // hover a word for vocab tooltip
  - vocabPin: boolean       // show pinned vocab list in side rail
  - position: 'overlay' | 'docked'
Pattern: \`add_section SubtitleTrack\` whenever visitor wants captions in any language pair. "Korean + English with hover dict" = primary:'ko', secondary:'en', hoverDefine:true.

### AmbientBackground
Full-bleed ambient background tied to a content source. Renders soft radial-blob colors derived from the source video. Props:
  - visible: boolean
  - source: 'playingVideo' | 'topVideo'
  - intensity: 0..1   // 0.7 reads as ambient, not casino
  - grain: 0..1       // 0.18 is the filmic sweet spot
  - particles: 'none' | 'mood' | 'snow' | 'embers' | 'clouds' | 'leaves' | 'rain' | 'stars'
    Each kind has its own physics:
      mood    — soft hue dots drifting upward (default vibe)
      snow    — white flakes settling slowly down
      embers  — orange sparks rising fast
      clouds  — wispy white shapes drifting horizontally (great for sky / dreamy / serene thumbnails)
      leaves  — autumn leaves spiral-falling
      rain    — fast diagonal streaks
      stars   — twinkling points in place (great for nighttime / space / cosmic vibes)
Pattern: "make the page breathe with what I'm watching" → \`add_section AmbientBackground { source:'playingVideo', intensity:0.7, grain:0.18, particles:'mood' }\` + maybe \`update_theme { chromeDim:0.12 }\` so chrome recedes.

### WatchHistoryToggle
Sidebar widget that flips filter.hideWatched / showWatchedOverlay. Props:
  - visible: boolean
  - defaultHidden: boolean
  - position: 'sidebar' | 'topbar' | 'inline'
Pair with \`set_filter { hideWatched:true }\` for the initial state.

### TimeSavedTally
Sidebar widget showing minutes saved by chapter auto-skip. Props:
  - visible: boolean
  - position: 'sidebar' | 'topbar' | 'inline'
  - minutesSavedThisWeek: number
Pair with \`set_filter { chapterFilters:['sponsor','intro','outro'], autoSkip:true }\`.

## Theme

Top-level theme object. Use update_theme.
  - mode: 'light' | 'dark'
  - accent: hex color string (#RRGGBB)
  - fontScale: '0.875' | '1' | '1.125' | '1.25'
  - fontFamily: one of:
    'inter'              — sans, neutral UI default, Linear/Figma/Notion feel
    'space-grotesk'      — sans, design-studio, gallery, contemporary art
    'bricolage'          — variable sans, indie editorial, has soul, 2024+ designer favorite
    'geist'              — sans, Vercel-current, terminal-product, very 2025
    'anton'              — condensed display, magazine cover, photography poster
    'big-shoulders'      — variable condensed, athletic editorial, Chicago, bold
    'unbounded'          — wide variable display, art-direction, current fashion
    'syne'               — geometric display with bumps, contemporary art, gallery posters
    'fraunces'           — variable expressive serif, indie editorial, warm
    'dm-serif'           — high-contrast serif, luxury, glamour
    'bodoni-moda'        — classic Vogue fashion editorial
    'cormorant'          — elegant italic-ready, wedding/soft luxury
    'newsreader'         — beautiful modern journalism, NYT-feel, longform
    'lora'               — cozy body serif, bookshop, journal
    'eb-garamond'        — classical historical serif, literary, formal
    'jetbrains'          — dev terminal classic
    'ibm-plex-mono'      — mono with character, archival, design-aware
    'space-mono'         — retro-futurist mono, 70s sci-fi, slightly weird
    'caveat'             — friendly handwriting, scrapbook, personal note
    'permanent-marker'   — bold sharpie, zine, lush, energetic
    'architects-daughter'— blueprint sketch, architectural notes, draftsman
    'fredoka'            — rounded soft sans, friendly, candy, kids/cute
    'monoton'            — art-deco neon signage, 1920s marquee, Vegas
    'bungee'             — urban transit signage, wayfinding, mural-ready
    // Legacy keys (kept for backward-compat with saved patches):
    'sans' | 'serif' | 'mono' | 'rounded' 
  - radius: 'none'|'sm'|'md'|'lg'|'xl'
  - chromeDim: 0..1   // dims TopBar+Sidebar so an ambient bg shines through
  - grain: 0..1       // global film grain overlay (looks great with sampled bg)
  - background: {
      kind: 'solid' | 'gradient' | 'paper' | 'sampled',
      from?: hex, to?: hex, angle?: 0..360,           // for gradient/solid/paper
      sampleSource?: 'playingVideo' | 'topVideo',     // for kind:'sampled'
      intensity?: 0..1                                 // for kind:'sampled'
    }
    Pattern: "feel like a quiet bookshop" → kind:'paper', from:'#f3eee0', PLUS update fontFamily:'serif'.
  - videoCardDefaults: {
      aspectRatio: '16:9'|'4:3'|'1:1'|'3:4',
      thumbnailScale: 0.5–2,
      titleWeight: 100–900,
      channelNameWeight: 100–900,
      showDescription / showViewCount / showPostedAgo / showDuration: boolean,
      cardLayout: 'vertical' | 'horizontal',
      hoverEffect: 'none' | 'lift' | 'zoom',
      thumbnailSaturate: 0..1.5,   // 0.25 = soft sepia, 1 = unchanged, 1.3 = vivid
      hideMeta: boolean             // hide views/age line
    }

VideoGrid section also has a \`layout: 'grid' | 'shelves' | 'list'\` prop. 'shelves' is a 2-column bookshop-style layout with section titles between groups.

VideoGrid also accepts curated-feed props that REPLACE the home feed with a union of search queries:
  - sources: Array<{ query: string, topN?: number }>  // each query is run against YouTube /search; top N from each is merged & deduped by video id. Existing set_filter applies on top (so set minSubscriberCount / excludeTitleMatches for quality cleanup).
  - schedule: { activeHoursLocal: [start, end] }      // 0-23, end exclusive. Wraps midnight when start>end. Outside the window the grid falls back to the static \`videos\` prop. Omit when the visitor doesn't name a time.
This is the right mechanism for prompts like "only show me playlists in the morning", "tune my feed for studying after dinner", or any persistent content curation. Use the iterative ask_user pattern (see editing rule 8) to gather 1–3 concrete keywords before composing the sources array.

## Filter and sort

Top-level state, edited via set_filter and set_sort:
  - filter: {
      include[], exclude[], requireTags[], blockChannels[],
      minDurationSeconds?, maxDurationSeconds?, minRating?,
      minSubscriberCount?, maxSubscriberCount?,
      hideWatched?: boolean,            // drop seen videos from the feed entirely
      showWatchedOverlay?: boolean,     // dim+badge instead of hiding
      chapterFilters?: string[],        // kinds whose segments the player auto-skips
      autoSkip?: boolean,               // whether chapterFilters actually seek
      moodFilter?: string,               // scope to one mood id
      requireLanguage?: 'en'|'ko'|'ja'|'zh'|'ar'|'ru',  // heuristic over title AND channel-name script — can't see caption tracks, so captioned-only English videos with non-English titles may still slip through or get dropped
      allowChannels?: string[],          // inverse of blockChannels — only these creators survive
      requireTitleMatches?: string[],    // keep videos whose title matches one — substring OR '/regex/flags'
      excludeTitleMatches?: string[],    // drop videos whose title matches one — same shape
      hideLive?: boolean,                // drop live/upcoming/premiere streams
      onlyLive?: boolean                 // only keep live/upcoming/premiere streams
    }
  - sort: {
      by: 'recommended'|'recent'|'popular'|'duration'|'density'|'mood',
      order: 'asc'|'desc',
      secondary?: 'recommended'|'recent'|'popular'|'duration'|'density',
      moodOrder?: string[]              // for sort.by==='mood'
    }
    'density' = topical-deep-dive score (long single-topic content rises). Pair with secondary:'duration' for the "deep-dives on top" prompt.

## Tag vocabulary (for filter matching)

Music subgenres: jazz, classical, chill, hip-hop, rock, electronic, indie, lofi, ambient, instrumental
Energy: high-energy, low-energy, chill, hype, calm
Format: tutorial, review, vlog, news, podcast, reaction, gameplay, walkthrough
Topic: gaming, cooking, tech, news, education, comedy, fitness, sports, science, history, kids, beauty, travel, diy, business, finance, fashion, photography, cars, climbing, woodworking, art, gardening, language
Mood: focus, winddown, sharpen, curious, decompress, nostalgia, deep, playful (open-ended — use whatever the visitor names)

When the visitor says "more chill jazz", that's requireTags: ['jazz', 'chill']. "Less bangers" is exclude: ['high-energy', 'hype'].

## Composing primitives creatively

These primitives compose. The 6 designed scenarios are starting points, not the only shapes. Examples of going further:
  - "Snowfall on the homepage when it's late" → AmbientBackground { particles:'snow', intensity:0.4 } + update_theme { chromeDim:0.1 }
  - "Make watching feel like a 1970s record store" → update_theme { background:{kind:'paper',from:'#e8dec3'}, fontFamily:'serif', videoCardDefaults:{thumbnailSaturate:0.4, hideMeta:true} } + update_section videogrid { layout:'shelves' }
  - "Only deep-dives I haven't watched, with a time-saved counter" → set_filter { hideWatched:true } + set_sort { by:'density', secondary:'duration' } + add_section TimeSavedTally
  - "Group by 'decompress / sharpen / nostalgia' and dim my watched stuff" → remove_section videogrid + add_section MoodBoard { moods:[{id:'decompress',...}, {id:'sharpen',...}, {id:'nostalgia',...}] } + set_filter { showWatchedOverlay:true }

Compose freely.`;
