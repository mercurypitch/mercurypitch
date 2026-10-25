// ============================================================
// Lesson 12 rooms — the chords as rooms on the ring, the key turn, the corner slide and the walk
// ============================================================
//
// The ring of rooms is the kit's spiral seen from above, so one turn is a
// ring of twelve and C4 to B4 sit on it (WEB-SPEC, Toys 1 and 2; FACTS 22).
// A room is a chord's three notes joined as a triangle, drawn each frame in
// the spiral's overlay from where its beads landed, so it stays on the ring
// however a drag, Shift with an arrow or a flick has turned it:
// `setTurning(false)` stops only the drift. A note's bead is picked by its
// name on the lit turn, `s = m - LO` for m from 60 to 71, whatever octave
// sounds, since until the camera reaches the top the frame also holds the
// other turns' beads.
//
// Every room is chrome, whatever its quality, with a halo round each
// corner; the lit room has a brighter line and a faint fill, the others are
// faint, and the ring's centre names the lit room (Look; Toys 1).
//
// Three things move, each a function of the frame's time and the state:
// - the key switch turns every room seven semitones, 210 degrees, in 0.6 s,
//   each corner travelling round the ring's centre bead by bead, on the
//   easing the page passes in (Toys 1 gives it the expo-out curve);
// - Play I, then vi slides I's corner on G two beads round to A in the
//   0.3 s between the chords while C and E hold, and the room it lands is
//   vi's (FACTS 21, 69); in G it slides D to E (FACTS 69a). The spec times
//   the slide but gives it no curve, so it takes the same easing;
// - a tune's walk (Toys 5): the sounding note's bead pulses, ink between
//   corners, gold with a ring round it on a corner of its chord's room
//   (Look), and a blue line runs bead to bead, each stretch drawing on
//   from the note before as its own note starts, as Lesson 2's trail does,
//   so the line never runs ahead of the voice; the count sits under the
//   ring. Once the tune ends or is stopped, the line fades to faint and
//   stays, with the count, until the next play.
// Under reduced motion every turn and slide lands at once, and the walk
// draws each segment whole as its note starts, with no travel (Look).
//
// Gold marks only the fit, and only while a tune plays: nothing else here is
// gold, so before the cold open's choice, when the page passes no walk, the
// ring cannot answer the predict (FACTS 1a; Look).
//
// `roomsAnimating` says whether anything is still moving, so the page's
// overlay can let the frame loop rest once everything has landed.

import { clamp, lerp, TAU } from '@/features/lessons/kit/dom'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import type { SpiralFrame } from '@/features/lessons/kit/spiral'
import type { BeadHit } from '@/features/lessons/kit/spiral-draw'
import { LO, pulseOf } from '@/features/lessons/kit/spiral-keys'
import { GLOW_SEC } from '@/features/lessons/kit/tune-line-motion'
import { centreLabel, cornerCount } from './lines'
import type { KeyName, TuneId, TuneNote } from './music'
import { chordsOf, LOOP_DEGREES, LOOP_SEC, roomOf, tuneOf } from './music'
import { I_THEN_VI_SLIDE } from './sounds'

/** The key switch turns every room seven semitones round the ring, 210 degrees (Toys 1; FACTS 22). */
export const TURN_SEMITONES = 7
/** The key switch's turn takes 0.6 s (Toys 1). */
export const TURN_SEC = 0.6
/** The walk's line fades to faint over the kit's tune line glow, since the spec does not time it. */
export const WALK_FADE_SEC = GLOW_SEC
/** The walk's newest stretch draws on over 0.3 s from its note's start, as the newest stretch of Lesson 2's trail does. */
export const STRETCH_SEC = 0.3

/** The turn lit from above starts on C4 (Toys 1 and 2, `ring: 60`). */
const RING_FROM = 60
/** A corner's halo radius, against a bead's; a room's edges stop at it. */
const HALO = 1.6
/** The gold ring a corner note grows round its bead, against a bead's radius. */
const GOLD_RING = 2.3
/** The line's alpha while a tune plays, and once it has faded. */
const LINE_FULL = 0.9
const LINE_FAINT = 0.3

/** An easing from 0 to 1, as the page passes it: the kit's expo-out. */
export type Ease = (t: number) => number

/** The last key switch: the key the rooms turned from, and when, ms on the frame's clock. */
export interface KeyTurn {
  readonly from: KeyName
  readonly at: number
}

