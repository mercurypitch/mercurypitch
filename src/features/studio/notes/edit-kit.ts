// ============================================================
// Studio note editing on a kit — a drum lane's rows in the engine: hits picked by their squares, moved between rows rather than semitones, painted in Draw, and the roll kept on the kit
// ============================================================
//
// A kit's roll (roll-keyboard.ts) numbers its rows from the foot, the kick
// on row 0 and its first row, a cymbal, at the top; each row plays its key.
// The engine counts rows on a kit as it counts semitones on a piano: the
// viewport, a press's anchor and a drag's travel are rows, and these turn
// rows into keys and back. A hit sounds the same however long it is, so a
// kit has no grips and no resize: a press on a hit moves it. In Draw a tap
// on a hit takes it away, a tap on an empty cell puts one there a grid
// step long, and a drag paints a hit in every empty cell it crosses, all in
// one commit. Up and Down move a hit to the next row; an octave means
// nothing on a kit.
import type { RollRect, RollViewport } from '@/lib/roll-geometry'
import { noteRect, rowHeight, timeToX, xToTime } from '@/lib/roll-geometry'
import type { StudioNoteDraft, StudioNoteEdit, StudioNoteSet, } from '@/lib/studio/midi/notes'
import { addStudioNote, moveStudioNotes, studioNotesInRange, transposeStudioNotes, } from '@/lib/studio/midi/notes'
import type { StudioRollNote } from '@/lib/studio/midi/roll'
import type { StudioRollRows } from '@/lib/studio/midi/roll-keyboard'
import { studioRollRow, studioRollRowPitch, studioRollTopRow, } from '@/lib/studio/midi/roll-keyboard'
import { studioRollPitchAt, studioRollRowOf, studioWindowRollNotes, } from '@/lib/studio/midi/roll-rows'
import type { NotePick, NotePickInput } from './edit-pick'
import { NOTE_POINTER_PROFILES, pickRollNote } from './edit-pick'
import type { NoteGridLines } from './edit-snap'
import { snapFloor } from './edit-snap'
import type { NoteDraft, NoteEditContext, NoteSingleGesture, } from './edit-types'
import { kitHitSquare, kitHitTarget, kitNextStart, kitRowStarts, } from './kit-hit'

type RowsContext = Pick<NoteEditContext, 'rows'>
type KitRows = Extract<StudioRollRows, { kind: 'drums' }>

interface RollPoint {
  readonly x: number
  readonly y: number
}

/** The notes a range of the roll holds: ticks overlapped, rows from the lowest to the highest. */
export interface NoteRowRange {
  readonly startTick: number
  readonly endTick: number
  readonly lowRow: number
  readonly highRow: number
}

const PIANO: StudioRollRows = { kind: 'piano' }

/** The roll's rows: a piano's semitones unless the host says a kit's. */
export function editRows(ctx: RowsContext): StudioRollRows {
  return ctx.rows ?? PIANO
}

/** The kit's rows, when the roll is a kit's. */
function kitRows(ctx: RowsContext): KitRows | null {
  return ctx.rows?.kind === 'drums' ? ctx.rows : null
}

/** Whether the roll is a kit's. */
export function onKit(ctx: RowsContext): boolean {
  return kitRows(ctx) !== null
}

/** The highest row: the keyboard's top note, or a kit's first row. */
export function editTopRow(ctx: RowsContext): number {
  return studioRollTopRow(editRows(ctx))
}

/** The key the row at unrounded `position` plays (studioRollPitchAt): a piano's pitch, a kit row's key, or null past the kit. */
export function editKeyAt(ctx: RowsContext, position: number): number | null {
  const row = studioRollRowOf(position)
  const kit = kitRows(ctx)
  return kit === null ? row : studioRollRowPitch(kit, row)
}

/** The clip's hits on a kit's rows, and each row's starts, for those rows. */
interface KitNotes {
  readonly rows: KitRows
  readonly notes: readonly StudioRollNote[]
  readonly starts: ReadonlyMap<number, readonly number[]>
}

/** By the clip's notes on the keyboard. */
const KIT_NOTES = new WeakMap<readonly StudioRollNote[], KitNotes>()

function kitNotes(
  ctx: Pick<NoteEditContext, 'sequence' | 'window'>,
  kit: KitRows,
): KitNotes {
  const played = studioWindowRollNotes(ctx.sequence, ctx.window)
  const known = KIT_NOTES.get(played)
  if (known?.rows === kit) return known
  const notes = played.flatMap((note) => {
    const row = studioRollRow(kit, note.midi)
    return row === null ? [] : [{ ...note, midi: row }]
  })
  const starts = kitRowStarts(
    notes.map((note) => ({ row: note.midi, start: note.start })),
  )
  const found = { rows: kit, notes, starts }
  KIT_NOTES.set(played, found)
  return found
}

/** The notes the clip plays as the roll's rows hold them: on a kit, each on its key's row. */
export function editRollNotes(
  ctx: Pick<NoteEditContext, 'sequence' | 'window' | 'rows'>,
): readonly StudioRollNote[] {
  const kit = kitRows(ctx)
  return kit === null
    ? studioWindowRollNotes(ctx.sequence, ctx.window)
    : kitNotes(ctx, kit).notes
}

