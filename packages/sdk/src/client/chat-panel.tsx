'use client';

import { useOptionalDispatch, usePersonalization } from './personalization-root';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

import type { HostConfig, Mode } from '../core/contract';
import type { Patch, PageConfig } from '../core/patch';

export interface ChatPanelProps {
  /** The host config — used for prompt hints, etc. (mostly forwarded into the POST body). */
  host: HostConfig;

  /** The page slug — passed to the chat endpoint. */
  pageSlug: string;

  /** Where to POST chat messages. Defaults to '/api/chat'. */
  apiUrl?: string;

  /**
   * Where to GET/POST modes. Defaults to the apiUrl base + '/modes'
   * (e.g. if apiUrl='http://x/api/chat', modesApiUrl='http://x/api/modes').
   */
  modesApiUrl?: string;

  /**
   * Where to GET the per-mode page config. Defaults to apiUrl base + '/page'.
   * Used when switching modes to reload the corresponding patches.
   */
  pageApiUrl?: string;

  /**
   * Called whenever a patch arrives over SSE. Host applies it to its store.
   *
   * Optional — if omitted, ChatPanel pulls dispatch from <PersonalizationRoot>'s
   * context via useDispatch(). The prop wins if both are present, so hosts can
   * still wrap dispatch (e.g. to add logging) by passing an explicit function.
   */
  dispatch?: (patch: Patch) => void;


  /** Optional: called when Claude calls a tool (for UI surfaces like pills). */
  onToolUse?: (toolName: string, input: unknown) => void;

  /**
   * Override the default reset behavior. When omitted, ChatPanel POSTs to
   * `${apiBase}/reset` with {slug, visitorId, modeId}, then replaces the
   * page config with host.initialConfig and appends a visible "Preferences
   * reset." line to the transcript so the action shows up in chat history.
   */
  onReset?: () => void;

  /** Where to POST the reset action. Defaults to apiBase + '/reset'. */
  resetApiUrl?: string;

  /** Optional: called when Claude calls `request_more_content` — host handles.
   *  `replace` distinguishes swap ("only X") from append ("more X"). */
  onRequestMoreContent?: (input: { category: string; count?: number; style?: string; replace?: boolean }) => void;

  /** Optional: called when Claude calls `ask_user` — host handles. */
  onAskUser?: (input: { question: string; options?: string[] }) => void;
}


interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolUses?: Array<{ name: string; rationale?: string }>;
  // When Claude calls ask_user, the question text is appended to `content`
  // (so it appears in the message bubble) and the optional answer options
  // are surfaced as clickable chips beneath the bubble.
  askOptions?: string[];
}

const TOOL_VERBS: Record<string, string> = {
  update_theme: 'tweaked the look',
  update_section: 'updated a section',
  set_filter: 'filtered the feed',
  set_sort: 'changed sort order',
  add_section: 'added a section',
  remove_section: 'hid a section',
  reorder_sections: 'reordered the page',
  request_more_content: 'pulling fresh videos',
  ask_user: 'has a quick question',
};

function fallbackAcknowledgment(toolUses: Array<{ name: string }>): string {
  if (toolUses.length === 0) return '';
  if (toolUses.length === 1) {
    const verb = TOOL_VERBS[toolUses[0]!.name] ?? 'made a change';
    return `Done — ${verb}.`;
  }
  const verbs = toolUses.map((t) => TOOL_VERBS[t.name] ?? 'updated something').slice(0, 3);
  return `Got it. ${verbs.join(', ')}.`;
}

const STORAGE_KEY = 'chatPanel:window:v2';
const VISITOR_KEY = 'sdk:visitorId';

// Generate or read a stable visitor id from localStorage. Hosts running on
// pure-SPA stacks (CRA, Vite) lack cookie middleware, so the chat panel
// manages the id itself and sends it in the request body.
function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const fresh = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    window.localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    return '';
  }
}
// ─── @-mentions ───
// A surface (e.g. a video card) "mentions" an item into the chat: a visible
// @chip + a structured ref the agent receives on send. Decoupled via a window
// event so any host card can mention without prop-drilling into ChatPanel.
const MENTION_EVENT = 'sdk:chat-mention';
interface ChatMention {
  label: string;
  ref?: Record<string, unknown>;
}

