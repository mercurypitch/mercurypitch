// ============================================================
// StaleBuildRecovery — shown when this build's chunks are gone from the origin
// ============================================================
// A lazy import that fails during render never reaches the window-level
// stale-build filters in global-error-handler.ts — Solid's ErrorBoundary
// catches it first. Landing that failure in the CrashModal is doubly wrong:
// it is not an app bug, and the modal's plain reload cannot fix it (the
// controlling worker re-serves the same dead shell from its precache, so the
// page crashes identically on every click — seen on dev, 2026-08-16).
//
// This screen does the one thing that helps: `reloadToLatest`, which escapes
// the worker's cache. It fires automatically once; if the page lands here
// again within the cooldown the automatic path clearly is not sticking, so it
// asks instead of looping.

import type { Component } from 'solid-js'
import { createSignal, onMount, Show } from 'solid-js'
import { reloadToLatest, requestUpdateCheck } from '@/lib/pwa-service-worker'
import { Spinner } from './shared/Spinner'
import styles from './StaleBuildRecovery.module.css'

/** Session-scoped stamp of the last automatic recovery attempt. */
export const STALE_RELOAD_STAMP_KEY = 'mp-stale-reload-at'

/**
 * A second stale crash this soon after an automatic reload means the reload
 * did not move the page to a working build; reloading again would loop.
 */
const AUTO_RELOAD_COOLDOWN_MS = 60_000

export interface StaleBuildRecoveryProps {
  /** Test seam: defaults to `reloadToLatest`. */
  reload?: () => Promise<void>
  /** Test seam: defaults to `sessionStorage`. */
  storage?: Storage
  /** Test seam: defaults to `Date.now`. */
  now?: () => number
}

export const StaleBuildRecovery: Component<StaleBuildRecoveryProps> = (
  props,
) => {
  const [auto, setAuto] = createSignal(false)
  const reload = (): void => {
    void (props.reload ?? reloadToLatest)()
  }

  onMount(() => {
    // Whatever happens next, ask for the new worker now — the prompt flow is a
    // second rescue path and the check is throttled internally.
    requestUpdateCheck()

    let lastAttempt = 0
    let storage: Storage | undefined
    try {
      // Even reading `sessionStorage` can throw (cookies fully disabled), so
      // the default lives inside the try. Denied storage means a loop cannot
      // be detected — treated as a first attempt, and a reload that fails to
      // stick still lands back here with the prompt flow as the way out.
      storage = props.storage ?? sessionStorage
      lastAttempt = Number(storage.getItem(STALE_RELOAD_STAMP_KEY) ?? 0)
    } catch {
      storage = undefined
    }
    const now = (props.now ?? Date.now)()
    if (
      Number.isFinite(lastAttempt) &&
      now - lastAttempt < AUTO_RELOAD_COOLDOWN_MS
    )
      return
    try {
      storage?.setItem(STALE_RELOAD_STAMP_KEY, String(now))
    } catch {
      // The attempt still proceeds; only loop detection is lost.
    }
    setAuto(true)
    reload()
  })

  return (
    <div class={styles.overlay} role="alert" aria-live="assertive">
      <div class={styles.card}>
        {/* The one spinner. This used to rotate the refresh glyph, whose
            arrowhead the eye tracks all the way round — it read as a
            tumbling object, not as progress. */}
        <Spinner class={styles.icon} size={32} />
        <h2 class={styles.title}>A new version of MercuryPitch is ready</h2>
        <Show
          when={auto()}
          fallback={
            <>
              <p class={styles.detail}>
                This page is running a build the server has already replaced,
                and the automatic update did not stick. Reload to fetch the
                latest version.
              </p>
              <button class={styles.reloadBtn} onClick={reload}>
                Reload now
              </button>
            </>
          }
        >
          <p class={styles.detail}>Updating to the latest version…</p>
        </Show>
      </div>
    </div>
  )
}
