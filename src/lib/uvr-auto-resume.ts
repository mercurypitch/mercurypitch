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
import type { StemSplitResult } from '@/lib/uvr-stem-split'
import { attachToStemSplitJob, isStemSplitActive, runStemSplit, StemSplitError, } from '@/lib/uvr-stem-split'
import { clearUvrSplitJob, completeUvrSession, getAllUvrSessions, getUvrSession, isSessionStoreReady, recordUvrSplitJobStarted, recordUvrSplitTime, resumableServerSessions, setErrorUvrSession, setInterruptedUvrSession, setUvrSessionResuming, } from '@/stores/app-store'

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
  // Interrupted second passes ride the same triggers.
  void autoResumeStemSplits()
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
      // pollForCompletion already routed the failure through onError, which
      // parked it as `error`. But onError cannot tell a dead job from a dropped
      // packet — only the pipeline can, and it says so by clearing the
      // apiSessionId on a TerminalPollError and keeping it otherwise. That
      // catch has run by the time we get here, so the surviving id is the
      // verdict: the job may still be alive (or already finished, with its
      // stems in R2 for 24h), and `error` would freeze it out of every future
      // resume trigger while offering the user a second charge.
      const still = getUvrSession(session.sessionId)
      if (still?.apiSessionId !== undefined && still.apiSessionId !== '') {
        setInterruptedUvrSession(session.sessionId)
      }
      console.warn('[uvr-auto-resume] resume failed:', err)
    })
  }
}

/**
 * Start an instrumental split with full lifecycle bookkeeping — THE way
 * every surface launches one (results viewer, Full band chain). Persists
 * the job id for reload-resume, records the split time on success, and
 * clears the marker on failure. Progress/busy state lives in the
 * module-level registry (activeStemSplits), so navigation can't lose it;
 * the caller only handles its own toasts.
 */
export async function startManagedStemSplit(
  sessionId: string,
  options: {
    reuseApiSessionId?: string
    durationSeconds?: number
  } = {},
): Promise<StemSplitResult> {
  try {
    const result = await runStemSplit(sessionId, {
      ...options,
      onJobStarted: (serverSessionId) =>
        void recordUvrSplitJobStarted(sessionId, serverSessionId),
    })
    void recordUvrSplitTime(sessionId, result.elapsedMs)
    return result
  } catch (err) {
    // Clear the resume marker ONLY on a definitive dead-job verdict. A
    // recoverable failure (download hiccup, worker restart mid-pickup)
    // leaves the paid job's stems in R2 — the marker is the claim ticket
    // the next auto-resume uses to collect them. Stale markers self-clean:
    // resuming a truly gone job yields a non-recoverable error here.
    if (err instanceof StemSplitError && !err.recoverable) {
      void clearUvrSplitJob(sessionId)
    }
    throw err
  }
}

/** Re-attach to every split whose poll a teardown killed (splitApiSessionId
 *  persisted before polling). Free: the job is already paid; RunPod holds
 *  the result ~30 min and the stems live in R2 ~24 h. A job that can't be
 *  recovered any more just has its marker cleared — failed jobs were
 *  auto-refunded server-side. */
export async function autoResumeStemSplits(): Promise<void> {
  for (const session of getAllUvrSessions()) {
    const splitId = session.splitApiSessionId
    if (splitId === undefined || splitId === '') continue
    if (isStemSplitActive(session.sessionId)) continue
    void attachToStemSplitJob(session.sessionId, splitId)
      .then(() => {
        // Keep an existing recorded time; the marker just needs clearing.
        if (getUvrSession(session.sessionId)?.splitApiSessionId !== undefined) {
          void clearUvrSplitJob(session.sessionId)
        }
      })
      .catch((err: unknown) => {
        console.warn('[uvr-auto-resume] split resume failed:', err)
        // Same discipline as startManagedStemSplit: only a definitive
        // verdict burns the marker; transient trouble retries on the
        // next trigger (load / tab visible / back online).
        if (err instanceof StemSplitError && !err.recoverable) {
          void clearUvrSplitJob(session.sessionId)
        }
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
