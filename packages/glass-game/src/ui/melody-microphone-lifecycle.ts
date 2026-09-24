// Melody microphone lifecycle — own cooperative handoff and attached recording cleanup.

import type { GlassGameHost, GlassVoiceSession } from '../host'
import type { MicrophoneIssue } from './mic-error'
import { microphoneTakeoverTimedOut } from './mic-error'

interface MelodyMicrophoneRecoveryOptions {
  host: Pick<
    GlassGameHost,
    'takeOverMicrophone' | 'releaseUnusedMicrophoneTakeover'
  >
  eligible(): boolean
  beginAttempt(): number
  isCurrentAttempt(attempt: number): boolean
  setPending(pending: boolean): void
  retry(): Promise<boolean>
  onTimeout(issue: MicrophoneIssue): void
}

/** Host-owned recording taps the open practice session; it never acquires another mic. */
export interface MelodyPracticeRecordingAdapter {
  start(session: GlassVoiceSession): void
  stop(session: GlassVoiceSession, outcome: 'complete' | 'cancelled'): void
}

export function createMelodyPracticeRecordingLifecycle(
  adapter: MelodyPracticeRecordingAdapter | undefined,
) {
  let session: GlassVoiceSession | null = null
  return {
    start(next: GlassVoiceSession): void {
      try {
        adapter?.start(next)
        if (adapter !== undefined) session = next
      } catch {
        session = null
        try {
          adapter?.stop(next, 'cancelled')
        } catch {
          // The voice session remains owned and will be released normally.
        }
      }
    },
    stop(outcome: 'complete' | 'cancelled'): void {
      const current = session
      session = null
      if (current === null) return
      try {
        adapter?.stop(current, outcome)
      } catch {
        // Recording is optional; its cleanup cannot strand the microphone.
      }
    },
  }
}

async function releaseUnused(
  host: MelodyMicrophoneRecoveryOptions['host'],
): Promise<void> {
  try {
    await host.releaseUnusedMicrophoneTakeover?.()
  } catch {
    // A later acquisition rechecks the shared lock either way.
  }
}

export function createMelodyMicrophoneRecovery(
  options: MelodyMicrophoneRecoveryOptions,
): () => Promise<boolean> {
  return async () => {
    const takeOver = options.host.takeOverMicrophone
    if (!options.eligible() || takeOver === undefined) return false
    const attempt = options.beginAttempt()
    options.setPending(true)
    let moved = false
    try {
      moved = await takeOver()
    } catch {
      moved = false
    }
    if (!options.isCurrentAttempt(attempt)) {
      if (moved) await releaseUnused(options.host)
      return false
    }
    options.setPending(false)
    if (!moved) {
      options.onTimeout(microphoneTakeoverTimedOut())
      return false
    }
    const acquired = await options.retry()
    if (!acquired) await releaseUnused(options.host)
    return acquired
  }
}
