# Decisions Log

Append-only. Every domain agent (schema-keeper, api-keeper, persistence-keeper,
etc.) appends a one-line entry here when it makes a non-trivial decision. Format:

```
- YYYY-MM-DD — agent — short title.
  Decision: <what>.
  Why: <why>.
```

> **How to read this file.** It is a historical record, so entries are **not**
> corrected when the world moves on — that would destroy the point of keeping
> it. Several early entries reason about things that no longer exist: a mock
> video catalog, a Supabase backend, `set_filter` / `set_sort` tools, an
> Electron sidecar, and a `feed-curator` agent. Those entries are still true
> about *what was decided at the time*.
>
> Superseded entries are marked inline with **`[SUPERSEDED YYYY-MM-DD]`** and a
> pointer. If an entry has no marker, it has not been audited rather than
> confirmed current. For what is true **now**, read
> [architecture.md](./architecture.md) and [CLAUDE.md](../CLAUDE.md).

## 2026-04-29 — youtube-adapter — swap Electron+CDP for youtubei.js + Chrome cookies

- Decision: replace the Electron sidecar (apps/desktop) with a server-side path: `apps/web/lib/innertube/chrome-cookies.ts` reads YouTube cookies from the user's local Chrome cookie SQLite, and `apps/web/lib/innertube/client.ts` drives `youtubei.js@17.0.1` against that cookie header. The adapter (`apps/web/lib/adapters/youtube.ts`) is a thin wrapper preserving the existing `FeedResult` discriminated union.
  Why: the Electron path required the user to keep a second window open during the demo, which was brittle on a tight showcase clock. `youtubei.js` is a maintained Node library that already provides typed accessors for every `lockupViewModel` / `videoRenderer` / `gridVideoRenderer` field path the hand-rolled Phase-5 mapper had to decode by hand. Reading cookies systematically from Chrome on disk eliminates the manual-paste / browser-extension UX we were trying to avoid.
- Decision: roll our own minimal Chrome-cookie extractor instead of using `chrome-cookies-secure` (the popular npm package). The macOS algorithm is small enough to inline (PBKDF2-SHA1 → AES-128-CBC, 16 bytes of 0x20 IV, prefix `v10`/`v11`) and `chrome-cookies-secure` is unmaintained (last release 2023) and pulls in `keytar` / native bindings we don't need. The extractor lives at `apps/web/lib/innertube/chrome-cookies.ts`; macOS-only for now (Linux GNOME-keyring / KWallet and Windows DPAPI are documented as TODO in `docs/youtube-adapter.md`).
  Why: smaller dependency surface, narrower attack surface (cookies grant full account access — every line in this path is auditable), and the algorithm is stable since Chrome v80 (2020).
- Decision: snapshot the Chrome cookie SQLite to a temp directory before reading, and never write back. Chrome holds the live file in WAL mode while running; copying gives us a stable read-only view without fighting the lock.
  Why: we considered closing Chrome / locking the WAL / using a `?mode=ro&immutable=1` URI, but a copy is the only approach that's correct regardless of whether Chrome is running.
- Decision: cache the `Innertube` instance in-process for 10 minutes, and the keychain password for the lifetime of the process. Cookies don't change often during a dev session and the keychain prompt is not idempotent — re-shelling out to `security find-generic-password` would re-prompt the user.
  Why: keep the first-run UX to one prompt (Always Allow), and amortize the ~1s `Innertube.create()` over many requests. The 10-minute cap is the upper bound on stale cookies surfaced from the on-disk store; 10 min is short enough that the user doesn't have to restart the dev server after re-logging into Chrome.
- Decision: drop the `getMore` / pagination surface from the adapter. `youtubei.js` exposes `feed.getContinuation()` and the new client walks 1-2 continuations internally to bring the catalog up to ~30 entries before returning a single `Video[]`. The selector in `adapters/index.ts` no longer needs to chain `getMore` calls.
  Why: the prior IPC surface was paginated because CDP capture was paginated. youtubei.js already aggregates internally; exposing pagination through our adapter would be wrapping the library to provide less than it offers natively.
