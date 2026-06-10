<!--
  Thanks for contributing! Keep PRs scoped to one workspace where possible.
  See CONTRIBUTING.md for conventions (the /core import boundary, Zod-as-source-
  of-truth, append-only migrations, stable section IDs, prompt-cache ordering).
-->

## What & why

What does this change, and what problem does it solve? Link any related issue (`Closes #…`).

## Area

- [ ] `@showcase/sdk` (engine)
- [ ] YouTube clone (`apps/web`)
- [ ] Spotify clone (`spotify-react-web-client`)
- [ ] `packages/shared`
- [ ] Docs / wiki
- [ ] CI / tooling

## How I verified

How you tested it (manual steps, what you saw). For chat/personalization changes, include the prompt(s) you tried.

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (or N/A)
- [ ] Followed the [conventions](../CONTRIBUTING.md#conventions-that-matter) (esp. the `/core` import boundary and append-only migrations)
- [ ] Updated docs in `packages/sdk/docs/` if I changed a public SDK API
- [ ] Changes are scoped to one workspace where reasonable

## Notes for reviewers

Anything to look at first, trade-offs, or follow-ups.
