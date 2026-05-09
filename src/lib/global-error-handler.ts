import { addConsoleLog } from '@/stores/console-store'
import { exposeForE2E } from './test-utils'

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
    const errorMsg = e.error !== null ? e.error : e.message
    console.error('Global error:', errorMsg)
    exposeForE2E('__globalError', errorMsg)
  })

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
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
    addConsoleLog('warn', args)
    oldWarn(...args)
  }

  const oldInfo = console.info
  console.info = (...args) => {
    logs.push({
      type: 'info',
      args: args.map((a) => String(a)),
    })
    addConsoleLog('info', args)
    oldInfo(...args)
  }

  console.log('global-error-handler: Handlers installed')
}
