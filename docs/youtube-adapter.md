# YouTube Adapter (v0.5)

**Status**: Current architecture below is `youtubei.js` + Chrome-cookie extractor. Activated when `SHOWCASE_FEED_SOURCE=youtube`. The earlier Electron+CDP sidecar phases (1–5) are archived at the bottom of this document for reference.

## Current architecture (youtubei.js + Chrome cookies)

The youtube adapter runs entirely server-side from the Next.js app. There is no separate window for the user to keep open. On every `getFeed()` it:

1. Locates the user's local Chrome cookie SQLite store (`~/Library/Application Support/Google/Chrome/Default/Cookies` by default; falls back to `Profile 1` / `Profile 2`; honors `CHROME_COOKIE_PATH` env override).
2. Copies that file to a fresh temp directory (Chrome holds the original in WAL mode while running, so we read a snapshot rather than fight the lock).
3. Opens the snapshot read-only with `better-sqlite3` and selects every cookie whose `host_key LIKE '%youtube.com%'`.
4. For cookies whose `value` column is empty, decrypts `encrypted_value` using AES-128-CBC. The key is PBKDF2-SHA1(password, salt='saltysalt', iter=1003, keylen=16) with the password fetched from the macOS Keychain via `security find-generic-password -s "Chrome Safe Storage" -wa "Chrome"`. The IV is 16 bytes of `0x20`.
5. Composes a `Cookie:` header from the decrypted set and constructs an `Innertube` instance (`youtubei.js`) keyed on it.
6. Calls `innertube.getHomeFeed()`, walks the typed `feed.videos` / `feed.shelves` / `feed.page_contents.contents`, maps each node into our flat `Video` shape, and pulls 1–2 continuations to bring the catalog up to ~30 entries.
7. Returns `{ kind: 'ok', videos, sections: [], continuation: null, capturedAt }`. Anything else surfaces as `{ kind: 'unavailable', reason }` and the selector in `apps/web/lib/adapters/index.ts` returns an **empty feed** with a `console.warn`. The mock catalog it used to fall back to was removed.

