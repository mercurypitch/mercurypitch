import { describe, expect, it } from 'vitest'
import { NARROW_RANGE_SEMITONES, pickFirstStop, WEAK_SCORE, } from '@/features/onboarding/first-stop'
import type { AccuracyResult, MirrorResult, RangeResult, SteadinessResult, } from '@/lib/mirror/metrics'
import { voiceTypeHint } from '@/lib/mirror/metrics'

const range = (semitones: number): RangeResult => ({
  lowMidi: 48,
  highMidi: 48 + semitones,
  lowNote: 'C3',
  highNote: 'C4',
  semitones,
  qualifyingMidis: [],
  voiceHint: 'Tenor',
})

/** What computeRange reads from a steady tone: A3 to A3, no voice type. */
const STEADY_TONE: RangeResult = {
  lowMidi: 57,
  highMidi: 57,
  lowNote: 'A3',
  highNote: 'A3',
  semitones: 0,
  qualifyingMidis: [57],
  voiceHint: voiceTypeHint(57, 57),
}

const accuracy = (score: number): AccuracyResult => ({
  score,
  takes: [],
  scoopMedianMs: null,
})

const steadiness = (score: number): SteadinessResult =>
  ({
    referenceCents: 0,
    referenceNote: 'C3',
    driftCentsPerSec: 0,
    wobbleSdCents: 10,
    vibrato: null,
    score,
    voicedSeconds: 4,
  }) as SteadinessResult

const result = (over: Partial<MirrorResult> = {}): MirrorResult => ({
  range: range(18),
  accuracy: accuracy(90),
  steadiness: steadiness(90),
  ...over,
})

describe('pickFirstStop', () => {
  it('sends someone with no voiceprint to Practice', () => {
    const stop = pickFirstStop(null)
    expect(stop.room).toBe('practice')
    expect(stop.detail).toBeNull()
  })

  it('sends a wavering tone to the Long Note drill', () => {
    const stop = pickFirstStop(
      result({ steadiness: steadiness(WEAK_SCORE - 20) }),
    )
    expect(stop.room).toBe('exercises')
    expect(stop.detail).toBe('Long Note')
  })

  it('sends a loose ear to the Interval Trainer', () => {
    const stop = pickFirstStop(result({ accuracy: accuracy(WEAK_SCORE - 20) }))
    expect(stop.room).toBe('exercises')
    expect(stop.detail).toBe('Interval Trainer')
  })

  it('sends a narrow range to the Ascent once both scores are solid', () => {
    const stop = pickFirstStop(
      result({ range: range(NARROW_RANGE_SEMITONES - 1) }),
    )
    expect(stop.room).toBe('ascent')
    expect(stop.detail).toBe('Range week')
  })

  it("does not send a steady tone's 0-semitone read to the Ascent", () => {
    // Arrange: both scores solid, and a range read the twin called unclean.
    const steadyTone = result({ range: STEADY_TONE })

    // Act
    const stop = pickFirstStop(steadyTone)

    // Assert: read as no range, so the solid scores lead.
    expect(stop.room).toBe('karaoke')
    expect(stop.detail).toBeNull()
  })

  it('still sends a clean five-semitone read to the Ascent', () => {
    // Arrange: C3 to F3, which overlaps a voice type.
    const fifth = result({ range: range(5) })

    // Act
    const stop = pickFirstStop(fifth)

    // Assert
    expect(stop.room).toBe('ascent')
    expect(stop.detail).toBe('Range week')
  })

  it('treats a run whose only read was an unclean range as nothing measured', () => {
    const stop = pickFirstStop({
      range: STEADY_TONE,
      accuracy: null,
      steadiness: null,
    })
    expect(stop.room).toBe('practice')
  })

  it('sends a strong voice to Karaoke', () => {
    expect(pickFirstStop(result()).room).toBe('karaoke')
  })

  it('picks the weaker of two weak dimensions, not a fixed order', () => {
    // Steadiness further behind → the steadiness drill wins.
    expect(
      pickFirstStop(
        result({ steadiness: steadiness(30), accuracy: accuracy(65) }),
      ).detail,
    ).toBe('Long Note')

    // Accuracy further behind → the ear drill wins, even though the
    // steadiness check is written first.
    expect(
      pickFirstStop(
        result({ steadiness: steadiness(65), accuracy: accuracy(30) }),
      ).detail,
    ).toBe('Interval Trainer')
  })

  it('treats the threshold itself as solid, not weak', () => {
    const stop = pickFirstStop(
      result({
        steadiness: steadiness(WEAK_SCORE),
        accuracy: accuracy(WEAK_SCORE),
      }),
    )
    expect(stop.room).toBe('karaoke')
  })

  it('does not congratulate a run where every task failed to measure', () => {
    const stop = pickFirstStop({
      range: null,
      accuracy: null,
      steadiness: null,
    })
    expect(stop.room).toBe('practice')
  })

  it('ignores a missing dimension rather than treating it as zero', () => {
    // No hold task recorded, but the ear was strong and range is wide.
    const stop = pickFirstStop(result({ steadiness: null }))
    expect(stop.room).toBe('karaoke')
  })

  it('always gives a reason to show on the card', () => {
    for (const r of [
      null,
      result(),
      result({ steadiness: steadiness(10) }),
      result({ accuracy: accuracy(10) }),
      result({ range: range(4) }),
    ]) {
      expect(pickFirstStop(r).reason.length).toBeGreaterThan(0)
    }
  })

  it('words every reason without an em dash', () => {
    // The owner's product voice for visible copy: a full stop or a colon.
    const reasons = [
      null,
      result(),
      result({ steadiness: steadiness(10) }),
      result({ accuracy: accuracy(10) }),
      result({ range: range(4) }),
    ].map((r) => pickFirstStop(r).reason)

    expect(new Set(reasons).size).toBe(5)
    expect(reasons.filter((reason) => reason.includes('—'))).toEqual([])
  })
})
