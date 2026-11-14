// ============================================================
// Studio note roll frame — the roll around its notes: the rows and the grid, the piano's keys or the kit's named rows, the bar ruler and the velocity lane
// ============================================================
//
// Drawn in the base layer (note-roll-draw.ts), each part clipped to its own
// region, so a long name or a note at the edge never runs into the next
// part. The grid's lines come from the song's bars over the sequence
// (rollGridLines): bars always, beats and sixteenths where they have room.
import { rowHeight } from '@/lib/roll-geometry'
import type { StudioNote } from '@/lib/studio/model/types'
import { studioNoteName } from './note-names'
import type { RollContext, StudioRollDraft, StudioRollInput, StudioRollRect, } from './note-roll-geometry'
import { clipTo, fillBox, isBlackKey, rollGridLines, roundBox, rowTop, shownRows, smallCaps, startsInWindow, studioRollRegions, tickSpacing, tickX, vertical, } from './note-roll-geometry'

/** The velocity lane's room under a stick and over a full one. */
const STICK_FOOT = 10
const STICK_HEAD = 8

/** The grid's rows (a piano's black keys and a kit's every other row shaded), its lines, and the parts outside the clip's window dimmed. */
export function drawRollGrid(
  context: RollContext,
  input: StudioRollInput,
): void {
  const { grid } = studioRollRegions(input)
  const { theme } = input
  const height = rowHeight(input.viewport)
  context.save()
  clipTo(context, grid)
  fillBox(context, theme.background, grid)
  for (const row of shownRows(input)) {
    const y = rowTop(input, row)
    const shade =
      input.rows.kind === 'piano'
        ? isBlackKey(row)
        : (row - input.viewport.minMidi) % 2 === 1
    if (shade) fillBox(context, theme.rowShade, { ...grid, y, height })
    // A line over each C on a piano, between every row of a kit.
    if (input.rows.kind === 'drums')
      fillBox(context, theme.gridBeat, { ...grid, y, height: 1 })
    else if (row % 12 === 0)
      fillBox(context, theme.gridBar, { ...grid, y, height: 1 })
  }
  const lines = rollGridLines(input)
  const bottom = grid.y + grid.height
  for (const x of lines.steps)
    vertical(context, x, grid.y, bottom, theme.gridLine)
  for (const x of lines.beats)
    vertical(context, x, grid.y, bottom, theme.gridBeat)
  for (const x of lines.bars)
    vertical(context, x, grid.y, bottom, theme.gridBar)
  dimOutsideWindow(context, input, grid)
  context.restore()
}

/** Shade the parts of `area` outside the clip's window. */
function dimOutsideWindow(
  context: RollContext,
  input: StudioRollInput,
  area: StudioRollRect,
): void {
  const edge = (tick: number) =>
    Math.max(area.x, Math.min(area.x + area.width, tickX(input, tick)))
  const left = edge(input.window.startTick)
  const right = edge(input.window.endTick)
  if (left > area.x)
    fillBox(context, input.theme.dim, { ...area, width: left - area.x })
  if (right < area.x + area.width)
    fillBox(context, input.theme.dim, {
      ...area,
      x: right,
      width: area.x + area.width - right,
    })
}

/** A note's velocity as a lollipop in the velocity lane: a stick up to its strength, a dot on top. */
export function drawRollStick(
  context: RollContext,
  input: StudioRollInput,
  note: StudioRollDraft,
  color: string,
): void {
  const lane = studioRollRegions(input).velocity
  const x = tickX(input, note.startTick)
  if (x < lane.x - 4 || x > lane.x + lane.width + 4) return
  const foot = lane.y + lane.height - STICK_FOOT
  const reach = Math.max(0, lane.height - STICK_FOOT - STICK_HEAD)
  const top = foot - note.velocity * reach
  context.globalAlpha = startsInWindow(input, note) ? 1 : 0.3
  context.fillStyle = color
  context.fillRect(x + 3, top, 2, foot - top)
  context.beginPath()
  context.arc(x + 4, top, 4, 0, Math.PI * 2)
  context.fill()
  context.globalAlpha = 1
}

/** The velocity lane: its band, its bar lines, a lollipop per note in view, and its label. */
export function drawRollVelocities(
  context: RollContext,
  input: StudioRollInput,
  notes: readonly StudioNote[],
): void {
  const regions = studioRollRegions(input)
  const lane = regions.velocity
  if (lane.height <= 0) return
  const { theme } = input
  fillBox(context, theme.velocity, { ...lane, x: 0, width: input.width })
  fillBox(context, theme.divider, {
    x: 0,
    y: lane.y,
    width: input.width,
    height: 1,
  })
  context.save()
  clipTo(context, lane)
  for (const x of rollGridLines(input).bars)
    vertical(context, x, lane.y, lane.y + lane.height, theme.gridBeat)
  for (const note of notes)
    drawRollStick(
      context,
      input,
      note,
      input.selected.has(note.id) ? theme.selection : theme.note,
    )
  context.restore()
  smallCaps(context, input, 'Velocity', regions.velocityLabel, 'top')
}

function drawPianoKey(
  context: RollContext,
  input: StudioRollInput,
  row: number,
  keys: StudioRollRect,
): void {
  const { theme } = input
  const y = rowTop(input, row)
  const height = rowHeight(input.viewport)
  fillBox(context, theme.keyWhite, { ...keys, y, height })
  if (isBlackKey(row)) {
    context.beginPath()
    roundBox(
      context,
      { x: keys.x, y: y + 1, width: keys.width * 0.6, height: height - 2 },
      3,
    )
    context.fillStyle = theme.keyBlack
    context.fill()
    return
  }
  fillBox(context, theme.keyLine, { ...keys, y: y + height - 1, height: 1 })
  if (row % 12 !== 0 || height < 9) return
  context.font = `600 ${Math.min(10, height - 2)}px ${theme.font}`
  context.fillStyle = theme.keyLabel
  context.textAlign = 'right'
  context.textBaseline = 'middle'
  context.fillText(
    studioNoteName(row),
    keys.x + keys.width - 6,
    y + height / 2 + 0.5,
  )
}

