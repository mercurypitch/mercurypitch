// Studio clip toolbar — the selected clip's name and commands, floating at the timeline's foot like zoom.
import { Copy, Split, Trash2 } from '@/components/icons'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioClip } from '@/lib/studio/model/types'
import { InfoCircle } from '../studio-icons'
import styles from './StudioTimeline.module.css'
import { clipEndFrame } from './timeline-geometry'

interface StudioClipToolbarProps {
  clip: StudioClip
  playheadFrame: number
  writable: boolean
  /** The selected clip's track name and hue, so the bar says what it acts on. */
  label: string
  color?: string
  /** Offsets inside the timeline: past the lane headers, above the scrollbar. */
  left: number
  bottom: number
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
      style={{
        left: `${props.left}px`,
        bottom: `${props.bottom}px`,
        '--studio-track': props.color,
      }}
    >
      <span class={styles.toolbarLabel}>{props.label}</span>
      <span class={styles.toolbarDivider} aria-hidden="true" />
      <button
        type="button"
        disabled={!props.writable || !canSplit()}
        title={
          canSplit()
            ? 'Split at playhead (S)'
            : 'Move the playhead over the clip'
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
        <Split size={15} />
        Split
      </button>
      <button
        type="button"
        disabled={!props.writable}
        title="Duplicate after this clip"
        onClick={() =>
          props.onCommand({
            type: 'duplicate-clip',
            clipId: props.clip.id,
            newClipId: globalThis.crypto.randomUUID(),
            newTrackId: globalThis.crypto.randomUUID(),
          })
        }
      >
        <Copy size={15} />
        Duplicate
      </button>
      <span class={styles.toolbarDivider} aria-hidden="true" />
      <button
        type="button"
        disabled={!props.writable}
        title="Delete clip. Undo brings it back."
        onClick={() => {
          if (props.onCommand({ type: 'remove-clip', clipId: props.clip.id }))
            props.onRemove()
        }}
      >
        <Trash2 />
        Delete
      </button>
      <span class={styles.toolbarDivider} aria-hidden="true" />
      <button
        type="button"
        title="Exact start, trim, fades and gain"
        onClick={() => props.onDetails()}
      >
        <InfoCircle size={15} />
        Details
      </button>
    </div>
  )
}
