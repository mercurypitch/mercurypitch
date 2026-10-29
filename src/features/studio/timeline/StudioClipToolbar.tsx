// Studio clip toolbar — the selected clip's name and commands, floating at the timeline's foot like zoom,
// or stacked as icons in the dock beside the arrangement while the desk is open.
import { Copy, Split, Trash2 } from '@/components/icons'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioClip } from '@/lib/studio/model/types'
import { InfoCircle } from '../studio-icons'
import styles from './StudioTimeline.module.css'
import { clipEndFrame } from './timeline-geometry'

interface StudioClipToolbarProps {
  clip: StudioClip
  playheadFrame: number
  /** The frame heard this moment: a split while the song plays cuts there. */
  frameNow?(): number
  writable: boolean
  /** The selected clip's track name and hue, so the bar says what it acts on. */
  label: string
  color?: string
  /** Offsets inside the timeline: past the lane headers, above the scrollbar. */
  left: number
  bottom: number
  /** In the dock beside the arrangement: icons only, the name kept for assistive tech. */
  docked?: boolean
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
      classList={{ [styles.toolbarDocked]: props.docked === true }}
      role="toolbar"
      aria-label="Selected clip"
      aria-orientation={props.docked === true ? 'vertical' : undefined}
      style={
        props.docked === true
          ? { '--studio-track': props.color }
          : {
              left: `${props.left}px`,
              bottom: `${props.bottom}px`,
              '--studio-track': props.color,
            }
      }
    >
      <span class={styles.toolbarLabel}>
        <span class={styles.toolbarText}>{props.label}</span>
      </span>
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
            atFrame: props.frameNow?.() ?? props.playheadFrame,
            newClipId: globalThis.crypto.randomUUID(),
          })
        }
      >
        <Split size={15} />
        <span class={styles.toolbarText}>Split</span>
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
        <span class={styles.toolbarText}>Duplicate</span>
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
        <span class={styles.toolbarText}>Delete</span>
      </button>
      <span class={styles.toolbarDivider} aria-hidden="true" />
      <button
        type="button"
        title="Exact start, trim, fades and gain"
        onClick={() => props.onDetails()}
      >
        <InfoCircle size={15} />
        <span class={styles.toolbarText}>Details</span>
      </button>
    </div>
  )
}
