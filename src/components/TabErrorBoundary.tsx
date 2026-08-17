// ============================================================
// TabErrorBoundary — Per-tab error isolation
// Prevents crashes in one tab from taking down the entire SPA.
// ============================================================

import type { JSX, ParentComponent } from 'solid-js'
import { ErrorBoundary } from 'solid-js/web'
import { isStaleBuildError } from '@/lib/global-error-handler'
import { setAppError } from '@/stores/app-store'
import { CrashModal } from './CrashModal'
import { StaleBuildRecovery } from './StaleBuildRecovery'

interface TabErrorBoundaryProps {
  children: JSX.Element
  tabName: string
}

export const TabErrorBoundary: ParentComponent<TabErrorBoundaryProps> = (
  props,
) => {
  return (
    <ErrorBoundary
      fallback={(err) => {
        // Naming the tab used to be done by writing to the caught error's
        // own `message`. That works for an Error and throws for a
        // DOMException -- its `message` is a getter with no setter -- so
        // any crash carrying one (a failed getUserMedia, a rejected
        // clipboard write, an IndexedDB fault) was replaced, right here,
        // by "Cannot set property message of #<DOMException>". The real
        // fault never reached the modal, and the stack pointed at the
        // reporting code.
        //
        // A fallback must not be able to throw. So: build a new Error
        // instead of editing the one we were handed, keep the original as
        // `cause`, and carry its stack over -- `stack` is an own property
        // of a freshly constructed Error, so this assignment is safe in a
        // way the last one was not.
        const cause = err instanceof Error ? err : new Error(String(err))

        // A tab whose lazy chunk no longer exists on the origin is not a
        // crash in the tab — the BUILD is gone (a deploy replaced the
        // hashed assets). AppErrorBoundary has made this distinction since
        // 38c6d2bb, but every tab renders inside THIS boundary, which
        // caught the rejection first and showed the crash modal instead of
        // recovering (owner repro: Progress tab, ProgressRoute-*.js,
        // 2026-08-17). Same check, same recovery, one boundary earlier.
        if (isStaleBuildError(cause)) {
          console.warn('[pwa] this build is no longer served:', cause)
          return <StaleBuildRecovery />
        }

        const errorObj = new Error(`[Tab: ${props.tabName}] ${cause.message}`, {
          cause,
        })
        if (typeof cause.stack === 'string') errorObj.stack = cause.stack

        queueMicrotask(() => {
          setAppError({
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
