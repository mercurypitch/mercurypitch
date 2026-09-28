// ============================================================
// Console Store — in-app console log capture for the debug overlay
// ============================================================
//
// Mirrors console output into a ring buffer the ConsoleLog panel renders, so
// bug reports from phones (where no devtools exist) still carry a trace.
// Entries are stringified defensively: circular refs and BigInt both throw
// under plain JSON.stringify, and a logging path must never be the thing that
// crashes the app.
//
// Every build carries this buffer, the native store binary included: the
// global error handler writes to it and the crash card shows it. The switch
// that floats it over the page is developer-console-store.ts, a store of its
// own because a store binary must carry none of the floating console.

import { createSignal } from 'solid-js'

export interface LogEntry {
  id: string
  timestamp: number
  type: 'log' | 'error' | 'warn' | 'info'
  args: string[]
}

export const [consoleLogs, setConsoleLogs] = createSignal<LogEntry[]>([])

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
