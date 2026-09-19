import { describe, expect, it } from 'vitest'
import type { JamHitQuality, JamPitchView } from './jam-pitch-view'
import { blankNoteAccuracy, centsFromTarget, easeToward, JAM_BAND_MIN_SPAN, JAM_CLOSE_CENTS, JAM_PERFECT_CENTS, JAM_QUALITY_COLOR, JAM_SAMPLE_MAX_AGE_MS, jamPitchBand, judgeAgainstNote, labelStepForPixels, midiLabel, mixHex, noteVerdict, observeNoteFrame, qualityForCents, sampleMidi, tintForVerdict, } from './jam-pitch-view'

const NOW = 1_000_000

function sample(over: Partial<JamPitchView> = {}): JamPitchView {
  return {
    midi: 60,
    cents: 0,
    frequency: 261.63,
    clarity: 0.9,
    timestamp: NOW,
    ...over,
  }
}

describe('sampleMidi', () => {
  it('adds the sub-semitone back on', () => {
    expect(sampleMidi({ midi: 60, cents: 0 })).toBe(60)
    expect(sampleMidi({ midi: 60, cents: -50 })).toBe(59.5)
    expect(sampleMidi({ midi: 60, cents: 50 })).toBe(60.5)
  })

  it('separates pitches that round to the same semitone', () => {
    // The regression this module exists for: these two used to be the
    // same number, so the canvas drew them on the same row.
    const flat = sampleMidi({ midi: 60, cents: -30 })
    const sharp = sampleMidi({ midi: 60, cents: 30 })
    expect(flat).not.toBe(sharp)
    expect(sharp - flat).toBeCloseTo(0.6, 10)
  })

  it('maps 30 cents apart to different pixels in a ten-semitone band', () => {
    // Same arithmetic the lanes use, so this fails if a canvas ever
    // goes back to plotting the rounded midi.
    const h = 56
    const [minMidi, maxMidi] = [55, 65]
    const midiToY = (midi: number) =>
      h - ((midi - minMidi) / (maxMidi - minMidi)) * h
    const a = midiToY(sampleMidi({ midi: 60, cents: 0 }))
    const b = midiToY(sampleMidi({ midi: 60, cents: 30 }))
    expect(Math.abs(a - b)).toBeGreaterThan(1)
  })
})

describe('qualityForCents', () => {
  it('bands against the app-wide thresholds, not its own numbers', () => {
    expect(qualityForCents(0)).toBe('perfect')
    expect(qualityForCents(JAM_PERFECT_CENTS)).toBe('perfect')
    expect(qualityForCents(JAM_PERFECT_CENTS + 1)).toBe('close')
    expect(qualityForCents(JAM_CLOSE_CENTS)).toBe('close')
    expect(qualityForCents(JAM_CLOSE_CENTS + 1)).toBe('miss')
  })

  it('treats sharp and flat alike', () => {
    expect(qualityForCents(-40)).toBe(qualityForCents(40))
    expect(qualityForCents(-200)).toBe('miss')
  })

  it('does not crash on a non-finite reading', () => {
    expect(qualityForCents(Number.NaN)).toBe('miss')
    expect(qualityForCents(Number.POSITIVE_INFINITY)).toBe('miss')
  })
})

describe('centsFromTarget', () => {
  it('is signed, sharp positive', () => {
    expect(centsFromTarget({ midi: 60, cents: 20 }, 60)).toBeCloseTo(20, 6)
    expect(centsFromTarget({ midi: 59, cents: -20 }, 60)).toBeCloseTo(-120, 6)
  })

  it('does not forgive an octave, matching the scoreboard', () => {
    // Jam scoring counts (s.midi - note.midi) * 100 + s.cents with no
    // folding. A green pill here would promise points that never come.
    expect(qualityForCents(centsFromTarget({ midi: 48, cents: 0 }, 60))).toBe(
      'miss',
    )
  })
})

describe('judgeAgainstNote', () => {
  it('scores a frame on the note', () => {
    expect(judgeAgainstNote(sample({ cents: 10 }), 60, NOW)).toBe('perfect')
    expect(judgeAgainstNote(sample({ cents: 40 }), 60, NOW)).toBe('close')
    expect(judgeAgainstNote(sample({ cents: 90 }), 60, NOW)).toBe('miss')
  })

  it('counts silence under a target as a miss', () => {
    expect(judgeAgainstNote(null, 60, NOW)).toBe('miss')
    expect(judgeAgainstNote(sample({ frequency: 0 }), 60, NOW)).toBe('miss')
    expect(judgeAgainstNote(sample({ midi: 0 }), 60, NOW)).toBe('miss')
  })

  it('counts a mumble as a miss', () => {
    expect(judgeAgainstNote(sample({ clarity: 0.05 }), 60, NOW)).toBe('miss')
  })

  it('will not credit a stale sample to the note under the playhead', () => {
    const stale = sample({ timestamp: NOW - JAM_SAMPLE_MAX_AGE_MS - 1 })
    expect(judgeAgainstNote(stale, 60, NOW)).toBe('miss')
    const fresh = sample({ timestamp: NOW - JAM_SAMPLE_MAX_AGE_MS + 1 })
    expect(judgeAgainstNote(fresh, 60, NOW)).toBe('perfect')
  })
})

