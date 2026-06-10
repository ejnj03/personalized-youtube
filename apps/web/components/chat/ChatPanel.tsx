'use client';

import { useEffect, useRef } from 'react';
import { ChatPanel as SdkChatPanel, usePersonalization } from '@showcase/sdk';
import type { Video } from '@showcase/shared';
import { usePageStore } from '@/lib/store';
import { host } from '@/lib/personalization';

export function ChatPanel({ pageSlug }: { pageSlug: string }) {
  // YT-specific state lives in YT's existing store — read what we need.
  const { dispatch, replace, config } = usePageStore();

  // The SDK ChatPanel owns mode (save-slot) state and tracks the active mode
  // in localStorage. Observe it here so we can mirror it into the server-side
  // `mode_id` cookie — that cookie is what the SSR page loader and the
  // cookie-scoped routes resolve to. Without this sync, a reload would
  // SSR-render a different mode than the chat panel is showing.
  const { activeMode } = usePersonalization();
  const syncedModeId = useRef<string | null>(null);
  useEffect(() => {
    if (!activeMode || activeMode.id === syncedModeId.current) return;
    syncedModeId.current = activeMode.id;
    void fetch('/api/modes/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: pageSlug, modeId: activeMode.id }),
    }).catch(() => {
      /* best-effort; the next switch/reload retries */
    });
  }, [activeMode, pageSlug]);

  return (
    <SdkChatPanel
      host={host}
      pageSlug={pageSlug}
      // Stage 7d: the SDK ChatPanel now reads `dispatch` from <PersonalizationRoot>
      // (mounted via <PageStoreProvider> → usePageStore). The explicit prop is no
      // longer needed for Claude → store patches.
      //
      // YT-specific handler for `request_more_content`: fetch more videos
      // and dispatch a section update with the new items.
      onRequestMoreContent={async (input) => {
        const query = input.style ? `${input.category} ${input.style}` : input.category;
        const limit = input.count ?? 8;
        const res = await fetch(`/api/yt/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { videos?: Video[] };
        const newVideos = (data.videos ?? []).slice(0, limit);
        if (newVideos.length === 0) return;

        const grid = config.sections.find((s) => s.type === 'VideoGrid');
        if (!grid) return;
        const currentVideos = (grid.props as { videos?: Video[] }).videos ?? [];
        // SDK MediaFeed semantics on the config-driven grid: replace → SWAP
        // ("only X"), otherwise APPEND ("more X"), deduped by video id.
        const seen = new Set(currentVideos.map((v) => v.id));
        const fresh = newVideos.filter((v) => !seen.has(v.id));
        const videos = input.replace ? newVideos : [...currentVideos, ...fresh];
        dispatch(
          {
            op: 'update_section',
            sectionId: grid.id,
            patch: { videos },
          },
          { trace: true },
        );
      }}
      // YT-specific Reset handler. Scope it to the ACTIVE mode (other save-slots
      // untouched), then reload that mode's merged config from the DB — we can't
      // use the SDK's default reset because it replaces with host.initialConfig
      // (the empty stub), not the seeded YouTube page.
      onReset={async () => {
        const modeQ = activeMode ? `&modeId=${encodeURIComponent(activeMode.id)}` : '';
        await fetch(`/api/reset?slug=${encodeURIComponent(pageSlug)}${modeQ}`, { method: 'POST' });
        const res = await fetch(`/api/page?slug=${encodeURIComponent(pageSlug)}${modeQ}`);
        const data = await res.json();
        if (data.config) replace(data.config);
      }}
    />
  );
}
