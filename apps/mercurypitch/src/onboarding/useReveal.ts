// ============================================================
// useReveal: the reveal's controller (S7b beat 5)
// ============================================================
//
// The card arrives with the range just measured: Merc watches it come, then
// is proud of it (S7b §3.1, "Watches, then proud"). His pride is the twin's
// beat: as the print finishes drawing in (TWIN_MS) the twin enters as its
// own card, and Merc's cheer and a light haptic land with it. A twin hidden
// behind a button and a blank figure read as a step to get through, and a
// twin on the card from the first frame as a footnote (owner, November
// 2026): it comes once there is a voice to compare it with, and needs no
// tap. Under reduced motion it is there at once, with Merc's cheer.
//
// A range that names no twin has no twin card (singerForRange): Merc is
// proud of the voice alone. Share sends what the cards show, the twin
// brought in first if it was still to come (reveal-share.ts).
//
// The twin's portrait is fetched as the range locks (`preloadTwin`, from
// the layer), so it is drawn the moment its card comes in.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup, untrack } from 'solid-js'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import { createRoomLife } from '@/components/room-kit/room-life'
import type { LegendTier } from '@/features/mirror/LegendCaricature'
import { legendTierSrc } from '@/features/mirror/LegendCaricature'
import { haptics } from '@/lib/haptics'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { RangeResult } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import { ONBOARDING_COPY } from './onboarding-copy'
import type { ShareResult, ShareWays } from './reveal-share'
import { shareReveal } from './reveal-share'
import { LANDED_MS } from './useFirstNote'

/**
 * Merc watches the card arrive for this long, then is proud of it, ms: as
 * the print has drawn in (NativeOnboarding.module.css .ridge), the twin's
 * beat.
 */
export const TWIN_MS = 900
/** The same moment, by its older name: Merc's pride. */
export const PROUD_MS = TWIN_MS

/**
 * The twin's portrait for its 96 to 112 px face: the 360 px file, which a
 * phone's 2x and 3x screens draw without an upscale (MISTAKES.md, a legend
 * portrait in a small box).
 */
export const TWIN_TIER: LegendTier = 'mid'

export interface RevealController {
  /** The twin's card has come in. */
  readonly twinShown: Accessor<boolean>
  /** What the last Share left to say, or null. */
  readonly shareNote: Accessor<string | null>
  readonly mercState: Accessor<MercState>
  readonly mercVoice: () => MercVoice
  readonly still: () => boolean
  /** The card is up. */
  readonly arrive: () => void
  /** Share this range: the share sheet, with the twin the cards show. */
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

/**
 * The twin's portrait for `range`, fetched ahead (as the range locks), so
 * its card draws it the moment it comes in. Nothing for a range with no
 * twin, or a twin with no portrait.
 */
export function preloadTwin(range: RangeResult): void {
  const twin = singerForRange(range)
  if (twin === null || typeof Image === 'undefined') return
  const src = legendTierSrc(twin, TWIN_TIER)
  if (src === undefined) return
  const image = new Image()
  image.decoding = 'async'
  image.src = src
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

  const [twinShown, setTwinShown] = createSignal(false)
  const [shareNote, setShareNote] = createSignal<string | null>(null)
  let sharing = false

  /** The twin's beat: its card in, Merc proud, a light tap in the hand. */
  const twinBeat = (): void => {
    if (untrack(twinShown)) return
    setTwinShown(true)
    merc.cheer()
    haptics.tapLight()
  }

  onCleanup(() => life.dispose())

  return {
    twinShown,
    shareNote,
    mercState: merc.state,
    mercVoice: () => SILENT_VOICE,
    still,
    arrive: () => {
      if (untrack(still)) {
        twinBeat()
        return
      }
      merc.set('listen')
      life.later(TWIN_MS, twinBeat)
    },
    share: (range) => {
      if (sharing) return
      const twin = singerForRange(range)
      // What the share sheet names is on the card before it opens.
      if (twin !== null) twinBeat()
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
