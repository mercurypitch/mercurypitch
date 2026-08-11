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
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarInputHealthReading } from '@/lib/guitar/input-events'
import styles from './GuitarNightApp.module.css'
import type { GuitarTimingSource } from './useGuitarListeningController'

interface GuitarNightInputHealthProps {
  profile: Accessor<GuitarInputProfileKind>
  listening: Accessor<boolean>
  calibrating: Accessor<boolean>
  health: Accessor<GuitarInputHealthReading | null>
  timingSource: Accessor<GuitarTimingSource>
  /** Measured round trip in ms. Zero means nobody has measured this input. */
  latencyMs: Accessor<number>
  /** A scheduled take owns its route until its exact boundary completes. */
  locked?: Accessor<boolean>
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
            role={reading().state === 'clipping' ? 'alert' : 'status'}
            aria-live={reading().state === 'clipping' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            <span class={styles.inputHealthDot} aria-hidden="true" />
            {reading().hint}
          </p>
        )}
      </Show>

      <p class={styles.inputHealthTiming}>
        {props.timingSource() === 'audio-clock'
          ? 'Attacks use the audio clock for precise spacing.'
          : props.timingSource() === 'midi-clock'
            ? 'Notes use the MIDI event clock; this is not an audio sample timestamp.'
            : 'Attacks are timed on the display loop here, so spacing is approximate.'}
      </p>

      <div class={styles.inputHealthLatency}>
        <small>
          {props.profile() === 'midi'
            ? 'MIDI route delay is not measured, so absolute early or late feedback stays unavailable.'
            : props.latencyMs() > 0
              ? `Measured on this input: ${props.latencyMs()} ms, and taken off every strike.`
              : 'Nothing has measured this input, so strike times are uncorrected.'}
        </small>
        <Show when={props.profile() === 'microphone'}>
          <button
            type="button"
            disabled={
              !props.listening() ||
              props.calibrating() ||
              (props.locked?.() ?? false) ||
              props.timingSource() !== 'audio-clock'
            }
            onClick={() => props.onCalibrate()}
          >
            {props.calibrating() ? 'Listening for clicks' : 'Calibrate timing'}
          </button>
        </Show>
      </div>
      <Show
        when={
          props.profile() === 'microphone' &&
          props.timingSource() === 'audio-clock'
        }
      >
        <small class={styles.inputHealthNote}>
          Calibration plays eight clicks out loud and times how long they take
          to come back, so it needs speakers rather than headphones.
        </small>
      </Show>
      <Show when={props.profile() === 'interface'}>
        <small class={styles.inputHealthNote}>
          Direct-input calibration needs a physical output-to-input loopback, so
          the room does not play speaker clicks for this route.
        </small>
      </Show>
    </div>
  )
}
