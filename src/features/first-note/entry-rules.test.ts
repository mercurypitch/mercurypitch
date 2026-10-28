// ============================================================
// First note's entry rules, on songs made here to known answers
// ============================================================
//
// The rules (entry-rules.ts) are the script's and the phone's both. The
// script's own check is that it writes the committed entries again
// unchanged (first-note-entries.json); these hold each rule to a song whose
// answer is known: a voice of pure notes at known places, and a band of
// clicks at a known tempo.

import { describe, expect, it } from 'vitest'
import type { SongLine, StoredNote } from './entry-rules'
import { BAND_RATE, beatsBefore, breathLines, entrySteps, findEntries, findEntry, loudness, lyricLines, middleNote, onsets, onsetSteps, runSteps, tempoOf, VOCAL_RATE, yinMidi, } from './entry-rules'

/** A seeded random source, the same every run. */
function seeded(seed = 11): () => number {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

/** A voice: pure notes, `cents` off their MIDI note where asked, silence between. */
function voice(
  rate: number,
  seconds: number,
  notes: readonly {
    from: number
    to: number
    midi: number
    cents?: number
  }[],
): Float32Array {
  const samples = new Float32Array(Math.round(seconds * rate))
  for (const note of notes) {
    const f = hz(note.midi + (note.cents ?? 0) / 100)
    for (let i = Math.round(note.from * rate); i < note.to * rate; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * f * i) / rate)
    }
  }
  return samples
}

const stored = (
  midi: number,
  startSec: number,
  endSec: number,
): StoredNote => ({
  midi,
  startSec,
  endSec,
})

const line = (start: number, words = ''): SongLine => ({ start, words })

describe('the lyrics', () => {
  it('reads each synced line: its start, and its words without their timings', () => {
    const lrc = [
      '[ar:Josh Woodward]',
      '[x-mp-timing:eyJ2IjoxfQ==]',
      "[00:11.72] I'll [00:11.99] be [00:12.33] right [00:12.82] behind [00:13.27] you, [00:13.97] Josephine",
      '[01:02.50]<01:02.50> Enhanced <01:03.00> words',
      '',
      'An untimed line',
    ].join('\n')
    expect(lyricLines(lrc)).toEqual([
      { start: 11.72, words: "I'll be right behind you, Josephine" },
      { start: 62.5, words: 'Enhanced words' },
    ])
  })
})

describe("the voice's pitch", () => {
  it('reads a note at any rate, the frame spanning the same time', () => {
    for (const rate of [VOCAL_RATE, 14_700, 22_050]) {
      const a3 = voice(rate, 1, [{ from: 0, to: 1, midi: 57 }])
      const midi = yinMidi(a3, Math.round(0.3 * rate), rate)
      expect(midi, `${rate} Hz`).not.toBeNull()
      expect(Math.abs((midi ?? 0) - 57) * 100, `${rate} Hz`).toBeLessThan(5)
    }
  })

  it('hears no pitch in silence', () => {
    const quiet = new Float32Array(VOCAL_RATE)
    expect(yinMidi(quiet, 4000, VOCAL_RATE)).toBeNull()
  })
})

describe('the lines of a song without synced lyrics', () => {
  it('are where the voice comes in after a breath, and the first', () => {
    const samples = voice(VOCAL_RATE, 14, [
      { from: 1, to: 3, midi: 57 },
      // Half a second's breath: the same line goes on.
      { from: 3.5, to: 5, midi: 59 },
      { from: 7, to: 9, midi: 60 },
      { from: 11, to: 13, midi: 57 },
    ])
    const starts = breathLines(loudness(samples, VOCAL_RATE)).map(
      (one) => one.start,
    )
    expect(starts).toHaveLength(3)
    for (const [i, at] of [1, 7, 11].entries()) {
      expect(Math.abs(starts[i] - at)).toBeLessThan(0.05)
    }
    expect(
      breathLines(loudness(samples, VOCAL_RATE)).every(
        (one) => one.words === '',
      ),
    ).toBe(true)
  })
})

