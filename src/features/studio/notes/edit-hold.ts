// ============================================================
// Studio note held keys — arrows held down move the selection as one edit: each press and each of the browser's repeats moves a draft, and letting go of the last arrow commits it
// ============================================================
//
// As the Studio's clip nudge does (editor/keyboard-nudge.ts): a held arrow
// repeats into a draft the roll draws, and letting go of the last arrow
// commits the whole move as one undo step. Two arrows held together, up and
// right, make one edit too. Escape, a lost focus or notes changed under it
// put the notes back (edit-engine.ts); any other key, a toolbar command or a
// press commits the move first.
import type { StudioNoteSet } from '@/lib/studio/midi/notes'
import { noteEditCommit } from './edit-changes'
import { runNoteCommand } from './edit-commands'
import type { NoteDraft, NoteEditCommand, NoteEditContext, NoteEditEffect, NoteEditState, NoteEditStep, NoteHoldGesture, } from './edit-types'

/** The moves an arrow makes: a nudge in time, or a transpose. */
export type NoteArrowCommand = Extract<
  NoteEditCommand,
  { type: 'nudge' } | { type: 'transpose' }
>

export function isNoteArrowCommand(
  command: NoteEditCommand,
): command is NoteArrowCommand {
  return command.type === 'nudge' || command.type === 'transpose'
}

/** The arrows held now, if any are. */
export function holdGesture(state: NoteEditState): NoteHoldGesture | null {
  return state.gesture?.kind === 'hold' ? state.gesture : null
}

/** An arrow down, or the browser's repeat of it: the move drafted on top of the moves before it. */
export function holdArrow(
  state: NoteEditState,
  ctx: NoteEditContext,
  command: NoteArrowCommand,
  key: string,
): NoteEditStep {
  const hold = holdGesture(state)
  const base = hold?.base ?? ctx.sequence
  const current = hold?.draft.sequence ?? base
  const result = runNoteCommand(state, { ...ctx, sequence: current }, command)
  if (!result.acted) return { state, effects: [], handled: false }
  const moved: StudioNoteSet =
    result.commit == null
      ? current
      : { notes: result.commit.notes, nextNoteId: result.commit.nextNoteId }
  const draft: NoteDraft = {
    sequence: moved === base ? null : moved,
    selection: result.selection ?? state.selection,
    marquee: null,
    readout: null,
  }
  const held =
    hold?.held.includes(key) === true ? hold.held : [...(hold?.held ?? []), key]
  return {
    state: {
      ...state,
      gesture: {
        kind: 'hold',
        base,
        before: hold?.before ?? state.selection,
        held,
        draft,
      },
    },
    effects: [],
    handled: true,
  }
}

/** The held move committed, as one edit, or nothing when it came back where it started. */
export function finishHold(
  state: NoteEditState,
  hold: NoteHoldGesture,
): NoteEditStep {
  const { sequence, selection } = hold.draft
  const commit =
    sequence === null
      ? null
      : noteEditCommit(hold.base, { sequence, selection })
  const next = { ...state, gesture: null, selection }
  const effects: NoteEditEffect[] =
    commit === null ? [] : [{ type: 'commit', commit }]
  return { state: next, effects, handled: true }
}

/** An arrow let go: the held move commits when it was the last one down. */
export function releaseArrow(state: NoteEditState, key: string): NoteEditStep {
  const hold = holdGesture(state)
  if (hold?.held.includes(key) !== true)
    return { state, effects: [], handled: false }
  const held = hold.held.filter((each) => each !== key)
  if (held.length > 0)
    return {
      state: { ...state, gesture: { ...hold, held } },
      effects: [],
      handled: true,
    }
  return finishHold(state, hold)
}

/**
 * The state with a held move committed before another edit, and the
 * context that edit reads: the notes as the commit leaves them, as the host
 * will have them once it carries the commit out.
 */
export function afterHold(
  state: NoteEditState,
  ctx: NoteEditContext,
): {
  state: NoteEditState
  ctx: NoteEditContext
  effects: readonly NoteEditEffect[]
} {
  const hold = holdGesture(state)
  if (hold === null) return { state, ctx, effects: [] }
  const finished = finishHold(state, hold)
  const commit = finished.effects.find((effect) => effect.type === 'commit')
  const sequence =
    commit?.type === 'commit'
      ? { notes: commit.commit.notes, nextNoteId: commit.commit.nextNoteId }
      : ctx.sequence
  return {
    state: finished.state,
    ctx: { ...ctx, sequence },
    effects: finished.effects,
  }
}
