// ============================================================
// Lesson 5 breath gauge — one long note's breath, drawn after Sundberg
// ============================================================
//
// The gauge of WEB-SPEC Toys 3, drawn after Sundberg's Fig. 4 (FACTS 18 to
// 20, 74) with no numbers on it: one 10-second note across, and up the side
// a push of air, labelled "push of air (not pitch)" so the falling line is
// never read as a pitch line. The lungs' own push falls in a straight line
// (chrome); what the note needs is flat (gold, the series' colour for the
// fit). Where the lungs push harder than the note needs, the body holds
// back; where they push less, it adds: two hatched regions, two patterns.
// A quiet note needs little, so the crossing falls late, at 7 s; a loud one
// needs more, so it falls early, at 3 s, and needs less holding back.
//
// Pure geometry and words here (breath-gauge.test.ts); toy-breath.ts plays
// it.

import { COLOR, rgba } from '@/features/lessons/kit/notes'

export type NoteLevel = 'quiet' | 'loud'

/** Seconds of the gauge's note. */
export const GAUGE_SEC = 10
/** Where what the note needs crosses the lungs' push, seconds (FACTS 74). */
export const CROSSING: Readonly<Record<NoteLevel, number>> = {
  quiet: 7,
  loud: 3,
}

/** The lungs' push `t` seconds into the note, as a share of the gauge's height: a straight fall. */
export const lungsPush = (t: number): number => 0.9 - (0.8 * t) / GAUGE_SEC

/** What the note needs, flat: the lungs' push at the crossing. */
export const noteNeeds = (n: NoteLevel): number => lungsPush(CROSSING[n])

export type Balance = 'holding back' | 'adding'

/** What the body does `t` seconds in: holds back before the crossing, adds after it. */
export const balanceAt = (n: NoteLevel, t: number): Balance =>
  t < CROSSING[n] ? 'holding back' : 'adding'

const NAME: Readonly<Record<NoteLevel, string>> = {
  quiet: 'Quiet',
  loud: 'Loud',
}

/** The gauge's spoken summary: "Quiet note: for the first 7 of 10 seconds ...". */
export const gaugeSummary = (n: NoteLevel): string =>
  `${NAME[n]} note: for the first ${CROSSING[n]} of ${GAUGE_SEC} seconds the lungs push harder than the note needs, so the body holds back; after that it adds`

/** The two phases, listed, as reduced motion shows them. */
export const gaugePhases = (n: NoteLevel): string[] => [
  `The first ${CROSSING[n]} seconds: holding back`,
  `The last ${GAUGE_SEC - CROSSING[n]} seconds: adding`,
]

/** The cursor's readout: "Now: holding back". */
export const nowWords = (n: NoteLevel, t: number): string =>
  `Now: ${balanceAt(n, t)}`

const MONO = '500 12px "JetBrains Mono", monospace'

/** The gauge's plot inside a w by h canvas. */
export interface GaugeFrame {
  readonly ctx: CanvasRenderingContext2D
  readonly x0: number
  readonly x1: number
  readonly top: number
  readonly bottom: number
}

export function gaugeFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): GaugeFrame {
  return { ctx, x0: 34, x1: w - 14, top: 34, bottom: h - 30 }
}

const gx = (f: GaugeFrame, t: number): number =>
  f.x0 + (Math.min(Math.max(t, 0), GAUGE_SEC) / GAUGE_SEC) * (f.x1 - f.x0)
const gy = (f: GaugeFrame, v: number): number =>
  f.bottom - v * (f.bottom - f.top)

/** Fills the region between the lungs' line and the need line from `t0` to `t1` with a hatch. */
function hatch(
  f: GaugeFrame,
  n: NoteLevel,
  t0: number,
  t1: number,
  pattern: 'diagonal' | 'level',
): void {
  const { ctx } = f
  const need = gy(f, noteNeeds(n))
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(gx(f, t0), gy(f, lungsPush(t0)))
  ctx.lineTo(gx(f, t1), gy(f, lungsPush(t1)))
  ctx.lineTo(gx(f, t1), need)
  ctx.lineTo(gx(f, t0), need)
  ctx.closePath()
  ctx.fillStyle = rgba(COLOR.chrome, 0.05)
  ctx.fill()
  ctx.clip()
  ctx.strokeStyle = rgba(COLOR.chrome, 0.32)
  ctx.lineWidth = 1
  ctx.beginPath()
  const h = f.bottom - f.top
  if (pattern === 'diagonal') {
    for (let x = f.x0 - h; x < f.x1; x += 9) {
      ctx.moveTo(x, f.bottom)
      ctx.lineTo(x + h, f.top)
    }
  } else {
    for (let y = f.top; y < f.bottom; y += 6) {
      ctx.moveTo(f.x0, y)
      ctx.lineTo(f.x1, y)
    }
  }
  ctx.stroke()
  ctx.restore()
}

