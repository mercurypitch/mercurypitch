// ============================================================
// Studio note keys — what a key does in the note editor: arrows move the selection, Delete deletes, Ctrl or Cmd with D, A, C, X and V duplicate, select all, copy, cut and paste, and Escape lets go
// ============================================================
//
// Up and Down move the selection a semitone, an octave with Shift; Left and
// Right a grid step, a bar with Shift, and a pixel's worth with Alt, which
// is also the browser's Back and Forward and so stays the editor's even
// with nothing selected. Ctrl or Cmd with A and D stay the editor's too:
// the browser would select the page or add a bookmark.
//
// Undo and redo are not the editor's. Ctrl or Cmd with Z, with Shift too,
// and Ctrl+Y pass on to the Studio, whose one history holds the editor's
// commits (decision 8). Every key the editor does not use passes on.
//
// A held arrow repeats its move, a commit each, as in a DAW; a held Delete
// or Ctrl+D acts once.
import type { NoteEditCommand, NoteEditKey } from './edit-types'

export type NoteKeyAction =
  | {
      readonly kind: 'command'
      readonly command: NoteEditCommand
      /** Whether the browser's repeat of the held key acts again. */
      readonly repeats: boolean
      /** Whether the editor keeps the key though the command did nothing. */
      readonly always: boolean
    }
  | { readonly kind: 'escape' }
  | { readonly kind: 'pass' }

const PASS: NoteKeyAction = { kind: 'pass' }

/** Ctrl or Cmd with these letters. */
const MOD_COMMANDS = new Map<string, NoteEditCommand>([
  ['a', { type: 'select-all' }],
  ['c', { type: 'copy' }],
  ['x', { type: 'cut' }],
  ['v', { type: 'paste' }],
  ['d', { type: 'duplicate' }],
])
/** Letters the browser acts on whatever is selected. */
const ALWAYS_KEPT = new Set(['a', 'd'])

const PITCH_KEYS = new Map([
  ['ArrowUp', 1],
  ['ArrowDown', -1],
])
const TIME_KEYS = new Map<string, -1 | 1>([
  ['ArrowLeft', -1],
  ['ArrowRight', 1],
])

function command(
  editing: NoteEditCommand,
  repeats: boolean,
  always = false,
): NoteKeyAction {
  return { kind: 'command', command: editing, repeats, always }
}

function modKey(key: NoteEditKey): NoteKeyAction {
  if (key.shift === true || key.alt === true) return PASS
  const letter = key.key.toLowerCase()
  const found = MOD_COMMANDS.get(letter)
  return found === undefined
    ? PASS
    : command(found, false, ALWAYS_KEPT.has(letter))
}

function timeKey(key: NoteEditKey, direction: -1 | 1): NoteKeyAction {
  if (key.alt === true)
    return command({ type: 'nudge', direction, step: 'fine' }, true, true)
  const step = key.shift === true ? 'bar' : 'grid'
  return command({ type: 'nudge', direction, step }, true)
}

function plainKey(key: NoteEditKey): NoteKeyAction {
  const semitones = PITCH_KEYS.get(key.key)
  if (semitones !== undefined && key.alt !== true)
    return command(
      {
        type: 'transpose',
        semitones: key.shift === true ? semitones * 12 : semitones,
      },
      true,
    )
  const direction = TIME_KEYS.get(key.key)
  if (direction !== undefined) return timeKey(key, direction)
  const deletes = key.key === 'Delete' || key.key === 'Backspace'
  if (!deletes || key.shift === true || key.alt === true) return PASS
  return command({ type: 'delete' }, false)
}

/** What a key going down does while the editor has the focus. */
export function noteKeyAction(key: NoteEditKey): NoteKeyAction {
  if (key.key === 'Escape') return { kind: 'escape' }
  return key.mod === true ? modKey(key) : plainKey(key)
}
