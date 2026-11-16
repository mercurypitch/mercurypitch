// ============================================================
// Studio note pointers — the note editor's pointer lifecycle: a press, then its drag or its tap; a second finger's pinch; a cancel; a drag held at an edge; and the note under a mouse
// ============================================================
//
// One pointer owns a gesture at a time. While a mouse or a pen is down the
// editor ignores other pointers, so a palm on a tablet cannot undo a pen's
// drag; a second press from the same mouse or pen means the first one's
// release was lost, so the old gesture is undone and the new one starts.
// A finger is different: a second finger undoes the first one's gesture,
// whatever it was doing, and the two pan and zoom (edit-viewport.ts); when
// one of them lifts, the other goes on panning. A cancel undoes its
// pointer's gesture.
//
// Sounds: a pressed or drawn note sounds at once. A note dragged onto
// another pitch sounds there, no sooner than NOTE_AUDITION_GAP_MS after the
// last sound, and the pitch it lands on sounds when it is let go if the
// last sound was another. A velocity dragged sounds its note when let go.
import type { RollViewport } from '@/lib/roll-geometry'
import { deleteStudioNotes } from '@/lib/studio/midi/notes'
import { noteById, noteEditCommit, playedNotes } from './edit-changes'
import type { NoteDragPoint } from './edit-drag'
import { draftNoteDrag } from './edit-drag'
import { editTopRow, pickEditNote } from './edit-kit'
import { NOTE_POINTER_PROFILES } from './edit-pick'
import { panNoteGesture, pressNoteGesture } from './edit-press'
import type { NoteEditContext, NoteEditEffect, NoteEditHover, NoteEditPointer, NoteEditState, NoteEditStep, NoteGesture, NotePinchGesture, NoteSingleGesture, NoteTouch, } from './edit-types'
import { pickLollipop } from './edit-velocity'
import { dragNoteRoll, noteEdgeScroll, noteViewRange, pinchNoteRoll, sameRollViewport, } from './edit-viewport'

/** The least time between two sounds of a dragged note, in milliseconds. */
export const NOTE_AUDITION_GAP_MS = 100
/** The drags that put a note down, which takes the last pressed note's velocity rather than setting it. */
const DRAWS = new Set(['draw', 'paint'])
/** The longest frame an edge scroll counts, so a stalled page does not jump. */
const MAX_FRAME_SECONDS = 0.05

const NO_EFFECTS: readonly NoteEditEffect[] = []

/** A step with no effects. */
export function quietStep(state: NoteEditState, handled = false): NoteEditStep {
  return { state, effects: NO_EFFECTS, handled }
}

/** `step` with `more` effects after its own. */
function also(
  step: NoteEditStep,
  more: readonly NoteEditEffect[],
): NoteEditStep {
  return more.length === 0
    ? step
    : { ...step, effects: [...step.effects, ...more] }
}

/** The single-pointer gesture under way, if one is. */
export function singleGesture(state: NoteEditState): NoteSingleGesture | null {
  return state.gesture?.kind === 'single' ? state.gesture : null
}

/** A gesture that drafts, a pointer's or held arrows', let go and undone: no draft, the selection it found. A pinch drafts nothing. */
export function revertNoteGesture(state: NoteEditState): NoteEditState {
  const gesture = state.gesture
  if (gesture === null || gesture.kind === 'pinch') return state
  return { ...state, gesture: null, selection: gesture.before }
}

function hasTouch(state: NoteEditState, pointerId: number): boolean {
  return state.touches.some((touch) => touch.pointerId === pointerId)
}

function withoutTouch(state: NoteEditState, pointerId: number): NoteEditState {
  if (!hasTouch(state, pointerId)) return state
  return {
    ...state,
    touches: state.touches.filter((touch) => touch.pointerId !== pointerId),
  }
}

function touchOf(pointer: NoteEditPointer): NoteTouch {
  return {
    pointerId: pointer.pointerId,
    surface: pointer.surface,
    x: pointer.x,
    y: pointer.y,
  }
}

function movedTouch(
  state: NoteEditState,
  pointer: NoteEditPointer,
): NoteEditState {
  if (!hasTouch(state, pointer.pointerId)) return state
  return {
    ...state,
    touches: state.touches.map((touch) =>
      touch.pointerId === pointer.pointerId ? touchOf(pointer) : touch,
    ),
  }
}

