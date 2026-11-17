// ============================================================
// Studio note press — what a press in the note editor starts, by tool, pointer and what is under it: a move, a resize, a velocity drag, a drawn note, a marquee or a pan, and what it does if it comes up where it went down
// ============================================================
//
// A press on a note acts at once, with no long press, in Select and in
// Draw alike: it drags the note with the rest of the selection when the
// note was selected, alone when it was not (Shift, Ctrl or Cmd add it to
// the selection instead). A note pressed unselected shows selected while
// the press lasts; an undone press puts the old selection back. A tap on a
// note selects it alone, or with Shift, Ctrl or Cmd toggles it.
//
// A press on empty grid draws in Draw, inside the clip's window: a note a
// grid step long appears under it at once, and a drag sets its length.
// Elsewhere a mouse draws a marquee and a finger pans, and a tap clears the
// selection. A press in the velocity lane takes a lollipop or nothing.
//
// A press on the grid in Erase, or with a mouse's or a pen's secondary
// button in any tool, starts a sweep instead (edit-erase.ts); the
// secondary button in the velocity lane starts nothing.
import type { RollViewport } from '@/lib/roll-geometry'
import { xToTime } from '@/lib/roll-geometry'
import type { StudioNoteDraft } from '@/lib/studio/midi/notes'
import { addStudioNote } from '@/lib/studio/midi/notes'
import { studioRollPitchAt } from '@/lib/studio/midi/roll-rows'
import { inNoteWindow, noteById, playedNotes } from './edit-changes'
import { eraseFirstDraft, pressErases, secondaryPress } from './edit-erase'
import { editKeyAt, onKit, pickEditNote } from './edit-kit'
import { noteSnapGrid, noteStepGrid, snapFloor } from './edit-snap'
import type { NoteAnchor, NoteDraft, NoteDragIntent, NoteEditContext, NoteEditPointer, NoteEditState, NoteSingleGesture, NoteTapIntent, NoteTouch, } from './edit-types'
import { noteVelocityValue, pickLollipop } from './edit-velocity'

/** Said when a drawn note does not fit: a sequence holds 10,000 notes at the most. */
export const NOTE_FULL_NOTICE = 'This clip holds as many notes as it can.'

/** What a press reads from the editor's state. */
export type NotePressState = Pick<
  NoteEditState,
  'tool' | 'snap' | 'selection' | 'drawVelocity'
>

/** What a press started, and why it did less than it meant to, if it did. */
export interface NotePress {
  readonly gesture: NoteSingleGesture
  readonly notice: string | null
}

type PressTarget =
  | {
      readonly kind: 'note'
      readonly drag: 'move' | 'resize' | 'velocity'
      readonly noteId: number
    }
  | { readonly kind: 'draw' }
  | { readonly kind: 'marquee' }
  | { readonly kind: 'pan' }
  | { readonly kind: 'none' }

/** Where a pointer went down, in pixels and in the roll's ticks and pitch. */
export function noteAnchor(
  pointer: Pick<
    NoteEditPointer,
    'pointerId' | 'pointerType' | 'surface' | 'x' | 'y'
  >,
  viewport: RollViewport,
): NoteAnchor {
  return {
    pointerId: pointer.pointerId,
    pointerType: pointer.pointerType,
    surface: pointer.surface,
    x: pointer.x,
    y: pointer.y,
    tick: xToTime(pointer.x, viewport),
    pitch:
      pointer.surface === 'roll' ? studioRollPitchAt(pointer.y, viewport) : 0,
  }
}

/** The lollipop a press in the velocity lane takes, if any. */
function laneTarget(
  state: NotePressState,
  ctx: NoteEditContext,
  pointer: NoteEditPointer,
): PressTarget {
  const id = pickLollipop({
    notes: playedNotes(ctx.sequence, ctx.window),
    viewport: ctx.viewport,
    height: ctx.velocityHeight,
    selection: new Set(state.selection),
    x: pointer.x,
    y: pointer.y,
    pointerType: pointer.pointerType,
  })
  return id === null
    ? { kind: 'none' }
    : { kind: 'note', drag: 'velocity', noteId: id }
}

