import { createSignal } from 'solid-js'

export interface LogEntry {
  id: string
  timestamp: number
  type: 'log' | 'error' | 'warn' | 'info'
  args: string[]
}

export const [consoleLogs, setConsoleLogs] = createSignal<LogEntry[]>([])
export const [showConsoleLog, setShowConsoleLog] = createSignal<boolean>(false)

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
