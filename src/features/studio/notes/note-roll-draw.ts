// ============================================================
// Studio note roll drawing — the note editor's roll drawn on a canvas from one input object: keys or kit rows, the bar and beat ruler, the grid, the notes and their velocities, the playhead, and an edit's drafts, marquee and hover
// ============================================================
//
// A pure function of its input (note-roll-geometry.ts): it reads nothing
// else and keeps nothing between draws, so the editor's gestures feed it a
// selection, the drafts of a drag and a marquee without changing it. It
// draws in two layers. The base holds what changes with the song or the
// view: the rows, the grid, the ruler, the stored notes with their
// selection, and their velocities. The overlay holds what moves with a
// pointer or the clock: the hovered note, a gesture's drafts, the marquee
// and the playhead. A playing song or a drag redraws the overlay alone;
// drawStudioRoll draws both on one canvas.
//
// A note is glass in the lane's colour, as strong as it was played and
// faint when it starts outside the clip's window. Only what the view shows
// is drawn: a sequence of 10,000 notes costs one pass over its notes to find
// those in view, and a fill for each of them.
import { midiToNoteNameOctave, noteOnScreen } from '@/lib/note-utils'
import { rowHeight } from '@/lib/roll-geometry'
import { studioRollRow } from '@/lib/studio/midi/roll-keyboard'
import type { StudioNote } from '@/lib/studio/model/types'
import { drawRollDividers, drawRollGrid, drawRollKeys, drawRollRuler, drawRollStick, drawRollVelocities, } from './note-roll-frame'
import type { RollContext, StudioRollDraft, StudioRollInput, StudioRollRect, } from './note-roll-geometry'
import { beginRollLayer, clipTo, fillBox, roundBox, rowTop, startsInWindow, studioRollRegions, tickX, } from './note-roll-geometry'

export type {
  StudioRollDraft,
  StudioRollInput,
  StudioRollLayout,
  StudioRollMeter,
  StudioRollRect,
  StudioRollRegions,
  StudioRollTheme,
} from './note-roll-geometry'
export { studioRollRegions } from './note-roll-geometry'

/** A note drawn less than this many pixels wide or high gets no name in it. */
const LABEL_WIDTH = 30
const LABEL_HEIGHT = 11

/** A note's box on the canvas, inset a little from its row and its end; null outside the view. */
export function studioRollNoteBox(
  input: StudioRollInput,
  note: Pick<StudioNote, 'pitch' | 'startTick' | 'lengthTicks'>,
): StudioRollRect | null {
  const row = studioRollRow(input.rows, note.pitch)
  const { viewport } = input
  if (row === null || row < viewport.minMidi || row > viewport.maxMidi)
    return null
  const end = note.startTick + note.lengthTicks
  if (end < viewport.start || note.startTick > viewport.end) return null
  const x = tickX(input, note.startTick)
  return {
    x: x + 0.5,
    y: rowTop(input, row) + 1,
    width: Math.max(3, tickX(input, end) - x - 1.5),
    height: Math.max(2, rowHeight(viewport) - 2),
  }
}

/** How strongly a note shows: by its velocity inside the window, faint outside it. */
export function studioRollNoteStrength(
  input: Pick<StudioRollInput, 'window'>,
  note: StudioRollDraft,
): number {
  return startsInWindow(input, note) ? 0.55 + 0.45 * note.velocity : 0.22
}

function noteFill(
  context: RollContext,
  input: StudioRollInput,
  box: StudioRollRect,
): CanvasGradient {
  const fill = context.createLinearGradient(0, box.y, 0, box.y + box.height)
  fill.addColorStop(0, input.theme.noteTop)
  fill.addColorStop(0.72, input.theme.note)
  fill.addColorStop(1, input.theme.note)
  return fill
}

