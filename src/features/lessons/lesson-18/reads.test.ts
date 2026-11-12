// ============================================================
// Lesson 18 reads tests — the tunes, and what each play draws beat by beat
// ============================================================
//
// The page's tunes in G in either clef, with their brackets and breath
// marks (FACTS 11 to 13, 39, 48, 50); no step plays four notes in a row of
// a sung tune (FACTS 39); the note-by-note read's names and sung notes,
// each a beat further behind (FACTS 35, 38); the cursor at tempo or by the
// beat; brackets as the cursor reaches them; Step 4's marks written as
// they sound, a sounding note's level as its light, and the breath mark
// as its silence starts (FACTS 41, 75); and every play's length (FACTS 76).

import { describe, expect, it } from 'vitest'
import type { ByNameHit } from './reads'
import { bracketsAt, breathAt, byNameBars, cursorAt, DO_LEAD, lateTag, levelAt, marksAt, marksDrawn, nameOf, noteWords, PLAY_SECONDS, shortBeats, tapTempoLine, } from './reads'
import { bracketName, breathSound, COLD, notesOf, P_LEVEL, SHORTS, SING_1, SING_2, STACCATO_SEC, TUNE_A, TUNE_B, TUNE_C, TUNE_C_BREATH, tuneLabel, tuneShape, } from './tunes'

const letters = (xs: readonly { letter: string; octave: number }[]): string[] =>
  xs.map((n) => `${n.letter}${n.octave}`)

describe('the page’s tunes', () => {
  it('writes each tune in G, do on G3 in the bass and G4 in the treble', () => {
    // Act
    const bass = letters(notesOf(COLD, 'bass'))
    const treble = letters(notesOf(SING_1, 'treble'))

    // Assert
    expect(bass).toEqual(['G3', 'A3', 'B3', 'A3', 'G3', 'B3', 'D4'])
    expect(treble).toEqual(['G4', 'A4', 'B4', 'D5', 'D5', 'B4', 'G4'])
    expect(letters(notesOf(SING_2, 'bass'))).toEqual([
      'G3',
      'G3',
      'B3',
      'B3',
      'D4',
      'G3',
    ])
  })

  it('fills two bars of 4/4 in every tune', () => {
    for (const t of [COLD, TUNE_A, TUNE_B, TUNE_C, SING_1, SING_2]) {
      // Assert
      expect(t.bars.map((b) => b.reduce((a, w) => a + w.value, 0))).toEqual([
        4, 4,
      ])
      expect(t.bars.flat()).toHaveLength(t.degrees.length)
    }
  })

  it('never plays four notes in a row of a sung tune before its take (FACTS 39)', () => {
    // Arrange: every sequence a play on the page sounds before Sing it
    const played = [
      COLD.degrees,
      TUNE_A.degrees,
      TUNE_B.degrees,
      TUNE_C.degrees,
      ...Object.values(SHORTS).map((s) => s.degrees),
    ].map((d) => d.join(''))
    const fours = (d: readonly number[]): string[] =>
      d.slice(0, -3).map((_, i) => d.slice(i, i + 4).join(''))

    // Assert
    for (const sung of [SING_1, SING_2])
      for (const four of fours(sung.degrees))
        for (const p of played) expect(p).not.toContain(four)
  })

  it('names the figures and the brackets by their notes', () => {
    // Assert
    expect(tuneLabel(COLD, 'bass')).toBe(
      'Bass staff, two bars of 4/4: G, A, B, A, then G, B and a long D',
    )
    expect(bracketName(TUNE_A, TUNE_A.brackets[0], 'bass')).toBe(
      'a run of steps: G, A, B, C',
    )
    expect(bracketName(TUNE_B, TUNE_B.brackets[0], 'treble')).toBe(
      'do-mi-so: D, B, G',
    )
    expect(noteWords(notesOf(COLD, 'bass')[2], 2, 1)).toBe(
      'B3, mi, a quarter note',
    )
    expect(tapTempoLine(60)).toBe('Your taps: 60 BPM')
  })

  it('shortens the note before a breath mark to 0.6 s, the rest as written', () => {
    // Act
    const shape = tuneShape(TUNE_C_BREATH)

    // Assert
    expect(breathSound(TUNE_C_BREATH)).toBe(3)
    expect(shape(3)).toEqual({ seconds: 0.6 })
    expect([0, 1, 2, 4, 5].map(shape)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ])
    expect(tuneShape(TUNE_C)(3)).toBeUndefined()
    expect(breathAt(TUNE_C_BREATH)).toBeCloseTo(3.6, 6)
  })
})

