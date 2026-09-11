// ============================================================
// Portable console — the browser console, on the device that has the bug
// ============================================================
//
// Reaching Safari's inspector means a cable, a Mac, and a page that is still
// alive when you get there. `MP_DEV_LOGS=1` already relays the console to the
// dev server, which covers a phone on our own network. This covers the rest:
// a phone on mobile data, a borrowed device, a tester three time zones away,
// or a bug that only shows up on the deployed dev site.
//
// It wraps `console.*`, `window.onerror` and `unhandledrejection` into a
// bounded ring buffer, and `PortableConsole` renders it with a Copy button.
//
// ── It must never reach production ──
//
// The gate is a BUILD flag, not a runtime one: `VITE_PORTABLE_CONSOLE=true`.
// Vite substitutes the literal at build time, so every entry can write
//
//     if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true')
//       void import('...').then((m) => m.setup())
//
// and a normal build folds that to `if (false)` and drops the import — the
// module never enters the graph, so there is nothing to leak. Nothing here
// is guarded at runtime alone, because a runtime guard still ships the code
// and the wrapped console with it.
//
// Read inline at each entry, never through a shared constant. A `defaults.ts`
// export looks tidier and costs a room its first paint: that module is pinned
// into the `pitch-core` chunk, so importing one boolean from it puts the whole
// chunk — the notifications store included — into every standalone entry's
// static graph. `assert-piano-night-bundle.mjs` caught exactly that.
//
// `scripts/assert-no-portable-console.mjs` fails the build if it ever does.

/** How many lines are kept. A phone holding a long session, bounded. */
const MAX_ENTRIES = 1000

/** Longer than this and one runaway object would fill the panel. */
const MAX_TEXT = 2000

const STORAGE_KEY = 'mp:portableConsole'
const QUERY_KEY = 'console'

/**
 * Where the capture survives a page load.
 *
 * sessionStorage, not localStorage: it is per tab, so two tabs do not write
 * over each other, and it lives exactly as long as the tab being tested.
 *
 * This is not a nicety. Several of this app's rooms are SEPARATE DOCUMENTS —
 * walking into Karaoke Night is a full page load — and the bug this was built
 * for is the walk between two of them. An in-memory buffer is empty on the
 * far side of the one transition worth watching, which is what happened on
 * 2026-09-10: the phone came back reading `entries: 0`.
 */
const PERSIST_KEY = 'mp:portableConsole:log'
const PERSIST_ORIGIN_KEY = 'mp:portableConsole:origin'

/** Written at most this often; every line would be a write per console call. */
const PERSIST_INTERVAL_MS = 750

export type PortableConsoleLevel =
  | 'log'
  | 'info'
  | 'warn'
  | 'error'
  | 'debug'
  | 'onerror'
  | 'unhandled'

export interface PortableConsoleEntry {
  /** Milliseconds since the first line, which is what a reader wants. */
  at: number
  level: PortableConsoleLevel
  text: string
}

type Listener = () => void

const listeners = new Set<Listener>()
let entries: PortableConsoleEntry[] = []
let visible = true
let origin = 0
let uninstall: (() => void) | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null

/** Serialize one console argument without ever throwing. */
function render(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  try {
    const seen = new WeakSet<object>()
    return (
      JSON.stringify(value, (_key, inner: unknown) => {
        if (typeof inner === 'object' && inner !== null) {
          // A cyclic object in a log line must not take the page down with it.
          if (seen.has(inner)) return '[circular]'
          seen.add(inner)
        }
        return inner
      }) ?? String(value)
    )
  } catch {
    return String(value)
  }
}

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      // One bad subscriber must not stop the panel updating.
    }
  }
}

export function recordPortableConsole(
  level: PortableConsoleLevel,
  args: readonly unknown[],
): void {
  const now = Date.now()
  if (origin === 0) origin = now
  const text = args.map(render).join(' ').slice(0, MAX_TEXT)
  entries.push({ at: now - origin, level, text })
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
  schedulePersist()
  notify()
}

function persistNow(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  try {
    sessionStorage.setItem(PERSIST_KEY, JSON.stringify(entries))
    sessionStorage.setItem(PERSIST_ORIGIN_KEY, String(origin))
  } catch {
    // Quota or private mode. The in-memory log still works for this page.
  }
}

function schedulePersist(): void {
  if (persistTimer !== null) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    persistNow()
  }, PERSIST_INTERVAL_MS)
}

/**
 * Reload the capture this tab was building before it navigated.
 *
 * The elapsed clock continues from the stored origin, so a log that spans
 * three documents still reads as one timeline — which is the only way to see
 * what a page transition did.
 */
function restore(): void {
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY)
    const storedOrigin = Number(sessionStorage.getItem(PERSIST_ORIGIN_KEY))
    if (raw === null) return
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    entries = parsed.filter(
      (entry): entry is PortableConsoleEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as PortableConsoleEntry).text === 'string',
    )
    if (Number.isFinite(storedOrigin) && storedOrigin > 0) origin = storedOrigin
  } catch {
    // A corrupt or foreign value is not worth failing a debug build over.
  }
}