function noteLabel(
  context: RollContext,
  input: StudioRollInput,
  box: StudioRollRect,
  pitch: number,
): void {
  if (input.rows.kind !== 'piano') return
  if (box.width < LABEL_WIDTH || box.height < LABEL_HEIGHT) return
  context.font = `700 ${Math.min(10, box.height - 3)}px ${input.theme.font}`
  context.fillStyle = input.theme.noteText
  context.textBaseline = 'middle'
  context.textAlign = 'left'
  context.fillText(
    noteOnScreen(midiToNoteNameOctave(pitch)),
    box.x + 5,
    box.y + box.height / 2 + 0.5,
  )
}

/** A selected note's ring, and the grip on its end that a resize takes. */
function selectionMarks(
  context: RollContext,
  input: StudioRollInput,
  box: StudioRollRect,
  radius: number,
): void {
  context.beginPath()
  roundBox(
    context,
    {
      x: box.x - 1.5,
      y: box.y - 1.5,
      width: box.width + 3,
      height: box.height + 3,
    },
    radius + 1.5,
  )
  context.lineWidth = 2
  context.strokeStyle = input.theme.selection
  context.stroke()
  if (box.width >= 14)
    fillBox(context, input.theme.selection, {
      x: box.x + box.width - 5,
      y: box.y + box.height * 0.25,
      width: 3,
      height: box.height * 0.5,
    })
}

/** One note: its glass fill as strong as it was played, its rim, its name where it fits, and a selected note's marks; a ghost, the stored note a draft stands in for, is only a faint fill. */
function drawNote(
  context: RollContext,
  input: StudioRollInput,
  note: StudioRollDraft,
  look: { readonly chosen: boolean; readonly ghost: boolean },
): void {
  const box = studioRollNoteBox(input, note)
  if (box === null) return
  const radius = Math.min(5, box.height / 2)
  context.globalAlpha = look.ghost ? 0.22 : studioRollNoteStrength(input, note)
  context.beginPath()
  roundBox(context, box, radius)
  context.fillStyle = noteFill(context, input, box)
  context.fill()
  context.lineWidth = 1
  context.strokeStyle = look.chosen
    ? input.theme.selection
    : input.theme.noteRing
  context.stroke()
  context.globalAlpha = 1
  if (look.ghost) return
  noteLabel(context, input, box, note.pitch)
  if (look.chosen) selectionMarks(context, input, box, radius)
}

/** A soft glow under the notes in view: one blur for all of them. */
function drawGlow(
  context: RollContext,
  input: StudioRollInput,
  notes: readonly StudioRollDraft[],
): void {
  context.save()
  context.shadowColor = input.theme.noteGlow
  context.shadowBlur = 10
  context.shadowOffsetY = 2
  context.fillStyle = input.theme.noteGlow
  context.beginPath()
  for (const note of notes) {
    const box = startsInWindow(input, note)
      ? studioRollNoteBox(input, note)
      : null
    if (box !== null) roundBox(context, box, Math.min(5, box.height / 2))
  }
  context.fill()
  context.restore()
}

/** The stored notes sounding anywhere in the view's ticks, in the order stored. */
function notesInView(input: StudioRollInput): StudioNote[] {
  const { start, end } = input.viewport
  return input.notes.filter(
    (note) =>
      note.startTick <= end && note.startTick + note.lengthTicks >= start,
  )
}

function drawNotes(
  context: RollContext,
  input: StudioRollInput,
  notes: readonly StudioNote[],
): void {
  const drafted = new Set(
    input.drafts.flatMap((draft) => (draft.id === undefined ? [] : [draft.id])),
  )
  context.save()
  clipTo(context, studioRollRegions(input).grid)
  drawGlow(
    context,
    input,
    notes.filter((note) => !drafted.has(note.id)),
  )
  for (const note of notes)
    drawNote(context, input, note, {
      chosen: input.selected.has(note.id) && !drafted.has(note.id),
      ghost: drafted.has(note.id),
    })
  context.restore()
}

/** The base layer: everything but the hover, the drafts, the marquee and the playhead. */
export function drawStudioRollBase(
  context: RollContext,
  input: StudioRollInput,
): void {
  beginRollLayer(context, input)
  const notes = notesInView(input)
  drawRollGrid(context, input)
  drawNotes(context, input, notes)
  drawRollVelocities(context, input, notes)
  drawRollKeys(context, input)
  drawRollRuler(context, input)
  drawRollDividers(context, input)
}

