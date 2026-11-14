// ============================================================
// Studio note drag — what a press that travels drafts while it is down: notes moved, resized, drawn or made louder, or a marquee's selection, each worked out from the notes as they were at the press
// ============================================================
//
// A draft comes from the gesture's base and where the pointer is now, never
// from the draft before it, so a drag that comes back undoes itself and
// nothing accumulates. It reads the roll as it is now, so a roll that
// scrolled under a held drag carries the note with it.
//
// Time snaps where the pressed note lands (edit-snap.ts) unless Alt is
// held; pitch moves a semitone for each row the pointer travels. A move
// stops the whole selection at the window's or the keyboard's edge
// (notes.ts). A resize keeps the pressed note at least to the next grid
// line and ends it by the clip's end at the latest, the rest of the
// selection changing by as many ticks. A drawn note runs from its press to
// the grid line past the pointer, a step at the least.
import { xToTime } from '@/lib/roll-geometry'
import type { StudioNoteEdit, StudioNoteSet } from '@/lib/studio/midi/notes'
import { addStudioNote, moveStudioNotes, resizeStudioNotes, studioNotesInRange, } from '@/lib/studio/midi/notes'
import { studioRollPitchAt, studioRollRowOf } from '@/lib/studio/midi/roll-rows'
import { noteById, playedIds } from './edit-changes'
import type { NoteSnap } from './edit-snap'
import { lineAfter, noteSnapGrid, snapCeil, snapTravel } from './edit-snap'
import type { NoteDraft, NoteDragIntent, NoteEditContext, NoteMarquee, NoteSingleGesture, NoteVelocityReadout, } from './edit-types'
import { noteVelocityValue, stepStudioNoteVelocities, velocitySteps, } from './edit-velocity'

/** Where the pointer is, and whether Alt is held to place freely. */
export interface NoteDragPoint {
  readonly x: number
  readonly y: number
  readonly alt: boolean
}

type NoteDrag = Extract<NoteDragIntent, { readonly noteId: number }>

function draftOf(
  base: StudioNoteSet,
  edit: StudioNoteEdit<StudioNoteSet>,
  readout: NoteVelocityReadout | null = null,
): NoteDraft {
  return {
    sequence: edit.sequence === base ? null : edit.sequence,
    selection: edit.selection,
    marquee: null,
    readout,
  }
}

/** The grid a drag snaps to: none with Alt, or with snapping off. */
function dragGrid(snap: NoteSnap, ctx: NoteEditContext, at: NoteDragPoint) {
  return at.alt ? null : noteSnapGrid(snap, ctx.gridOffsetTick ?? 0)
}

/** Ticks the pointer has travelled since the press. */
function travelTicks(
  gesture: NoteSingleGesture,
  ctx: NoteEditContext,
  at: NoteDragPoint,
): number {
  return xToTime(at.x, ctx.viewport) - gesture.anchor.tick
}

function draftMove(
  gesture: NoteSingleGesture,
  intent: NoteDrag,
  ctx: NoteEditContext,
  at: NoteDragPoint,
  snap: NoteSnap,
): NoteDraft {
  const pressed = noteById(gesture.base, intent.noteId)
  if (pressed === undefined) return gesture.draft
  const dTick = snapTravel(
    pressed.startTick,
    travelTicks(gesture, ctx, at),
    dragGrid(snap, ctx, at),
  )
  const dPitch = Math.round(
    studioRollPitchAt(at.y, ctx.viewport) - gesture.anchor.pitch,
  )
  return draftOf(
    gesture.base,
    moveStudioNotes(gesture.base, intent.ids, dTick, dPitch, ctx.window),
  )
}

