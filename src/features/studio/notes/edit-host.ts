// ============================================================
// Studio note editing host glue — the browser's events turned into the engine's inputs, and the engine's view and commits turned into what the roll draws and the song takes
// ============================================================
//
// The one place the engine (edit-*.ts) and C's roll (note-roll-*.ts) meet,
// so neither knows the other's coordinates:
//
// - A pointer's x and y count from the surface it went down on, the roll's
//   grid or the velocity lane under it, and keep counting from it while it
//   is captured, wherever it goes; the keys' column and the ruler take no
//   press.
// - The engine's view comes back in the grid's pixels; the roll draws in
//   its canvas's, the keys' column to the left and the ruler above, so its
//   marquee and grips move by those bands here. A draft is a note the
//   gesture changes or adds; the roll draws it over a ghost of its stored
//   note.
// - A commit becomes one `set-sequence-notes`, with an id for the clip's
//   own copy of a shared sequence: one undo step.
// - A draft goes to the render service as it changes (sameNoteDraft), so
//   the clip sounds as the gesture would leave it.
//
// The piano opens with rows a finger can take on a touch screen, about
// 24 px (fitStudioRollRows), and with the notes fitted to a mouse's.
import type { RollViewport } from '@/lib/roll-geometry'
import type { StudioNoteSet } from '@/lib/studio/midi/notes'
import { fitStudioRollRows } from '@/lib/studio/midi/roll-rows'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioNote } from '@/lib/studio/model/types'
import { sameNotes } from './edit-changes'
import type { NoteEditCommit, NoteEditInput, NoteEditKey, NotePointerType, NoteSurface, } from './edit-types'
import type { NoteEditView } from './edit-view'
import type { StudioRollDraft, StudioRollInput, StudioRollRect, StudioRollRegions, } from './note-roll-geometry'

/** The rows a piano opens with on a touch screen: tall enough for a finger. */
export const NOTE_TOUCH_ROW_HEIGHT = 24

/** The pointer event's parts the engine reads. */
export type NoteRollPointerEvent = Pick<
  PointerEvent,
  | 'pointerId'
  | 'pointerType'
  | 'clientX'
  | 'clientY'
  | 'timeStamp'
  | 'button'
  | 'shiftKey'
  | 'ctrlKey'
  | 'metaKey'
  | 'altKey'
>

/** Where the roll's canvas sits on the page. */
export interface NoteRollOrigin {
  readonly left: number
  readonly top: number
}

function inside(rect: StudioRollRect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x < rect.x + rect.width &&
    y >= rect.y &&
    y < rect.y + rect.height
  )
}

/** The surface a press at canvas `x`, `y` lands on; null over the keys or the ruler. */
export function noteRollSurfaceAt(
  regions: Pick<StudioRollRegions, 'grid' | 'velocity'>,
  x: number,
  y: number,
): NoteSurface | null {
  if (inside(regions.grid, x, y)) return 'roll'
  if (inside(regions.velocity, x, y)) return 'velocity'
  return null
}

function pointerType(type: string): NotePointerType {
  return type === 'touch' || type === 'pen' ? type : 'mouse'
}

/** A pointer event as the engine reads it, its x and y counted from `surface`. */
export function noteRollPointerInput(
  type: 'down' | 'move' | 'up' | 'cancel',
  event: NoteRollPointerEvent,
  origin: NoteRollOrigin,
  regions: Pick<StudioRollRegions, 'grid' | 'velocity'>,
  surface: NoteSurface,
): NoteEditInput {
  const rect = surface === 'roll' ? regions.grid : regions.velocity
  return {
    type,
    pointerId: event.pointerId,
    pointerType: pointerType(event.pointerType),
    surface,
    x: event.clientX - origin.left - rect.x,
    y: event.clientY - origin.top - rect.y,
    time: event.timeStamp,
    button: event.button,
    shift: event.shiftKey,
    mod: event.ctrlKey || event.metaKey,
    alt: event.altKey,
  }
}

/** A wheel event over the roll, its x and y counted from the grid. */
export function noteRollWheelInput(
  event: Pick<
    WheelEvent,
    | 'clientX'
    | 'clientY'
    | 'deltaX'
    | 'deltaY'
    | 'deltaMode'
    | 'shiftKey'
    | 'ctrlKey'
    | 'metaKey'
  >,
  origin: NoteRollOrigin,
  grid: StudioRollRect,
): NoteEditInput {
  return {
    type: 'wheel',
    x: event.clientX - origin.left - grid.x,
    y: event.clientY - origin.top - grid.y,
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaMode: event.deltaMode,
    shift: event.shiftKey,
    mod: event.ctrlKey || event.metaKey,
  }
}

/** A key event as the engine reads it. */
export function noteEditKeyInput(
  event: Pick<
    KeyboardEvent,
    'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat'
  >,
): NoteEditKey {
  return {
    key: event.key,
    shift: event.shiftKey,
    mod: event.ctrlKey || event.metaKey,
    alt: event.altKey,
    repeat: event.repeat,
  }
}

/** A rect in the grid's pixels, in the canvas's. */
function onCanvas(rect: StudioRollRect, grid: StudioRollRect): StudioRollRect {
  return { ...rect, x: rect.x + grid.x, y: rect.y + grid.y }
}

/** The notes a draft changes or adds: what the roll draws over its stored notes' ghosts. */
export function noteRollDrafts(
  view: Pick<NoteEditView, 'notes' | 'drafting'>,
  stored: readonly StudioNote[],
): StudioRollDraft[] {
  if (!view.drafting) return []
  const before = new Map(stored.map((note) => [note.id, note]))
  return view.notes.filter((note) => {
    const was = before.get(note.id)
    return was === undefined || !sameNotes([was], [note])
  })
}

/** What the engine's view adds to a roll's draw, in the canvas's pixels. */
export type NoteRollDrawing = Pick<
  StudioRollInput,
  'selected' | 'drafts' | 'marquee' | 'grips' | 'hover' | 'readout'
>

export function noteRollDrawing(
  view: NoteEditView,
  stored: readonly StudioNote[],
  grid: StudioRollRect,
): NoteRollDrawing {
  return {
    selected: new Set(view.selection),
    drafts: noteRollDrafts(view, stored),
    marquee: view.marquee === null ? null : onCanvas(view.marquee, grid),
    grips: view.grips.map((grip) => onCanvas(grip, grid)),
    hover: view.hover,
    readout: view.readout,
  }
}

/** A commit as the Studio's one command for it: one undo step. */
export function noteCommitCommand(
  clipId: string,
  commit: NoteEditCommit,
  createId: () => string,
): StudioCommand {
  return {
    type: 'set-sequence-notes',
    clipId,
    notes: commit.notes,
    nextNoteId: commit.nextNoteId,
    forkSequenceId: createId(),
  }
}

/** Whether two drafts hold the same notes: a drag that moved no note further has nothing new to render. */
export function sameNoteDraft(
  a: StudioNoteSet | null,
  b: StudioNoteSet | null,
): boolean {
  if (a === null || b === null) return a === b
  return a.nextNoteId === b.nextNoteId && sameNotes(a.notes, b.notes)
}

/** A piano roll as it opens: on a touch screen, rows a finger can take. */
export function notePianoOpening(
  opened: RollViewport,
  touch: boolean,
): RollViewport {
  return touch ? fitStudioRollRows(opened, NOTE_TOUCH_ROW_HEIGHT) : opened
}
