// ============================================================
// Lesson 2 keys layer — the keyboard that straightens into a row of tiles
// ============================================================
//
// The kit's spiral unrolls into a keyboard; this layer (the kit's `keys`
// hook) draws that keyboard, and goes on from it, one object throughout:
//   - Straighten: the octave's keys glide into the row of equal tiles, one
//     per semitone, a "1" under each neighbouring pair, B–C and E–F
//     flashing gold once; the keys outside the octave glide off the edges.
//   - Lift out the five: the five dark tiles rise, leaving five holes a tone
//     wide and two touching pairs a semitone apart; Drop back returns them
//     one by one, with "7 + 5 = 12".
//   - Step bars: two keys played one after the other draw a bar between
//     them, labelled with its number of semitones.
//   - Names: every key carries its names in the page's spelling; the Sharp
//     and Flat arrows write the names they give, and a key given two names
//     gets one gold ring.
// Each copy has its own model, so step 3's keyboard, step 4's row, step 5's
// names and free play's object never share a state. Under reduced motion
// every one of these lands in its end state with no travel.

import { clamp, easeInOut } from '@/features/lessons/kit/dom'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { Spelling } from '@/features/lessons/kit/names'
import { namesFor } from '@/features/lessons/kit/names'
import { COLOR, isBlack, rgba } from '@/features/lessons/kit/notes'
import type { KeysFrame } from '@/features/lessons/kit/spiral'
import type { KeysLayer } from '@/features/lessons/kit/spiral-draw'
import type { Keyboard, KeyHit } from '@/features/lessons/kit/spiral-keys'
import { LO, pulseOf } from '@/features/lessons/kit/spiral-keys'
import type { Rect, TileRow } from './keys-geometry'
import { beadPoint, glideRect, keyNotes, keysLayout, keyTarget, phonePanMax, TARGET, tileRow, tilesTakeTaps, tileTarget, tileX, } from './keys-geometry'
import { darkNames, focusRing, footName, goldRing, namesMiddle, paintAbove, paintKey, smallLabel, stepArrow, stepBar, } from './keys-paint'
import type { ArrowStep, WrittenNames } from './names-arrows'
import { namesAbove, writtenNames } from './names-arrows'
import type { BarList } from './step-bars'
import { barList, barSize } from './step-bars'

/** A span of semitones from A2, low and high. */
export type Span = readonly [number, number]

/** A dark tile's rise: where it is (0 in the row, 1 lifted), where it is going, and from when. */
interface Lift {
  v: number
  to: number
  from: number
}

/** An arrow on its way, from `at` (ms) on. */
interface ArrowRun {
  readonly step: ArrowStep
  readonly at: number
  landed: boolean
}

export interface KeysModel {
  /** 0 the keyboard, 1 the tile row; and where it is going. */
  straight: number
  straightTo: number
  /** The tile row on a wide stage, and on a phone (step 5 closes up on B3 to F4). */
  tiles: Span
  phoneTiles: Span
  /** The "1" under each neighbouring pair (steps 3 and 4). */
  pairs: boolean
  /** The phone keyboard's offset from A3, in white keys. */
  pan: number
  panTo: number
  readonly lifts: Map<number, Lift>
  lifted: boolean
  readonly bars: BarList
  /**
   * Until when (ms) the notes played are an example's: its bars are its own,
   * not every pair of its notes, even if no frame drew while it played.
   */
  quietUntil: number
  /** True while the copy shows its keys: notes played on the spiral's beads draw no bars. */
  keysOn: boolean
  readonly written: WrittenNames
  /** "Show the rare ones": the four white keys' second names. */
  rare: boolean
  readonly arrows: ArrowRun[]
  /** When each key took its gold ring, ms. */
  readonly rings: Map<number, number>
  /** When B–C and E–F flash gold, and when "7 + 5 = 12" shows. */
  flashAt: number | null
  sumAt: number | null
  /** True from Drop back until the last dark tile is home, when the sum shows. */
  sumDue: boolean
  /** The last frame's canvas width and whether it was a phone's. */
  W: number
  narrow: boolean
  lastNow: number
  lastScan: number
  /** Hears each arrow as it lands (for the page's spoken line). */
  onLand?: (step: ArrowStep) => void
  /** Hears the canvas change width (a phone's pan box shows or hides). */
  onResize?: () => void
}

export function keysModel(o: {
  tiles: Span
  phoneTiles: Span
  pairs: boolean
  straight?: number
}): KeysModel {
  const straight = o.straight ?? 0
  return {
    straight,
    straightTo: straight,
    tiles: o.tiles,
    phoneTiles: o.phoneTiles,
    pairs: o.pairs,
    pan: 0,
    panTo: 0,
    lifts: new Map(),
    lifted: false,
    bars: barList(),
    quietUntil: 0,
    keysOn: straight > 0,
    written: writtenNames(),
    rare: false,
    arrows: [],
    rings: new Map(),
    flashAt: null,
    sumAt: null,
    sumDue: false,
    W: 0,
    narrow: false,
    lastNow: 0,
    lastScan: 0,
  }
}

