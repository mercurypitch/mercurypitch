// ============================================================
// AppErrorBoundary — Global error handler for crashes
// ============================================================

import type { JSX, ParentComponent } from 'solid-js'
import { onMount } from 'solid-js'
import { ErrorBoundary } from 'solid-js/web'
import { isNetworkError, isStaleBuildError } from '@/lib/global-error-handler'
import { exposeForE2E } from '@/lib/test-utils'
import { setAppError as setAppErrorSignal } from '@/stores/app-store'
import { CrashModal } from './CrashModal'
import { StaleBuildRecovery } from './StaleBuildRecovery'

interface AppErrorBoundaryProps {
  children: JSX.Element
}

/**
 * Global error handler for unhandled errors.
 * Works in addition to the ErrorBoundary component.
 */
export const setupGlobalErrorHandler = () => {
  const errorHandler = (event: ErrorEvent | PromiseRejectionEvent): void => {
    // ResizeObserver loop errors are benign browser internals — they fire
    // when a ResizeObserver callback triggers further layout changes that
    // can't be delivered in the same frame. iOS Safari is particularly
    // aggressive about surfacing these as unhandled errors. They are NOT
    // real app crashes and must never trigger the CrashModal.
    if (event instanceof ErrorEvent) {
      const msg = event.message ?? ''
      if (msg.includes('ResizeObserver')) {
        event.preventDefault()
        return
      }

      // Ignore cross-origin or browser-injected script errors (e.g. Firefox iOS)
      // that do not provide an error object. These are not app crashes.
      if (msg === 'Script error.' && event.error == null) {
        event.preventDefault()
        console.warn('Ignored external Script error.')
        return
      }
    }

    const err: Error =
      event instanceof ErrorEvent
        ? (event.error ?? new Error(event.message))
        : (event.reason ?? new Error('Unhandled promise rejection'))

    // The backend being unreachable is not a crash. global-error-handler.ts
    // already calls preventDefault() for these, but preventDefault only
    // suppresses the browser's default action — it does not stop this second
    // listener from running. Without the same check here, going offline, or a
    // worker being briefly down, put the full-screen CrashModal in front of a
    // user whose app was working fine.
    // A chunk from a build the origin has already replaced. Not a crash, and
    // not fixable from inside the page — global-error-handler.ts has already
    // asked for the update that fixes it, and the reload prompt takes it from
    // there. Same reason as above for repeating the check here.
    if (isStaleBuildError(err)) {
      console.warn('[pwa] this build is no longer served:', err)
      return
    }

    if (isNetworkError(err)) {
      console.warn('[net] request failed (backend unreachable / offline):', err)
      return
    }

    console.error('Unhandled error:', err)
    exposeForE2E('__globalError', err)
    setAppErrorSignal({
      error: err,
      time: Date.now(),
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
        // A lazy() import failing during render lands HERE, not in the window
        // listeners above — so the stale-build check has to be repeated a
        // third time or a routine deploy shows up as an app crash whose
        // "Reload App" cannot fix it (a plain reload re-serves the same dead
        // build from the worker's precache).
        if (isStaleBuildError(errorObj)) {
          console.warn('[pwa] this build is no longer served:', errorObj)
          return <StaleBuildRecovery />
        }
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
