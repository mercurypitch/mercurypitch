// ============================================================
// Console Store — in-app console log capture for the debug overlay
// ============================================================
//
// Mirrors console output into a ring buffer the ConsoleLog panel renders, so
// bug reports from phones (where no devtools exist) still carry a trace.
// Entries are stringified defensively: circular refs and BigInt both throw
// under plain JSON.stringify, and a logging path must never be the thing that
// crashes the app.

import { createSignal } from 'solid-js'
import { DEVELOPER_CONSOLE_KEY } from '@/lib/developer-console'
import { createPersistedSignal } from '@/lib/storage'

export interface LogEntry {
  id: string
  timestamp: number
  type: 'log' | 'error' | 'warn' | 'info'
  args: string[]
}

export const [consoleLogs, setConsoleLogs] = createSignal<LogEntry[]>([])

/**
 * Persisted, because "on every page" includes the pages that are their own
 * document. Karaoke Night, the Mirror and each Night entry are separate
 * documents; a plain signal would switch the console off the moment you walked
 * through a door, which is exactly when a phone bug tends to show itself.
 *
 * Device-local despite the prefix: it is listed in `EXCLUDED_KEYS` in
 * src/db/services/settings-service.ts, because the console is switched on to
 * read what THIS device is saying and syncing it grew a debug panel on every
 * other signed-in device.
 */
export const [showConsoleLog, setShowConsoleLog] =
  createPersistedSignal<boolean>(DEVELOPER_CONSOLE_KEY, false)

// Safe stringify to handle circular references and BigInt
function safeStringify(obj: unknown): string {
  if (obj === null) return 'null'
  if (obj === undefined) return 'undefined'

  if (typeof obj === 'string') return obj
  if (
    typeof obj === 'number' ||
    typeof obj === 'boolean' ||
    typeof obj === 'symbol'
  ) {
    return String(obj)
  }
  if (typeof obj === 'bigint') {
    return `${obj.toString()}n`
  }
  if (obj instanceof Error) {
    return obj.stack ?? obj.message ?? String(obj)
  }

  try {
    const cache = new Set()
    return JSON.stringify(
      obj,
      (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (cache.has(value)) {
            return '[Circular]'
          }
          cache.add(value)
        }
        if (typeof value === 'bigint') {
          return `${value.toString()}n`
        }
        return value
      },
      2,
    )
  } catch (e) {
    return `[Unserializable Object: ${String(e)}]`
  }
}

export function addConsoleLog(type: LogEntry['type'], args: unknown[]): void {
  try {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      type,
      args: args.map(safeStringify),
    }
    setConsoleLogs((prev) => [...prev, entry])
  } catch (e) {
    // Failsafe so we don't break the original console methods
    setConsoleLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: 'error',
        args: [`[Console Store Error] Failed to process log: ${String(e)}`],
      },
    ])
  }
}

export function clearConsoleLogs(): void {
  setConsoleLogs([])
}

export function toggleConsoleLog(): void {
  setShowConsoleLog((prev) => !prev)
}

/** The whole buffer as one block of text, for a Copy that a phone can paste
 *  into a bug report. Same shape the log reads on screen, so what gets pasted
 *  is what was seen. */
export function formatConsoleLogs(): string {
  return consoleLogs()
    .map((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString()
      return `${time} [${entry.type}] ${entry.args.join(' ')}`
    })
    .join('\n')
}
