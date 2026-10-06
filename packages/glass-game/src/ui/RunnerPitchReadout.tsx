// Runner pitch readout — fixed-width voice and direction text for the active note marker.
import { createMemo, Show } from 'solid-js'
import type { RunnerTargetSnapshot } from '../runner/contracts'
import { runnerPitchReadout } from './runner-pitch-readout'
import styles from './RunnerPitchReadout.module.css'

interface RunnerPitchReadoutProps {
  target: Pick<RunnerTargetSnapshot, 'currentTargetMidi' | 'pitchFeedback'>
}

export function RunnerPitchReadout(props: RunnerPitchReadoutProps) {
  const readout = createMemo(() => runnerPitchReadout(props.target))
  return (
    <div
      class={styles.readout}
      data-pitch-state={readout().state}
      data-score-eligible="true"
      aria-label="Your voice and target"
      aria-live="off"
    >
      <div class={styles.pitch}>
        <span>You</span>
        <Show
          when={readout().observedLabel}
          fallback={<strong class={styles.noNote}>Waiting</strong>}
        >
          {(label) => <strong data-pitch-observed>{label()}</strong>}
        </Show>
      </div>
      <div class={styles.coach}>
        <span class={styles.cue}>
          <Show when={readout().correction}>
            {(correction) => (
              <svg
                viewBox="0 0 12 12"
                aria-hidden="true"
                classList={{ [styles.down]: correction() === 'lower' }}
              >
                <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" />
              </svg>
            )}
          </Show>
          {readout().cue}
        </span>
      </div>
      <div class={styles.targetText}>
        <span>Target</span>
        <strong data-pitch-target>{readout().targetLabel}</strong>
      </div>
    </div>
  )
}
