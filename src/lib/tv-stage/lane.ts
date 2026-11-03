// ============================================================
// TV stage lane — the phone's zen ribbon, drawn for a TV
// ============================================================
//
// The pitch lane above the lyrics, made to look like the ribbon over the
// phone's lyrics (ZenPitchRibbon.tsx) and to read from a sofa: a rounded
// panel of softly lit glass, the notes at their real pitch in yellow glass,
// flowing left through a beam of light, the now marker, with the singer's
// pitch riding them as one smooth glowing curve that ends in a dot.
//
// It shows what the ribbon shows (lane-band.ts): the same notes, the same
// window of 1.5 s behind the marker and 5.5 s ahead, the same eased band of
// pitch, the same judgement of the singer (lane-judge.ts). On the note the
// curve is green, the note lights up where it was sung and flares where the
// singer meets it; off it, rose; with no note sounding, violet. Behind the
// marker the curve fades, a note gone by unsung is an empty tube of glass,
// and at both ends of the panel the glass fogs over what runs off it.
//
// Note names only where they help reading: a line and a label at each C in
// the band, so a height can be read as a pitch, and the name of the note
// under the marker in a chip at its top, all at the lyrics' 32 px floor.
// Never twelve labelled rows.
//
// Everything but the text is a sprite painted once per size (lane-paint.ts),
// stamped with drawImage; nothing is blurred in a frame. The panel itself
// is part of the stage's backdrop, one opaque sprite a frame starts from.
// All of it lies inside the panel, which lies inside the overscan margin.
//
// Tests: src/lib/tv-stage/lane.test.ts.

import type { LaneBand, SortedNotes } from './lane-band'
import { BAND_MIN_SPAN, LANE_AHEAD_SEC, LANE_BEHIND_SEC, LANE_NOW_RATIO, laneBand, noteAt, noteBand, notesInView, sortedNotes, } from './lane-band'
import type { TrailPoint, Verdict } from './lane-judge'
import { litSpans, strokesOf, trailPoints } from './lane-judge'
import type { NoteSprite } from './lane-paint'
import { chipSprite, dotSprite, flareSprite, fogSprite, glowSprite, markerSprite, noteSprite, panelSprite, VERDICT_COLORS, } from './lane-paint'
import type { TvStageBox, TvStageLayout } from './layout'
import { stageFont } from './layout'
import type { TvStageState } from './model'
import type { TvStageNote, TvStageReading } from './protocol'
import type { SpriteCache } from './sprites'
import { horizontalGradient } from './sprites'
import type { Knot } from './trail-spline'
import { catmullRom, smoothStroke } from './trail-spline'

/** Room inside the panel above the band, for the chip, and below it, in units. */
const BAND_TOP = 84
const BAND_BOTTOM = 42

/** How far in from the panel's ends the glass fogs over, in units. */
const EDGE_FOG = 110

/** A reading older than this, in seconds, is not where the singer is now. */
const DOT_FRESH_SEC = 0.5

/** Where the lane's things go on this screen. */
export interface LaneGeometry {
  readonly panel: TvStageBox
  /** The now marker's x. */
  readonly nowX: number
  readonly pxPerSec: number
  /** The band's top and bottom edges: where its high and low notes sit. */
  readonly top: number
  readonly bottom: number
  readonly unit: number
}

export function laneGeometry(layout: TvStageLayout): LaneGeometry {
  const panel = layout.lane
  const unit = layout.unit
  return {
    panel,
    nowX: panel.x + panel.w * LANE_NOW_RATIO,
    pxPerSec: panel.w / (LANE_BEHIND_SEC + LANE_AHEAD_SEC),
    top: panel.y + BAND_TOP * unit,
    bottom: panel.y + panel.h - BAND_BOTTOM * unit,
    unit,
  }
}

/** The x of a moment in the song, with the song at `position`. */
export function timeX(
  lane: LaneGeometry,
  time: number,
  position: number,
): number {
  return lane.nowX + (time - position) * lane.pxPerSec
}