- Decision: never log raw cookie values. Count-only log lines (`loaded N cookies for youtube.com`); error messages mask payloads through `_maskValueForDiagnostics`. `decisions.md` and `youtube-adapter.md` document this expectation; `apps/web/lib/innertube/chrome-cookies.ts` enforces it.
  Why: cookies grant full account access. A stray `console.log(cookies)` in dev would spill SAPISID / SSID / HSID into the dev-server output and from there into terminal scrollback / tmux logs / Cursor's pty buffer.
- Decision: leave `apps/desktop/` source files in place but tag every entry point with a `// SUPERSEDED 2026-04-29` block at the top, and unwire the workspace member from any build script (root `package.json` and `turbo.json` were already free of explicit desktop references — the new path simply doesn't depend on it).
  Why: the desktop tree carries the Phase-1-through-5 prior-art (CDP capture, lockupViewModel field paths, real fixture). Deleting it would burn the recovery path if youtubei.js ever stops working. Marking it superseded is cheap.

## 2026-04-29 — youtube-adapter — Phase 5 real-fixture validation + view-model support

- Decision: support both `videoRenderer` (legacy) and `lockupViewModel` (current) shapes simultaneously rather than migrating off the legacy path. The real /browse capture (`apps/desktop/__fixtures__/browse-real.json`) revealed YouTube has moved to a "view model" architecture (`lockupViewModel` with a `contentType` discriminator), but the synthetic fixture's `videoRenderer` path is still observed on some initial-load responses. Keeping both is cheap (one extra dispatcher branch) and means an in-flight A/B rollout on YouTube's side cannot break the mapper. The 21 real videos in the fixture are now all extracted via the new path.
- Decision: handle YouTube's continuation responses (`onResponseReceivedActions[].appendContinuationItemsAction`) explicitly, alongside the documented `contents.twoColumnBrowseResultsRenderer` initial-load path. Clicking the Home logo in a logged-in session re-fetches via continuation rather than a full page load — the captured fixture is exactly that. Without this branch the mapper produced zero items against real data even with `lockupViewModel` support landed. `looksLikeBrowseShape()` in `ipc-server.ts` was broadened to accept either shape so the predicate doesn't reject real responses as `shape-drift` upstream of the mapper.
- Decision: skip `LOCKUP_CONTENT_TYPE_PLAYLIST` / `PODCAST` / `MIX` rather than synthesize a video card from them. The showcase has no playlist surface yet; faking one as a video would yield clicks that 404 the watch endpoint. Helpers (`readLockupThumbnail`) already probe the playlist `collectionThumbnailViewModel` path so a future PlaylistRow section can plug in without retouching the dispatcher.
- Decision: belt-and-suspenders id filter — `mapLockupVideo` returns null for ids starting with `PL` or `RD` even if `contentType === 'LOCKUP_CONTENT_TYPE_VIDEO'`. The discriminator is the primary defense, but YouTube has been observed to mislabel container ids on edge cases; the filter caps the blast radius.
- Decision: read lockup metadata by row/part position (`metadataRows[0].metadataParts[0]` = channel, `metadataRows[1].metadataParts[0]` = views, `metadataRows[1].metadataParts[1]` = postedAgo) rather than scanning by content. Position has been consistent across all 21 sample videos (and across video / live / very-old / very-new postedAgo formats). Scanning would either need a regex per row (brittle to localized strings — Korean / Japanese / Hangul are present in the fixture) or a heuristic that's worse than position. Missing rows/parts collapse to '' / 0 — no throws.
- Decision: bumped `MAPPER_VERSION` from `'phase-3-synthetic'` to `'phase-5-real-validated'`. Operators see the bump in `/health` output; the dated suffix convention lets the next shape-drift cycle land as `'phase-5-real-validated-YYYY-MM-DD'` without renaming the constant.
- Decision: keep `/raw` through the next capture cycle rather than deleting it as the original Phase 5 plan called for. YouTube's view-model migration is mid-flight — a fresh `/raw` snapshot is the fastest path to diagnose any future drift, and the endpoint is localhost-only + CORS-restricted so the surface is acceptable.

## 2026-04-29 — youtube-adapter — Phase 4 pagination + token-expiry recovery landed

- Decision: explicit `shape-drift` 502 over silent empty result. The mapper is defensive (never throws, only shrinks), which means a shape change upstream would otherwise yield a 200 with `{ videos: [], sections: [] }` indistinguishable from a genuinely empty feed. Surfacing it as `502 { reason: 'shape-drift', recoverable: false }` makes Phase 5 fixture replacement a real signal — operators see the warn, the web client falls back to mock, the engineer captures a fresh fixture.
- Decision: 30-minute staleness threshold on `isReady()`. YouTube's `INNERTUBE_CONTEXT` (visitorData, X-Goog-* headers) typically rotates over many hours, so 30 min is conservative-but-cheap: small enough to surface "force a /reset" before the user runs into a hard 401, large enough to avoid forcing reloads during normal demo sessions.
- Decision: four reason codes, three of them recoverable. `capture-not-ready` (503, recoverable), `continuation-expired` (410, recoverable — drop token, refetch first page), `network` (502, recoverable — transient), `shape-drift` (502, NOT recoverable — Phase 5 needed). Recoverability is encoded in the response body so the caller branches on `kind` rather than HTTP status alone.
- Decision: `/reset` is fire-and-forget over GET. Async because reload + recapture takes seconds and would HTTP-time-out. GET (vs POST) because the IPC contract is GET-only and the surface is localhost+restricted-CORS, so CSRF posture is not in scope. Caller polls `/health` until `captureReady && captureAge < 30000`.
- Decision: `/getMore?route=next` returns 501 explicitly rather than silently returning empty. The mapper doesn't yet handle `compactVideoRenderer` (watch-page shape), and silently failing would mask the gap. Phase 5+ extends the mapper.
- Decision: discriminated unions in `apps/web/lib/adapters/youtube.ts`. `getFeed()` returns `{ kind: 'ok' | 'not-ready' | 'shape-drift' | 'unavailable' }`; `getMore()` returns `{ kind: 'ok' | 'expired' | 'shape-drift' | 'unavailable' }`. The selector in `adapters/index.ts` only forwards `'ok'` to the FeedAdapter contract; everything else falls back to mock with a `console.warn`. Cleaner than the previous "throw on any non-ok" pattern.
- Decision: auto-reattach on the debugger `'detach'` event. Without this, opening devtools (or a transient detach) bricks the capture until window-reload. We log the reason and best-effort reattach; if devtools is the cause the reattach fails and we stay detached until `/reset`.

## 2026-04-29 — youtube-adapter — Phase 3 youtubei -> PageConfig mapper landed

- Decision: synthetic-fixture-first. The user has not yet logged into the Electron BrowserWindow, so we have no real captured browse JSON. Wrote `apps/desktop/__fixtures__/browse-synthetic.json` against the *documented* youtubei shape (per the agent brief §"Mapping youtubei -> PageConfig") instead of waiting for capture. Phase 5 will replace it with a real `/raw` capture (`browse-real.json`) and rerun tests; the diff catches anywhere the brief is stale.
- Decision: mapper is hand-rolled defensive narrowing (`isObject` + `?.` + `Array.isArray`), not Zod parse. Zod's strict-object validation would force us either to schema every youtubei renderer (huge surface that rotates every few months) or throw on shape drift — neither acceptable for a sidecar that has to keep returning *something*. Hand-rolled narrowing means shape drift can only *shrink* the result, never crash it.
- Decision: stable section IDs — `videoGrid` (single VideoGrid for all top-level videoRenderers), `recommendedRow:<slugified-headline>` (one per richShelfRenderer), `shortsRow` (single ShortsRow for all reelItemRenderers). Stable IDs let chat patches keep targeting the same section across reissues.
- Decision: `/raw` retained through Phase 3 (was originally Phase-2-only) so the engineer can capture real youtubei JSON for fixture replacement without redeploying. Phase 5 deletes it after `browse-real.json` validates the mapper.
- Decision: `/getFeed` now returns `{ ok, videos, sections, capturedAt }` on success, 503 `{ ok: false, reason: 'capture-not-ready' }` when the user hasn't logged in yet, 502 with the surfaced error otherwise. The web adapter treats any non-2xx as "fall back to mock" and `console.warn`s the reason for ops visibility.
- Decision: added `mapperVersion: 'phase-3-synthetic'` to `/health`. Phase 5 flips it to `'phase-3-real'` after the fixture swap. Cheap forward indicator that doesn't require a new endpoint.

## 2026-04-29 — youtube-adapter — Phase 2 CDP capture + reissue landed

- Decision: re-issue captured `/youtubei/v1/(browse|next|search)` POSTs via plain `fetch()` rather than tee'ing CDP response bodies. Re-issue is required for pagination anyway (we mutate the body's `continuation` field), and it keeps us off `Network.responseBody` / chunked-transfer handling.
- Decision: compose `Cookie` manually on every reissue from `session.fromPartition('persist:yt:default').cookies.get({ domain: '.youtube.com' })`. CDP's `Network.requestWillBeSent.headers` deliberately omits `Cookie`, so without this step every reissue would 401.
- Decision: attach the debugger `'message'` listener **before** awaiting `Network.enable`. The first `/youtubei/v1/browse` POST youtube.com fires can race the resolution of `enable`; attaching the listener up-front avoids missed events without requiring a retry loop.
- Decision: capture errors are surfaced via `{ ok, status, json, error }` rather than thrown. The IPC layer is GET-only and synchronous from the web app's perspective; throwing would force every endpoint into try/catch.
- Decision: added a `GET /raw?route=browse|next|search` IPC endpoint as a Phase-2-only verification surface. It returns the raw youtubei JSON. Phase 3 replaces it with the mapped `/getFeed` and removes `/raw`.

