'use client';

import type { HostConfig } from '../core/contract';
import type { PageConfig, Section } from '../core/patch';
import { useConfig } from './personalization-root';

// ─── Props ──────────────────────────────────────────────────────────────

export interface PageRendererProps {
  host: HostConfig;
  /**
   * Optional override: render a specific config instead of pulling from
   * <PersonalizationRoot> via useConfig(). Useful for previews, tests, or
   * server-side rendering of a non-current config.
   */
  config?: PageConfig;
  /**
   * Optional filter — render only sections whose type is in this list.
   * Useful for slotting (e.g. <PageRenderer types={['TopBar']} /> for the
   * header slot, <PageRenderer types={['VideoGrid', 'ShortsRow']} /> for main).
   */
  types?: string[];
}

// ─── Component ──────────────────────────────────────────────────────────

/**
 * Walks the current page's sections array and renders each via the host's
 * section registry. Sections whose `type` isn't registered are skipped
 * silently (defensive against schema drift from persisted patches).
 *
 * Each component receives `{ section, config }` props — matching the
 * convention YT clone already uses. New hosts adopt the same shape.
 */
export function PageRenderer({ host, config: configOverride, types }: PageRendererProps) {
  const ctxConfig = useConfig();
  const config = configOverride ?? ctxConfig;

  const sections = types
    ? config.sections.filter((s) => types.includes(s.type))
    : config.sections;

  return (
    <>
      {sections.map((section: Section) => {
        const entry = host.sections[section.type];
        if (!entry) return null;
        const Component = entry.component;
        return <Component key={section.id} section={section} config={config} />;
      })}
    </>
  );
}
