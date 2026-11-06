// ============================================================
// Lesson 19 rhythm views tests — what each step's bar writes and plays
// ============================================================
//
// Each step's state, pure (WEB-SPEC, Toys 1, 5 and 6): Step 1's six eighths
// as a bar of 6/8 or 3/4 over six pads under arcs, on Subdivide's drums or
// the page's own bar in twos (FACTS 18); the two tunes, their notes and
// counts as FACTS 30 gives them, on one system or two, on either clef;
// Step 3's beat split in two or three, and Step 4's note on 3 or on "2 and"
// (FACTS 41, 43); and what a switch keeps written.

import { describe, expect, it } from 'vitest'
import { placeRow } from '@/features/lessons/kit/rhythm-layout'
import { countsOf, metreText, placeBars, soundsOf, } from '@/features/lessons/kit/rhythm-model'
import type { MetreKey } from './rhythm-views'
import { DRUMS, FIG, keptWritten, lineView, METRES, SECOND_SIX_EIGHT, SIX_BPM, sixPart, sixView, STATE_OF, syncBar, tripletBar, tuneNotes, tuneParts, TUNES, tuneView, } from './rhythm-views'

const hits = (drums: readonly { voice: string; level: number }[]) =>
  drums.map((d) => `${d.voice} ${d.level}`)

/** A bar's counts, said or held, joined. */
const counts = (view: ReturnType<typeof lineView>): string => {
  const row = view.scene.rows[0]
  return countsOf(placeRow(row), row.metre)
    .map((c) => c.text)
    .join(' ')
}

describe("each step's bar", () => {
  it('gives each of the four steps its state and its caption (Toys 6)', () => {
    // Assert
    expect(STATE_OF).toEqual({
      1: 'metre',
      2: 'tunes',
      3: 'triplet',
      4: 'sync',
    })
    expect(Object.values(FIG).map((f) => f.replace(/<[^>]+>/g, ''))).toEqual([
      'Fig. 1 The same six eighths, written as 6/8 or 3/4',
      'Fig. 2 A tune in 6/8 and a tune in 3/4, on your staff',
      'Fig. 3 Beat 3 split in two, or in three',
      'Fig. 4 The note on 3, or moved to “2 and”',
    ])
  })

  it("writes Step 1's six eighths as a bar of 6/8 or 3/4 over six pads under arcs, with no strip, named for its groups", () => {
    // Act
    const six = sixView('6-8')
    const three = sixView('3-4')

    // Assert
    expect(six.scene).toMatchObject({
      staff: 'line',
      padEvery: 0.5,
      arcs: true,
      strip: false,
    })
    expect(six.scene.rows[0].bars).toEqual([three.scene.rows[0].bars[0]])
    expect(
      six.scene.rows.map((r) => metreText(r.metre ?? METRES['3-4'])),
    ).toEqual(['6/8'])
    expect(six.label).toBe(
      'One bar of 6/8: six eighth notes, in two groups of three, on one line',
    )
    expect(three.label).toBe(
      'One bar of 3/4: six eighth notes, in three groups of two, on one line',
    )
    expect(six.pads).toBeNull()
  })

  it("plays Step 1's bar on its drums with no click, an eighth a third of a second: in threes Subdivide's first 6/8, in twos the page's own (FACTS 18, 65)", () => {
    // Act
    const part = sixPart(sixView('6-8'), '6-8')

    // Assert
    expect([part.click, part.bpm()]).toEqual([false, SIX_BPM])
    expect((0.5 * 60) / SIX_BPM).toBeCloseTo(1 / 3, 9)
    expect(hits(DRUMS['6-8'])).toEqual([
      'kick 1',
      'hh-closed 0.7',
      'hh-closed 0.7',
      'snare 0.7',
      'hh-closed 0.7',
      'hh-closed 0.7',
    ])
    expect(hits(DRUMS['3-4'])).toEqual([
      'kick 1',
      'hh-closed 0.7',
      'snare 0.7',
      'hh-closed 0.7',
      'snare 0.7',
      'hh-closed 0.7',
    ])
    expect(hits(SECOND_SIX_EIGHT)).toEqual([
      'kick 1',
      'hh-closed 0.7',
      'sidestick 0.7',
      'kick 0.7',
      'hh-closed 0.7',
      'sidestick 0.7',
    ])
  })

  it.each([
    ['6-8', 15, ['1 and a 2', '1 and a 2', '1 and a 2 and a', '1 (2)']],
    ['3-4', 12, ['1 2 3', '1 (2) 3', '1 and 2 and 3 and', '1 (2) (3)']],
  ] as const)(
    'writes the %s tune as FACTS 30 gives it: %i notes, counted bar by bar, 8 s',
    (key, notes, bars) => {
      // Arrange
      const tune = TUNES[key as MetreKey]
      const metre = METRES[key as MetreKey]

      // Act
      const placed = placeBars(tune.bars, 3)
      const byBar = tune.bars.map((b) =>
        countsOf(placeBars([b], 3), metre)
          .map((c) => c.text)
          .join(' '),
      )

      // Assert: four bars of three quarters at 90, 8 s
      expect(soundsOf(placed)).toHaveLength(notes)
      expect(tune.letters).toHaveLength(notes)
      expect(byBar).toEqual(bars)
      expect((4 * 3 * 60) / SIX_BPM).toBe(8)
    },
  )

  it('sings the tunes in C, from C3 on the bass staff and C4 on the treble (FACTS 61)', () => {
    // Act
    const name = (key: MetreKey, clef: 'bass' | 'treble') =>
      tuneNotes(key, clef)
        .map((n) => `${n.letter}${n.octave}`)
        .join(' ')

    // Assert
    expect(name('6-8', 'bass')).toBe(
      'C3 D3 E3 G3 E3 D3 C3 D3 C3 D3 E3 E3 D3 C3 C3',
    )
    expect(name('3-4', 'treble')).toBe('C4 D4 E4 G4 E4 C4 D4 E4 E4 D4 C4 C4')
  })

  it('lays a tune on one system of four bars, or on two of two, the second carrying on, each with its own notes, its beats lit under it (Toys 5)', () => {
    // Act
    const one = tuneView('6-8', 'bass', 1)
    const two = tuneView('6-8', 'bass', 2)
    const twoThree = tuneView('3-4', 'treble', 2)

    // Assert
    expect(one.scene.rows).toHaveLength(1)
    expect(one.scene).toMatchObject({
      staff: 'bass',
      padEvery: 1.5,
      strip: false,
      metreFirst: true,
    })
    expect(
      two.scene.rows.map((r) => [
        r.bars.length,
        r.notes?.length,
        r.continues === true,
      ]),
    ).toEqual([
      [2, 8, false],
      [2, 7, true],
    ])
    expect(twoThree.scene.padEvery).toBe(1)
    expect(twoThree.scene.rows.map((r) => r.notes?.length)).toEqual([5, 7])
    expect(one.label).toBe(
      'Four bars of 6/8: three eighth notes and a dotted quarter note, then three eighth notes and a dotted quarter note, then six eighth notes, then a dotted half note, on the bass staff',
    )
    expect(one.laneLabel).toMatch(/^Four bars of 6\/8: .*, on the pitch line$/)
    expect(tuneParts(two).map((p) => [p.row, p.click, p.bpm()])).toEqual([
      [0, false, SIX_BPM],
      [1, false, SIX_BPM],
    ])
  })

  it('splits beat 3 of Step 3\'s bar in two or in three, counted "1 2 and 3 and 4" or "1 2 and 3 trip let 4" (FACTS 40, 41)', () => {
    // Act
    const two = lineView(tripletBar('eighths'))
    const three = lineView(tripletBar('triplet'))

    // Assert
    expect(counts(two)).toBe('1 2 and 3 and 4')
    expect(counts(three)).toBe('1 2 and 3 trip let 4')
    expect(three.label).toBe(
      'One bar of 4/4: a quarter note, two eighth notes, three triplet eighth notes and a quarter note, on one line',
    )
    expect(three.scene).toMatchObject({ staff: 'line', strip: false })
  })

  it('moves Step 4\'s third note from 3 to "2 and", an eighth tied to a quarter, counted "1 2 and (3) 4" (FACTS 43, 45)', () => {
    // Act
    const on3 = lineView(syncBar('on-3'))
    const moved = lineView(syncBar('on-2-and'))

    // Assert
    expect(counts(on3)).toBe('1 2 3 4')
    expect(counts(moved)).toBe('1 2 and (3) 4')
    expect(moved.label).toBe(
      'One bar of 4/4: a quarter note, two eighth notes and two quarter notes, with a tie, on one line',
    )
  })
})

