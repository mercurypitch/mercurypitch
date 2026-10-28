// ============================================================
// The tone stop: Play the note, and the note's line under it
// ============================================================
//
// What a "hold-tone" step shows (hold-tone.ts): the button, and under it, in
// a live region of its own, the line that says the note is playing and then
// how to hear it. Under, not over: a line that came above the button pushed
// it down as it came, and on a small phone, where the bubble's words scroll,
// out of sight of the finger that had just tapped it. Here the button stays
// where it was tapped as the line comes and goes.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import styles from './CoachLayer.module.css'
import type { HoldTone } from './hold-tone'
import { HOLD_TONE_NAME, HOLD_TONE_SEC, TONE_HEAR_LINE, TONE_PLAYING_LINE, } from './hold-tone'

/**
 * Play the note, and under it the note playing, or how to hear it once it
 * has played.
 */
export function ToneStop(props: { tone: HoldTone }): JSX.Element {
  const line = (): string | null => {
    if (props.tone.playing() !== null) return TONE_PLAYING_LINE
    return props.tone.played() ? TONE_HEAR_LINE : null
  }
  return (
    <div class={styles.tone}>
      <ToneButton tone={props.tone} />
      <div class={styles.toneLive} aria-live="polite">
        <Show when={line()}>
          {(text) => (
            <p
              class={`${styles.aside} ${styles.toneLine}`}
              data-testid="coach-tone-line"
            >
              {text()}
            </p>
          )}
        </Show>
      </div>
    </div>
  )
}

/**
 * "Play the note": while the note plays it names it and is lit, and a mark
 * runs across it for the note's length (none under reduced motion). Both
 * labels stay in it, one hidden, so it keeps one width.
 */
function ToneButton(props: { tone: HoldTone }): JSX.Element {
  const playing = (): boolean => props.tone.playing() !== null
  return (
    <button
      type="button"
      class={styles.play}
      data-playing={playing() ? '' : undefined}
      onClick={() => props.tone.play()}
    >
      <span class={styles.playLabel} aria-hidden={playing()}>
        Play the note
      </span>
      <span class={styles.playLabel} aria-hidden={!playing()}>
        Playing {HOLD_TONE_NAME}
      </span>
      <Show when={props.tone.playing()} keyed>
        <span
          class={styles.playMark}
          data-testid="coach-tone-mark"
          aria-hidden="true"
          style={{ 'animation-duration': `${HOLD_TONE_SEC * 1000}ms` }}
        />
      </Show>
    </button>
  )
}
