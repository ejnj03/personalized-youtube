-- One-shot reset: remove stale `videoCardDefaults` from the preferences.patch
-- JSONB. Run once after the schema migration that introduced cardPreset /
-- cardOverrides / layoutPreset (see packages/shared/src/schemas/theme.ts).
--
-- Effect on visitors: anyone who'd customized a video-card field (aspect
-- ratio, thumbnail saturation, hide-meta, etc.) sees those cards reset to
-- the default `video_card` preset on next page load. Everyone else is
-- untouched. No new theme defaults are written — that happens organically
-- via Zod parsing the next time the visitor's PageConfig is built.
--
-- Run with:
--   psql "$DATABASE_URL" -f scripts/reset-videocard-defaults.sql
-- or via Supabase SQL editor.

update preferences
  set patch = patch #- '{theme,videoCardDefaults}'
  where patch->'theme' ? 'videoCardDefaults';

-- Verify (should return 0 rows):
-- select id, mode_id, patch->'theme'->'videoCardDefaults' as still_present
--   from preferences
--   where patch->'theme' ? 'videoCardDefaults';
