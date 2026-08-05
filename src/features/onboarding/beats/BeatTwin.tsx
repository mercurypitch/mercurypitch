// ============================================================
// Beat 5 — Twin
// ============================================================
//
// The payoff: your range, your steadiness, your ear, and the legend
// your voice overlaps with. This is the moment the flow has been
// earning, and it is also what Phase 3's account offer asks you to
// keep — so the numbers shown here are exactly the ones a voiceprint
// record will store.
//
// The twin is a playful overlap, never a verdict. When the range task
// produced nothing to match against, the beat says so rather than
// inventing a celebrity.

import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { LegendCaricature } from '@/features/mirror/LegendCaricature'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import styles from '../onboarding.module.css'

export interface BeatTwinProps {
  /** Share the freshly made voiceprint card (twin + numbers). */
  onShare?: () => void
  result: MirrorResult
  onContinue: () => void
}

export const BeatTwin: Component<BeatTwinProps> = (props) => {
  const twin = createMemo(() => singerForRange(props.result.range))
  const range = () => props.result.range
  const accuracy = () => props.result.accuracy
  const steadiness = () => props.result.steadiness

  return (
    <div class={styles.beat} data-beat="twin">
      <Show
        when={twin() !== null}
        fallback={
          <>
            <p class={styles.eyebrow}>Your voiceprint</p>
            <h1 class={styles.headline}>Here's what we heard</h1>
            <p class={styles.sub}>
              We couldn't get a clean read on your range this time, so there's
              no twin to show yet — the map below still works, and you can
              retake this whenever you like.
            </p>
          </>
        }
      >
        {/* 200-320px box: `mid` (360px) lands inside 4x either way, where
            the master was already at 4.6x on the small end. */}
        <span class={styles.twinArt} aria-hidden="true">
          <LegendCaricature legend={twin() ?? ''} tier="mid" />
        </span>
        <p class={styles.eyebrow}>Your twin</p>
        <h1 class={styles.headline}>
          Your range overlaps <span class={styles.lit}>{twin()}</span>
        </h1>
        <p class={styles.sub}>
          A playful overlap, not a verdict — it's about where your voice sits,
          not how it sounds.
        </p>
      </Show>

      <div class={styles.stats}>
        <Show when={range() !== null}>
          <div class={styles.stat}>
            <span class={styles.statValue}>
              {range()?.lowNote}–{range()?.highNote}
            </span>
            <span class={styles.statLabel}>
              your range · {range()?.semitones} semitones
            </span>
          </div>
        </Show>
        <Show when={steadiness() !== null}>
          <div class={styles.stat}>
            <span class={styles.statValue}>{steadiness()?.score}</span>
            <span class={styles.statLabel}>steadiness</span>
          </div>
        </Show>
        <Show when={accuracy() !== null}>
          <div class={styles.stat}>
            <span class={styles.statValue}>
              {Math.round(accuracy()?.score ?? 0)}
            </span>
            <span class={styles.statLabel}>pitch accuracy</span>
          </div>
        </Show>
      </div>

      <p class={styles.mapExplainer}>
        The map is your guided next step — rooms in the app picked for what your
        voice showed us, so you know exactly where to go from here.
      </p>
      <div class={styles.actions}>
        {/* Not "See my map": this advances to `keep`, and the Map is one
            screen further on. Promising the Map and then showing an
            account offer that repeats the portrait is what made the two
            screens read as one screen twice. `keep` is also skippable
            (isBeatApplicable: state.hasVoiceprint), so the label has to be
            true whether the next thing is the offer or the Map itself —
            the pull lives in the paragraph above, which sells the Map
            without the button having to lie about the order. */}
        <button
          type="button"
          class={styles.primary}
          onClick={() => props.onContinue()}
        >
          Continue
        </button>
        <Show when={props.onShare !== undefined}>
          <button
            type="button"
            class={styles.secondary}
            onClick={() => props.onShare?.()}
          >
            Share now
          </button>
        </Show>
      </div>
    </div>
  )
}

export default BeatTwin
