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

import type { Component, JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { DeviceSync, Trophy, WaveformBars } from '@/components/icons'
import type { FeaturedPromo } from '@/db/services/billing-service'
import { LegendCaricature } from '@/features/mirror/LegendCaricature'
import type { MirrorResult } from '@/lib/mirror/metrics'
import keep from '../keep.module.css'
import styles from '../onboarding.module.css'
import { KeepGiftCard } from './KeepGiftCard'
import { KeepRange } from './KeepRange'

interface KeepRow {
  icon: () => JSX.Element
  tone: 'cyan' | 'blue' | 'violet'
  text: string
}

/** What an account keeps, in the singer's words rather than the mechanism's
 *  ("sync", "cloud"). The leaderboard row stands in for the gift when there
 *  is none: it is the one thing here nobody can have without an account. */
const ROWS: KeepRow[] = [
  {
    icon: () => <WaveformBars />,
    tone: 'cyan',
    text: 'Your voiceprint and range, saved',
  },
  {
    icon: () => <DeviceSync />,
    tone: 'blue',
    text: 'Your progress on every device',
  },
]

const LEADERBOARD_ROW: KeepRow = {
  icon: () => <Trophy />,
  tone: 'violet',
  text: 'Your place on the leaderboard',
}

export interface BeatKeepProps {
  /** The legend matched at beat 5, or null when none was. */
  twin: string | null
  /** The voiceprint just measured: its range is the card at the top. */
  voiceprint: MirrorResult | null
  /** The launch gift on offer, or null when there is none. */
  gift: FeaturedPromo | null
  onCreateAccount: () => void
}

export const BeatKeep: Component<BeatKeepProps> = (props) => {
  const rows = () => (props.gift === null ? [...ROWS, LEADERBOARD_ROW] : ROWS)

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
              <Show when={props.voiceprint?.range}>
                {(range) => <KeepRange range={range()} />}
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
                  <span
                    class={keep.keepRowIcon}
                    data-tone={row.tone}
                    aria-hidden="true"
                  >
                    {row.icon()}
                  </span>
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
          <p class={keep.keepCaption}>
            Credits arrive when your email is confirmed.
          </p>
        </Show>
      </div>
    </div>
  )
}

export default BeatKeep
