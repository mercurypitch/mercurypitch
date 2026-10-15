// ============================================================
// Lip roll, as the Sing screen's way in describes it
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
  /** This device has seen the demo. */
  seen?: boolean
  /** Lip roll's bests per level: the waves lit, per cent. */
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
      'pitchperfect_lip_roll_note',
      JSON.stringify(seed.note),
    )
  }
  if (seed.seen !== undefined) {
    localStorage.setItem('mp_lip_demo_seen', JSON.stringify(seed.seen))
  }
  if (seed.bests !== undefined) {
    const table = Object.fromEntries(
      Object.entries(seed.bests).map(([level, lit]) => [
        level,
        { lit, arches: 3, jumps: 0, at: 1 },
      ]),
    )
    localStorage.setItem('pitchperfect_lip_roll_bests', JSON.stringify(table))
  }
  if (seed.level !== undefined) {
    const { setExerciseLevel } = await import('@/stores/exercise-level')
    setExerciseLevel(seed.level)
  }
  const { lipEntry } = await import('./lip-entry')
  return lipEntry()
}

describe("Lip roll's way in", () => {
  it("names no note before there is one: the singer's own easy note fits the first run", async () => {
    const lip = await entry()

    expect(lip.note()).toBeNull()
  })

  it('names the first root: four semitones under the easy note kept', async () => {
    // E4 kept: the first wave starts on C4.
    const lip = await entry({ note: 64 })

    expect(lip.note()).toBe('C4')
  })

  it('gives the best at the level the singer is at, and none at another', async () => {
    const singer = await entry({ bests: { singer: 88 } })
    expect(singer.progress()).toBe('Best 88% lit')

    const pro = await entry({ bests: { singer: 88 }, level: 'professional' })
    expect(pro.progress()).toBeNull()
  })

  it('plays the demo by itself on a first visit: unseen, and no run kept', async () => {
    const lip = await entry()

    expect(lip.demoAutoPlays()).toBe(true)
  })

  it('plays no demo by itself once it is seen, a note is kept or a best is', async () => {
    const seen = await entry({ seen: true })
    expect(seen.demoAutoPlays()).toBe(false)

    const noted = await entry({ note: 64 })
    expect(noted.demoAutoPlays()).toBe(false)

    // A best at any level, not only the one the singer is at now.
    const best = await entry({ bests: { professional: 40 } })
    expect(best.demoAutoPlays()).toBe(false)
  })
})
