# Chat Panel

`<ChatPanel>` is the floating chat UI your visitors type into. It's a complete, batteries-included component: input, streaming responses, mode pills, history, and a reset affordance. Mount it anywhere inside [`<PersonalizationRoot>`](getting-started.md#4-create-the-host--mount-the-provider).

```tsx
import { ChatPanel } from '@showcase/sdk';

<ChatPanel host={host} pageSlug="myapp" apiUrl="/api/chat" />
```

It reads the live config/dispatch and the mode list from the provider's context, so you don't wire any of that yourself.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `host` | `HostConfig` | — | from `defineHost()`. Required. |
| `pageSlug` | `string` | — | identifies this page to the server/persistence. Required. |
| `apiUrl` | `string` | `'/api/chat'` | where chat messages POST. |
| `modesApiUrl` | `string` | `apiBase + '/modes'` | list/create modes. |
| `pageApiUrl` | `string` | `apiBase + '/page'` | fetch a mode's merged config (on switch). |
| `resetApiUrl` | `string` | `apiBase + '/reset'` | where "reset preferences" POSTs. |
| `dispatch` | `(patch) => void` | from context | override how patches apply (e.g. to add logging). |
| `onReset` | `() => void` | built-in | replace the default reset behavior. |
| `onToolUse` | `(name, input) => void` | — | observe each tool call (e.g. to drive UI). |
| `onRequestMoreContent` | `(input) => void` | — | handle the `request_more_content` tool (host fetches data). |
| `onAskUser` | `(input) => void` | — | handle the `ask_user` tool. |

> `apiBase` is derived from `apiUrl` — e.g. `apiUrl='https://x/api/chat'` ⇒ modes at `https://x/api/modes`. Override individually if your routes differ.

## Endpoints it expects

The panel talks to a small set of routes. The chat one is the SDK's [`createChatHandler`](server.md); the rest are tiny host routes (the [YouTube clone](../../../apps/web/app/api/) has copyable versions):

| Method & path | Purpose |
|---|---|
| `POST {apiUrl}` | send a message → streamed patches (the SDK handler) |
| `GET {modesApiUrl}?slug&visitorId` | list the visitor's modes |
| `POST {modesApiUrl}` `{slug, visitorId, title}` | create a mode |
| `GET {pageApiUrl}?slug&visitorId&modeId` | a mode's merged config (used when switching) |
| `GET {apiBase}/chat/history?slug&visitorId&modeId` | a mode's transcript |
| `POST {resetApiUrl}` `{slug, visitorId, modeId}` | wipe the active mode |

## Modes, handled for you

On mount the panel loads modes (creating a "Default" if none), restores the active one, and loads its config + history. The pills let visitors **switch** (loads that slot's config/transcript) and **create** new slots. You only provide the endpoints above — the UI and the localStorage bookkeeping are built in. → **[Persistence → modes](persistence.md#modes-save-slots-come-for-free)**

## Custom tool handlers

Some tools are pure side-effects your host owns — fetching more data, asking the user a question. Hand the panel a callback and it'll fire on the matching tool call:

```tsx
<ChatPanel
  host={host}
  pageSlug="myapp"
  onRequestMoreContent={async (input) => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(input.category)}`);
    const { items } = await res.json();
    // dispatch a patch to drop the new items into a section…
  }}
/>
```

See the YouTube clone's wrapper for a worked example (it handles `request_more_content` and a domain-specific reset): [`apps/web/components/chat/ChatPanel.tsx`](../../../apps/web/components/chat/ChatPanel.tsx).

## Styling

Import the stylesheet once (anywhere in your app):

```ts
import '@showcase/sdk/styles.css';
```

The panel reads your [theme tokens](theme.md) (`var(--bg)`, `var(--accent)`, …), so it automatically matches whatever palette is active.

## See also

- **[Server](server.md)** — the routes behind these endpoints.
- **[Getting Started](getting-started.md)** — mounting the panel in context.
- **[Persistence](persistence.md)** — what backs the mode pills.
