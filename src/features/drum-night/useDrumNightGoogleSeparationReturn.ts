// ============================================================
// Drum Night: a blocked separation, resumed after the Google round trip
// ============================================================
//
// "Separate drums" needs an account. Signed out, the press is blocked and the
// room's sign-in dialog opens. With Google that dialog leaves the page, so the
// press was forgotten on the way back and the drummer had to find the song
// and press again. Guitar Night solved this first (prepareGoogleRedirect in
// GuitarNightApp); this is the same contract for Drum Night, kept out of
// DrumNightApp so that file does not grow (docs/agent/REFACTOR-PLAN.md).
//
// The lease is convenience, never billing authority: the resume reads the
// account and credits fresh, and the room's own press runs the same preflight
// before any cloud job starts.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal } from 'solid-js'
import type { GoogleRedirectResult } from '@/db/services/auth-service'
import type { GoogleSeparationIntent } from '@/lib/google-separation-intent'
import { googleSeparationIntentStore } from '@/lib/google-separation-intent'

/**
 * The fields of a Drum Night backing source that name the recording.
 * Structural on purpose: it is all this module reads, and it keeps the
 * sibling play-along feature out of its imports.
 */
export interface DrumSeparationBacking {
  readonly sessionId: string
  readonly title: string
  readonly source?: 'device' | 'demo'
  readonly stemKinds: readonly string[]
  readonly plannedMix: {
    readonly kind: string
    readonly audible: readonly string[]
    readonly muted: readonly string[]
  }
  readonly durationSeconds: number | null
}

/** What the song controller has selected, as far as a resume cares. */
export type DrumSeparationSelection =
  | { readonly kind: 'idle' | 'loading' | 'unavailable' }
  | { readonly kind: 'ready'; readonly lease: DrumSeparationBacking }

const intents = googleSeparationIntentStore(
  'mp:drumNightGoogleSeparationIntent',
)

/**
 * The same song reopened after the redirect matches, whatever order its parts
 * arrive in; a different recording under the same session id does not.
 */
export function drumNightBackingFingerprint(
  backing: DrumSeparationBacking,
): string {
  return JSON.stringify({
    sessionId: backing.sessionId,
    title: backing.title,
    source: backing.source ?? 'device',
    stemKinds: [...backing.stemKinds].sort(),
    plannedMix: {
      kind: backing.plannedMix.kind,
      audible: [...backing.plannedMix.audible].sort(),
      muted: [...backing.plannedMix.muted].sort(),
    },
    durationSeconds: backing.durationSeconds,
  })
}

/** "Separate drums" is on offer: drums still inside a mix of the drummer's own. */
function separable(backing: DrumSeparationBacking): boolean {
  return (
    backing.plannedMix.kind === 'mixed-instrumental' &&
    backing.source !== 'demo'
  )
}

export interface DrumNightGoogleSeparationReturnOptions {
  /** The song whose blocked separation opened the sign-in, when one did. */
  blockedSessionId: Accessor<string | null>
  selection: Accessor<DrumSeparationSelection>
  routeSessionId: Accessor<string | null>
  /** Moves with every new source intent; a resume that sees it move gives way. */
  sourceRevision: () => number
  /** Read the account and its credits fresh. */
  refreshAccount: () => Promise<void>
  /** The room's own "Separate drums" press, preflight included. */
  startSeparation: (sessionId: string) => void
}

export interface DrumNightGoogleSeparationReturn {
  /** For AuthModal: write the lease just before the page leaves for Google. */
  prepareGoogleRedirect: () => (() => void) | undefined
  /** For the account chip: what the Google return said. */
  handleGoogleRedirectResult: (result: GoogleRedirectResult) => void
}

export function useDrumNightGoogleSeparationReturn(
  options: DrumNightGoogleSeparationReturnOptions,
): DrumNightGoogleSeparationReturn {
  const [returning, setReturning] = createSignal<GoogleSeparationIntent | null>(
    null,
  )

  const prepareGoogleRedirect = (): (() => void) | undefined => {
    // Every Google attempt supersedes an abandoned lease. Only a sign-in
    // opened from the blocked separation of the song on stage earns one.
    intents.clear()
    const sessionId = options.blockedSessionId()
    const selection = options.selection()
    if (
      sessionId === null ||
      selection.kind !== 'ready' ||
      selection.lease.sessionId !== sessionId ||
      !separable(selection.lease)
    ) {
      return undefined
    }
    return intents.prepare(
      sessionId,
      drumNightBackingFingerprint(selection.lease),
    )
  }

  const handleGoogleRedirectResult = (result: GoogleRedirectResult): void => {
    // Spent even when the sign-in failed, so no later one can replay it.
    const pending = intents.take()
    if (!result.ok || pending === null) return
    setReturning(pending)
  }

  const resume = async (sessionId: string): Promise<void> => {
    const revision = options.sourceRevision()
    try {
      await options.refreshAccount()
    } catch {
      // Nothing billable starts on an account that could not be read; the
      // drummer can still press "Separate drums" by hand.
      return
    }
    // The drummer moved on while the account was being read.
    if (options.sourceRevision() !== revision) return
    options.startSeparation(sessionId)
  }

  createEffect(() => {
    const pending = returning()
    if (pending === null) return
    if (options.routeSessionId() !== pending.sessionId) {
      setReturning(null)
      return
    }
    const selection = options.selection()
    if (selection.kind === 'idle' || selection.kind === 'loading') return
    setReturning(null)
    if (
      selection.kind !== 'ready' ||
      !separable(selection.lease) ||
      drumNightBackingFingerprint(selection.lease) !==
        pending.backingFingerprint
    ) {
      return
    }
    void resume(pending.sessionId)
  })

  return { prepareGoogleRedirect, handleGoogleRedirectResult }
}
