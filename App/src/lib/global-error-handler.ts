import { exposeForE2E } from './test-utils'

/**
 * Initializes global error and unhandled rejection handlers.
 * Also hooks into console.log/error to capture logs for E2E testing.
 */
export function initGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (e: ErrorEvent) => {
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
    oldLog(...args)
  }

  const oldError = console.error
  console.error = (...args) => {
    logs.push({
      type: 'error',
      args: args.map((a) => String(a)),
    })
    oldError(...args)
  }

  console.log('global-error-handler: Handlers installed')
}