describe('the note-by-note read', () => {
  /** Each named or sung note's beat from bar 1's first, and the hero's do. */
  function beatsOfHits(withDo: boolean) {
    const bars = byNameBars(withDo)
    const out: { k: string; i?: number; beat: number }[] = []
    bars.forEach((bar, n) => {
      for (const h of bar.hits) {
        const d: ByNameHit = h.data
        if (d.k === 'click') continue
        out.push({
          k: d.k,
          ...('i' in d ? { i: d.i } : {}),
          beat: (n - 1) * 4 + h.beat,
        })
      }
    })
    return out
  }

  it('names note i on beat 2i and sings it on beat 2i + 1, so each is a beat further behind, and the bars end before do, mi and so', () => {
    // Act
    const hits = beatsOfHits(false)
    const sung = hits.filter((h) => h.k === 'sing')

    // Assert
    expect(hits.filter((h) => h.k === 'name').map((h) => h.beat)).toEqual([
      0, 2, 4, 6,
    ])
    expect(sung.map((h) => h.beat)).toEqual([1, 3, 5, 7])
    expect(sung.map((h) => h.beat - (h.i ?? 0))).toEqual([1, 2, 3, 4])
    expect(sung.map((h) => nameOf(h.i ?? 0))).toEqual(['do', 're', 'mi', 're'])
    expect(sung.map((h) => lateTag(h.i ?? 0))).toEqual([
      '1 beat late',
      '2 beats late',
      '3 beats late',
      '4 beats late',
    ])
  })

  it('sings do first in the hero, 1.0 s and 0.4 s of quiet before the count-in, after the press', () => {
    // Act
    const hits = beatsOfHits(true)

    // Assert
    expect(hits[0]).toEqual({ k: 'do', beat: -5.4 })
    expect(DO_LEAD).toBeGreaterThan(1.4)
    expect(PLAY_SECONDS.heroByName).toBeCloseTo(13.4, 6)
    expect(PLAY_SECONDS.byName).toBe(12)
    expect(PLAY_SECONDS.way).toBe(12)
    expect(PLAY_SECONDS.tune).toBe(8)
  })

  it('clicks on every beat of the count-in and the bars, each bar’s first higher', () => {
    // Act
    const clicks = byNameBars(false).map((bar) =>
      bar.hits.flatMap((h) => (h.data.k === 'click' ? [h.data.high] : [])),
    )

    // Assert
    expect(clicks).toEqual([
      [true, false, false, false],
      [true, false, false, false],
      [true, false, false, false],
    ])
  })
})

describe('the cursor and the brackets', () => {
  it('moves the cursor at tempo, or on each beat under reduced motion, and stops it at the final bar line', () => {
    // Assert
    expect(cursorAt(-0.5, 8, false)).toBeNull()
    expect(cursorAt(2.4, 8, false)).toBeCloseTo(2.4, 6)
    expect(cursorAt(2.4, 8, true)).toBe(2)
    expect(cursorAt(9.3, 8, false)).toBe(8)
  })

  it('fades each bracket in as the cursor reaches its pattern’s first note', () => {
    // Assert
    expect(bracketsAt(TUNE_A, 3.9).map((b) => b.label)).toEqual([
      'a run of steps',
    ])
    expect(bracketsAt(TUNE_A, 4).map((b) => b.label)).toEqual([
      'a run of steps',
      'a repeated note',
    ])
    expect(bracketsAt(TUNE_B, 3.9).map((b) => b.label)).toEqual(['do-mi-so'])
    expect(bracketsAt(TUNE_B, 4)).toHaveLength(2)
    expect(bracketsAt(COLD, 0)).toHaveLength(1)
  })
})

describe('Step 4’s marks', () => {
  it('writes p over the first note as it starts and f over the fourth a beat after the third ends', () => {
    // Act
    const early = marksAt(SHORTS.dynamics, 2).map((m) => m.kind)
    const late = marksAt(SHORTS.dynamics, 4).map((m) => m.kind)

    // Assert
    expect(shortBeats(SHORTS.dynamics)).toEqual([0, 1, 2, 4, 5, 6])
    expect(early).toEqual(['p'])
    expect(late).toEqual(['p', 'f'])
    expect(levelAt(SHORTS.dynamics, 1.5)).toBe(P_LEVEL)
    expect(levelAt(SHORTS.dynamics, 4.2)).toBe(1)
  })

  it('draws the hairpins as far as so’s glide has gone, its light following the level', () => {
    // Act
    const halfOpen = marksAt(SHORTS.hairpins, 0.5)
    const closing = marksAt(SHORTS.hairpins, 1.5)

    // Assert
    expect(halfOpen).toEqual([{ kind: 'cresc', from: 0, to: 1, drawn: 0.5 }])
    expect(closing).toEqual([
      { kind: 'cresc', from: 0, to: 1, drawn: 1 },
      { kind: 'dim', from: 1, to: 2, drawn: 0.5 },
    ])
    expect(levelAt(SHORTS.hairpins, 0.5)).toBeCloseTo(0.65, 6)
    expect(levelAt(SHORTS.hairpins, 1)).toBeCloseTo(1, 6)
    expect(levelAt(SHORTS.hairpins, 2)).toBeCloseTo(P_LEVEL, 6)
  })

  it('writes each staccato dot as its note sounds, 0.15 s of its beat, and draws the slur as its notes sound, joined', () => {
    // Act
    const dots = marksAt(SHORTS.staccato, 1.2)
    const slur = marksAt(SHORTS.slur, 1.5)

    // Assert
    expect(dots.map((m) => m.kind)).toEqual(['staccato', 'staccato'])
    expect(SHORTS.staccato.shape(0)).toEqual({ seconds: STACCATO_SEC })
    expect(slur).toEqual([{ kind: 'slur', first: 0, last: 2, drawn: 0.5 }])
    expect([0, 1, 2].map(SHORTS.slur.shape)).toEqual([
      { joined: true },
      { joined: true },
      undefined,
    ])
    expect(levelAt(SHORTS.staccato, 1)).toBeNull()
  })

  it('leaves every mark drawn whole once its example has been heard', () => {
    // Assert
    expect(
      marksDrawn(SHORTS.hairpins).map((m) =>
        m.kind === 'cresc' || m.kind === 'dim' ? m.drawn : null,
      ),
    ).toEqual([1, 1])
    expect(marksDrawn(SHORTS.staccato)).toHaveLength(3)
  })
})
