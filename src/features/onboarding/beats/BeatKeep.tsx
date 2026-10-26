// ============================================================
// Beat 7 — Keep
// ============================================================
//
// The one ask, at the moment of most earned value: the voiceprint is still
// on screen and it belongs to them. So the offer is that specific thing
// rather than a generic "save your progress":
//
//   "Freddie Mercury is your twin."
//
// What makes it honest rather than a wall: the voiceprint is ALREADY saved
// in this browser by the time this renders. Declining costs nothing that
// second. What an account adds is that it survives the browser, the device
// and the cache clear.
//
// One button (launch offer plan, section 4; owner decision D5). Declining is
// "Not now" at the top right of the frame, in FirstLight's rail: one
// dominant action with the decline elsewhere, never two buttons side by
// side. While the server features a promo code the launch gift sits beside
// the ask, as the right-hand column on a desktop and under the rows on a
// phone; without one, a third row and a plain fact take its place.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { FeaturedPromo } from '@/db/services/billing-service'
import { LegendCaricature } from '@/features/mirror/LegendCaricature'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { cleanRange } from '@/lib/mirror/singer-match'
import { KEEP_GIFT_CAPTION } from '../copy'
import keep from '../keep.module.css'
import styles from '../onboarding.module.css'
import type { KeepChipKind, KeepChipTone } from './KeepChips'
import { KeepChip } from './KeepChips'
import { KeepGiftCard } from './KeepGiftCard'
import { KeepRange } from './KeepRange'

interface KeepRow {
  /** The motion chip that leads the row (KeepChips.tsx). */
  chip: KeepChipKind
  tone: KeepChipTone
  text: string
}

/** What an account keeps, in the singer's words rather than the mechanism's
 *  ("sync", "cloud"). The leaderboard row stands in for the gift when there
 *  is none: it is the one thing here nobody can have without an account.
 *
 *  The first row is the weekly Check-up (docs/specs/weekly-check-up.ears.md):
 *  this browser keeps the latest twelve voiceprints (LOCAL_CAP), an account
 *  every one, on every device. It names no range, so it says nothing untrue
 *  after a read that was not clean. */
const ROWS: KeepRow[] = [
  {
    chip: 'voiceprint',
    tone: 'teal',
    text: 'Every weekly Check-up, kept',
  },
  {
    chip: 'devices',
    tone: 'blue',
    text: 'Your progress on every device',
  },
]

const LEADERBOARD_ROW: KeepRow = {
  chip: 'podium',
  tone: 'violet',
  text: 'Your place on the leaderboard',
}

export interface BeatKeepProps {
  /** The legend matched at beat 5, or null when none was. */
  twin: string | null
  /** The voiceprint just measured: its range is the card at the top, when
   *  the read was clean (singer-match.ts `isCleanRange`). */
  voiceprint: MirrorResult | null
  /** The singer's glides as one line (voice-strip.ts), drawn as the gold
   *  ridge in the rows' chips. Null draws the range's own rise and fall. */
  strip?: readonly number[] | null
  /** The launch gift on offer, or null when there is none. */
  gift: FeaturedPromo | null
  onCreateAccount: () => void
}

export const BeatKeep: Component<BeatKeepProps> = (props) => {
  const rows = () => (props.gift === null ? [...ROWS, LEADERBOARD_ROW] : ROWS)
  /** No card and no ridge for a read that is not clean: the twin beat has
   *  just said Merc could not read the range, and "A3 to A3" here would
   *  show one anyway. */
  const range = () => cleanRange(props.voiceprint?.range)

  return (
    <div
      class={`${styles.beat} ${keep.keepBeat}`}
      classList={{ [keep.keepWithGift]: props.gift !== null }}
      data-beat="keep"
      data-gift={props.gift === null ? 'none' : 'offered'}
    >
      <div class={keep.keepColumns}>
        <div class={keep.keepMain}>
          <Show
            when={props.twin}
            fallback={
              <Show when={range()}>
                {(measured) => <KeepRange range={measured()} />}
              </Show>
            }
          >
            {(twin) => (
              // `mid`, not the master: this box is 130-180px, and the 928px
              // portrait into it is a 7.1x downscale, past the point the
              // browser keeps the high-quality path at 125%/200% zoom. The
              // thumb would upscale. See LegendTier.
              <span class={styles.twinArtSmall} aria-hidden="true">
                <LegendCaricature legend={twin()} tier="mid" />
              </span>
            )}
          </Show>

          <p class={`${styles.eyebrow} ${keep.keepEyebrow}`}>Keep it</p>
          <Show
            when={props.twin}
            fallback={
              <h1 class={`${styles.headline} ${keep.keepHeadline}`}>
                Keep your voiceprint
              </h1>
            }
          >
            {(twin) => (
              <h1 class={`${styles.headline} ${keep.keepHeadline}`}>
                <span class={styles.lit}>{twin()}</span> is your twin
              </h1>
            )}
          </Show>

          {/* The phone keeps the first sentence: the second is what the
              rows below already say. */}
          <p class={keep.keepLine}>
            It lives in this browser for now.
            <span class={keep.wideOnly}>
              {' '}
              A free account keeps it on every device.
            </span>
          </p>

          <ul class={keep.keepRows}>
            <For each={rows()}>
              {(row) => (
                <li class={keep.keepRow}>
                  <KeepChip
                    kind={row.chip}
                    tone={row.tone}
                    strip={props.strip ?? null}
                    range={range()}
                  />
                  {row.text}
                </li>
              )}
            </For>
          </ul>
        </div>

        <Show when={props.gift}>
          {(gift) => <KeepGiftCard gift={gift()} />}
        </Show>
      </div>

      <Show when={props.gift === null}>
        <p class={keep.keepFact}>
          Without an account, it stays in this browser only.
        </p>
      </Show>

      <div class={keep.keepAction}>
        <button
          type="button"
          class={`${styles.primary} ${styles.primaryLarge} ${keep.keepButton}`}
          onClick={() => props.onCreateAccount()}
        >
          Create my free account
        </button>
        <Show when={props.gift !== null}>
          <p class={keep.keepCaption}>{KEEP_GIFT_CAPTION}</p>
        </Show>
      </div>
    </div>
  )
}

export default BeatKeep
