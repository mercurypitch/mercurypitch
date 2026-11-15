// ============================================================
// Studio note tools — the note editor's toolbar: Select and Draw, the snap grid, Quantize, and the selection's transpose, Duplicate, Delete and velocity
// ============================================================
//
// In the mockups' style: the tools as one segmented control, the grid as a
// menu, and the selection's edits as icon buttons, each with a name, its
// key where it has one, and a word on why it is off when nothing is
// selected (MISTAKES.md, "A control that refuses silently looks broken").
// On a phone the tools stay at the top and the selection's edits sit in a
// bar over the status line, where a thumb reaches; every target is 44 px.
// Each button is one command to the engine (useStudioNoteEditing.ts), so
// one commit and one undo step.
import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { ChevronDown, ChevronUp, Copy, Minus, Pencil, Plus, Trash2, } from '@/components/icons'
import type { StudioNote } from '@/lib/studio/model/types'
import { ChevronsDown, ChevronsUp, Magnet, PointerArrow, QuantizeLines, VelocityBars, } from '../studio-icons'
import type { NoteSnap } from './edit-snap'
import { NOTE_SNAPS } from './edit-snap'
import type { NoteEditCommand } from './edit-types'
import { noteVelocityValue } from './edit-velocity'
import styles from './StudioNoteTools.module.css'
import type { StudioNoteEditing } from './useStudioNoteEditing'

export interface StudioNoteToolsProps {
  editing: StudioNoteEditing
  /** The clip's notes as stored. */
  notes: readonly StudioNote[]
  writable: boolean
  /** A phone's: icons alone, 44 px targets. */
  compact: boolean
  /** A drum lane's: no transpose, since Up and Down move a hit between rows. */
  kit?: boolean
}

const SNAP_WORDS: Readonly<Record<NoteSnap, string>> = {
  '1/4': '1/4',
  '1/8': '1/8',
  '1/16': '1/16',
  '1/32': '1/32',
  '1/4T': '1/4 triplet',
  '1/8T': '1/8 triplet',
  '1/16T': '1/16 triplet',
  off: 'Off',
}

/** How far the velocity buttons move the selection, in 127 steps. */
const VELOCITY_STEP = 8

const BUSY = 'The song is busy for a moment'

function ToolButton(props: {
  label: string
  title: string
  keys?: string
  disabled?: boolean
  pressed?: boolean
  compact: boolean
  icon: JSX.Element
  words?: string
  onClick(): void
}) {
  return (
    <button
      type="button"
      class={styles.button}
      classList={{
        [styles.iconOnly]: props.compact || props.words === undefined,
      }}
      aria-label={props.label}
      aria-pressed={props.pressed}
      aria-keyshortcuts={props.keys}
      title={props.title}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.icon}
      <Show when={!props.compact && props.words}>
        <span>{props.words}</span>
      </Show>
    </button>
  )
}

/** Select and Draw, the snap grid and Quantize. */
export function StudioNoteTools(props: StudioNoteToolsProps) {
  const tool = () => props.editing.tool()
  return (
    <div
      class={styles.tools}
      classList={{ [styles.compact]: props.compact }}
      data-studio-note-toolbar=""
    >
      <div class={styles.segment} role="group" aria-label="Tool">
        <ToolButton
          label="Select"
          title="Select: press a note to select or move it (B switches)"
          keys="B"
          pressed={tool() === 'select'}
          compact={props.compact}
          icon={<PointerArrow size={16} />}
          words="Select"
          onClick={() => props.editing.setTool('select')}
        />
        <ToolButton
          label="Draw"
          title="Draw: press the grid to add a note, drag for its length (B switches)"
          keys="B"
          pressed={tool() === 'draw'}
          compact={props.compact}
          icon={<Pencil size={16} />}
          words="Draw"
          onClick={() => props.editing.setTool('draw')}
        />
      </div>
      <label class={styles.snap} title="Where notes snap in time">
        <Magnet size={16} />
        <Show when={!props.compact}>
          <span>Snap</span>
        </Show>
        <select
          class={styles.select}
          aria-label="Snap"
          value={props.editing.snap()}
          onChange={(event) =>
            props.editing.setSnap(event.currentTarget.value as NoteSnap)
          }
        >
          <For each={NOTE_SNAPS}>
            {(snap) => <option value={snap}>{SNAP_WORDS[snap]}</option>}
          </For>
        </select>
      </label>
      <ToolButton
        label="Quantize"
        title={
          props.writable
            ? 'Move the selected notes, or every note when none is selected, onto the grid'
            : BUSY
        }
        disabled={!props.writable || props.notes.length === 0}
        compact={props.compact}
        icon={<QuantizeLines size={16} />}
        words="Quantize"
        onClick={() => props.editing.command({ type: 'quantize' })}
      />
    </div>
  )
}

