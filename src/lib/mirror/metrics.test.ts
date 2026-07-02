// ============================================================
// Voice Mirror metrics — unit tests on synthetic tracks (§10):
// perfect sweep (range), sine + 5.5 Hz vibrato (steadiness),
// falling SNR (confidence gating), octave-glitched sweep
// (median filter), plus accuracy folding/locking/banding.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { F0Frame } from './metrics'
import { computeAccuracy, computeDelta, computeMirrorResult, computeRange, computeSteadiness, foldCents, hzToCents, matchScore, medianFilter, pickMatchTargets, preprocess, scoreMatchTake, steadinessScore, summarize, voiceTypeHint, } from './metrics'

const HOP = 0.016

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)
const centsToHz = (cents: number): number => 440 * 2 ** ((cents - 6900) / 1200)

interface ToneOpts {
  offsetCents?: number
  driftCentsPerSec?: number
  vibratoHz?: number
  vibratoCents?: number
  conf?: number
  tStart?: number
}

/** Synthetic voiced tone at `midi`, with optional offset/drift/vibrato. */
function tone(
  midi: number,
  durationSec: number,
  opts: ToneOpts = {},
): F0Frame[] {
  const {
    offsetCents = 0,
    driftCentsPerSec = 0,
    vibratoHz = 0,
    vibratoCents = 0,
    conf = 0.95,
    tStart = 0,
  } = opts
  const frames: F0Frame[] = []
  for (let t = 0; t < durationSec; t += HOP) {
    const cents =
      midi * 100 +
      offsetCents +
      driftCentsPerSec * t +
      vibratoCents * Math.sin(2 * Math.PI * vibratoHz * t)
    frames.push({ t: tStart + t, f0: centsToHz(cents), conf })
  }
  return frames
}

/**
 * Synthetic siren glide: brief hold at the starting note, linear sweep, brief
 * hold at the ending note — like a real singer parking on their extremes.
 */
function glide(
  fromMidi: number,
  toMidi: number,
  sweepSec = 7.2,
  holdSec = 0.4,
): F0Frame[] {
  const frames: F0Frame[] = []
  const total = holdSec + sweepSec + holdSec
  for (let t = 0; t < total; t += HOP) {
    let cents: number
    if (t < holdSec) {
      cents = fromMidi * 100
    } else if (t < holdSec + sweepSec) {
      const progress = (t - holdSec) / sweepSec
      cents = (fromMidi + (toMidi - fromMidi) * progress) * 100
    } else {
      cents = toMidi * 100
    }
    frames.push({ t, f0: centsToHz(cents), conf: 0.95 })
  }
  return frames
}