/** A play, from when it started (ms on the frame's clock), its lengths `by` times (2 under Slow). */
export interface Play {
  readonly at: number
  readonly by: number
}

/** A tune play and its walk: which tune, in which key, and when a stop cut it short. */
export interface WalkPlay extends Play {
  readonly id: TuneId
  readonly key: KeyName
  readonly stoppedAt: number | null
}

/** The centre's label: none on the hero, the name in Step 1, the numeral first from Step 2. */
export type LabelMode = 'none' | 'name' | 'numeral'

/** What the ring shows. Times are on the frame's clock, `SpiralFrame.now`, in ms. */
export interface RoomsState {
  /** The key the rooms stand in. */
  readonly key: KeyName
  readonly turn: KeyTurn | null
  /** The rooms drawn, by degree, 0 do to 6 ti. */
  readonly rooms: readonly number[]
  /** The lit room's degree, or null. A slide or a playing walk decides it while it runs. */
  readonly lit: number | null
  readonly label: LabelMode
  /** The compact layout: the label sits in the figure's top-left corner (Toys 1). */
  readonly compact: boolean
  /** Play I, then vi, or null. While set, it decides the lit room: I until the corner lands, vi after. */
  readonly slide: Play | null
  readonly walk: WalkPlay | null
  readonly reduced: boolean
}

interface Point {
  readonly x: number
  readonly y: number
}

const pcOf = (n: number): number => ((n % 12) + 12) % 12

// -------------------------------------------------------------- time, pure

/** How far the key turn has gone, eased: 1 with no turn, once it has landed, or under reduced motion. */
function turnDone(state: RoomsState, now: number, ease: Ease): number {
  const turn = state.turn
  if (turn === null || turn.from === state.key || state.reduced) return 1
  const k = clamp((now - turn.at) / (TURN_SEC * 1000), 0, 1)
  return k === 1 ? 1 : ease(k)
}

/** Where the slide starts and lands, ms on the frame's clock: in the quiet between I and vi. */
function slideSpan(slide: Play): { start: number; end: number } {
  const start = slide.at + I_THEN_VI_SLIDE.t * slide.by * 1000
  return { start, end: start + I_THEN_VI_SLIDE.dur * slide.by * 1000 }
}

/** How far the slide has gone, 0 on I's corner to 1 on vi's: at once under reduced motion. */
function slideDone(slide: Play, now: number, reduced: boolean): number {
  const { start, end } = slideSpan(slide)
  if (reduced) return now >= start ? 1 : 0
  return clamp((now - start) / (end - start), 0, 1)
}

/** When a walk ends, ms: the play's 8.0 s, or the stop that cut it short (FACTS 68). */
function walkEnd(walk: WalkPlay): number {
  const end = walk.at + LOOP_SEC * walk.by * 1000
  return walk.stoppedAt === null ? end : Math.min(end, walk.stoppedAt)
}

/** A walk at one moment. */
interface WalkNow {
  readonly notes: readonly TuneNote[]
  /** How many notes have begun. */
  readonly heard: number
  readonly playing: boolean
  /** The note sounding, or null. */
  readonly sounding: number | null
  /** How far the newest stretch has drawn on, from the note before to the newest note's bead, 0 to 1. */
  readonly head: number
  /** The line's alpha. */
  readonly alpha: number
}

/** The walk at `now`: every value from the tune's own timings (FACTS 35 to 37), scaled by Slow. */
function walkAt(walk: WalkPlay, now: number, reduced: boolean): WalkNow {
  const notes = tuneOf(walk.id, walk.key)
  const ms = (t: number): number => walk.at + t * walk.by * 1000
  const end = walkEnd(walk)
  const playing = now < end
  const heard = notes.filter((n) => ms(n.t) <= now && ms(n.t) < end).length
  const last = heard > 0 && playing ? notes[heard - 1] : null
  const sounding =
    last !== null && now < ms(last.t + last.dur) ? heard - 1 : null
  // the newest stretch leaves the note before as its own note starts and
  // lands 0.3 s later, or as the next note starts if that comes sooner
  // (tune 2's short notes); once the walk ends or stops, it is whole
  let head = 1
  if (last !== null && !reduced) {
    const from = ms(last.t)
    const next = heard < notes.length ? ms(notes[heard].t) : Infinity
    const travel = Math.min(STRETCH_SEC * walk.by * 1000, next - from)
    head = clamp((now - from) / travel, 0, 1)
  }
  return {
    notes,
    heard,
    playing,
    sounding,
    head,
    alpha: lineAlpha(now, end, reduced),
  }
}

