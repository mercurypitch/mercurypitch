// Chord benchmark assertions cannot pass by merely counting extra detected pitches.
import { describe, expect, it } from 'vitest'
import { scoreGuitarChordCandidate } from './recording-chord-benchmark'
import { createGuitarChordFixtures } from './recording-chord-fixtures'

describe('chord fixture scoring', () => {
  it('scores every labelled simultaneous voice and penalizes a missing inner voice', () => {
    const fixture = createGuitarChordFixtures().find(
      (item) => item.id === 'open-e-minor',
    )!
    const perfect = fixture.notes.map((note) => ({ ...note, confidence: 1 }))
    const full = scoreGuitarChordCandidate(fixture, perfect)
    expect(full.notes).toMatchObject({
      expected: 6,
      matched: 6,
      precision: 1,
      recall: 1,
    })
    expect(full.exactSets).toBe(2)
    const missing = scoreGuitarChordCandidate(
      fixture,
      perfect.filter((note) => note.midi !== 55),
    )
    expect(missing.notes).toMatchObject({ matched: 5, missed: 1 })
    expect(missing.exactSets).toBe(0)
    expect(missing.probes[0].missing).toEqual([55])
  })

  it('rejects octave folding, duplicate detections, late attacks and noise hallucinations', () => {
    const fixtures = createGuitarChordFixtures()
    const fixture = fixtures.find((item) => item.id === 'single-low-e')!
    const note = { ...fixture.notes[0], confidence: 1 }
    const wrong = scoreGuitarChordCandidate(fixture, [{ ...note, midi: 52 }])
    expect(wrong.notes).toMatchObject({ matched: 0, falseNotes: 1, missed: 1 })
    expect(wrong.falseOctavesAtProbes).toBe(2)
    expect(
      scoreGuitarChordCandidate(fixture, [note, note]).notes,
    ).toMatchObject({ matched: 1, falseNotes: 1 })
    expect(
      scoreGuitarChordCandidate(fixture, [
        { ...note, startSeconds: note.startSeconds + 0.061 },
      ]).notes.matched,
    ).toBe(0)
    const noise = fixtures.find((item) => item.id === 'muted-noise-control')!
    expect(scoreGuitarChordCandidate(noise, [note]).notes.falseNotes).toBe(1)
    expect(scoreGuitarChordCandidate(noise, []).notes.recall).toBeNull()
  })

  it('retains separate chord releases and reproducible additive PCM', () => {
    const fixtures = createGuitarChordFixtures()
    const releases = fixtures.find(
      (item) => item.id === 'independent-releases',
    )!
    expect(releases.probes.map((probe) => probe.midis)).toEqual([
      [40, 47, 52],
      [40, 52],
      [40],
    ])
    for (const fixture of fixtures) {
      let peak = 0
      let finite = true
      for (const value of fixture.samples) {
        finite &&= Number.isFinite(value)
        peak = Math.max(peak, Math.abs(value))
      }
      expect(finite).toBe(true)
      expect(peak).toBeLessThan(1)
    }
    const again = createGuitarChordFixtures()
    for (let i = 0; i < fixtures.length; i++) {
      expect(again[i].samples.length).toBe(fixtures[i].samples.length)
      expect(
        again[i].samples.every(
          (value, index) => value === fixtures[i].samples[index],
        ),
      ).toBe(true)
    }
  })
})