## 2026-04-29 — youtube-adapter — Phase 1 scaffold + IPC stub landed

- Decision: scaffolded `apps/desktop` (Electron `^32`, strict TS) with a localhost-only IPC server on `127.0.0.1:7321` exposing `GET /health` and a stub `GET /getFeed -> { sections: [] }`. CDP capture and youtubei mapper are deliberately stubbed (`captureYoutubeiContext`, `mapYoutubeiToSections` throw `not implemented in phase 1`); they land in Phases 2 and 3.
- Decision: `apps/web/lib/adapters/index.ts` now reads `SHOWCASE_FEED_SOURCE` (`mock` default, `youtube` opt-in) and falls back to the mock adapter when the youtube sidecar is unreachable or capture is not ready. `FEED_ADAPTER` is preserved as a legacy alias so existing envs keep working. The mock adapter is untouched.
- TOS posture (per agent brief): the sidecar runs on the user's own machine with their own logged-in cookies — the same posture as a browser extension that filters your own feed. Reasonable for showcase / educational use; production must move to the YouTube Data API and accept its quotas.

## 2026-04-29 — main session — Track D fixed: visitor state was bloating user message

- Resolved: cache hit ratio was stuck at 21% because `buildVisitorState` serialized full `sections.props` into the user message — including all 60 videos in the VideoGrid (~15K tokens). User message has no `cache_control`, so this content was sent uncached every turn.
- Fix: `app/api/chat/route.ts` now builds a compact `sectionSummaries` array — id, type, and a 1-line stub for each prop (arrays of objects collapse to `[N items]`, nested objects truncate to 120 chars). LLM has full schema knowledge from `SCHEMA_CATALOG`; it doesn't need the actual video data to call `update_section`.
- Result: cost per turn $0.33 → $0.034 (10×), cache hit ratio 21% → 80%, input tokens 21300 → 1366.
- Bonus finding: `role` block (782 tokens) is below Anthropic's 1024-token cache minimum, so its `cache_control` marker is silently skipped. No action needed — `schemaCatalog` (1342 tok) and `editingRules` (1053 tok) cache correctly.

