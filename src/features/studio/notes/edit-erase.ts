// ============================================================
// Studio note erasing — a sweep that takes notes away: a mouse's or a pen's secondary button in any tool, or a press on the grid in Erase, takes the note under it and every note its path crosses until it lets go, in one commit
// ============================================================
//
// The owner's ask after trying the editor (docs/plans/studio-midi.md, 10):
// a right-click on a computer erases rather than opening the browser's
// menu, and a finger has an Erase tool. A press takes the note under it,
// or the nearest within the pointer's reach, as a press in Select picks
// one. Each move then tests the stretch of path since the one before
// against every note the clip plays, not only the point it ended on, so a
// fast sweep skips nothing: E's paint samples its stretch every half a
// step, and a sweep tests the line itself against each note's box. A
// stretch is kept in the sequence's ticks and rows, so a roll that scrolls
// under a sweep held at its edge brings its notes under the path too, and
// it is cut to the grid in view: a note out of sight is never taken.
//
// The notes swept are a draft, which the roll draws going until the
// release keeps them gone: one commit, one undo step. Escape, a cancel or
// a lost capture puts them back, as for any gesture. Nothing sounds; a
// sweep would be a burst of notes.
import type { RollRect, RollViewport } from '@/lib/roll-geometry'
import { rowHeight, timeToX, xToTime } from '@/lib/roll-geometry'
import type { StudioNoteSet } from '@/lib/studio/midi/notes'
import { deleteStudioNotes } from '@/lib/studio/midi/notes'
import { studioRollPitchAt, studioRollYOf } from '@/lib/studio/midi/roll-rows'
import { editNoteTargets, pickEditNote } from './edit-kit'
import { NOTE_POINTER_PROFILES } from './edit-pick'
import type { NoteAnchor, NoteDraft, NoteEditContext, NoteEditHover, NoteEditPointer, NoteEditTool, NoteErasure, NotePointerType, NoteSingleGesture, } from './edit-types'

/** The button that erases in any tool: a mouse's or a pen's secondary, the right button. */
export const NOTE_ERASE_BUTTON = 2

const NO_SELECTION: ReadonlySet<number> = new Set()

interface RollPoint {
  readonly x: number
  readonly y: number
}

/** Whether a press is a mouse's or a pen's secondary button: an erase in any tool, never a finger. */
export function secondaryPress(
  pointer: Pick<NoteEditPointer, 'button' | 'pointerType'>,
): boolean {
  return pointer.pointerType !== 'touch' && pointer.button === NOTE_ERASE_BUTTON
}

/** Whether a press on the grid starts a sweep: its secondary button in any tool, or any press in Erase. */
export function pressErases(
  tool: NoteEditTool,
  pointer: Pick<NoteEditPointer, 'button' | 'pointerType' | 'surface'>,
): boolean {
  return (
    pointer.surface === 'roll' && (tool === 'erase' || secondaryPress(pointer))
  )
}

/**
 * How far from its path a sweep still takes a note: none for a mouse,
 * which is exact; for a pen or a finger their reach, but a quarter of a
 * row at the most, so a sweep along a row leaves the rows beside it.
 */
export function sweepReach(
  pointerType: NotePointerType,
  viewport: RollViewport,
): number {
  if (pointerType === 'mouse') return 0
  return Math.min(
    NOTE_POINTER_PROFILES[pointerType].reach,
    rowHeight(viewport) / 4,
  )
}

/**
 * The part of the line from `a` to `b` inside `box`, its edges included,
 * or null when none of it is (Liang and Barsky's clipping). A line of no
 * length is the point it stands on.
 */
function clipLine(
  a: RollPoint,
  b: RollPoint,
  box: RollRect,
): [RollPoint, RollPoint] | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let low = 0
  let high = 1
  const edges: readonly (readonly [number, number])[] = [
    [-dx, a.x - box.x],
    [dx, box.x + box.width - a.x],
    [-dy, a.y - box.y],
    [dy, box.y + box.height - a.y],
  ]
  for (const [step, room] of edges) {
    if (step === 0) {
      if (room < 0) return null
      continue
    }
    const at = room / step
    if (step < 0) low = Math.max(low, at)
    else high = Math.min(high, at)
    if (low > high) return null
  }
  return [
    { x: a.x + low * dx, y: a.y + low * dy },
    { x: a.x + high * dx, y: a.y + high * dy },
  ]
}

