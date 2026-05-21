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
        const errorObj = err instanceof Error ? err : new Error(String(err))
        
        // Ensure the error has context about which tab crashed
        if (err instanceof Error) {
          errorObj.message = `[Tab: ${props.tabName}] ${errorObj.message}`
        }

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