/** A viewport effect, when the roll moved. */
function viewportStep(
  state: NoteEditState,
  current: RollViewport,
  next: RollViewport,
): NoteEditStep {
  if (sameRollViewport(current, next)) return quietStep(state)
  return {
    state,
    effects: [{ type: 'viewport', viewport: next }],
    handled: false,
  }
}

/** Sound a note, when it is due: always for a press, else on a new pitch past the gap. */
function sound(
  state: NoteEditState,
  note: { readonly pitch: number; readonly velocity: number },
  time: number,
  force: boolean,
): NoteEditStep {
  const last = state.sounded
  const due =
    force ||
    last === null ||
    (last.pitch !== note.pitch && time - last.time >= NOTE_AUDITION_GAP_MS)
  if (!due) return quietStep(state)
  return {
    state: { ...state, sounded: { time, pitch: note.pitch } },
    effects: [{ type: 'audition', pitch: note.pitch, velocity: note.velocity }],
    handled: false,
  }
}

/** The note a press sounds: the one pressed, or the one drawn. */
function pressedNote(ctx: NoteEditContext, gesture: NoteSingleGesture) {
  const intent = gesture.intent
  if (intent.kind === 'draw') return intent.note
  if (intent.kind === 'paint') return intent.hit
  return 'noteId' in intent ? noteById(ctx.sequence, intent.noteId) : undefined
}

function press(
  state: NoteEditState,
  ctx: NoteEditContext,
  pointer: NoteEditPointer,
): NoteEditStep {
  const pressed = pressNoteGesture(state, ctx, pointer)
  const started = { ...state, gesture: pressed.gesture, hover: null }
  const notice: NoteEditEffect[] =
    pressed.notice === null ? [] : [{ type: 'notice', message: pressed.notice }]
  const note = pressedNote(ctx, pressed.gesture)
  if (note === undefined) return also(quietStep(started), notice)
  // A drawn note takes the velocity of the note pressed last.
  const drawn = DRAWS.has(pressed.gesture.intent.kind)
  const remembered = drawn
    ? started
    : { ...started, drawVelocity: note.velocity }
  return also(sound(remembered, note, pointer.time, true), notice)
}

/** Whether a gesture's release never came: a mouse or a pen cannot press twice at once. */
function lostRelease(owner: NoteGesture, pointer: NoteEditPointer): boolean {
  return (
    owner.kind === 'single' &&
    pointer.pointerType !== 'touch' &&
    owner.anchor.pointerType === pointer.pointerType
  )
}

function primaryPress(
  state: NoteEditState,
  ctx: NoteEditContext,
  pointer: NoteEditPointer,
): NoteEditStep {
  if ((pointer.button ?? 0) !== 0) return quietStep(state)
  const owner = state.gesture
  if (owner !== null && !lostRelease(owner, pointer)) return quietStep(state)
  return press(revertNoteGesture(state), ctx, pointer)
}

/** Two fingers down: the first one's gesture undone, and the two pinching; a mouse's or a pen's gesture goes on. */
function pinchFrom(state: NoteEditState): NoteEditState {
  const owner = state.gesture
  if (owner?.kind === 'pinch') return state
  if (owner?.kind === 'single' && owner.anchor.pointerType !== 'touch')
    return state
  const [a, b] = state.touches
  return {
    ...revertNoteGesture(state),
    gesture: { kind: 'pinch', pointerIds: [a.pointerId, b.pointerId] },
    hover: null,
  }
}

export function notePointerDown(
  state: NoteEditState,
  ctx: NoteEditContext,
  pointer: NoteEditPointer,
): NoteEditStep {
  if (pointer.pointerType !== 'touch') return primaryPress(state, ctx, pointer)
  const touched = withoutTouch(state, pointer.pointerId)
  const next = { ...touched, touches: [...touched.touches, touchOf(pointer)] }
  if (next.touches.length < 2) return primaryPress(next, ctx, pointer)
  return quietStep(pinchFrom(next))
}

