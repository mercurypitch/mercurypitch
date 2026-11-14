// ============================================================
// Studio note velocity — the note editor's velocity lane: where each note's lollipop stands, which one a press takes, and velocities moved in the 1 to 127 a musician reads
// ============================================================
//
// A sequence keeps velocity from 0 to 1 (decision 4); the lane shows and
// moves it in MIDI's 127 steps, so a value read while dragging is the value
// kept. A drag moves the pressed note's velocity, and every selected note's
// by the same steps when the pressed note is selected; each note stops at 1
// and at 127 on its own.
//
// Where a lollipop stands is velocity-lane.ts's, which the roll draws with
// too.
import type { RollViewport } from '@/lib/roll-geometry'
import type { StudioNoteEdit, StudioNoteSet } from '@/lib/studio/midi/notes'
import { studioNoteVelocity } from '@/lib/studio/midi/notes'
import type { StudioNote } from '@/lib/studio/model/types'
import { NOTE_POINTER_PROFILES } from './edit-pick'
import type { NotePointerType } from './edit-types'
import { VELOCITY_CAP_RADIUS, velocityLaneX, velocityLaneY, } from './velocity-lane'

/** A velocity as the lane reads it: 1 to 127. */
export function noteVelocityValue(velocity: number): number {
  return Math.min(127, Math.max(1, Math.round(velocity * 127)))
}

/** `velocity` moved `steps` of 127, kept from 1 to 127 and as a sequence keeps it. */
function steppedVelocity(velocity: number, steps: number): number {
  const value = Math.min(127, Math.max(1, noteVelocityValue(velocity) + steps))
  return studioNoteVelocity(value / 127)
}

/** Each selected note's velocity `steps` of 127 louder; the same sequence when none changes. */
export function stepStudioNoteVelocities<S extends StudioNoteSet>(
  sequence: S,
  ids: readonly number[],
  steps: number,
): StudioNoteEdit<S> {
  const wanted = new Set(ids)
  const selection = sequence.notes
    .filter((note) => wanted.has(note.id))
    .map((note) => note.id)
  if (steps === 0 || selection.length === 0) return { sequence, selection }
  let changed = false
  const notes = sequence.notes.map((note) => {
    if (!wanted.has(note.id)) return note
    const velocity = steppedVelocity(note.velocity, steps)
    if (velocity === note.velocity) return note
    changed = true
    return { ...note, velocity }
  })
  return { sequence: changed ? { ...sequence, notes } : sequence, selection }
}

export interface LollipopPickInput {
  /** The notes a press can pick: those the clip plays. */
  readonly notes: readonly StudioNote[]
  readonly viewport: RollViewport
  /** The lane's height. */
  readonly height: number
  readonly selection: ReadonlySet<number>
  readonly x: number
  readonly y: number
  readonly pointerType: NotePointerType
}

interface Lollipop {
  readonly id: number
  readonly selected: boolean
  readonly dx: number
  readonly dy: number
}

/** Whether `a` is the better pick: a selected note, then the nearer head, then the nearer stick. */
function before(a: Lollipop, b: Lollipop): boolean {
  if (a.selected !== b.selected) return a.selected
  if (a.dy !== b.dy) return a.dy < b.dy
  return a.dx <= b.dx
}

/**
 * The lollipop a press in the lane takes: of those within the pointer's
 * reach sideways, a selected note's first (a chord's notes share one place
 * in time), then the one whose head is nearest. Null for none.
 */
export function pickLollipop(input: LollipopPickInput): number | null {
  const reach =
    NOTE_POINTER_PROFILES[input.pointerType].reach + VELOCITY_CAP_RADIUS
  let found: Lollipop | null = null
  for (const note of input.notes) {
    const dx = Math.abs(input.x - velocityLaneX(note.startTick, input.viewport))
    if (dx > reach) continue
    const candidate = {
      id: note.id,
      selected: input.selection.has(note.id),
      dx,
      dy: Math.abs(input.y - velocityLaneY(note.velocity, input.height)),
    }
    if (found === null || before(candidate, found)) found = candidate
  }
  return found?.id ?? null
}
