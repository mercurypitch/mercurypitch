// Studio record button — one press arms the selected lane, the next records, the next stops; armed and recording look different.
import type { StudioRecordPhase } from '@/lib/studio/record/studio-recorder'
import { RecordDot } from '../studio-icons'
import styles from './StudioRecord.module.css'

/** What a press does now, for a screen reader. */
const LABELS: Readonly<Record<StudioRecordPhase, string>> = {
  idle: 'Record',
  arming: 'Opening the microphone',
  armed: 'Start recording',
  counting: 'Cancel the count-in',
  recording: 'Stop recording',
  finishing: 'Keeping the take',
}

const TITLES: Readonly<Record<StudioRecordPhase, string>> = {
  idle: 'Record (R)',
  arming: 'Opening the microphone',
  armed: 'Start recording (R)',
  counting: 'Cancel the count-in (R)',
  recording: 'Stop recording (R or Space)',
  finishing: 'Keeping the take',
}

export function StudioRecordButton(props: {
  phase: StudioRecordPhase
  canArm: boolean
  onPress(): void
}) {
  return (
    <button
      type="button"
      class={styles.record}
      data-phase={props.phase}
      data-studio-record=""
      aria-label={LABELS[props.phase]}
      title={TITLES[props.phase]}
      disabled={
        props.phase === 'arming' ||
        props.phase === 'finishing' ||
        (props.phase === 'idle' && !props.canArm)
      }
      onClick={() => props.onPress()}
    >
      <RecordDot />
    </button>
  )
}
