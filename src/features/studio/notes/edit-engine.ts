// ============================================================
// Studio note editing engine — the note editor's state machine: pointers, fingers, the wheel, keys and toolbar commands in; a new state and its effects out
// ============================================================
//
// Pure and framework-free, so every gesture can be pinned as a script of
// inputs (edit-*.test.ts). The host keeps the state, passes each input with
// the context it happened in, carries out the effects, and draws
// noteEditView. A finished gesture, a key press (held arrows: from the
// first press to the last one let go) or a toolbar command is one commit,
// `{ notes, nextNoteId, selection }`, for one `set-sequence-notes`: one undo
// step (decision 8). One that changed nothing commits nothing.
//
// The selection lives here, by note id. Each input first checks it against
// the notes the context holds, so a commit, an undo or a redo keeps the
// notes that still exist and the clip still plays; and a gesture whose
// notes changed under it (an undo pressed mid-drag) is undone. The host
// passes the same sequence object until its notes change, and sends `sync`
// when they do, so the check costs nothing between edits.
//
// Pointer gestures are edit-pointer.ts's; what a press starts is
// edit-press.ts's, a drag's draft edit-drag.ts's, and commands and keys are
// edit-commands.ts's and edit-keys.ts's.
import type { StudioNoteClipboard } from '@/lib/studio/midi/notes'
import { studioNoteVelocity } from '@/lib/studio/midi/notes'
import { playedIds } from './edit-changes'
import type { NoteEditing } from './edit-commands'
import { runNoteCommand } from './edit-commands'
import { afterHold, finishHold, holdArrow, holdGesture, isNoteArrowCommand, releaseArrow, } from './edit-hold'
import { noteKeyAction } from './edit-keys'
import { editTopRow } from './edit-kit'
import { noteFrame, notePointerCancel, notePointerDown, notePointerMove, notePointerUp, quietStep, revertNoteGesture, singleGesture, } from './edit-pointer'
import type { NoteSnap } from './edit-snap'
import { DEFAULT_NOTE_SNAP } from './edit-snap'
import type { NoteEditCommand, NoteEditContext, NoteEditEffect, NoteEditInput, NoteEditKey, NoteEditPointer, NoteEditState, NoteEditStep, NoteEditTool, NoteEditWheel, } from './edit-types'
import { noteViewRange, sameRollViewport, wheelNoteRoll } from './edit-viewport'

export { noteEditWantsFrames } from './edit-pointer'

/** A drawn note's velocity until a note is pressed: 100 of 127. */
export const DEFAULT_DRAW_VELOCITY = studioNoteVelocity(100 / 127)

/** What an editor opens with; a host that keeps a clipboard across clips passes it in. */
export interface NoteEditInit {
  readonly tool?: NoteEditTool
  readonly snap?: NoteSnap
  readonly selection?: readonly number[]
  readonly clipboard?: StudioNoteClipboard | null
  readonly drawVelocity?: number
}

export function createNoteEditState(init: NoteEditInit = {}): NoteEditState {
  return {
    tool: init.tool ?? 'select',
    snap: init.snap ?? DEFAULT_NOTE_SNAP,
    selection: init.selection ?? [],
    clipboard: init.clipboard ?? null,
    gesture: null,
    touches: [],
    hover: null,
    drawVelocity: init.drawVelocity ?? DEFAULT_DRAW_VELOCITY,
    sounded: null,
    checked: null,
  }
}

/** The state checked against the context: a gesture whose notes changed undone, and the selection kept to notes the clip plays. */
function checkedAgainst(
  state: NoteEditState,
  ctx: NoteEditContext,
): NoteEditState {
  const known = state.checked
  if (
    known?.sequence === ctx.sequence &&
    known.startTick === ctx.window.startTick &&
    known.endTick === ctx.window.endTick
  )
    return state
  const gesture = state.gesture
  const current =
    gesture !== null &&
    gesture.kind !== 'pinch' &&
    gesture.base !== ctx.sequence
      ? revertNoteGesture(state)
      : state
  return {
    ...current,
    selection: playedIds(current.selection, ctx.sequence, ctx.window),
    checked: {
      sequence: ctx.sequence,
      startTick: ctx.window.startTick,
      endTick: ctx.window.endTick,
    },
  }
}

/** Escape: a gesture or a held move undone first, then the selection cleared, and only then the editor closed. */
function escape(state: NoteEditState): NoteEditStep {
  if (singleGesture(state) !== null || holdGesture(state) !== null)
    return quietStep(revertNoteGesture(state), true)
  if (state.selection.length > 0)
    return quietStep({ ...state, selection: [] }, true)
  return { state, effects: [{ type: 'close' }], handled: true }
}

