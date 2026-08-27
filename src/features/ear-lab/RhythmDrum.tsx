// ============================================================
// RhythmDrum — Pulse's instrument.
//
// Contour's drum, turned to time: one bar across the paper, four
// beat lamps along the top that step with the click. During the
// call the paper stays blank — an onset drawn as it sounds would
// hand the eye what the ear is meant to hold — and the reveal
// writes both bars at once: the call's onsets as brass ticks on the
// upper rule, the player's taps under them on the lower, signal
// where an onset was met, garnet where it was missed, muted for a
// tap that served no onset.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './EarInstruments.module.css'

export type DrumBar = 'count' | 'call' | 'response' | null

export interface DrumReveal {
  /** The call's onsets, in beats of the bar. */
  onsets: readonly number[]
  met: readonly boolean[]
  /** The player's taps that met an onset, in beats. */
  taps: readonly number[]
  /** Taps that served no onset, in beats. */
  extras: readonly number[]
  correct: boolean
}

interface RhythmDrumProps {
  bar: DrumBar
  /** 1-based beat of the bar sounding now; 0 for none. */
  beat: number
  reveal: DrumReveal | null
}

const BEATS = 4
const BAR_LEFT = 100
const BAR_RIGHT = 420
const CALL_Y = 100
const RESPONSE_Y = 160
const RULES = [70, 100, 130, 160, 190]

function beatX(beat: number): number {
  return BAR_LEFT + (beat / BEATS) * (BAR_RIGHT - BAR_LEFT)
}

const BAR_WORD: Record<Exclude<DrumBar, null>, string> = {
  count: 'Count-in',
  call: 'The call',
  response: 'Yours',
}

export function RhythmDrum(props: RhythmDrumProps): JSX.Element {
  const label = () => {
    if (props.reveal) {
      const missed = props.reveal.met.filter((m) => !m).length
      return props.reveal.correct
        ? `Rhythm drum: every onset of the call met`
        : `Rhythm drum: ${missed} onset${missed === 1 ? '' : 's'} missed, ${props.reveal.extras.length} extra tap${props.reveal.extras.length === 1 ? '' : 's'}`
    }
    return props.bar
      ? `Rhythm drum, ${BAR_WORD[props.bar].toLowerCase()}, beat ${props.beat}`
      : 'Rhythm drum, one bar of four beats, nothing written yet'
  }

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 260"
      role="img"
      aria-label={label()}
      data-instrument="drum"
    >
      <rect
        x="70"
        y="50"
        width="380"
        height="160"
        rx="18"
        class={styles.drum}
        data-part="drum"
      />
      <For each={RULES}>
        {(y) => <line x1="80" y1={y} x2="440" y2={y} class={styles.drumRule} />}
      </For>
      {/* beat divisions */}
      <For each={[0, 1, 2, 3, 4]}>
        {(beat) => (
          <line
            x1={beatX(beat)}
            y1="62"
            x2={beatX(beat)}
            y2="198"
            class={styles.drumRule}
            stroke-dasharray="2 5"
          />
        )}
      </For>
      {/* the beat lamps */}
      <For each={[1, 2, 3, 4]}>
        {(beat) => (
          <circle
            cx={beatX(beat - 1) + 4}
            cy="40"
            r="4"
            class={styles.beatLamp}
            classList={{
              [styles.beatLampLit]: props.bar !== null && props.beat === beat,
            }}
            data-part="beat-lamp"
            data-lit={props.bar !== null && props.beat === beat}
          />
        )}
      </For>

      <Show when={props.reveal}>
        {(reveal) => (
          <>
            <For each={reveal().onsets}>
              {(onset, i) => (
                <line
                  x1={beatX(onset)}
                  y1={CALL_Y - 14}
                  x2={beatX(onset)}
                  y2={CALL_Y + 14}
                  class={styles.onset}
                  classList={{ [styles.onsetMissed]: !reveal().met[i()] }}
                  data-part="onset"
                  data-met={reveal().met[i()]}
                />
              )}
            </For>
            <For each={reveal().taps}>
              {(tap) => (
                <line
                  x1={beatX(tap)}
                  y1={RESPONSE_Y - 14}
                  x2={beatX(tap)}
                  y2={RESPONSE_Y + 14}
                  class={styles.tapMark}
                  data-part="tap"
                />
              )}
            </For>
            <For each={reveal().extras}>
              {(tap) => (
                <line
                  x1={beatX(tap)}
                  y1={RESPONSE_Y - 10}
                  x2={beatX(tap)}
                  y2={RESPONSE_Y + 10}
                  class={`${styles.tapMark} ${styles.tapMarkExtra}`}
                  data-part="extra"
                />
              )}
            </For>
            <text x="84" y={CALL_Y - 20} class={styles.caption}>
              call
            </text>
            <text x="84" y={RESPONSE_Y + 30} class={styles.caption}>
              yours
            </text>
            <text
              x="260"
              y="244"
              class={`${styles.nameplate} ${styles.nameplateSignal}`}
              text-anchor="middle"
            >
              {reveal().correct ? 'Clean' : 'Not quite'}
            </text>
          </>
        )}
      </Show>
      <Show when={!props.reveal && props.bar}>
        {(bar) => (
          <text x="260" y="244" class={styles.nameplate} text-anchor="middle">
            {BAR_WORD[bar()]}
          </text>
        )}
      </Show>
    </svg>
  )
}
