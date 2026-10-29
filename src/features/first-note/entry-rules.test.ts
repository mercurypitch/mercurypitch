// ============================================================
// First note's entry rules, on songs made here to known answers
// ============================================================
//
// The rules (entry-rules.ts) are the script's and the phone's both. The
// script's own check is that it writes the committed entries again
// unchanged (first-note-entries.json); these hold each rule to a song whose
// answer is known: a voice of pure notes at known places (the band's beats
// are band-beats.test.ts's). A song of the singer's own brings what the
// examples never did: lyrics synced to another recording, a recording tuned
// off A440, and stored notes an octave out or cut a moment either side.

import { describe, expect, it } from 'vitest'
import type { SongLine, StoredNote } from './entry-rules'
import { breathLines, findEntries, judgeLine, lineSteps, loudness, lyricLines, lyricsShift, middleNote, runSteps, songLines, songTuning, VOCAL_RATE, yinMidi, } from './entry-rules'

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
    const [first, second, last] = entries
    expect(first.at).toBeGreaterThan(1.85)
    expect(first.at).toBeLessThanOrEqual(2)
    // The band leads in for eight seconds, or from the song's start.
    expect(first.from).toBe(0)
    expect(last.from).toBeCloseTo(last.at - 8, 2)
    // The line sung with you runs to the next line, ending before its voice
    // comes in, or six and a half seconds.
    expect(first.until).toBeCloseTo(6.45, 1)
    expect(first.until).toBeLessThanOrEqual(second.at)
    expect(last.until).toBeCloseTo(last.at + 6.45, 2)
  })

  it("reads a line's voice in steps, a step a pitch reading", () => {
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
    const steps = lineSteps(reading, 1)
    let taken = 0
    let step = steps.next()
    while (step.done !== true) {
      taken += 1
      step = steps.next()
    }
    expect(step.value?.line).toBe(1)
    expect(step.value?.steady?.midi).toBeCloseTo(60, 0)
    // The note steadies a fifth of a second in: twenty readings at least.
    expect(taken).toBeGreaterThanOrEqual(20)
    expect(findEntries(reading).entries[1]).toMatchObject({
      midi: 60,
      words: 'Second',
    })
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

  it('tells what became of every line, the breath of one with too little', () => {
    const { vocal, level } = song([
      { from: 2, to: 4, midi: 57 },
      { from: 4.3, to: 6, midi: 59 },
      { from: 8, to: 9, midi: 64 },
    ])
    const { told } = findEntries({
      vocal,
      level,
      notes: [stored(57, 2, 4), stored(59, 4.3, 6), stored(60, 8, 9)],
      lines: [line(2), line(4.3), line(8)],
    })
    expect(told).toHaveLength(3)
    expect(told[0]).toBe('2.00 entry A3')
    expect(told[1]).toMatch(/^4\.30 no breath before it \(0\.\d s\)$/u)
    expect(told[2]).toBe('8.00 YIN E4, notes C4')
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

describe("a song of the singer's own", () => {
  /** Five phrases two seconds long, three seconds' breath between them. */
  const phrases = (cents = 0) =>
    [2, 7, 12, 17, 22].map((from, i) => ({
      from,
      to: from + 2,
      midi: [57, 60, 57, 62, 59][i],
      cents,
    }))
  const sung = (cents = 0) => {
    const samples = voice(VOCAL_RATE, 26, phrases(cents))
    return {
      vocal: { samples, rate: VOCAL_RATE },
      level: loudness(samples, VOCAL_RATE),
    }
  }
  const storedOf = () =>
    phrases().map((phrase) => stored(phrase.midi, phrase.from, phrase.to))
  const words = ['One', 'Two', 'Three', 'Four', 'Five']
  /** One note sung from 2 to 4 s. */
  const song = (
    notes: readonly { from: number; to: number; midi: number }[],
  ) => {
    const samples = voice(VOCAL_RATE, 12, notes)
    return {
      vocal: { samples, rate: VOCAL_RATE },
      level: loudness(samples, VOCAL_RATE),
    }
  }

  it('moves lyrics synced to another recording onto this one', () => {
    const { vocal, level } = sung()
    // Lyrics a song's other release put eight tenths of a second later.
    const late = phrases().map((phrase, i) => line(phrase.from + 0.8, words[i]))
    expect(lyricsShift(level, late)).toBeCloseTo(-0.8, 1)
    const { lines, shift } = songLines(level, late)
    expect(shift).toBeCloseTo(-0.8, 1)
    // Where the voice comes in, with the lyrics' words.
    expect(lines.map((one) => one.words)).toEqual(words)
    for (const [i, one] of lines.entries()) {
      expect(Math.abs(one.start - phrases()[i].from)).toBeLessThan(0.05)
    }
    const found = findEntries({ vocal, level, notes: storedOf(), lines })
    expect(found.entries.map((entry) => entry.words)).toEqual(words)
    // Read at the lyrics' own times, every line lands inside the voice
    // before it: no breath before any of them, and no entry.
    const asSynced = findEntries({
      vocal,
      level,
      notes: storedOf(),
      lines: late,
    })
    expect(asSynced.entries.length).toBeLessThanOrEqual(1)
  })

  it("keeps the voice's own lines where no shift fits the lyrics", () => {
    const { level } = sung()
    const elsewhere = [line(0.4, 'A'), line(4.9, 'B'), line(9.1, 'C')]
    expect(lyricsShift(level, elsewhere)).toBeNull()
    const { lines, shift } = songLines(level, elsewhere)
    expect(shift).toBeNull()
    expect(lines).toEqual(breathLines(level))
  })

  it('judges a song in its own tuning, and says how far out it is', () => {
    // A recording a third of a semitone sharp of A440, sung in tune with it.
    const { vocal, level } = sung(35)
    const found = findEntries({
      vocal,
      level,
      notes: storedOf(),
      lines: breathLines(level),
    })
    expect(found.tuning).toBeGreaterThanOrEqual(30)
    expect(found.tuning).toBeLessThanOrEqual(40)
    expect(found.dropped).toEqual([])
    expect(found.entries.map((entry) => entry.midi)).toEqual([
      57, 60, 57, 62, 59,
    ])
    expect(found.entries.every((entry) => entry.cents === found.tuning)).toBe(
      true,
    )
    // In A440 every note is out of tune.
    const reading = {
      vocal,
      level,
      notes: storedOf(),
      lines: breathLines(level),
    }
    for (let i = 0; i < 5; i++) {
      const voice = runSteps(lineSteps(reading, i))
      expect(voice).not.toBeNull()
      if (voice === null) continue
      expect(judgeLine(reading, voice, middleNote(storedOf()), 0)).toMatch(
        /cents off/u,
      )
    }
  })

  it('keeps A440 for a song within ten cents of it, or with too few notes to tell', () => {
    const { vocal, level } = sung(6)
    const found = findEntries({
      vocal,
      level,
      notes: storedOf(),
      lines: breathLines(level),
    })
    expect(found.tuning).toBe(0)
    expect(found.entries.every((entry) => entry.cents === undefined)).toBe(true)
    const few = [36, 34, 35, 37].map((cents) => ({
      line: 0,
      steady: { t: 1, until: 1.2, midi: 57 + cents / 100, swung: false },
      voiceIn: 1,
    }))
    expect(songTuning(few)).toBe(0)
    expect(songTuning([...few, { ...few[2], line: 4 }])).toBe(35)
  })

  it('takes stored notes an octave out, in the octave nearer the song', () => {
    const { vocal, level } = song([{ from: 2, to: 4, midi: 57 }])
    // The other tracker heard A4; the song sits around A3.
    const notes = [stored(69, 2, 4), stored(57, 5, 20)]
    const low = findEntries({ vocal, level, notes, lines: [line(2)] })
    expect(low.entries.map((entry) => entry.midi)).toEqual([57])
    // Around A4, the same voice is A4.
    const high = findEntries({
      vocal,
      level,
      notes: [stored(69, 2, 4), stored(69, 5, 20)],
      lines: [line(2)],
    })
    expect(high.entries.map((entry) => entry.midi)).toEqual([69])
  })

  it('takes a stored note the other tracker starts a moment after the voice settles', () => {
    const { vocal, level } = song([{ from: 2, to: 4, midi: 57 }])
    // A pickup it heard first, then the note itself from 2.15 s.
    const notes = [stored(48, 1.95, 2.12), stored(57, 2.15, 4)]
    const found = findEntries({ vocal, level, notes, lines: [line(2)] })
    expect(found.entries.map((entry) => entry.midi)).toEqual([57])
  })

  it('takes no word from a stored note that ended before the voice settled', () => {
    const { vocal, level } = song([{ from: 2, to: 4, midi: 57 }])
    // The other tracker heard A3 end just before, and C4 under the voice.
    const notes = [stored(57, 1, 1.98), stored(60, 2, 4)]
    const found = findEntries({ vocal, level, notes, lines: [line(2)] })
    expect(found.entries).toEqual([])
    expect(found.dropped).toEqual([expect.stringMatching(/YIN A3, notes C4/u)])
  })

  it('takes the octave nearest the song, of every one the stored notes name', () => {
    const { vocal, level } = song([{ from: 2, to: 4, midi: 57 }])
    // A2 for a moment, then A4, in a song around A4.
    const notes = [stored(45, 2, 2.1), stored(69, 2.1, 4), stored(69, 5, 20)]
    const found = findEntries({ vocal, level, notes, lines: [line(2)] })
    expect(found.entries.map((entry) => entry.midi)).toEqual([69])
  })

  /** A voice of `notes` over `seconds`, as a reading's vocal and level. */
  const take = (
    seconds: number,
    notes: readonly { from: number; to: number; midi: number }[],
  ) => {
    const samples = voice(VOCAL_RATE, seconds, notes)
    return {
      vocal: { samples, rate: VOCAL_RATE },
      level: loudness(samples, VOCAL_RATE),
    }
  }

  it("gives a lyric line synced early, with no breath before it, its phrase's words", () => {
    // The second phrase runs on, so the third's breath is 2.2 s, and its
    // lyric line, a second early, starts 1.2 s after the voice stops.
    const sungHere = phrases().map((phrase, i) =>
      i === 1 ? { ...phrase, to: 9.8 } : phrase,
    )
    const { vocal, level } = take(26, sungHere)
    const early = phrases().map((phrase, i) =>
      line(i === 2 ? phrase.from - 1 : phrase.from, words[i]),
    )
    const { lines, shift } = songLines(level, early)
    expect(shift).toBeCloseTo(0, 1)
    expect(lines.map((one) => one.words)).toEqual(words)
    const notes = sungHere.map((one) => stored(one.midi, one.from, one.to))
    const found = findEntries({ vocal, level, notes, lines })
    expect(found.entries.map((entry) => entry.words)).toEqual(words)
  })

  it("lets no empty lyric line take a phrase's words or cut its line short", () => {
    const { vocal, level } = sung()
    // An empty line marks the break, 0.8 s before the third phrase.
    const marked = phrases().map((phrase, i) => line(phrase.from, words[i]))
    marked.splice(2, 0, line(11.2))
    const { lines } = songLines(level, marked)
    const found = findEntries({ vocal, level, notes: storedOf(), lines })
    expect(found.entries.map((entry) => entry.words)).toEqual(words)
    // The third phrase's line is sung with you to the fourth's.
    expect(found.entries[2].until).toBeCloseTo(16.95, 1)
  })

  it('keeps the first sung line an entry when bleed comes just before it', () => {
    // Bleed in the intro: a blip at 1 s, and two just before the first line.
    const { vocal, level } = take(24, [
      { from: 1, to: 1.1, midi: 57 },
      { from: 8.4, to: 8.5, midi: 57 },
      { from: 9, to: 9.1, midi: 57 },
      { from: 9.6, to: 11.6, midi: 57 },
      { from: 14.6, to: 16.6, midi: 60 },
      { from: 19.6, to: 21.6, midi: 57 },
    ])
    const lyrics = [
      line(9.6, 'First'),
      line(14.6, 'Second'),
      line(19.6, 'Third'),
    ]
    const { lines } = songLines(level, lyrics)
    // The voice's lines begin with the bleed's, ahead of the lyrics.
    expect(lines[0].words).toBe('')
    const notes = [stored(57, 9.6, 11.6), stored(60, 14.6, 16.6)]
    notes.push(stored(57, 19.6, 21.6))
    const found = findEntries({ vocal, level, notes, lines })
    expect(found.entries.map((entry) => entry.words)).toEqual([
      'First',
      'Second',
      'Third',
    ])
  })

  it("ends a line sung with you before the next entry's voice", () => {
    // A short phrase, then the next entry 1.7 s later: less than the
    // shortest line sung with you.
    const { vocal, level } = take(8, [
      { from: 2, to: 2.4, midi: 57 },
      { from: 4.1, to: 6, midi: 60 },
    ])
    const notes = [stored(57, 2, 2.4), stored(60, 4.1, 6)]
    const found = findEntries({
      vocal,
      level,
      notes,
      lines: breathLines(level),
    })
    const [first, second] = found.entries
    expect(found.entries).toHaveLength(2)
    expect(first.until).toBe(second.at)
  })

  it('moves no lyrics onto a song of many short phrases by chance', () => {
    // A phrase about every second: lyrics land somewhere at almost any shift.
    const random = seeded(5)
    const many: { from: number; to: number; midi: number }[] = []
    for (let at = 1; at < 39; ) {
      const to = at + 0.3 + 0.4 * random()
      many.push({ from: at, to, midi: 57 })
      at = to + 0.3 + 0.3 * random()
    }
    const { level } = take(41, many)
    const other = Array.from({ length: 40 }, (_, i) =>
      line(1 + 38 * random(), `Line ${i}`),
    ).sort((a, b) => a.start - b.start)
    expect(lyricsShift(level, other)).toBeNull()
    // Lyrics that do fit it still move: every third phrase, 0.3 s late.
    const fit = many
      .filter((_, i) => i % 3 === 0)
      .map((one, i) => line(one.from + 0.3, `Line ${i}`))
    expect(lyricsShift(level, fit)).toBeCloseTo(-0.3, 1)
  })
})