/** The y of a pitch in the band, kept to the band's edges. */
export function pitchY(
  lane: LaneGeometry,
  band: LaneBand,
  midi: number,
): number {
  const share = (midi - band.low) / (band.high - band.low)
  const kept = Math.min(1, Math.max(0, share))
  return lane.bottom - kept * (lane.bottom - lane.top)
}

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
]

/** A MIDI number's name, 'A3' for 57. */
export function noteName(midi: number): string {
  const nearest = Math.round(midi)
  const pc = ((nearest % 12) + 12) % 12
  return `${NOTE_NAMES[pc]}${String(Math.floor(nearest / 12) - 1)}`
}

/**
 * The band with no notes to go by: around the singer's last readings, or
 * middle C's octave. A song whose notes are still being read still has a lane.
 */
function bandWithoutNotes(
  trail: readonly TvStageReading[],
  position: number,
): LaneBand {
  const recent = trail
    .filter(([time]) => time > position - LANE_BEHIND_SEC && time <= position)
    .map(([time, midi]) => ({ t0: time, t1: time, midi }))
  return (
    noteBand(recent) ?? {
      low: 60 - BAND_MIN_SPAN / 2,
      high: 60 + BAND_MIN_SPAN / 2,
    }
  )
}

/** One frame of the lane: what the song is doing at `position`. */
export interface LaneFrame {
  readonly sorted: SortedNotes
  readonly band: LaneBand
  readonly points: readonly TrailPoint[]
  readonly position: number
}

/** What the lane shows at `position`: its notes, its band, the singer judged. */
export function laneFrame(state: TvStageState, position: number): LaneFrame {
  const notes = state.song?.notes ?? []
  const sorted = sortedNotes(notes)
  const band =
    laneBand(notes, position) ?? bandWithoutNotes(state.trail, position)
  const from = position - LANE_BEHIND_SEC - 0.25
  return {
    sorted,
    band,
    points: trailPoints(sorted, state.trail, { from, position }, band),
    position,
  }
}

/**
 * The lane at `position`: the notes, the marker, the singer's curve and dot,
 * the fog at the ends and the names. Its glass panel is already there, in
 * the stage's backdrop (drawStageBackdrop).
 */
export function drawLane(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  state: TvStageState,
  position: number,
  sprites: SpriteCache,
): void {
  const lane = laneGeometry(layout)
  const frame = laneFrame(state, position)
  const band = frame.band
  ctx.save()
  // A clip on whole pixels, cut inside the panel's edge: an anti-aliased
  // rounded clip costs a mask the size of the panel every frame. Nothing
  // reaches the rounded corners, which lie outside the band, and the ends'
  // fog covers what runs off the sides.
  const edge = Math.ceil(2 * lane.unit)
  const left = Math.round(lane.panel.x) + edge
  const top = Math.round(lane.panel.y) + edge
  ctx.beginPath()
  ctx.rect(
    left,
    top,
    Math.round(lane.panel.x + lane.panel.w) - edge - left,
    Math.round(lane.panel.y + lane.panel.h) - edge - top,
  )
  ctx.clip()
  drawGuideLines(ctx, lane, band)
  drawNotes(ctx, lane, frame, sprites)
  drawMarker(ctx, lane, sprites)
  const last = drawTrail(ctx, lane, frame)
  drawSingerNow(ctx, lane, { last, frame }, sprites)
  ctx.restore()
  // Not cut to the panel: the fog is the panel's own glass, edge and all,
  // and laid whole over its ends it leaves no sliver of a note at the cut.
  drawFog(ctx, lane, sprites)
  drawChip(ctx, lane, frame, sprites)
  drawGuideNames(ctx, lane, band)
}

/**
 * The stage behind everything that moves, painted once per screen size: the
 * background, the soft light around the lane, and the lane's glass panel
 * with its shadow. Opaque, so a frame begins by stamping it as a plain copy
 * rather than filling the screen and blending the light and the glass over
 * it, which at 4K is millions of pixels a frame. False where no sprite can
 * be made: the caller then fills the screen with the background.
 */