/**
 * Insert an @-mention into the chat panel from anywhere (a hover affordance on
 * a card, etc.). `label` shows as the `@chip`; `ref` is the structured data
 * (e.g. { id, title, channel }) forwarded to the agent when the visitor sends.
 */
export function mentionInChat(label: string, ref?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MENTION_EVENT, { detail: { label, ref } }));
}

const DEFAULT_W = 420;
const DEFAULT_H = 620;
const MIN_W = 320;
const MIN_H = 200;
const MINIMIZED_H = 48;

type WindowState = { x: number; y: number; width: number; height: number };

function loadWindowState(): WindowState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WindowState;
    if (
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number'
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function defaultWindowState(): WindowState {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0, width: DEFAULT_W, height: DEFAULT_H };
  }
  return {
    x: Math.max(16, window.innerWidth - DEFAULT_W - 24),
    y: Math.max(16, window.innerHeight - DEFAULT_H - 24),
    width: DEFAULT_W,
    height: DEFAULT_H,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function ChatPanel(props: ChatPanelProps) {
  // ─── Resolve dispatch ───
  // Prop wins; otherwise pull from <PersonalizationRoot> context.
  // useOptionalDispatch returns null if no provider — that's fine as long as
  // the host passed dispatch as a prop. If neither, we throw with a clear msg.
  const contextDispatch = useOptionalDispatch();
  const dispatch = props.dispatch ?? contextDispatch;
  if (!dispatch) {
    throw new Error(
      'ChatPanel: dispatch is required. Pass dispatch={...} as a prop, or wrap the app in <PersonalizationRoot>.',
    );
  }

  // ─── Modes context ───
  // Mode state lives on <PersonalizationRoot> so the rest of the app can
  // observe it (e.g. to display the active mode name in chrome).
  const personalization = usePersonalization();
  const { modes, activeMode, setModes, setActiveMode, replace } = personalization;

  // ─── Derived URLs ───
  // Hosts pass apiUrl (chat). modes + page + history default to siblings under
  // the same /api root unless overridden.
  const apiChatUrl = props.apiUrl ?? '/api/chat';
  const apiBase = apiChatUrl.replace(/\/chat$/, '');
  const modesUrl = props.modesApiUrl ?? `${apiBase}/modes`;
  const pageUrl = props.pageApiUrl ?? `${apiBase}/page`;
  const historyUrl = `${apiBase}/chat/history`;
  const resetUrl = props.resetApiUrl ?? `${apiBase}/reset`;

  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [windowState, setWindowState] = useState<WindowState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mentions, setMentions] = useState<ChatMention[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // Per-mode drafts: when user switches mid-type, their input survives.
  const draftsRef = useRef<Record<string, string>>({});
  const [creatingMode, setCreatingMode] = useState(false);
  const [newModeName, setNewModeName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const heightBeforeMinimize = useRef<number>(DEFAULT_H);

  // ─── Helper: load chat history for the active mode ───
  const loadHistory = useCallback(async (modeId: string) => {
    const visitorId = getOrCreateVisitorId();
    try {
      const res = await fetch(
        `${historyUrl}?slug=${encodeURIComponent(props.pageSlug)}` +
        `&visitorId=${encodeURIComponent(visitorId)}` +
        `&modeId=${encodeURIComponent(modeId)}`,
      );
      const data = res.ok ? ((await res.json()) as { messages?: ChatMessage[] }) : { messages: [] };
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch {
      setMessages([]);
    }
  }, [historyUrl, props.pageSlug]);

  // ─── Helper: reset preferences for the active mode ───
  // Default behavior (no onReset prop): POST to resetUrl, replace the live
  // config with host.initialConfig, and append a visible "Preferences reset."
  // line so the action is part of the transcript. Server-side persistence is
  // best-effort — a 404 on the reset endpoint still clears local state.
  const handleReset = useCallback(async () => {
    if (props.onReset) {
      props.onReset();
      return;
    }
    const visitorId = getOrCreateVisitorId();
    const modeId = activeMode?.id ?? '';
    try {
      await fetch(resetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: props.pageSlug, visitorId, modeId }),
      });
    } catch { /* network down — still reset locally */ }
    replace(props.host.initialConfig);
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: 'Preferences reset.' },
    ]);
  }, [props.onReset, resetUrl, props.pageSlug, activeMode?.id, replace, props.host]);

  // ─── Helper: load the merged page config for a mode and replace ───
  const loadConfigForMode = useCallback(async (modeId: string) => {
    const visitorId = getOrCreateVisitorId();
    try {
      const res = await fetch(
        `${pageUrl}?slug=${encodeURIComponent(props.pageSlug)}` +
        `&visitorId=${encodeURIComponent(visitorId)}` +
        `&modeId=${encodeURIComponent(modeId)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { config?: PageConfig };
      if (data.config) replace(data.config);
    } catch { /* keep current */ }
  }, [pageUrl, props.pageSlug, replace]);

  // ─── Mount: load modes; if empty, create Default; load that mode's data ───
  useEffect(() => {
    setMounted(true);
    setWindowState(loadWindowState() ?? defaultWindowState());

    let cancelled = false;
    (async () => {
      const visitorId = getOrCreateVisitorId();
      let list: Mode[] = [];
      try {
        const res = await fetch(
          `${modesUrl}?slug=${encodeURIComponent(props.pageSlug)}` +
          `&visitorId=${encodeURIComponent(visitorId)}`,
        );
        const data = res.ok ? ((await res.json()) as { modes?: Mode[] }) : { modes: [] };
        list = Array.isArray(data.modes) ? data.modes : [];
      } catch { /* empty */ }

      // Auto-create Default if the visitor has no modes yet.
      if (list.length === 0) {
        try {
          const res = await fetch(modesUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: props.pageSlug,
              visitorId,
              title: 'Default',
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { mode?: Mode };
            if (data.mode) list = [data.mode];
          }
        } catch { /* leave list empty — user can still chat without persistence */ }
      }

      if (cancelled) return;
      setModes(list);
      // Pick active mode: previously stored id in localStorage, else first mode.
      const stored = (typeof window !== 'undefined'
        ? window.localStorage.getItem(`sdk:activeModeId:${props.pageSlug}`)
        : null);
      const active = list.find((m) => m.id === stored) ?? list[0] ?? null;
      setActiveMode(active);
      if (active) {
        // Restore BOTH the transcript and the page config (theme/sections)
        // for the active mode. Without the config fetch, reloads strand the
        // visitor on host.initialConfig — patches never get applied.
        await Promise.all([loadHistory(active.id), loadConfigForMode(active.id)]);
      }
    })();

    return () => { cancelled = true; };
    // intentionally only depend on pageSlug + modesUrl so we don't re-fetch on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pageSlug, modesUrl]);

  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  // Receive @-mentions fired by host surfaces (e.g. a card's hover affordance).
  useEffect(() => {
    function onMention(e: Event) {
      const detail = (e as CustomEvent).detail as ChatMention | undefined;
      if (!detail?.label) return;
      setMentions((cur) => {
        const id = detail.ref?.id;
        if (id && cur.some((m) => m.ref?.id === id)) return cur; // dedupe by id
        return [...cur, { label: detail.label, ref: detail.ref }];
      });
      setOpen(true);
      setMinimized(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    window.addEventListener(MENTION_EVENT, onMention);
    return () => window.removeEventListener(MENTION_EVENT, onMention);
  }, []);

  useEffect(() => {
    if (!windowState) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(windowState));
    } catch {
      /* ignore quota */
    }
  }, [windowState]);

  // "/" focuses chat; Escape closes
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const inField =
        tag === 'input' || tag === 'textarea' || (e.target as HTMLElement | null)?.isContentEditable;
      if (e.key === '/' && !inField && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
        setMinimized(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (e.key === 'Escape' && open && !minimized) {
        setMinimized(true);
      }
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [open, minimized]);

  // ─── Switch to a different mode ───
  // Blocked while streaming (the in-flight turn writes to the current mode).
  const switchMode = useCallback(async (mode: Mode) => {
    if (isStreaming || mode.id === activeMode?.id) return;
    // Save current draft so it survives the switch.
    if (activeMode) draftsRef.current[activeMode.id] = input;
    setActiveMode(mode);
    // Restore draft for the incoming mode.
    setInput(draftsRef.current[mode.id] ?? '');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`sdk:activeModeId:${props.pageSlug}`, mode.id);
    }
    await Promise.all([loadHistory(mode.id), loadConfigForMode(mode.id)]);
  }, [isStreaming, activeMode, input, loadHistory, loadConfigForMode, props.pageSlug, setActiveMode]);

  // ─── Create a new mode ───
  const createMode = useCallback(async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed || isStreaming) return;
    const visitorId = getOrCreateVisitorId();
    try {
      const res = await fetch(modesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: props.pageSlug, visitorId, title: trimmed }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { mode?: Mode };
      if (!data.mode) return;
      setModes([...modes, data.mode]);
      // Switch into the freshly-created mode so the chat is in a fresh slot.
      if (activeMode) draftsRef.current[activeMode.id] = input;
      setActiveMode(data.mode);
      setInput('');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`sdk:activeModeId:${props.pageSlug}`, data.mode.id);
      }
      // New mode → no history, fresh page config (just host defaults).
      setMessages([]);
      await loadConfigForMode(data.mode.id);
    } catch { /* swallow; UI stays as-is */ }
  }, [modesUrl, props.pageSlug, modes, activeMode, input, isStreaming, loadConfigForMode, setActiveMode, setModes]);

  async function send(text: string) { //STEP 1-2: Update state accordingly
    //guard if previous request is still streaming or user stripped text is empty
    if ((!text.trim() && mentions.length === 0) || isStreaming || !activeMode) return;

    // Fold any @-mentions in: the bubble shows "@label" chips inline; the agent
    // receives a structured block (id/title/channel) so it can act on them.
    const displayContent = mentions.length
      ? `${text} ${mentions.map((m) => '@' + m.label).join(' ')}`.trim()
      : text;
    const agentMessage = mentions.length
      ? `${text}\n\n[Referenced videos — the visitor pointed at these (e.g. to pin into a row)]\n${mentions
          .map(
            (m) =>
              `- "${(m.ref?.title as string) ?? m.label}" — channel: ${(m.ref?.channel as string) ?? ''} (videoId: ${(m.ref?.id as string) ?? ''})`,
          )
          .join('\n')}`
      : text;

    //state update happens after send() completes (on re-render)
    //queue append user message to current message array and update state variable
    const next = [...messages, { role: 'user' as const, content: displayContent }];
    setMessages(next);

    //clear user input area + consumed mentions
    setInput('');
    setMentions([]);
    //queue status update to streaming (agent message in flight)
    setIsStreaming(true);


    try {
      //(next.js file based routing- Next.js looks for file under the /app directory (/api/chat) which is route.ts)
      const res = await fetch(apiChatUrl, { //STEP 3: Post to server
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          //Prop that is passed into ChatPanel component- identifies the current website/page that is being personalized
          pageSlug: props.pageSlug, //currently hard-coded to 'youtube-clone' - for expansion to i.e., 'slack-clone' 'amazon-clone'
          message: agentMessage, // the message + any structured @-mention refs
          history: messages, // array of {role, content} objects for every prior turn
          // SPA hosts (no cookie middleware) send the visitor id explicitly.
          // Next-based hosts also send it but their middleware-set cookie
          // takes precedence on the server.
          visitorId: getOrCreateVisitorId(),
          // Identifies which save-slot this turn writes to.
          modeId: activeMode.id,
        }),
      });
      if (!res.body) throw new Error('No response stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const toolUses: ChatMessage['toolUses'] = [];
      let askOptions: string[] | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const ev = JSON.parse(data);
            if (ev.kind === 'debug_request') {
              console.groupCollapsed('%c[Claude] → request', 'color:#0070f3;font-weight:bold');
              console.log('system:', ev.payload.system);
              console.log('tools:', ev.payload.tools);
              console.log('messages:', ev.payload.messages);
              console.log('model:', ev.payload.model, 'max_tokens:', ev.payload.max_tokens);
              console.log('full payload:', ev.payload);
              console.groupEnd();
            } else if (ev.kind === 'debug_stream_event') {
              console.debug('[Claude] stream ←', ev.payload);
            } else if (ev.kind === 'debug_final') {
              console.groupCollapsed('%c[Claude] ← final', 'color:#22c55e;font-weight:bold');
              console.log('content blocks:', ev.payload.content);
              console.log('usage:', ev.payload.usage);
              console.log('stop_reason:', ev.payload.stop_reason);
              console.log('full payload:', ev.payload);
              console.groupEnd();
            }

            //update agents message to chat
            if (ev.kind === 'text') assistantContent += ev.text;
            //update current agent progress (tool invoked) to agent
            if (ev.kind === 'tool_use') {
              // Track locally so the pill renders under the assistant message,
              // AND fire the optional host callback for any extra handling.
              toolUses.push({ name: ev.name, rationale: ev.rationale });
              props.onToolUse?.(ev.name, ev.rationale);
            }
            //STEP 8: Apply the patch
            // `dispatch!` — narrowing from the early-return throw above doesn't
            // persist across the async closure boundary here; the assert is safe.
            if (ev.kind === 'patch') dispatch!(ev.patch as Patch);
            if (ev.kind === 'request_more_content') props.onRequestMoreContent?.(ev.input);
            if (ev.kind === 'ask_user') {
              const q = typeof ev.input?.question === 'string' ? ev.input.question : '';
              if (q) assistantContent += (assistantContent ? '\n\n' : '') + q;
              if (Array.isArray(ev.input?.options)) askOptions = ev.input.options as string[];
              props.onAskUser?.(ev.input);
            }
          } catch {
            /* ignore malformed line */
          }
        }
      }

      setMessages([...next, { role: 'assistant', content: assistantContent, toolUses, askOptions }]);
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: `Error: ${(err as Error).message}` }]);
    } finally {
      setIsStreaming(false);
    }
  }

  function toggleMinimize() {
    if (!windowState) return;
    if (minimized) {
      setWindowState({ ...windowState, height: heightBeforeMinimize.current });
      setMinimized(false);
    } else {
      heightBeforeMinimize.current = windowState.height;
      setWindowState({ ...windowState, height: MINIMIZED_H });
      setMinimized(true);
    }
  }

  // Drag from the header. We attach mousemove/mouseup to window (not the
  // header) so the drag survives the cursor briefly leaving the header strip.
  const onHeaderMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    // Buttons inside the header (minimize/close) shouldn't start a drag.
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    setWindowState((current) => {
      if (!current) return current;
      const startWX = current.x;
      const startWY = current.y;
      function onMove(ev: MouseEvent) {
        setWindowState((s) => {
          if (!s) return s;
          const maxX = Math.max(0, window.innerWidth - s.width);
          const maxY = Math.max(0, window.innerHeight - s.height);
          return {
            ...s,
            x: clamp(startWX + (ev.clientX - startX), 0, maxX),
            y: clamp(startWY + (ev.clientY - startY), 0, maxY),
          };
        });
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setDragging(false);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      setDragging(true);
      return current;
    });
  }, []);

  const onResizeMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0 || minimized) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    setWindowState((current) => {
      if (!current) return current;
      const startW = current.width;
      const startH = current.height;
      const startWX = current.x;
      const startWY = current.y;
      function onMove(ev: MouseEvent) {
        setWindowState((s) => {
          if (!s) return s;
          const maxW = Math.max(MIN_W, window.innerWidth - startWX);
          const maxH = Math.max(MIN_H, window.innerHeight - startWY);
          return {
            ...s,
            width: clamp(startW + (ev.clientX - startX), MIN_W, maxW),
            height: clamp(startH + (ev.clientY - startY), MIN_H, maxH),
          };
        });
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return current;
    });
  }, [minimized]);

  if (!mounted) return null;

  if (!open) {
    return createPortal(
      <button
        onClick={() => {
          setOpen(true);
          setMinimized(false);
        }}
        className="fixed bottom-6 right-6 z-40 flex h-14 items-center gap-2 rounded-full bg-[color:var(--accent)] px-5 text-[color:var(--accent-fg)] shadow-lg hover:scale-105 transition"
      >
        <span aria-hidden>✨</span>
        <span className="font-medium">Personalize</span>
      </button>,
      document.body,
    );
  }

  if (!windowState) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: windowState.x,
        top: windowState.y,
        width: windowState.width,
        height: windowState.height,
        zIndex: 40,
        userSelect: dragging ? 'none' : undefined,
      }}
    >
      <aside className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--fg)] shadow-2xl">
        <header
          onMouseDown={onHeaderMouseDown}
          className={`flex shrink-0 items-center justify-between border-b border-[color:var(--border)] px-4 py-2 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <div className="flex items-center gap-2 select-none">
            <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--accent)] text-[10px] text-[color:var(--accent-fg)]">
              ✨
            </span>
            <div>
              <h2 className="text-sm font-medium leading-tight">Personalize</h2>
              {!minimized && (
                <p className="text-[11px] text-[color:var(--muted-fg)] leading-tight">
                  Tell us how you want to see things. It sticks.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMinimize}
              aria-label={minimized ? 'Expand' : 'Minimize'}
              className="rounded p-1 hover:bg-[color:var(--muted)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                {minimized ? (
                  <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                ) : (
                  <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                )}
              </svg>
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded p-1 hover:bg-[color:var(--muted)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </header>

        {!minimized && (
          <>
            {/* Modes pills — one per save-slot, plus a "+" affordance. Switching
                is blocked while a turn is streaming so we don't strand the
                outgoing write on the previous mode. */}
            <div className="shrink-0 flex items-center gap-1 overflow-x-auto px-3 py-2 border-b border-[color:var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {modes.map((m) => {
                const isActive = m.id === activeMode?.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void switchMode(m)}
                    disabled={isStreaming}
                    title={isStreaming ? 'Wait for the current turn to finish' : `Switch to ${m.title}`}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
                      isActive
                        ? 'bg-[color:var(--accent)] text-[color:var(--accent-fg)]'
                        : 'bg-[color:var(--muted)] text-[color:var(--fg)] hover:bg-[color:var(--border)]'
                    }`}
                  >
                    {m.title}
                  </button>
                );
              })}
              {creatingMode ? (
                <input
                  autoFocus
                  value={newModeName}
                  onChange={(e) => setNewModeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void createMode(newModeName);
                      setNewModeName('');
                      setCreatingMode(false);
                    } else if (e.key === 'Escape') {
                      setNewModeName('');
                      setCreatingMode(false);
                    }
                  }}
                  onBlur={() => { setNewModeName(''); setCreatingMode(false); }}
                  placeholder="Name…"
                  className="shrink-0 rounded-full bg-[color:var(--muted)] text-[color:var(--fg)] placeholder:text-[color:var(--muted-fg)] px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-[color:var(--accent)] w-24"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingMode(true)}
                  disabled={isStreaming}
                  title="New mode"
                  className="shrink-0 rounded-full bg-[color:var(--muted)] px-2 py-1 text-xs text-[color:var(--muted-fg)] hover:bg-[color:var(--border)] disabled:opacity-50"
                >
                  +
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="space-y-3 text-sm text-[color:var(--muted-fg)]">
                  <p>Type anything. For example:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>&quot;Use a forest green dark theme&quot;</li>
                    <li>&quot;Show me more chill jazz, less bangers&quot;</li>
                    <li>&quot;Hide the shorts row&quot;</li>
                  </ul>
                </div>
              ) : (
                <ul className="space-y-3">
                  {messages.map((m, i) => {
                    const showFallback =
                      m.role === 'assistant' &&
                      (!m.content || !m.content.trim()) &&
                      (m.toolUses?.length ?? 0) > 0;
                    const display = showFallback ? fallbackAcknowledgment(m.toolUses ?? []) : m.content;
                    return (
                      <li
                        key={i}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm text-left ${
                            m.role === 'user'
                              ? 'bg-[color:var(--accent)] text-[color:var(--accent-fg)]'
                              : 'bg-[color:var(--muted)] text-[color:var(--fg)]'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{display}</p>
                          {m.role === 'assistant' && m.toolUses && m.toolUses.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {m.toolUses.map((t, j) => (
                                <span
                                  key={j}
                                  className="inline-flex items-center gap-1 rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[color:var(--muted-fg)] border border-[color:var(--border)]"
                                  title={t.rationale ?? t.name}
                                >
                                  <span className="h-1 w-1 rounded-full bg-[color:var(--accent)]" />
                                  {TOOL_VERBS[t.name] ?? t.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {m.role === 'assistant' && m.askOptions && m.askOptions.length > 0 && i === messages.length - 1 && !isStreaming && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {m.askOptions.map((opt, j) => (
                                <button
                                  key={j}
                                  onClick={() => void send(opt)}
                                  className="rounded-full bg-[color:var(--bg)] px-3 py-1 text-xs text-[color:var(--fg)] border border-[color:var(--border)] hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-fg)] hover:border-[color:var(--accent)] transition-colors"
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {isStreaming && (
                    <li>
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--muted)] px-3 py-2 text-sm text-[color:var(--muted-fg)]">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--accent)]" />
                        Thinking…
                      </div>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <form //STEP 1-1: submit the user's message string
              onSubmit={(e) => {
                e.preventDefault();
                console.log('STEP 1: submit user input: ', input)
                send(input); //invokes send with input
              }}
              className="shrink-0 border-t border-[color:var(--border)] p-3"
            >
              {mentions.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {mentions.map((m, i) => (
                    <span
                      key={(m.ref?.id as string) ?? `${m.label}-${i}`}
                      className="inline-flex max-w-[200px] items-center gap-1 rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-xs text-[color:var(--accent)]"
                    >
                      <span className="truncate">@{m.label}</span>
                      <button
                        type="button"
                        aria-label="Remove mention"
                        onClick={() => setMentions((cur) => cur.filter((_, j) => j !== i))}
                        className="shrink-0 opacity-70 hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Tell the page what you want…"
                  className="flex-1 rounded-full bg-[color:var(--muted)] text-[color:var(--fg)] placeholder:text-[color:var(--muted-fg)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                  disabled={isStreaming}
                />
                <button
                  type="submit"
                  disabled={isStreaming || (!input.trim() && mentions.length === 0)}
                  className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-[color:var(--accent-fg)] disabled:opacity-50"
                >
                  Send
                </button>
              </div>
                <button
                    type="button"
                    onClick={handleReset}
                    disabled={isStreaming}
                    className="mt-2 text-xs text-[color:var(--muted-fg)] hover:underline disabled:opacity-50"
                >
                    Reset preferences
                </button>
            </form>
          </>
        )}
        {!minimized && (
          <div
            onMouseDown={onResizeMouseDown}
            aria-hidden
            className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize"
            style={{
              backgroundImage:
                'linear-gradient(135deg, transparent 0 50%, color-mix(in srgb, var(--border) 70%, transparent) 50% 60%, transparent 60% 75%, color-mix(in srgb, var(--border) 70%, transparent) 75% 85%, transparent 85% 100%)',
            }}
          />
        )}
      </aside>
    </div>,
    document.body,
  );
}

/**
 *                   {generatingCategory && (
                    <li>
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--muted)] px-3 py-2 text-sm text-[color:var(--muted-fg)]">
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Fetching more videos in{' '}
                        <span className="font-medium">{generatingCategory.replace(/-/g, ' ')}</span>…
                      </div>
                    </li>
                  )}
 */