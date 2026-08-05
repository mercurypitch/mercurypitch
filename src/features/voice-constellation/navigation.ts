// ============================================================
// Voice Constellation Navigation — route entry and safe close semantics.
// ============================================================
//
// In-app opens get a real history entry, so browser Back returns to the
// trigger. A directly loaded deep link has no trusted in-app entry behind it;
// closing that replaces the hash with the current tab instead of walking the
// visitor off-site.

import type { ActiveTab } from '@/features/tabs/constants'
import { navigateTo, parseHash, replaceHash } from '@/lib/hash-router'

const RETURN_HASH_KEY = 'mercurypitch.voiceConstellation.returnHash'
let historyExitPending = false

type VoiceConstellationHistoryState = Record<string, unknown> & {
  [RETURN_HASH_KEY]?: string
}

function historyState(): VoiceConstellationHistoryState {
  const state: unknown = window.history.state
  return typeof state === 'object' && state !== null
    ? (state as VoiceConstellationHistoryState)
    : {}
}

/** Open from an app control while preserving the exact hash to return to. */
export function openVoiceConstellation(): void {
  if (parseHash(window.location.hash).type === 'voice-constellation') return

  const returnHash = window.location.hash
  navigateTo({ type: 'voice-constellation' })

  // Setting location.hash creates the entry synchronously; attach provenance
  // to that new entry before its asynchronous hashchange dispatch arrives.
  if (parseHash(window.location.hash).type === 'voice-constellation') {
    window.history.replaceState(
      { ...historyState(), [RETURN_HASH_KEY]: returnHash },
      '',
      window.location.href,
    )
  }
}

export type VoiceConstellationExit = 'history' | 'fallback' | 'noop'

/** Reset after the route has actually closed, including a later Forward open. */
export function resetVoiceConstellationExit(): void {
  historyExitPending = false
}

/** Close to the trusted in-app entry, or stay in-app after a direct load. */
export function leaveVoiceConstellation(
  fallbackTab: ActiveTab,
): VoiceConstellationExit {
  if (parseHash(window.location.hash).type !== 'voice-constellation') {
    return 'noop'
  }

  const returnHash = historyState()[RETURN_HASH_KEY]
  if (typeof returnHash === 'string') {
    if (!historyExitPending) {
      historyExitPending = true
      window.history.back()
    }
    return 'history'
  }

  historyExitPending = false
  replaceHash({ type: 'tab', tab: fallbackTab })
  return 'fallback'
}