export function drawStageBackdrop(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  sprites: SpriteCache,
  background: string,
): boolean {
  const lane = laneGeometry(layout)
  const { width, height, safe } = layout
  const backdrop = sprites.get(
    `backdrop:${String(width)}x${String(height)}`,
    { width, height, opaque: true },
    (paint) => {
      paint.fillStyle = background
      paint.fillRect(0, 0, width, height)
      const glow = glowSprite(
        sprites,
        { w: safe.w, h: safe.h },
        { x: lane.nowX - safe.x, y: lane.panel.y + lane.panel.h / 2 - safe.y },
      )
      if (glow !== null) {
        paint.drawImage(glow.image, Math.round(safe.x), Math.round(safe.y))
      }
      const panel = panelSprite(
        sprites,
        { w: lane.panel.w, h: lane.panel.h, unit: lane.unit },
        LANE_NOW_RATIO,
      )
      if (panel !== null) {
        paint.drawImage(
          panel.image,
          Math.round(lane.panel.x),
          Math.round(lane.panel.y),
        )
      }
    },
  )
  if (backdrop === null) return false
  ctx.drawImage(backdrop.image, 0, 0)
  return true
}

/** The C's in the band, from the lowest up. */
function cs(band: LaneBand): number[] {
  const found: number[] = []
  for (let c = Math.ceil(band.low / 12) * 12; c <= band.high; c += 12)
    found.push(c)
  return found
}

/** A faint line at each C in the band, under the notes: a height read as a pitch. */
function drawGuideLines(
  ctx: CanvasRenderingContext2D,
  lane: LaneGeometry,
  band: LaneBand,
): void {
  const unit = lane.unit
  ctx.fillStyle = 'rgba(238, 228, 255, 0.075)'
  for (const c of cs(band)) {
    ctx.fillRect(
      lane.panel.x,
      Math.round(pitchY(lane, band, c)),
      lane.panel.w,
      Math.max(1, unit),
    )
  }
}

/** Each C line's name, at the panel's left end, over the glass's fog there. */
function drawGuideNames(
  ctx: CanvasRenderingContext2D,
  lane: LaneGeometry,
  band: LaneBand,
): void {
  const unit = lane.unit
  ctx.font = stageFont(600, 32 * unit)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(238, 228, 255, 0.42)'
  for (const c of cs(band)) {
    ctx.fillText(
      noteName(c),
      lane.panel.x + 30 * unit,
      pitchY(lane, band, c) - 6 * unit,
    )
  }
}

/**
 * A note's capsule from `x0` to `x1`, centred on `y`: its two rounded ends
 * as painted, and its middle stretched between them. A note shorter than
 * its height is a round bead.
 */
function stampNote(
  ctx: CanvasRenderingContext2D,
  note: NoteSprite,
  at: { readonly x0: number; readonly x1: number; readonly y: number },
): void {
  const { sprite, height, pad } = note
  const cap = height / 2
  let left = Math.round(at.x0)
  let right = Math.round(at.x1)
  if (right - left < height) {
    left = Math.round((at.x0 + at.x1) / 2 - cap)
    right = left + height
  }
  const top = Math.round(at.y - cap - pad)
  const middle = sprite.width - pad * 2 - height
  const end = pad + cap
  ctx.drawImage(
    sprite.image,
    0,
    0,
    end,
    sprite.height,
    left - pad,
    top,
    end,
    sprite.height,
  )
  if (right - left > height) {
    ctx.drawImage(
      sprite.image,
      end + 1,
      0,
      Math.max(1, middle - 2),
      sprite.height,
      left + cap,
      top,
      right - left - height,
      sprite.height,
    )
  }
  ctx.drawImage(
    sprite.image,
    end + middle,
    0,
    end,
    sprite.height,
    right - cap,
    top,
    end,
    sprite.height,
  )
}

/** Where a note goes on the lane, how it looks, and where it is lit. */
export interface NoteBox {
  readonly note: TvStageNote
  readonly x0: number
  readonly x1: number
  readonly y: number
  /** Gone by: it has ended. */
  readonly past: boolean
  /** The stretches sung on pitch, as x from and to. */
  readonly lit: ReadonlyArray<readonly [number, number]>
}

