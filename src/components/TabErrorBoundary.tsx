// ============================================================
// TabErrorBoundary — Per-tab error isolation
// Prevents crashes in one tab from taking down the entire SPA.
// ============================================================

import type { JSX, ParentComponent } from 'solid-js'
import { ErrorBoundary } from 'solid-js/web'
import { setAppError } from '@/stores/app-store'
import { CrashModal } from './CrashModal'

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
