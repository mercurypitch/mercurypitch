// ============================================================
// The premium exercises' half of the shell: opening one by id
// ============================================================
//
// A build with the premium exercises (every dev-target build: TestFlight,
// the probe, the tests) hands the rooms `openExercise`, which pushes the
// exercise's screen. A build without them (the store build) hands them
// nothing, so the Sing room draws no way in.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_SINGING } from '@/features/tabs/constants'
import type * as NativeBuild from '@/lib/native-build'
import { setActiveTab } from '@/stores/ui-store'
import { installPremiumExercises } from './premium-exercise-wiring'
import { pushed, pushedStack, resetRunShell } from './run-shell-store'

const build = vi.hoisted(() => ({ premium: false }))
const art = vi.hoisted(() => ({
  preloads: 0,
  ng: 0,
  lip: 0,
  long: 0,
  warm: 0,
  /** Merc's voice set, which Home note sings with. */
  voice: 0,
}))
const warmUp = vi.hoisted(() => ({ next: 'lip-roll-bay' as string | null }))
vi.mock('@/features/warm-up/path-art', () => ({
  preloadWarmUpArt: () => {
    art.warm += 1
  },
}))
vi.mock('@/features/warm-up/warm-up-store', () => ({
  nextWarmUpRoom: () => warmUp.next,
}))
vi.mock('@/features/long-note/long-note-art', () => ({
  preloadLongNoteArt: () => {
    art.long += 1
  },
}))
vi.mock('@/features/echo/echo-art', () => ({
  preloadEchoArt: () => {
    art.preloads += 1
  },
}))
vi.mock('@/features/lip-roll/bay-art', () => ({
  preloadLipArt: () => {
    art.lip += 1
  },
}))
vi.mock('@/features/ng-slides/bridge-art', () => ({
  preloadNgArt: () => {
    art.ng += 1
  },
}))
vi.mock('@/features/echo/merc-sampler', () => ({
  preloadMercVoice: () => {
    art.voice += 1
    return Promise.resolve()
  },
}))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get PREMIUM_EXERCISES() {
    return build.premium
  },
}))

beforeEach(() => {
  build.premium = false
  art.preloads = 0
  art.ng = 0
  art.lip = 0
  art.long = 0
  art.warm = 0
  art.voice = 0
  warmUp.next = 'lip-roll-bay'
  setActiveTab(TAB_SINGING)
  resetRunShell()
})

afterEach(() => {
  resetRunShell()
})

describe('the shell in a build without the premium exercises', () => {
  it('offers the rooms no way to open one', () => {
    const api = installPremiumExercises()

    expect(api).toEqual({})
  })
})

describe('the shell in a build with the premium exercises', () => {
  it('pushes Long note for its id, over whatever was on screen', () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('long-note-lantern')

    expect(pushed()).toBe('long-note')
    expect(pushedStack()).toEqual(['long-note'])
  })

  it('starts the lantern decoding on the tap that opens Long note', async () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('long-note-lantern')

    await vi.waitFor(() => {
      expect(art.long).toBe(1)
    })
    expect(art.preloads).toBe(0)
    expect(art.lip).toBe(0)
    expect(art.ng).toBe(0)
  })

  it('pushes Echo for its id, and starts its sky decoding on the same tap', async () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('echo-stars')

    expect(pushed()).toBe('echo')
    await vi.waitFor(() => {
      expect(art.preloads).toBe(1)
    })
  })

  it('pushes Ng slides for its id, and starts its river loading on the same tap', async () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('ng-slides-bridge')

    expect(pushed()).toBe('ng-slides')
    await vi.waitFor(() => {
      expect(art.ng).toBe(1)
    })
    expect(art.preloads).toBe(0)
  })

  it('pushes Lip roll for its id, and starts its bay loading on the same tap', async () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('lip-roll-bay')

    expect(pushed()).toBe('lip-roll')
    await vi.waitFor(() => {
      expect(art.lip).toBe(1)
    })
    expect(art.ng).toBe(0)
    expect(art.preloads).toBe(0)
  })

  it("pushes Home note for its id, and starts Merc's voice loading on the same tap", async () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('home-note-lighthouse')

    expect(pushed()).toBe('home-note')
    await vi.waitFor(() => {
      expect(art.voice).toBe(1)
    })
    // Its harbour is drawn: no room's plates load for it.
    expect([art.preloads, art.ng, art.lip, art.long, art.warm]).toEqual([
      0, 0, 0, 0, 0,
    ])
  })

  it("pushes First note for its id, and starts Merc's voice loading on the same tap", async () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('first-note-stage')

    expect(pushed()).toBe('first-note')
    await vi.waitFor(() => {
      expect(art.voice).toBe(1)
    })
    // Its theatre and songs ship with the app: no room's plates load for it.
    expect([art.preloads, art.ng, art.lip, art.long, art.warm]).toEqual([
      0, 0, 0, 0, 0,
    ])
  })

  it("starts no other room's art", async () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('echo-stars')
    await vi.waitFor(() => {
      expect(art.preloads).toBe(1)
    })

    expect(art.long).toBe(0)
  })

  it('pushes it once, however often it is asked', () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('long-note-lantern')
    api.openExercise?.('long-note-lantern')

    expect(pushedStack()).toEqual(['long-note'])
  })
})

describe('the Warm-up', () => {
  it("pushes its path for its id, loading the night and the first stop's room", async () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('warm-up-path')

    expect(pushed()).toBe('warm-up')
    await vi.waitFor(() => {
      expect([art.warm, art.lip]).toEqual([1, 1])
    })
    expect([art.ng, art.long, art.preloads]).toEqual([0, 0, 0])
  })

  it('loads the room the run goes on with, the same day', async () => {
    build.premium = true
    warmUp.next = 'long-note-lantern'
    const api = installPremiumExercises()

    api.openExercise?.('warm-up-path')

    await vi.waitFor(() => {
      expect([art.warm, art.long]).toEqual([1, 1])
    })
    expect(art.lip).toBe(0)
  })

  it("loads no room at the end of the day's run", async () => {
    build.premium = true
    warmUp.next = null
    const api = installPremiumExercises()

    api.openExercise?.('warm-up-path')

    await vi.dynamicImportSettled()
    expect(art.warm).toBe(1)
    expect([art.lip, art.ng, art.long, art.preloads]).toEqual([0, 0, 0, 0])
  })
})