/** The line's alpha: full while the tune plays, then fading to faint, at once under reduced motion. */
function lineAlpha(now: number, end: number, reduced: boolean): number {
  if (now < end) return LINE_FULL
  const fade = reduced ? 0 : 1 - (now - end) / (WALK_FADE_SEC * 1000)
  return lerp(LINE_FAINT, LINE_FULL, clamp(fade, 0, 1))
}

/**
 * Whether anything on the ring is still moving at `now`: the key turn for
 * its 0.6 s, a slide until its corner lands, a walk while it plays and while
 * its line fades. Under reduced motion only a playing walk keeps it going,
 * so each segment appears as its note starts.
 */
export function roomsAnimating(state: RoomsState, now: number): boolean {
  const { turn, slide, walk, reduced } = state
  const turning =
    turn !== null &&
    turn.from !== state.key &&
    !reduced &&
    now - turn.at < TURN_SEC * 1000
  const sliding =
    slide !== null &&
    (reduced ? now < slideSpan(slide).start : now < slideSpan(slide).end)
  const walking =
    walk !== null && now < walkEnd(walk) + (reduced ? 0 : WALK_FADE_SEC * 1000)
  return turning || sliding || walking
}

// -------------------------------------------------------------- the ring this frame

interface Ring {
  readonly c: Point
  readonly radius: number
  /** The largest of the ring's beads, for the halos. */
  readonly bead: number
  /** A note's bead on the lit turn, by its name: whole semitones from C. */
  readonly beadAt: (n: number) => BeadHit | undefined
}

/** The lit turn's bead for a place on the ring, semitones from C, in any octave. */
const beadFor = (beads: readonly BeadHit[], n: number): BeadHit | undefined =>
  beads.find((b) => b.s === RING_FROM + pcOf(n) - LO)

/** The ring this frame, from the lit turn's beads: null until it has drawn at least three. */
function ringOf(beads: readonly BeadHit[]): Ring | null {
  const ring = beads.filter(
    (b) => b.s >= RING_FROM - LO && b.s < RING_FROM - LO + 12,
  )
  if (ring.length < 3) return null
  const c = {
    x: ring.reduce((n, b) => n + b.x, 0) / ring.length,
    y: ring.reduce((n, b) => n + b.y, 0) / ring.length,
  }
  const radius =
    ring.reduce((n, b) => n + Math.hypot(b.x - c.x, b.y - c.y), 0) / ring.length
  const bead = Math.max(...ring.map((b) => b.r))
  return { c, radius, bead, beadAt: (n) => beadFor(beads, n) }
}

/** A place on the ring, semitones from C: a bead, or round the centre between two neighbours. */
function onRing(ring: Ring, at: number): Point | undefined {
  const lo = Math.floor(at)
  const f = at - lo
  const a = ring.beadAt(lo)
  const b = ring.beadAt(lo + 1)
  if (a === undefined || b === undefined) return undefined
  if (f < 1e-9) return a
  if (f > 1 - 1e-9) return b
  const { c } = ring
  const a0 = Math.atan2(a.y - c.y, a.x - c.x)
  const a1 = Math.atan2(b.y - c.y, b.x - c.x)
  // neighbours are a semitone apart, so the short way between them is the ring's
  const turn = ((((a1 - a0) % TAU) + TAU + Math.PI) % TAU) - Math.PI
  const angle = a0 + turn * f
  const r = lerp(
    Math.hypot(a.x - c.x, a.y - c.y),
    Math.hypot(b.x - c.x, b.y - c.y),
    f,
  )
  return { x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) }
}

// -------------------------------------------------------------- which rooms, where

/** A room as drawn this frame: its corners as places on the ring, and whether it is lit. */
interface Placed {
  readonly at: readonly number[]
  readonly lit: boolean
}

/** I's corner that vi does not share, and how far round it goes to land on vi's: G to A, two (FACTS 21). */
function slideCorner(key: KeyName): { index: number; by: number } {
  const chords = chordsOf(key)
  const one = roomOf(chords[0]).corners
  const six = roomOf(chords[5]).corners
  const index = one.findIndex((c) => !six.includes(c))
  const to = six.find((c) => !one.includes(c)) ?? one[index]
  return { index, by: pcOf(to - one[index]) }
}