function text(
  f: GaugeFrame,
  words: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  colour: string = COLOR.ink3,
): void {
  const { ctx } = f
  ctx.font = MONO
  ctx.fillStyle = colour
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(words, x, y)
}

/** The side axis: a push of air, never a pitch, with no scale. */
function axis(f: GaugeFrame): void {
  const { ctx } = f
  ctx.strokeStyle = rgba(COLOR.chrome, 0.3)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(f.x0, f.top - 6)
  ctx.lineTo(f.x0, f.bottom)
  ctx.lineTo(f.x1, f.bottom)
  ctx.stroke()
  ctx.save()
  ctx.translate(f.x0 - 14, (f.top + f.bottom) / 2)
  ctx.rotate(-Math.PI / 2)
  text(f, 'PUSH OF AIR (NOT PITCH)', 0, 0, 'center')
  ctx.restore()
  text(f, '0', f.x0, f.bottom + 14, 'left')
  text(f, `${GAUGE_SEC} s: ONE NOTE`, f.x1, f.bottom + 14, 'right')
}

/** The two lines and their names: the lungs' fall in chrome, what the note needs in gold. */
function lines(f: GaugeFrame, n: NoteLevel): void {
  const { ctx } = f
  const need = gy(f, noteNeeds(n))
  ctx.strokeStyle = COLOR.chrome
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(gx(f, 0), gy(f, lungsPush(0)))
  ctx.lineTo(gx(f, GAUGE_SEC), gy(f, lungsPush(GAUGE_SEC)))
  ctx.stroke()
  ctx.strokeStyle = COLOR.gold
  ctx.beginPath()
  ctx.moveTo(f.x0, need)
  ctx.lineTo(f.x1, need)
  ctx.stroke()
  text(f, "THE LUNGS' OWN PUSH", gx(f, 0.15), gy(f, lungsPush(0)) - 14, 'left')
  const late = CROSSING[n] < GAUGE_SEC / 2
  text(
    f,
    'WHAT THE NOTE NEEDS',
    late ? f.x1 - 4 : gx(f, 0.15),
    need + (late ? -12 : 14),
    late ? 'right' : 'left',
    COLOR.gold,
  )
}

/** The two regions' names, each inside its own region. */
function regionNames(f: GaugeFrame, n: NoteLevel): void {
  const c = CROSSING[n]
  const need = noteNeeds(n)
  const back = c * 0.55
  text(
    f,
    'HELD BACK',
    gx(f, back),
    gy(f, (lungsPush(back) + need) / 2),
    'center',
    COLOR.ink2,
  )
  const add = c + (GAUGE_SEC - c) * 0.6
  text(
    f,
    'ADDED',
    gx(f, add),
    gy(f, (lungsPush(add) + need) / 2),
    'center',
    COLOR.ink2,
  )
}

/** The whole gauge for one frame; `cursor` is the playhead in seconds, or null. */
export function drawGauge(
  f: GaugeFrame,
  n: NoteLevel,
  cursor: number | null,
): void {
  const c = CROSSING[n]
  axis(f)
  hatch(f, n, 0, c, 'diagonal')
  hatch(f, n, c, GAUGE_SEC, 'level')
  lines(f, n)
  regionNames(f, n)
  if (cursor === null) return
  const { ctx } = f
  const x = gx(f, cursor)
  ctx.strokeStyle = rgba(COLOR.ink, 0.7)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, f.top - 6)
  ctx.lineTo(x, f.bottom)
  ctx.stroke()
  for (const [v, colour] of [
    [lungsPush(cursor), COLOR.chrome],
    [noteNeeds(n), COLOR.gold],
  ] as const) {
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.arc(x, gy(f, v), 4.5, 0, Math.PI * 2)
    ctx.fill()
  }
}