/** What a press on the roll lands on, and so what it starts. */
function rollTarget(
  state: NotePressState,
  ctx: NoteEditContext,
  pointer: NoteEditPointer,
  anchor: NoteAnchor,
): PressTarget {
  const pick = pickEditNote(ctx, {
    selection: new Set(state.selection),
    x: pointer.x,
    y: pointer.y,
    pointerType: pointer.pointerType,
  })
  if (pick !== null)
    return {
      kind: 'note',
      drag: pick.zone === 'end' ? 'resize' : 'move',
      noteId: pick.id,
    }
  if (state.tool === 'draw' && inNoteWindow(anchor.tick, ctx.window))
    return { kind: 'draw' }
  return { kind: pointer.pointerType === 'touch' ? 'pan' : 'marquee' }
}

/** The selection a press on a note shows while it lasts, and drags. */
function pressedSelection(
  live: readonly number[],
  id: number,
  selected: boolean,
  add: boolean,
): readonly number[] {
  if (selected) return live
  return add ? [...live, id] : [id]
}

/** The selection a tap on a note leaves. */
function tappedSelection(
  live: readonly number[],
  id: number,
  selected: boolean,
  add: boolean,
): readonly number[] {
  if (!selected) return pressedSelection(live, id, false, add)
  return add ? live.filter((each) => each !== id) : [id]
}

function idleDraft(selection: readonly number[]): NoteDraft {
  return { sequence: null, selection, marquee: null, readout: null }
}

/** A gesture from a press, not yet past the slop. */
function pressed(
  state: NotePressState,
  ctx: NoteEditContext,
  anchor: NoteAnchor,
  pointer: Pick<NoteEditPointer, 'x' | 'y' | 'alt' | 'time'>,
  parts: {
    readonly intent: NoteDragIntent
    readonly tap: NoteTapIntent
    readonly draft: NoteDraft
  },
): NoteSingleGesture {
  return {
    kind: 'single',
    anchor,
    base: ctx.sequence,
    before: state.selection,
    ...parts,
    dragging: false,
    last: { x: pointer.x, y: pointer.y, alt: pointer.alt === true },
    frameTime: pointer.time,
  }
}

function notePress(
  state: NotePressState,
  ctx: NoteEditContext,
  anchor: NoteAnchor,
  pointer: NoteEditPointer,
  target: Extract<PressTarget, { kind: 'note' }>,
): NoteSingleGesture {
  const add = pointer.shift === true || pointer.mod === true
  const live = state.selection
  const selected = live.includes(target.noteId)
  const shown = pressedSelection(live, target.noteId, selected, add)
  const note = noteById(ctx.sequence, target.noteId)
  const readout =
    target.drag === 'velocity' && note !== undefined
      ? { id: note.id, value: noteVelocityValue(note.velocity) }
      : null
  // On a kit, a tap in Draw takes the hit away.
  const removes =
    state.tool === 'draw' && !add && onKit(ctx) && target.drag === 'move'
  return pressed(state, ctx, anchor, pointer, {
    intent: { kind: target.drag, noteId: target.noteId, ids: shown },
    tap: removes
      ? { kind: 'remove', id: target.noteId }
      : {
          kind: 'select',
          selection: tappedSelection(live, target.noteId, selected, add),
        },
    draft: { ...idleDraft(shown), readout },
  })
}

/** A press on empty grid or an empty lane: a marquee, a pan, or nothing; a tap clears the selection unless it adds. */
function emptyPress(
  state: NotePressState,
  ctx: NoteEditContext,
  anchor: NoteAnchor,
  pointer: Pick<NoteEditPointer, 'x' | 'y' | 'alt' | 'time' | 'shift' | 'mod'>,
  kind: 'marquee' | 'pan' | 'none',
): NoteSingleGesture {
  const add = pointer.shift === true || pointer.mod === true
  const keep = kind === 'none' || add
  return pressed(state, ctx, anchor, pointer, {
    intent: kind === 'marquee' ? { kind, add } : { kind },
    tap: { kind: 'select', selection: keep ? state.selection : [] },
    draft: idleDraft(state.selection),
  })
}