/** The lit room and its corners: a slide's room while it runs, a playing walk's chord, or the state's. */
function litRoom(
  state: RoomsState,
  now: number,
  ease: Ease,
): { degree: number; at: number[] } | null {
  const chords = chordsOf(state.key)
  const corners = (d: number): number[] => [...roomOf(chords[d]).corners]
  if (state.slide !== null) {
    const k = slideDone(state.slide, now, state.reduced)
    if (k === 1) return { degree: 5, at: corners(5) }
    const { index, by } = slideCorner(state.key)
    const at = corners(0)
    at[index] += by * (state.reduced ? k : ease(k))
    return { degree: 0, at }
  }
  if (state.walk !== null) {
    const w = walkAt(state.walk, now, state.reduced)
    if (w.playing && w.heard > 0) {
      const d = LOOP_DEGREES[w.notes[w.heard - 1].bar]
      return { degree: d, at: corners(d) }
    }
  }
  return state.lit === null
    ? null
    : { degree: state.lit, at: corners(state.lit) }
}

/** Every room to draw this frame, the faint ones first, turned as far as the key switch has gone. */
function placeRooms(
  state: RoomsState,
  now: number,
  ease: Ease,
): { rooms: Placed[]; lit: number | null } {
  const lit = litRoom(state, now, ease)
  // G turns the rooms seven semitones on; C turns them back
  const way = state.key === 'G' ? 1 : -1
  const offset = -way * TURN_SEMITONES * (1 - turnDone(state, now, ease))
  const chords = chordsOf(state.key)
  // the lit room is drawn once, lit; a slide's room is I becoming vi, so neither stays behind
  const skip = state.slide !== null ? [0, 5] : [lit?.degree]
  const faint = state.rooms
    .filter((d) => !skip.includes(d))
    .map((d) => ({
      at: roomOf(chords[d]).corners.map((p) => p + offset),
      lit: false,
    }))
  if (lit === null) return { rooms: faint, lit: null }
  const litPlaced = { at: lit.at.map((p) => p + offset), lit: true }
  return { rooms: [...faint, litPlaced], lit: lit.degree }
}

// -------------------------------------------------------------- drawing

/** A room's triangle: a faint fill when lit, then its edges, each stopping at the corners' halos. */
function drawRoom(
  ctx: CanvasRenderingContext2D,
  at: readonly Point[],
  halo: number,
  lit: boolean,
): void {
  if (lit) {
    ctx.fillStyle = rgba(COLOR.chrome, 0.08)
    ctx.beginPath()
    ctx.moveTo(at[0].x, at[0].y)
    at.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.closePath()
    ctx.fill()
  }
  ctx.strokeStyle = rgba(COLOR.chrome, lit ? 0.9 : 0.35)
  ctx.lineWidth = lit ? 1.5 : 1
  ctx.beginPath()
  at.forEach((a, i) => {
    const b = at[(i + 1) % at.length]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (d <= 2 * halo) return
    const ux = (b.x - a.x) / d
    const uy = (b.y - a.y) / d
    ctx.moveTo(a.x + ux * halo, a.y + uy * halo)
    ctx.lineTo(b.x - ux * halo, b.y - uy * halo)
  })
  ctx.stroke()
}

/** The halos round every corner drawn, each once, bright where a corner of the lit room. */
function drawHalos(
  ctx: CanvasRenderingContext2D,
  placed: readonly { at: readonly Point[]; lit: boolean }[],
  halo: number,
): void {
  const halos = new Map<string, { p: Point; lit: boolean }>()
  for (const room of placed)
    for (const p of room.at) {
      const id = `${p.x.toFixed(1)},${p.y.toFixed(1)}`
      halos.set(id, { p, lit: room.lit || halos.get(id)?.lit === true })
    }
  ctx.lineWidth = 1.5
  for (const { p, lit } of halos.values()) {
    ctx.strokeStyle = rgba(COLOR.chrome, lit ? 0.85 : 0.35)
    ctx.beginPath()
    ctx.arc(p.x, p.y, halo, 0, TAU)
    ctx.stroke()
  }
}

