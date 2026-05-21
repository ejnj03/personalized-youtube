import type { Video, Short } from '@showcase/shared';
import { mockAdapter } from './mock';
import { getFeed as getYoutubeFeed } from './youtube';
import type { YtChip } from '../innertube/client';

export interface FeedAdapter {
  getFeed(): Promise<{ videos: Video[]; categories: string[]; shorts?: Short[]; chips?: YtChip[]; continuation?: string | null }>;
  requestMoreContent?(category: string, count: number, style?: string): Promise<Video[]>;
}

type FeedSource = 'mock' | 'youtube';

function resolveSource(): FeedSource {
  // SHOWCASE_FEED_SOURCE is the canonical knob (per youtube-adapter brief).
  // FEED_ADAPTER is honored as a legacy alias to avoid breaking existing envs.
  const raw = process.env.SHOWCASE_FEED_SOURCE ?? process.env.FEED_ADAPTER ?? 'mock';
  return raw === 'youtube' ? 'youtube' : 'mock';
}

export function getAdapter(): FeedAdapter {
  const source = resolveSource();
  if (source === 'mock') return mockAdapter;

  // Youtube source: try the youtubei.js + Chrome-cookies path; if it returns
  // anything other than 'ok' (cookies missing, keychain blocked, network
  // failure, parsed empty) fall back to mock so the web app never breaks
  // during dev.
  return {
    async getFeed() {
      const result = await getYoutubeFeed();
      if (result.kind !== 'ok') {
        console.warn(`[adapters] youtube fell back to mock: ${result.reason}`);
        return mockAdapter.getFeed();
      }
      return { videos: result.videos, categories: [], shorts: result.shorts, chips: result.chips, continuation: result.continuation };
    },
    requestMoreContent: mockAdapter.requestMoreContent?.bind(mockAdapter),
  };
}
