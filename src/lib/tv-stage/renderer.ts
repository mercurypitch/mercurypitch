// ============================================================
// TV stage renderer — the stage, drawn on a canvas at the TV's size
// ============================================================
//
// One frame of the stage from its state (model.ts) and the wall clock: the
// song's title and the score along the top, the pitch lane across the
// middle, and the lyrics below it, the line being sung filling word by word
// with the next line under it. Laid out for a 16:9 screen and kept inside a
// 5% margin on every side, because a TV may crop its edges (Google's TV app
// quality guidelines ask for the same overscan margin).
// Type is sized from the screen's height, so a line of lyrics reads the
// same from the sofa at any resolution. No lyric goes under 32 px at 1080
// lines (REQ-TV-022): a long line wraps onto two rows rather than shrink
// (lyric-wrap.ts), and the next line, a preview, shrinks to that floor and
// is then cut short.
//
// The lane folds every note to its pitch class, as the phone's lane does
// during a song (stem-mixer/pitch-canvas-visuals.ts): twelve rows, C at the
// bottom, so a singer an octave from the record sings on the line. Notes
// run right to left past a playhead a third of the way across, and the
// singer's pitch trails behind it.
//
// Plain canvas calls and no fonts of its own: the stage page loads nothing
// but itself.
//
// Tests: src/lib/tv-stage/renderer.test.ts, renderer.lyrics.test.ts.

import type { LyricWindowSegment } from '@/lib/lyric-window-script'
import type { LyricPiece, LyricRowsInView, LyricWrap, MeasureAt, } from './lyric-wrap'
import { ELLIPSIS, lyricRowsInView, pieceFill, wrapLyricLine, } from './lyric-wrap'
import type { TvStageState } from './model'
import { tvStagePosition } from './model'
import type { TvStageNote, TvStageReading, TvStageScore } from './protocol'

/**
 * The lane's colours are the phone's (stem-mixer/pitch-canvas-visuals.ts),
 * restated here because a library module cannot reach into a feature.
 */
export const TV_STAGE_COLORS = {
  background: '#0b0d12',
  lane: 'rgba(255, 255, 255, 0.025)',
  sharpRow: 'rgba(148, 163, 184, 0.04)',
  rowLine: 'rgba(148, 163, 184, 0.12)',
  cLine: 'rgba(148, 163, 184, 0.3)',
  label: 'rgba(148, 163, 184, 0.6)',
  reference: '#f59e0b',
  referenceFill: 'rgba(245, 158, 11, 0.58)',
  singer: '#c4b5fd',
  playhead: 'rgba(96, 165, 250, 0.85)',
  title: 'rgba(237, 245, 255, 0.92)',
  sung: '#ffc15a',
  unsung: 'rgba(237, 245, 255, 0.92)',
  next: 'rgba(237, 245, 255, 0.45)',
  quiet: 'rgba(237, 245, 255, 0.55)',
} as const

/** Seconds of song the lane shows before the playhead, and after it. */
export const LANE_BEFORE_SEC = 3
export const LANE_AFTER_SEC = 6

/** Readings further apart than this, in seconds, are not joined by a line. */
const TRAIL_GAP_SEC = 0.15

/**
 * The lyrics' sizes at 1080 lines: the line being sung, the line waited for
 * in a rest, and the next line under the one being sung.
 */
export const SUNG_LINE_PX = 72
const WAITING_LINE_PX = 60
const NEXT_LINE_PX = 46

/** No lyric is drawn smaller than this at 1080 lines (REQ-TV-022). */
export const LYRIC_FLOOR_PX = 32

/** A wrapped line's rows sit this many times its size apart. */
export const LYRIC_ROW_PITCH = 1.2

const FONT = '-apple-system, "SF Pro Display", system-ui, sans-serif'

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

export interface TvStageBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface TvStageLayout {
  readonly width: number
  readonly height: number
  /** Everything drawn stays inside this box: 5% in from every edge. */
  readonly safe: TvStageBox
  readonly header: TvStageBox
  readonly lane: TvStageBox
  readonly lyrics: TvStageBox
  /** The playhead's x, a third of the way across the lane. */
  readonly playheadX: number
  /** One unit of type: the screen's height over 1080, so 1 at 1080p. */
  readonly unit: number
}

