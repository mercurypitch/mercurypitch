// Studio line bar — the open line's commands at the arrangement's foot: Volume or Pan, a point at the playhead, delete, clear, done.
// Like the clip bar, it stands as icons in the dock beside the lanes while the desk is open.
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { CheckSmall, Plus, Trash2, Volume2 } from '@/components/icons'
import type { StudioAutomationParam } from '@/lib/studio/model/automation'
import { studioLaneValueAt } from '@/lib/studio/model/automation'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioTrack } from '@/lib/studio/model/types'
import { studioLineValue } from './lane-line'
import type { StudioLineEditor } from './line-editor'
import { createStudioLineActions } from './line-editor'
import { ClearLine, PanSides } from './line-icons'
import lineStyles from './StudioLaneLine.module.css'
import styles from './StudioTimeline.module.css'

interface StudioLineBarProps {
  track: StudioTrack
  editor: StudioLineEditor
  /** The lane's hue, so the bar says which lane it acts on. */
  color?: string
  playheadFrame: number
  writable: boolean
  /** Across the foot of a phone's lanes, with icons for the commands. */
  phone: boolean
  /** Finger-sized: the point and line commands as icons. */
  touch?: boolean
  /** Offsets inside the timeline: past the lane headers, above the scrollbar. */
  left: number
  bottom: number
  /** Room kept at the foot's right for the zoom buttons. */
  reserve?: number
  /** In the dock beside the arrangement: icons only, the names kept for assistive tech. */
  docked?: boolean
  onCommand(command: StudioCommand): boolean
  onStatus(message: string): void
}

export function StudioLineBar(props: StudioLineBarProps) {
  const param = () => props.editor.view()?.param ?? 'volume'
  const actions = createStudioLineActions({
    track: () => props.track,
    param,
    editor: () => props.editor,
    onCommand: (command) => props.onCommand(command),
  })
  const count = () => (props.editor.draft() ?? actions.saved()).length
  const selected = () => {
    const index = props.editor.selected()
    return index !== null && index < count() ? index : null
  }
  const place = (): JSX.CSSProperties => {
    if (props.docked === true) return { '--studio-track': props.color }
    return {
      left: `${props.phone ? 12 : props.left}px`,
      right: props.phone ? '12px' : undefined,
      // Short of the zoom buttons: a narrow arrangement wraps the bar.
      'max-width': props.phone
        ? undefined
        : `calc(100% - ${props.left + (props.reserve ?? 0)}px)`,
      'flex-wrap': props.phone ? undefined : 'wrap',
      bottom: `${props.bottom}px`,
      '--studio-track': props.color,
    }
  }

  function addAtPlayhead(): void {
    const frame = Math.max(0, Math.round(props.playheadFrame))
    const value = studioLineValue(
      param(),
      studioLaneValueAt(props.track, param(), frame),
    )
    if (!actions.add({ frame, value }))
      props.onStatus('A line holds up to 256 points.')
  }

  const paramButton = (
    name: StudioAutomationParam,
    text: string,
    icon: JSX.Element,
  ) => (
    <button
      type="button"
      class={lineStyles.param}
      aria-pressed={param() === name}
      title={`Draw the ${name} line`}
      onClick={() => props.editor.show(name)}
    >
      <span class={lineStyles.paramIcon}>{icon}</span>
      <span class={styles.toolbarText}>{text}</span>
    </button>
  )
  const commandText = `${styles.toolbarText} ${lineStyles.commandText}`

  return (
    <div
      class={`${styles.toolbar} ${lineStyles.bar}`}
      classList={{
        [styles.toolbarDocked]: props.docked === true,
        [lineStyles.phoneBar]: props.phone,
        [lineStyles.compactBar]: props.touch === true && props.docked !== true,
      }}
      role="toolbar"
      aria-label={`${props.track.name} lines`}
      aria-orientation={props.docked === true ? 'vertical' : undefined}
      data-studio-line-bar=""
      style={place()}
    >
      <Show when={!props.phone}>
        <span class={styles.toolbarLabel}>
          <span class={styles.toolbarText}>{props.track.name}</span>
        </span>
        <span class={styles.toolbarDivider} aria-hidden="true" />
      </Show>
      {paramButton('volume', 'Volume', <Volume2 />)}
      {paramButton('pan', 'Pan', <PanSides size={15} />)}
      <span class={styles.toolbarDivider} aria-hidden="true" />
      <button
        type="button"
        disabled={!props.writable}
        title="Add a point at the playhead"
        onClick={addAtPlayhead}
      >
        <Plus size={15} />
        <span class={commandText}>Add point</span>
      </button>
      <button
        type="button"
        disabled={!props.writable || selected() === null}
        title="Delete the chosen point"
        onClick={() => {
          const index = selected()
          if (index !== null) actions.remove(index)
        }}
      >
        <Trash2 />
        <span class={commandText}>Delete point</span>
      </button>
      <button
        type="button"
        disabled={!props.writable || count() === 0}
        title={`Clear the ${param()} line. Undo brings it back.`}
        onClick={() => actions.clear()}
      >
        <ClearLine size={15} />
        <span class={commandText}>Clear line</span>
      </button>
      <Show when={props.docked !== true}>
        <span class={styles.toolbarDivider} aria-hidden="true" />
        <button
          type="button"
          title="Close the lines"
          onClick={() => props.editor.close()}
        >
          <CheckSmall size={15} />
          <span class={styles.toolbarText}>Done</span>
        </button>
      </Show>
    </div>
  )
}
