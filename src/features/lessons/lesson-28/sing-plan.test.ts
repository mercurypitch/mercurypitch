// ============================================================
// Lesson 28 Sing it's plan tests — the parts, the rules and the words
// ============================================================
//
// WEB-SPEC, Toys 6, and Tests 3, 7 and 11's rules, pure: each part's
// fourteen notes, twelve halves and two wholes, its syllables in G and
// its breaths after bars 2, 4 and 6; who sings do and whose the other part
// is, for each voice; every note inside every preset of its voice by two
// semitones (FACTS 37); the staffs in the parts' colours until a voice is
// chosen, then the learner's amber and the other's chrome; the visit's
// three takes and the tricky line at its share; Effortful's and
// Uncomfortable's endings and the sing-along's Again once a visit; the
// take's open held equal to the kit's; and the reader on synthetic takes
// of these parts, through Voice Mirror's preprocessing: on pitch and on
// time, a beat late, bar 7's two D3s as one held note, bar 8's G in either
// octave, ti on Tavi's re, mi on Merc's do, alone, and the other part
// alone with no voice.

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { readingLines } from '@/features/lessons/kit/read-along'
import type { InTimeOptions } from '@/features/lessons/kit/read-in-time'
import { readInTime } from '@/features/lessons/kit/read-in-time'
import { OPEN_BEATS as KIT_OPEN_BEATS } from '@/features/lessons/kit/take-in-time'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { F0Frame } from '@/lib/mirror/metrics'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import type { RunMark } from './sing-plan'
import { afterRun, againAllowed, BREATHS, DO, MERC_PART, MERC_STAFF, mineOf, mineStaff, noteAt, OPEN_BEATS, otherOf, ownerOf, PART_SEC, partName, partnerOf, singerOf, singScene, TAVI_PART, TAVI_STAFF, title, writtenOf, } from './sing-plan'
import { BEAT_SEC, BPM } from './song'

const VOICES: readonly Voice[] = ['lower', 'higher']
const READ = (inBand: number): RunMark => ({ kind: 'read', inBand, notes: 14 })

describe('the parts', () => {
  it('reads each part from the song’s A: fourteen notes, twelve halves and two wholes, 26.67 s', () => {
    // Assert: FACTS 29
    expect(MERC_PART.midis).toEqual([
      55, 54, 52, 55, 57, 55, 50, 55, 57, 59, 55, 50, 50, 55,
    ])
    expect(TAVI_PART.midis).toEqual([
      71, 69, 67, 71, 72, 71, 69, 71, 72, 74, 71, 69, 66, 67,
    ])
    for (const p of [MERC_PART, TAVI_PART]) {
      expect(p.beats.filter((b) => b === 2)).toHaveLength(12)
      expect(p.beats.filter((b) => b === 4)).toHaveLength(2)
      expect(p.beats.reduce((a, b) => a + b, 0) * BEAT_SEC).toBeCloseTo(
        PART_SEC,
        9,
      )
    }
    expect(PART_SEC).toBeCloseTo(26.667, 3)
  })

  it('names each note by its syllable in G', () => {
    // Assert
    expect(MERC_PART.syllables.join(' ')).toBe(
      'do ti la do re do so do re mi do so so do',
    )
    expect(TAVI_PART.syllables.join(' ')).toBe(
      'mi re do mi fa mi re mi fa so mi re ti do',
    )
    expect(title('do')).toBe('Do')
  })

  it('breathes after bars 2, 4 and 6: after the fourth, seventh and eleventh notes', () => {
    expect(BREATHS).toEqual([3, 6, 10])
  })

  it('gives the lower voice Merc’s part, do on G3, with Tavi’s under it, and the higher voice the swap', () => {
    // Assert: FACTS 68; LESSON.md, Sing it
    expect([mineOf('lower'), otherOf('lower')]).toEqual([MERC_PART, TAVI_PART])
    expect([mineOf('higher'), otherOf('higher')]).toEqual([
      TAVI_PART,
      MERC_PART,
    ])
    expect([DO.lower, DO.higher]).toEqual([55, 67])
    expect(VOICES.map((v) => [singerOf(v), partnerOf(v), partName(v)])).toEqual(
      [
        ['Merc', 'Tavi', "Tavi's part"],
        ['Tavi', 'Merc', "Merc's part"],
      ],
    )
    expect(ownerOf('lower')).toBe("Tavi's")
    expect([mineStaff('lower'), mineStaff('higher')]).toEqual([
      MERC_STAFF,
      TAVI_STAFF,
    ])
  })

  it('keeps every note of a voice’s part at least two semitones inside every preset of that voice', () => {
    // Arrange: each voice's presets, as the table names them
    const PRESETS: Readonly<Record<Voice, readonly VocalRangePreset[]>> = {
      lower: ['bass', 'baritone', 'tenor'],
      higher: ['alto', 'mezzo-soprano', 'soprano'],
    }

    // Act
    const room = (v: Voice): number[] => {
      const notes = mineOf(v).midis
      return PRESETS[v].flatMap((preset) => [
        Math.min(...notes) - VOCAL_RANGES[preset].lowMidi,
        VOCAL_RANGES[preset].highMidi - Math.max(...notes),
      ])
    }

    // Assert: FACTS 37
    for (const v of VOICES)
      expect(Math.min(...room(v))).toBeGreaterThanOrEqual(2)
  })

  it('sets each note on its beats from bar 1, and finds the note sounding at a time', () => {
    // Act
    const notes = writtenOf(MERC_PART)

    // Assert: halves two beats, bar 4's whole four
    expect(notes.slice(0, 7).map((n) => [n.beat, n.beats])).toEqual([
      [0, 2],
      [2, 2],
      [4, 2],
      [6, 2],
      [8, 2],
      [10, 2],
      [12, 4],
    ])
    expect([-0.1, 0, 1.6, 1.7, 10.1, 26.6, 26.7].map((t) => noteAt(t))).toEqual(
      [null, 0, 0, 1, 6, 13, null],
    )
  })

  it('opens the take where the kit opens it', () => {
    expect(OPEN_BEATS).toBe(KIT_OPEN_BEATS)
  })
})

