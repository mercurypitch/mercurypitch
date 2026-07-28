// ============================================================
// Beat 3 — Fork
// ============================================================
//
// Self-selected depth. Both roads reach the Map, so neither choice
// is a trap: "Take me in" is a real option presented at the same
// weight, not a greyed-out apology.
//
// Phase 2 replaces the generic opener with what beat 2 actually
// heard ("That's a G3. Want the whole map?").

import type { Component } from 'solid-js'
import type { OnboardingTrack } from '../flow'
import styles from '../onboarding.module.css'

export interface BeatForkProps {
  onChoose: (track: OnboardingTrack) => void
}

export const BeatFork: Component<BeatForkProps> = (props) => (
  <div class={styles.beat} data-beat="fork">
    <p class={styles.eyebrow}>Two ways in</p>
    <h1 class={styles.headline}>Want the whole map?</h1>
    <p class={styles.sub}>
      A minute and a half of singing tells us your range, how steady you hold a
      note, and how close your ear lands. Or skip it — you can do this any time.
    </p>

    <div class={styles.forkOptions}>
      <button
        type="button"
        class={`${styles.forkCard} ${styles.forkLead}`}
        onClick={() => props.onChoose('full')}
      >
        <span class={styles.forkTime}>About 90 seconds</span>
        <span class={styles.forkTitle}>Map my whole voice</span>
        <span class={styles.forkBody}>
          Three short exercises. You get your range, your steadiness, and the
          legendary singer your voice overlaps with.
        </span>
      </button>

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