function pastSlop(
  gesture: NoteSingleGesture,
  pointer: NoteEditPointer,
): boolean {
  const anchor = gesture.anchor
  return (
    Math.hypot(pointer.x - anchor.x, pointer.y - anchor.y) >=
    NOTE_POINTER_PROFILES[anchor.pointerType].slop
  )
}

/** A paint sounds the newest hit it put down, past the gap, the same drum again included. */
function paintSound(
  state: NoteEditState,
  before: NoteSingleGesture,
  after: NoteSingleGesture,
  time: number,
): NoteEditStep {
  const was = (before.draft.sequence ?? before.base).notes.length
  const notes = (after.draft.sequence ?? after.base).notes
  if (notes.length === was) return quietStep(state)
  const last = state.sounded
  const due = last === null || time - last.time >= NOTE_AUDITION_GAP_MS
  return sound(state, notes[notes.length - 1], time, due)
}

/** A dragged note sounds on each new pitch it reaches, past the gap; a paint, each hit it puts down. */
function dragSound(
  state: NoteEditState,
  before: NoteSingleGesture,
  gesture: NoteSingleGesture,
  time: number,
): NoteEditStep {
  if (gesture.intent.kind === 'paint')
    return paintSound(state, before, gesture, time)
  if (gesture.intent.kind !== 'move') return quietStep(state)
  const note = noteById(
    gesture.draft.sequence ?? gesture.base,
    gesture.intent.noteId,
  )
  return note === undefined ? quietStep(state) : sound(state, note, time, false)
}

function panTo(
  state: NoteEditState,
  ctx: NoteEditContext,
  gesture: NoteSingleGesture,
  at: NoteDragPoint,
): NoteEditStep {
  const rows = gesture.anchor.surface === 'roll'
  const viewport = dragNoteRoll(
    ctx.viewport,
    noteViewRange(ctx),
    at.x - gesture.last.x,
    rows ? at.y - gesture.last.y : 0,
    editTopRow(ctx),
  )
  const next = { ...gesture, dragging: true, last: at }
  return viewportStep({ ...state, gesture: next }, ctx.viewport, viewport)
}

/** The owning pointer moved: still a press inside the slop, else a drag drafted where it is. */
function dragTo(
  state: NoteEditState,
  ctx: NoteEditContext,
  gesture: NoteSingleGesture,
  pointer: NoteEditPointer,
): NoteEditStep {
  if (!gesture.dragging && !pastSlop(gesture, pointer)) return quietStep(state)
  const at = { x: pointer.x, y: pointer.y, alt: pointer.alt === true }
  if (gesture.intent.kind === 'pan') return panTo(state, ctx, gesture, at)
  const next = {
    ...gesture,
    dragging: true,
    last: at,
    frameTime: gesture.dragging ? gesture.frameTime : pointer.time,
    draft: draftNoteDrag(gesture, ctx, at, state.snap),
  }
  return dragSound({ ...state, gesture: next }, gesture, next, pointer.time)
}

/** Two fingers as a pinch reads them, and whether both are on the roll, whose y is a pitch. */
function fingersOf(touches: readonly NoteTouch[], pinch: NotePinchGesture) {
  const a = touches.find((touch) => touch.pointerId === pinch.pointerIds[0])
  const b = touches.find((touch) => touch.pointerId === pinch.pointerIds[1])
  if (a === undefined || b === undefined) return null
  return { a, b, rows: a.surface === 'roll' && b.surface === 'roll' }
}

function pinchTo(
  before: NoteEditState,
  after: NoteEditState,
  ctx: NoteEditContext,
  pinch: NotePinchGesture,
): NoteEditStep {
  const from = fingersOf(before.touches, pinch)
  const to = fingersOf(after.touches, pinch)
  if (from === null || to === null) return quietStep(after)
  const viewport = pinchNoteRoll(
    ctx.viewport,
    noteViewRange(ctx),
    from,
    to,
    from.rows,
    editTopRow(ctx),
  )
  return viewportStep(after, ctx.viewport, viewport)
}

function sameHover(a: NoteEditHover | null, b: NoteEditHover | null): boolean {
  return a === b || (a?.id === b?.id && a?.zone === b?.zone)
}

