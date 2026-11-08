// Studio record button — one press records: on every armed lane, or with none armed it arms the selected lane (else the first empty one, else a new lane) and starts in the same press; the next press stops.
import { joinNames } from '@/lib/jam/jam-arrivals'
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

/** The armed lanes by name, as the button's title says them. */
function armedNames(
  recorder: Pick<StudioRecorderHandle, 'view' | 'laneName'> &
    Partial<Pick<StudioRecorderHandle, 'armedLanes'>>,
): string {
  const armed = recorder.armedLanes?.() ?? []
  const lanes =
    armed.length > 0
      ? armed.map((lane) => lane.trackId)
      : [recorder.view().targetTrackId]
  return joinNames(
    lanes.map((trackId) => recorder.laneName(trackId) ?? 'a new lane'),
  )
}

export function StudioRecordButton(props: {
  recorder: Pick<
    StudioRecorderHandle,
    'phase' | 'canArm' | 'press' | 'view' | 'laneName'
  > &
    Partial<Pick<StudioRecorderHandle, 'armedLanes'>>
}) {
  const phase = () => props.recorder.phase()
  const title = () => {
    const now = phase()
    if (now !== 'armed') return TITLES[now]
    return `Record on ${armedNames(props.recorder)} (R)`
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
