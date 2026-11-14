// ============================================================
// Lesson 26 Sing it's plan tests — the parts in G, the words and the set's rules
// ============================================================
//
// WEB-SPEC, Toys 5, and FACTS 50 to 61: the lower voice's part, la ti do
// ti la, a third under the tune in G on G3, and the higher voice's, mi fa
// so fa mi, a third over it on G4; every note of both voices' parts and
// tunes at least two semitones inside every preset of its voice (Tests 3);
// the beats, a beat each and the last two; who sings, and every line in
// both voices; the figure's axis, the take's own; and the set's rules
// (Tests 10): the swap only after Easy or Workable on the learner's part,
// three takes a set, the tricky line under half the notes in the band,
// Effortful's and Uncomfortable's endings, and the sing-along's Again once
// a visit.

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { WINDOW_BEATS } from '@/features/lessons/kit/read-in-time'
import { OPEN_BEATS } from '@/features/lessons/kit/take-in-time'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import type { RunMark } from './sing-plan'
import { afterRun, againAllowed, AXIS, beatsOf, figureWords, modelStatus, noteAt, partName, partOf, pitchWords, setParts, startSoundOff, swapLine, takeStatus, tuneOf, turnFirst, } from './sing-plan'

const VOICES: readonly Voice[] = ['lower', 'higher']
const READ = (inBand: number): RunMark => ({ kind: 'read', inBand, notes: 5 })

describe('Sing it’s parts', () => {
  it('sings the tune do re mi re do in G, on G3 for the lower voice and G4 for the higher', () => {
    // Assert: FACTS 50, 51
    expect(tuneOf('lower').midis).toEqual([55, 57, 59, 57, 55])
    expect(tuneOf('higher').midis).toEqual([67, 69, 71, 69, 67])
    expect(tuneOf('lower').syllables).toEqual(['do', 're', 'mi', 're', 'do'])
  })

  it('puts the lower voice’s part a third under the tune and the higher voice’s a third over it, in the key', () => {
    // Assert: E3 F♯3 G3 F♯3 E3, and B4 C5 D5 C5 B4
    expect(partOf('lower')).toEqual({
      midis: [52, 54, 55, 54, 52],
      syllables: ['la', 'ti', 'do', 'ti', 'la'],
    })
    expect(partOf('higher')).toEqual({
      midis: [71, 72, 74, 72, 71],
      syllables: ['mi', 'fa', 'so', 'fa', 'mi'],
    })
    // each pair of notes a third apart, three or four semitones (FACTS 28)
    for (const v of VOICES) {
      const gaps = partOf(v).midis.map((m, i) =>
        Math.abs(m - tuneOf(v).midis[i]),
      )
      expect(gaps.every((g) => g === 3 || g === 4)).toBe(true)
    }
  })

  it('swaps the parts: the learner sings the tune while Merc sings the part', () => {
    // Act
    const swap = setParts('lower', 'swap')

    // Assert
    expect(swap.mine).toEqual(tuneOf('lower'))
    expect(swap.other).toEqual(partOf('lower'))
    expect(setParts('higher', 'part').other).toEqual(tuneOf('higher'))
  })

  it('times each part a beat a note, the last two, at 60 BPM, as the reader takes it', () => {
    // Assert: FACTS 54
    expect(beatsOf(partOf('lower').midis)).toEqual([
      { midi: 52, beat: 0, beats: 1 },
      { midi: 54, beat: 1, beats: 1 },
      { midi: 55, beat: 2, beats: 1 },
      { midi: 54, beat: 3, beats: 1 },
      { midi: 52, beat: 4, beats: 2 },
    ])
    expect([0, 0.99, 1, 3.5, 4, 5.99, 6, -0.1].map(noteAt)).toEqual([
      0,
      0,
      1,
      3,
      4,
      4,
      null,
      null,
    ])
  })

  it('keeps every note of both parts and the tune at least two semitones inside every preset of its voice', () => {
    // Arrange: each voice's presets, as the table names them
    const PRESETS: Readonly<Record<Voice, readonly VocalRangePreset[]>> = {
      lower: ['bass', 'baritone', 'tenor'],
      higher: ['alto', 'mezzo-soprano', 'soprano'],
    }

    // Act
    const room = (v: Voice): number[] => {
      const notes = [...partOf(v).midis, ...tuneOf(v).midis]
      return PRESETS[v].flatMap((preset) => [
        Math.min(...notes) - VOCAL_RANGES[preset].lowMidi,
        VOCAL_RANGES[preset].highMidi - Math.max(...notes),
      ])
    }

    // Assert: FACTS 50
    for (const v of VOICES)
      expect(Math.min(...room(v))).toBeGreaterThanOrEqual(2)
  })

  it('draws the figure on the take’s own axis', () => {
    // Assert: half a beat before bar 1, a quarter of a beat after the last note
    expect(AXIS).toEqual({ lead: OPEN_BEATS, tail: WINDOW_BEATS })
  })
})

