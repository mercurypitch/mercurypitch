// Studio clip toolbar — explicit clip commands with a silent playhead-based split.
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioClip } from '@/lib/studio/model/types'
import styles from './StudioTimeline.module.css'
import { clipEndFrame } from './timeline-geometry'

interface StudioClipToolbarProps {
  clip: StudioClip
  playheadFrame: number
  writable: boolean
  left: number
  onCommand(command: StudioCommand): boolean
  onDetails(): void
  onRemove(): void
}

export function StudioClipToolbar(props: StudioClipToolbarProps) {
  const canSplit = () =>
    props.playheadFrame > props.clip.startFrame &&
    props.playheadFrame < clipEndFrame(props.clip)
  return (
    <div
      class={styles.toolbar}
      role="toolbar"
      aria-label="Selected clip"
      style={{ left: `${props.left}px` }}
    >
      <button
        type="button"
        disabled={!props.writable || !canSplit()}
        title={
          canSplit() ? 'Split at playhead' : 'Move the playhead over the clip'
        }
        onClick={() =>
          props.onCommand({
            type: 'split-clip',
            clipId: props.clip.id,
            atFrame: props.playheadFrame,
            newClipId: globalThis.crypto.randomUUID(),
          })
        }
      >
        Split
      </button>
      <button
        type="button"
        disabled={!props.writable}
        onClick={() =>
          props.onCommand({
            type: 'duplicate-clip',
            clipId: props.clip.id,
            newClipId: globalThis.crypto.randomUUID(),
            newTrackId: globalThis.crypto.randomUUID(),
          })
        }
      >
        Duplicate
      </button>
      <button
        type="button"
        disabled={!props.writable}
        onClick={() => {
          if (props.onCommand({ type: 'remove-clip', clipId: props.clip.id }))
            props.onRemove()
        }}
      >
        Delete
      </button>
      <button type="button" onClick={() => props.onDetails()}>
        Details
      </button>
    </div>
  )
}