export interface TvStageSize {
  readonly width: number
  readonly height: number
}

/** Where everything goes on a screen of this size. */
export function tvStageLayout(width: number, height: number): TvStageLayout {
  const safe = {
    x: width * 0.05,
    y: height * 0.05,
    w: width * 0.9,
    h: height * 0.9,
  }
  const header = { x: safe.x, y: safe.y, w: safe.w, h: safe.h * 0.12 }
  const laneTop = header.y + header.h + safe.h * 0.03
  const lane = { x: safe.x, y: laneTop, w: safe.w, h: safe.h * 0.5 }
  const lyricsTop = lane.y + lane.h + safe.h * 0.05
  const lyrics = {
    x: safe.x,
    y: lyricsTop,
    w: safe.w,
    h: safe.y + safe.h - lyricsTop,
  }
  return {
    width,
    height,
    safe,
    header,
    lane,
    lyrics,
    playheadX: lane.x + lane.w / 3,
    unit: height / 1080,
  }
}

/** The x of a moment in the song, on the lane at `position`. */
export function laneX(
  layout: TvStageLayout,
  time: number,
  position: number,
): number {
  const before = layout.playheadX - layout.lane.x
  const after = layout.lane.x + layout.lane.w - layout.playheadX
  const offset = time - position
  return offset < 0
    ? layout.playheadX + (offset / LANE_BEFORE_SEC) * before
    : layout.playheadX + (offset / LANE_AFTER_SEC) * after
}

/** The pitch class of a MIDI number, 0 for C. */
export function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12
}

/**
 * The y of a pitch: the middle of its pitch class's row, C at the bottom,
 * moved within the row by how sharp or flat it is.
 */
export function laneY(layout: TvStageLayout, midi: number): number {
  const rowHeight = layout.lane.h / 12
  const nearest = Math.round(midi)
  const row = 11 - pitchClass(nearest)
  return layout.lane.y + (row + 0.5) * rowHeight - (midi - nearest) * rowHeight
}

/** The lyric segment being sung at `time`: the last one begun, or -1. */
export function segmentAt(
  lyrics: readonly LyricWindowSegment[],
  time: number,
): number {
  let found = -1
  for (let index = 0; index < lyrics.length; index += 1) {
    if (lyrics[index].at > time) break
    found = index
  }
  return found
}

/** How much of a word is lit at `time`, from 0 to 1. */
export function wordFill(
  word: readonly [number, number],
  time: number,
): number {
  const [start, lit] = word
  if (time <= start) return 0
  if (time >= lit || lit <= start) return 1
  return (time - start) / (lit - start)
}

/** Whether two readings in a row are drawn joined: close in time, and not across the fold. */
function joined(previous: TvStageReading, reading: TvStageReading): boolean {
  const steps = Math.abs(pitchClass(reading[1]) - pitchClass(previous[1]))
  return reading[0] - previous[0] <= TRAIL_GAP_SEC && steps <= 6
}

const font = (weight: number, px: number): string =>
  `${String(weight)} ${String(Math.round(px))}px ${FONT}`