/** The notes in view, placed: at their real pitch, in the band, in time. */
export function noteBoxes(lane: LaneGeometry, frame: LaneFrame): NoteBox[] {
  const x = (time: number): number => timeX(lane, time, frame.position)
  return notesInView(frame.sorted, frame.position).map((note) => ({
    note,
    x0: x(note.t0),
    x1: x(note.t1),
    y: pitchY(lane, frame.band, note.midi),
    past: note.t1 <= frame.position,
    lit:
      note.t0 < frame.position
        ? litSpans(note, frame.points, frame.position).map(
            ([from, to]) => [x(from), x(to)] as const,
          )
        : [],
  }))
}

function drawNotes(
  ctx: CanvasRenderingContext2D,
  lane: LaneGeometry,
  frame: LaneFrame,
  sprites: SpriteCache,
): void {
  const glass = noteSprite(sprites, 'glass', lane.unit)
  const past = noteSprite(sprites, 'past', lane.unit)
  const lit = noteSprite(sprites, 'lit', lane.unit)
  if (glass === null || past === null || lit === null) return
  for (const box of noteBoxes(lane, frame)) {
    stampNote(ctx, box.past ? past : glass, box)
    // Where it was sung on pitch, it lights up.
    for (const [x0, x1] of box.lit) stampNote(ctx, lit, { x0, x1, y: box.y })
  }
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  lane: LaneGeometry,
  sprites: SpriteCache,
): void {
  const inset = 10 * lane.unit
  const marker = markerSprite(sprites, lane.panel.h - inset * 2, lane.unit)
  if (marker === null) return
  ctx.drawImage(
    marker.image,
    Math.round(lane.nowX - marker.width / 2),
    Math.round(lane.panel.y + inset),
  )
}

/** A stretch of the singer's curve that went one way: where it starts, and its pieces. */
interface TrailRun {
  readonly verdict: Verdict
  readonly from: Knot
  readonly pieces: ReturnType<typeof catmullRom>
}

/** The singer's curve as runs of one verdict each, and where it ends. */
function trailRuns(
  lane: LaneGeometry,
  frame: LaneFrame,
): {
  readonly runs: TrailRun[]
  readonly last: TrailPoint | null
  readonly lastAt: Knot | null
} {
  const runs: TrailRun[] = []
  let last: TrailPoint | null = null
  let lastAt: Knot | null = null
  for (const stroke of strokesOf(frame.points)) {
    const smooth = smoothStroke(stroke)
    const knots = smooth.map((point) => ({
      x: timeX(lane, point.time, frame.position),
      y: pitchY(lane, frame.band, point.midi),
    }))
    const pieces = catmullRom(knots)
    let run: {
      verdict: Verdict
      from: Knot
      pieces: TrailRun['pieces']
    } | null = null
    for (let index = 0; index < pieces.length; index += 1) {
      const verdict = smooth[index + 1].verdict
      if (run === null || run.verdict !== verdict) {
        run = { verdict, from: knots[index], pieces: [] }
        runs.push(run)
      }
      run.pieces.push(pieces[index])
    }
    last = smooth.at(-1) ?? last
    lastAt = knots.at(-1) ?? lastAt
  }
  return { runs, last, lastAt }
}