Caching: the `Innertube` instance is held in-process for ~10 minutes (cookies don't change often). The keychain password is held in-process for the lifetime of the Node process.

### Data flow

```
apps/web/lib/queries/page.ts
    -> getAdapter() in apps/web/lib/adapters/index.ts
       -> getYoutubeFeed() in apps/web/lib/adapters/youtube.ts
          -> getHomeFeed() in apps/web/lib/innertube/client.ts
             -> createInnertube() (cached 10 min)
                -> readYoutubeCookies() in apps/web/lib/innertube/chrome-cookies.ts
                   -> snapshot Chrome's Cookies SQLite -> decrypt with keychain password
                -> Innertube.create({ cookie: <header> })
             -> innertube.getHomeFeed() -> walk + 1-2 continuations
          -> Video[]
```

### The macOS keychain prompt (first-run UX)

The first time the Next.js process calls `security find-generic-password ...`, macOS pops a system dialog:

> "**security** wants to use your confidential information stored in **"Chrome Safe Storage"** in your keychain."
>
> Buttons: **Always Allow** | Allow | Deny

Click **Always Allow**. After that the Node process can read the password silently every subsequent run on this machine. If the user clicks **Deny** (or closes the dialog), `readYoutubeCookies()` returns `cookies-unavailable` and the client retries anonymously — no crash, but a signed-out feed.

To revoke later, open `Keychain Access.app` -> `login` keychain -> search "Chrome Safe Storage" -> select the entry -> `Access Control` tab -> remove `security` from the allowed-apps list.

## Setup

One-time, by the user:

1. Confirm Chrome is installed (`/Applications/Google Chrome.app`). The adapter is macOS-only for now.
2. Open Chrome, navigate to youtube.com, and sign in normally. The cookies the adapter reads are the same cookies that authenticate your Chrome session.
3. Add `SHOWCASE_FEED_SOURCE=youtube` to `apps/web/.env.local` (the project's deny rules prevent the agent from editing this for you).
4. Restart `pnpm --filter @showcase/web dev`. On the first request, macOS prompts for keychain access — click **Always Allow**.
5. Hit `http://localhost:3000`. The home page should now show real YouTube videos from the user's logged-in account.

If anything in steps 1-4 fails, the page renders the mock 300-video catalog instead. The reason is logged once to the dev-server console (`[adapters] youtube fell back to mock: <reason>`).

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `keychain blocked or unavailable: ...` | User clicked Deny on the keychain prompt, or the keychain is locked. | Run `security unlock-keychain` (interactive), then refresh the page. macOS will re-prompt; click Always Allow. |
| `chrome cookie file not found (is Chrome installed?)` | Chrome not installed at the default path, or using a non-Default profile. | Set `CHROME_COOKIE_PATH=/full/path/to/Cookies` in `.env.local`. The adapter probes `Default`, `Profile 1`, `Profile 2` automatically before giving up. |
| `home feed parsed empty (cookie expired?)` | Auth cookie rotated or the user signed out of Chrome. | Sign in to youtube.com again in Chrome. The next page-load picks up fresh cookies (the 10-minute Innertube cache is invalidated on process restart, or call `clearInnertubeCache()` from `lib/innertube/client.ts` for a hot path). |
| `failed to snapshot cookie db: EBUSY` | Extremely rare on macOS — Chrome's WAL setup is normally readable while open. | Quit Chrome briefly, retry. The adapter reads a *copy*, never the live file, so this should not normally happen. |
| Page shows an empty feed | Server console will have a `[adapters] youtube feed unavailable (<reason>); serving empty feed` warning. | Read the reason; it points at one of the rows above. |
| Brave / Firefox / Safari not yet supported. | Different cookie store layout. | TODO. Brave is the closest port — same Chromium store at `~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies`, same v10/v11 prefix, same PBKDF2 params, but the keychain service name is different. Firefox uses an unencrypted `cookies.sqlite` (much simpler — no keychain). |
| Linux / Windows host. | Cookie-decrypt is platform-specific. | TODO. Linux: same algorithm but the password lives in GNOME keyring / KWallet (with a fallback "peanuts" for `v11`). Windows: DPAPI-protected, completely different code path. |

## Why we switched

The Electron+CDP sidecar (Phases 1-5 below) worked but had three problems:

1. **It required a second window open during the demo.** The user had to run `pnpm dev` in `apps/desktop` as well as `apps/web`, log in to YouTube inside that window, and keep it focused enough that the BrowserWindow didn't sleep. Brittle on a tight showcase clock.
2. **The CDP capture pipeline rotted as YouTube migrated to view models.** The hand-rolled mapper had to hand-decode `lockupViewModel.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0].text.content` and similar nested paths. `youtubei.js` already does this, defensively, with maintained typed accessors and a contributor base that catches drift within hours.
3. **CDP-style request reissue was a security and complexity tax.** Composing `Cookie:` from `session.fromPartition().cookies.get()` then re-firing the captured POST is fundamentally the same thing as just *using the cookies directly* — but we were doing it through a debugger attach, an HTTP IPC, and a localhost CORS check.

The new path collapses all three: one Node module reads cookies from disk, hands them to `youtubei.js`, gets back typed objects.

---

## Archived — Electron+CDP sidecar (Phases 1-5, see Current architecture above)

> The text below describes the prior implementation. It is preserved for reference; the desktop sidecar code at `apps/desktop/` is no longer wired into any build script. Do not extend this section — extend the current-architecture section above.

### Phase 1 status: scaffold + IPC stub

What was in:

- `apps/desktop` workspace member with strict TypeScript and `electron@^32`.
- `apps/desktop/src/main.ts` opened a 1280x900 `BrowserWindow` with `partition: 'persist:yt:default'` and loaded `https://www.youtube.com/`. Login persisted across boots.
- `apps/desktop/src/ipc-server.ts` ran a `node:http` server bound to `127.0.0.1:7321` (never `0.0.0.0`) with CORS limited to `http://localhost:3000`.
- `apps/web/lib/adapters/youtube.ts` was the IPC client. 2 s `AbortController` timeout. Returned `null` on any error.
- `apps/web/lib/adapters/index.ts` read `SHOWCASE_FEED_SOURCE` (`mock` | `youtube`, default `mock`) and fell back to the mock adapter if youtube returned `null`.

### Phase 2 status: CDP capture + reissue

- `apps/desktop/src/cdp-capture.ts` exported `createCdpCapture(win)`. It attached `webContents.debugger` (`'1.3'`), sent `Network.enable`, and listened for `Network.requestWillBeSent` matching `/\/youtubei\/v1\/(browse|next|search)/`. The most recent capture for each route kind was kept in memory.
- The `'message'` listener was attached **before** `Network.enable` resolved, so events that fired during the initial youtube.com page load weren't lost.
- Captured requests preserved URL, method, raw `postData`, and headers. CDP omits `Cookie` from `requestWillBeSent.headers` — so on every reissue we composed it manually from `session.fromPartition('persist:yt:default').cookies.get({ domain: '.youtube.com' })`.
- `reissue({ override: { continuation }, route })` cloned the latest capture for that route, swapped the body's `continuation` field if one was passed, and fired a plain `fetch()`.

### Phase 3 status: youtubei -> PageConfig mapper

- `apps/desktop/src/youtubei-mapper.ts` exported `mapBrowseResponse(json) -> { videos, sections, continuation }`. It walked `contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.richGridRenderer.contents` defensively. On shape drift the mapper *shrank* the result rather than failing.
- Synthetic fixture (`__fixtures__/browse-synthetic.json`) covered top-level `videoRenderer`, `richSectionRenderer` -> `richShelfRenderer`, `reelItemRenderer`, and `continuationItemRenderer`.
- 16 vitest tests pinned the section IDs, shelf headline propagation, shorts routing, continuation surfacing, and degenerate cases.

Section IDs the mapper emitted:

| Section ID | Type | Source |
| --- | --- | --- |
| `videoGrid` | `VideoGrid` | All top-level `videoRenderer` entries |
| `recommendedRow:<slugified-headline>` | `RecommendedRow` | Each `richShelfRenderer` |
| `shortsRow` | `ShortsRow` | All `reelItemRenderer` entries, aggregated |

### Phase 4 status: pagination + token-expiry recovery

- `/getMore?token=<base64>&route=browse` in `ipc-server.ts`. Validated the token and reissued with the override.
- `/reset` triggered `capture.forceRefresh()` (programmatic BrowserWindow reload) and returned 200 immediately.
- Auto re-attach on debugger `'detach'` events.
- 30-minute capture-staleness threshold on `isReady()`.
- `apps/web/lib/adapters/youtube.ts` was rewritten with discriminated unions: `getFeed()` returned `{ kind: 'ok' | 'not-ready' | 'shape-drift' | 'unavailable' }`; `getMore(token)` returned `{ kind: 'ok' | 'expired' | 'shape-drift' | 'unavailable' }`.

Failure modes and recovery:

| Reason code | HTTP | Recoverable | What to do |
| --- | --- | --- | --- |
| `capture-not-ready` | 503 | yes | Wait or `GET /reset`, then poll `/health`. |
| `continuation-expired` | 410 | yes | Drop the token and call `/getFeed`. |
| `network` | 502 | yes | Transient. Retry. |
| `shape-drift` | 502 | no | YouTube response shape changed. Re-capture fixture. |

### Phase 5 status: real-fixture validation + view-model support

- `apps/desktop/__fixtures__/browse-real.json` — the authoritative real-capture artifact.
- `apps/desktop/__tests__/youtubei-mapper.real.test.ts` (10 vitest tests).
- `MAPPER_VERSION` flipped to `'phase-5-real-validated'`.
- `looksLikeBrowseShape()` broadened to accept either `twoColumnBrowseResultsRenderer` or `onResponseReceivedActions[].appendContinuationItemsAction`.

The real /browse capture turned out to use the new "view model" architecture:

- Items live at `onResponseReceivedActions[0].appendContinuationItemsAction.continuationItems[]`.
- Each item is `{ richItemRenderer: { content: { lockupViewModel } } }` — *not* `videoRenderer`.
- `lockupViewModel.contentType` discriminated VIDEO / PLAYLIST / PODCAST / SHORT.
- Field paths the mapper read:
  - **id** — `lockupViewModel.contentId`
  - **title** — `lockupViewModel.metadata.lockupMetadataViewModel.title.content`
  - **channel name** — `lockupViewModel.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0].text.content`
  - **views text** — `metadataRows[1].metadataParts[0].text.content`
  - **postedAgo** — `metadataRows[1].metadataParts[1].text.content`
  - **thumbnail** — `lockupViewModel.contentImage.thumbnailViewModel.image.sources[]`
  - **duration** — scanned from `contentImage.thumbnailViewModel.overlays[].thumbnailBottomOverlayViewModel.badges[].thumbnailBadgeViewModel.text`

`youtubei.js` exposes typed accessors for all of the above, which is why the new architecture replaces this hand-rolled mapper.
