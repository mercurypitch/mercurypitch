// ============================================================
// Shared background auto-resume for server (RunPod) separations.
// ============================================================
//
// A server separation submits a RunPod job (debiting one credit) and then
// polls it to completion IN MEMORY. Any full-page teardown — a reload, or
// navigating to the standalone /karaoke entry via `location.assign` — kills
// that poll. The job keeps running server-side and the credit is already
// spent, so the ONLY correct recovery is to re-attach to the existing job on
// the next load (free) rather than leave it stuck at "still separating" or
// force a re-billed fresh separation.
//
// This module owns that recovery so it can run from EVERY entry that shows
// separations:
//   • the main app (App.tsx) — always mounted, NOT gated behind the Karaoke
//     tab (the previous home of this logic, in UvrPanel, only ran while that
//     tab was open); and
//   • the standalone Karaoke Night page (KaraokeNightRuntime) — which had no
//     resume path at all, the direct cause of the "stuck forever after
//     navigating to /karaoke" report.
//
// resumeServerSession is idempotent — pollAndPersistServer atomically guards on
// isServerPollActive before its first await — so multiple owners calling this
// can never run two polls against one job or re-charge it.

import { createEffect, onCleanup } from 'solid-js'
import type { ProcessingCallbacks } from '@/lib/uvr-processing-pipeline'
import { isServerPollActive, resumeServerSession, } from '@/lib/uvr-processing-pipeline'
import { completeUvrSession, isSessionStoreReady, resumableServerSessions, setErrorUvrSession, setUvrSessionResuming, } from '@/stores/app-store'

export interface AutoResumeHooks {
  /** Fired after a resumed job settles (complete or error) so the host can
   *  refresh the credit balance — a server error may have refunded. Optional;
   *  completion itself never changes credits (the debit was at submit). */
  onCreditsMaybeChanged?: () => void
}

/** Background pipeline callbacks: persist the result / error into the store and
 *  nothing else. View navigation and toasts belong to whichever panel is on
 *  screen (UvrPanel), not to a silent background re-attach. */
function backgroundCallbacks(
  sessionId: string,
  hooks?: AutoResumeHooks,
): ProcessingCallbacks {
  return {
    onProgress: () => {
      // Progress is written inside the pipeline via updateUvrSessionProgress.
    },
    onComplete: async (result) => {
      await completeUvrSession(sessionId, result.outputs, result.stemMeta)
      hooks?.onCreditsMaybeChanged?.()
    },
    onError: (message) => {
      setErrorUvrSession(sessionId, message)
      hooks?.onCreditsMaybeChanged?.()
    },
  }
}

/** Re-attach (in the background) to every server job we can still recover.
 *  A no-op for jobs already being polled, so it is safe to call repeatedly and
 *  from multiple owners. */
export async function autoResumeServerSessions(
  hooks?: AutoResumeHooks,
): Promise<void> {
  const recoverable = await resumableServerSessions()
  for (const session of recoverable) {
    const apiId = session.apiSessionId
    if (apiId === undefined || apiId === '' || isServerPollActive(apiId)) {
      continue
    }
    // Reads "reconnecting" until the first poll returns real progress; keeps
    // the persisted percentage, so the bar doesn't snap back to 0%.
    setUvrSessionResuming(session.sessionId)
    void resumeServerSession(
      session.sessionId,
      apiId,
      backgroundCallbacks(session.sessionId, hooks),
    ).catch((err) => {
      // pollForCompletion already routed a terminal failure through onError;
      // just don't leave the rejection unhandled.
      console.warn('[uvr-auto-resume] resume failed:', err)
    })
  }
}

/** Wire the standard resume triggers inside a component's reactive scope: once
 *  the session store is ready, and again whenever the tab returns to the
 *  foreground or the network reconnects. Must be called during component setup
 *  (uses createEffect + onCleanup). */
export function installAutoResume(hooks?: AutoResumeHooks): void {
  let started = false
  createEffect(() => {
    if (!isSessionStoreReady() || started) return
    started = true
    void autoResumeServerSessions(hooks)
  })

  const onVisible = (): void => {
    if (document.visibilityState === 'visible') {
      void autoResumeServerSessions(hooks)
    }
  }
  const onOnline = (): void => void autoResumeServerSessions(hooks)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  onCleanup(() => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
  })
}
