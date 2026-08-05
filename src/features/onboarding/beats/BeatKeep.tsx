// ============================================================
// Beat 7 — Keep
// ============================================================
//
// The one ask, at the moment of most earned value: the twin is still
// on screen and it belongs to them. So the offer is that specific
// thing rather than a generic "save your progress" —
//
//   "Freddie Mercury is your twin. Keep him."
//
// What makes it honest rather than a wall: the voiceprint is ALREADY
// saved locally by the time this renders. Declining costs nothing that
// second. What an account adds is that it survives the browser, the
// device and the cache clear, and that it accumulates into a timeline.
//
// "Not now" is the same size as the primary and does not flinch.

import type { Component, JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { IconFire } from '@/components/exercise-icons'
import { Sparkles, Split, Trophy, Voice } from '@/components/icons'
import { LegendCaricature } from '@/features/mirror/LegendCaricature'
import styles from '../onboarding.module.css'

interface KeepPerk {
  icon: () => JSX.Element
  title: string
  body: string
}

/**
 * Five, not four: the old fourth bullet carried separation, credits and
 * supporter perks at once. Separation is the one worth its own line — it
 * is the only item here that is a different KIND of product, and since
 * the server split went to demucs-6s it also returns the backing track as
 * drums, bass, guitar and piano rather than one instrumental. Naming that
 * is the difference between "cloud separation" (a mechanism nobody asked
 * for) and a thing somebody would want.
 */
const KEEP_PERKS: KeepPerk[] = [
  {
    icon: () => <Voice />,
    title: 'Your voice, on any device',
    body: 'Practice history, voiceprints and range follow you.',
  },
  {
    icon: () => <IconFire size={18} />,
    title: 'Progress that sticks',
    body: 'Badges, challenges and your streak survive a cleared browser.',
  },
  {
    icon: () => <Trophy />,
    title: 'Leaderboard and weekly Legend',
    body: 'You cannot place without an account.',
  },
  {
    icon: () => <Split />,
    title: 'Studio-quality song separation',
    body: 'Run on our servers instead of your browser: a cleaner vocal, and the backing track split into drums, bass, guitar and piano.',
  },
  {
    icon: () => <Sparkles />,
    title: 'Credits and supporter perks',
    body: 'Separation credits, and the extras supporters get.',
  },
]

export interface BeatKeepProps {
  /** The legend matched at beat 5, or null when none was. */
  twin: string | null
  onCreateAccount: () => void
  onDismiss: () => void
}

export const BeatKeep: Component<BeatKeepProps> = (props) => (
  <div class={styles.beat} data-beat="keep">
    <Show when={props.twin !== null}>
      {/* `mid`, not the master: this box is 130-180px, and the 928px
          portrait into it is a 7.1x downscale — past the point the browser
          keeps the high-quality path at 125%/200% zoom, so the face went to
          mush on the one screen where somebody is deciding whether to keep
          it. The thumb would upscale. See LegendTier. */}
      <span class={styles.twinArtSmall} aria-hidden="true">
        <LegendCaricature legend={props.twin ?? ''} tier="mid" />
      </span>
    </Show>

    <p class={styles.eyebrow}>Keep it</p>
    <Show
      when={props.twin !== null}
      fallback={<h1 class={styles.headline}>Keep your voiceprint</h1>}
    >
      <h1 class={styles.headline}>
        <span class={styles.lit}>{props.twin}</span> is your twin
      </h1>
    </Show>

    <p class={styles.sub}>
      Your voiceprint lives in this browser right now. Clearing your history
      loses it.
    </p>

    {/* The things an account actually buys, ordered by what someone
        holding a fresh voiceprint would care about — see the account
        value map in the owner's notes. Deliberately not led with "sync"
        or "cloud": those name the mechanism, not the loss.

        Each one is a label plus a line that says what it means, because
        the old single-line bullets had to compress a whole feature into
        six words and the separation one ended up as "Cloud karaoke
        separation, credits and supporter perks" — three unrelated things,
        every one of them named by mechanism. Owner testing called it
        confusing, which it was. */}
    <ul class={styles.keepList}>
      <For each={KEEP_PERKS}>
        {(perk) => (
          <li class={styles.keepPerk}>
            <span class={styles.keepPerkIcon} aria-hidden="true">
              {perk.icon()}
            </span>
            <span class={styles.keepPerkText}>
              <strong class={styles.keepPerkTitle}>{perk.title}</strong>
              <span class={styles.keepPerkBody}>{perk.body}</span>
            </span>
          </li>
        )}
      </For>
    </ul>

    <div class={styles.actions}>
      <button
        type="button"
        class={styles.primary}
        onClick={() => props.onCreateAccount()}
      >
        Keep my voiceprint
      </button>
      <button
        type="button"
        class={styles.secondary}
        onClick={() => props.onDismiss()}
      >
        Not now
      </button>
    </div>

    <p class={styles.keepFootnote}>
      Free, takes a moment, and nothing you have already earned is locked behind
      it — badges and progress keep working either way.
    </p>
  </div>
)

export default BeatKeep