describe('the entries', () => {
  const song = (
    notes: readonly {
      from: number
      to: number
      midi: number
      cents?: number
    }[],
  ) => {
    const samples = voice(VOCAL_RATE, 12, notes)
    return {
      vocal: { samples, rate: VOCAL_RATE },
      level: loudness(samples, VOCAL_RATE),
    }
  }

  it('are the lines after a breath, the band stopping just before the voice', () => {
    const { vocal, level } = song([
      { from: 2, to: 4, midi: 57 },
      { from: 6.5, to: 8, midi: 60 },
      { from: 10.5, to: 11.8, midi: 57 },
    ])
    const { entries, dropped } = findEntries({
      vocal,
      level,
      notes: [stored(57, 2, 4), stored(60, 6.5, 8), stored(57, 10.5, 11.8)],
      lines: [line(2, 'First line'), line(6.5, 'Second'), line(10.5, 'Last')],
    })
    expect(dropped).toEqual([])
    expect(entries.map((entry) => entry.midi)).toEqual([57, 60, 57])
    expect(entries.map((entry) => entry.words)).toEqual([
      'First line',
      'Second',
      'Last',
    ])
    const [first, , last] = entries
    expect(first.at).toBeGreaterThan(1.85)
    expect(first.at).toBeLessThanOrEqual(2)
    // The band leads in for eight seconds, or from the song's start.
    expect(first.from).toBe(0)
    expect(last.from).toBeCloseTo(last.at - 8, 2)
    // The line sung with you runs to the next line, or six and a half seconds.
    expect(first.until).toBeCloseTo(6.45, 2)
    expect(last.until).toBeCloseTo(last.at + 6.45, 2)
  })

  it('reads a line in steps, a step a pitch reading, to the same entry', () => {
    const { vocal, level } = song([
      { from: 2, to: 4, midi: 57 },
      { from: 6.5, to: 8, midi: 60 },
    ])
    const reading = {
      vocal,
      level,
      notes: [stored(57, 2, 4), stored(60, 6.5, 8)],
      lines: [line(2, 'First line'), line(6.5, 'Second')],
    }
    const steps = entrySteps(reading, 1, 58)
    let taken = 0
    let step = steps.next()
    while (step.done !== true) {
      taken += 1
      step = steps.next()
    }
    expect(step.value).toEqual(findEntry(reading, 1, 58))
    expect(step.value).toMatchObject({ midi: 60, words: 'Second' })
    // The note steadies a fifth of a second in: twenty readings at least.
    expect(taken).toBeGreaterThanOrEqual(20)
    expect(runSteps(entrySteps(reading, 0, 58))).toEqual(
      findEntry(reading, 0, 58),
    )
  })

  it('leaves out a line with no breath before it', () => {
    const { vocal, level } = song([
      { from: 2, to: 4, midi: 57 },
      { from: 4.3, to: 6, midi: 59 },
    ])
    const { entries, dropped } = findEntries({
      vocal,
      level,
      notes: [stored(57, 2, 4), stored(59, 4.3, 6)],
      lines: [line(2), line(4.3)],
    })
    expect(entries.map((entry) => entry.midi)).toEqual([57])
    // Not an entry, and not a dropped one: it never was a way in.
    expect(dropped).toEqual([])
  })

  it('drops a note the stored notes name differently', () => {
    const { vocal, level } = song([{ from: 2, to: 4, midi: 57 }])
    const { entries, dropped } = findEntries({
      vocal,
      level,
      notes: [stored(64, 2, 4)],
      lines: [line(2)],
    })
    expect(entries).toEqual([])
    expect(dropped[0]).toMatch(/YIN A3, notes E4/u)
  })

  it('drops a note sung out of tune', () => {
    const { vocal, level } = song([{ from: 2, to: 4, midi: 57, cents: 42 }])
    const { entries, dropped } = findEntries({
      vocal,
      level,
      notes: [stored(57, 2, 4)],
      lines: [line(2)],
    })
    expect(entries).toEqual([])
    expect(dropped[0]).toMatch(/cents off A3/u)
  })

  it("drops a note far from the song's middle", () => {
    const { vocal, level } = song([{ from: 2, to: 4, midi: 72 }])
    const notes = [stored(72, 2, 4), stored(57, 5, 20)]
    expect(middleNote(notes)).toBe(57)
    const { entries, dropped } = findEntries({
      vocal,
      level,
      notes,
      lines: [line(2)],
    })
    expect(entries).toEqual([])
    expect(dropped[0]).toMatch(/far from the song's A3/u)
  })

  it('drops a line whose note settles too late after the voice comes in', () => {
    // A slide up for most of a second before it holds.
    const rate = VOCAL_RATE
    const samples = new Float32Array(12 * rate)
    let phase = 0
    for (let i = 2 * rate; i < 4 * rate; i++) {
      const t = i / rate - 2
      const midi = t < 0.8 ? 50 + (t / 0.8) * 7 : 57
      phase += (2 * Math.PI * hz(midi)) / rate
      samples[i] = 0.5 * Math.sin(phase)
    }
    const { entries, dropped } = findEntries({
      vocal: { samples, rate },
      level: loudness(samples, rate),
      notes: [stored(57, 2, 4)],
      lines: [line(2)],
    })
    expect(entries).toEqual([])
    expect(dropped[0]).toMatch(/the note settles/u)
  })
})

/** A band of clicks every `period` s from `phase`, over a little noise. */
function clicks(seconds: number, period: number, phase: number): Float32Array {
  const random = seeded()
  const rate = BAND_RATE
  const samples = new Float32Array(Math.round(seconds * rate))
  for (let i = 0; i < samples.length; i++) {
    samples[i] = 0.01 * (random() * 2 - 1)
  }
  for (let t = phase; t < seconds; t += period) {
    const at = Math.round(t * rate)
    for (let i = 0; i < 220 && at + i < samples.length; i++) {
      samples[at + i] += 0.8 * (random() * 2 - 1) * Math.exp(-i / 40)
    }
  }
  return samples
}

describe('the beats', () => {
  const band = clicks(30, 0.5, 0.25)
  const whole = onsets({ samples: band, rate: BAND_RATE })

  it("reads the band's tempo from its onsets", () => {
    expect(Math.abs(tempoOf([whole]) - 120)).toBeLessThanOrEqual(1)
  })

  it('reads the onsets in steps, a step a spectrum, to the same grid', () => {
    const stretch = { samples: band.slice(0, 4 * BAND_RATE), rate: BAND_RATE }
    const steps = onsetSteps(stretch, 2)
    let taken = 0
    let step = steps.next()
    while (step.done !== true) {
      taken += 1
      step = steps.next()
    }
    expect(step.value).toEqual(onsets(stretch, 2))
    expect(taken).toBe(step.value.flux.length)
  })

  it('reads the same tempo from the lead-ins alone', () => {
    const rate = BAND_RATE
    const stretch = (from: number, to: number) =>
      onsets(
        {
          samples: band.slice(Math.round(from * rate), Math.round(to * rate)),
          rate,
        },
        from,
      )
    const leadIns = [
      stretch(1.7, 10.3),
      stretch(11.7, 20.3),
      stretch(19.7, 28.3),
    ]
    expect(Math.abs(tempoOf(leadIns) - 120)).toBeLessThanOrEqual(1)
    // A stretch keeps its place on the song's clock.
    const beats = beatsBefore(leadIns[1], 120, 12, 20)
    expect(beats).toHaveLength(4)
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i] - beats[i - 1]).toBeCloseTo(0.5, 1)
    }
    expect(beats[3]).toBeLessThan(20)
    expect(beats[3]).toBeGreaterThan(19.3)
  })

  it('counts the last four before the entry, on the grid', () => {
    const beats = beatsBefore(whole, 120, 20, 28)
    expect(beats).toHaveLength(4)
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i] - beats[i - 1]).toBeCloseTo(0.5, 1)
    }
    // On the clicks (a little ahead of them: an onset reads as its window
    // starts), never after the entry.
    for (const beat of beats) {
      const off = (((beat - 0.25) % 0.5) + 0.5) % 0.5
      expect(Math.min(off, 0.5 - off)).toBeLessThan(0.06)
      expect(beat).toBeLessThan(28)
    }
  })

  it('counts none where the beats carry no more onset than the rest', () => {
    // As busy between the beats as on them: no grid to count.
    const flat = { flux: new Array<number>(1200).fill(1), fps: 100, start: 0 }
    expect(beatsBefore(flat, 120, 2, 10)).toEqual([])
    // Nothing at all: a lead-in with no onsets.
    const silence = onsets({
      samples: new Float32Array(12 * BAND_RATE),
      rate: BAND_RATE,
    })
    expect(beatsBefore(silence, 120, 2, 10)).toEqual([])
  })

  it('counts none without a tempo', () => {
    expect(beatsBefore(whole, 0, 20, 28)).toEqual([])
    expect(tempoOf([])).toBe(0)
  })
})
