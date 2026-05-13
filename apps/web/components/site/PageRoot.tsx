'use client';

import { useEffect } from 'react';
import { usePageStore } from '@/lib/store';
import { Site } from './Site';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { AmbientBackground } from '@/components/templates/AmbientBackground';

// Keeps the URL's ?v= (watching) and ?q= (search) params in sync with the
// store. Lives at the page root (always mounted) so the URL also clears when
// WatchPage or search results unmount on exit — otherwise the logo click
// flips the view but the params linger.
function useUrlSync() {
  const { watchingId, setWatching, searchQuery, exitSearch } = usePageStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const currentV = url.searchParams.get('v');
    const currentQ = url.searchParams.get('q');
    const desiredV = watchingId ?? null;
    const desiredQ = searchQuery ?? null;
    if (currentV === desiredV && currentQ === desiredQ) return;
    if (desiredV) url.searchParams.set('v', desiredV);
    else url.searchParams.delete('v');
    if (desiredQ) url.searchParams.set('q', desiredQ);
    else url.searchParams.delete('q');
    window.history.pushState({ v: desiredV, q: desiredQ }, '', url.toString());
  }, [watchingId, searchQuery]);

  useEffect(() => {
    function onPop() {
      const url = new URL(window.location.href);
      const v = url.searchParams.get('v');
      const q = url.searchParams.get('q');
      setWatching(v ?? null);
      // popstate landed on a URL without ?q=: drop search mode and restore
      // the home snapshot. (We don't re-execute the search on forward nav —
      // the showcase just goes home, which is the dominant direction here.)
      if (!q) exitSearch();
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setWatching, exitSearch]);
}

const FONT_CLASS = {
  // Legacy keys — kept because the schema still accepts them.
  // They point at the bridge Tailwind utilities defined in tailwind.config.ts.
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
  rounded: 'font-rounded',

  inter: 'font-inter',
  'space-grotesk': 'font-space-grotesk',
  bricolage: 'font-bricolage',
  geist: 'font-geist',
  anton: 'font-anton',
  'big-shoulders': 'font-big-shoulders',
  unbounded: 'font-unbounded',
  syne: 'font-syne',
  fraunces: 'font-fraunces',
  'dm-serif': 'font-dm-serif',
  'bodoni-moda': 'font-bodoni-moda',
  cormorant: 'font-cormorant',
  newsreader: 'font-newsreader',
  lora: 'font-lora',
  'eb-garamond': 'font-eb-garamond',
  jetbrains: 'font-jetbrains',
  'ibm-plex-mono': 'font-ibm-plex-mono',
  'space-mono': 'font-space-mono',
  caveat: 'font-caveat',
  'permanent-marker': 'font-permanent-marker',
  'architects-daughter': 'font-architects-daughter',
  fredoka: 'font-fredoka',
  monoton: 'font-monoton',
  bungee: 'font-bungee',
} as const;

export function PageRoot({ pageSlug }: { pageSlug: string }) {
  const { config } = usePageStore();
  const bg = config.theme.background;
  useUrlSync();

  // font-scale must live on <html> so Tailwind's rem-based utilities pick it up.
  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(config.theme.fontScale));
    return () => {
      document.documentElement.style.removeProperty('--font-scale');
    };
  }, [config.theme.fontScale]);


  const themeStyle: React.CSSProperties = {
    ['--accent' as string]: config.theme.accent,
  };

  // Custom backgrounds: gradient overrides the default surface; solid relies on bg-bg.
  if (bg.kind === 'gradient' && bg.from && bg.to) {
    themeStyle.background = `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`;
  }
  // Paper preset — cream background + subtle warm grain. Pairs with
  // fontFamily: 'serif' to read as a quiet bookshop. The LLM can still
  // override `from` if a visitor wants a different paper tint.
  if (bg.kind === 'paper') {
    const paper = bg.from ?? '#f3eee0';
    themeStyle.background = paper;
  }

  const fontClass = FONT_CLASS[config.theme.fontFamily] ?? FONT_CLASS.sans;

  const isGradient = bg.kind === 'gradient' && !!bg.from && !!bg.to;
  const isPaper = bg.kind === 'paper';
  const orbColor = config.theme.accent;
  const orbColor2 = bg.to ?? config.theme.accent;
  const chromeDim = config.theme.chromeDim ?? 0;
  const grain = config.theme.grain ?? 0;

  return (
    <div
      data-theme={config.theme.mode}
      data-bg={isGradient ? 'gradient' : isPaper ? 'paper' : 'solid'}
      style={
        chromeDim > 0
          ? ({ ...themeStyle, ['--chrome-dim' as string]: String(chromeDim) } as React.CSSProperties)
          : themeStyle
      }
      className={`min-h-screen relative overflow-x-hidden text-fg ${isGradient || isPaper ? '' : 'bg-bg'} ${fontClass}`}
    >
      {/* AmbientBackground sections render at the page-root level so they
          stay visible across both Home and Watch views — they're full-bleed
          backgrounds, not regular main-area sections. */}
      {config.sections
        .filter((s) => s.type === 'AmbientBackground')
        .map((s) => (
          <AmbientBackground key={s.id} section={s} config={config} />
        ))}
      {/* Theme-level film grain — overlays the entire viewport when grain > 0. */}
      {grain > 0 && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            opacity: grain,
            mixBlendMode: 'overlay',
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />
      )}
      {/* Paper preset adds a soft sepia vignette so the cream feels printed,
          not just flat-color. */}
      {isPaper && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 50% 30%, rgba(255,250,235,0.4), transparent 70%), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(120, 80, 40, 0.08), transparent 70%)',
          }}
        />
      )}
      {/* Ambient accent orbs — only visible when a gradient bg is active.
          Pointer-events:none keeps clicks passing through. */}
      {isGradient && (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed -top-40 -right-40 h-[28rem] w-[28rem] rounded-full opacity-40 blur-3xl"
            style={{ background: `radial-gradient(circle at center, ${orbColor}, transparent 70%)` }}
          />
          <div
            aria-hidden
            className="pointer-events-none fixed -bottom-48 -left-48 h-[32rem] w-[32rem] rounded-full opacity-30 blur-3xl"
            style={{ background: `radial-gradient(circle at center, ${orbColor2}, transparent 70%)` }}
          />
        </>
      )}
      <Site />
      <ChatPanel pageSlug={pageSlug} />
    </div>
  );
}
