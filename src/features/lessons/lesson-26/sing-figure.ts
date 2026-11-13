// ============================================================
// Lesson 26 Sing it's figure — your part's bands, the other part's beads, the cursor and the count-in
// ============================================================
//
// The figure under Your turn (WEB-SPEC, Toys 5, states 5 to 8, 10 and 11),
// on the kit's band chart with a lane a semitone, G's notes named by
// syllable and note, "la · E3": the part the learner sings as amber bands
// over its own beats (kit/band-chart-rungs.ts), each band lit while its
// note sounds in the model and in the sing-along, never in a take; the
// other part's notes as chrome beads beside them, each with a faint line
// as long as it sounds, and lit as it sounds; the cursor, the chart's
// faint upright rule, moving at the beat; and the count-in strip, four
// dots in the plot's top corner, beat 1's the larger, a dot lit a click.
// The time axis is the take's (kit/take-in-time.ts): half a beat before bar
// 1 to a quarter of a beat after the last note, so after a run the
// learner's pitch line lands on the same bands, folded into the part's
// octave, with the octave tag where it applies. The canvas says the parts
// in words; the status line says each state.

import type { BandChart, BandScene } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import type { ChartFrame } from '@/features/lessons/kit/band-chart-draw'
import { xOf, yOf } from '@/features/lessons/kit/band-chart-draw'
import { rungNames } from '@/features/lessons/kit/band-chart-names'
import type { Rung } from '@/features/lessons/kit/band-chart-rungs'
import { paintRungs } from '@/features/lessons/kit/band-chart-rungs'
import { octaveTag } from '@/features/lessons/kit/band-words'
import { q } from '@/features/lessons/kit/dom'
import { wake } from '@/features/lessons/kit/frame-loop'
import { COLOR, rgba, sharpOf, signName } from '@/features/lessons/kit/notes'
import type { PitchLine } from '@/features/lessons/kit/pitch-line'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import type { Part } from './sing-plan'
import { AXIS, beatsOf, BPM } from './sing-plan'

/** A bead's radius, px, at rest and lit. */
const BEAD = { rest: 4.5, lit: 6.5 } as const

/** The count-in strip: a dot's radius, beat 1's, the gap between them and the inset from the plot's corner, px. */
const STRIP = { r: 3.5, first: 5, gap: 16, inset: 12 } as const

/**
 * What the figure paints over the chart: the other part's note lit, and
 * the count-in's dots lit. It lives in the chart's scene (`over`), since
 * the chart draws only when what it compares changes, and a click of the
 * count-in changes nothing else.
 */
interface Over {
  readonly other: number | null
  readonly counted: number
}

const NOTHING_OVER: Over = { other: null, counted: 0 }

/** What `scene` has painted over it: nothing lit after `set`, whose new target blanks the scene. */
const overOf = (scene: BandScene): Over =>
  (scene.over as Over | undefined) ?? NOTHING_OVER

/** Seconds a beat lasts. */
const SPB = 60 / BPM

/** Seconds across the axis: half a beat before bar 1 to a quarter of a beat after the last note. */
export const AXIS_SEC = (AXIS.lead + 6 + AXIS.tail) * SPB

/** Where beat `b` from bar 1's first beat falls on the axis, s. */
export const axisAt = (b: number): number => (AXIS.lead + b) * SPB

/** A part's notes as bands on the axis, cents from its first note, each as long as it sounds. */
export function bandsOf(part: Part, lit: number | null): Rung[] {
  const zero = part.midis[0]
  return beatsOf(part.midis).map((n, i) => {
    const from = axisAt(n.beat)
    return {
      c: (n.midi - zero) * 100,
      from,
      to: from + heldSeconds(n.beats, BPM),
      glow: i === lit ? 1 : 0,
    }
  })
}

/** The rows named on the axis: each note of both parts once, low to high, "la · E3". */
export function rowsOf(
  mine: Part,
  other: Part,
): (readonly [midi: number, name: string])[] {
  const rows = new Map<number, string>()
  for (const p of [mine, other])
    p.midis.forEach((midi, i) => {
      rows.set(midi, `${p.syllables[i]} · ${signName(sharpOf(midi))}`)
    })
  return [...rows].sort(([a], [b]) => a - b)
}

