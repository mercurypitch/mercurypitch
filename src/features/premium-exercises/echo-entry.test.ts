// ============================================================
// Echo, as the Sing screen's way in describes it
// ============================================================
//
// The note, the best and the demo flag come from the stores the room
// reads, so the card and the room cannot disagree. Every case seeds
// storage and loads the entry fresh: the stores read their storage once.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseLevel } from '@/stores/exercise-level'

interface Seed {
  /** The root the last run started on, MIDI. */
  root?: number
  /** Echo's bests per level: notes landed of notes asked. */
  bests?: Partial<Record<ExerciseLevel, readonly [number, number]>>
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
  if (seed.root !== undefined) {
    localStorage.setItem(
      'pitchperfect_echo_stars_root',
      JSON.stringify(seed.root),
    )
  }
  if (seed.bests !== undefined) {
    const table = Object.fromEntries(
      Object.entries(seed.bests).map(([level, [landed, notes]]) => [
        level,
        { landed, notes, accuracy: 80, at: 1 },
      ]),
    )
    localStorage.setItem('pitchperfect_echo_stars_bests', JSON.stringify(table))
  }
  if (seed.level !== undefined) {
    const { setExerciseLevel } = await import('@/stores/exercise-level')
    setExerciseLevel(seed.level)
  }
  const { echoEntry } = await import('./echo-entry')
  return echoEntry()
}

describe("Echo's way in", () => {
  it("names no note before there is a root: the singer's own note starts the first run", async () => {
    const echo = await entry()

    expect(echo.note()).toBeNull()
  })

  it('names the root the last run started on', async () => {
    const echo = await entry({ root: 60 })

    expect(echo.note()).toBe('C4')
  })

  it('gives the best at the level the singer is at, and none at another', async () => {
    const singer = await entry({ bests: { singer: [18, 20] } })
    expect(singer.progress()).toBe('Best 18 of 20')

    const pro = await entry({
      bests: { singer: [18, 20] },
      level: 'professional',
    })
    expect(pro.progress()).toBeNull()
  })

  it('plays its demo by itself on a first visit', async () => {
    const echo = await entry()

    expect(echo.demoAutoPlays()).toBe(true)
  })

  it('plays no demo by itself once it has been seen', async () => {
    localStorage.setItem('mp_echo_demo_seen', 'true')
    const echo = await entry()

    expect(echo.demoAutoPlays()).toBe(false)
  })

  it('plays no demo by itself once a run is kept or a root is held', async () => {
    const sung = await entry({ bests: { professional: [20, 25] } })
    expect(sung.demoAutoPlays()).toBe(false)

    vi.resetModules()
    localStorage.clear()
    const rooted = await entry({ root: 57 })
    expect(rooted.demoAutoPlays()).toBe(false)
  })
})
