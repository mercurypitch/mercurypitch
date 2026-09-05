// ============================================================
// ChunkErrorBoundary — a lazy chunk that fails to load says so
// ============================================================
// The standalone rooms (Guitar Night, Karaoke Night) load their stages,
// account chips and sign-in forms with `lazy()`. When such an import
// rejects -- the network dropped, or a deploy replaced the hashed assets
// under an open tab -- Solid throws inside the nearest boundary, and the
// rooms had none: the Suspense fallback ("Opening the rehearsal room…")
// stayed on screen forever with no message and no way out.
//
// Two answers, told apart the way the app shell already does:
//   * a stale build (the chunk is gone from the origin) is not a crash and
//     a plain reload cannot fix it while the old worker re-serves the old
//     shell -- StaleBuildRecovery escapes the worker's cache;
//   * anything else gets a plain sentence and a Reload. `lazy()` keeps a
//     failed import's promise forever, so retrying in place is not an
//     option -- a reload is the honest retry.

import type { JSX, ParentComponent } from 'solid-js'
import { ErrorBoundary } from 'solid-js'
import { isStaleBuildError } from '@/lib/global-error-handler'
import styles from './ChunkErrorBoundary.module.css'
import { StaleBuildRecovery } from './StaleBuildRecovery'

export interface ChunkErrorBoundaryProps {
  /** What failed, as the sentence's subject: "The rehearsal room". */
  label: string
  /** Extra class for the notice, so a room can place it like its own copy. */
  class?: string
  /** Test seam: defaults to a full page reload. */
  reload?: () => void
  children: JSX.Element
}

export const ChunkErrorBoundary: ParentComponent<ChunkErrorBoundaryProps> = (
  props,
) => {
  const reload = (): void => {
    if (props.reload !== undefined) {
      props.reload()
      return
    }
    window.location.reload()
  }
  return (
    <ErrorBoundary
      fallback={(err: unknown) => {
        const cause = err instanceof Error ? err : new Error(String(err))
        if (isStaleBuildError(cause)) {
          console.warn('[pwa] this build is no longer served:', cause)
          return <StaleBuildRecovery />
        }
        console.error(`[chunk] ${props.label} failed to load:`, cause)
        return (
          <div
            class={`${styles.notice} ${props.class ?? ''}`.trim()}
            role="alert"
          >
            <p class={styles.text}>
              {props.label} could not be loaded.{' '}
              <span class={styles.hint}>
                Check your connection and reload the page.
              </span>
            </p>
            <button type="button" class={styles.button} onClick={reload}>
              Reload
            </button>
          </div>
        )
      }}
    >
      {props.children}
    </ErrorBoundary>
  )
}
