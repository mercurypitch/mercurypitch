// ============================================================
// Studio note picking — what a press in the note editor lands on: a note under the pointer or near it, or a selected note's grip, sized for a finger as well as a mouse
// ============================================================
//
// On a phone a note can be a few pixels tall and a short one a few pixels
// wide, so a finger picks the note under it, else the nearest one within
// its reach (NOTE_POINTER_PROFILES). Resizing is the grip's: a selected
// note's right end carries a zone 20 px wide for a finger, inside the note
// when the note is long and beside it when it is short, so the body of a
// short note always moves it. A mouse also resizes an unselected note from
// its last few pixels, but never from a short note's whole body.
import type { RollRect, RollViewport } from '@/lib/roll-geometry'
import { hitTest, noteRect } from '@/lib/roll-geometry'
import type { StudioRollNote } from '@/lib/studio/midi/roll'
import type { NotePointerType } from './edit-types'

/** How a kind of pointer presses, in CSS pixels. */
export interface NotePointerProfile {
  /** How far a press travels before it is a drag; the Studio ruler's slop (ruler-gesture.ts). */
  readonly slop: number
  /** How far from a note a press still picks it. */
  readonly reach: number
  /** The part of a note, from its start, its resize zone never takes. */
  readonly keep: number
  /** The most of a note's end its resize zone takes inside it. */
  readonly inside: number
  /** How wide a selected note's grip zone is, inside and beside the note together. */
  readonly grip: number
  /** How tall a grip zone is at the least, about its row. */
  readonly gripHeight: number
}

export const NOTE_POINTER_PROFILES: Readonly<
  Record<NotePointerType, NotePointerProfile>
> = {
  mouse: { slop: 4, reach: 3, keep: 8, inside: 6, grip: 6, gripHeight: 0 },
  pen: { slop: 4, reach: 6, keep: 8, inside: 6, grip: 10, gripHeight: 16 },
  touch: {
    slop: 10,
    reach: 12,
    keep: 16,
    inside: 10,
    grip: 20,
    gripHeight: 28,
  },
}

/** A note at least this wide carries its grip inside its right end; a shorter one just beside it. */
export const NOTE_GRIP_INSIDE_WIDTH = 24
/** The grip's bar, and its gap from the note's right edge. */
const GRIP_BAR = 3
const GRIP_GAP = 2

/** Whether a press at `x`, `y` is in `rect`, its edges included. */
function contains(rect: RollRect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}

/** The grip a selected note shows on its right end: inside a long note, beside a short one. */
export function noteGripRect(rect: RollRect): RollRect {
  const inside = rect.width >= NOTE_GRIP_INSIDE_WIDTH
  const height = Math.max(6, rect.height / 2)
  const right = rect.x + rect.width
  return {
    x: inside ? right - GRIP_GAP - GRIP_BAR : right + GRIP_GAP,
    y: rect.y + (rect.height - height) / 2,
    width: GRIP_BAR,
    height,
  }
}

/**
 * Where a press on a note's right end resizes it, or null where none does:
 * the note's last pixels (never its first `keep`), and for a selected note
 * the grip beside it too, always covering the grip it shows. A finger
 * resizes a selected note only.
 */
export function noteResizeZone(
  rect: RollRect,
  selected: boolean,
  pointerType: NotePointerType,
): RollRect | null {
  if (!selected && pointerType === 'touch') return null
  const profile = NOTE_POINTER_PROFILES[pointerType]
  const inside = Math.min(
    profile.inside,
    Math.max(0, rect.width - profile.keep),
  )
  const shown =
    rect.width < NOTE_GRIP_INSIDE_WIDTH ? GRIP_GAP + GRIP_BAR + 1 : 0
  const beside = selected ? Math.max(profile.grip - inside, shown) : 0
  if (inside + beside <= 0) return null
  const height = selected
    ? Math.max(rect.height, profile.gripHeight)
    : rect.height
  return {
    x: rect.x + rect.width - inside,
    y: rect.y + (rect.height - height) / 2,
    width: inside + beside,
    height,
  }
}

/** A note a press picked, on its body or its resize zone. */
export interface NotePick {
  readonly id: number
  readonly zone: 'body' | 'end'
}

export interface NotePickInput {
  /** The notes a press can pick: those the clip plays (studioWindowRollNotes). */
  readonly notes: readonly StudioRollNote[]
  readonly viewport: RollViewport
  readonly selection: ReadonlySet<number>
  readonly x: number
  readonly y: number
  readonly pointerType: NotePointerType
}

/** The note under the pointer; its zone is the end when the press is in its resize zone. */
function pickUnder(input: NotePickInput): NotePick | null {
  const hit = hitTest(input.notes, input.viewport, input.x, input.y)
  if (hit === null) return null
  const zone = noteResizeZone(
    noteRect(hit.note, input.viewport),
    input.selection.has(hit.note.id),
    input.pointerType,
  )
  const end = zone !== null && contains(zone, input.x, input.y)
  return { id: hit.note.id, zone: end ? 'end' : 'body' }
}

/** How far the press is from a selected note's right end, when it is in the note's grip zone; null otherwise. */
function gripDistance(
  note: StudioRollNote,
  input: NotePickInput,
): number | null {
  if (!input.selection.has(note.id)) return null
  const rect = noteRect(note, input.viewport)
  const zone = noteResizeZone(rect, true, input.pointerType)
  if (zone === null || !contains(zone, input.x, input.y)) return null
  return Math.abs(input.x - (rect.x + rect.width))
}

/** A selected note whose grip zone, beside it, the press is in: the nearest grip wins. */
function pickGrip(input: NotePickInput): NotePick | null {
  let found: NotePick | null = null
  let nearest = Infinity
  for (const note of input.notes) {
    const distance = gripDistance(note, input)
    if (distance === null || distance > nearest) continue
    nearest = distance
    found = { id: note.id, zone: 'end' }
  }
  return found
}

/** How far a press is from `rect`, 0 inside it. */
function distanceTo(rect: RollRect, x: number, y: number): number {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.width))
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.height))
  return Math.hypot(dx, dy)
}

/** The note nearest the press within the pointer's reach; later notes win ties, as they draw on top. */
function pickNear(input: NotePickInput): NotePick | null {
  let found: NotePick | null = null
  let nearest = NOTE_POINTER_PROFILES[input.pointerType].reach
  for (const note of input.notes) {
    const distance = distanceTo(
      noteRect(note, input.viewport),
      input.x,
      input.y,
    )
    if (distance > nearest) continue
    nearest = distance
    found = { id: note.id, zone: 'body' }
  }
  return found
}

/**
 * What a press picks: the note under it (its body, or its end in its resize
 * zone), else a selected note's grip, else the nearest note in reach.
 */
export function pickRollNote(input: NotePickInput): NotePick | null {
  return pickUnder(input) ?? pickGrip(input) ?? pickNear(input)
}
