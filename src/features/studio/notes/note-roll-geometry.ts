// ============================================================
// Studio note roll geometry — what a roll draw reads, where each part of the roll sits on its canvas, and where a tick, a row and a grid line fall there
// ============================================================
//
// The roll's grid uses the editor's viewport (lib/roll-geometry.ts) for its
// own box: ticks across from its left edge, rows down from its top. The
// keys' column sits to its left, the ruler above, the velocity lane below,
// so every canvas position here is the viewport's position moved by those
// bands. A gesture maps a pointer the other way with studioRollRegions.
import type { RollViewport } from '@/lib/roll-geometry'
import { midiToY, timeToX } from '@/lib/roll-geometry'
import type { StudioNoteBounds } from '@/lib/studio/midi/notes'
import type { StudioRollRows } from '@/lib/studio/midi/roll-keyboard'
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import type { StudioNote } from '@/lib/studio/model/types'

/** The roll's colours, each a CSS colour a canvas takes, and its font family. */
export interface StudioRollTheme {
  readonly background: string
  readonly rowShade: string
  readonly gridLine: string
  readonly gridBeat: string
  readonly gridBar: string
  readonly dim: string
  readonly keyWhite: string
  readonly keyBlack: string
  readonly keyLine: string
  readonly keyLabel: string
  readonly kitRow: string
  readonly kitShade: string
  readonly kitText: string
  readonly ruler: string
  readonly rulerText: string
  readonly divider: string
  readonly note: string
  readonly noteTop: string
  readonly noteRing: string
  readonly noteText: string
  readonly noteGlow: string
  readonly selection: string
  readonly marquee: string
  readonly playhead: string
  readonly playheadGlow: string
  readonly velocity: string
  readonly muted: string
  readonly font: string
}

/** The bands around the grid, in CSS pixels: the keys' column, the ruler's row and the velocity lane's height (0 hides it). */
export interface StudioRollLayout {
  readonly keysWidth: number
  readonly rulerHeight: number
  readonly velocityHeight: number
}

/** The song's bars over the sequence's ticks (time.ts, studioSongBeats). */
export interface StudioRollMeter {
  readonly beatTicks: number
  readonly originTick: number
  readonly beatsPerBar: number
}

/** A note as a gesture would leave it; with the id of a stored note, it stands in for that note. */
export interface StudioRollDraft {
  readonly id?: number
  readonly pitch: number
  readonly startTick: number
  readonly lengthTicks: number
  readonly velocity: number
}

/** Everything a draw reads. */
export interface StudioRollInput {
  /** The canvas's size in CSS pixels, and the device's pixels to one. */
  readonly width: number
  readonly height: number
  readonly ratio: number
  readonly layout: StudioRollLayout
  readonly theme: StudioRollTheme
  /** The grid's view: its ticks across, its rows up and down, its size. */
  readonly viewport: RollViewport
  /** The ticks the clip plays: a note starting outside them is dimmed. */
  readonly window: StudioTickWindow
  readonly rows: StudioRollRows
  readonly meter: StudioRollMeter
  /** The sequence's notes as stored. */
  readonly notes: readonly StudioNote[]
  readonly selected: ReadonlySet<number>
  readonly drafts: readonly StudioRollDraft[]
  /** A marquee being drawn: ticks across, pitches up (on a kit, its top and bottom rows' keys). */
  readonly marquee: StudioNoteBounds | null
  readonly hover: { readonly id: number; readonly zone: 'body' | 'end' } | null
  /** The transport's playhead in the sequence's ticks; null keeps it out. */
  readonly playheadTick: number | null
  /** The corner's word over the keys: Notes, or Kit. */
  readonly corner: string
}

export interface StudioRollRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Where each part of the roll sits on the canvas, in CSS pixels. */
export interface StudioRollRegions {
  readonly corner: StudioRollRect
  readonly ruler: StudioRollRect
  readonly keys: StudioRollRect
  readonly grid: StudioRollRect
  readonly velocityLabel: StudioRollRect
  readonly velocity: StudioRollRect
}

export type RollContext = CanvasRenderingContext2D

/** Grid lines closer than this many pixels are left out. */
const LINE_GAP = 6

export function studioRollRegions(
  input: Pick<StudioRollInput, 'width' | 'height' | 'layout'>,
): StudioRollRegions {
  const { keysWidth, rulerHeight, velocityHeight } = input.layout
  const across = Math.max(0, input.width - keysWidth)
  const gridHeight = Math.max(0, input.height - rulerHeight - velocityHeight)
  const below = rulerHeight + gridHeight
  return {
    corner: { x: 0, y: 0, width: keysWidth, height: rulerHeight },
    ruler: { x: keysWidth, y: 0, width: across, height: rulerHeight },
    keys: { x: 0, y: rulerHeight, width: keysWidth, height: gridHeight },
    grid: { x: keysWidth, y: rulerHeight, width: across, height: gridHeight },
    velocityLabel: {
      x: 0,
      y: below,
      width: keysWidth,
      height: velocityHeight,
    },
    velocity: { x: keysWidth, y: below, width: across, height: velocityHeight },
  }
}