/** How far a press is from `rect`, 0 inside it. */
function distanceTo(rect: RollRect, x: number, y: number): number {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.width))
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.height))
  return Math.hypot(dx, dy)
}

/** A hit's square and where a press takes it, short of the next hit on its row (kit-hit.ts). */
function kitShapes(
  note: StudioRollNote,
  viewport: RollViewport,
  starts: ReadonlyMap<number, readonly number[]>,
): { readonly square: RollRect; readonly target: RollRect } {
  const row = noteRect(note, viewport)
  const next = kitNextStart(starts, note.midi, note.start)
  const square = kitHitSquare(
    row.x,
    row.y,
    row.height,
    next === Infinity ? Infinity : timeToX(next, viewport),
  )
  return { square, target: kitHitTarget(square, row.y, row.height) }
}

/** How a hit ranks for a press, lower first: inside its target by how near its square's middle is, then within reach by how far out; past reach, never. */
function hitRank(
  note: StudioRollNote,
  input: NotePickInput,
  starts: ReadonlyMap<number, readonly number[]>,
): number {
  const { square, target } = kitShapes(note, input.viewport, starts)
  const outside = distanceTo(target, input.x, input.y)
  if (outside > NOTE_POINTER_PROFILES[input.pointerType].reach) return Infinity
  if (outside > 0) return 1e6 + outside
  return Math.hypot(
    input.x - (square.x + square.width / 2),
    input.y - (square.y + square.height / 2),
  )
}

/** The hit a press takes: one whose target holds it, the nearest square winning, else the nearest within the pointer's reach; a later hit wins a tie, as it draws on top. Never a resize. `starts` are each row's hits' starts (kitRowStarts), which bound a square. */
export function pickKitHit(
  input: NotePickInput,
  starts: ReadonlyMap<number, readonly number[]>,
): NotePick | null {
  let found: NotePick | null = null
  let best = Infinity
  for (const note of input.notes) {
    const rank = hitRank(note, input, starts)
    if (rank === Infinity || rank > best) continue
    best = rank
    found = { id: note.id, zone: 'body' }
  }
  return found
}

/** A note the clip plays and where a press takes it on the roll, in the grid's pixels. */
export interface NoteTarget {
  readonly id: number
  readonly rect: RollRect
}

/** Where a press takes each note the clip plays: a piano's note's row-tall box (noteRect), a kit's hit's target about its square. */
export function editNoteTargets(
  ctx: Pick<NoteEditContext, 'sequence' | 'window' | 'rows' | 'viewport'>,
): NoteTarget[] {
  const kit = kitRows(ctx)
  if (kit === null)
    return editRollNotes(ctx).map((note) => ({
      id: note.id,
      rect: noteRect(note, ctx.viewport),
    }))
  const { notes, starts } = kitNotes(ctx, kit)
  return notes.map((note) => ({
    id: note.id,
    rect: kitShapes(note, ctx.viewport, starts).target,
  }))
}

/** What a press takes on the roll: a note, its end or a grip on a piano, a hit on a kit. */
export function pickEditNote(
  ctx: Pick<NoteEditContext, 'sequence' | 'window' | 'rows' | 'viewport'>,
  input: Omit<NotePickInput, 'notes' | 'viewport'>,
): NotePick | null {
  const kit = kitRows(ctx)
  if (kit === null)
    return pickRollNote({
      ...input,
      notes: editRollNotes(ctx),
      viewport: ctx.viewport,
    })
  const { notes, starts } = kitNotes(ctx, kit)
  return pickKitHit({ ...input, notes, viewport: ctx.viewport }, starts)
}

/** Hits moved `dTick` along time inside the window and `dRows` up the kit, as far as every one stays on it. */
function moveKitHits<S extends StudioNoteSet>(
  sequence: S,
  ids: readonly number[],
  move: { readonly dTick: number; readonly dRows: number },
  kit: KitRows,
  window: NoteEditContext['window'],
): StudioNoteEdit<S> {
  const timed = moveStudioNotes(sequence, ids, move.dTick, 0, window)
  const chosen = new Set(timed.selection)
  const rows = timed.sequence.notes.flatMap((note) => {
    const row = chosen.has(note.id) ? studioRollRow(kit, note.pitch) : null
    return row === null ? [] : [row]
  })
  if (move.dRows === 0 || rows.length === 0) return timed
  const step = Math.max(
    -Math.min(...rows),
    Math.min(studioRollTopRow(kit) - Math.max(...rows), Math.round(move.dRows)),
  )
  if (step === 0) return timed
  const notes = timed.sequence.notes.map((note) => {
    const row = chosen.has(note.id) ? studioRollRow(kit, note.pitch) : null
    const key = row === null ? null : studioRollRowPitch(kit, row + step)
    return key === null ? note : { ...note, pitch: key }
  })
  return { sequence: { ...timed.sequence, notes }, selection: timed.selection }
}