/** `text`, cut short with an ellipsis to fit `maxWidth` in the current font. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut.trimEnd()}…`
}

function drawIdle(ctx: CanvasRenderingContext2D, layout: TvStageLayout): void {
  const middle = layout.height / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = TV_STAGE_COLORS.title
  ctx.font = font(700, 96 * layout.unit)
  ctx.fillText('Mercury Pitch', layout.width / 2, middle - 40 * layout.unit)
  ctx.fillStyle = TV_STAGE_COLORS.quiet
  ctx.font = font(500, 40 * layout.unit)
  ctx.fillText(
    'Choose a song on your phone',
    layout.width / 2,
    middle + 60 * layout.unit,
  )
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  title: string,
  score: TvStageScore | null,
): void {
  const middle = layout.header.y + layout.header.h / 2
  const right = layout.header.x + layout.header.w
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = TV_STAGE_COLORS.title
  ctx.font = font(600, 44 * layout.unit)
  ctx.fillText(
    fitText(ctx, title, layout.header.w * 0.6),
    layout.header.x,
    middle,
  )
  ctx.textAlign = 'right'
  if (score === null) {
    ctx.fillStyle = TV_STAGE_COLORS.quiet
    ctx.font = font(500, 32 * layout.unit)
    ctx.fillText('Sing along to score', right, middle)
    return
  }
  ctx.fillStyle = TV_STAGE_COLORS.sung
  ctx.font = font(700, 64 * layout.unit)
  ctx.fillText(`${String(score.pct)}%  ${score.grade}`, right, middle)
}

function drawRows(ctx: CanvasRenderingContext2D, layout: TvStageLayout): void {
  const lane = layout.lane
  const rowHeight = lane.h / 12
  const line = Math.max(1, 1.5 * layout.unit)
  ctx.fillStyle = TV_STAGE_COLORS.lane
  ctx.fillRect(lane.x, lane.y, lane.w, lane.h)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = font(500, 20 * layout.unit)
  for (let pc = 0; pc < 12; pc += 1) {
    const top = lane.y + (11 - pc) * rowHeight
    const name = NOTE_NAMES[pc]
    if (name.includes('#')) {
      ctx.fillStyle = TV_STAGE_COLORS.sharpRow
      ctx.fillRect(lane.x, top, lane.w, rowHeight)
    }
    ctx.fillStyle = pc === 0 ? TV_STAGE_COLORS.cLine : TV_STAGE_COLORS.rowLine
    ctx.fillRect(lane.x, top + rowHeight - line, lane.w, line)
    ctx.fillStyle = TV_STAGE_COLORS.label
    ctx.fillText(name, lane.x + 10 * layout.unit, top + rowHeight / 2)
  }
}

function notePath(ctx: CanvasRenderingContext2D, box: TvStageBox): void {
  ctx.beginPath()
  const radius = Math.min(box.h / 2, box.w / 2)
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(box.x, box.y, box.w, box.h, radius)
  } else {
    ctx.rect(box.x, box.y, box.w, box.h)
  }
}

function drawNotes(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  notes: readonly TvStageNote[],
  position: number,
): void {
  const lane = layout.lane
  const rowHeight = lane.h / 12
  const from = position - LANE_BEFORE_SEC
  const to = position + LANE_AFTER_SEC
  ctx.fillStyle = TV_STAGE_COLORS.referenceFill
  ctx.strokeStyle = TV_STAGE_COLORS.reference
  ctx.lineWidth = 2 * layout.unit
  for (const note of notes) {
    if (note.t1 < from || note.t0 > to) continue
    const x0 = Math.max(lane.x, laneX(layout, note.t0, position))
    const x1 = Math.min(lane.x + lane.w, laneX(layout, note.t1, position))
    if (x1 <= x0) continue
    const y = laneY(layout, Math.round(note.midi)) - rowHeight * 0.32
    notePath(ctx, { x: x0, y, w: x1 - x0, h: rowHeight * 0.64 })
    ctx.fill()
    ctx.stroke()
  }
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  trail: readonly TvStageReading[],
  position: number,
): void {
  ctx.strokeStyle = TV_STAGE_COLORS.singer
  ctx.lineWidth = 6 * layout.unit
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  let previous: TvStageReading | null = null
  for (const reading of trail) {
    const x = laneX(layout, reading[0], position)
    if (reading[0] > position || x < layout.lane.x) {
      previous = null
      continue
    }
    const y = laneY(layout, reading[1])
    if (previous !== null && joined(previous, reading)) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
    previous = reading
  }
  ctx.stroke()
  drawSingerNow(ctx, layout, trail, position)
}

/** A dot where the singer is now, while they are singing. */
function drawSingerNow(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  trail: readonly TvStageReading[],
  position: number,
): void {
  const last = trail.at(-1)
  if (last === undefined || position - last[0] > 0.25 || last[0] > position) {
    return
  }
  ctx.fillStyle = TV_STAGE_COLORS.singer
  ctx.beginPath()
  ctx.arc(
    laneX(layout, last[0], position),
    laneY(layout, last[1]),
    11 * layout.unit,
    0,
    Math.PI * 2,
  )
  ctx.fill()
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
): void {
  const width = 4 * layout.unit
  ctx.fillStyle = TV_STAGE_COLORS.playhead
  ctx.fillRect(
    layout.playheadX - width / 2,
    layout.lane.y,
    width,
    layout.lane.h,
  )
}