/** A layer starts on a clear canvas at the device's scale. */
export function beginRollLayer(
  context: RollContext,
  input: StudioRollInput,
): void {
  context.setTransform(input.ratio, 0, 0, input.ratio, 0, 0)
  context.clearRect(0, 0, input.width, input.height)
  context.globalAlpha = 1
  context.shadowBlur = 0
}

export function clipTo(context: RollContext, rect: StudioRollRect): void {
  context.beginPath()
  context.rect(rect.x, rect.y, rect.width, rect.height)
  context.clip()
}

export function roundBox(
  context: RollContext,
  box: StudioRollRect,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, box.width / 2, box.height / 2))
  if (typeof context.roundRect === 'function')
    context.roundRect(box.x, box.y, box.width, box.height, r)
  else context.rect(box.x, box.y, box.width, box.height)
}

export function fillBox(
  context: RollContext,
  color: string,
  rect: StudioRollRect,
): void {
  context.fillStyle = color
  context.fillRect(rect.x, rect.y, rect.width, rect.height)
}

/** A line one pixel wide from `from` down to `to`. */
export function vertical(
  context: RollContext,
  x: number,
  from: number,
  to: number,
  color: string,
): void {
  context.fillStyle = color
  context.fillRect(Math.round(x), from, 1, to - from)
}

/** The x of tick `tick` on the canvas. */
export function tickX(input: StudioRollInput, tick: number): number {
  return input.layout.keysWidth + timeToX(tick, input.viewport)
}

/** The top of row `row` on the canvas. */
export function rowTop(input: StudioRollInput, row: number): number {
  return input.layout.rulerHeight + midiToY(row, input.viewport)
}

/** The rows the view shows, from the top. */
export function shownRows(input: StudioRollInput): number[] {
  const rows: number[] = []
  for (let row = input.viewport.maxMidi; row >= input.viewport.minMidi; row--)
    rows.push(row)
  return rows
}

const BLACK_KEYS = new Set([1, 3, 6, 8, 10])

export const isBlackKey = (pitch: number): boolean =>
  BLACK_KEYS.has(((pitch % 12) + 12) % 12)

/** Whether a note starts inside the clip's window, where the clip plays it. */
export const startsInWindow = (
  input: Pick<StudioRollInput, 'window'>,
  note: { readonly startTick: number },
): boolean =>
  note.startTick >= input.window.startTick &&
  note.startTick < input.window.endTick

/** How far apart `ticks` ticks are on the canvas. */
export function tickSpacing(input: StudioRollInput, ticks: number): number {
  const span = input.viewport.end - input.viewport.start
  return span > 0 ? (ticks / span) * input.viewport.width : 0
}

/** Lines `step` ticks apart through tick `from`, over the view, as canvas x. */
function linesAcross(
  input: StudioRollInput,
  from: number,
  step: number,
): number[] {
  const { start, end } = input.viewport
  if (!(step > 0)) return []
  const xs: number[] = []
  for (
    let index = Math.ceil((start - from) / step);
    from + index * step <= end;
    index++
  )
    xs.push(tickX(input, from + index * step))
  return xs
}

/** The grid's lines in view: every sixteenth, beat and bar the view has room for. */
export function rollGridLines(input: StudioRollInput) {
  const { beatTicks, originTick, beatsPerBar } = input.meter
  const roomy = (ticks: number) => tickSpacing(input, ticks) >= LINE_GAP
  return {
    steps: roomy(beatTicks / 4)
      ? linesAcross(input, originTick, beatTicks / 4)
      : [],
    beats: roomy(beatTicks) ? linesAcross(input, originTick, beatTicks) : [],
    bars: linesAcross(input, originTick, beatTicks * beatsPerBar),
  }
}

/** A label in the keys' column: small capitals in the muted colour. */
export function smallCaps(
  context: RollContext,
  input: StudioRollInput,
  words: string,
  area: StudioRollRect,
  at: 'top' | 'middle',
): void {
  if (area.width < 24 || area.height < 12) return
  context.font = `600 10px ${input.theme.font}`
  context.fillStyle = input.theme.muted
  context.textAlign = 'left'
  context.textBaseline = at === 'top' ? 'top' : 'middle'
  context.fillText(
    words.toUpperCase(),
    area.x + 10,
    at === 'top' ? area.y + 9 : area.y + area.height / 2,
  )
}