/** Deterministic pseudo-random source for the target picker. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  }
}

// ── Helpers ──────────────────────────────────────────────────

describe('hzToCents / foldCents', () => {
  it('maps A4 (440 Hz) to 6900 MIDI-cents', () => {
    expect(hzToCents(440)).toBeCloseTo(6900, 6)
  })

  it('maps C4 to 6000 MIDI-cents', () => {
    expect(hzToCents(midiToHz(60))).toBeCloseTo(6000, 6)
  })

  it('folds octave errors into [-600, 600)', () => {
    expect(foldCents(1200)).toBeCloseTo(0)
    expect(foldCents(-2400)).toBeCloseTo(0)
    expect(foldCents(1225)).toBeCloseTo(25)
    expect(foldCents(-575)).toBeCloseTo(-575)
    expect(foldCents(650)).toBeCloseTo(-550)
  })
})

describe('medianFilter', () => {
  it('kills single-sample spikes', () => {
    expect(medianFilter([1, 100, 1, 1, 1], 5)).toEqual([1, 1, 1, 1, 1])
  })

  it('preserves a constant signal', () => {
    expect(medianFilter([5, 5, 5], 5)).toEqual([5, 5, 5])
  })
})

describe('preprocess', () => {
  it('does not smear pitch across an unvoiced gap (breath, consonant)', () => {
    // A3 hold, 0.5 s of silence, then C4: the first C4 frames must not be
    // median-pulled toward the pre-gap A3 pitch.
    const before = tone(57, 0.3)
    const after = tone(60, 0.3, { tStart: 0.8 })
    const frames = preprocess([...before, ...after])
    const secondRun = frames.filter((f) => f.t >= 0.8)
    for (const frame of secondRun) {
      expect(frame.cents).toBeCloseTo(6000, 0)
    }
  })

  it('filters per voiced run — a short post-breath note is not erased', () => {
    // A 2-frame C4 run isolated between long A3 runs: a GLOBAL 5-frame
    // median would vote it back to A3; per-run filtering must keep it C4.
    const frames = [
      ...tone(57, 0.3),
      ...tone(60, 0.032, { tStart: 0.8 }),
      ...tone(57, 0.3, { tStart: 1.6 }),
    ]
    const shortRun = preprocess(frames).filter((f) => f.t >= 0.8 && f.t < 1.0)
    expect(shortRun.length).toBeGreaterThan(0)
    for (const frame of shortRun) {
      expect(frame.cents).toBeCloseTo(6000, 0)
    }
  })
})

// ── §4.1 Range ───────────────────────────────────────────────

describe('computeRange', () => {
  it('recovers E2–G4 · 27 semitones from a perfect up+down sweep', () => {
    const range = computeRange([glide(40, 67), glide(67, 40)])
    expect(range).not.toBeNull()
    expect(range?.lowNote).toBe('E2')
    expect(range?.highNote).toBe('G4')
    expect(range?.semitones).toBe(27)
  })

  it('is immune to single-frame octave glitches (median filter)', () => {
    const glitched = [glide(40, 67), glide(67, 40)].map((frames) =>
      frames.map((f, i) => (i % 17 === 0 ? { ...f, f0: f.f0 * 2 } : f)),
    )
    const range = computeRange(glitched)
    expect(range?.lowNote).toBe('E2')
    expect(range?.highNote).toBe('G4')
  })

  it('ignores low-confidence frames (falling SNR tail)', () => {
    // Clean sweep, then a noisy tail where confidence collapses while the
    // detector reports garbage way above the real range.
    const clean = glide(48, 67)
    const lastT = clean[clean.length - 1].t
    const noisyTail: F0Frame[] = Array.from({ length: 120 }, (_, i) => ({
      t: lastT + (i + 1) * HOP,
      f0: midiToHz(96) * (1 + 0.3 * Math.sin(i)),
      conf: 0.2,
    }))
    const range = computeRange([[...clean, ...noisyTail], glide(67, 48)])
    expect(range?.lowNote).toBe('C3')
    expect(range?.highNote).toBe('G4')
  })

  it('clips a sustained high-confidence octave error via the guard rails', () => {
    // 0.25 s of octave-doubled frames (16 frames — survives the 5-frame
    // median and exceeds the 150 ms dwell): only the percentile clip with
    // its one-semitone margin can remove it.
    const octaveError = tone(67 + 12, 0.25, { tStart: 20 })
    const range = computeRange([
      [...glide(40, 67), ...octaveError],
      glide(67, 40),
    ])
    expect(range?.highNote).toBe('G4')
  })

  it('returns null when everything is unvoiced', () => {
    const silent: F0Frame[] = Array.from({ length: 100 }, (_, i) => ({
      t: i * HOP,
      f0: 0,
      conf: 0,
    }))
    expect(computeRange([silent])).toBeNull()
  })

  it('requires 150 ms of dwell for a bin to qualify', () => {
    // 80 ms at C3 is not enough for the C3 bin; 1 s at E3 qualifies.
    const brief = tone(48, 0.08)
    const held = tone(52, 1, { tStart: 0.2 })
    const range = computeRange([[...brief, ...held]])
    expect(range?.lowNote).toBe('E3')
  })
})

describe('voiceTypeHint', () => {
  it('matches a G2–G4 range to Baritone', () => {
    expect(voiceTypeHint(43, 67)).toBe('Baritone')
  })

  it('matches a C4–C6 range to Soprano', () => {
    expect(voiceTypeHint(60, 84)).toBe('Soprano')
  })
})

// ── §4.2 Accuracy ────────────────────────────────────────────

describe('scoreMatchTake', () => {
  it('scores a perfect take as a bullseye at 100', () => {
    const take = scoreMatchTake(tone(57, 2), 57)
    expect(take.locked).toBe(true)
    expect(take.band).toBe('bullseye')
    expect(take.score).toBe(100)
    expect(take.deviationCents).toBeLessThan(1)
  })

  it('treats a different octave as correct (folding)', () => {
    const take = scoreMatchTake(tone(45, 2), 57) // sings A2 against A3
    expect(take.band).toBe('bullseye')
    expect(take.score).toBe(100)
  })

  it('scores a +25 c take in the hit band with the piecewise value', () => {
    const take = scoreMatchTake(tone(57, 2, { offsetCents: 25 }), 57)
    expect(take.band).toBe('hit')
    expect(take.deviationCents).toBeCloseTo(25, 0)
    expect(take.score).toBeCloseTo(matchScore(25), 5)
    expect(take.score).toBeGreaterThan(80)
    expect(take.score).toBeLessThan(86)
  })

  it('reports no-voice when the take is silent', () => {
    const silent: F0Frame[] = Array.from({ length: 200 }, (_, i) => ({
      t: i * HOP,
      f0: 0,
      conf: 0,
    }))
    const take = scoreMatchTake(silent, 57)
    expect(take.locked).toBe(false)
    expect(take.band).toBe('no-voice')
    expect(take.score).toBe(0)
  })

  it('never locks when the singer stays outside ±60 c', () => {
    const take = scoreMatchTake(tone(57, 2, { offsetCents: 80 }), 57)
    expect(take.locked).toBe(false)
    expect(take.band).toBe('no-voice')
  })

  it('needs LOCK_MIN_FRAMES — sparse stray frames spanning 150 ms are no lock', () => {
    // Two isolated in-tune frames 200 ms apart: the duration criterion alone
    // would call this a lock; the frame-count guard must reject it.
    const sparse: F0Frame[] = [0, 0.2, 0.4, 0.6].map((t) => ({
      t,
      f0: centsToHz(5700),
      conf: 0.95,
    }))
    const take = scoreMatchTake(sparse.slice(0, 2), 57)
    expect(take.locked).toBe(false)
  })

  it('scores the close band (35–60 c) and reports no onset when never within ±50 c', () => {
    // +55 c: locks (±60 tolerance) but never enters the ±50 c onset window.
    const take = scoreMatchTake(tone(57, 2, { offsetCents: 55 }), 57)
    expect(take.locked).toBe(true)
    expect(take.band).toBe('close')
    expect(take.score).toBeGreaterThan(40)
    expect(take.score).toBeLessThan(70)
    expect(take.onsetMs).toBeNull()
  })

  it('scores post-lock frames only: lock then drift lands in miss', () => {
    const locked = tone(57, 0.3)
    const drifted = tone(57, 2, { offsetCents: 90, tStart: 0.3 })
    const take = scoreMatchTake([...locked, ...drifted], 57)
    expect(take.locked).toBe(true)
    expect(take.band).toBe('miss')
    expect(take.deviationCents).toBeCloseTo(90, 0)
    expect(take.score).toBeCloseTo(20, 0)
  })
})

describe('onset / scoop (§4.4)', () => {
  it('measures the scoop on a take that slides into the note', () => {
    // 250 ms glide from −300 c up to the target, then a clean hold.
    const scoop: F0Frame[] = []
    for (let t = 0; t < 0.25; t += HOP) {
      const cents = 5700 - 300 * (1 - t / 0.25)
      scoop.push({ t, f0: centsToHz(cents), conf: 0.95 })
    }
    const hold = tone(57, 2, { tStart: 0.25 })
    const take = scoreMatchTake([...scoop, ...hold], 57)
    expect(take.locked).toBe(true)
    expect(take.onsetMs).not.toBeNull()
    expect(take.onsetMs ?? 0).toBeGreaterThan(120)
    expect(take.onsetMs ?? 0).toBeLessThan(320)
  })

  it('reports a near-zero onset when the singer lands the note instantly', () => {
    const take = scoreMatchTake(tone(57, 2), 57)
    expect(take.onsetMs ?? 999).toBeLessThan(50)
  })

  it('aggregates the median scoop across takes', () => {
    const takes = [
      scoreMatchTake(tone(57, 2), 57),
      scoreMatchTake(tone(60, 2), 60),
    ]
    const accuracy = computeAccuracy(takes)
    expect(accuracy?.scoopMedianMs).not.toBeNull()
    expect(accuracy?.scoopMedianMs ?? 999).toBeLessThan(50)
  })
})

describe('matchScore', () => {
  it('follows the piecewise anchors', () => {
    expect(matchScore(12)).toBe(100)
    expect(matchScore(35)).toBeCloseTo(70)
    expect(matchScore(60)).toBeCloseTo(40)
    expect(matchScore(120)).toBeCloseTo(0)
    expect(matchScore(200)).toBe(0)
  })
})

describe('computeAccuracy', () => {
  it('averages the per-note scores', () => {
    const takes = [100, 70, 40, 0, 90].map((score) => ({
      targetMidi: 57,
      locked: score > 0,
      deviationCents: score > 0 ? 10 : null,
      band: 'hit' as const,
      score,
      onsetMs: null,
    }))
    expect(computeAccuracy(takes)?.score).toBe(60)
  })

  it('returns null for an empty take list', () => {
    expect(computeAccuracy([])).toBeNull()
  })
})

describe('pickMatchTargets', () => {
  it('picks 5 shuffled targets inside the 25th–75th percentile, spaced 2–4', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const targets = pickMatchTargets(40, 67, seededRandom(seed))
      expect(targets).toHaveLength(5)
      const sorted = [...targets].sort((a, b) => a - b)
      const p25 = Math.round(40 + 27 * 0.25)
      const p75 = Math.round(67 - 27 * 0.25)
      expect(sorted[0]).toBeGreaterThanOrEqual(p25)
      expect(sorted[4]).toBeLessThanOrEqual(p75)
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - sorted[i - 1]
        expect(gap).toBeGreaterThanOrEqual(2)
        expect(gap).toBeLessThanOrEqual(4)
      }
    }
  })

  it('degrades gracefully on a narrow range, keeping targets distinct', () => {
    const targets = pickMatchTargets(57, 63, seededRandom(3))
    expect(targets).toHaveLength(5)
    expect(new Set(targets).size).toBe(5)
    for (const t of targets) {
      expect(t).toBeGreaterThanOrEqual(57)
      expect(t).toBeLessThanOrEqual(63)
    }
  })
})

// ── §4.3 Steadiness ──────────────────────────────────────────

describe('computeSteadiness', () => {
  it('labels 5.5 Hz ±30 c vibrato as a feature and excludes it from wobble', () => {
    const result = computeSteadiness(
      tone(57, 6, { vibratoHz: 5.5, vibratoCents: 30 }),
    )
    expect(result).not.toBeNull()
    expect(result?.vibrato).not.toBeNull()
    expect(result?.vibrato?.rateHz).toBeGreaterThan(4.5)
    expect(result?.vibrato?.rateHz).toBeLessThan(6.5)
    // The ± amplitude of a ±30 c sine, allowing for windowing losses.
    expect(result?.vibrato?.extentCents).toBeGreaterThan(18)
    expect(result?.vibrato?.extentCents).toBeLessThan(40)
    // v1.1: vibrato no longer reads as unsteadiness — wobble is the
    // residual after removing the vibrato sinusoid's variance.
    expect(result?.wobbleSdCents).toBeLessThan(12)
    expect(result?.score).toBeGreaterThanOrEqual(85)
    expect(Math.abs(result?.driftCentsPerSec ?? 99)).toBeLessThan(1)
  })

  it('rejects periodic wobble outside the singerly rate band', () => {
    // A clean 2.5 Hz slow wobble — periodic, but below VIBRATO_MIN_HZ: it
    // must stay wobble, not be excused as vibrato.
    const result = computeSteadiness(
      tone(57, 6, { vibratoHz: 2.5, vibratoCents: 30 }),
    )
    expect(result?.vibrato).toBeNull()
    expect(result?.wobbleSdCents).toBeGreaterThan(15)
    expect(result?.score).toBeLessThan(80)
  })

  it('subtracts only the vibrato share, not coexisting real wobble', () => {
    // 5.5 Hz vibrato PLUS slow 1.1 Hz wobble: the projection must remove the
    // vibrato sinusoid but keep the out-of-band wobble in the score.
    const frames = tone(57, 6).map((f, i) => {
      const t = i * HOP
      const cents =
        5700 +
        30 * Math.sin(2 * Math.PI * 5.5 * t) +
        20 * Math.sin(2 * Math.PI * 1.1 * t)
      return { ...f, f0: centsToHz(cents) }
    })
    const result = computeSteadiness(frames)
    expect(result?.vibrato).not.toBeNull()
    // The 1.1 Hz component (SD ≈ 14 c) must survive the subtraction.
    expect(result?.wobbleSdCents).toBeGreaterThan(9)
    expect(result?.score).toBeLessThan(95)
  })

  it('does not call aperiodic wobble vibrato', () => {
    // Deterministic non-periodic jitter: sum of incommensurate slow sines
    // way outside the 3.5–8.5 Hz singerly band.
    const frames = tone(57, 6).map((f, i) => {
      const t = i * HOP
      const jitter =
        18 * Math.sin(2 * Math.PI * 0.7 * t) +
        14 * Math.sin(2 * Math.PI * 1.3 * t + 1)
      return { ...f, f0: centsToHz(5700 + jitter) }
    })
    const result = computeSteadiness(frames)
    expect(result?.vibrato).toBeNull()
    expect(result?.wobbleSdCents).toBeGreaterThan(10)
  })

  it('reports pure drift in the slope, not the wobble', () => {
    const result = computeSteadiness(tone(57, 6, { driftCentsPerSec: -4 }))
    expect(result?.driftCentsPerSec).toBeCloseTo(-4, 1)
    expect(result?.wobbleSdCents).toBeLessThan(2)
    expect(result?.score).toBeGreaterThanOrEqual(95)
  })

  it('references the singer’s own note, not any target', () => {
    const result = computeSteadiness(tone(50, 6, { offsetCents: 40 }))
    expect(result?.referenceNote).toBe('D3')
    expect(result?.wobbleSdCents).toBeLessThan(2)
    expect(result?.score).toBeGreaterThanOrEqual(95)
  })

  it('trims the onset scoop before scoring', () => {
    // 300 ms scoop from −80 c, then a clean hold: the trim removes it.
    const scoop = tone(57, 0.3, { offsetCents: -80, driftCentsPerSec: 240 })
    const hold = tone(57, 5, { tStart: 0.3 })
    const result = computeSteadiness([...scoop, ...hold])
    expect(result?.wobbleSdCents).toBeLessThan(4)
  })

  it('returns null when the hold is too short to trim', () => {
    expect(computeSteadiness(tone(57, 0.5))).toBeNull()
  })
})

describe('steadinessScore', () => {
  it('follows the piecewise anchors', () => {
    expect(steadinessScore(0)).toBe(100)
    expect(steadinessScore(8)).toBeCloseTo(95)
    expect(steadinessScore(20)).toBeCloseTo(70)
    expect(steadinessScore(40)).toBeCloseTo(40)
    expect(steadinessScore(70)).toBeCloseTo(10)
    expect(steadinessScore(200)).toBe(0)
  })
})

// ── Aggregate + baseline delta ───────────────────────────────

describe('computeMirrorResult / summarize / computeDelta', () => {
  it('produces the full result from raw task frames', () => {
    const result = computeMirrorResult({
      glides: [glide(43, 67), glide(67, 43)],
      hold: tone(55, 6),
      matches: [50, 53, 55, 58, 60].map((targetMidi) => ({
        targetMidi,
        frames: tone(targetMidi, 2, { offsetCents: 10 }),
      })),
    })
    expect(result.range?.lowNote).toBe('G2')
    expect(result.range?.voiceHint).toBe('Baritone')
    expect(result.accuracy?.score).toBe(100)
    expect(result.steadiness?.score).toBeGreaterThanOrEqual(95)

    const summary = summarize(result)
    expect(summary.semitones).toBe(24)

    const later = { ...summary, semitones: 26, accuracy: 100, steadiness: 99 }
    const delta = computeDelta(summary, later)
    expect(delta.semitones).toBe(2)
  })

  it('summarizes missing sections as nulls and deltas them as null', () => {
    const empty = summarize({ range: null, accuracy: null, steadiness: null })
    expect(empty.semitones).toBeNull()
    expect(computeDelta(empty, empty).accuracy).toBeNull()
  })
})