## 2026-04-29 — main session — Track B complete, tag-matching quality TODO

- **[SUPERSEDED 2026-08-14]** `set_filter` no longer exists as a tool, the mock
  catalog and its Haiku tag generation are gone, and `feed-curator` was deleted.
  Tag matching against real YouTube data is a different problem; if it recurs,
  file a fresh issue rather than reviving this TODO.
- TODO (api-keeper / feed-curator): set_filter requireTags is exact-string. Claude often emits compound tags like "underwater photography" that don't match a filter on `'photography'`. Result: 0 visible videos when filter and Haiku-generated tags don't align. Mitigations: (a) substring/fuzzy match in VideoGrid.applyFilter, (b) prompt Claude to use consistent tag splits ("underwater" + "photography" instead of "underwater photography"), (c) feed-curator post-processes Haiku output to split compound tags. Choose one before showcase.

## 2026-04-29 — main session — known issues from v0 smoke test

- TODO (api-keeper): cache hit ratio is stuck at ~21% across turns. Tools array auto-caches and reads (5601 tokens). System blocks with explicit `cache_control` write on turn 1 (21319 tokens) but do NOT read on turn 2 despite identical content. Investigate whether SDK is serializing `cache_control` correctly or whether some subtle string difference in `buildSystemBlocks` breaks the match. Reproduce: send 2 sequential chat messages within 5 minutes; expected cacheReadTokens ≈ 26920, actual 5601.

