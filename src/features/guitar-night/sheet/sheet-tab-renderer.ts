// Tab, drawn the way tab has always been drawn: one line per string, fret
// numbers sitting on the line with the line broken behind them. It paints a
// whole system in one pass and holds no state, so the page can call it for any
// system in any order.
//
// Part names are not painted here. They are buttons on the page above the
// canvas, because a name you can tap to score that part has to be focusable,
// and a texture on a canvas never is.

import type { GuitarSlideType } from '@/lib/guitar/guitar-notation'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { MidiSongPercussionHit } from '@/lib/midi-song'
import { percussionNotationForGmKey } from '@/lib/percussion-notation'
import type { SheetLane } from './sheet-model'
import { beatFractionInSystem } from './sheet-model'
import type { SheetLaneLayout, SheetMetrics, SheetRenderer, SheetSystemPaintArgs, SheetTheme, } from './sheet-render'

/** Widest a fret number gets: two digits plus the notation letter beside it. */
const NOTE_LABEL_CHAR_WIDTH = 0.62
const NOTE_LABEL_PADDING = 3

function laneHeight(lane: SheetLane, metrics: SheetMetrics): number {
  if (lane.content === 'percussion') {
    // One row above the five-line staff keeps cymbal noteheads inside the lane.
    return metrics.labelHeight + 5 * metrics.rowHeight
  }
  const lines = Math.max(1, lane.tuning.stringCount)
  return metrics.labelHeight + (lines - 1) * metrics.rowHeight
}

export const tabSheetRenderer: SheetRenderer = {
  id: 'tab',
  label: 'Tab',
  laneHeight,
  paintSystem(args: SheetSystemPaintArgs): void {
    const { ctx, metrics, layout } = args
    const contentLeft = metrics.gutterWidth
    const contentWidth = Math.max(1, metrics.width - metrics.gutterWidth)

    ctx.save()
    ctx.textBaseline = 'middle'

    for (const laneLayout of layout.lanes) {
      paintLane(laneLayout, args, contentLeft, contentWidth)
    }

    ctx.restore()
  },
}

function paintLane(
  laneLayout: SheetLaneLayout,
  args: SheetSystemPaintArgs,
  contentLeft: number,
  contentWidth: number,
): void {
  const { ctx, metrics, theme, system, placement } = args
  const { lane } = laneLayout
  const staffTop =
    laneLayout.top +
    metrics.labelHeight +
    (lane.content === 'percussion' ? metrics.rowHeight : 0)
  const lines =
    lane.content === 'percussion' ? 5 : Math.max(1, lane.tuning.stringCount)
  const staffBottom = staffTop + (lines - 1) * metrics.rowHeight

  paintStaff(ctx, {
    lines,
    staffTop,
    contentLeft,
    contentWidth,
    metrics,
    theme,
    lane,
    scored: laneLayout.scored,
  })
  paintBarLines(ctx, {
    args,
    staffTop,
    staffBottom,
    contentLeft,
    contentWidth,
  })

  if (lane.content === 'percussion') {
    const hits =
      placement.percussionHitsBySystem[system.index]?.[laneLayout.laneIndex]
    if (hits === undefined || hits.length === 0) return
    for (const hit of hits) {
      paintPercussionHit(ctx, {
        hit,
        staffTop,
        contentLeft,
        contentWidth,
        metrics,
        theme,
        system,
      })
    }
    return
  }

  const notes = placement.notesBySystem[system.index]?.[laneLayout.laneIndex]
  if (notes === undefined || notes.length === 0) return

  const fontSize = Math.max(9, metrics.rowHeight - 3)
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.textAlign = 'center'

  for (const note of notes) {
    paintNote(ctx, {
      note,
      lane,
      scored: laneLayout.scored,
      staffTop,
      lines,
      contentLeft,
      contentWidth,
      fontSize,
      metrics,
      theme,
      system: args.system,
    })
  }
}

function paintStaff(
  ctx: CanvasRenderingContext2D,
  input: {
    lines: number
    staffTop: number
    contentLeft: number
    contentWidth: number
    metrics: SheetMetrics
    theme: SheetTheme
    lane: SheetLane
    scored: boolean
  },
): void {
  const { lines, staffTop, contentLeft, contentWidth, metrics, theme } = input

  ctx.strokeStyle = theme.staffLine
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let line = 0; line < lines; line += 1) {
    // The half pixel is what keeps a one pixel line from painting as two grey ones.
    const y = Math.round(staffTop + line * metrics.rowHeight) + 0.5
    ctx.moveTo(contentLeft, y)
    ctx.lineTo(contentLeft + contentWidth, y)
  }
  ctx.stroke()

  ctx.textAlign = 'right'
  ctx.fillStyle = input.scored ? theme.scoredAccent : theme.laneLabel
  ctx.font = `${Math.max(8, metrics.rowHeight - 4)}px ui-monospace, SFMono-Regular, Menlo, monospace`
  for (let line = 0; line < lines; line += 1) {
    // A percussion staff encodes voice height in the notation itself. Guitar
    // string labels remain useful; invented semantic drum rows would not.
    const label =
      input.lane.content === 'percussion'
        ? undefined
        : input.lane.tuning.labels[line]
    if (label === undefined) continue
    ctx.fillText(label, contentLeft - 6, staffTop + line * metrics.rowHeight)
  }
}

