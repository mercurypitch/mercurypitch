// ============================================================
// useReveal: the reveal's controller (S7b beat 5)
// ============================================================
//
// The card arrives with the range just measured: Merc watches it come, then
// is proud of it (S7b §3.1, "Watches, then proud"). The twin is on the card
// from the start, face and name: a twin hidden behind a button and a blank
// figure read as a step to get through, not a reveal (owner, November 2026).
// A range that names no twin has no twin row (singerForRange). Share sends
// what the card shows (reveal-share.ts).

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup, untrack } from 'solid-js'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import { createRoomLife } from '@/components/room-kit/room-life'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { RangeResult } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import { ONBOARDING_COPY } from './onboarding-copy'
import type { ShareResult, ShareWays } from './reveal-share'
import { shareReveal } from './reveal-share'
import { LANDED_MS } from './useFirstNote'

/** Merc watches the card arrive for this long, then is proud of it, ms. */
export const PROUD_MS = 900

export interface RevealController {
  /** What the last Share left to say, or null. */
  readonly shareNote: Accessor<string | null>
  readonly mercState: Accessor<MercState>
  readonly mercVoice: () => MercVoice
  readonly still: () => boolean
  /** The card is up. */
  readonly arrive: () => void
  /** Share this range: the share sheet, with the twin the card shows. */
  readonly share: (range: RangeResult) => void
}

export interface RevealOptions {
  /** Reduced motion; defaults to the phone's own setting. */
  readonly still?: () => boolean
  /** Defaults to the device's share sheet and clipboard. */
  readonly ways?: ShareWays
}

/** What the screen says after a share: nothing once the sheet was shown. */
function noteFor(result: ShareResult): string | null {
  switch (result) {
    case 'shared':
      return null
    case 'copied':
      return ONBOARDING_COPY.linkCopied
    case 'failed':
      return ONBOARDING_COPY.shareFailed
  }
}

export function useReveal(options: RevealOptions = {}): RevealController {
  const life = createRoomLife()
  const still = options.still ?? prefersReducedMotion
  const merc = createMercMoves({
    later: life.later,
    still,
    afterCheer: () => 'idle',
  })
  life.later(LANDED_MS, () => {
    if (untrack(merc.state) === 'drop') merc.set('idle')
  })

  const [shareNote, setShareNote] = createSignal<string | null>(null)
  let sharing = false

  onCleanup(() => life.dispose())

  return {
    shareNote,
    mercState: merc.state,
    mercVoice: () => SILENT_VOICE,
    still,
    arrive: () => {
      merc.set('listen')
      life.later(PROUD_MS, () => merc.cheer())
    },
    share: (range) => {
      if (sharing) return
      const twin = singerForRange(range)
      sharing = true
      setShareNote(null)
      void shareReveal(range, twin, options.ways)
        .catch((): ShareResult => 'failed')
        .then((result) => {
          sharing = false
          if (life.alive()) setShareNote(noteFor(result))
        })
    },
  }
}
