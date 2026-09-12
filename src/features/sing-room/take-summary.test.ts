import { describe, expect, it } from 'vitest'
import { midiToFreq } from '@/lib/scale-data'
import type { TakeFrame } from './take-summary'
import { formatRange, formatTakeDate, formatTakeDuration, MIN_VOICED_MS, percentile, rangeTouched, summarizeTake, takeSentence, voicedMs, } from './take-summary'

/** A run of frames on one note, one frame every `stepMs`. */
function held(
  midi: number,
  fromMs: number,
  durationMs: number,
  cents = 0,
  stepMs = 16,
): TakeFrame[] {
  const frames: TakeFrame[] = []
  for (let t = 0; t <= durationMs; t += stepMs) {
    frames.push({ atMs: fromMs + t, freq: midiToFreq(midi), cents, midi })
  }
  return frames
}

/** Silence, which is a frame with no frequency in it — not a missing frame. */
function silence(fromMs: number, durationMs: number, stepMs = 16): TakeFrame[] {
  const frames: TakeFrame[] = []
  for (let t = 0; t <= durationMs; t += stepMs) {
    frames.push({ atMs: fromMs + t, freq: 0, cents: 0, midi: 0 })
  }
  return frames
}

describe('percentile', () => {
  it('is nearest-rank, so it returns a value that was measured', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.8)).toBe(8)
  })

  it('answers zero for nothing', () => {
    expect(percentile([], 0.8)).toBe(0)
  })

  it('ignores the order it was given', () => {
    expect(percentile([9, 1, 5, 3, 7], 0.8)).toBe(
      percentile([1, 3, 5, 7, 9], 0.8),
    )
  })

  it('takes the single value when there is one', () => {
    expect(percentile([42], 0.8)).toBe(42)
  })

  it('is not dragged by one wild frame, the way a mean is', () => {
    const steady = Array.from({ length: 19 }, () => 5)
    expect(percentile([...steady, 400], 0.8)).toBe(5)
    const mean = [...steady, 400].reduce((a, b) => a + b, 0) / 20
    expect(mean).toBeGreaterThan(20)
  })
})

describe('voicedMs', () => {
  it('counts only the frames with a voice in them', () => {
    const frames = [...held(60, 0, 1000), ...silence(1016, 1000)]
    expect(voicedMs(frames)).toBeGreaterThan(950)
    expect(voicedMs(frames)).toBeLessThan(1100)
  })

  it('does not credit a gap the app spent in the background', () => {
    const frames: TakeFrame[] = [
      { atMs: 0, freq: 440, cents: 0, midi: 69 },
      { atMs: 40_000, freq: 440, cents: 0, midi: 69 },
    ]
    expect(voicedMs(frames)).toBeLessThanOrEqual(250)
  })
})

describe('rangeTouched', () => {
  it('names the lowest and highest note held long enough', () => {
    const frames = [
      ...held(50, 0, 400),
      ...held(62, 500, 400),
      ...held(69, 1000, 400),
    ]
    expect(rangeTouched(frames)).toEqual({
      lowMidi: 50,
      highMidi: 69,
      lowLabel: 'D3',
      highLabel: 'A4',
    })
  })

  it('drops a note that was only touched for a moment', () => {
    // 100 ms at the top, under the 150 ms hold — a squeak, not a range.
    const frames = [...held(60, 0, 400), ...held(84, 500, 100)]
    expect(rangeTouched(frames)?.highLabel).toBe('C4')
  })

  it('does not join two visits to a note across the silence between them', () => {
    const frames = [
      ...held(72, 0, 100),
      ...silence(120, 400),
      ...held(72, 540, 100),
    ]
    expect(rangeTouched(frames)).toBeNull()
  })

  it('answers null when nothing was sung', () => {
    expect(rangeTouched(silence(0, 2000))).toBeNull()
  })
})

describe('summarizeTake', () => {
  const run = { startedAtMs: 0, endedAtMs: 182_000, takeNumber: 2 }

  it('shows nothing at all under three seconds of voice', () => {
    const frames = held(69, 0, MIN_VOICED_MS - 500)
    expect(summarizeTake(frames, { ...run, endedAtMs: 3000 })).toBeNull()
  })

  it('counts silence in the duration and not in the voice', () => {
    const frames = [...held(69, 0, 4000), ...silence(4016, 4000)]
    const summary = summarizeTake(frames, { ...run, endedAtMs: 8000 })
    expect(summary).not.toBeNull()
    expect(summary!.durationMs).toBe(8000)
    expect(summary!.voicedMs).toBeLessThan(4500)
  })

  it('reports the 80th percentile of the absolute deviation', () => {
    // Twenty frames: nineteen inside 19 cents, and one wild slide of 90 that
    // a mean would carry into the number. Nearest rank over twenty values is
    // the sixteenth smallest, so the answer is 16 and the slide is ignored.
    const deviations = [
      1, -2, 3, -4, 5, -6, 7, -8, 9, -10, 11, -12, 13, -14, 15, -16, 17, -18,
      19, -90,
    ]
    const frames: TakeFrame[] = deviations.map((cents, index) => ({
      atMs: index * 200,
      freq: midiToFreq(69),
      cents,
      midi: 69,
    }))
    const summary = summarizeTake(frames, { ...run, endedAtMs: 4000 })
    expect(summary!.heldWithinCents).toBe(16)
  })

  it('carries the take number through untouched', () => {
    const summary = summarizeTake(held(69, 0, 5000), {
      ...run,
      takeNumber: 4,
      endedAtMs: 5000,
    })
    expect(summary!.takeNumber).toBe(4)
  })
})

describe('the end card’s words', () => {
  it('says minutes over a minute and seconds under one', () => {
    expect(formatTakeDuration(182_000)).toBe('3 min')
    expect(formatTakeDuration(12_400)).toBe('12 sec')
    expect(formatTakeDuration(61_000)).toBe('1 min')
  })

  it('writes the sentence exactly as screen 16 does', () => {
    const summary = {
      durationMs: 182_000,
      voicedMs: 100_000,
      takeNumber: 2,
      range: { lowMidi: 50, highMidi: 69, lowLabel: 'D3', highLabel: 'A4' },
      heldWithinCents: 12,
    }
    expect(takeSentence(summary)).toBe(
      '3 min · 2 takes · D3 to A4 touched · held within 12 cents',
    )
  })

  it('drops the range clause rather than inventing a word for it', () => {
    const sentence = takeSentence({
      durationMs: 182_000,
      voicedMs: 100_000,
      takeNumber: 1,
      range: null,
      heldWithinCents: 20,
    })
    expect(sentence).toBe('3 min · 1 take · held within 20 cents')
    expect(formatRange(null)).toBe('—')
  })

  it('dates a take the way the history line reads it', () => {
    expect(formatTakeDate(new Date(2026, 7, 25, 9, 38).getTime())).toBe(
      '25 August 2026',
    )
  })
})
