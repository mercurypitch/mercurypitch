// ── Jam room mode tests ───────────────────────────────────────────────
// Roles are never sent over the wire — every peer derives them from the
// sorted peer list. That only works if the derivation is identical
// everywhere and stable under reordering, so that is what these pin,
// alongside the musical claim: harmony stays in key.

import { describe, expect, it } from 'vitest'
import { diatonicStepUp, jamModeInfo, roleCountFor, roleIndexOf, roleNameFor, targetForRole, } from '@/lib/jam/jam-modes'
import type { MelodyData, MelodyItem, NoteName } from '@/types'

function item(midi: number, startBeat: number): MelodyItem {
  return {
    id: startBeat + 1,
    note: {
      midi,
      name: 'C' as NoteName,
      octave: Math.floor(midi / 12) - 1,
      freq: 440 * 2 ** ((midi - 69) / 12),
    },
    duration: 1,
    startBeat,
  }
}

/** A C-major scale, C4 up to C5, one beat each. */
function cMajor(): MelodyData {
  return {
    id: 'm',
    name: 'Scale',
    bpm: 100,
    key: 'C',
    scaleType: 'major',
    createdAt: 0,
    updatedAt: 0,
    items: [60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => item(m, i)),
  }
}

const midis = (m: MelodyData | null) => (m?.items ?? []).map((i) => i.note.midi)

describe('role assignment', () => {
  const ids = ['zeta', 'alpha', 'mike']

  it('gives every peer the same answer regardless of list order', () => {
    // Each peer builds the list from its own view of the room, so the
    // order it happens to be in must not matter.
    const shuffled = ['mike', 'zeta', 'alpha']
    for (const id of ids) {
      expect(roleIndexOf(id, ids)).toBe(roleIndexOf(id, shuffled))
    }
  })

  it('assigns distinct consecutive roles', () => {
    const assigned = ids.map((id) => roleIndexOf(id, ids)).sort()
    expect(assigned).toEqual([0, 1, 2])
  })

  it('puts a peer not yet in the room on the first part', () => {
    // Singing the melody as written is the right thing to do while the
    // room is still assembling.
    expect(roleIndexOf('newcomer', ids)).toBe(0)
    expect(roleIndexOf(null, ids)).toBe(0)
  })

  it('collapses to unison until the mode has enough singers', () => {
    expect(roleCountFor('harmony', 1)).toBe(1)
    expect(roleCountFor('harmony', 2)).toBe(2)
    expect(roleCountFor('unison', 5)).toBe(1)
  })

  it('caps parts at the named roles a mode has', () => {
    // Harmony names three chord tones; a twelve-person room cycles them
    // rather than inventing a twelfth.
    expect(roleCountFor('harmony', 12)).toBe(3)
  })

  it('names the part, and says "Everyone" when there is only one', () => {
    expect(roleNameFor('harmony', 1, 3)).toBe('Third')
    expect(roleNameFor('harmony', 0, 1)).toBe('Everyone')
  })
})

describe('harmony stack', () => {
  it('stacks root, third and fifth on the tonic', () => {
    const m = cMajor()
    expect(midis(targetForRole(m, 'harmony', 0, 3))[0]).toBe(60) // C
    expect(midis(targetForRole(m, 'harmony', 1, 3))[0]).toBe(64) // E
    expect(midis(targetForRole(m, 'harmony', 2, 3))[0]).toBe(67) // G
  })

  it('stays in key instead of harmonising by fixed semitones', () => {
    // On the second degree a fixed +4/+7 would give D-F#-A and leave C
    // major. Diatonic gives D-F-A, the chord that belongs there.
    const m = cMajor()
    expect(midis(targetForRole(m, 'harmony', 1, 3))[1]).toBe(65) // F, not F#
    expect(midis(targetForRole(m, 'harmony', 2, 3))[1]).toBe(69) // A
  })

  it('keeps every singer on the same rhythm', () => {
    const m = cMajor()
    const third = targetForRole(m, 'harmony', 1, 3)!
    expect(third.items.map((i) => i.startBeat)).toEqual(
      m.items.map((i) => i.startBeat),
    )
    expect(third.items).toHaveLength(m.items.length)
  })

  it('rewrites octave and frequency to match the moved note', () => {
    const fifth = targetForRole(cMajor(), 'harmony', 2, 3)!
    const first = fifth.items[0]!
    expect(first.note.midi).toBe(67)
    expect(first.note.octave).toBe(4)
    expect(first.note.freq).toBeCloseTo(392, 0)
  })

  it('falls back to a plain third and fifth on a chromatic note', () => {
    // C# is not in C major, so there are no diatonic neighbours to walk.
    expect(diatonicStepUp(61, 'C', 'major', 2)).toBe(65)
    expect(diatonicStepUp(61, 'C', 'major', 4)).toBe(68)
  })
})

describe('relay', () => {
  it('gives each singer their own phrase, and nobody the same note', () => {
    const m = cMajor() // 8 notes
    const first = midis(targetForRole(m, 'relay', 0, 2))
    const second = midis(targetForRole(m, 'relay', 1, 2))
    expect(first).toEqual([60, 62, 64, 65])
    expect(second).toEqual([67, 69, 71, 72])
    expect(first.filter((n) => second.includes(n))).toEqual([])
  })

  it('covers the whole melody between the singers', () => {
    const m = cMajor()
    const all = [0, 1, 2].flatMap((r) => midis(targetForRole(m, 'relay', r, 3)))
    expect([...all].sort((a, b) => a - b)).toEqual(midis(m))
  })

  it('never hands a singer an empty part', () => {
    // Six singers on an eight-note melody used to fill only four phrases,
    // leaving two people staring at a blank canvas scoring zero.
    const m = cMajor() // 8 notes
    for (let role = 0; role < 6; role++) {
      expect(midis(targetForRole(m, 'relay', role, 6)).length).toBeGreaterThan(
        0,
      )
    }
  })

  it('still covers every note when singers outnumber phrases', () => {
    const m = cMajor()
    const all = new Set(
      [0, 1, 2, 3, 4, 5].flatMap((r) => midis(targetForRole(m, 'relay', r, 6))),
    )
    expect([...all].sort((a, b) => a - b)).toEqual(midis(m))
  })

  it('drops the phrases that are not mine rather than silencing them', () => {
    // Scoring counts an unsung target note as zero, so leaving someone
    // else's phrase in my target would score me on their turn.
    const mine = targetForRole(cMajor(), 'relay', 1, 2)!
    expect(mine.items).toHaveLength(4)
  })
})

describe('unison and degenerate rooms', () => {
  it('hands back the melody untouched', () => {
    const m = cMajor()
    expect(targetForRole(m, 'unison', 0, 1)).toBe(m)
  })

  it('hands back the melody untouched when alone in any mode', () => {
    const m = cMajor()
    expect(targetForRole(m, 'harmony', 0, 1)).toBe(m)
    expect(targetForRole(m, 'relay', 0, 1)).toBe(m)
  })

  it('survives having no melody at all', () => {
    expect(targetForRole(null, 'harmony', 1, 3)).toBeNull()
  })

  it('describes every mode it offers', () => {
    for (const id of ['unison', 'harmony', 'relay'] as const) {
      expect(jamModeInfo(id).blurb.length).toBeGreaterThan(0)
    }
  })
})