/** What is under a mouse or a pen that is not pressed. */
function hoverAt(
  state: NoteEditState,
  ctx: NoteEditContext,
  pointer: NoteEditPointer,
): NoteEditHover | null {
  const input = {
    viewport: ctx.viewport,
    selection: new Set(state.selection),
    x: pointer.x,
    y: pointer.y,
    pointerType: pointer.pointerType,
  }
  if (pointer.surface === 'roll') return pickEditNote(ctx, input)
  const id = pickLollipop({
    ...input,
    notes: playedNotes(ctx.sequence, ctx.window),
    height: ctx.velocityHeight,
  })
  return id === null ? null : { id, zone: 'velocity' }
}

function hovered(
  state: NoteEditState,
  ctx: NoteEditContext,
  pointer: NoteEditPointer,
): NoteEditState {
  if (pointer.pointerType === 'touch') return state
  const hover = hoverAt(state, ctx, pointer)
  return sameHover(hover, state.hover) ? state : { ...state, hover }
}

export function notePointerMove(
  state: NoteEditState,
  ctx: NoteEditContext,
  pointer: NoteEditPointer,
): NoteEditStep {
  const moved =
    pointer.pointerType === 'touch' ? movedTouch(state, pointer) : state
  const owner = moved.gesture
  if (owner === null || owner.kind === 'hold')
    return quietStep(hovered(moved, ctx, pointer))
  if (owner.kind === 'pinch')
    return owner.pointerIds.includes(pointer.pointerId)
      ? pinchTo(state, moved, ctx, owner)
      : quietStep(moved)
  return owner.anchor.pointerId === pointer.pointerId
    ? dragTo(moved, ctx, owner, pointer)
    : quietStep(moved)
}

/** The draft kept: its commit, if it changed anything, and its selection. */
function commitDraft(
  state: NoteEditState,
  gesture: NoteSingleGesture,
): NoteEditStep {
  const { sequence, selection } = gesture.draft
  const commit =
    sequence === null
      ? null
      : noteEditCommit(gesture.base, { sequence, selection })
  const next = { ...state, selection }
  return commit === null
    ? quietStep(next)
    : { state: next, effects: [{ type: 'commit', commit }], handled: false }
}

/** A tap in Draw on a kit's hit: the hit taken away, and out of the selection. */
function removeHit(
  state: NoteEditState,
  gesture: NoteSingleGesture,
  id: number,
): NoteEditStep {
  const selection = gesture.before.filter((each) => each !== id)
  const { sequence } = deleteStudioNotes(gesture.base, [id])
  const commit = noteEditCommit(gesture.base, { sequence, selection })
  const next = { ...state, selection }
  return commit === null
    ? quietStep(next)
    : { state: next, effects: [{ type: 'commit', commit }], handled: false }
}

/** A tap: the selection it leaves, the note drawn at its press kept, or a kit's hit taken away. */
function finishTap(
  state: NoteEditState,
  gesture: NoteSingleGesture,
): NoteEditStep {
  const idle = { ...state, gesture: null }
  const tap = gesture.tap
  switch (tap.kind) {
    case 'select':
      return quietStep({ ...idle, selection: tap.selection })
    case 'remove':
      return removeHit(idle, gesture, tap.id)
    default:
      return commitDraft(idle, gesture)
  }
}

/** The sound a drag ends on: a moved note's landing pitch if it is new, a velocity's note at its new velocity. */
function landSound(
  step: NoteEditStep,
  gesture: NoteSingleGesture,
  time: number,
): NoteEditStep {
  const intent = gesture.intent
  if (intent.kind !== 'move' && intent.kind !== 'velocity') return step
  const note = noteById(gesture.draft.sequence ?? gesture.base, intent.noteId)
  const quiet =
    intent.kind === 'move'
      ? step.state.sounded?.pitch === note?.pitch
      : step.effects.length === 0
  if (note === undefined || quiet) return step
  const sounded = sound(step.state, note, time, true)
  return also({ ...step, state: sounded.state }, sounded.effects)
}

function finishDrag(
  state: NoteEditState,
  gesture: NoteSingleGesture,
  time: number,
): NoteEditStep {
  const idle = { ...state, gesture: null }
  switch (gesture.intent.kind) {
    case 'pan':
    case 'none':
      return quietStep(idle)
    case 'marquee':
      return quietStep({ ...idle, selection: gesture.draft.selection })
    default:
      return landSound(commitDraft(idle, gesture), gesture, time)
  }
}

