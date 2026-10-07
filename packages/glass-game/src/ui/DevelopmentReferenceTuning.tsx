// Development reference controls — tune the sustained note without altering melody or wave timing.
import { REFERENCE_NOTE_HOLD } from '../reference-note'
import styles from './DevelopmentRenderTuning.module.css'

export interface DevelopmentReferenceControls {
  readonly referenceNoteHoldSeconds: number
  onReferenceNoteHoldChange(seconds: number): void
}

export function DevelopmentReferenceTuning(
  props: DevelopmentReferenceControls,
) {
  return (
    <fieldset class={styles.group}>
      <legend>Reference note</legend>
      <label class={styles.speed}>
        <span>
          Note hold{' '}
          <output>{props.referenceNoteHoldSeconds.toFixed(2)}s</output>
        </span>
        <input
          type="range"
          aria-label="Reference note hold"
          aria-valuetext={`${props.referenceNoteHoldSeconds.toFixed(2)} seconds`}
          min={REFERENCE_NOTE_HOLD.minimum}
          max={REFERENCE_NOTE_HOLD.maximum}
          step="0.05"
          value={props.referenceNoteHoldSeconds}
          onInput={(event) =>
            props.onReferenceNoteHoldChange(event.currentTarget.valueAsNumber)
          }
        />
      </label>
      <p class={styles.caption}>
        How long Hear holds each steady note. Applies to the next example; waves
        and melodies keep their timing.
      </p>
      <button
        class={styles.reset}
        type="button"
        onClick={() =>
          props.onReferenceNoteHoldChange(REFERENCE_NOTE_HOLD.default)
        }
      >
        Reset note hold
      </button>
    </fieldset>
  )
}
