// ============================================================
// Studio note commands — the note editor's edits from its toolbar and its keys, one commit each: delete, duplicate, cut, paste, quantize, transpose, nudge and velocity, with the selection and the clipboard
// ============================================================
//
// Quantize takes the selection, or every note the clip plays when none is
// selected, as the mockup's button does; the other edits take the
// selection and do nothing without one. A paste goes to the playhead when
// it is over the clip, else right after the selection, else to the clip's
// start. A duplicate or a paste whose notes would start past the clip's end
// is refused, with a reason for the host to say: notes there could be
// neither heard nor picked (decision 9).
import type { StudioNoteClipboard, StudioNoteEdit, StudioNoteSet, } from '@/lib/studio/midi/notes'
import { copyStudioNotes, deleteStudioNotes, duplicateStudioNotes, moveStudioNotes, pasteStudioNotes, quantizeStudioNotes, studioNotesInWindow, studioSelectionBounds, transposeStudioNotes, } from '@/lib/studio/midi/notes'
import { STUDIO_PPQ } from '@/lib/studio/model/types'
import { STUDIO_BEATS_PER_BAR } from '@/lib/studio/record/take-timing'
import { inNoteWindow, newNotesInWindow, noteEditCommit } from './edit-changes'
import { NOTE_FULL_NOTICE } from './edit-press'
import { noteSnapGrid, noteStepGrid, snapNearest } from './edit-snap'
import type { NoteEditCommand, NoteEditCommit, NoteEditContext, NoteEditState, } from './edit-types'
import { stepStudioNoteVelocities } from './edit-velocity'

export const NOTE_NO_ROOM_AFTER = 'No room in this clip after the selection.'
export const NOTE_NO_ROOM_PASTE = 'No room in this clip for the copied notes.'

/** The commands that edit notes, the selection or the clipboard; the tool and the grid are the engine's. */
export type NoteEditing = Exclude<
  NoteEditCommand,
  { type: 'tool' } | { type: 'snap' }
>

/** What a command did: whether it acted at all, and what it leaves. */
export interface NoteCommandResult {
  readonly acted: boolean
  readonly selection?: readonly number[]
  readonly clipboard?: StudioNoteClipboard
  readonly commit?: NoteEditCommit | null
  readonly notice?: string
}

type CommandState = Pick<NoteEditState, 'selection' | 'snap' | 'clipboard'>

const NOTHING: NoteCommandResult = { acted: false }

function committed(
  ctx: NoteEditContext,
  edit: StudioNoteEdit<StudioNoteSet>,
): NoteCommandResult {
  return {
    acted: true,
    commit: noteEditCommit(ctx.sequence, edit),
    selection: edit.selection,
  }
}

/** `run` on the selection, or nothing without one. */
function onSelection(
  state: CommandState,
  run: (ids: readonly number[]) => NoteCommandResult,
): NoteCommandResult {
  return state.selection.length === 0 ? NOTHING : run(state.selection)
}

/** An edit adding notes, refused with `noRoom` when one would start outside the clip's window. */
function added(
  ctx: NoteEditContext,
  edit: StudioNoteEdit<StudioNoteSet> | null,
  noRoom: string,
): NoteCommandResult {
  if (edit === null) return { acted: true, notice: NOTE_FULL_NOTICE }
  if (!newNotesInWindow(ctx.sequence, edit, ctx.window))
    return { acted: true, notice: noRoom }
  return committed(ctx, edit)
}

function cut(ctx: NoteEditContext, ids: readonly number[]): NoteCommandResult {
  return {
    ...committed(ctx, deleteStudioNotes(ctx.sequence, ids)),
    clipboard: copyStudioNotes(ctx.sequence, ids),
  }
}

/** Where a paste goes: the playhead on the grid when it is over the clip, else right after the selection, else the clip's start. */
function pasteTick(state: CommandState, ctx: NoteEditContext): number {
  const window = ctx.window
  const playhead = ctx.playheadTick
  if (playhead === null || !inNoteWindow(playhead, window))
    return (
      studioSelectionBounds(ctx.sequence, state.selection)?.endTick ??
      window.startTick
    )
  const grid = noteSnapGrid(state.snap, ctx.gridOffsetTick ?? 0)
  const tick =
    grid === null ? Math.round(playhead) : snapNearest(playhead, grid)
  return Math.min(window.endTick - 1, Math.max(window.startTick, tick))
}

function paste(state: CommandState, ctx: NoteEditContext): NoteCommandResult {
  const clipboard = state.clipboard
  if (clipboard === null || clipboard.notes.length === 0) return NOTHING
  return added(
    ctx,
    pasteStudioNotes(ctx.sequence, clipboard, pasteTick(state, ctx)),
    NOTE_NO_ROOM_PASTE,
  )
}

function quantize(
  state: CommandState,
  ctx: NoteEditContext,
): NoteCommandResult {
  const ids =
    state.selection.length > 0
      ? state.selection
      : studioNotesInWindow(ctx.sequence, ctx.window)
  if (ids.length === 0) return NOTHING
  const grid = noteStepGrid(state.snap, ctx.gridOffsetTick ?? 0)
  const edit = quantizeStudioNotes(ctx.sequence, ids, grid, ctx.window)
  return {
    acted: true,
    commit: noteEditCommit(ctx.sequence, edit),
    selection: state.selection,
  }
}

/** How far a nudge moves: a bar, a pixel's worth of ticks, or a grid step (a pixel's worth with snapping off). */
function nudgeTicks(
  state: CommandState,
  ctx: NoteEditContext,
  step: Extract<NoteEditCommand, { type: 'nudge' }>['step'],
): number {
  if (step === 'bar') return STUDIO_PPQ * STUDIO_BEATS_PER_BAR
  const viewport = ctx.viewport
  const pixel = Math.max(
    1,
    Math.round((viewport.end - viewport.start) / Math.max(1, viewport.width)),
  )
  if (step === 'fine') return pixel
  return noteSnapGrid(state.snap)?.ticks ?? pixel
}

/** A command, worked out against the notes as they are. */
export function runNoteCommand(
  state: CommandState,
  ctx: NoteEditContext,
  command: NoteEditing,
): NoteCommandResult {
  const notes = ctx.sequence
  switch (command.type) {
    case 'select-all':
      return { acted: true, selection: studioNotesInWindow(notes, ctx.window) }
    case 'clear-selection':
      return { acted: state.selection.length > 0, selection: [] }
    case 'delete':
      return onSelection(state, (ids) =>
        committed(ctx, deleteStudioNotes(notes, ids)),
      )
    case 'duplicate':
      return onSelection(state, (ids) =>
        added(ctx, duplicateStudioNotes(notes, ids), NOTE_NO_ROOM_AFTER),
      )
    case 'copy':
      return onSelection(state, (ids) => ({
        acted: true,
        clipboard: copyStudioNotes(notes, ids),
      }))
    case 'cut':
      return onSelection(state, (ids) => cut(ctx, ids))
    case 'paste':
      return paste(state, ctx)
    case 'quantize':
      return quantize(state, ctx)
    case 'transpose':
      return onSelection(state, (ids) =>
        committed(ctx, transposeStudioNotes(notes, ids, command.semitones)),
      )
    case 'nudge': {
      const ticks = command.direction * nudgeTicks(state, ctx, command.step)
      return onSelection(state, (ids) =>
        committed(ctx, moveStudioNotes(notes, ids, ticks, 0, ctx.window)),
      )
    }
    case 'velocity':
      return onSelection(state, (ids) =>
        committed(ctx, stepStudioNoteVelocities(notes, ids, command.steps)),
      )
  }
}
