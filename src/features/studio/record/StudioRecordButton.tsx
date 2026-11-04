// Studio record button — one press records: on the armed lane, or with none armed it arms the selected lane (else the first empty one, else a new lane) and starts in the same press; the next press stops.
import type { StudioRecordPhase } from '@/lib/studio/record/studio-recorder'
import { RecordDot } from '../studio-icons'
import styles from './StudioRecord.module.css'
import type { StudioRecorderHandle } from './useStudioRecorder'

/** What a press does now, for a screen reader. */
const LABELS: Readonly<Record<StudioRecordPhase, string>> = {
  idle: 'Record',
  arming: 'Opening the microphone',
  armed: 'Record',
  counting: 'Cancel the count-in',
  recording: 'Stop recording',
  finishing: 'Keeping the take',
}

const TITLES: Readonly<Record<Exclude<StudioRecordPhase, 'armed'>, string>> = {
  idle: 'Record (R)',
  arming: 'Opening the microphone',
  counting: 'Cancel the count-in (R)',
  recording: 'Stop recording (R or Space)',
  finishing: 'Keeping the take',
}

export function StudioRecordButton(props: {
  recorder: Pick<
    StudioRecorderHandle,
    'phase' | 'canArm' | 'press' | 'view' | 'laneName'
  >
}) {
  const phase = () => props.recorder.phase()
  const title = () => {
    const now = phase()
    if (now !== 'armed') return TITLES[now]
    const lane = props.recorder.laneName(props.recorder.view().targetTrackId)
    return `Record on ${lane ?? 'a new lane'} (R)`
  }
  return (
    <button
      type="button"
      class={styles.record}
      data-phase={phase()}
      data-studio-record=""
      aria-label={LABELS[phase()]}
      title={title()}
      disabled={
        phase() === 'arming' ||
        phase() === 'finishing' ||
        (phase() === 'idle' && !props.recorder.canArm())
      }
      onClick={() => props.recorder.press()}
    >
      <RecordDot />
    </button>
  )
}
