'use client';

import { useMemo } from 'react';
import type { Channel, PageConfig, Section } from '@showcase/shared';
import { usePageStore, type NavKey } from '@/lib/store';
import { Avatar } from './Avatar';

const ICON: Record<string, React.ReactElement> = {
  Home: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z" />
    </svg>
  ),
  Shorts: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M17.77 10.32l-1.2-.5L18 9.06A6.4 6.4 0 0014.74 3h-1.45A6.41 6.41 0 007.4 6.94l-2.69 4.66a4 4 0 002.59 5.93l1.2.5L7 18.94A6.42 6.42 0 0010.26 25h1.45a6.42 6.42 0 005.89-3.94l2.69-4.66a4 4 0 00-2.52-6.08zM10 16.5v-9l6 4.5z" />
    </svg>
  ),
  Subscriptions: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M20 8H4V6h16v2zm-2-6H6v2h12V2zm4 10v8c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2zm-9 4l-5-3v6l5-3z" />
    </svg>
  ),
  You: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-3.31 0-10 1.66-10 5v3h20v-3c0-3.34-6.69-5-10-5z" />
    </svg>
  ),
  Library: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4zm12 1l5-3-5-3z" />
    </svg>
  ),
  History: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M13 3a9 9 0 109 9h-2a7 7 0 11-7-7 6.9 6.9 0 014.95 2.05L15 11h7V4l-2.55 2.55A8.94 8.94 0 0013 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z" />
    </svg>
  ),
};

const NAV_KEYS: ReadonlySet<string> = new Set(['Home', 'Shorts', 'Subscriptions', 'You', 'Library', 'History']);

function FallbackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function uniqueChannels(config: PageConfig, limit = 12): Channel[] {
  const seen = new Set<string>();
  const out: Channel[] = [];
  for (const section of config.sections) {
    if (section.type === 'VideoGrid' || section.type === 'RecommendedRow' || section.type === 'ContinueWatchingRow') {
      for (const v of section.props.videos ?? []) {
        const key = v.channel.name;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(v.channel);
          if (out.length >= limit) return out;
        }
      }
    }
  }
  return out;
}

export function Sidebar({ section }: { section: Section; config: PageConfig }) {
  const { config, activeNav, selectedChannel, setActiveNav, setWatching } = usePageStore();

  const channels = useMemo(() => uniqueChannels(config), [config]);

  if (section.type !== 'Sidebar') return null;
  const { collapsed, pinnedItems, showSubscriptions } = section.props;

  function handleNavClick(item: string): void {
    if (!NAV_KEYS.has(item)) return;
    setWatching(null);
    setActiveNav(item as NavKey, null);
  }

  function handleChannelClick(name: string): void {
    setWatching(null);
    setActiveNav('Subscriptions', name);
  }

  return (
    <aside
      className={`hidden lg:flex shrink-0 flex-col gap-1 overflow-y-auto border-r border-[color:var(--border)] bg-[color:var(--surface)] py-3 transition-all ${
        collapsed ? 'w-20 px-2 items-center' : 'w-60 px-3'
      }`}
      style={{ backdropFilter: `blur(var(--surface-blur))`, WebkitBackdropFilter: `blur(var(--surface-blur))` }}
    >
      {pinnedItems.map((item) => {
        const isActive = activeNav === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => handleNavClick(item)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center rounded-lg transition-colors hover:bg-[color:var(--muted)] ${
              isActive ? 'bg-[color:var(--muted)] font-medium' : ''
            } ${
              collapsed
                ? 'flex-col gap-1 px-1 py-3 text-[10px] w-full'
                : 'gap-4 px-3 py-2 text-sm w-full text-left'
            }`}
          >
            <span className="shrink-0 text-[color:var(--fg)]">
              {ICON[item] ?? <FallbackIcon />}
            </span>
            <span className={collapsed ? 'leading-none' : 'truncate'}>{item}</span>
          </button>
        );
      })}

      {showSubscriptions && !collapsed && (
        <>
          <div className="my-3 border-t border-[color:var(--border)]" />
          <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-[color:var(--muted-fg)]">
            Subscriptions
          </div>
          {channels.length === 0 && (
            <p className="px-3 py-2 text-xs text-[color:var(--muted-fg)]">No subscriptions yet.</p>
          )}
          {channels.map((c) => {
            const isActive = activeNav === 'Subscriptions' && selectedChannel === c.name;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => handleChannelClick(c.name)}
                aria-current={isActive ? 'true' : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-[color:var(--muted)] ${
                  isActive ? 'bg-[color:var(--muted)] font-medium' : ''
                }`}
              >
                <Avatar name={c.name} src={c.avatar} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  {c.name}
                  {c.verified && <span className="ml-1 text-[color:var(--muted-fg)]">✓</span>}
                </span>
              </button>
            );
          })}
        </>
      )}
    </aside>
  );
}
