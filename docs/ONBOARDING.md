# Onboarding — your first day in this codebase

Welcome. This doc is for you if you've heard a few of these terms before but haven't shipped production code with them. By the end of it you'll have:

1. The app running on your laptop
2. Made one tiny visible change to prove you can navigate the code
3. A mental model of the four moving parts that produce the magic

**This doc takes precedence over everything else when you're new.** Once you finish it, the other docs (ARCHITECTURE, GLOSSARY, decisions log) are reference material — you read them as needed, not cover to cover.

---

## Reading order across all docs

```
                   New here? START HERE.
                          │
              ┌───────────▼───────────┐
              │   docs/ONBOARDING.md  │  ← you are here
              │  (this file, ~30 min) │
              └───────────┬───────────┘
                          │
                  reach for as needed:
                          │
       ┌──────────────────┼─────────────────────┐
       │                  │                     │
       ▼                  ▼                     ▼
┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  README.md  │  │ docs/ARCHITECTURE│  │ docs/GLOSSARY   │
│ (run / use) │  │ (how it works)   │  │ (term lookup)   │
└─────────────┘  └──────────────────┘  └─────────────────┘
```

`docs/decisions.md` is a chronological log of judgment calls we made. You'll only ever read it if you're trying to understand *why* something is the way it is.

---

## Part 1: Get it running (10 min)

