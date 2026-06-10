import { cookies } from 'next/headers';
import { getRenderedPage } from '@/lib/queries/page';
import { PageStoreProvider } from '@/lib/store';
import { PageRoot } from '@/components/site/PageRoot';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const visitorId = cookieStore.get('visitor_id')?.value;
  const { config, ytContinuation, ytChips } = await getRenderedPage({ slug: 'streaming-platform', visitorId });

  // ?v=VIDEO_ID lands the user directly on the watch view (shareable URLs +
  // browser back-button restore). YouTube IDs are 11 chars [A-Za-z0-9_-];
  // validate to avoid pushing arbitrary strings into the embed iframe.
  const params = (await searchParams) ?? {};
  const rawV = params['v'];
  const v = typeof rawV === 'string' ? rawV : Array.isArray(rawV) ? rawV[0] : undefined;
  const initialWatchingId = typeof v === 'string' && /^[A-Za-z0-9_-]{6,32}$/.test(v) ? v : null;

  return (
    <PageStoreProvider
      initialConfig={config}
      initialYtContinuation={ytContinuation}
      initialYtChips={ytChips}
      initialWatchingId={initialWatchingId}
      pageSlug="streaming-platform"
    >
      <PageRoot pageSlug="streaming-platform" />
    </PageStoreProvider>
  );
}