/** The pinch's fingers less one: two still pinch, one goes on panning, none rest. */
function afterPinch(
  state: NoteEditState,
  ctx: NoteEditContext,
  time: number,
): NoteEditState {
  const rest = state.touches
  if (rest.length >= 2)
    return {
      ...state,
      gesture: {
        kind: 'pinch',
        pointerIds: [rest[0].pointerId, rest[1].pointerId],
      },
    }
  if (rest.length === 1)
    return { ...state, gesture: panNoteGesture(state, ctx, rest[0], time) }
  return { ...state, gesture: null }
}

export function notePointerUp(
  state: NoteEditState,
  ctx: NoteEditContext,
  pointer: NoteEditPointer,
): NoteEditStep {
  const lifted =
    pointer.pointerType === 'touch'
      ? withoutTouch(state, pointer.pointerId)
      : state
  const owner = lifted.gesture
  if (owner?.kind === 'pinch')
    return quietStep(
      owner.pointerIds.includes(pointer.pointerId)
        ? afterPinch(lifted, ctx, pointer.time)
        : lifted,
    )
  const single = singleGesture(lifted)
  if (single?.anchor.pointerId !== pointer.pointerId) return quietStep(lifted)
  const moved = dragTo(lifted, ctx, single, pointer)
  const gesture = singleGesture(moved.state) ?? single
  const done = gesture.dragging
    ? finishDrag(moved.state, gesture, pointer.time)
    : finishTap(moved.state, gesture)
  return also({ ...done, effects: moved.effects }, done.effects)
}

export function notePointerCancel(
  state: NoteEditState,
  pointer: NoteEditPointer,
): NoteEditStep {
  const lifted =
    pointer.pointerType === 'touch'
      ? withoutTouch(state, pointer.pointerId)
      : state
  const owner = lifted.gesture
  if (owner?.kind === 'pinch')
    return quietStep(
      owner.pointerIds.includes(pointer.pointerId)
        ? { ...lifted, gesture: null }
        : lifted,
    )
  if (singleGesture(lifted)?.anchor.pointerId === pointer.pointerId)
    return quietStep(revertNoteGesture(lifted))
  return quietStep(lifted)
}

/** The drags a frame scrolls at an edge; a resize or a drawn note runs along time alone. */
const EDGE_DRAGS = new Set(['move', 'resize', 'draw', 'paint', 'marquee'])
const ALONG_TIME = new Set(['resize', 'draw'])

/** Whether a drag is under way that a frame scrolls at an edge: the host sends frames while this holds. */
export function noteEditWantsFrames(state: NoteEditState): boolean {
  const gesture = singleGesture(state)
  return (
    gesture !== null && gesture.dragging && EDGE_DRAGS.has(gesture.intent.kind)
  )
}

/** An animation frame: a drag held near an edge, or past it, scrolls the roll and moves its draft with it. */
export function noteFrame(
  state: NoteEditState,
  ctx: NoteEditContext,
  time: number,
): NoteEditStep {
  const gesture = singleGesture(state)
  if (gesture === null || !noteEditWantsFrames(state)) return quietStep(state)
  const seconds = Math.min(
    MAX_FRAME_SECONDS,
    Math.max(0, time - gesture.frameTime) / 1000,
  )
  const scroll = noteEdgeScroll(
    ctx.viewport,
    gesture.last,
    gesture.anchor,
    seconds,
    !ALONG_TIME.has(gesture.intent.kind),
  )
  const viewport = dragNoteRoll(
    ctx.viewport,
    noteViewRange(ctx),
    -scroll.x,
    -scroll.y,
    editTopRow(ctx),
  )
  const timed = { ...gesture, frameTime: time }
  if (sameRollViewport(viewport, ctx.viewport))
    return quietStep({ ...state, gesture: timed })
  const next = {
    ...timed,
    draft: draftNoteDrag(timed, { ...ctx, viewport }, gesture.last, state.snap),
  }
  const sounded = dragSound({ ...state, gesture: next }, gesture, next, time)
  return {
    state: sounded.state,
    effects: [{ type: 'viewport', viewport }, ...sounded.effects],
    handled: false,
  }
}