function draftResize(
  gesture: NoteSingleGesture,
  intent: NoteDrag,
  ctx: NoteEditContext,
  at: NoteDragPoint,
  snap: NoteSnap,
): NoteDraft {
  const pressed = noteById(gesture.base, intent.noteId)
  if (pressed === undefined) return gesture.draft
  const grid = dragGrid(snap, ctx, at)
  const end = pressed.startTick + pressed.lengthTicks
  const travel = snapTravel(end, travelTicks(gesture, ctx, at), grid)
  const least =
    grid === null ? pressed.startTick + 1 : lineAfter(pressed.startTick, grid)
  const most = Math.max(ctx.window.endTick, end)
  const dLength = Math.min(most, Math.max(least, end + travel)) - end
  if (dLength === 0)
    return { ...gesture.draft, sequence: null, selection: intent.ids }
  return draftOf(
    gesture.base,
    resizeStudioNotes(gesture.base, intent.ids, dLength),
  )
}

function draftVelocity(
  gesture: NoteSingleGesture,
  intent: NoteDrag,
  ctx: NoteEditContext,
  at: NoteDragPoint,
): NoteDraft {
  const steps = velocitySteps(gesture.anchor.y - at.y, ctx.velocityHeight)
  const edit = stepStudioNoteVelocities(gesture.base, intent.ids, steps)
  const pressed = noteById(edit.sequence, intent.noteId)
  const readout =
    pressed === undefined
      ? null
      : { id: pressed.id, value: noteVelocityValue(pressed.velocity) }
  return draftOf(gesture.base, edit, readout)
}

function draftDraw(
  gesture: NoteSingleGesture,
  intent: Extract<NoteDragIntent, { kind: 'draw' }>,
  ctx: NoteEditContext,
  at: NoteDragPoint,
  snap: NoteSnap,
): NoteDraft {
  const note = intent.note
  const grid = dragGrid(snap, ctx, at)
  const tick = xToTime(at.x, ctx.viewport)
  const end =
    grid === null
      ? Math.max(note.startTick + 1, Math.round(tick))
      : Math.max(note.startTick + grid.ticks, snapCeil(tick, grid))
  const last = Math.max(ctx.window.endTick, note.startTick + 1)
  const edit = addStudioNote(gesture.base, {
    ...note,
    lengthTicks: Math.min(end, last) - note.startTick,
  })
  return edit === null ? gesture.draft : draftOf(gesture.base, edit)
}

/** The notes the clip plays under a marquee, by row and by any overlap in time. */
function notesUnder(
  base: StudioNoteSet,
  ctx: NoteEditContext,
  marquee: NoteMarquee,
): readonly number[] {
  const ids = studioNotesInRange(base, {
    startTick: Math.min(marquee.fromTick, marquee.toTick),
    endTick: Math.max(marquee.fromTick, marquee.toTick),
    lowPitch: studioRollRowOf(Math.min(marquee.fromPitch, marquee.toPitch)),
    highPitch: studioRollRowOf(Math.max(marquee.fromPitch, marquee.toPitch)),
  })
  return playedIds(ids, base, ctx.window)
}

function draftMarquee(
  gesture: NoteSingleGesture,
  intent: Extract<NoteDragIntent, { kind: 'marquee' }>,
  ctx: NoteEditContext,
  at: NoteDragPoint,
): NoteDraft {
  const marquee = {
    fromTick: gesture.anchor.tick,
    toTick: xToTime(at.x, ctx.viewport),
    fromPitch: gesture.anchor.pitch,
    toPitch: studioRollPitchAt(at.y, ctx.viewport),
  }
  const under = notesUnder(gesture.base, ctx, marquee)
  const selection = intent.add
    ? [...new Set([...gesture.before, ...under])]
    : under
  return { sequence: null, selection, marquee, readout: null }
}

/** What a drag leaves if it ends with the pointer at `at`. */
export function draftNoteDrag(
  gesture: NoteSingleGesture,
  ctx: NoteEditContext,
  at: NoteDragPoint,
  snap: NoteSnap,
): NoteDraft {
  const intent = gesture.intent
  switch (intent.kind) {
    case 'move':
      return draftMove(gesture, intent, ctx, at, snap)
    case 'resize':
      return draftResize(gesture, intent, ctx, at, snap)
    case 'velocity':
      return draftVelocity(gesture, intent, ctx, at)
    case 'draw':
      return draftDraw(gesture, intent, ctx, at, snap)
    case 'marquee':
      return draftMarquee(gesture, intent, ctx, at)
    default:
      return gesture.draft
  }
}