function drawLane(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  state: TvStageState,
  position: number,
): void {
  drawRows(ctx, layout)
  drawNotes(ctx, layout, state.song?.notes ?? [], position)
  drawPlayhead(ctx, layout)
  drawTrail(ctx, layout, state.trail, position)
}

/** The least whole size a lyric may take on this screen (REQ-TV-022). */
export function lyricFloorPx(layout: TvStageLayout): number {
  // A hair under first, so a floor that is a whole number stays itself.
  return Math.ceil(LYRIC_FLOOR_PX * layout.unit - 1e-9)
}

/** Where the lyrics' lines are centred: the one sung, and the next under it. */
export function lyricSpots(layout: TvStageLayout): {
  readonly current: number
  readonly next: number
} {
  const box = layout.lyrics
  return { current: box.y + box.h * 0.32, next: box.y + box.h * 0.78 }
}

function measureAt(ctx: CanvasRenderingContext2D, weight: number): MeasureAt {
  return (px) => {
    ctx.font = font(weight, px)
    return (text) => ctx.measureText(text).width
  }
}

/**
 * How a block of lyrics is painted: its weight, its colour, and how far each
 * of its words is lit.
 */
interface LyricPaint {
  readonly weight: number
  readonly color: string
  readonly fill: (word: number) => number
}

/** The line being sung is bold; the line waited for and the next one less. */
const SUNG_WEIGHT = 700
const PLAIN_WEIGHT = 600

/** A line's wrap and the screen it was worked out for. */
interface KeptWrap {
  readonly screen: string
  readonly wrap: LyricWrap
}

// Worked out once per line and screen, not every frame: finding a long
// line's size measures it at several sizes, and a TV draws sixty frames a
// second. Keyed by the segment, which the song message holds for as long as
// the song is on; a new message brings new segments, and the old ones go.
const WRAPS = new WeakMap<LyricWindowSegment, KeptWrap>()

/**
 * The segment's line wrapped for this screen: the words being sung, or in a
 * rest the line waited for.
 */
function wrapOf(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  segment: LyricWindowSegment,
): LyricWrap {
  const screen = `${String(layout.width)}x${String(layout.height)}`
  const kept = WRAPS.get(segment)
  if (kept?.screen === screen) return kept.wrap
  const waiting = segment.current.length === 0
  const words = waiting
    ? (segment.next ?? '').split(/\s+/u).filter((word) => word !== '')
    : segment.current
  const wrap = wrapLyricLine(
    words,
    measureAt(ctx, waiting ? PLAIN_WEIGHT : SUNG_WEIGHT),
    {
      width: layout.lyrics.w,
      largest: Math.round(
        (waiting ? WAITING_LINE_PX : SUNG_LINE_PX) * layout.unit,
      ),
      floor: lyricFloorPx(layout),
    },
  )
  WRAPS.set(segment, { screen, wrap })
  return wrap
}

/** A piece of a word, lit from the left up to `fill` of its width. */
function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: LyricPiece,
  at: { readonly x: number; readonly y: number; readonly px: number },
  fill: number,
  color: string,
): void {
  ctx.fillStyle = fill >= 1 ? TV_STAGE_COLORS.sung : color
  ctx.fillText(piece.text, at.x, at.y)
  if (fill <= 0 || fill >= 1) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(at.x, at.y - at.px, piece.width * fill, at.px * 2)
  ctx.clip()
  ctx.fillStyle = TV_STAGE_COLORS.sung
  ctx.fillText(piece.text, at.x, at.y)
  ctx.restore()
}

/**
 * A wrapped line's rows in view, each centred, the block centred on `y`; an
 * ellipsis ends the last row while more of the line follows.
 */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  block: { readonly wrap: LyricWrap; readonly view: LyricRowsInView },
  at: { readonly y: number; readonly paint: LyricPaint },
): void {
  const { wrap, view } = block
  ctx.font = font(at.paint.weight, wrap.px)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const last = view.rows.length - 1
  view.rows.forEach((row, index) => {
    const ellipsis = view.more && index === last
    const width = row.width + (ellipsis ? wrap.space + wrap.ellipsis : 0)
    const left = layout.width / 2 - width / 2
    const y = at.y + (index - last / 2) * wrap.px * LYRIC_ROW_PITCH
    for (const piece of row.pieces) {
      const fill = pieceFill(piece, at.paint.fill(piece.word))
      const place = { x: left + piece.x, y, px: wrap.px }
      drawPiece(ctx, piece, place, fill, at.paint.color)
    }
    if (!ellipsis) return
    ctx.fillStyle = at.paint.color
    ctx.fillText(ELLIPSIS, left + row.width + wrap.space, y)
  })
}

