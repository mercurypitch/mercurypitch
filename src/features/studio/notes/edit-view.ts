// ============================================================
// Studio note editor view — what the roll and the velocity lane draw for the editor's state: the notes as a gesture leaves them, the selection and its grips, a marquee, the note under the mouse, a velocity being dragged, and the cursor
// ============================================================
//
// The renderer draws `notes` in place of the sequence's while a gesture
// drafts (`drafting`), so a drag shows exactly what its release commits.
// Each selected note the clip plays carries a grip (edit-pick.ts,
// noteGripRect): a 3 px bar inside the right end of a note at least 24 px
// wide, else just beside it, half the note's height and 6 px at the least,
// drawn over the note in the note text colour. The readout is the pressed
// note's velocity, 1 to 127, for the lane to show beside its lollipop.
import type { RollRect, RollViewport } from '@/lib/roll-geometry'
import { noteRect, timeToX } from '@/lib/roll-geometry'
import { studioRollYOf, studioWindowRollNotes, } from '@/lib/studio/midi/roll-rows'
import type { StudioNote } from '@/lib/studio/model/types'
import { noteGripRect } from './edit-pick'
import { singleGesture } from './edit-pointer'
import type { NoteDragIntent, NoteEditContext, NoteEditHover, NoteEditState, NoteMarquee, NoteSingleGesture, NoteVelocityReadout, } from './edit-types'

export type NoteEditCursor =
  | 'default'
  | 'grab'
  | 'grabbing'
  | 'ew-resize'
  | 'ns-resize'
  | 'crosshair'

export interface NoteEditView {
  /** The notes to draw: a gesture's draft while it changes any, else the sequence's. */
  readonly notes: readonly StudioNote[]
  /** Whether `notes` is a gesture's draft. */
  readonly drafting: boolean
  readonly selection: readonly number[]
  /** A grip for each selected note the clip plays, in the roll's pixels. */
  readonly grips: readonly RollRect[]
  readonly marquee: RollRect | null
  readonly hover: NoteEditHover | null
  readonly readout: NoteVelocityReadout | null
  readonly cursor: NoteEditCursor
}

const DRAG_CURSORS: Readonly<Record<NoteDragIntent['kind'], NoteEditCursor>> = {
  move: 'grabbing',
  resize: 'ew-resize',
  velocity: 'ns-resize',
  draw: 'crosshair',
  marquee: 'crosshair',
  pan: 'grabbing',
  none: 'default',
}

const HOVER_CURSORS: Readonly<Record<NoteEditHover['zone'], NoteEditCursor>> = {
  body: 'grab',
  end: 'ew-resize',
  velocity: 'ns-resize',
}

function marqueeRect(marquee: NoteMarquee, viewport: RollViewport): RollRect {
  const xs = [marquee.fromTick, marquee.toTick].map((tick) =>
    timeToX(tick, viewport),
  )
  const ys = [marquee.fromPitch, marquee.toPitch].map((pitch) =>
    studioRollYOf(pitch, viewport),
  )
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.abs(xs[1] - xs[0]),
    height: Math.abs(ys[1] - ys[0]),
  }
}

function grips(
  notes: readonly StudioNote[],
  selection: readonly number[],
  ctx: NoteEditContext,
): RollRect[] {
  if (selection.length === 0) return []
  const chosen = new Set(selection)
  return studioWindowRollNotes({ notes }, ctx.window)
    .filter((note) => chosen.has(note.id))
    .map((note) => noteGripRect(noteRect(note, ctx.viewport)))
}

function cursorOf(
  state: NoteEditState,
  gesture: NoteSingleGesture | null,
): NoteEditCursor {
  if (gesture !== null) return DRAG_CURSORS[gesture.intent.kind]
  if (state.hover !== null) return HOVER_CURSORS[state.hover.zone]
  return state.tool === 'draw' ? 'crosshair' : 'default'
}

/** What the roll and the velocity lane draw now. */
export function noteEditView(
  state: NoteEditState,
  ctx: NoteEditContext,
): NoteEditView {
  const gesture = singleGesture(state)
  const draft = gesture?.draft ?? null
  const notes = draft?.sequence?.notes ?? ctx.sequence.notes
  const selection = draft?.selection ?? state.selection
  return {
    notes,
    drafting: draft?.sequence != null,
    selection,
    grips: grips(notes, selection, ctx),
    marquee:
      draft?.marquee == null ? null : marqueeRect(draft.marquee, ctx.viewport),
    hover: gesture === null ? state.hover : null,
    readout: draft?.readout ?? null,
    cursor: cursorOf(state, gesture),
  }
}
