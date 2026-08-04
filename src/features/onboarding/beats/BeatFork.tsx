// ============================================================
// Beat 3 — Fork
// ============================================================
//
// Self-selected depth. Both roads reach the Map, so neither choice
// is a trap: "Take me in" is a real option presented at the same
// weight, not a greyed-out apology.
//
// The opener is what beat 2 actually heard ("That's a G3. Want the
// whole map?").
//
// Someone who has ALREADY mapped their voice gets a different fork.
// Offering "map my whole voice" to a singer with four voiceprints on
// file reads as an app that has not been paying attention, and it was
// the lead card — so the obvious click asked them to redo ninety
// seconds of work they had already done. They are shown what they have
// instead, with a fresh take one deliberate click away.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import type { OnboardingTrack } from '../flow'
import styles from '../onboarding.module.css'

export interface BeatForkProps {
  /** The note heard at beat 2, e.g. 'G3'. Null if the mic was skipped. */
  firstNote: string | null
  /** Voiceprints already on file for this visitor. */
  savedCount: number
  /** When the newest one was taken, already formatted. Null if none. */
  savedWhen: string | null
  onChoose: (track: OnboardingTrack) => void
  /** Leave the flow for the Voice Mirror and take a fresh voiceprint. */
  onAnother: () => void
}

export const BeatFork: Component<BeatForkProps> = (props) => (
  <div class={styles.beat} data-beat="fork">
    <Show
      when={props.savedCount > 0}
      fallback={
        <>
          <p class={styles.eyebrow}>Two ways in</p>
          <h1 class={styles.headline}>Want the whole map?</h1>
          <p class={styles.sub}>
            <Show when={props.firstNote !== null}>
              You sang a {props.firstNote}.{' '}
            </Show>
            A minute and a half of singing tells us the rest — your range, how
            steady you hold a note, and how close your ear lands. Or skip it;
            you can do this any time.
          </p>
        </>
      }
    >
      <p class={styles.eyebrow}>Welcome back</p>
      <h1 class={styles.headline}>You've already mapped your voice</h1>
      <p class={styles.sub}>
        <Show when={props.firstNote !== null}>
          You sang a {props.firstNote}.{' '}
        </Show>
        <Show
          when={props.savedCount === 1}
          fallback={`You have ${props.savedCount} voiceprints on file`}
        >
          Your voiceprint is on file
        </Show>
        <Show when={props.savedWhen !== null}>
          , the newest from {props.savedWhen}
        </Show>
        . Look at {props.savedCount === 1 ? 'it' : 'them'}, take a fresh one, or
        go straight in.
      </p>
    </Show>

    <div class={styles.forkOptions}>
      <Show
        when={props.savedCount > 0}
        fallback={
          <button
            type="button"
            class={`${styles.forkCard} ${styles.forkLead}`}
            onClick={() => props.onChoose('full')}
          >
            <span class={styles.forkTime}>About 90 seconds</span>
            <span class={styles.forkTitle}>Map my whole voice</span>
            <span class={styles.forkBody}>
              Three short exercises. You get your range, your steadiness, and
              the legendary singer your voice overlaps with.
            </span>
          </button>
        }
      >
        <button
          type="button"
          class={`${styles.forkCard} ${styles.forkLead}`}
          onClick={() => props.onChoose('gallery')}
        >
          <span class={styles.forkTime}>Straight away</span>
          <span class={styles.forkTitle}>
            {props.savedCount === 1
              ? 'See my voiceprint'
              : 'See my voiceprints'}
          </span>
          <span class={styles.forkBody}>
            Your {props.savedCount === 1 ? 'take' : 'takes'} at full size —
            twin, range and steadiness — then on to your map.
          </span>
        </button>

        <button
          type="button"
          class={styles.forkCard}
          onClick={() => props.onAnother()}
        >
          <span class={styles.forkTime}>About 90 seconds</span>
          <span class={styles.forkTitle}>Make another voiceprint</span>
          <span class={styles.forkBody}>
            A voice moves. Take a fresh one in the Voice Mirror and watch the
            two of them side by side.
          </span>
        </button>
      </Show>

      <button
        type="button"
        class={styles.forkCard}
        onClick={() => props.onChoose('short')}
      >
        <span class={styles.forkTime}>Straight away</span>
        <span class={styles.forkTitle}>Take me in</span>
        <span class={styles.forkBody}>
          Go to the app now. The full voice map stays on your home screen
          whenever you want it.
        </span>
      </button>
    </div>
  </div>
)

export default BeatFork