describe('noteVerdict', () => {
  const run = (qualities: JamHitQuality[]) => {
    const acc = blankNoteAccuracy()
    for (const q of qualities) observeNoteFrame(acc, q)
    return noteVerdict(acc)
  }

  it('has no verdict before the note is live', () => {
    expect(noteVerdict(blankNoteAccuracy())).toBeNull()
  })

  it('settles on the band held for most of the note', () => {
    expect(run(['perfect', 'perfect', 'close'])).toBe('perfect')
    expect(run(['close', 'close', 'perfect'])).toBe('close')
    expect(run(['miss', 'miss', 'perfect'])).toBe('miss')
  })

  it('counts perfect frames towards close as well', () => {
    // Never a perfect majority, but inside the scoring window
    // throughout -- amber, not red.
    expect(run(['perfect', 'close', 'close'])).toBe('close')
  })

  it('needs half the note, not a moment of it', () => {
    // Half dead-on still reads green; a third of it does not.
    expect(run(['perfect', 'miss'])).toBe('perfect')
    expect(run(['perfect', 'miss', 'miss'])).toBe('miss')
  })

  it('calls a note nobody sang a miss', () => {
    expect(run(['miss', 'miss', 'miss'])).toBe('miss')
  })
})

describe('jamPitchBand', () => {
  it('is null with nothing to show', () => {
    expect(jamPitchBand([])).toBeNull()
    expect(jamPitchBand([0, Number.NaN])).toBeNull()
  })

  it('gives a single note the full minimum span', () => {
    const band = jamPitchBand([60])
    expect(band).not.toBeNull()
    expect(band!.maxMidi - band!.minMidi).toBeCloseTo(JAM_BAND_MIN_SPAN, 6)
    // and centres it
    expect((band!.minMidi + band!.maxMidi) / 2).toBeCloseTo(60, 6)
  })

  it('pads a wide melody rather than clipping it', () => {
    const band = jamPitchBand([55, 79])
    expect(band!.minMidi).toBeLessThanOrEqual(55)
    expect(band!.maxMidi).toBeGreaterThanOrEqual(79)
    // Nothing like the 24 semitones of headroom the canvas used to add.
    expect(band!.maxMidi - band!.minMidi).toBeLessThan(24 + 24)
  })

  it('keeps a five-note melody far tighter than the old fixed lane', () => {
    const band = jamPitchBand([60, 62, 64, 65, 67])
    // The lanes used to show MIDI 40..84 whatever was sung: 44 semitones.
    expect(band!.maxMidi - band!.minMidi).toBeLessThan(44 / 2)
  })
})

describe('easeToward', () => {
  it('closes the gap and then stops', () => {
    let v = 0
    for (let i = 0; i < 200; i++) v = easeToward(v, 10)
    expect(v).toBe(10)
  })

  it('moves part of the way, not all of it', () => {
    const next = easeToward(0, 10)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(10)
  })

  it('adopts the target outright when it has no current value', () => {
    expect(easeToward(Number.NaN, 64)).toBe(64)
  })
})

describe('midiLabel', () => {
  it('names the usual anchors', () => {
    expect(midiLabel(60)).toBe('C4')
    expect(midiLabel(69)).toBe('A4')
    expect(midiLabel(21)).toBe('A0')
  })

  it('rounds a band edge to the nearest note', () => {
    expect(midiLabel(59.6)).toBe('C4')
  })
})

describe('labelStepForPixels', () => {
  it('labels every semitone when there is room', () => {
    expect(labelStepForPixels(20)).toBe(1)
  })

  it('thins out as the band gets tighter', () => {
    expect(labelStepForPixels(8)).toBe(2)
    expect(labelStepForPixels(4)).toBe(4)
    expect(labelStepForPixels(1)).toBe(12)
  })

  it('never returns a step that would label nothing', () => {
    for (const px of [0, 0.5, 3, 6, 12, 100]) {
      expect(labelStepForPixels(px)).toBeGreaterThan(0)
    }
  })
})

describe('mixHex', () => {
  it('returns the base untouched at zero', () => {
    expect(mixHex('#58a6ff', '#3fb950', 0)).toBe('#58a6ff')
  })

  it('returns the tint outright at one', () => {
    expect(mixHex('#58a6ff', '#3fb950', 1)).toBe('#3fb950')
  })

  it('lands between the two halfway', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('passes a colour it cannot parse straight through', () => {
    expect(mixHex('var(--lane)', '#3fb950', 0.5)).toBe('var(--lane)')
  })
})

describe('tintForVerdict', () => {
  it('leaves a note nobody has reached alone', () => {
    expect(tintForVerdict('#58a6ff', null)).toBe('#58a6ff')
  })

  it('pulls towards green, amber and red', () => {
    for (const verdict of ['perfect', 'close', 'miss'] as const) {
      const tinted = tintForVerdict('#58a6ff', verdict)
      expect(tinted).not.toBe('#58a6ff')
      expect(tinted).not.toBe(JAM_QUALITY_COLOR[verdict])
    }
  })

  it('keeps the three verdicts visibly apart', () => {
    const shades = new Set(
      (['perfect', 'close', 'miss'] as const).map((v) =>
        tintForVerdict('#58a6ff', v),
      ),
    )
    expect(shades.size).toBe(3)
  })
})