/**
 * The line being sung, each word filling as it is sung, the fill running on
 * from one row into the next. Says the size it was drawn at.
 */
function drawSungLine(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  segment: LyricWindowSegment,
  at: { readonly position: number; readonly y: number },
): number {
  const fill = (word: number): number => {
    const timing = segment.words[word]
    return timing === undefined ? 0 : wordFill(timing, at.position)
  }
  // The rows on screen follow the words that fill over time. A line with no
  // timing arrives with every word lit from its first moment (lyric-glance),
  // which would open a long one on its last rows; it opens on its first.
  const sweeping = (word: number): number => {
    const timing = segment.words[word]
    return timing === undefined || timing[1] <= timing[0] ? 0 : fill(word)
  }
  const wrap = wrapOf(ctx, layout, segment)
  const paint = { weight: SUNG_WEIGHT, color: TV_STAGE_COLORS.unsung, fill }
  const view = lyricRowsInView(wrap, sweeping)
  drawWrapped(ctx, layout, { wrap, view }, { y: at.y, paint })
  return wrap.px
}

/** In a rest, the line coming next, quiet, waiting where it will be sung. */
function drawWaitingLine(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  segment: LyricWindowSegment,
  y: number,
): void {
  const unlit = (): number => 0
  const wrap = wrapOf(ctx, layout, segment)
  const paint = {
    weight: PLAIN_WEIGHT,
    color: TV_STAGE_COLORS.quiet,
    fill: unlit,
  }
  const view = lyricRowsInView(wrap, unlit)
  drawWrapped(ctx, layout, { wrap, view }, { y, paint })
}

/**
 * The next line, dim, on one row: shrunk to fit the width, but not under the
 * floor, and past that cut short. It is a preview; it is shown whole once
 * it is the line being sung. Never bigger than the line being sung, drawn
 * at `sungPx`, which may have shrunk to fit its two rows.
 */
function drawNextLine(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  text: string,
  at: { readonly y: number; readonly sungPx: number },
): void {
  const width = layout.lyrics.w
  const largest = Math.min(NEXT_LINE_PX * layout.unit, at.sungPx)
  ctx.font = font(PLAIN_WEIGHT, largest)
  const natural = ctx.measureText(text).width
  const fitting =
    natural > width ? Math.floor((largest * width) / natural) : largest
  ctx.font = font(PLAIN_WEIGHT, Math.max(lyricFloorPx(layout), fitting))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = TV_STAGE_COLORS.next
  ctx.fillText(fitText(ctx, text, width), layout.width / 2, at.y)
}

function drawLyrics(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  lyrics: readonly LyricWindowSegment[],
  position: number,
): void {
  const segment = lyrics[segmentAt(lyrics, position)] as
    | LyricWindowSegment
    | undefined
  if (segment === undefined) return
  const spots = lyricSpots(layout)
  if (segment.current.length === 0) {
    // A rest or the intro: what comes next, waiting where it will be sung.
    if (segment.next !== null) {
      drawWaitingLine(ctx, layout, segment, spots.current)
    }
    return
  }
  const sungPx = drawSungLine(ctx, layout, segment, {
    position,
    y: spots.current,
  })
  if (segment.next !== null) {
    drawNextLine(ctx, layout, segment.next, { y: spots.next, sungPx })
  }
}

/** One frame of the stage, at `nowMs` on the wall clock. */
export function drawTvStage(
  ctx: CanvasRenderingContext2D,
  state: TvStageState,
  nowMs: number,
  size: TvStageSize,
): void {
  const layout = tvStageLayout(size.width, size.height)
  ctx.fillStyle = TV_STAGE_COLORS.background
  ctx.fillRect(0, 0, size.width, size.height)
  const song = state.song
  if (song === null) {
    drawIdle(ctx, layout)
    return
  }
  const position = tvStagePosition(state, nowMs)
  drawHeader(ctx, layout, song.title, state.score)
  drawLane(ctx, layout, state, position)
  drawLyrics(ctx, layout, song.lyrics, position)
}
