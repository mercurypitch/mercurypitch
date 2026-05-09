import { exposeForE2E } from './test-utils'

/**
 * Hooks into console.log/error to capture logs for E2E testing.
 * Global error/unhandled rejection handling is in AppErrorBoundary.
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
    const errorMsg = e.error !== null ? e.error : e.message
    console.error('Global error:', errorMsg)
    exposeForE2E('__globalError', errorMsg)
  })

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection:', e.reason)
    exposeForE2E('__globalError', e.reason)
  })

  // Capture console logs for E2E debugging
  const logs: { type: string; args: string[] }[] = []
  exposeForE2E('__consoleLogs', logs)

  const oldLog = console.log
  console.log = (...args) => {
    logs.push({
      type: 'log',
      args: args.map((a) => String(a)),
    })
    if (logs.length > 500) logs.splice(0, logs.length - 500)
    oldLog(...args)
  }

  const oldError = console.error
  console.error = (...args) => {
    logs.push({
      type: 'error',
      args: args.map((a) => String(a)),
    })
    if (logs.length > 500) logs.splice(0, logs.length - 500)
    oldError(...args)
  }

  console.log('global-error-handler: Console log capture installed')
}
