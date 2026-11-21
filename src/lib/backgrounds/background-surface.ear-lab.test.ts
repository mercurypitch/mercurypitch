// ============================================================
// The app's own Ear Lab room (background-surface.ts), with Merc and
// without.
//
// With Merc (EAR_LAB_WITH_MERC: the web, and a phone test build) the Ear
// Lab is his bench, the one Regulator Room, and has no picker (#1460). A
// room stored before, or by the store app, whose Ear Lab has its picker,
// is not drawn there, so it cannot show through round his screens, and it
// stays stored as it was. Without Merc the Ear Lab starts on it, as it did.
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'
import { BACKGROUND_SELECTION_KEYS } from './background-selection'

const world = vi.hoisted(() => ({ merc: true }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get EAR_LAB_WITH_MERC() {
    return world.merc
  },
}))

/** A surface's controller as the app makes it on load, over what this browser stored. */
async function appController(
  surface: 'ear' | 'drum',
  stored: string,
  merc: boolean,
) {
  world.merc = merc
  localStorage.setItem(BACKGROUND_SELECTION_KEYS[surface], stored)
  vi.resetModules()
  const { backgroundSurfaceController } = await import('./background-surface')
  return backgroundSurfaceController(surface)
}

afterEach(() => localStorage.clear())

describe("the Ear Lab's room with Merc", () => {
  it.each([
    ['the free Glasshouse Bench', 'ear-glasshouse-bench'],
    ['a supporter room', 'ear-bell-loft'],
  ])(
    'draws the Regulator Room over %s stored before, and leaves that stored',
    async (_room, stored) => {
      const ear = await appController('ear', stored, true)

      expect(ear.requestedId()).toBe('ear-regulator-room')
      expect(ear.resolved().id).toBe('ear-regulator-room')
      expect(ear.resolvedStyle()['--mp-stage-image']).toContain(
        '/ear-lab/regulator-room-',
      )
      // Nor does it write: the store app's choice outlives a visit here.
      ear.select('ear-regulator-room')
      expect(localStorage.getItem(BACKGROUND_SELECTION_KEYS.ear)).toBe(stored)
    },
  )

  it("leaves every other surface's stored room to it", async () => {
    const drum = await appController('drum', 'drum-daylight-riser', true)

    expect(drum.requestedId()).toBe('drum-daylight-riser')
  })
})

describe("the Ear Lab's room without Merc, in the store app", () => {
  it('starts on the room its picker stored', async () => {
    const ear = await appController('ear', 'ear-glasshouse-bench', false)

    expect(ear.requestedId()).toBe('ear-glasshouse-bench')
    expect(ear.resolved().id).toBe('ear-glasshouse-bench')
  })
})
