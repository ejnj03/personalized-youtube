# Deploy

## Vercel (showcase)

### One-time setup

```bash
# 1. Authenticate (opens browser)
vercel login

# 2. From repo root, link to a new project
cd /Users/ejun22/Desktop/projects25_26/cs_197/showcase
vercel link
# Answer prompts:
#   Link to existing? N
#   What's your project name? showcase
#   In which directory is your code? ./
#   (Vercel will detect Next.js + pnpm workspaces from vercel.json)

# 3. Push env vars (paste each value when prompted)
vercel env add ANTHROPIC_API_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add FEED_ADAPTER production   # answer: mock

# Optional: also push to preview environment
vercel env add ANTHROPIC_API_KEY preview
# ... (repeat for each)
```

### Deploy

```bash
# Preview build (free, gets a unique URL)
vercel

# Production build (replaces the production URL)
vercel --prod
```

The build runs `pnpm --filter web build` per `vercel.json`. Output URL is printed when complete.

### After deploy

- Visit the URL. Cookie middleware should set `visitor_id` on first visit.
- Send a chat message to verify Anthropic + Supabase connections work in production.
- Check Vercel function logs if something fails: `vercel logs <deployment-url>`.

### Things to watch

- `api/generate-content` has `maxDuration: 30` — Hobby plan caps function runtime at 10s. Pro plan gets 60s. If you're on Hobby and Haiku takes >10s, the request will be killed mid-stream. Mitigation: switch to Pro, or reduce `count` from 8 to 4 in `request_more_content`.
- Cookies are `SameSite=Lax`. Visitors viewing through a third-party iframe (e.g., embedded somewhere) may not get a stable visitor_id.
- The mock catalog (`apps/web/lib/mock-data/videos.json`) is bundled into the build. ~300 videos × ~600 bytes each = ~180KB JSON shipped to the server. Acceptable.

## Local production preview

```bash
pnpm --filter web build
pnpm --filter web start    # runs at http://localhost:3000
```

This uses the production build but with local env vars from `apps/web/.env.local` (the symlink).

## Database

Schema is managed by `pnpm migrate` (script applies SQL files via the Supabase Management API). To add a new migration:

1. Create `supabase/migrations/0002_<name>.sql`
2. Run `pnpm migrate` — applies any new files (the script enumerates and runs all sorted)
3. Commit the migration file
