// ============================================================
// TuningFork — Home's instrument.
//
// A tuning fork on its resonance box. The cadence lights the four
// lamps on the box front as its chords land (I · IV · V · I), the
// probe sets the fork ringing, and in sing mode a dashed ring says
// the microphone is listening. The reveal engraves the degree on
// the box — the ladder of answers is the console below.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './EarInstruments.module.css'

interface TuningForkProps {
  /** Cadence chords landed so far, 0–4. */
  cadenceStep: number
  /** The probe is sounding. */
  ringing: boolean
  /** The microphone window is open. */
  listening: boolean
  /** The degree, once told; `correct` is null for a skipped round. */
  reveal: { degree: number; solfege: string; correct: boolean | null } | null
}

const CADENCE = ['I', 'IV', 'V', 'I']

export function TuningFork(props: TuningForkProps): JSX.Element {
  const label = () => {
    if (props.reveal) {
      return `Tuning fork on its box, engraved ${props.reveal.solfege}, degree ${props.reveal.degree}`
    }
    if (props.ringing) return 'Tuning fork ringing with the probe note'
    if (props.listening)
      return 'Tuning fork on its box; the microphone is listening'
    return `Tuning fork on its box; ${props.cadenceStep} of 4 cadence chords have landed`
  }

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 360 260"
      role="img"
      aria-label={label()}
      data-instrument="fork"
    >
      {/* the resonance box */}
      <rect x="60" y="168" width="240" height="62" rx="6" class={styles.box} />
      <line x1="72" y1="180" x2="288" y2="180" class={styles.boxGrain} />
      <line x1="72" y1="218" x2="288" y2="218" class={styles.boxGrain} />
      <For each={CADENCE}>
        {(chord, i) => (
          <>
            <rect
              x={90 + i() * 50}
              y="192"
              width="30"
              height="14"
              rx="2"
              class={styles.lamp}
              classList={{ [styles.lampLit]: props.cadenceStep > i() }}
            />
            <text
              x={105 + i() * 50}
              y="246"
              class={styles.caption}
              text-anchor="middle"
            >
              {chord}
            </text>
          </>
        )}
      </For>

      {/* the fork */}
      <line x1="180" y1="168" x2="180" y2="122" class={styles.forkStem} />
      <path d="M158 30v72a22 22 0 0 0 44 0V30" class={styles.fork} />

      {/* the ring: the probe sounding, or the mic listening */}
      <g class={styles.ringGroup}>
        <path
          d="M132 40a56 56 0 0 0 0 80"
          class={styles.ring}
          classList={{
            [styles.ringOn]: props.ringing,
            [styles.ringListen]: !props.ringing && props.listening,
          }}
        />
        <path
          d="M228 40a56 56 0 0 1 0 80"
          class={styles.ring}
          classList={{
            [styles.ringOn]: props.ringing,
            [styles.ringListen]: !props.ringing && props.listening,
          }}
        />
      </g>

      {/* the engraving */}
      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x="180"
            y="18"
            class={styles.nameplate}
            classList={{
              [styles.nameplateSignal]: reveal().correct === true,
              [styles.nameplateGarnet]: reveal().correct === false,
            }}
            text-anchor="middle"
            dominant-baseline="hanging"
          >
            {reveal().degree} · {reveal().solfege}
          </text>
        )}
      </Show>
    </svg>
  )
}