export interface SingFigure {
  readonly chart: BandChart
  /** Draws a set: `mine` as bands, `other` as beads; the line, the cursor and the count cleared; `words` on the canvas. */
  set(mine: Part, other: Part, words: string): void
  /** Lights your part's note `i`, or none. */
  mine(i: number | null): void
  /** Lights the other part's note `i`, or none. */
  other(i: number | null): void
  /** The cursor at `t` s on the axis, or none. */
  cursor(t: number | null): void
  /** The count-in strip with `n` dots lit, 0 to 4. */
  count(n: number): void
  /** A run's pitch line over the bands, with its octave tag and its words; null takes it away. */
  pitch(p: PitchLine | null, words?: string): void
}

/** The figure in `#singChart`. */
export function mountSingFigure(): SingFigure {
  const root = q('#singChart')
  const tag = q('[data-octave-tag]', root)
  let mine: Part | null = null
  let other: Part | null = null
  // the chart's zero: the first note of the part sung, as the take's pitch line has it
  let zero = 55
  let litMine: number | null = null
  let words = ''

  /** The other part's beads, the count-in strip: over the bands and the line. */
  function paintOver(f: ChartFrame, scene: BandScene): void {
    const { ctx } = f
    const { other: litOther, counted } = overOf(scene)
    if (other !== null)
      beatsOf(other.midis).forEach((n, j) => {
        const y = yOf(f, (n.midi - zero) * 100)
        const x0 = xOf(f, axisAt(n.beat))
        const x1 = xOf(f, axisAt(n.beat) + heldSeconds(n.beats, BPM))
        const lit = j === litOther
        ctx.strokeStyle = rgba(COLOR.chrome, lit ? 0.7 : 0.3)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x0, y)
        ctx.lineTo(x1, y)
        ctx.stroke()
        ctx.save()
        if (lit) {
          ctx.shadowColor = rgba(COLOR.chrome, 0.8)
          ctx.shadowBlur = 10
        }
        ctx.fillStyle = rgba(COLOR.chrome, lit ? 1 : 0.6)
        ctx.beginPath()
        ctx.arc(x0, y, lit ? BEAD.lit : BEAD.rest, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
    for (let k = 0; k < 4; k++) {
      const x = f.x1 - STRIP.inset - (3 - k) * STRIP.gap
      const y = f.top + STRIP.inset
      const r = k === 0 ? STRIP.first : STRIP.r
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      if (k < counted) {
        ctx.fillStyle = COLOR.ink
        ctx.fill()
      } else {
        ctx.strokeStyle = rgba(COLOR.ink3, 0.8)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }
  }

  const chart = mountBandChart(root, {
    target: zero,
    window: AXIS_SEC,
    paintRungs,
    paintOver,
  })

  const bands = (): void => {
    if (mine !== null) chart.scene.rungs = bandsOf(mine, litMine)
    wake()
  }

  return {
    chart,
    set(m, o, w) {
      mine = m
      other = o
      zero = m.midis[0]
      litMine = null
      words = w
      const all = [...m.midis, ...o.midis]
      chart.setAxis({
        notes: [Math.min(...all) - 1, Math.max(...all) + 1],
        names: rungNames(rowsOf(m, o)),
      })
      chart.setTarget(zero)
      chart.setWindow(AXIS_SEC)
      chart.scene.line = []
      chart.scene.playhead = null
      tag.hidden = true
      chart.describe(w)
      bands()
    },
    mine(i) {
      litMine = i
      bands()
    },
    other(i) {
      chart.scene.over = { ...overOf(chart.scene), other: i }
      wake()
    },
    cursor(t) {
      chart.scene.playhead = t
      wake()
    },
    count(n) {
      chart.scene.over = { ...overOf(chart.scene), counted: n }
      wake()
    },
    pitch(p, said) {
      chart.scene.line = p === null ? [] : [...p.line]
      if (p !== null && mine !== null) chart.scene.rungs = [...p.rungs]
      else bands()
      const t = p === null ? null : octaveTag(p.octaves, 0)
      tag.hidden = t === null
      tag.textContent = t ?? ''
      chart.describe(p === null ? words : (said ?? words))
      wake()
    },
  }
}