## 2026-04-29 — main session — bootstrap

- **[SUPERSEDED 2026-08-14]** The mock-data stage and the CDP/Electron path were
  both later removed. Real YouTube via in-process Chrome cookies is the only
  source; see the 2026-04-29 youtube-adapter entry above and
  [architecture.md](./architecture.md).
- Decision: pivot from "auto-decode any URL" to "hand-built YouTube clone with personalization." Mock data v0; youtube-adapter (CDP-intercepted youtubei) v0.5.
  Why: showcase impact > technical novelty. YouTube is universally recognized; hand-built shell eliminates Day-1 decoder risk.
- Decision: cookie-anonymous visitor identity. UUID in HttpOnly cookie. No login.
  Why: zero-friction showcase. Sticky preferences without authentication overhead.
- Decision: project root `cs_197/showcase/` (named `showcase` not `personalize` to keep room for non-YouTube clones later).
  Why: per user preference.
- **[SUPERSEDED 2026-08-14]** Still 7 tools, but a different 7: `set_filter` and
  `set_sort` were dropped (filter and sort became `PageConfig` fields edited via
  `update_section`) and `reorder_sections` was added. Current list:
  [`packages/sdk/src/core/tool-defs.ts`](../packages/sdk/src/core/tool-defs.ts).
  Note the original entry also listed eight items under the heading "7 chat tools".
- Decision: 7 chat tools — `update_section`, `update_theme`, `set_filter`, `set_sort`, `add_section`, `remove_section`, `request_more_content`, `ask_user`.
  Why: covers aesthetic + behavioral personalization. `request_more_content` solves arbitrary-niche-query coverage when mock catalog is thin.
- **[SUPERSEDED 2026-08-14]** Now 7: `feed-curator` and `research-runner` were
  deleted (both owned only deleted files), and `db-keeper` became
  `persistence-keeper`. See the ownership table in [CLAUDE.md](../CLAUDE.md).
- Decision: 8 specialist subagents in `.claude/agents/` (research-runner, schema-keeper, template-author, api-keeper, db-keeper, feed-curator, youtube-adapter, debugger) + cache-doctor. Main session is orchestrator only.
  Why: prevent context bloat across multi-week build. Each agent owns disjoint slice; main session sees only summaries.
