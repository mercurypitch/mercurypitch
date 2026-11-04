// ============================================================
// Lesson 13 vowel voice — Merc's "ooh" made of the model's source and resonances
// ============================================================
//
// Each sung line is one of the kit's contour voices in Merc's kind, so it
// keeps his vibrato, his attack and release and his gain (FACTS 43), shaped
// by a timbre (kit/sound.ts's hook): the oscillator's wave is the source,
// every harmonic of the note up to 4,000 Hz at 1/k of the first, unscaled,
// so a play's power is the model's; and the voice's lowpass is the first of
// three lowpass biquads in series, one at each of the vowel's resonances,
// with Q set in decibels, 20 log10 of the frequency over the bandwidth
// (FACTS 40). A change of vowel glides each filter's frequency
// exponentially and its Q linearly, on the audio clock, at the points the
// line's schedule gives (plays.ts), while the note's frequency never moves.
// The source alone passes its lowpass as an all-pass: no resonance at all.
//
// This lives here, not in kit/sound.ts, so no other lesson's first paint
// carries it. The page's live strip is never an analysis of this sound:
// both read the one schedule, and no AnalyserNode exists on the page.

import type { Run } from '@/features/lessons/kit/run'
import { playLine } from '@/features/lessons/kit/run'
import type { Timbre } from '@/features/lessons/kit/sound'
import type { Line } from './plays'
import { lineGain, linePoints, partialsOf } from './plays'

/** A resonator's Q as the Web Audio filter takes it: decibels. */
export const qDb = (q: number): number => 20 * Math.log10(q)

/** The timbre that sings `line`: its source as the wave, its resonances as filters gliding at its points. */
export function vowelTimbre(line: Line): Timbre {
  const points = linePoints(line)
  const partials = partialsOf(line)
  return (filter, envelope, at, parts) => {
    // the kit builds the voice's oscillator first (kit/sound.ts, `Timbre`)
    const osc = parts[0] as OscillatorNode
    const context = filter.context
    const real = new Float32Array(partials.length + 1)
    const imag = new Float32Array(partials.length + 1)
    partials.forEach((a, i) => {
      imag[i + 1] = a
    })
    osc.setPeriodicWave(
      context.createPeriodicWave(real, imag, { disableNormalization: true }),
    )
    const first = points[0]?.res ?? []
    if (first.length === 0) {
      filter.type = 'allpass'
      filter.connect(envelope)
      return
    }
    const filters = first.map((_, i) => {
      if (i === 0) return filter
      const f = context.createBiquadFilter()
      f.type = 'lowpass'
      return f
    })
    filters.forEach((f, i) => {
      f.frequency.setValueAtTime(first[i].hz, at)
      f.Q.setValueAtTime(qDb(first[i].q), at)
      for (const p of points.slice(1)) {
        f.frequency.exponentialRampToValueAtTime(p.res[i].hz, at + p.t)
        f.Q.linearRampToValueAtTime(qDb(p.res[i].q), at + p.t)
      }
      if (i > 0) filters[i - 1].connect(f)
    })
    filters[filters.length - 1].connect(envelope)
  }
}

/** Sings `line` in Merc's voice: a run whose promise says whether it was heard to its end. */
export function singLine(line: Line, audible: boolean): Run {
  return playLine(linePoints(line), {
    audible,
    kind: 'merc',
    gain: lineGain(line),
    timbre: vowelTimbre(line),
  })
}

/** A pure tone: the four words' harmonics, a soft tone made of its first partial alone. */
export const PURE: Timbre = (filter, envelope, _at, parts) => {
  ;(parts[0] as OscillatorNode).type = 'sine'
  filter.connect(envelope)
}