/** A drum row's name, cut to fit the column. */
function fitName(context: RollContext, name: string, room: number): string {
  if (context.measureText(name).width <= room) return name
  let cut = name
  while (cut.length > 1 && context.measureText(`${cut}…`).width > room)
    cut = cut.slice(0, -1)
  return `${cut}…`
}

function drawKitRow(
  context: RollContext,
  input: StudioRollInput,
  row: number,
  keys: StudioRollRect,
): void {
  if (input.rows.kind !== 'drums') return
  const { theme } = input
  const y = rowTop(input, row)
  const height = rowHeight(input.viewport)
  const shaded = (row - input.viewport.minMidi) % 2 === 1
  fillBox(context, shaded ? theme.kitShade : theme.kitRow, {
    ...keys,
    y,
    height,
  })
  fillBox(context, theme.divider, { ...keys, y: y + height - 1, height: 1 })
  if (height < 10) return
  const name = input.rows.keys[input.rows.keys.length - 1 - row].name
  context.font = `600 ${Math.min(11.5, height - 4)}px ${theme.font}`
  context.fillStyle = theme.kitText
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(
    fitName(context, name, keys.width - 20),
    keys.x + 10,
    y + height / 2 + 0.5,
  )
}

/** The column left of the grid: a piano's keys with each C named, or a kit's rows by name. */
export function drawRollKeys(
  context: RollContext,
  input: StudioRollInput,
): void {
  const { keys } = studioRollRegions(input)
  context.save()
  clipTo(context, keys)
  fillBox(context, input.theme.kitRow, keys)
  for (const row of shownRows(input))
    if (input.rows.kind === 'piano') drawPianoKey(context, input, row, keys)
    else drawKitRow(context, input, row, keys)
  context.restore()
}

/** Which bars the ruler names: every one, or every second, fourth and so on where they crowd. */
function barLabelStep(input: StudioRollInput): number {
  const bar = tickSpacing(
    input,
    input.meter.beatTicks * input.meter.beatsPerBar,
  )
  let step = 1
  while (bar * step < 34 && step < 1024) step *= 2
  return step
}

function drawRulerLabels(context: RollContext, input: StudioRollInput): void {
  const { beatTicks, originTick, beatsPerBar } = input.meter
  const barTicks = beatTicks * beatsPerBar
  if (!(barTicks > 0)) return
  const step = barLabelStep(input)
  const ruler = studioRollRegions(input).ruler
  context.font = `600 11px ${input.theme.font}`
  context.fillStyle = input.theme.rulerText
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  for (
    let bar = Math.floor((input.viewport.start - originTick) / barTicks);
    originTick + bar * barTicks <= input.viewport.end;
    bar++
  ) {
    const x = tickX(input, originTick + bar * barTicks)
    if (bar >= 0 && bar % step === 0 && x >= ruler.x - 8)
      context.fillText(String(bar + 1), x + 6, ruler.height / 2)
  }
  drawRulerStart(context, input, barTicks)
}

/** A view that starts inside a bar names that bar and beat at its left edge, "1.3", until the next bar line comes near. */
function drawRulerStart(
  context: RollContext,
  input: StudioRollInput,
  barTicks: number,
): void {
  const { beatTicks, originTick } = input.meter
  const offset = input.viewport.start - originTick
  const bar = Math.floor(offset / barTicks)
  const into = offset - bar * barTicks
  if (bar < 0 || into < 1) return
  const ruler = studioRollRegions(input).ruler
  if (tickX(input, originTick + (bar + 1) * barTicks) - ruler.x < 48) return
  context.fillStyle = input.theme.muted
  context.fillText(
    `${bar + 1}.${Math.floor(into / beatTicks) + 1}`,
    ruler.x + 6,
    ruler.height / 2,
  )
}

/** The ruler: the song's bars by number, its beats, and the clip's window as a band in the lane's colour along its foot. */
export function drawRollRuler(
  context: RollContext,
  input: StudioRollInput,
): void {
  const regions = studioRollRegions(input)
  const { ruler } = regions
  const { theme } = input
  context.save()
  clipTo(context, ruler)
  fillBox(context, theme.ruler, ruler)
  const lines = rollGridLines(input)
  for (const x of lines.beats)
    vertical(context, x, ruler.height * 0.62, ruler.height, theme.gridBeat)
  for (const x of lines.bars)
    vertical(context, x, 0, ruler.height, theme.gridBar)
  drawRulerLabels(context, input)
  const from = tickX(input, input.window.startTick)
  const to = tickX(input, input.window.endTick)
  context.fillStyle = theme.note
  context.fillRect(from, ruler.height - 3, Math.max(0, to - from), 3)
  context.restore()
  fillBox(context, theme.ruler, regions.corner)
  smallCaps(context, input, input.corner, regions.corner, 'middle')
}

/** The lines between the parts: right of the keys, under the ruler. */
export function drawRollDividers(
  context: RollContext,
  input: StudioRollInput,
): void {
  const { keysWidth, rulerHeight } = input.layout
  const color = input.theme.divider
  fillBox(context, color, {
    x: keysWidth - 1,
    y: 0,
    width: 1,
    height: input.height,
  })
  fillBox(context, color, {
    x: 0,
    y: rulerHeight - 1,
    width: input.width,
    height: 1,
  })
}