/** Draw one authored GM attack without ever turning it into a pitched note. */
function paintPercussionHit(
  ctx: CanvasRenderingContext2D,
  input: {
    hit: MidiSongPercussionHit
    staffTop: number
    contentLeft: number
    contentWidth: number
    metrics: SheetMetrics
    theme: SheetTheme
    system: SheetSystemPaintArgs['system']
  },
): void {
  const { hit, metrics, theme } = input
  const voice = percussionNotationForGmKey(hit.gmKey)
  const x =
    input.contentLeft +
    beatFractionInSystem(input.system, hit.startBeat) * input.contentWidth
  const y =
    input.staffTop +
    2 * metrics.rowHeight -
    voice.staffStep * (metrics.rowHeight / 2)
  const radius = 2.4 + (Math.max(1, Math.min(127, hit.velocity)) / 127) * 1.5

  ctx.fillStyle = theme.mutedNoteText
  ctx.strokeStyle = theme.mutedNoteText
  ctx.lineWidth = 1.25
  ctx.beginPath()
  if (voice.notehead === 'cross') {
    ctx.moveTo(x - radius, y - radius)
    ctx.lineTo(x + radius, y + radius)
    ctx.moveTo(x + radius, y - radius)
    ctx.lineTo(x - radius, y + radius)
    ctx.stroke()
  } else if (voice.notehead === 'diamond') {
    ctx.moveTo(x, y - radius)
    ctx.lineTo(x + radius, y)
    ctx.lineTo(x, y + radius)
    ctx.lineTo(x - radius, y)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.ellipse(x, y, radius, radius * 0.72, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const stemEndY =
    y + (voice.stemDirection === 'up' ? -1 : 1) * metrics.rowHeight * 1.75
  ctx.beginPath()
  ctx.moveTo(x + (voice.stemDirection === 'up' ? radius : -radius), y)
  ctx.lineTo(x + (voice.stemDirection === 'up' ? radius : -radius), stemEndY)
  ctx.stroke()
}

function paintBarLines(
  ctx: CanvasRenderingContext2D,
  input: {
    args: SheetSystemPaintArgs
    staffTop: number
    staffBottom: number
    contentLeft: number
    contentWidth: number
  },
): void {
  const { args, staffTop, staffBottom, contentLeft, contentWidth } = input
  const { system, theme } = args

  ctx.strokeStyle = theme.barLine
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const bar of system.bars) {
    const x =
      Math.round(
        contentLeft +
          beatFractionInSystem(system, bar.startBeat) * contentWidth,
      ) + 0.5
    ctx.moveTo(x, staffTop)
    ctx.lineTo(x, staffBottom)
  }
  const end = Math.round(contentLeft + contentWidth) - 0.5
  ctx.moveTo(end, staffTop)
  ctx.lineTo(end, staffBottom)
  ctx.stroke()
}

function paintNote(
  ctx: CanvasRenderingContext2D,
  input: {
    note: GuitarNote
    lane: SheetLane
    scored: boolean
    staffTop: number
    lines: number
    contentLeft: number
    contentWidth: number
    fontSize: number
    metrics: SheetMetrics
    theme: SheetTheme
    system: SheetSystemPaintArgs['system']
  },
): void {
  const { note, metrics, theme } = input
  const row = Math.min(Math.max(0, note.stringIndex), input.lines - 1)
  const y = input.staffTop + row * metrics.rowHeight
  const x =
    input.contentLeft +
    beatFractionInSystem(input.system, note.startBeat) * input.contentWidth

  const label = noteLabel(note)
  const width = label.length * input.fontSize * NOTE_LABEL_CHAR_WIDTH

  // Break the string line behind the digits rather than drawing over it: an
  // unbroken line through a fret number is the classic unreadable tab.
  ctx.fillStyle = theme.noteBackdrop
  ctx.fillRect(
    x - width / 2 - NOTE_LABEL_PADDING,
    y - input.fontSize / 2 - 1,
    width + NOTE_LABEL_PADDING * 2,
    input.fontSize + 2,
  )

  ctx.fillStyle = input.scored ? theme.noteText : theme.mutedNoteText
  ctx.fillText(label, x, y)
}

/**
 * What is written on the line: the fret, plus the one articulation mark tab
 * has a symbol for. Only marks the source actually authored are drawn — palm
 * mutes and let rings describe a span rather than a note head, so they are left
 * for the row above rather than crowded onto the digits.
 */
export function noteLabel(note: GuitarNote): string {
  const fret = `${Math.max(0, Math.round(note.fret))}`
  const techniques = note.notation?.techniques
  if (techniques === undefined || techniques.length === 0) return fret

  for (const technique of techniques) {
    if (technique.kind === 'bend') return `${fret}b`
    if (technique.kind === 'slide')
      return `${fret}${slideMark(technique.slideType)}`
    if (technique.kind === 'hammer-on') return `${fret}h`
    if (technique.kind === 'pull-off') return `${fret}p`
    if (technique.kind === 'vibrato') return `${fret}~`
  }
  return fret
}

function slideMark(slideType: GuitarSlideType): string {
  return slideType === 'into-from-above' ||
    slideType === 'out-down' ||
    slideType === 'pick-slide-down'
    ? '\\'
    : '/'
}
