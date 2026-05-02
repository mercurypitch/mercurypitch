// ============================================================
// AppErrorBoundary — Global error handler for crashes
// ============================================================

import type { JSX, ParentComponent } from 'solid-js'
import { onMount } from 'solid-js'
import { ErrorBoundary } from 'solid-js/web'
import { setAppError as setAppErrorSignal } from '@/stores/app-store'
import { CrashModal } from './CrashModal'

interface AppErrorBoundaryProps {
  children: JSX.Element
}

/**
 * Global error handler for unhandled errors.
 * Works in addition to the ErrorBoundary component.
 */
const setupGlobalErrorHandler = () => {
  const errorHandler = (event: ErrorEvent | PromiseRejectionEvent): void => {
    const err: Error =
      event instanceof ErrorEvent
        ? (event.error ?? new Error(event.message))
        : (event.reason ?? new Error('Unhandled promise rejection'))
    console.error('Unhandled error:', err)
    setAppErrorSignal({
      error: err,
      time: performance.now(),
    })
  }

  window.addEventListener('error', errorHandler)
  window.addEventListener('unhandledrejection', errorHandler)

  return () => {
    window.removeEventListener('error', errorHandler)
    window.removeEventListener('unhandledrejection', errorHandler)
  }
}

/**
 * ErrorBoundary for the entire app.
 * Wraps children and catches rendering errors.
 */
export const AppErrorBoundary: ParentComponent<AppErrorBoundaryProps> = (
  props,
) => {
  onMount(setupGlobalErrorHandler)

  return (
    <ErrorBoundary
      fallback={(err) => {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        // We set it in a microtask so we don't trigger SolidJS warnings about
        // setting signals during the render phase.
        queueMicrotask(() => {
          setAppErrorSignal({
            error: errorObj,
            time: Date.now(),
          })
        })
        return <CrashModal />
      }}
    >
      {props.children}
    </ErrorBoundary>
  )
}