/** The note a press in Draw puts down: on the grid line at or before it, on its row, a grid step long and inside the window; none past a kit's rows. */
function drawnNote(
  state: NotePressState,
  ctx: NoteEditContext,
  anchor: NoteAnchor,
  free: boolean,
): StudioNoteDraft | null {
  const pitch = editKeyAt(ctx, anchor.pitch)
  if (pitch === null) return null
  const offset = ctx.gridOffsetTick ?? 0
  const grid = free ? null : noteSnapGrid(state.snap, offset)
  const tick =
    grid === null ? Math.round(anchor.tick) : snapFloor(anchor.tick, grid)
  const startTick = Math.min(
    ctx.window.endTick - 1,
    Math.max(ctx.window.startTick, tick),
  )
  return {
    pitch,
    startTick,
    lengthTicks: Math.min(
      noteStepGrid(state.snap, offset).ticks,
      ctx.window.endTick - startTick,
    ),
    velocity: state.drawVelocity,
  }
}

function drawPress(
  state: NotePressState,
  ctx: NoteEditContext,
  anchor: NoteAnchor,
  pointer: NoteEditPointer,
): NotePress {
  const note = drawnNote(state, ctx, anchor, pointer.alt === true)
  const edit = note === null ? null : addStudioNote(ctx.sequence, note)
  if (note === null || edit === null)
    return {
      gesture: emptyPress(state, ctx, anchor, pointer, 'none'),
      notice: note === null ? null : NOTE_FULL_NOTICE,
    }
  return {
    gesture: pressed(state, ctx, anchor, pointer, {
      // On a kit a drag paints hits; on a piano it sets the note's length.
      intent: onKit(ctx)
        ? { kind: 'paint', hit: note }
        : { kind: 'draw', note },
      tap: { kind: 'draw' },
      draft: { ...idleDraft(edit.selection), sequence: edit.sequence },
    }),
    notice: null,
  }
}

/** A sweep from a press on the grid: the note under it gone at once, the rest of its path's as it travels (edit-erase.ts). */
function erasePress(
  state: NotePressState,
  ctx: NoteEditContext,
  anchor: NoteAnchor,
  pointer: NoteEditPointer,
): NoteSingleGesture {
  return pressed(state, ctx, anchor, pointer, {
    intent: { kind: 'erase' },
    tap: { kind: 'erase' },
    draft: eraseFirstDraft(ctx, state.selection, anchor),
  })
}

/** What a press starts: a sweep with the secondary button or in Erase, else what the tool does with the primary. */
export function pressNoteGesture(
  state: NotePressState,
  ctx: NoteEditContext,
  pointer: NoteEditPointer,
): NotePress {
  const anchor = noteAnchor(pointer, ctx.viewport)
  if (pressErases(state.tool, pointer))
    return {
      gesture: erasePress(state, ctx, anchor, pointer),
      notice: null,
    }
  // The secondary button erases notes, and takes no lollipop.
  if (secondaryPress(pointer))
    return {
      gesture: emptyPress(state, ctx, anchor, pointer, 'none'),
      notice: null,
    }
  const target =
    pointer.surface === 'velocity'
      ? laneTarget(state, ctx, pointer)
      : rollTarget(state, ctx, pointer, anchor)
  switch (target.kind) {
    case 'note':
      return {
        gesture: notePress(state, ctx, anchor, pointer, target),
        notice: null,
      }
    case 'draw':
      return drawPress(state, ctx, anchor, pointer)
    default:
      return {
        gesture: emptyPress(state, ctx, anchor, pointer, target.kind),
        notice: null,
      }
  }
}

/** The pan a finger goes on with when the other finger of a pinch lifts: already a drag, its lift selecting nothing. */
export function panNoteGesture(
  state: NotePressState,
  ctx: NoteEditContext,
  touch: NoteTouch,
  time: number,
): NoteSingleGesture {
  const finger = { ...touch, pointerType: 'touch' as const, time }
  const gesture = emptyPress(
    state,
    ctx,
    noteAnchor(finger, ctx.viewport),
    finger,
    'pan',
  )
  return {
    ...gesture,
    dragging: true,
    tap: { kind: 'select', selection: state.selection },
  }
}