/** The selection moved `dTick` along time and `dRows` rows: semitones on a piano, a kit's rows on a kit. */
export function moveEditNotes<S extends StudioNoteSet>(
  ctx: Pick<NoteEditContext, 'rows' | 'window'>,
  sequence: S,
  ids: readonly number[],
  dTick: number,
  dRows: number,
): StudioNoteEdit<S> {
  const kit = kitRows(ctx)
  return kit === null
    ? moveStudioNotes(sequence, ids, dTick, dRows, ctx.window)
    : moveKitHits(sequence, ids, { dTick, dRows }, kit, ctx.window)
}

/** Up or down a semitone or an octave on a piano; a row up or down on a kit, where an octave moves nothing. */
export function transposeEditNotes<S extends StudioNoteSet>(
  ctx: Pick<NoteEditContext, 'rows' | 'window'>,
  sequence: S,
  ids: readonly number[],
  semitones: number,
): StudioNoteEdit<S> {
  if (!onKit(ctx)) return transposeStudioNotes(sequence, ids, semitones)
  if (Math.abs(semitones) !== 1) return { sequence, selection: [...ids] }
  return moveEditNotes(ctx, sequence, ids, 0, semitones)
}

/** The notes in a range of the roll: by pitch on a piano, by the row its key has on a kit. */
export function editNotesInRange(
  sequence: StudioNoteSet,
  ctx: RowsContext,
  range: NoteRowRange,
): number[] {
  const kit = kitRows(ctx)
  if (kit === null)
    return studioNotesInRange(sequence, {
      startTick: range.startTick,
      endTick: range.endTick,
      lowPitch: range.lowRow,
      highPitch: range.highRow,
    })
  return sequence.notes
    .filter((note) => {
      const row = studioRollRow(kit, note.pitch) ?? -1
      return (
        row >= range.lowRow &&
        row <= range.highRow &&
        note.startTick < range.endTick &&
        note.startTick + note.lengthTicks > range.startTick
      )
    })
    .map((note) => note.id)
}

/** The points every `spacing` pixels from `from`, left out, to `to`. */
function pointsAlong(
  from: RollPoint,
  to: RollPoint,
  spacing: number,
): RollPoint[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const count = Math.max(1, Math.ceil(length / Math.max(1, spacing)))
  return Array.from({ length: count }, (_, index) => {
    const part = (index + 1) / count
    return {
      x: from.x + (to.x - from.x) * part,
      y: from.y + (to.y - from.y) * part,
    }
  })
}

/** The cell under `point`: its row's key and its step's first tick; null off the rows or the clip. */
function paintCell(
  ctx: NoteEditContext,
  point: RollPoint,
  grid: NoteGridLines,
): { readonly key: number; readonly tick: number } | null {
  const viewport = ctx.viewport
  if (point.y < 0 || point.y > viewport.height) return null
  const key = editKeyAt(ctx, studioRollPitchAt(point.y, viewport))
  const tick = snapFloor(xToTime(point.x, viewport), grid)
  if (key === null || tick < ctx.window.startTick) return null
  return tick < ctx.window.endTick ? { key, tick } : null
}

/** Whether a hit of `key` starts in the step from `tick` already. */
function occupied(
  sequence: StudioNoteSet,
  cell: { readonly key: number; readonly tick: number },
  grid: NoteGridLines,
): boolean {
  return sequence.notes.some(
    (note) =>
      note.pitch === cell.key &&
      note.startTick >= cell.tick &&
      note.startTick < cell.tick + grid.ticks,
  )
}

/**
 * A paint's draft: the hits it has put down, and one more in each empty
 * cell from where the pointer was to `at`, sampled every half a step or a
 * row, each a step long at `hit`'s velocity.
 */
export function draftPaint(
  gesture: NoteSingleGesture,
  hit: StudioNoteDraft,
  ctx: NoteEditContext,
  at: RollPoint,
  grid: NoteGridLines,
): NoteDraft {
  const viewport = ctx.viewport
  const span = Math.max(1, viewport.end - viewport.start)
  const stepWidth = (grid.ticks / span) * viewport.width
  const spacing = Math.min(rowHeight(viewport), stepWidth) / 2
  let sequence = gesture.draft.sequence ?? gesture.base
  const added: number[] = []
  for (const point of pointsAlong(gesture.last, at, spacing)) {
    const cell = paintCell(ctx, point, grid)
    // A full sequence takes no more: addStudioNote answers null.
    const edit =
      cell === null || occupied(sequence, cell, grid)
        ? null
        : addStudioNote(sequence, {
            ...hit,
            pitch: cell.key,
            startTick: cell.tick,
            lengthTicks: Math.min(grid.ticks, ctx.window.endTick - cell.tick),
          })
    if (edit !== null) {
      sequence = edit.sequence
      added.push(...edit.selection)
    }
  }
  if (added.length === 0) return gesture.draft
  return {
    ...gesture.draft,
    sequence,
    selection: [...gesture.draft.selection, ...added],
  }
}