/** Draws the singer's curve, fading behind the marker; says where it ends. */
function drawTrail(
  ctx: CanvasRenderingContext2D,
  lane: LaneGeometry,
  frame: LaneFrame,
): { readonly point: TrailPoint; readonly at: Knot } | null {
  const { runs, last, lastAt } = trailRuns(lane, frame)
  const unit = lane.unit
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const verdict of ['free', 'off', 'hit'] as const) {
    const mine = runs.filter((run) => run.verdict === verdict)
    if (mine.length === 0) continue
    ctx.beginPath()
    for (const run of mine) {
      ctx.moveTo(run.from.x, run.from.y)
      for (const piece of run.pieces) {
        ctx.bezierCurveTo(
          piece.c1.x,
          piece.c1.y,
          piece.c2.x,
          piece.c2.y,
          piece.to.x,
          piece.to.y,
        )
      }
    }
    const color = VERDICT_COLORS[verdict]
    const glow = fadeBehind(ctx, lane, color.glow)
    // A soft glow, a dark edge that keeps the core clear of a lit note under
    // it, and the bright core. On the note, the note's own light is the
    // glow, so the curve's is kept low. One glow, not two: the widest
    // stroke is the costliest thing in the frame (measured at 4K, 3 ms of
    // a 9 ms frame in headless Chromium for a 28-unit one).
    const soft = verdict === 'hit' ? 0.6 : 1
    const layers = [
      [glow, 18, 0.28 * soft],
      [fadeBehind(ctx, lane, '10, 6, 22'), 8.5, 0.32],
      [fadeBehind(ctx, lane, color.core), 5.5, 1],
    ] as const
    for (const [style, width, alpha] of layers) {
      ctx.strokeStyle = style
      ctx.globalAlpha = alpha
      ctx.lineWidth = width * unit
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
  return last === null || lastAt === null ? null : { point: last, at: lastAt }
}

/** A colour that fades out toward the lane's left end, behind the marker. */
function fadeBehind(
  ctx: CanvasRenderingContext2D,
  lane: LaneGeometry,
  rgb: string,
): CanvasGradient {
  return horizontalGradient(ctx, lane.panel.x, lane.nowX, [
    [0, `rgba(${rgb}, 0)`],
    [0.55, `rgba(${rgb}, 0.45)`],
    [1, `rgba(${rgb}, 1)`],
  ])
}

/** The glass fogging over at both ends of the panel, over what runs off them. */
function drawFog(
  ctx: CanvasRenderingContext2D,
  lane: LaneGeometry,
  sprites: SpriteCache,
): void {
  const panel = panelSprite(
    sprites,
    { w: lane.panel.w, h: lane.panel.h, unit: lane.unit },
    LANE_NOW_RATIO,
  )
  if (panel === null) return
  const width = EDGE_FOG * lane.unit
  const height = Math.round(lane.panel.h)
  const left = Math.round(lane.panel.x)
  const top = Math.round(lane.panel.y)
  for (const side of ['left', 'right'] as const) {
    const fog = fogSprite(sprites, panel, { side, width, height })
    if (fog === null) continue
    const x = side === 'left' ? left : left + panel.width - fog.width
    ctx.drawImage(fog.image, x, top)
  }
}

/** A glowing dot where the singer is now, while they are singing. */
function drawSingerNow(
  ctx: CanvasRenderingContext2D,
  lane: LaneGeometry,
  of: {
    readonly last: { readonly point: TrailPoint; readonly at: Knot } | null
    readonly frame: LaneFrame
  },
  sprites: SpriteCache,
): void {
  const last = of.last
  if (last === null || of.frame.position - last.point.time > DOT_FRESH_SEC)
    return
  const { x, y } = last.at
  if (last.point.verdict === 'hit') {
    // On the note: it flares where the singer meets it.
    const flare = flareSprite(sprites, lane.unit)
    if (flare !== null) {
      ctx.drawImage(
        flare.image,
        Math.round(x - flare.width / 2),
        Math.round(y - flare.height / 2),
      )
    }
  }
  const dot = dotSprite(sprites, last.point.verdict, lane.unit)
  if (dot === null) return
  ctx.drawImage(
    dot.image,
    Math.round(x - dot.width / 2),
    Math.round(y - dot.height / 2),
  )
}

/** The name of the note under the marker, in a chip at the marker's top. */
function drawChip(
  ctx: CanvasRenderingContext2D,
  lane: LaneGeometry,
  frame: LaneFrame,
  sprites: SpriteCache,
): void {
  const note = noteAt(frame.sorted, frame.position)
  if (note === null) return
  const chip = chipSprite(sprites, lane.unit)
  if (chip === null) return
  const edge = 0.12
  const share = Math.min(
    1,
    (frame.position - note.t0) / edge,
    (note.t1 - frame.position) / edge,
  )
  const y = lane.panel.y + 42 * lane.unit
  ctx.globalAlpha = Math.max(0, share)
  ctx.drawImage(
    chip.image,
    Math.round(lane.nowX - chip.width / 2),
    Math.round(y - chip.height / 2),
  )
  ctx.font = stageFont(700, 32 * lane.unit)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffe7a8'
  ctx.fillText(noteName(note.midi), lane.nowX, y + 1 * lane.unit)
  ctx.globalAlpha = 1
}
