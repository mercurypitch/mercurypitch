// Melody contour compiler — authored validation and shared curve behavior.

import { describe, expect, it } from 'vitest'
import { GLASS_MELODIES, glassMelody } from '../content/melodies'
import type { MelodyDefinition } from './melody-contour'
import { compileMelody, melodyMidiToFrequency, sampleMelodyAtPhase, sampleMelodyAtTime, } from './melody-contour'

describe('melody contour compiler', () => {
  it('compiles one bounded curve for anchors, display samples and reference audio', () => {
    const compiled = compileMelody(glassMelody('first-arc'), {
      rootMidi: 60,
      samplesPerSecond: 100,
    })

    expect(compiled.durationSeconds).toBeCloseTo(2.7)
    expect(compiled.singingSeconds).toBeCloseTo(2.7)
    expect(compiled.anchors.map((anchor) => anchor.midi)).toEqual([60, 62, 60])
    expect(compiled.samples).toHaveLength(271)
    for (const sample of compiled.samples) {
      const shared = sampleMelodyAtTime(compiled, sample.timeSeconds)
      expect(sample.midi).toBe(shared.midi)
      expect(sample.phase).toBe(shared.phase)
    }

    const rise = compiled.segments.find(
      (segment) => segment.kind === 'glide' && segment.toMidi === 62,
    )!
    const pitches = Array.from(
      { length: 101 },
      (_, index) =>
        sampleMelodyAtTime(
          compiled,
          rise.startSeconds +
            (index / 100) * (rise.endSeconds - rise.startSeconds),
        ).midi!,
    )
    expect(Math.min(...pitches)).toBeGreaterThanOrEqual(60)
    expect(Math.max(...pitches)).toBeLessThanOrEqual(62)
    expect(
      pitches.every(
        (pitch, index) => index === 0 || pitch >= pitches[index - 1],
      ),
    ).toBe(true)
    expect(sampleMelodyAtPhase(compiled, 0.5).midi).not.toBeNull()
    expect(melodyMidiToFrequency(69)).toBe(440)
  })

  it('changes pace and transposition without changing the authored shape', () => {
    const normal = compileMelody(glassMelody('first-arc'), { rootMidi: 57 })
    const configured = compileMelody(glassMelody('first-arc'), {
      rootMidi: 57,
      transposeSemitones: 5,
      pace: 1.5,
    })

    expect(configured.durationSeconds).toBeCloseTo(normal.durationSeconds * 1.5)
    expect(configured.anchors.map((anchor) => anchor.midi)).toEqual(
      normal.anchors.map((anchor) => anchor.midi + 5),
    )
    for (const phase of [0, 0.2, 0.5, 0.8, 1]) {
      expect(sampleMelodyAtPhase(configured, phase).midi!).toBeCloseTo(
        sampleMelodyAtPhase(normal, phase).midi! + 5,
      )
    }
  })

  it('keeps an explicit breath silent without adding sung progress', () => {
    const compiled = compileMelody(glassMelody('two-windows'), { rootMidi: 60 })
    const breath = compiled.segments.find(
      (segment) => segment.kind === 'breath',
    )!
    const before = compiled.phrases[0]
    const after = compiled.phrases[1]
    const middle = sampleMelodyAtTime(
      compiled,
      (breath.startSeconds + breath.endSeconds) / 2,
    )

    expect(compiled.anchors).toHaveLength(10)
    expect(breath.endSeconds - breath.startSeconds).toBeCloseTo(0.85)
    expect(middle.midi).toBeNull()
    expect(middle.phase).toBeCloseTo(before.phaseEnd)
    expect(after.phaseStart).toBeCloseTo(before.phaseEnd)
  })

  it('rejects malformed identities, timing, range and whole-phrase fit', () => {
    const duplicate: MelodyDefinition = {
      ...glassMelody('first-arc'),
      phrases: [
        {
          id: 'duplicate-phrase',
          allowBreathAfter: false,
          anchors: [
            { id: 'same-anchor', offsetSemitones: 0 },
            { id: 'same-anchor', offsetSemitones: 2 },
          ],
        },
      ],
    }
    expect(() => compileMelody(duplicate, { rootMidi: 60 })).toThrow(
      'Duplicate melody id',
    )

    const invalidTiming: MelodyDefinition = {
      ...glassMelody('first-arc'),
      feel: { ...glassMelody('first-arc').feel, transitionSeconds: Infinity },
    }
    expect(() => compileMelody(invalidTiming, { rootMidi: 60 })).toThrow(
      'Default transition',
    )

    const excessiveRange: MelodyDefinition = {
      ...glassMelody('first-arc'),
      phrases: [
        {
          id: 'wide-phrase',
          allowBreathAfter: false,
          anchors: [
            { id: 'wide-low', offsetSemitones: 0 },
            { id: 'wide-high', offsetSemitones: 25 },
          ],
        },
      ],
    }
    expect(() => compileMelody(excessiveRange, { rootMidi: 60 })).toThrow(
      'range exceeds',
    )
    expect(() =>
      compileMelody(glassMelody('gallery-arch'), {
        rootMidi: 60,
        allowedRange: { minimumMidi: 55, maximumMidi: 66 },
      }),
    ).toThrow('does not fit')
  })

  it('compiles every authored audition melody within the default limits', () => {
    for (const melody of GLASS_MELODIES) {
      const compiled = compileMelody(melody, { rootMidi: 60 })
      expect(compiled.durationSeconds).toBeGreaterThan(0)
      expect(compiled.samples[0].phase).toBe(0)
      expect(compiled.samples.at(-1)!.phase).toBeCloseTo(1)
    }
  })
})