/** The tile row this model shows on a canvas of its width. */
export const tileSpan = (m: KeysModel, narrow: boolean): Span =>
  narrow ? m.phoneTiles : m.tiles

/** True when the keys are (or are becoming) the tile row. */
export const isStraight = (m: KeysModel): boolean => m.straightTo > 0.5

/** Moves `v` towards `to` at `rate` a second; at once under reduced motion. */
function ease(v: number, to: number, dt: number, rate: number): number {
  if (reducedMotion()) return to
  const d = to - v
  return Math.abs(d) < 0.001
    ? to
    : v + Math.sign(d) * Math.min(Math.abs(d), dt * rate)
}

function advanceLifts(m: KeysModel, now: number, dt: number): void {
  let home = true
  for (const lift of m.lifts.values()) {
    if (now >= lift.from) lift.v = ease(lift.v, lift.to, dt, 2.4)
    if (lift.v !== 0) home = false
  }
  // the last tile home after Drop back: "7 + 5 = 12"
  if (m.sumDue && home) {
    m.sumDue = false
    m.sumAt = now
  }
}

function advanceArrows(m: KeysModel, now: number): void {
  for (const run of m.arrows) {
    if (run.landed || now < run.at + 600) continue
    run.landed = true
    m.written.add(run.step)
    if (m.written.ringed(run.step.to) && !m.rings.has(run.step.to))
      m.rings.set(run.step.to, now)
    m.onLand?.(run.step)
  }
  // an arrow fades once its name has stood for a while
  for (let i = m.arrows.length - 1; i >= 0; i--)
    if (now > m.arrows[i].at + 3800) m.arrows.splice(i, 1)
}

/** One frame's motion: the glide, the lifts, the pan, the arrows. */
export function advance(m: KeysModel, now: number): void {
  const dt = clamp((now - m.lastNow) / 1000, 0, 0.05)
  m.lastNow = now
  const was = m.straight
  m.straight = ease(m.straight, m.straightTo, dt, 1 / 1.1)
  if (was < 1 && m.straight === 1 && !reducedMotion()) m.flashAt = now
  m.pan = ease(m.pan, m.panTo, dt, 6)
  advanceLifts(m, now, dt)
  advanceArrows(m, now)
}

/** Notes played on the copy since the last frame: each pairs with the one before it, into a bar. */
function scanPulses(m: KeysModel, pulses: ReadonlyMap<number, number>): void {
  const heard = [...pulses.entries()]
    .filter(([, t]) => t > m.lastScan)
    .sort((a, b) => a[1] - b[1])
  for (const [midi, t] of heard) {
    m.lastScan = Math.max(m.lastScan, t)
    if (m.keysOn && t > m.quietUntil) m.bars.note(midi, t)
  }
}

/** Where a note's key or tile is drawn this frame, risen if it is lifted. */
function rectOf(kb: Keyboard, row: TileRow, m: KeysModel, s: number): Rect {
  const r = glideRect(kb, row, s, m.straight)
  const lift = m.lifts.get(s)?.v ?? 0
  if (lift === 0) return r
  return { ...r, y: r.y - easeInOut(lift) * (row.h + 22) }
}

/** The notes this frame draws, semitones from A2. */
function notesOf(m: KeysModel, narrow: boolean): number[] {
  const [lo, hi] = keyNotes(narrow)
  const [tlo, thi] = tileSpan(m, narrow)
  const from = m.straight > 0 ? Math.min(lo, tlo) : lo
  const to = m.straight > 0 ? Math.max(hi, thi) : hi
  const out: number[] = []
  for (let s = from; s <= to; s++) out.push(s)
  return out
}

interface Paint {
  readonly ctx: CanvasRenderingContext2D
  readonly kb: Keyboard
  readonly row: TileRow
  readonly m: KeysModel
  readonly frame: KeysFrame
  /** The keys' opacity as the spiral unrolls into them, 0 to 1. */
  readonly ka: number
}

/** A key's labels: on the keyboard its own names; as a tile, the arrows' and the rare ones too. */
function labelKey(p: Paint, r: Rect, s: number, spelling: Spelling): void {
  const midi = LO + s
  const tiles = p.m.straight >= 0.5
  if (!isBlack(midi)) {
    footName(p.ctx, r, midi)
    if (tiles) paintAbove(p.ctx, r, namesAbove(midi, p.m.written, p.m.rare))
    return
  }
  const written = tiles ? p.m.written.on(midi) : []
  darkNames(p.ctx, r, written.length > 0 ? written : namesFor(midi, spelling))
}

