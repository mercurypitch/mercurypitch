// ============================================================
// TabErrorBoundary — Per-tab error isolation
// Prevents crashes in one tab from taking down the entire SPA.
// ============================================================

import type { JSX, ParentComponent } from 'solid-js'
import { ErrorBoundary } from 'solid-js/web'

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
        const message = err instanceof Error ? err.message : String(err)
        return (
          <div class="tab-error-boundary">
            <div class="tab-error-content">
              <h3>Something went wrong</h3>
              <p>The "{props.tabName}" tab encountered an error.</p>
              <pre>{message}</pre>
              <button
                onClick={() => {
                  // Re-mount by toggling a key signal — the parent
                  // re-renders this boundary when the error is cleared.
                  window.location.reload()
                }}
              >
                Reload App
              </button>
            </div>
          </div>
        )
      }}
    >
      {props.children}
    </ErrorBoundary>
  )
}