function grown(rect: RollRect, by: number): RollRect {
  return by <= 0
    ? rect
    : {
        x: rect.x - by,
        y: rect.y - by,
        width: rect.width + 2 * by,
        height: rect.height + 2 * by,
      }
}

/**
 * The notes the clip plays whose press target the line from `from` to
 * `to` crosses, or passes within `reach` of, over the grid in view; in
 * the order they are stored.
 */
export function notesAlong(
  ctx: Pick<NoteEditContext, 'sequence' | 'window' | 'rows' | 'viewport'>,
  from: RollPoint,
  to: RollPoint,
  reach: number,
): number[] {
  const { width, height } = ctx.viewport
  const path = clipLine(from, to, { x: 0, y: 0, width, height })
  if (path === null) return []
  return editNoteTargets(ctx)
    .filter(
      (target) =>
        clipLine(path[0], path[1], grown(target.rect, reach)) !== null,
    )
    .map((target) => target.id)
}

/** The draft a sweep leaves with `erasure` taken: those notes gone, and gone from the selection it found. */
function erasedDraft(
  base: StudioNoteSet,
  before: readonly number[],
  erasure: NoteErasure,
): NoteDraft {
  const gone = new Set(erasure.ids)
  return {
    sequence: gone.size === 0 ? null : deleteStudioNotes(base, gone).sequence,
    selection: gone.size === 0 ? before : before.filter((id) => !gone.has(id)),
    marquee: null,
    readout: null,
    erasure,
  }
}

/** A sweep's first draft: the note a press lands on taken away, picked as a press in Select picks one, from where it went down. */
export function eraseFirstDraft(
  ctx: NoteEditContext,
  before: readonly number[],
  anchor: Pick<NoteAnchor, 'x' | 'y' | 'tick' | 'pitch' | 'pointerType'>,
): NoteDraft {
  const pick = pickEditNote(ctx, {
    selection: NO_SELECTION,
    x: anchor.x,
    y: anchor.y,
    pointerType: anchor.pointerType,
  })
  return erasedDraft(ctx.sequence, before, {
    ids: pick === null ? [] : [pick.id],
    tick: anchor.tick,
    row: anchor.pitch,
  })
}

/** A sweep's draft once the pointer reaches `at`: every note the stretch of path since the last draft crosses taken too. */
export function draftErase(
  gesture: NoteSingleGesture,
  ctx: NoteEditContext,
  at: RollPoint,
): NoteDraft {
  const was = gesture.draft.erasure
  if (was === undefined) return gesture.draft
  const viewport = ctx.viewport
  const from = {
    x: timeToX(was.tick, viewport),
    y: studioRollYOf(was.row, viewport),
  }
  const reach = sweepReach(gesture.anchor.pointerType, viewport)
  const taken = new Set(was.ids)
  const added = notesAlong(ctx, from, at, reach).filter((id) => !taken.has(id))
  const erasure = {
    ids: added.length === 0 ? was.ids : [...was.ids, ...added],
    tick: xToTime(at.x, viewport),
    row: studioRollPitchAt(at.y, viewport),
  }
  if (added.length === 0) return { ...gesture.draft, erasure }
  return erasedDraft(gesture.base, gesture.before, erasure)
}

/** What a mouse or a pen in Erase is over on the grid: a note a press would take away. */
export function eraseHover(
  ctx: NoteEditContext,
  pointer: Pick<NoteEditPointer, 'x' | 'y' | 'pointerType'>,
): NoteEditHover | null {
  const pick = pickEditNote(ctx, {
    selection: NO_SELECTION,
    x: pointer.x,
    y: pointer.y,
    pointerType: pointer.pointerType,
  })
  return pick === null ? null : { id: pick.id, zone: 'erase' }
}
