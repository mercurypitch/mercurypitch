// What the room can and cannot honestly say about the input it is hearing.
// ============================================================
//
// Three separate claims, kept separate because they can each be wrong on their
// own: whether the signal is usable at all, how precisely attacks are being
// timed, and how much of the route's delay has actually been measured. A player
// deciding whether to trust a timing readout needs all three, and none of them
// is a number they should have to interpret.

import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import type { GuitarInputHealthReading } from '@/lib/guitar/input-events'
import styles from './GuitarNightApp.module.css'
import type { GuitarTimingSource } from './useGuitarListeningController'

interface GuitarNightInputHealthProps {
  listening: Accessor<boolean>
  calibrating: Accessor<boolean>
  health: Accessor<GuitarInputHealthReading | null>
  timingSource: Accessor<GuitarTimingSource>
  /** Measured round trip in ms. Zero means nobody has measured this input. */
  latencyMs: Accessor<number>
  onCalibrate(): void
}

export function GuitarNightInputHealth(props: GuitarNightInputHealthProps) {
  return (
    <div class={styles.inputHealth}>
      <Show
        when={props.health()}
        fallback={
          <p class={styles.inputHealthHint}>
            Turn on Listening to check what this input is picking up.
          </p>
        }
      >
        {(reading) => (
          <p
            class={styles.inputHealthHint}
            data-state={reading().state}
            role={reading().state === 'clipping' ? 'alert' : undefined}
          >
            <span class={styles.inputHealthDot} aria-hidden="true" />
            {reading().hint}
          </p>
        )}
      </Show>

      <p class={styles.inputHealthTiming}>
        {props.timingSource() === 'audio-clock'
          ? 'Attacks are timed on the audio clock, so spacing is exact.'
          : 'Attacks are timed on the display loop here, so spacing is approximate.'}
      </p>

      <div class={styles.inputHealthLatency}>
        <small>
          {props.latencyMs() > 0
            ? `Measured on this input: ${props.latencyMs()} ms, and taken off every strike.`
            : 'Nothing has measured this input, so strike times are uncorrected.'}
        </small>
        <button
          type="button"
          disabled={
            !props.listening() ||
            props.calibrating() ||
            props.timingSource() !== 'audio-clock'
          }
          onClick={() => props.onCalibrate()}
        >
          {props.calibrating() ? 'Listening for clicks' : 'Calibrate timing'}
        </button>
      </div>
      <Show when={props.timingSource() === 'audio-clock'}>
        <small class={styles.inputHealthNote}>
          Calibration plays eight clicks out loud and times how long they take
          to come back, so it needs speakers rather than headphones.
        </small>
      </Show>
    </div>
  )
}