/** The selection's edits: transpose by a semitone or an octave, Duplicate, Delete and velocity. */
export function StudioNoteSelectionTools(props: StudioNoteToolsProps) {
  const chosen = createMemo(() => {
    const ids = new Set(props.editing.state().selection)
    return props.notes.filter((note) => ids.has(note.id))
  })
  const none = () => chosen().length === 0
  const off = () => !props.writable || none()
  const why = (title: string) => {
    if (!props.writable) return BUSY
    return none() ? 'Select notes first' : title
  }
  const velocity = () => {
    const notes = chosen()
    if (notes.length === 0) return null
    const sum = notes.reduce(
      (total, note) => total + noteVelocityValue(note.velocity),
      0,
    )
    return Math.round(sum / notes.length)
  }
  const send = (command: NoteEditCommand) => props.editing.command(command)
  return (
    <div
      class={styles.tools}
      classList={{ [styles.compact]: props.compact }}
      data-studio-note-selection-tools=""
    >
      <Show when={props.kit !== true}>
        <div class={styles.cluster} role="group" aria-label="Transpose">
          <ToolButton
            label="Down an octave"
            title={why('Down an octave (Shift+Down)')}
            keys="Shift+ArrowDown"
            disabled={off()}
            compact={props.compact}
            icon={<ChevronsDown size={17} />}
            onClick={() => send({ type: 'transpose', semitones: -12 })}
          />
          <ToolButton
            label="Down a semitone"
            title={why('Down a semitone (Down)')}
            keys="ArrowDown"
            disabled={off()}
            compact={props.compact}
            icon={<ChevronDown size={17} />}
            onClick={() => send({ type: 'transpose', semitones: -1 })}
          />
          <ToolButton
            label="Up a semitone"
            title={why('Up a semitone (Up)')}
            keys="ArrowUp"
            disabled={off()}
            compact={props.compact}
            icon={<ChevronUp />}
            onClick={() => send({ type: 'transpose', semitones: 1 })}
          />
          <ToolButton
            label="Up an octave"
            title={why('Up an octave (Shift+Up)')}
            keys="Shift+ArrowUp"
            disabled={off()}
            compact={props.compact}
            icon={<ChevronsUp size={17} />}
            onClick={() => send({ type: 'transpose', semitones: 12 })}
          />
        </div>
      </Show>
      <div class={styles.cluster}>
        <ToolButton
          label="Duplicate"
          title={why('Duplicate the selection after itself (Ctrl+D)')}
          keys="Control+D Meta+D"
          disabled={off()}
          compact={props.compact}
          icon={<Copy size={17} />}
          onClick={() => send({ type: 'duplicate' })}
        />
        <ToolButton
          label="Delete"
          title={why('Delete the selection (Delete)')}
          keys="Delete Backspace"
          disabled={off()}
          compact={props.compact}
          icon={<Trash2 />}
          onClick={() => send({ type: 'delete' })}
        />
      </div>
      <div class={styles.velocity} role="group" aria-label="Velocity">
        <VelocityBars size={16} />
        <ToolButton
          label="Softer"
          title={why(`Softer by ${VELOCITY_STEP}`)}
          disabled={off()}
          compact={props.compact}
          icon={<Minus size={15} />}
          onClick={() => send({ type: 'velocity', steps: -VELOCITY_STEP })}
        />
        <output
          class={styles.value}
          aria-label="Velocity of the selection"
          data-studio-note-velocity=""
        >
          {velocity() ?? '–'}
        </output>
        <ToolButton
          label="Louder"
          title={why(`Louder by ${VELOCITY_STEP}`)}
          disabled={off()}
          compact={props.compact}
          icon={<Plus size={15} />}
          onClick={() => send({ type: 'velocity', steps: VELOCITY_STEP })}
        />
      </div>
    </div>
  )
}
