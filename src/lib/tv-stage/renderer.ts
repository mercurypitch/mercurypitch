// ============================================================
// TV stage renderer — the stage, drawn on a canvas at the TV's size
// ============================================================
//
// One frame of the stage from its state (model.ts) and the wall clock: the
// song's title and the score along the top, the pitch lane across the
// middle (lane.ts), and the lyrics below it, the line being sung filling
// word by word with the next line under it, all inside the 5% overscan
// margin (layout.ts); and while the song stands still, the paused screen
// over it all (pause-screen.ts, pause-paint.ts). Type is sized from the
// screen's height, so a line of lyrics reads the same from the sofa at any
// resolution. No lyric goes under 32 px at 1080 lines (REQ-TV-022): a long
// line wraps onto two rows rather than shrink (lyric-wrap.ts), and the next
// line, a preview, shrinks to that floor and is then cut short.
//
// The lane is the phone's zen ribbon drawn for a TV: the notes at their
// real pitch in an eased band, in yellow glass, the singer's pitch as one
// smooth curve judged as the ribbon judges it. Its glass is painted once
// per screen size into sprites the view keeps (sprites.ts), so a frame
// stamps them rather than paint them again.
//
// Plain canvas calls and no fonts of its own: the stage page loads nothing
// but itself.
//
// Tests: src/lib/tv-stage/renderer.test.ts, renderer.lyrics.test.ts,
// lane.test.ts, pause-screen.test.ts.

import type { LyricWindowSegment } from '@/lib/lyric-window-script'
import { drawLane, drawStageBackdrop } from './lane'
import type { TvStageLayout, TvStageSize } from './layout'
import { fitText, stageFont as font, tvStageLayout } from './layout'
import type { LyricPiece, LyricRowsInView, LyricWrap, MeasureAt, } from './lyric-wrap'
import { ELLIPSIS, lyricRowsInView, pieceFill, wrapLyricLine, } from './lyric-wrap'
import type { TvStageState } from './model'
import { tvStagePosition } from './model'
import { drawPauseScreen } from './pause-paint'
import { pauseScreenOf } from './pause-screen'
import type { TvStageScore } from './protocol'
import type { SpriteCache, SpriteCanvasFactory } from './sprites'
import { createSpriteCache } from './sprites'

/** The stage's colours: the lyrics' gold is the notes' yellow glass. */
export const TV_STAGE_COLORS = {
  background: '#0b0d12',
  title: 'rgba(237, 245, 255, 0.92)',
  sung: '#ffc15a',
  unsung: 'rgba(237, 245, 255, 0.92)',
  next: 'rgba(237, 245, 255, 0.45)',
  quiet: 'rgba(237, 245, 255, 0.55)',
} as const

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

/** What the stage keeps from frame to frame: its sprites, painted once per size. */
export interface TvStageView {
  readonly sprites: SpriteCache
}

/** A view for the stage page, its sprites on canvases from `factory`. */
export function createTvStageView(factory?: SpriteCanvasFactory): TvStageView {
  return { sprites: createSpriteCache(factory) }
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

/**
 * The title and the score along the top. `titleShown` (0 to 1) fades the
 * title out as the paused screen comes, which writes it large itself: one
 * title on the screen, never two.
 */
function drawHeader(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  title: string,
  score: TvStageScore | null,
  titleShown: number,
): void {
  const middle = layout.header.y + layout.header.h / 2
  const right = layout.header.x + layout.header.w
  ctx.textBaseline = 'middle'
  if (titleShown > 0) {
    const alpha = ctx.globalAlpha
    ctx.globalAlpha = alpha * Math.min(1, titleShown)
    ctx.textAlign = 'left'
    ctx.fillStyle = TV_STAGE_COLORS.title
    ctx.font = font(600, 44 * layout.unit)
    ctx.fillText(
      fitText(ctx, title, layout.header.w * 0.6),
      layout.header.x,
      middle,
    )
    ctx.globalAlpha = alpha
  }
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
  view: TvStageView,
): void {
  const layout = tvStageLayout(size.width, size.height)
  view.sprites.screen(size.width, size.height)
  const song = state.song
  const background = TV_STAGE_COLORS.background
  if (
    song === null ||
    !drawStageBackdrop(ctx, layout, view.sprites, background)
  ) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, size.width, size.height)
  }
  if (song === null) {
    drawIdle(ctx, layout)
    return
  }
  const position = tvStagePosition(state, nowMs)
  const paused = pauseScreenOf(state, nowMs)?.shown ?? 0
  drawHeader(ctx, layout, song.title, state.score, 1 - paused)
  drawLane(ctx, layout, state, position, view.sprites)
  drawLyrics(ctx, layout, song.lyrics, position)
  drawPauseScreen(ctx, layout, state, { nowMs, sprites: view.sprites })
}
