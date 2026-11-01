// Studio record lane — the lane a take records into when it has no lane yet: it shows where the take will land until it is kept.
import timeline from '../timeline/StudioTimeline.module.css'
import type { StudioLaneTakeProps } from './StudioLaneTake'
import { StudioLaneTake } from './StudioLaneTake'
import styles from './StudioRecord.module.css'

export function StudioRecordLane(props: StudioLaneTakeProps) {
  return (
    <div
      class={timeline.lane}
      data-studio-record-lane=""
      style={{ '--studio-track': 'var(--red, #e5484d)' }}
    >
      <div class={`${timeline.trackHeader} ${styles.ghostHeader}`}>
        <span class={styles.ghostName}>New lane</span>
      </div>
      <div class={timeline.laneAudio}>
        <StudioLaneTake {...props} />
      </div>
    </div>
  )
}
