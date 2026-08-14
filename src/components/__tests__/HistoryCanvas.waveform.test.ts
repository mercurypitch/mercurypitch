// ============================================================
// HistoryCanvas — waveform column mapping
// ============================================================
//
// The strip itself is a canvas and cannot be usefully asserted in jsdom. The
// part that can be wrong in a way a person would notice is the mapping from
// pixel column to sample range, and that is pure — so it is exported and tested
// directly rather than through a no-op 2D context.

import { describe, expect, it } from 'vitest'
import { columnAmplitude, waveformStep } from '@/components/HistoryCanvas'

/** A buffer whose value at index i is i, so an index error is visible. */
const ramp = (n: number): Float32Array =>
  Float32Array.from({ length: n }, (_, i) => i)

describe('waveformStep', () => {
  it('collapses whole samples per column', () => {
    expect(waveformStep(2048, 800)).toBe(2)
    expect(waveformStep(2048, 512)).toBe(4)
  })

  it('never returns zero when the strip is wider than the buffer', () => {
    // step 0 would make every column read the same sample and the inner loop
    // never run, so the whole strip would be flat.
    expect(waveformStep(100, 800)).toBe(1)
  })
})

describe('columnAmplitude', () => {
  it('reads real samples across the full width of the strip', () => {
    // The regression: the index applied the samples-per-pixel scale twice, so
    // with 2048 samples on an 800px strip everything past x=400 fell out of
    // range, averaged to 0, and drew flat. The last column must still land
    // inside the buffer.
    const waveform = ramp(2048)
    const width = 800
    const step = waveformStep(waveform.length, width)

    const last = columnAmplitude(waveform, width - 1, step)
    expect(last).toBeGreaterThan(0)

    // No column reads out of range: column 0 covers samples 0 and 1, so even
    // the first averages 0.5 rather than 0. Before the fix, 400 of the 800
    // columns averaged exactly 0.
    let flatColumns = 0
    for (let x = 0; x < width; x++) {
      if (columnAmplitude(waveform, x, step) === 0) flatColumns += 1
    }
    expect(flatColumns).toBe(0)
  })

  it('averages exactly the samples the column covers', () => {
    const waveform = ramp(16)
    const step = waveformStep(16, 8) // 2 samples per column

    // Column 3 covers samples 6 and 7.
    expect(columnAmplitude(waveform, 3, step)).toBe(6.5)
    // Column 0 covers 0 and 1.
    expect(columnAmplitude(waveform, 0, step)).toBe(0.5)
  })

  it('advances monotonically across columns for a rising ramp', () => {
    // A mapping that stalls, repeats or jumps backwards would break this even
    // where individual columns still land in range.
    const waveform = ramp(1024)
    const step = waveformStep(1024, 256)
    let previous = -1
    for (let x = 0; x < 256; x++) {
      const value = columnAmplitude(waveform, x, step)
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
  })

  it('stops at the end of a buffer that does not divide evenly', () => {
    const waveform = ramp(10)
    // Deliberately oversized step: the final column must average only the
    // samples that exist, not read past the end and report NaN.
    const value = columnAmplitude(waveform, 2, 4)
    expect(value).toBe(8.5) // indices 8 and 9 only; 10 and 11 do not exist
    expect(Number.isNaN(value)).toBe(false)
  })

  it('returns 0 rather than NaN for a column entirely past the end', () => {
    expect(columnAmplitude(ramp(10), 50, 2)).toBe(0)
  })
})
