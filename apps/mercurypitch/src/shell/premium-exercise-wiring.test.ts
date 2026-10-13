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
const art = vi.hoisted(() => ({ preloads: 0 }))
vi.mock('@/features/echo/echo-art', () => ({
  preloadEchoArt: () => {
    art.preloads += 1
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

  it('pushes Echo for its id, and starts its sky decoding on the same tap', async () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('echo-stars')

    expect(pushed()).toBe('echo')
    await vi.waitFor(() => {
      expect(art.preloads).toBe(1)
    })
  })

  it('starts no art for a room that has none to preload', async () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('long-note-lantern')
    await Promise.resolve()

    expect(art.preloads).toBe(0)
  })

  it('pushes it once, however often it is asked', () => {
    build.premium = true
    const api = installPremiumExercises()

    api.openExercise?.('long-note-lantern')
    api.openExercise?.('long-note-lantern')

    expect(pushedStack()).toEqual(['long-note'])
  })
})
