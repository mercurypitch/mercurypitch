// ============================================================
// Pitch line — a take drawn over its written notes, after the take
// ============================================================
//
// Drawn after a take, never during one (Lesson 16 WEB-SPEC, Toys 6, state
// 7; FACTS 46), as Lesson 9's chart draws a take: the kit's band chart with
// a lane a semitone, each written note the take reached an amber band over
// the stretch it was lit (band-chart-rungs.ts), and the learner's line in
// violet over them, folded into the written notes' octave. When most of
// the voice sat an octave or more away, the tag says so: "octave lower"
// (band-words.ts `octaveTag`). The rows name the phrase's notes as Lesson
// 9 names its ladder's, "re · A3", and a black key by its sharp, as the
// app's pitch line names it: "ti · F♯3". Nothing lights and nothing celebrates a
// note: the lines under the chart do the reading (FACTS 47). Lesson 16's
// read-along take and the in-time take (take-in-time.ts, Lessons 18 and
// 26) both hand one over, and each loads with its take's module on the
// first Start, so first paint carries no chart.

import type { BandChart, TracePoint } from './band-chart'
import { mountBandChart } from './band-chart'
import { rungNames } from './band-chart-names'
import type { Rung } from './band-chart-rungs'
import { paintRungs } from './band-chart-rungs'
import { octaveTag } from './band-words'
import { q } from './dom'
import { sharpOf, signName } from './notes'
import { octaveLine } from './take'

/** A take's pitch line, in seconds across its window and cents from do (a take's `pitchLineOf`). */
export interface PitchLine {
  /** Seconds across: from the first voiced frame to the take's end, or an in-time take's bars, half a beat before bar 1 to the last window's close. */
  readonly seconds: number
  /** Each written note: a band over the stretch the take lit it, or over its own beats. */
  readonly rungs: readonly Rung[]
  /** The voice, each frame folded into the octave of the written note nearest it; a gap where none was heard. */
  readonly line: readonly TracePoint[]
  /** Whole octaves most of the voice sat from the written notes: -1 an octave lower, 0 in theirs. */
  readonly octaves: number
}

/** The chart on each root, mounted on the first take drawn there. */
const charts = new WeakMap<HTMLElement, BandChart>()

/** The phrase's rows, each written note once, low to high: "re · A3", "ti · F♯3". */
export function rowsOf(
  notes: readonly number[],
  labels: readonly string[],
): (readonly [midi: number, name: string])[] {
  const rows = new Map<number, string>()
  notes.forEach((midi, i) => {
    rows.set(midi, `${labels[i].toLowerCase()} · ${signName(sharpOf(midi))}`)
  })
  return [...rows].sort(([a], [b]) => a - b)
}

/** What the canvas says: the phrase's notes in order, and the octave when the line was folded into theirs. */
export function summaryOf(labels: readonly string[], octaves: number): string {
  const notes = labels.map((l) => l.toLowerCase()).join(', ')
  const octave = octaveLine(0, octaves, 'notes')
  const folded =
    octave === null ? '' : ` ${octave} It is drawn in their octave.`
  return `Your pitch line over the written notes' bands: ${notes}.${folded}`
}

/**
 * Draws `pitch`, a take over `notes` (MIDI, in order, do first), each
 * labelled by its syllable, in `root`: the chart's frame with its canvas
 * and octave tag. Returns the chart, mounted on the first take drawn there.
 */
export function drawPitchLine(
  root: HTMLElement,
  pitch: PitchLine,
  notes: readonly number[],
  labels: readonly string[],
): BandChart {
  const doMidi = notes[0]
  const axis = {
    notes: [Math.min(...notes) - 1, Math.max(...notes) + 1] as const,
    names: rungNames(rowsOf(notes, labels)),
  }
  let chart = charts.get(root)
  if (chart === undefined) {
    chart = mountBandChart(root, {
      target: doMidi,
      axis,
      window: pitch.seconds,
      paintRungs,
    })
    charts.set(root, chart)
  } else {
    chart.setAxis(axis)
    chart.setTarget(doMidi)
    chart.setWindow(pitch.seconds)
  }
  const scene = chart.scene
  scene.rungs = [...pitch.rungs]
  scene.line = [...pitch.line]
  const tag = octaveTag(pitch.octaves, 0)
  const tagEl = q('[data-octave-tag]', root)
  tagEl.hidden = tag === null
  tagEl.textContent = tag ?? ''
  chart.describe(summaryOf(labels, pitch.octaves))
  return chart
}