/**
 * Start capturing. Returns its own uninstall, and is safe to call twice —
 * wrapping an already-wrapped console is how a "capture" ends up recording
 * itself and hanging the tab.
 */
export function installPortableConsole(): () => void {
  if (uninstall !== null) return uninstall
  restore()

  const levels: PortableConsoleLevel[] = [
    'log',
    'info',
    'warn',
    'error',
    'debug',
  ]
  const original = new Map<string, (...args: unknown[]) => void>()

  for (const level of levels) {
    const key = level as 'log' | 'info' | 'warn' | 'error' | 'debug'
    // no-console allows everything here except `debug`, and this is the one
    // module that has to take the console as it finds it — including the
    // method the rest of the codebase is not allowed to call.
    // eslint-disable-next-line no-console
    const previous = console[key] as (...args: unknown[]) => void
    original.set(level, previous)
    // eslint-disable-next-line no-console
    console[key] = (...args: unknown[]) => {
      recordPortableConsole(level, args)
      // Always call through: the dev-server relay reads the real console,
      // and swallowing output would trade one blind spot for another.
      previous.apply(console, args)
    }
  }

  const onError = (event: ErrorEvent) => {
    recordPortableConsole('onerror', [
      `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`,
    ])
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    recordPortableConsole('unhandled', [event.reason])
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  // A navigation is exactly when the pending lines matter most, and it is the
  // one moment a timer will not fire.
  const onPageHide = () => persistNow()
  window.addEventListener('pagehide', onPageHide)

  uninstall = () => {
    for (const [level, previous] of original) {
      ;(console as unknown as Record<string, unknown>)[level] = previous
    }
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    window.removeEventListener('pagehide', onPageHide)
    uninstall = null
  }
  return uninstall
}

/**
 * Read `?console=0` / `?console=1` and remember it.
 *
 * The build flag decides whether the feature exists at all; this only decides
 * whether the panel is in the way. Remembered, because several of this app's
 * rooms are separate documents and walking into one is a fresh page load.
 */
export function initPortableConsoleVisibility(
  search = window.location.search,
): void {
  let asked: string | null = null
  try {
    asked = new URLSearchParams(search).get(QUERY_KEY)
  } catch {
    asked = null
  }
  try {
    if (asked === '0' || asked === 'false')
      localStorage.setItem(STORAGE_KEY, '0')
    else if (asked === '1' || asked === 'true')
      localStorage.removeItem(STORAGE_KEY)
    visible = localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    // Storage refused (private mode). Default to shown: the flag was set on
    // purpose, and an invisible debug build helps nobody.
    visible = asked !== '0' && asked !== 'false'
  }
}

export function portableConsoleVisible(): boolean {
  return visible
}

export function setPortableConsoleVisible(next: boolean): void {
  visible = next
  try {
    if (next) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, '0')
  } catch {
    // Not remembering it is survivable.
  }
  notify()
}

export function portableConsoleEntries(): readonly PortableConsoleEntry[] {
  return entries
}

export function onPortableConsole(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function clearPortableConsole(): void {
  entries = []
  origin = 0
  try {
    sessionStorage.removeItem(PERSIST_KEY)
    sessionStorage.removeItem(PERSIST_ORIGIN_KEY)
  } catch {
    // Nothing to do; the in-memory log is already empty.
  }
  notify()
}

export function formatPortableConsoleEntry(
  entry: PortableConsoleEntry,
): string {
  const seconds = (entry.at / 1000).toFixed(2).padStart(8, ' ')
  return `${seconds}s ${entry.level.toUpperCase().padEnd(5, ' ')} ${entry.text}`
}

/**
 * The whole capture as text, headed by the device it came from.
 *
 * This is what Copy puts on the clipboard, so it has to survive being pasted
 * into a chat message and still say which phone produced it.
 */
export function formatPortableConsole(): string {
  return [
    'MercuryPitch portable console',
    `when: ${new Date().toISOString()}`,
    `url: ${window.location.href}`,
    `agent: ${navigator.userAgent}`,
    `lines: ${entries.length}${entries.length === MAX_ENTRIES ? ' (oldest dropped)' : ''}`,
    '',
    ...entries.map(formatPortableConsoleEntry),
  ].join('\n')
}

/** Test seam: forget everything and put the real console back. */
export function resetPortableConsoleForTests(): void {
  uninstall?.()
  if (persistTimer !== null) clearTimeout(persistTimer)
  persistTimer = null
  entries = []
  listeners.clear()
  visible = true
  origin = 0
  try {
    sessionStorage.removeItem(PERSIST_KEY)
    sessionStorage.removeItem(PERSIST_ORIGIN_KEY)
  } catch {
    // ignored
  }
}
