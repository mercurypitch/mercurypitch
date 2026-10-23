// ============================================================
// Tests: glide-coverage.ts
// ============================================================

import { describe, expect, it } from 'vitest'
import { SIREN_GUIDE_PERIOD_MS, sirenGlideMaxRate, sirenGuideMidi, } from '@/features/exercises/siren/use-siren-controller'
import { computeGlideCoverage } from './glide-coverage'

describe('computeGlideCoverage', () => {
  // Frames come at the display's refresh rate, so every take is built at
  // three rates and must score alike at each.
  const RATES = [30, 60, 120]
  const WINDOW_MS = 4000
  // The Siren's guide dot reaches the far note in half a period, 1.25 s.
  const PACE_MS = SIREN_GUIDE_PERIOD_MS / 2

  /** The note sung `ms` into the window, or null where no frame is voiced. */
  type Line = (ms: number) => number | null
  interface Take {
    label: string
    from: number
    to: number
    line: Line
  }

  const frames = (fps: number, line: Line) => {
    const out: Array<{ midi: number; time: number }> = []
    for (let i = 0; i < Math.round((WINDOW_MS / 1000) * fps); i++) {
      const midi = line((i / fps) * 1000)
      if (midi !== null) out.push({ midi, time: i / fps })
    }
    return out
  }
  /** The take's score at each of the three rates. */
  const scores = ({ from, to, line }: Take) =>
    RATES.map((fps) =>
      computeGlideCoverage(
        frames(fps, line),
        from,
        to,
        sirenGlideMaxRate(from, to),
      ),
    )

  // Glide at `k` times the dot's pace, then hold the second note.
  const glide =
    (from: number, to: number, k = 1) =>
    (t: number) =>
      from + (to - from) * Math.min(1, (t * k) / PACE_MS)
  // Hold the first note, then from `at` move to the second along a raised
  // cosine over `ms`: a real voice cannot change note in no time at all.
  const move =
    (from: number, to: number, ms: number, at = 2000) =>
    (t: number) =>
      t < at
        ? from
        : t >= at + ms
          ? to
          : from + ((to - from) * (1 - Math.cos((Math.PI * (t - at)) / ms))) / 2
  const vibrato = (extent: number) => (t: number) =>
    extent * Math.sin((2 * Math.PI * 5.5 * t) / 1000)
  // Tracker noise in [-0.5, 0.5), the same at a given time at every rate.
  const noise = (t: number) => {
    const x = Math.sin(t * 12.9898) * 43758.5453
    return x - Math.floor(x) - 0.5
  }

  const JUMPS: Take[] = [3, 5, 8].flatMap((span) =>
    [100, 150].map((ms) => ({
      label: `a ${span}-semitone jump over ${ms} ms`,
      from: 60,
      to: 60 + span,
      line: move(60, 60 + span, ms),
    })),
  )
  const GLIDES: Take[] = [3, 5, 8].flatMap((span) =>
    [1, 2, 3].map((k) => ({
      label: `a ${span}-semitone glide at ${k} times the dot's pace`,
      from: 60,
      to: 60 + span,
      line: glide(60, 60 + span, k),
    })),
  )
  const VIBRATO: Take = {
    label: 'an 8-semitone glide with ±0.5 semitone vibrato',
    from: 60,
    to: 68,
    line: (t) => glide(60, 68)(t) + vibrato(0.5)(t),
  }
  // Gliding up from 60 at the dot's pace, the voice flips 5 semitones in
  // 30 ms at 61.5 and glides on to 68: 3 of the 8 semitones are glided.
  const flipAt = ((61.5 - 60) / 8) * PACE_MS
  const FLIP: Take = {
    label: 'a 5-semitone flip in an 8-semitone glide',
    from: 60,
    to: 68,
    line: (t) =>
      t < flipAt
        ? glide(60, 68)(t)
        : t < flipAt + 30
          ? move(61.5, 66.5, 30, flipAt)(t)
          : Math.min(68, glide(60, 68)(t) + 5),
  }
  const NOISE: Take = {
    label: 'a held note with ±15 cents of tracker noise',
    from: 60,
    to: 63,
    line: (t) => 60 + noise(t) * 0.3,
  }
  // The first note, 300 ms with no voiced frame, then the second note.
  const GAPS: Take[] = [3, 5, 8].map((span) => ({
    label: `a ${span}-semitone round with a silent gap`,
    from: 60,
    to: 60 + span,
    line: (t) => (t < 2000 ? 60 : t < 2300 ? null : 60 + span),
  }))

  it('gives a jump after a held note at most a fifth of the span', () => {
    for (const take of JUMPS) {
      expect(Math.max(...scores(take)), take.label).toBeLessThanOrEqual(0.2)
    }
  })

  it('scores a smooth glide in full, at up to three times the dot pace', () => {
    for (const take of GLIDES) {
      expect(Math.min(...scores(take)), take.label).toBeGreaterThanOrEqual(0.99)
    }
  })

  it('lets vibrato ride on a wide glide', () => {
    expect(Math.min(...scores(VIBRATO))).toBeGreaterThanOrEqual(0.95)
  })

  it('scores a flip by the ground glided either side of it', () => {
    for (const score of scores(FLIP)) {
      expect(score).toBeGreaterThanOrEqual(0.3)
      expect(score).toBeLessThanOrEqual(0.4)
    }
  })

  it('gives a held note with tracker noise almost nothing', () => {
    expect(Math.max(...scores(NOISE))).toBeLessThanOrEqual(0.1)
  })

  it('gives nothing for silence followed by the second note', () => {
    // The step across the gap is slow enough to pass as a glide, but the
    // frames either side of an unvoiced gap are not one.
    for (const take of GAPS) expect(scores(take), take.label).toEqual([0, 0, 0])
  })

  it('still counts a glide across a frame or two the tracker dropped', () => {
    // At 30 frames a second, two frames in every ten go missing.
    const dropped = frames(30, glide(60, 67)).filter((_, i) => i % 10 < 8)
    expect(
      computeGlideCoverage(dropped, 60, 67, sirenGlideMaxRate(60, 67)),
    ).toBeGreaterThanOrEqual(0.99)
  })

  it('scores each take alike at 30, 60 and 120 frames a second', () => {
    for (const take of [...JUMPS, ...GLIDES, VIBRATO, FLIP, NOISE, ...GAPS]) {
      const s = scores(take)
      expect(Math.max(...s) - Math.min(...s), take.label).toBeLessThanOrEqual(
        0.15,
      )
    }
  })

  it('counts only the motion toward the second note', () => {
    // The same smooth line, sung from the second note to the first.
    const backwards = glide(67, 60)
    expect(scores({ label: '', from: 60, to: 67, line: backwards })).toEqual([
      0, 0, 0,
    ])
    for (const score of scores({
      label: '',
      from: 67,
      to: 60,
      line: backwards,
    }))
      expect(score).toBeGreaterThanOrEqual(0.99)
  })

  it('scores an overshoot that comes back to the second note in full', () => {
    // Up to 69 and back down to 67: the frames past it lie outside the span.
    const line = (t: number) =>
      t < 1600 ? 60 + 9 * (t / 1600) : Math.max(67, 69 - (t - 1600) / 300)
    for (const score of scores({ label: '', from: 60, to: 67, line }))
      expect(score).toBeGreaterThanOrEqual(0.99)
  })

  it('gives a glide an octave low nothing', () => {
    const line = (t: number) => glide(60, 67)(t) - 12
    expect(scores({ label: '', from: 60, to: 67, line })).toEqual([0, 0, 0])
  })

  it('credits a glide that starts late in the window', () => {
    const line = (t: number) => (t < 2500 ? null : glide(60, 67)(t - 2500))
    for (const score of scores({ label: '', from: 60, to: 67, line }))
      expect(score).toBeGreaterThanOrEqual(0.99)
  })

  it('neither rewards nor penalises going back over ground already glided', () => {
    // The Siren's guide dot travels to the far note and back; a singer
    // following it glides the same ground twice.
    const line = (t: number) => sirenGuideMidi(60, 67, t)
    for (const score of scores({ label: '', from: 60, to: 67, line }))
      expect(score).toBeGreaterThanOrEqual(0.95)
  })

  it('scores a note held where the glide should start, or end, as almost 0', () => {
    // Even a held note with a wide vibrato crosses little of the span.
    for (const centre of [60, 67]) {
      const line = (t: number) => centre + vibrato(0.5)(t)
      for (const score of scores({ label: '', from: 60, to: 67, line }))
        expect(score).toBeLessThan(0.1)
    }
  })

  it('scores equal notes, silence, a single frame and a NaN pitch as 0', () => {
    expect(
      scores({ label: '', from: 60, to: 60, line: glide(60, 67) }),
    ).toEqual([0, 0, 0])
    expect(computeGlideCoverage([], 60, 67, sirenGlideMaxRate(60, 67))).toBe(0)
    expect(
      computeGlideCoverage(
        [{ midi: 60, time: 0 }],
        60,
        67,
        sirenGlideMaxRate(60, 67),
      ),
    ).toBe(0)
    const nan = [
      { midi: NaN, time: 0 },
      { midi: 61, time: 1 / 60 },
    ]
    expect(computeGlideCoverage(nan, 60, 67, sirenGlideMaxRate(60, 67))).toBe(0)
    // A NaN frame inside a glide costs only the ground either side of it.
    const smooth = frames(60, glide(60, 67))
    smooth[40] = { midi: NaN, time: smooth[40].time }
    expect(
      computeGlideCoverage(smooth, 60, 67, sirenGlideMaxRate(60, 67)),
    ).toBeGreaterThan(0.95)
  })
})
