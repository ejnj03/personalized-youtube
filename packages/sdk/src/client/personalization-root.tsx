'use client';

import type { FontCatalog } from '../core/fonts';
import { buildFontStack, buildGoogleFontsUrl } from '../core/fonts';

import { applyPatch, type PageConfig, type Patch, type Section } from '../core/patch';
import type { HostConfig, Mode } from '../core/contract';
import { tokenKeyToCssVar } from '../core/tokens';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

// ─── Context ────────────────────────────────────────────────────────────

interface PersonalizationContextValue {
  config: PageConfig;
  dispatch: (patch: Patch) => void;
  /** Replace the entire config (e.g. after a reset or mode switch). */
  replace: (config: PageConfig) => void;

  // ─── Modes (parallel save-slots) ───
  /** List of all modes the visitor has at this slug. */
  modes: Mode[];
  /** The currently-active mode. Null until the host hydrates it. */
  activeMode: Mode | null;
  /** Replace the full mode list (e.g. after listModes from server). */
  setModes: (modes: Mode[]) => void;
  /** Switch to a different mode (host typically pairs with config reload). */
  setActiveMode: (mode: Mode | null) => void;
}

const PersonalizationContext =
  createContext<PersonalizationContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────

export interface PersonalizationRootProps {
  /** Host config from defineHost(). Used to read initialConfig. */
  host: HostConfig;
  /** Override the host's initialConfig — useful when the host has loaded
   *  the real config server-side and passed it in. */
  initialConfig?: PageConfig;
  /** Optional initial mode list (host fetched it before mounting). */
  initialModes?: Mode[];
  /** Optional initial active mode. */
  initialActiveMode?: Mode | null;
  children: ReactNode;
  /**
   * Merged font catalog from defineFonts(). When provided, PersonalizationRoot
   * (a) injects a Google Fonts <link> on mount, (b) writes the `--font-family`
   * CSS variable to <html> whenever theme.fontFamily changes.
   *
   * Optional — hosts that don't use fonts schema can omit. PersonalizationRoot
   * silently skips both behaviors when this prop is absent.
   */
  fontCatalog?: FontCatalog;
  /**
   * Host hook to validate/normalize a freshly added section (materialize Zod
   * defaults) on `add_section`. Without it, an agent-added section keeps only
   * the props the agent emitted — missing-field crashes downstream. Hosts pass
   * e.g. `(draft) => SectionSchema.parse(draft)`.
   */
  parseSection?: (draft: Section) => Section;
}

export function PersonalizationRoot({
  host,
  initialConfig,
  initialModes = [],
  initialActiveMode = null,
  fontCatalog,
  parseSection,
  children,
}: PersonalizationRootProps) {
  const [config, setConfig] = useState<PageConfig>(
    initialConfig ?? host.initialConfig,
  );
  const [modes, setModes] = useState<Mode[]>(initialModes);
  const [activeMode, setActiveMode] = useState<Mode | null>(initialActiveMode);

  // ← NEW: publish theme.tokens to CSS vars on <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;          // SSR — no DOM
    const themeAny = config.theme as Record<string, unknown>;
    const tokens = themeAny.tokens as Record<string, string> | undefined;
    if (!tokens) return;                                   // host hasn't migrated yet

    const root = document.documentElement;                 // <html>
    for (const [key, value] of Object.entries(tokens)) {
      if (typeof value !== 'string') continue;
      root.style.setProperty(tokenKeyToCssVar(key), value);
    }
  }, [config.theme]);

  // ─── Font loader: inject Google Fonts <link> once at mount ───
  useEffect(() => {
    if (typeof document === 'undefined') return;       // SSR — no DOM
    if (!fontCatalog) return;                          // host didn't opt in

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = buildGoogleFontsUrl(fontCatalog);
    link.dataset.sdkFontLink = '1';                    // marker so we can find it
    document.head.appendChild(link);

    return () => {
      link.parentNode?.removeChild(link);
    };
  }, [fontCatalog]);

  // ─── Font publisher: write --font-family on theme.fontFamily changes ───
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!fontCatalog) return;

    const themeAny = config.theme as Record<string, unknown>;
    const fontKey = themeAny.fontFamily as string | undefined;
    if (!fontKey) return;

    const entry = fontCatalog[fontKey];
    if (!entry) return;                                // key not in catalog (silent skip)

    const stack = buildFontStack(entry);
    document.documentElement.style.setProperty('--font-family', stack);
  }, [config.theme, fontCatalog]);


  const dispatch = useCallback((patch: Patch) => {
    setConfig((current) =>
      applyPatch(current, patch, parseSection ? { parseSection } : undefined),
    );
  }, [parseSection]);

  const replace = useCallback((next: PageConfig) => {
    setConfig(next);
  }, []);

  return (
    <PersonalizationContext.Provider
      value={{ config, dispatch, replace, modes, activeMode, setModes, setActiveMode }}
    >
      {children}
    </PersonalizationContext.Provider>
  );
}

// ─── Hooks ──────────────────────────────────────────────────────────────

/** Read the whole context value. */
export function usePersonalization(): PersonalizationContextValue {
  const value = useContext(PersonalizationContext);
  if (!value) {
    throw new Error(
      'usePersonalization() must be called inside <PersonalizationRoot>',
    );
  }
  return value;
}

/** Read just the current config. */
export function useConfig(): PageConfig {
  return usePersonalization().config;
}

/** Read just the dispatch function. */
export function useDispatch(): (patch: Patch) => void {
  return usePersonalization().dispatch;
}

/**
 * Same as `useDispatch` but returns `null` when no provider is present
 * instead of throwing. Used by components that accept dispatch as a prop AND
 * want to fall back to context when the prop is omitted — without crashing
 * if the host omits both the prop AND the provider.
 *
 * Hosts using this pattern (e.g. <ChatPanel>) should still throw their own
 * error message if both the prop and the context yield nothing.
 */
export function useOptionalDispatch(): ((patch: Patch) => void) | null {
  const value = useContext(PersonalizationContext);
  return value?.dispatch ?? null;
}

/** Read the mode list and active mode. */
export function useModes(): { modes: Mode[]; activeMode: Mode | null } {
  const { modes, activeMode } = usePersonalization();
  return { modes, activeMode };
}
