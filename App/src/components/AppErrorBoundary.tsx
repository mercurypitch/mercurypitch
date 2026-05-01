// ============================================================
// AppErrorBoundary — Global error handler for crashes
// ============================================================

import type { ParentComponent } from 'solid-js'
import { ErrorBoundary,onMount } from 'solid-js'
import { setAppError as setAppErrorSignal } from '@/stores/app-store'

interface AppErrorBoundaryProps {
  children: JSX.Element
}

/**
 * Called when any child component throws an error.
 * Sets the global error state to display the crash modal.
 */
const handleError = (error: Error): void => {
  console.error('App crashed:', error)
  setAppErrorSignal({
    error,
    time: performance.now(),
  })
}

/**
 * Global error handler for unhandled errors.
 * Works in addition to the ErrorBoundary component.
 */
const setupGlobalErrorHandler = () => {
  const errorHandler = (event: ErrorEvent | PromiseRejectionEvent): void => {
    const err: Error =
      event instanceof ErrorEvent
        ? event.error ?? new Error(event.message)
        : event.reason ?? new Error('Unhandled promise rejection')
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
export const AppErrorBoundary: ParentComponent<AppErrorBoundaryProps> = (props) => {
  onMount(setupGlobalErrorHandler)

  return (
    <ErrorBoundary fallback={null} onError={handleError}>
      {props.children}
    </ErrorBoundary>
  )
}
