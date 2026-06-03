import type { Video, Short } from '@showcase/shared';
import { getFeed as getYoutubeFeed } from './youtube';
import type { YtChip } from '../innertube/client';

export interface FeedAdapter {
  getFeed(): Promise<{ videos: Video[]; categories: string[]; shorts?: Short[]; chips?: YtChip[]; continuation?: string | null }>;
}

// The mock catalog has been removed. Real YouTube data (cookie-authenticated
// when available, anonymous synthetic feed otherwise — see innertube/client.ts)
// is the only feed source. If even the anonymous path fails (network blocked,
// parser breakage) the adapter returns an empty feed rather than falling back
// to fabricated videos; the page shell still renders.
export function getAdapter(): FeedAdapter {
  return {
    async getFeed() {
      const result = await getYoutubeFeed();
      if (result.kind !== 'ok') {
        console.warn(`[adapters] youtube feed unavailable (${result.reason}); serving empty feed`);
        return { videos: [], categories: [] };
      }
      return { videos: result.videos, categories: [], shorts: result.shorts, chips: result.chips, continuation: result.continuation };
    },
  };
}