describe('Sing it’s words', () => {
  it('names Merc for the lower voice and Tavi for the higher in every line', () => {
    // Assert: LESSON.md, Sing it
    expect(partName('lower')).toBe("Merc's part")
    expect(partName('higher')).toBe("Tavi's part")
    expect(modelStatus('higher')).toBe('Tavi sings your part alone first.')
    expect(takeStatus('lower')).toBe("Your turn: sing your part with Merc's.")
    expect(swapLine('higher')).toBe(
      'Now swap: sing the tune while Tavi sings your part.',
    )
    expect(startSoundOff('lower')).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's part, then press Start.",
    )
  })

  it('opens Your turn on the part the set sings', () => {
    // Assert: FACTS 55, 56
    expect(turnFirst('lower', 'part')).toBe(
      'la ti do ti la, a third below the tune.',
    )
    expect(turnFirst('higher', 'part')).toBe(
      'mi fa so fa mi, a third above the tune.',
    )
    expect(turnFirst('higher', 'swap')).toBe('do re mi re do, the tune.')
  })

  it('says what the figure draws, before a run and after it', () => {
    // Assert
    expect(figureWords('lower', 'part')).toBe(
      "Your part as five bands: la, ti, do, ti and la, with Merc's tune beside it",
    )
    expect(figureWords('higher', 'swap')).toBe(
      "Your part as five bands: do, re, mi, re and do, with Tavi's part beside it",
    )
    expect(pitchWords('lower', 'part', -1)).toBe(
      "Your part as five bands: la, ti, do, ti and la, with Merc's tune beside it, and your pitch line over the bands. It is drawn in your part's octave.",
    )
  })
})

describe('the set’s rules', () => {
  const after = (
    set: 'part' | 'swap',
    runs: readonly RunMark[],
    f: Feeling,
    along: { readonly again: boolean } | null = null,
  ) => afterRun(set, runs, f, along)

  it('offers the swap, Again and Done for today after Easy or Workable on the learner’s part', () => {
    for (const f of ['easy', 'workable'] as const) {
      // Act
      const a = after('part', [READ(5)], f)

      // Assert: FACTS 56
      expect(a.closing).toBe('swap')
      expect(a.offers).toEqual({
        swap: true,
        again: true,
        alongAgain: false,
        today: true,
      })
      expect([a.readings, a.tricky, a.rest, a.doctor]).toEqual([
        true,
        false,
        false,
        false,
      ])
    }
  })

  it('offers Again and Done for today after Easy on the swap, and no swap', () => {
    // Act
    const a = after('swap', [READ(4)], 'easy')

    // Assert
    expect(a.closing).toBeNull()
    expect(a.offers).toEqual({
      swap: false,
      again: true,
      alongAgain: false,
      today: true,
    })
  })

  it('allows three takes a set, every take counted', () => {
    // Arrange: a run with no voice, one left, and one read
    const runs: RunMark[] = [{ kind: 'silent' }, { kind: 'left' }, READ(5)]

    // Act / Assert: FACTS 57
    expect(againAllowed(runs.slice(0, 2))).toBe(true)
    expect(againAllowed(runs)).toBe(false)
    expect(after('part', runs, 'easy').offers.again).toBe(false)
    expect(after('part', runs, 'easy').offers.swap).toBe(true)
  })

  it('gives the tricky line after a run with under half its notes in the band', () => {
    // Assert: 2 of 5 is under half; 3 of 5 is not
    expect(after('part', [READ(2)], 'workable').tricky).toBe(true)
    expect(after('part', [READ(3)], 'workable').tricky).toBe(false)
    expect(after('part', [READ(0)], 'effortful').tricky).toBe(false)
  })

  it('keeps the lines after Effortful and offers only Done for today, with the rest card', () => {
    // Act
    const a = after('part', [READ(5)], 'effortful')

    // Assert: FACTS 59
    expect([a.closing, a.readings, a.rest, a.doctor]).toEqual([
      'gentle',
      true,
      true,
      false,
    ])
    expect(a.offers).toEqual({
      swap: false,
      again: false,
      alongAgain: false,
      today: true,
    })
  })

  it('takes the lines away after Uncomfortable, with the doctor lines and the rest card, and offers nothing', () => {
    // Act
    const a = after('swap', [READ(5)], 'uncomfortable')

    // Assert: REQ-GVC-021, REQ-GVC-023
    expect([a.closing, a.readings, a.rest, a.doctor]).toEqual([
      'enough',
      false,
      true,
      true,
    ])
    expect(Object.values(a.offers).some(Boolean)).toBe(false)
  })

  it('offers the sing-along’s Again once a visit, the swap after its part, and no tricky line', () => {
    // Act
    const first = after('part', [], 'easy', { again: false })
    const second = after('part', [], 'easy', { again: true })
    const swap = after('swap', [], 'workable', { again: false })

    // Assert: FACTS 61
    expect(first.offers).toEqual({
      swap: true,
      again: false,
      alongAgain: true,
      today: true,
    })
    expect(second.offers.alongAgain).toBe(false)
    expect([swap.offers.swap, swap.offers.alongAgain, swap.closing]).toEqual([
      false,
      true,
      null,
    ])
    expect([first.tricky, first.readings]).toEqual([false, false])
  })
})