function drawKeys(p: Paint): void {
  const { ctx, kb, row, m, frame } = p
  const spelling = frame.view.spelling
  const notes = notesOf(m, frame.view.narrow)
  const [lo, hi] = tileSpan(m, frame.view.narrow)
  // white keys first, then the black ones over them; keys outside the row fade as it straightens
  for (const black of [false, true]) {
    for (const s of notes) {
      if (isBlack(LO + s) !== black) continue
      const fade = s < lo || s > hi ? 1 - m.straight : 1
      const r = rectOf(kb, row, m, s)
      if (fade <= 0.01 || r.x + r.w < 0 || r.x > frame.W) continue
      ctx.globalAlpha = p.ka * fade
      paintKey(ctx, r, LO + s, pulseOf(frame.view.pulses, LO + s, frame.now))
      labelKey(p, r, s, spelling)
    }
  }
  ctx.globalAlpha = p.ka
}

function drawBars(p: Paint): void {
  const { ctx, kb, m } = p
  const alpha = 1 - m.straight
  if (alpha <= 0) return
  for (const bar of m.bars.bars) {
    const lo = Math.min(bar.from, bar.to) - LO
    const xs: number[] = []
    for (let s = lo; s <= lo + barSize(bar); s++) xs.push(kb.keyPos(s).x)
    const y = kb.kbTop + kb.kbH + 14 + bar.row * 22
    stepBar(ctx, xs, y, alpha)
  }
}

/** True for the boundary between B and C, or E and F (the semitones with no key between). */
const halfStepPair = (s: number): boolean => {
  const pc = (LO + s) % 12
  return pc === 11 || pc === 4
}

function pairColor(m: KeysModel, s: number, now: number): string {
  if (m.flashAt === null || !halfStepPair(s)) return COLOR.ink3
  const t = (now - m.flashAt) / 1600
  if (t >= 1) return COLOR.ink3
  return rgba(COLOR.gold, 0.55 + 0.45 * Math.sin(Math.PI * t))
}

/** Lifted: "tone" over each of the five holes, "semitone" under the two pairs that touch. */
function drawLiftLabels(p: Paint, lift: number): void {
  const { ctx, row } = p
  const below = row.top + row.h + 16
  for (let s = row.from; s <= row.to; s++) {
    if (s < row.to && halfStepPair(s))
      smallLabel(ctx, 'semitone', tileX(row, s + 1), below, COLOR.ink2)
    if (isBlack(LO + s)) {
      const x = tileX(row, s) + row.tileW / 2
      smallLabel(ctx, 'tone', x, row.top - 11, rgba(COLOR.ink2, lift))
    }
  }
}

/** The labels under and over the row: the "1"s, or once lifted, "tone" and "semitone". */
function drawRowLabels(p: Paint): void {
  const { ctx, row, m, frame } = p
  if (m.straight < 0.98) return
  const below = row.top + row.h + 16
  const lift = Math.max(0, ...[...m.lifts.values()].map((l) => l.v))
  if (lift > 0.5) {
    drawLiftLabels(p, lift)
    return
  }
  // the "1"s step aside while an arrow bows over or under the row
  if (m.pairs && m.arrows.length === 0)
    for (let s = row.from; s < row.to; s++)
      smallLabel(ctx, '1', tileX(row, s + 1), below, pairColor(m, s, frame.now))
  if (m.sumAt !== null && lift === 0)
    smallLabel(ctx, '7 + 5 = 12', frame.W / 2, below + 26, COLOR.ink)
}

function drawRings(p: Paint): void {
  const { ctx, kb, row, m, frame } = p
  if (m.straight < 0.98) return
  for (const [midi, at] of m.rings) {
    const s = midi - LO
    const r = rectOf(kb, row, m, s)
    const c = namesMiddle(r, 2)
    const settle = reducedMotion() ? 1 : clamp((frame.now - at) / 500, 0, 1)
    goldRing(ctx, c.x, c.y, Math.min(r.w * 0.46, 22), settle)
  }
}

function drawArrows(p: Paint): void {
  const { ctx, kb, row, m, frame } = p
  if (m.straight < 0.98) return
  for (const run of m.arrows) {
    if (frame.now < run.at) continue
    const a = rectOf(kb, row, m, run.step.from - LO)
    const b = rectOf(kb, row, m, run.step.to - LO)
    const side = run.step.dir === 'sharp' ? -1 : 1
    const y = (r: Rect): number => (side < 0 ? r.y - 4 : r.y + r.h + 4)
    const t = reducedMotion() ? 1 : clamp((frame.now - run.at) / 600, 0, 1)
    const alpha = 1 - clamp((frame.now - run.at - 3200) / 600, 0, 1)
    const path = {
      from: { x: a.x + a.w / 2, y: y(a) },
      to: { x: b.x + b.w / 2, y: y(b) },
      side,
    } as const
    const label = side < 0 ? '+1 semitone' : '−1 semitone'
    stepArrow(ctx, path, 1 - (1 - t) ** 2, alpha, label)
  }
}