function commandEffects(result: ReturnType<typeof runNoteCommand>) {
  const effects: NoteEditEffect[] = []
  if (result.commit != null)
    effects.push({ type: 'commit', commit: result.commit })
  if (result.notice !== undefined)
    effects.push({ type: 'notice', message: result.notice })
  return effects
}

function editing(
  state: NoteEditState,
  ctx: NoteEditContext,
  command: NoteEditing,
): NoteEditStep {
  const result = runNoteCommand(state, ctx, command)
  return {
    state: {
      ...state,
      selection: result.selection ?? state.selection,
      clipboard: result.clipboard ?? state.clipboard,
    },
    effects: commandEffects(result),
    handled: result.acted,
  }
}

/** A command from the toolbar or a key: a pointer's gesture under way is undone first, and a held move committed first. */
function commandStep(
  state: NoteEditState,
  ctx: NoteEditContext,
  command: NoteEditCommand,
): NoteEditStep {
  const held = afterHold(revertPointerGesture(state), ctx)
  const idle = held.state
  if (command.type === 'tool')
    return {
      state: { ...idle, tool: command.tool },
      effects: held.effects,
      handled: true,
    }
  if (command.type === 'snap')
    return {
      state: { ...idle, snap: command.snap },
      effects: held.effects,
      handled: true,
    }
  const step = editing(idle, held.ctx, command)
  return { ...step, effects: [...held.effects, ...step.effects] }
}

/** A pointer's gesture undone; held arrows are left to commit. */
function revertPointerGesture(state: NoteEditState): NoteEditState {
  return singleGesture(state) === null ? state : revertNoteGesture(state)
}

/** A key: an arrow moves a held draft; others wait while a pointer's gesture is under way, except Escape, which undoes it. */
function keyStep(
  state: NoteEditState,
  ctx: NoteEditContext,
  key: NoteEditKey,
): NoteEditStep {
  const action = noteKeyAction(key)
  if (action.kind === 'pass') return quietStep(state)
  if (action.kind === 'escape') return escape(state)
  if (state.gesture !== null && state.gesture.kind !== 'hold')
    return quietStep(state)
  if (isNoteArrowCommand(action.command)) {
    const step = holdArrow(state, ctx, action.command, key.key)
    return { ...step, handled: step.handled || action.always }
  }
  if (key.repeat === true && !action.repeats) return quietStep(state, true)
  const step = commandStep(state, ctx, action.command)
  return { ...step, handled: step.handled || action.always }
}

/** A press while arrows are held commits their move and starts nothing. */
function pressStep(
  state: NoteEditState,
  ctx: NoteEditContext,
  input: NoteEditPointer,
): NoteEditStep {
  const hold = holdGesture(state)
  return hold === null
    ? notePointerDown(state, ctx, input)
    : finishHold(state, hold)
}

function wheelStep(
  state: NoteEditState,
  ctx: NoteEditContext,
  wheel: NoteEditWheel,
): NoteEditStep {
  const viewport = wheelNoteRoll(
    ctx.viewport,
    noteViewRange(ctx),
    wheel,
    editTopRow(ctx),
  )
  const effects: NoteEditEffect[] = sameRollViewport(viewport, ctx.viewport)
    ? []
    : [{ type: 'viewport', viewport }]
  return { state, effects, handled: true }
}

/** The mouse gone from the roll: no note under it. */
function left(state: NoteEditState): NoteEditState {
  return state.hover === null ? state : { ...state, hover: null }
}

/** Every gesture let go, undone, and every finger forgotten. */
function abort(state: NoteEditState): NoteEditState {
  return {
    ...revertNoteGesture(state),
    gesture: null,
    touches: [],
    hover: null,
  }
}

/** One input, with the context it happened in. */
export function stepNoteEditor(
  state: NoteEditState,
  ctx: NoteEditContext,
  input: NoteEditInput,
): NoteEditStep {
  const ready = checkedAgainst(state, ctx)
  switch (input.type) {
    case 'down':
      return pressStep(ready, ctx, input)
    case 'move':
      return notePointerMove(ready, ctx, input)
    case 'up':
      return notePointerUp(ready, ctx, input)
    case 'cancel':
      return notePointerCancel(ready, input)
    case 'frame':
      return noteFrame(ready, ctx, input.time)
    case 'wheel':
      return wheelStep(ready, ctx, input)
    case 'key':
      return keyStep(ready, ctx, input)
    case 'keyup':
      return releaseArrow(ready, input.key)
    case 'command':
      return commandStep(ready, ctx, input.command)
    case 'leave':
      return quietStep(left(ready))
    case 'abort':
      return quietStep(abort(ready))
    case 'sync':
      return quietStep(ready)
  }
}