function drawHover(context: RollContext, input: StudioRollInput): void {
  const hover = input.hover
  const note = hover && input.notes.find((each) => each.id === hover.id)
  const box = note ? studioRollNoteBox(input, note) : null
  if (!hover || box === null) return
  context.beginPath()
  roundBox(context, box, Math.min(5, box.height / 2))
  context.globalAlpha = 0.7
  context.lineWidth = 1.5
  context.strokeStyle = input.theme.selection
  context.stroke()
  context.globalAlpha = 1
  if (hover.zone === 'end')
    fillBox(context, input.theme.selection, {
      x: box.x + box.width - 4,
      y: box.y + 1,
      width: 3,
      height: box.height - 2,
    })
}

/** The marquee's box on the canvas: its ticks across, from its high row's top to its low row's foot; null on a kit with no row for an edge. */
export function studioRollMarqueeBox(
  input: StudioRollInput,
): StudioRollRect | null {
  const marquee = input.marquee
  if (marquee === null) return null
  const high = studioRollRow(input.rows, marquee.highPitch)
  const low = studioRollRow(input.rows, marquee.lowPitch)
  if (high === null || low === null) return null
  const top = rowTop(input, Math.max(high, low))
  const bottom = rowTop(input, Math.min(high, low)) + rowHeight(input.viewport)
  const left = tickX(input, marquee.startTick)
  return {
    x: left,
    y: top,
    width: tickX(input, marquee.endTick) - left,
    height: bottom - top,
  }
}

function drawMarquee(context: RollContext, input: StudioRollInput): void {
  const box = studioRollMarqueeBox(input)
  if (box === null) return
  context.globalAlpha = 0.14
  fillBox(context, input.theme.marquee, box)
  context.globalAlpha = 1
  context.lineWidth = 1
  context.strokeStyle = input.theme.marquee
  context.strokeRect(box.x + 0.5, box.y + 0.5, box.width - 1, box.height - 1)
}

function drawPlayhead(context: RollContext, input: StudioRollInput): void {
  const tick = input.playheadTick
  const { viewport } = input
  if (tick === null || tick < viewport.start || tick > viewport.end) return
  const x = Math.round(tickX(input, tick))
  context.save()
  context.shadowColor = input.theme.playheadGlow
  context.shadowBlur = 8
  context.fillStyle = input.theme.playhead
  context.fillRect(x - 1, 0, 2, input.height)
  context.beginPath()
  context.moveTo(x - 5, 0)
  context.lineTo(x + 5, 0)
  context.lineTo(x, 8)
  context.closePath()
  context.fill()
  context.restore()
}

function drawOverlay(context: RollContext, input: StudioRollInput): void {
  const regions = studioRollRegions(input)
  context.save()
  clipTo(context, regions.grid)
  drawHover(context, input)
  for (const draft of input.drafts)
    drawNote(context, input, draft, { chosen: true, ghost: false })
  drawMarquee(context, input)
  context.restore()
  if (regions.velocity.height > 0 && input.drafts.length > 0) {
    context.save()
    clipTo(context, regions.velocity)
    for (const draft of input.drafts)
      drawRollStick(context, input, draft, input.theme.selection)
    context.restore()
  }
  drawPlayhead(context, input)
}

/** The overlay layer, on a canvas of its own over the base: the hovered note, a gesture's drafts and marquee, and the playhead. */
export function drawStudioRollOverlay(
  context: RollContext,
  input: StudioRollInput,
): void {
  beginRollLayer(context, input)
  drawOverlay(context, input)
}

/** The whole roll on one canvas: the base, then the overlay over it. */
export function drawStudioRoll(
  context: RollContext,
  input: StudioRollInput,
): void {
  drawStudioRollBase(context, input)
  drawOverlay(context, input)
}