function drawFocus(p: Paint): void {
  const { ctx, kb, row, m, frame } = p
  if (!frame.view.focused) return
  focusRing(ctx, rectOf(kb, row, m, frame.view.sel))
}

/** The keyboard's tap targets, the black keys' zones first: the kit tries them in order. */
function keyTargets(p: Paint): KeyHit[] {
  const { kb, frame } = p
  const narrow = frame.view.narrow
  const [lo, hi] = keyNotes(narrow)
  const whites: KeyHit[] = []
  const blacks: KeyHit[] = []
  for (let s = lo; s <= hi; s++) {
    const h = keyTarget(kb, s, narrow ? TARGET : 0)
    if (h.x + h.w <= 0 || h.x >= frame.W) continue
    ;(h.white ? whites : blacks).push(h)
  }
  return [...blacks, ...whites]
}

/** The row's tap targets, each tile its full width (and none at all when they are narrower than 44 px). */
function tileTargets(p: Paint): KeyHit[] {
  const { row, m, frame } = p
  if (!tilesTakeTaps(row)) return []
  const [lo, hi] = tileSpan(m, frame.view.narrow)
  const hits: KeyHit[] = []
  for (let s = lo; s <= hi; s++) {
    const h = tileTarget(row, s)
    const lift = m.lifts.get(s)?.v ?? 0
    hits.push(
      lift === 0 ? h : { ...h, y: h.y - easeInOut(lift) * (row.h + 22) },
    )
  }
  return hits
}

/** Where each key or tile takes taps this frame. */
const targets = (p: Paint): KeyHit[] =>
  p.m.straight < 0.5 ? keyTargets(p) : tileTargets(p)

/** The layer for the kit's `keys` option: built each frame from the copy's model. */
export function keysLayer(m: KeysModel): (frame: KeysFrame) => KeysLayer {
  return (frame) => {
    advance(m, frame.now)
    scanPulses(m, frame.view.pulses)
    if (m.W !== frame.W || m.narrow !== frame.view.narrow) {
      m.W = frame.W
      m.narrow = frame.view.narrow
      m.panTo = clamp(m.panTo, 0, m.narrow ? phonePanMax(m.W) : 0)
      m.onResize?.()
    }
    const kb = keysLayout(frame.W, frame.H, frame.view.narrow, m.pan)
    const [lo, hi] = tileSpan(m, frame.view.narrow)
    const row = tileRow(frame.W, frame.H, lo, hi, frame.view.narrow ? 0 : 12)
    return {
      keyPos: (s) => beadPoint(kb, row, s, m.straight),
      draw(ctx, ka) {
        const p: Paint = { ctx, kb, row, m, frame, ka }
        ctx.save()
        ctx.globalAlpha = ka
        drawBars(p)
        drawKeys(p)
        drawRowLabels(p)
        drawRings(p)
        drawArrows(p)
        drawFocus(p)
        ctx.restore()
        return targets(p)
      },
    }
  }
}

/** Starts the five dark tiles rising (or, `up` false, dropping back one by one). */
export function liftFive(m: KeysModel, up: boolean, now: number): void {
  m.lifted = up
  m.sumAt = null
  m.sumDue = !up
  const [lo, hi] = tileSpan(m, m.narrow)
  let k = 0
  for (let s = lo; s <= hi; s++) {
    if (!isBlack(LO + s)) continue
    const lift = m.lifts.get(s) ?? { v: 0, to: 0, from: now }
    lift.to = up ? 1 : 0
    // one after another, or under reduced motion all at once
    lift.from = reducedMotion() ? now : now + k * (up ? 60 : 320)
    m.lifts.set(s, lift)
    k++
  }
}

/** Sends an arrow from a key; its name lands with the second note, 0.6 s later. */
export function sendArrow(m: KeysModel, step: ArrowStep, now: number): void {
  m.arrows.push({ step, at: reducedMotion() ? now - 600 : now, landed: false })
  // the arrows' labels take the lines under the row: the sum has had its moment
  m.sumAt = null
}

/** Clears the arrows' names and rings, for a fresh start (Play both ways). */
export function clearNames(m: KeysModel): void {
  m.arrows.length = 0
  m.written.clear()
  m.rings.clear()
}

/** The selection's reach on this model: the drawn keys, or the tile row once straightened. */
export function keysRange(m: KeysModel): Span {
  const [lo, hi] = isStraight(m) ? tileSpan(m, m.narrow) : keyNotes(m.narrow)
  return [LO + lo, LO + hi]
}
