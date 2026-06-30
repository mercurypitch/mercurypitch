import { describe, expect, it } from 'vitest'
import { midiToFreq } from '@/lib/scale-data'
import type { CompactMelodyItem } from './share-codec'
import { generateMelodyItemsFromCompact } from './share-codec'

describe('generateMelodyItemsFromCompact', () => {
  it('recomputes a real frequency from MIDI so playback never gets freq 0', () => {
    // Regression: decoded shared notes used to carry freq:0, which makes the
    // guitar pluck synth build a Float32Array of length sampleRate/0 = Infinity
    // and throw.
    const compact: CompactMelodyItem[] = [
      [57, 0.5, 0.5],
      [60, 1.5, 1],
      [45, 2.5, 3.4],
    ]
    const items = generateMelodyItemsFromCompact(compact)
    expect(items.length).toBe(3)
    expect(items[0].note.freq).toBeCloseTo(midiToFreq(57), 3)
    expect(items[1].note.freq).toBeCloseTo(midiToFreq(60), 3)
    expect(items.every((i) => i.note.freq > 0)).toBe(true)
  })

  it('keeps note names/octaves consistent with the MIDI value', () => {
    const items = generateMelodyItemsFromCompact([[60, 0, 1]])
    expect(items[0].note.midi).toBe(60)
    expect(items[0].note.name).toBe('C')
    expect(items[0].note.octave).toBe(4)
  })
})
