// ============================================================
// AppErrorBoundary — Global error handler for crashes
// ============================================================

import type { JSX, ParentComponent } from 'solid-js'
import { onMount } from 'solid-js'
import { ErrorBoundary } from 'solid-js/web'
import { setAppError as setAppErrorSignal } from '@/stores/app-store'

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
    <ErrorBoundary fallback={() => <ErrorContent />}>
      {props.children}
    </ErrorBoundary>
  )
}

/**
 * Error UI shown when an error occurs.
 */
const ErrorContent = () => {
  return (
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; padding: 20px; text-align: center;">
      <h1 style="font-size: 2rem; margin-bottom: 1rem;">Application Error</h1>
      <p style="color: #666; max-width: 500px; line-height: 1.5;">
        An unexpected error occurred. Please refresh the page.
      </p>
      <button
        style="margin-top: 2rem; padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;"
        onClick={() => window.location.reload()}
      >
        Refresh Page
      </button>
    </div>
  )
}
