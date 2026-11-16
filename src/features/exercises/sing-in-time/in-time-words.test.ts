import { describe, expect, it } from 'vitest'
import { BRIEF, coachLine, countLine, doLine, hintLine, noteLine, tuneLine, } from './in-time-words'
import type { NoteVerdict } from './take-judge'
import type { Tune, TuneNote } from './tune-plan'
import { KEYS } from './tune-plan'

const note = (
  syllable: string,
  beat: number,
  beats: number,
  midi: number,
): TuneNote => ({
  beat,
  beats,
  degree: 0,
  written: { letter: 'C', alter: 0, octave: 4 },
  place: 0,
  midi,
  syllable,
})

/** Do re mi, a half, then fa re do: six notes, at 60. */
const TUNE: Tune = {
  key: KEYS[2],
  clef: 'treble',
  bpm: 60,
  doMidi: 60,
  notes: [
    note('do', 0, 1, 60),
    note('re', 1, 1, 62),
    note('mi', 2, 2, 64),
    note('fa', 4, 1, 65),
    note('re', 5, 1, 62),
    note('do', 6, 2, 60),
  ],
}

const IN: NoteVerdict = {
  pitch: 'in-tune',
  cents: 0,
  offset: 0,
  timing: 'on-time',
}
const NOT_HEARD: NoteVerdict = {
  pitch: 'not-heard',
  cents: null,
  offset: null,
  timing: null,
}
const late = (cents = 0): NoteVerdict => ({
  pitch: 'in-tune',
  cents,
  offset: 0.4,
  timing: 'late',
})
const early: NoteVerdict = {
  pitch: 'in-tune',
  cents: 5,
  offset: -0.3,
  timing: 'early',
}
const off = (cents: number): NoteVerdict => ({
  pitch: 'off',
  cents,
  offset: null,
  timing: null,
})

/** The tune's verdicts, all in tune and on time but where `at` says. */
const tuneWith = (at: Readonly<Record<number, NoteVerdict>>): NoteVerdict[] =>
  TUNE.notes.map((_, i) => at[i] ?? IN)

describe('before a run', () => {
  it('Merc gives the brief, and the run under it', () => {
    expect(BRIEF).toBe(
      "I give you do, then the click counts one bar. Keep reading: the beat won't wait.",
    )
    expect(hintLine(5)).toBe(
      '3 tunes · 60 BPM · quarters and halves, steps and thirds',
    )
    expect(hintLine(1)).toBe('3 tunes · 50 BPM · quarters, steps')
  })
})

describe('during a tune', () => {
  it('names do and the key while do sounds', () => {
    expect(doLine(TUNE)).toBe('This is do. The tune is in F major.')
  })

  it('counts the bar in as singers do', () => {
    expect(countLine(1)).toBe('One.')
    expect(countLine(2)).toBe('One, two.')
    expect(countLine(3)).toBe('One, two, ready.')
    expect(countLine(4)).toBe('One, two, ready, sing!')
    expect(countLine(0)).toBe('One.')
  })

  it('says each note and its count as its beat comes, the count alone with the names off', () => {
    expect(noteLine(TUNE.notes[1], true)).toBe('Re, on 2.')
    expect(noteLine(TUNE.notes[2], true)).toBe('Mi, on 3, hold 4.')
    expect(noteLine(TUNE.notes[3], true)).toBe('Fa, on 1.')
    expect(noteLine(TUNE.notes[3], false)).toBe('On 1.')
    expect(noteLine(note('so', 1.5, 0.5, 67), true)).toBe(
      'So, on the and of 2.',
    )
  })
})

describe('after a tune', () => {
  it('praises a clean tune', () => {
    expect(tuneLine(TUNE, tuneWith({}), true)).toBe(
      'All 6 in tune, on the beat.',
    )
  })

  it('names the one note most worth singing again', () => {
    expect(tuneLine(TUNE, tuneWith({ 3: late() }), true)).toBe(
      'All 6 in tune. Fa came in late.',
    )
    expect(tuneLine(TUNE, tuneWith({ 3: late(-45) }), true)).toBe(
      'All 6 in tune. Fa came in late and a touch flat.',
    )
    expect(tuneLine(TUNE, tuneWith({ 1: early, 3: off(80) }), true)).toBe(
      '5 of 6 in tune. Fa sat sharp.',
    )
    expect(tuneLine(TUNE, tuneWith({ 3: off(80), 4: NOT_HEARD }), true)).toBe(
      "4 of 6 in tune. We didn't hear a steady note on re.",
    )
  })

  it('names the first of two notes equally worth it', () => {
    expect(tuneLine(TUNE, tuneWith({ 1: early, 4: late() }), true)).toBe(
      'All 6 in tune. Re came in early.',
    )
  })

  it('asks for more voice when it heard none', () => {
    expect(
      tuneLine(
        TUNE,
        TUNE.notes.map(() => NOT_HEARD),
        false,
      ),
    ).toBe("I didn't hear you that time. Sing out on the next one.")
  })
})

describe('after the run', () => {
  const run = [TUNE, TUNE, TUNE]

  it('opens the next level on a clean run', () => {
    expect(
      coachLine(
        run,
        [tuneWith({}), tuneWith({}), tuneWith({})],
        [0.1, 0.1, 0.1],
      ),
    ).toBe('Every note in tune and on the beat. Ready for the next level.')
  })

  it('says a late entry was counted from the first note, never as wrong notes', () => {
    expect(
      coachLine(
        run,
        [tuneWith({}), tuneWith({}), tuneWith({})],
        [0.1, 0.6, 0.1],
      ),
    ).toBe(
      'Every note in tune. You came in after the beat, so I counted from your first note: try coming in on 1.',
    )
  })

  it('names a note not heard before a note off, and a note off before a slip in time', () => {
    const marks = [
      tuneWith({ 1: early }),
      tuneWith({ 3: off(-90) }),
      tuneWith({ 4: NOT_HEARD }),
    ]
    expect(coachLine(run, marks, [0, 0, 0])).toBe(
      "We didn't hear a steady note on re in tune 3. Keep the beat going, and come in on the next note.",
    )
    expect(coachLine(run, marks.slice(0, 2), [0, 0])).toBe(
      'Fa in tune 2 sat flat. Hear do in your head, find fa from it, then sing it again.',
    )
    expect(coachLine(run, marks.slice(0, 1), [0])).toBe(
      'Re in tune 1 came in early. Count 1, 2 out loud once, then sing it again.',
    )
  })

  it('counts the bar line round for a note on 1', () => {
    expect(coachLine(run, [tuneWith({ 3: late() })], [0])).toBe(
      'Fa in tune 1 came in late. Count 4, 1 out loud once, then sing it again.',
    )
  })

  it('asks after the microphone when it heard no note at all', () => {
    const none = TUNE.notes.map(() => NOT_HEARD)
    expect(coachLine(run, [none, none, none], [null, null, null])).toBe(
      "I didn't hear a note. Check the microphone, then sing along on the next run.",
    )
  })
})