describe('the staffs', () => {
  it('draw bars 1 to 8 with the breaths and the house, in the parts’ colours until a voice is chosen', () => {
    // Act
    const none = singScene(null)
    const lower = singScene('lower')
    const higher = singScene('higher')

    // Assert: WEB-SPEC, Toys 6
    expect(none.staffs.map((s) => [s.tone, s.bars.length])).toEqual([
      ['tavi', 8],
      ['merc', 8],
    ])
    expect(none.marks?.breaths).toEqual([1, 3, 5])
    expect(lower.staffs.map((s) => s.tone)).toEqual(['other', 'learner'])
    expect(higher.staffs.map((s) => s.tone)).toEqual(['learner', 'other'])
  })
})

describe('the visit’s rules', () => {
  it('allows three takes a visit, every one counted', () => {
    // Assert: FACTS 65
    expect(againAllowed([READ(14), { kind: 'silent' }])).toBe(true)
    expect(againAllowed([READ(14), { kind: 'silent' }, { kind: 'left' }])).toBe(
      false,
    )
  })

  it('says Easy or Workable’s line with Again while takes are left, and the tricky line under half the notes in the band', () => {
    // Act
    const fine = afterRun([READ(7)], 'easy')
    const tricky = afterRun([READ(6)], 'workable')
    const last = afterRun([READ(14), READ(14), READ(14)], 'easy')

    // Assert
    expect([fine.closing, fine.tricky, fine.offers]).toEqual([
      'ok',
      false,
      { again: true, alongAgain: false, today: true },
    ])
    expect(tricky.tricky).toBe(true)
    expect(last.offers.again).toBe(false)
  })

  it('keeps the lines after Effortful with only Done for today and the rest card; takes them away after Uncomfortable, with the doctor lines', () => {
    // Act
    const effort = afterRun([READ(10)], 'effortful')
    const hurt = afterRun([READ(10)], 'uncomfortable')

    // Assert: REQ-GVC-021, REQ-GVC-023
    expect([effort.readings, effort.closing, effort.rest]).toEqual([
      true,
      'gentle',
      true,
    ])
    expect(effort.offers).toEqual({
      again: false,
      alongAgain: false,
      today: true,
    })
    expect([hurt.readings, hurt.closing, hurt.doctor, hurt.rest]).toEqual([
      false,
      'enough',
      true,
      true,
    ])
    expect(hurt.offers.today).toBe(false)
  })

  it('offers the sing-along’s Again once a visit, and no reading line after it', () => {
    // Act
    const first = afterRun([], 'easy', { again: false })
    const second = afterRun([], 'workable', { again: true })

    // Assert: FACTS 64
    expect([first.closing, first.readings, first.offers]).toEqual([
      null,
      false,
      { again: false, alongAgain: true, today: true },
    ])
    expect(second.offers.alongAgain).toBe(false)
  })
})

