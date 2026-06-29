import { addConsoleLog } from '@/stores/console-store'
import { exposeForE2E } from './test-utils'

/**
 * A fetch() that can't reach the server rejects with a TypeError whose message
 * is browser-specific: "NetworkError when attempting to fetch resource"
 * (Firefox), "Failed to fetch" (Chrome/Edge), "Load failed" (Safari). These
 * mean the backend is unreachable (offline / worker down / CORS-blocked), which
 * is a degraded-but-expected state — not an app crash. We warn instead of error
 * and swallow the rejection so it never surfaces as "Uncaught (in promise)".
 */
function isNetworkError(reason: unknown): boolean {
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : typeof reason === 'object' && reason !== null && 'message' in reason
          ? String((reason as { message: unknown }).message)
          : ''
  return /NetworkError when attempting to fetch|Failed to fetch|Load failed/i.test(
    msg,
  )
}

/**
 * Initializes global error and unhandled rejection handlers.
 * Also hooks into console.log/error/warn/info to capture logs for E2E testing
 * and for the developer console log component.
 */
export function initGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (e: ErrorEvent) => {
    // Ignore benign ResizeObserver loop errors (see AppErrorBoundary.tsx)
    const msg = e.message ?? ''
    if (msg.includes('ResizeObserver')) {
      e.preventDefault()
      return
    }
    if (isNetworkError(e.error) || isNetworkError(msg)) {
      console.warn('[net] request failed (backend unreachable / offline):', msg)
      e.preventDefault()
      return
    }
    const errorMsg = e.error !== null ? e.error : e.message
    console.error('Global error:', errorMsg)
    exposeForE2E('__globalError', errorMsg)
  })

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    if (isNetworkError(e.reason)) {
      // Degraded-but-expected: warn, and swallow so it isn't "Uncaught".
      console.warn(
        '[net] request failed (backend unreachable / offline):',
        e.reason instanceof Error ? e.reason.message : e.reason,
      )
      e.preventDefault()
      return
    }
    console.error('Unhandled promise rejection:', e.reason)
    exposeForE2E('__globalError', e.reason)
  })

  // Capture console logs for E2E debugging and the in-app developer console
  const logs: { type: string; args: string[] }[] = []
  exposeForE2E('__consoleLogs', logs)

  const oldLog = console.log
  console.log = (...args) => {
    logs.push({
      type: 'log',
      args: args.map((a) => String(a)),
    })
    if (logs.length > 500) logs.splice(0, logs.length - 500)
    addConsoleLog('log', args)
    oldLog(...args)
  }

  const oldError = console.error
  console.error = (...args) => {
    logs.push({
      type: 'error',
      args: args.map((a) => String(a)),
    })
    if (logs.length > 500) logs.splice(0, logs.length - 500)
    addConsoleLog('error', args)
    oldError(...args)
  }

  const oldWarn = console.warn
  console.warn = (...args) => {
    logs.push({
      type: 'warn',
      args: args.map((a) => String(a)),
    })
    if (logs.length > 500) logs.splice(0, logs.length - 500)
    addConsoleLog('warn', args)
    oldWarn(...args)
  }

  const oldInfo = console.info
  console.info = (...args) => {
    logs.push({
      type: 'info',
      args: args.map((a) => String(a)),
    })
    if (logs.length > 500) logs.splice(0, logs.length - 500)
    addConsoleLog('info', args)
    oldInfo(...args)
  }

  console.log('global-error-handler: Handlers installed')
}