**Prereqs.** Install these once:
- [Node 20+](https://nodejs.org)
- pnpm 9+: run `corepack enable && corepack prepare pnpm@9 --activate`
- An [Anthropic API key](https://console.anthropic.com)
- A free [Supabase](https://supabase.com) project

**Run.**

```bash
git clone <repo-url> showcase
cd showcase
pnpm install
cp .env.example .env
```

Open `.env` and paste in your `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. (Find Supabase keys in your Supabase project → Settings → API.)

```bash
pnpm migrate                          # create tables
pnpm seed                             # generate the 168-video mock catalog (~$0.50, ~2 min)
pnpm --filter @showcase/web dev       # start the dev server
```

Open [http://localhost:3000](http://localhost:3000). You should see a YouTube-shaped page with mock videos.

**Try a prompt.** In the chat panel (bottom right):

> *use a green dark theme*

Watch the page recolor. Refresh the page — your green theme should stick.

Try one more:

> *show me only podcasts and cooking, hide the shorts row*

The grid filters and the shorts row disappears.

Click **Reset preferences** at the bottom of the chat to start fresh.

---

## Part 2: The four moving parts (5 min read)

You don't have to understand them deeply yet — just know they exist and where they live.

```
   ┌─────────────────────────────────────────────────────┐
   │  1. THE PAGE                                         │
   │     What you see in the browser. React components    │
   │     reading from a central store.                    │
   │                                                      │
   │     📁 apps/web/components/site/                      │
   │     📁 apps/web/components/templates/                 │
   └────────────────────────┬─────────────────────────────┘
                            │ reads from
                            ▼
   ┌─────────────────────────────────────────────────────┐
   │  2. THE STORE                                        │
   │     A bag of state — the current PageConfig (theme,  │
   │     sections, filter, sort).                         │
   │                                                      │
   │     📁 apps/web/lib/store.tsx                         │
   └─────┬─────────────────────────────────────────────┬──┘
         │ patches in                       reads back │
         │                                              │
         ▼                                              │
   ┌──────────────────────────────────┐                 │
   │  3. THE CHAT / AGENT             │                 │
   │     The visitor types a prompt.  │                 │
   │     /api/chat builds a system    │                 │
   │     prompt + tools, calls Claude.│                 │
   │     Claude emits patches. We     │                 │
   │     stream them to the store.    │                 │
   │                                  │                 │
   │     📁 apps/web/app/api/chat/     │                 │
   │     📁 apps/web/lib/prompts/      │                 │
   │     📁 packages/shared/src/       │                 │
   └──────────────────────────────────┘                 │
                                                        │
   ┌─────────────────────────────────────────────────────┘
   │
   ▼
   ┌─────────────────────────────────────────────────────┐
   │  4. PERSISTENCE                                      │
   │     Every patch is also saved to Supabase, keyed by  │
   │     the visitor's cookie. On reload we replay them.  │
   │                                                      │
   │     📁 apps/web/lib/queries/page.ts                   │
   │     📁 supabase/migrations/0001_init.sql              │
   └─────────────────────────────────────────────────────┘
```

**The whole product loop in one sentence:**
visitor talks → Claude emits patches → store applies them → page re-renders → patches saved → reload replays them.

If you want to go deeper on any one of these, read [architecture.md](./architecture.md). It walks the same loop in much more detail.

---

## Part 3: Make your first change (15 min)

Best way to get oriented is to ship a tiny change. Pick one:

### Easy: change the logo text

The "YouTube" wordmark in the top bar comes from `theme.sections[topBar].props.logoText`. Where to look:

1. The mock seed sets the initial value. Open [`scripts/seed.ts`](../scripts/seed.ts) and search for `'YouTube'`. You'll see `logoText: 'YouTube'`. Don't change it here yet.
2. The component that renders it is [`apps/web/components/templates/TopBar.tsx`](../apps/web/components/templates/TopBar.tsx). Read it — you'll see `<span>{logoText}</span>`.
3. **Make the change via chat instead of editing files.** In the running app, type *"change the logo to MyTube"*. Claude will emit `update_section({ sectionId: 'topBar', patch: { logoText: 'MyTube' } })`. Watch it apply.
4. Refresh — `MyTube` should still be there. (Open Supabase → preferences table to see your patch saved.)

That's the loop. **The point: you didn't write any code.** The chat panel + the existing schema + the LLM did it.

### Slightly harder: add a new theme color

Let's add a `'sepia'` mode option (in addition to `light` and `dark`).

1. Open the theme schema: [`packages/shared/src/schemas/theme.ts`](../packages/shared/src/schemas/theme.ts).
2. Find `mode: z.enum(['light', 'dark']).default('light'),` and add `'sepia'` to the list.
3. Open [`apps/web/components/site/PageRoot.tsx`](../apps/web/components/site/PageRoot.tsx) — search for `data-theme={config.theme.mode}`. The CSS variables are set based on this attribute.
4. In [`apps/web/app/globals.css`](../apps/web/app/globals.css) find the `[data-theme="dark"]` block and add a sibling `[data-theme="sepia"]` block with cream-y values.
5. Tell Claude about it: open [`apps/web/lib/prompts/schema-catalog.ts`](../apps/web/lib/prompts/schema-catalog.ts), find the `mode:` line under "Theme", and update it to `'light' | 'dark' | 'sepia'`.
6. Save everything. Restart the dev server (`lib/` changes don't hot-reload).
7. In the running app, type *"use sepia mode"*. Should work.

You just touched four layers: schema, render, CSS, and the LLM teaching layer. That's the whole stack.

### Harder: add a whole new section type

If you want to flex more, [ARCHITECTURE.md "Want to extend it?"](./ARCHITECTURE.md#want-to-extend-it) walks through adding a new section type end-to-end.

---

## Part 4: Common gotchas

A handful of things that will trip you up early:

**"My change isn't showing up."**
- Did you restart the dev server? Anything under `apps/web/lib/`, `packages/shared/`, or any `.env` change requires a restart. Component file changes do hot-reload.
- Is the change behind your visitor cookie's saved patches? Click **Reset preferences** in the chat panel.

**"The chat says it changed something but the page didn't update."**
- Hard-reload (Cmd-Shift-R). Sometimes the JS bundle is stale.
- Check the network tab — did `/api/chat` actually return a `patch` event?

**"I'm seeing TypeScript errors I don't understand."**
- Run `pnpm --filter @showcase/web typecheck` to get them all. Most of the time it's a schema change in `packages/shared/` that needs another component to update.

**"The YouTube path won't work for me."**
- That's fine — it requires Chrome on macOS. Stay in mock mode (the default). Mock mode supports 95% of the personalization story.

---

## Part 5: Finding things in the codebase

If you're hunting for where something lives, here's the cheat-sheet:

| You're looking for… | Look in… |
|---|---|
| "What does the page look like" | `apps/web/components/site/` and `apps/web/components/templates/` |
| "How does X section render" | `apps/web/components/templates/X.tsx` |
| "What can the chat actually change" | `packages/shared/src/page-config.ts` + `packages/shared/src/schemas/` |
| "How does the LLM know what to do" | `apps/web/lib/prompts/` (system, schema-catalog, editing-rules) |
| "Where does the chat get sent" | `apps/web/app/api/chat/route.ts` |
| "Where do videos come from" | `apps/web/lib/adapters/` and `apps/web/lib/innertube/` |
| "How are preferences saved" | `apps/web/lib/queries/page.ts` + `supabase/migrations/` |
| "What ports / env vars" | `.env.example` + `apps/web/package.json` (scripts) |

---

## Part 6: When to reach for which doc

You're done with onboarding. Here's how to keep learning:

- **Building something new?** → [ARCHITECTURE.md](./ARCHITECTURE.md) — the deep dive.
- **Don't know what a word means?** → [GLOSSARY.md](./GLOSSARY.md) — terms.
- **Wondering "why is it like this?"** → [decisions.md](./decisions.md) — chronological log of design judgment calls.
- **Trying to deploy?** → [`../DEPLOY.md`](../DEPLOY.md).
- **Want to know how the YouTube cookies path works?** → [`./youtube-adapter.md`](./youtube-adapter.md).

You don't need to read any of those right now. Come back to them when a specific question lands.

Welcome to the team.