describe('what a switch keeps written', () => {
  const placed = (view: ReturnType<typeof lineView>) =>
    placeRow(view.scene.rows[0])

  it('keeps the six eighths written as 6/8 regroups to 3/4, the same six notes', () => {
    // Act
    const kept = keptWritten(
      placed(sixView('6-8')),
      [true, true, true, true, true, true],
      placed(sixView('3-4')),
    )

    // Assert
    expect(kept).toEqual([true, true, true, true, true, true])
  })

  it('keeps beats 1, 2 and 4 as beat 3 splits in three, and leaves the triplet to be written as it sounds', () => {
    // Act
    const kept = keptWritten(
      placed(lineView(tripletBar('eighths'))),
      [true, true, true, true, true, true],
      placed(lineView(tripletBar('triplet'))),
    )

    // Assert
    expect(kept).toEqual([true, true, true, false, false, false, true])
  })

  it('keeps a tied-to note unwritten until the note that ties into it is heard, and nothing that was not heard', () => {
    // Act: four quarters heard, then the note moved to "2 and"
    const kept = keptWritten(
      placed(lineView(syncBar('on-3'))),
      [true, true, true, true],
      placed(lineView(syncBar('on-2-and'))),
    )
    const unheard = keptWritten(
      placed(lineView(syncBar('on-3'))),
      [true, false, false, false],
      placed(lineView(syncBar('on-2-and'))),
    )

    // Assert: the quarter on 3 is drawn the same, but waits for its tie
    expect(kept).toEqual([true, false, false, false, true])
    expect(unheard).toEqual([true, false, false, false, false])
  })
})