/** The walk's blue line, bead to bead, each segment stopping at the beads' edges; the newest draws on. */
function drawLine(ctx: CanvasRenderingContext2D, ring: Ring, w: WalkNow): void {
  const beads = w.notes.map((n) => ring.beadAt(n.midi))
  const trim = ring.bead + 2
  const ends = (i: number): [Point, Point] | null => {
    const a = beads[i]
    const b = beads[i + 1]
    if (a === undefined || b === undefined) return null
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (d <= 2 * trim) return null
    const ux = (b.x - a.x) / d
    const uy = (b.y - a.y) / d
    return [
      { x: a.x + ux * trim, y: a.y + uy * trim },
      { x: b.x - ux * trim, y: b.y - uy * trim },
    ]
  }
  ctx.strokeStyle = rgba(COLOR.blue, w.alpha)
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i + 1 < w.heard; i++) {
    const e = ends(i)
    // the stretch into the newest note draws on as far as `head`
    const f = i + 2 === w.heard ? w.head : 1
    if (e === null || f <= 0) continue
    const [a, b] = e
    ctx.moveTo(a.x, a.y)
    if (f < 1) ctx.lineTo(lerp(a.x, b.x, f), lerp(a.y, b.y, f))
    else ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()
}

/** The sounding note's bead: an ink pulse between corners; on a corner, a gold glow and a gold ring. */
function drawSounding(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  note: TuneNote,
  light: number,
): void {
  const b = ring.beadAt(note.midi)
  if (b === undefined) return
  const colour = note.corner ? COLOR.gold : COLOR.ink
  const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, ring.bead * 2.6)
  glow.addColorStop(0, rgba(colour, 0.55 * light))
  glow.addColorStop(1, rgba(colour, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(b.x, b.y, ring.bead * 2.6, 0, TAU)
  ctx.fill()
  if (!note.corner) return
  ctx.strokeStyle = COLOR.gold
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(b.x, b.y, ring.bead * GOLD_RING, 0, TAU)
  ctx.stroke()
}

/** The walk: its line, the sounding note's mark while the tune plays, and the count under the ring. */
function drawWalk(
  ctx: CanvasRenderingContext2D,
  frame: SpiralFrame,
  ring: Ring,
  state: RoomsState,
): void {
  if (state.walk === null) return
  const w = walkAt(state.walk, frame.now, state.reduced)
  if (w.heard === 0) return
  drawLine(ctx, ring, w)
  if (w.sounding !== null) {
    const note = w.notes[w.sounding]
    const onset = state.walk.at + note.t * state.walk.by * 1000
    // the kit's bead pulse as the note starts; steady under reduced motion
    const pulse = pulseOf(new Map([[note.midi, onset]]), note.midi, frame.now)
    drawSounding(ctx, ring, note, state.reduced ? 1 : 0.4 + 0.6 * pulse)
  }
  const on = w.notes.slice(0, w.heard).filter((n) => n.corner).length
  ctx.font = '600 13px Outfit, sans-serif'
  ctx.fillStyle = COLOR.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const y = Math.min(ring.c.y + ring.radius + ring.bead + 22, frame.H - 10)
  ctx.fillText(cornerCount(on, w.heard), ring.c.x, y)
}

/** The lit room's name in the ring's centre, or in the top-left corner in the compact layout. */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  state: RoomsState,
  lit: number,
): void {
  const text = centreLabel(chordsOf(state.key)[lit], state.label === 'numeral')
  ctx.font = '600 14px Outfit, sans-serif'
  ctx.fillStyle = COLOR.ink
  ctx.textBaseline = 'middle'
  ctx.textAlign = state.compact ? 'left' : 'center'
  if (state.compact) ctx.fillText(text, 10, 14)
  else ctx.fillText(text, ring.c.x, ring.c.y)
}

/**
 * Draws the rooms over one frame of the spiral seen from above, then the
 * walk and the labels, to `ctx` alone, and returns whether anything is still
 * moving (`roomsAnimating`). Draws nothing until the frame has drawn the lit
 * turn's beads, or once the spiral unrolls.
 */
export function drawRooms(
  ctx: CanvasRenderingContext2D,
  frame: SpiralFrame,
  state: RoomsState,
  ease: Ease,
): boolean {
  const animating = roomsAnimating(state, frame.now)
  const ring = ringOf(frame.beads)
  if (ring === null || frame.u > 0.05) return animating
  const { rooms, lit } = placeRooms(state, frame.now, ease)
  const placed = rooms
    .map((r) => ({ at: r.at.map((n) => onRing(ring, n)), lit: r.lit }))
    .filter((r): r is { at: Point[]; lit: boolean } =>
      r.at.every((p) => p !== undefined),
    )
  const halo = ring.bead * HALO
  placed.forEach((r) => drawRoom(ctx, r.at, halo, r.lit))
  drawHalos(ctx, placed, halo)
  drawWalk(ctx, frame, ring, state)
  if (lit !== null && state.label !== 'none') drawLabel(ctx, ring, state, lit)
  return animating
}