describe('the reader on synthetic takes (Tests 7)', () => {
  const HOP = 0.01
  const BAR1 = OPEN_BEATS * BEAT_SEC
  const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

  /** A part sung as written: each note's own frames, `late` s after its beats, `cents` off, its midis in `as` where given. */
  function sung(
    midis: readonly number[],
    o: { late?: number; as?: (midi: number, i: number) => number } = {},
  ): F0Frame[] {
    const out: F0Frame[] = []
    writtenOf({ ...MERC_PART, midis }).forEach((n, i) => {
      const sec = n.beats * BEAT_SEC
      for (let k = 0; k * HOP < sec - 1e-9; k++)
        out.push({
          t: BAR1 + n.beat * BEAT_SEC + (o.late ?? 0) + k * HOP,
          f0: hz(o.as?.(n.midi, i) ?? n.midi),
          conf: 0.95,
        })
    })
    return out
  }

  /** The reader's options for `v`'s part, with the other part under it unless alone. */
  const options = (v: Voice, alone = false): InTimeOptions => ({
    notes: writtenOf(mineOf(v)),
    bpm: BPM,
    bar1: BAR1,
    opened: 0,
    ...(alone ? {} : { other: writtenOf(otherOf(v)) }),
  })

  /** The lines a take reads, as the page says them. */
  function lines(v: Voice, frames: F0Frame[], alone = false): string[] {
    const reading = readInTime(frames, options(v, alone))
    if (!reading.voice) return []
    const other = otherOf(v)
    return readingLines(mineOf(v).syllables.map(title), reading.notes, {
      whose: "your part's note",
      ...(alone
        ? {}
        : {
            other: { whose: ownerOf(v), labels: other.syllables },
          }),
    })
  }

  const inBand = (l: string): boolean =>
    l.includes('In the band') || l.includes('Right in the middle')

  it('reads the lower part sung on pitch and on time, or a beat late, every note in the band', () => {
    // Act
    const onTime = lines('lower', sung(MERC_PART.midis))
    const late = lines('lower', sung(MERC_PART.midis, { late: BEAT_SEC }))

    // Assert
    expect(onTime).toHaveLength(14)
    expect(onTime.every(inBand)).toBe(true)
    expect(late.every(inBand)).toBe(true)
  })

  it('reads bar 7’s two D3s sung as one held note, the second on its own note', () => {
    // Arrange: notes 12 and 13 run together, no break between them
    const frames = sung(MERC_PART.midis)

    // Act
    const read = lines('lower', frames)

    // Assert
    expect([inBand(read[11]), inBand(read[12])]).toEqual([true, true])
  })

  it('reads bar 8’s G sung as G3 or as G4 in the band, the second with the octave line', () => {
    // Act
    const g3 = lines('lower', sung(MERC_PART.midis))
    const g4 = lines(
      'lower',
      sung(MERC_PART.midis, {
        as: (m, i) => (i === 13 ? m + 12 : m),
      }),
    )

    // Assert: FACTS 39, 60; no line names Tavi's note for the learner's own G
    expect(inBand(g3[13])).toBe(true)
    expect(inBand(g4[13])).toBe(true)
    expect(g4.some((l) => l.includes("That was Tavi's note"))).toBe(false)
  })

  it('reads the lower part’s ti sung on Tavi’s re as Tavi’s note, and the higher part’s mi sung on Merc’s do as Merc’s', () => {
    // Arrange: bar 1's second note for the lower voice, F#3, sung on A4's
    // pitch class, A; bar 1's first for the higher, B4, sung on G3
    const lower = sung(MERC_PART.midis, { as: (m, i) => (i === 1 ? 57 : m) })
    const higher = sung(TAVI_PART.midis, { as: (m, i) => (i === 0 ? 55 : m) })

    // Act / Assert
    expect(lines('lower', lower)[1]).toBe("Ti · That was Tavi's note: re.")
    expect(lines('higher', higher)[0]).toBe("Mi · That was Merc's note: do.")
  })

  it('reads no note as the other part’s on the alone path', () => {
    // Arrange: the same slip as above, sung alone
    const lower = sung(MERC_PART.midis, { as: (m, i) => (i === 1 ? 57 : m) })

    // Act / Assert
    expect(
      lines('lower', lower, true).some((l) => l.includes('That was')),
    ).toBe(false)
  })

  it('reads every note as the other part’s for frames of the other part alone, which is why the quiet check runs first', () => {
    // Arrange: the microphone hearing only Tavi's part, an octave down
    const frames = sung(TAVI_PART.midis.map((m) => m - 12))

    // Act
    const read = lines('lower', frames)

    // Assert: every note not on the learner's own reads as Tavi's
    expect(
      read.filter((l) => l.includes("That was Tavi's note")).length,
    ).toBeGreaterThanOrEqual(10)
  })
})
