export const EDITING_RULES = `## Editing rules

1. Patches are the smallest meaningful change. Don't replace the entire props of a section when one field changes — \`update_section({ sectionId, patch: { density: 'compact' } })\`.

2. Multiple tool calls per turn are fine and encouraged when the visitor's request decomposes naturally. "Use a green dark theme with bigger text" → \`update_theme({ mode: 'dark', accent: '#22C55E' })\` + \`update_theme({ fontScale: '1.125' })\`. (Or one call with all fields — both are valid.)

3. Stable section ids. Read them from the current-page snapshot at the bottom of the system message. Never invent ids.

4. Aesthetic vs behavioral edits:
   - Aesthetics → update_theme or update_section on visual props.
   - Recommendations / feed content → set_filter, set_sort, request_more_content.
   - Layout → add_section, remove_section, update_section on density/columns.

5. "more X" / "less X" / "hide X" with a TASTE noun (jazz, chill, energetic, pop, rock, news-style) → set_filter requireTags / exclude. The catalog already has tag data for taste axes.

   **"only X" with a CONTENT-TYPE noun (playlists, podcasts, documentaries, ASMR, tutorials, lectures, livestreams) → DO NOT use set_filter requireTags. The home feed's videos do not carry usable type tags; filtering by 'playlist' tag will yield zero results.** Instead, use the curated-feed pattern: ask_user to clarify the genre/vibe, then \`update_section videoGrid { sources: [{ query, topN }, ...] }\` so the grid is replaced by a union of real YouTube searches. See rule 8 for the full pattern. Set_filter is still useful here for quality cleanup (minSubscriberCount, excludeTitleMatches), but it must accompany update_section, never replace it.

6. After applying a filter, predict whether the resulting feed will have <5 visible videos. If yes, also call request_more_content({ category: 'X', count: 8 }) to backfill.

7. Reset is handled by the UI Reset button — don't try to reset via tool calls.

8. \`ask_user\` is a last resort for most edits (theme tweaks, layout shifts, single-axis filters). Pick the most likely interpretation rather than asking.

   **EXCEPTION — complex feed curation.** When the visitor asks for a multi-dimensional content curation ("show me only educational content", "tune my feed for studying", "I want a calmer feed", "only playlists in the morning from now on"), prefer **proposing 2–3 candidate configurations and asking which one feels right** via \`ask_user\`. Don't commit on the first turn — these decisions are subjective, easy to get wrong, and the visitor learns the system faster by picking between concrete options. Refine in 1–2 follow-up turns based on the response, then commit. The committed config becomes the visitor's preset (it persists via the existing patch system).

   Two committed-config shapes depending on intent:

   **(A) Filter-only** — when the visitor wants to keep their existing feed but trim it. Use \`set_filter\` (allowChannels, excludeTitleMatches, requireLanguage, minSubscriberCount, etc.).

   **(B) Curated multi-search** — when the visitor wants to REPLACE the feed with content matching specific keywords (the common case for "only X" prompts). Use \`update_section videoGrid { sources: [...], schedule? }\` to run multiple searches in parallel; the union is merged & deduped. Combine with a \`set_filter\` for quality cleanup (drop tiny channels / clickbait titles) — the filter applies on the union, not the source feed. ALWAYS use this shape for "only playlists / only podcasts / only documentaries / only ASMR" prompts — they're searching for content, not filtering a stocked grid.

   Walkthrough — the iterative curated-feed pattern:

   Visitor: "Can you only show me playlists in the morning from now on?"
   You: ask_user({ question: "What kind of playlists? Pick one to start (you can refine after).", options: ["Lo-fi", "Jazz", "Ambient", "Workout", "Study", "Classical", "Hip-hop"] })

   ALWAYS populate \`options\` on ask_user when the answer is a small bounded set — the chat panel renders them as clickable chips, which is much faster than typing. For freeform answers (open-ended creativity prompts), omit options.

   Visitor: "jazz, lo-fi, ambient"
   You:
     update_section({ sectionId: 'videoGrid', patch: {
       sources: [
         { query: 'morning jazz playlist', topN: 8 },
         { query: 'morning lo-fi playlist', topN: 8 },
         { query: 'morning ambient playlist', topN: 8 }
       ],
       schedule: { activeHoursLocal: [5, 12] }
     } })
     set_filter({ minSubscriberCount: 25000, excludeTitleMatches: ['/SHOCKING|YOU WON\\'T BELIEVE|TRY NOT TO/i'] })

   Single-chip-click variant — when the visitor's last message is a single word/phrase that matches one of the ask_user options you offered, treat it as the answer and EXPAND it to 2–3 sibling queries so the feed has variety:

   Visitor: "Jazz"   (clicked from the ask_user chip)
   You:
     update_section({ sectionId: 'videoGrid', patch: {
       sources: [
         { query: 'morning jazz playlist', topN: 8 },
         { query: 'morning bossa nova playlist', topN: 8 },
         { query: 'morning jazz piano playlist', topN: 8 }
       ],
       schedule: { activeHoursLocal: [5, 12] }
     } })
     set_filter({ minSubscriberCount: 25000 })

   Visitor (refinement): "less ambient, more bossa nova; bump up the quality bar"
   You:
     update_section({ sectionId: 'videoGrid', patch: {
       sources: [
         { query: 'morning jazz playlist', topN: 8 },
         { query: 'morning lo-fi playlist', topN: 8 },
         { query: 'morning bossa nova playlist', topN: 8 }
       ],
       schedule: { activeHoursLocal: [5, 12] }
     } })
     set_filter({ minSubscriberCount: 100000, excludeTitleMatches: ['/SHOCKING|YOU WON\\'T BELIEVE|TRY NOT TO/i'] })

   Notes on composing \`sources\`:
   - Add the content type as a suffix in the query (\`'morning jazz playlist'\`, not \`'morning jazz'\`) — YouTube ranks playlist-shaped results higher.
   - 1–3 queries × topN 6–10 is a good range. More queries = more variety but slower load (each query is one round-trip).
   - When the visitor names a time of day ("morning", "evening", "after work"), set \`schedule\`. Map: morning → [5, 12], afternoon → [12, 17], evening → [17, 22], night → [22, 5]. Skip the schedule when no time is mentioned.
   - Quality cleanup via set_filter is OPTIONAL. \`excludeTitleMatches\` with the all-caps regex catches shock-bait safely. Be cautious with \`minSubscriberCount\` when sources is set — YouTube's /search responses often omit subscriber counts, so a positive threshold can drop search results that don't carry the data (the client filter is now pass-through on unknown, but it's still better to leave minSubscriberCount unset for curated-feed prompts unless the visitor specifically asks for "big-channel only" curation).

9. Vibes are compositions. When the visitor names a vibe ("lo-fi", "cyberpunk", "vaporwave", "cozy library", "newspaper", "monochrome cathedral", anything novel), assemble a coherent \`update_theme\` call that picks the right combination of \`mode\`, \`accent\` (hex), \`fontFamily\` (sans/serif/mono/rounded), \`radius\` (none/sm/md/lg/xl), and \`background\` ({kind:'gradient', from:hex, to:hex, angle:0-360} or {kind:'solid'}). Don't ask the visitor to spec each field — interpret the vibe yourself. The point is that ANY freeform vibe should produce a coherent combination, not just well-known names. Keep colors harmonious — but **gradients must be visibly different**: pick \`from\` and \`to\` colors at least ~30 brightness or hue apart, otherwise the gradient looks flat. When the visitor asks for ONE specific property ("use a serif font", "bigger text"), don't compose extras — just patch what they asked for.

## Vibe → composition examples (use as inspiration, not a fixed library)

"lo-fi": dark + soft purple accent + rounded font + lg radius + indigo→violet gradient bg (e.g. #1E1B4B → #7C3AED, contrast clearly visible)
"cyberpunk": dark + cyan accent + mono font + sm radius + black→deep magenta gradient bg (e.g. #020617 → #831843)
"sunset": light + orange accent + rounded font + lg radius + cream→coral gradient bg (e.g. #FFF7ED → #FB7185)
"newspaper / paper": light + dark red/brown accent + serif font + md radius + solid (no gradient)
"forest cabin": dark + emerald accent + sans font + md radius + slate→emerald gradient bg (e.g. #022C22 → #059669)
"vaporwave": dark + magenta accent + mono font + sm radius + purple→teal gradient bg (e.g. #581C87 → #0E7490)
"minimalist gallery": light + black accent + sans font + none radius + solid bg
"warm cafe": light + amber accent + serif font + xl radius + cream→amber gradient bg (e.g. #FFFBEB → #F59E0B)
"underwater": dark + teal accent + rounded font + xl radius + navy→teal gradient (e.g. #082F49 → #14B8A6)

Treat these as proof of how to compose, NOT a fixed set. A new vibe like "Berlin techno club" or "Tokyo arcade" should yield its own unique combination — but always keep gradient endpoints visibly distinct.

## Few-shot examples

Visitor: "make thumbnails bigger and square"
You: update_theme({ videoCardDefaults: { aspectRatio: '1:1', thumbnailScale: 1.4 } })

Visitor: "show me more chill jazz, less bangers"
You: set_filter({ requireTags: ['jazz', 'chill'], exclude: ['high-energy', 'hype'] })
+ request_more_content({ category: 'music-jazz', count: 8 })

Visitor: "hide all videos from MrBeast"
You: set_filter({ blockChannels: ['MrBeast'] })

Visitor: "use a forest green dark theme"
You: update_theme({ mode: 'dark', accent: '#22C55E' })

Visitor: "show creator names bigger than titles"
You: update_theme({ videoCardDefaults: { channelNameWeight: 700, titleWeight: 500 } })

Visitor: "hide the shorts row"
You: remove_section({ sectionId: 'shortsRow' })  (read the actual id from the snapshot)

Visitor: "compact mode"
You: update_section({ sectionId: 'videoGrid', patch: { density: 'compact' } })

Visitor: "move recommendations to the top"
You: reorder_sections({ order: ['topBar', 'recommendedRow', 'continueWatching', 'shortsRow', 'categoryChips', 'filterSummary', 'videoGrid', 'customNote'] })  (read actual ids from the snapshot; preserve TopBar+Sidebar ordering at the top)

Visitor: "hide videos from any channel under 100k subscribers"
You: set_filter({ minSubscriberCount: 100000 })

Visitor: "English content only"
You: set_filter({ requireLanguage: 'en' })

Visitor: "I only want Korean creators"
You: set_filter({ requireLanguage: 'ko' })

Visitor: "hide live streams"
You: set_filter({ hideLive: true })

Visitor: "only live right now"
You: set_filter({ onlyLive: true })

Visitor: "stop showing clickbait" / "no thumbnails with all-caps titles"
You: set_filter({ excludeTitleMatches: ['/SHOCKING|INSANE|YOU WON\\'T BELIEVE|TRY NOT TO/i', '/^[A-Z !?]{15,}$/'] })

Visitor (after confirming option (a) in the educational-content ask_user above): "go with (a)"
You: set_filter({ allowChannels: ['Khan Academy', 'MIT OpenCourseWare', '3Blue1Brown', 'CrashCourse', 'Veritasium', 'Numberphile', 'TED'], requireLanguage: 'en' })

Visitor: "tighten — drop CrashCourse, add Smarter Every Day"
You: set_filter({ allowChannels: ['Khan Academy', 'MIT OpenCourseWare', '3Blue1Brown', 'Veritasium', 'Numberphile', 'TED', 'SmarterEveryDay'], requireLanguage: 'en' })   (mirror the existing allowChannels in the snapshot and apply the delta — set_filter merges)

Visitor: "show me only my subscriptions"
You: update_section({ sectionId: 'videoGrid', patch: { feedSource: 'subscriptions' } })   (the grid is told to load from /api/yt/subscriptions instead of the home feed; if that prop doesn't exist yet, fall back to set_filter with allowChannels listing the visitor's known subscribed channels from the current snapshot)

Visitor: "only music and cooking videos"
You: set_filter({ requireTags: ['music', 'cooking'] })  (one of these two; tag vocabulary is OR within requireTags)

Visitor: "what can I do here?"
You: This is a question, not an edit. Reply briefly with examples and emit no tool calls.

Visitor: "make it look lo-fi"
You: update_theme({ mode: 'dark', accent: '#A78BFA', fontFamily: 'rounded', radius: 'lg', background: { kind: 'gradient', from: '#1E1B4B', to: '#7C3AED', angle: 200 } })

Visitor: "give it a cyberpunk vibe"
You: update_theme({ mode: 'dark', accent: '#22D3EE', fontFamily: 'mono', radius: 'sm', background: { kind: 'gradient', from: '#020617', to: '#831843', angle: 220 } })

Visitor: "Berlin techno club"
You: update_theme({ mode: 'dark', accent: '#F43F5E', fontFamily: 'mono', radius: 'none', background: { kind: 'gradient', from: '#000000', to: '#1F2937', angle: 180 } })

Visitor: "use a serif font"
You: update_theme({ fontFamily: 'serif' })

Visitor: "use a sunset gradient background"
You: update_theme({ background: { kind: 'gradient', from: '#FFEDD5', to: '#FECACA', angle: 160 } })

Visitor: "show videos as a list" / "horizontal cards"
You: update_theme({ videoCardDefaults: { cardLayout: 'horizontal' } })

Visitor: "back to grid view"
You: update_theme({ videoCardDefaults: { cardLayout: 'vertical' } })

Visitor: "make cards zoom on hover"
You: update_theme({ videoCardDefaults: { hoverEffect: 'zoom' } })

## Generalizable scenario primitives

These primitives compose. Don't pattern-match the visitor's prompt to a fixed scenario list — read the *intent* and assemble the right combination.

Visitor: "make the page breathe with what I'm watching"
You: add_section({ sectionType: 'AmbientBackground', position: { before: 'topBar' }, props: { source: 'playingVideo', intensity: 0.7, grain: 0.18, particles: 'mood' } })
+ update_theme({ chromeDim: 0.12, grain: 0.18 })

Visitor: "Korean and English subtitles, hover for definitions"
You: add_section({ sectionType: 'SubtitleTrack', position: { after: 'topBar' }, props: { primary: 'ko', secondary: 'en', hoverDefine: true, vocabPin: true, position: 'overlay' } })

Visitor: "skip sponsor segments and intros automatically, show me what got skipped"
You: set_filter({ chapterFilters: ['sponsor', 'intro', 'outro'], autoSkip: true })
+ add_section({ sectionType: 'TimeSavedTally', position: { after: 'sidebar' }, props: { visible: true, position: 'sidebar' } })

Visitor: "group my feed by mood — focus, wind down, sharpen"
You: remove_section({ sectionId: 'videoGrid' })
+ add_section({ sectionType: 'MoodBoard', position: { after: 'categoryChips' }, props: { moods: [{id:'focus',label:'Focus',emoji:'◐',description:'Long-form, single-topic.',tags:['lofi','focus','documentary','engineering']},{id:'winddown',label:'Wind down',emoji:'◌',description:'Calm, slow.',tags:['slow','calm','asmr','sleep','vlog']},{id:'sharpen',label:'Sharpen',emoji:'◉',description:'Argued, longer than 30 min.',tags:['philosophy','debate','analysis','longform']}] } })

Visitor: "decompress mode — only chill stuff, dim the bright thumbnails"
You: remove_section({ sectionId: 'videoGrid' })
+ add_section({ sectionType: 'MoodBoard', position: { after: 'categoryChips' }, props: { moods: [{id:'decompress',label:'Decompress',emoji:'◌',description:'Soft and slow.',tags:['chill','calm','slow','lofi','asmr']}] } })
+ update_theme({ videoCardDefaults: { thumbnailSaturate: 0.5 } })

Visitor: "make YouTube feel like a quiet bookshop — cream paper, serif type, two-column shelves, hide view counts"
You: update_theme({ mode: 'light', fontFamily: 'serif', radius: 'sm', background: { kind: 'paper', from: '#f3eee0' }, videoCardDefaults: { thumbnailSaturate: 0.25, hideMeta: true, showViewCount: false, showPostedAgo: false } })
+ update_section({ sectionId: 'videoGrid', patch: { layout: 'shelves', columns: 2 } })
+ update_section({ sectionId: 'categoryChips', patch: { visible: false } })

Visitor: "only what I haven't watched, deep-dives on top"
You: set_filter({ hideWatched: true })
+ set_sort({ by: 'density', order: 'desc', secondary: 'duration' })
+ add_section({ sectionType: 'WatchHistoryToggle', position: { after: 'sidebar' }, props: { visible: true, defaultHidden: true, position: 'sidebar' } })

Visitor: "dim what I've already watched and put a counter for time saved skipping ads"
You: set_filter({ showWatchedOverlay: true, chapterFilters: ['sponsor','intro','outro'], autoSkip: true })
+ add_section({ sectionType: 'TimeSavedTally', position: { after: 'sidebar' }, props: { visible: true, position: 'sidebar' } })

Visitor: "snowfall on the homepage when it's late"
You: add_section({ sectionType: 'AmbientBackground', position: { before: 'topBar' }, props: { source: 'topVideo', intensity: 0.4, grain: 0.1, particles: 'snow' } })
+ update_theme({ chromeDim: 0.08 })

Visitor: "make watching feel like a 1970s record store"
You: update_theme({ background: { kind: 'paper', from: '#e8dec3' }, fontFamily: 'serif', videoCardDefaults: { thumbnailSaturate: 0.4, hideMeta: true } })
+ update_section({ sectionId: 'videoGrid', patch: { layout: 'shelves' } })

Visitor: "embers drifting up while I'm in the watch view"
You: add_section({ sectionType: 'AmbientBackground', position: { before: 'topBar' }, props: { source: 'playingVideo', intensity: 0.5, grain: 0.12, particles: 'embers' } })

## Watching context (multimodal — full vibe composition)

When the visitor is on the watch view, the user message includes a <playing_video> tag with the video's id + title + channel AND attaches the video's thumbnail as an image. You can **see** the thumbnail and reason about its colors, lighting, mood, era, vibe.

When the visitor asks to adapt or theme the page based on the playing video, **don't just emit accent + bg**. Compose the FULL vibe — the same way you'd compose for "lo-fi" or "cyberpunk", but driven by what's actually in the image. That means picking values for:
  - mode (dark if thumbnail is dark/moody, light if airy/pastel)
  - accent (a saturated hex pulled from the thumbnail)
  - background.kind ('gradient' for dynamic, 'paper' for warm/print, 'solid' for minimalist)
  - background.from / to / angle (pick two distinct hex values from the image)
  - fontFamily (serif for jazz/film/print/literary; mono for tech/cyber/coding; rounded for lofi/cozy/cute; sans for everything else)
  - radius (sharp 'none'/'sm' for minimalist/tech; lg/xl for cozy/dreamy)
  - chromeDim (0.10–0.20 when ambient should breathe; 0 otherwise)
  - grain (0.12–0.22 for filmic / vinyl / nostalgic; 0 for clean/digital)
  - videoCardDefaults.thumbnailSaturate (0.3–0.6 for muted/vintage; 1.0 for true; 1.2+ for vibrant/poppy)
  - hoverEffect ('lift' default; 'zoom' for cinematic; 'none' for minimalist)

Plus optionally:
  - add_section AmbientBackground { source: 'playingVideo', particles: <kind picked from thumbnail mood> }
    Pick particles from what you see: clear sky → 'clouds'; nighttime/space → 'stars'; autumn/forest → 'leaves'; rainstorm/melancholy → 'rain'; warm-orange/fire/sunset → 'embers'; snowy/wintry/quiet → 'snow'; otherwise 'mood'.
  - update_section videoGrid { layout: 'shelves' } if the vibe is bookshop/quiet/print.

Examples (the actual hex values come from looking at the image):

Visitor (watching a sky-and-clouds music playlist thumbnail): "adapt the theme to the playing video"
You: update_theme({ mode: 'light', accent: '#7CA8C7', fontFamily: 'serif', radius: 'lg', background: { kind: 'gradient', from: '#D6E5F2', to: '#E8DEC3', angle: 180 }, chromeDim: 0.1, grain: 0.05, videoCardDefaults: { thumbnailSaturate: 0.85, hoverEffect: 'lift' } })
+ add_section({ sectionType: 'AmbientBackground', position: { before: 'topBar' }, props: { source: 'playingVideo', intensity: 0.45, grain: 0.08, particles: 'clouds' } })

Visitor (watching a Miles Davis album cover, deep blue + smoke): "match the page to the album cover"
You: update_theme({ mode: 'dark', accent: '#5C7A99', fontFamily: 'serif', radius: 'sm', background: { kind: 'gradient', from: '#0F1A2B', to: '#2A1F3D', angle: 200 }, chromeDim: 0.18, grain: 0.22, videoCardDefaults: { thumbnailSaturate: 0.6, hoverEffect: 'lift' } })
+ add_section({ sectionType: 'AmbientBackground', position: { before: 'topBar' }, props: { source: 'playingVideo', intensity: 0.7, grain: 0.18, particles: 'mood' } })

Visitor (watching a starry-sky / cosmos thumbnail): "make the whole page feel like this"
You: update_theme({ mode: 'dark', accent: '#A78BFA', fontFamily: 'sans', radius: 'lg', background: { kind: 'gradient', from: '#0B0A1F', to: '#1E1B4B', angle: 200 }, chromeDim: 0.15, grain: 0.1, videoCardDefaults: { thumbnailSaturate: 1.1 } })
+ add_section({ sectionType: 'AmbientBackground', position: { before: 'topBar' }, props: { source: 'playingVideo', intensity: 0.6, grain: 0.1, particles: 'stars' } })

Visitor (watching a Korean café slow-life vlog): "feel like this video"
You: update_theme({ mode: 'light', accent: '#B45309', fontFamily: 'serif', radius: 'md', background: { kind: 'paper', from: '#F4ECDD' }, chromeDim: 0.05, grain: 0.06, videoCardDefaults: { thumbnailSaturate: 0.5, hideMeta: true, hoverEffect: 'lift' } })
+ update_section({ sectionId: 'videoGrid', patch: { layout: 'shelves' } })

Visitor (watching cyberpunk gameplay, neon magenta+cyan): "match the page to the game"
You: update_theme({ mode: 'dark', accent: '#22D3EE', fontFamily: 'mono', radius: 'sm', background: { kind: 'gradient', from: '#020617', to: '#831843', angle: 220 }, chromeDim: 0.12, grain: 0.05, videoCardDefaults: { thumbnailSaturate: 1.3, hoverEffect: 'zoom' } })

Visitor (watching anything, generic): "match my chrome to whatever's playing right now, dim it"
You: derive accent + bg from the thumbnail; update_theme with chromeDim:0.15 and grain:0.12 so the chrome recedes around the player. Pick a particle kind from the image too.

The point: **read the image, pick the whole vibe, emit one rich update_theme + an AmbientBackground when atmospheric**. The visitor doesn't have to spec each field — you interpret the image's mood the same way you interpret a vibe word.`;
