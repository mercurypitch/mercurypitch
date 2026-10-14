// ============================================================
// Ng slides, as the Sing screen's way in describes it
// ============================================================
//
// The note and the best come from the stores the room reads, so the card
// and the room cannot disagree. Every case seeds storage and loads the
// entry fresh: the stores read their storage once.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseLevel } from '@/stores/exercise-level'

interface Seed {
  /** The easy note the singer settled on last, MIDI. */
  note?: number
  /** Ng slides' bests per level: the bridge lit, per cent. */
  bests?: Partial<Record<ExerciseLevel, number>>
  level?: ExerciseLevel
}

const voiceprints = vi.hoisted(() => ({ list: [] as unknown[] }))
vi.mock('@/db/services/voiceprint-service', () => ({
  loadLocalVoiceprints: () => voiceprints.list,
}))

beforeEach(() => {
  localStorage.clear()
  voiceprints.list = []
  vi.resetModules()
})

async function entry(seed: Seed = {}) {
  if (seed.note !== undefined) {
    localStorage.setItem(
      'pitchperfect_ng_slides_note',
      JSON.stringify(seed.note),
    )
  }
  if (seed.bests !== undefined) {
    const table = Object.fromEntries(
      Object.entries(seed.bests).map(([level, lit]) => [
        level,
        { lit, arches: 4, jumps: 0, at: 1 },
      ]),
    )
    localStorage.setItem('pitchperfect_ng_slides_bests', JSON.stringify(table))
  }
  if (seed.level !== undefined) {
    const { setExerciseLevel } = await import('@/stores/exercise-level')
    setExerciseLevel(seed.level)
  }
  const { ngEntry } = await import('./ng-entry')
  return ngEntry()
}

describe("Ng slides' way in", () => {
  it("names no note before there is one: the singer's own easy note fits the first run", async () => {
    const ng = await entry()

    expect(ng.note()).toBeNull()
  })

  it('names the first root: four semitones under the easy note kept', async () => {
    // E4 kept: the first slide starts on C4.
    const ng = await entry({ note: 64 })

    expect(ng.note()).toBe('C4')
  })

  it('gives the best at the level the singer is at, and none at another', async () => {
    const singer = await entry({ bests: { singer: 94 } })
    expect(singer.progress()).toBe('Best 94% lit')

    const pro = await entry({ bests: { singer: 94 }, level: 'professional' })
    expect(pro.progress()).toBeNull()
  })

  it('plays no demo by itself: there is none yet', async () => {
    const ng = await entry()

    expect(ng.demoAutoPlays()).toBe(false)
  })
})
