// Can the panel put the game somewhere it should not be?
// ============================================================
//
// The dials write into the live config object, which is the whole point
// and also the whole risk: there is no validation layer between a range
// input and the simulation. These are the guards.

import { beforeEach, describe, expect, it } from 'vitest'
import type { World3DConfig } from '../world3d-config'
import { CHAMBER_CONFIG, WORLD3D_CONFIG } from '../world3d-config'
import { asOverride, DIALS, forget, GROUP_ORDER, load, readDial, restore, save, snapshot, writeDial, } from './dials'

/** jsdom here supplies a `localStorage` with none of Storage's methods,
 * which is the idiom the rest of this app's tests already work around
 * (see mock-purchases.test.ts). A Map is enough for what this module
 * asks of it. */
const useMapStorage = (): Map<string, string> => {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  })
  return store
}

const fresh = (): World3DConfig => snapshot(CHAMBER_CONFIG)

describe('the dial table', () => {
  it('names a real number in a real branch, every time', () => {
    for (const dial of DIALS) {
      const branch = WORLD3D_CONFIG[dial.group] as unknown as Record<
        string,
        unknown
      >
      expect(
        typeof branch[dial.key],
        `${dial.group}.${dial.key} is not a number in the config`,
      ).toBe('number')
    }
  })

  it('has no duplicate rows', () => {
    const seen = DIALS.map((d) => `${d.group}.${d.key}`)
    expect(new Set(seen).size).toBe(seen.length)
  })

  // A range whose default sits outside it is a slider that jumps the
  // moment it is touched -- the game changes without anyone asking.
  it.each(DIALS.map((d) => [`${d.group}.${d.key}`, d] as const))(
    "%s: contains both worlds' shipped value",
    (_id, dial) => {
      for (const config of [WORLD3D_CONFIG, CHAMBER_CONFIG]) {
        const value = readDial(config, dial)
        expect(value).toBeGreaterThanOrEqual(dial.min)
        expect(value).toBeLessThanOrEqual(dial.max)
      }
    },
  )

  it('explains every dial in words a player would recognise', () => {
    for (const dial of DIALS) {
      expect(dial.label.length).toBeGreaterThan(2)
      expect(dial.does.length).toBeGreaterThan(20)
      expect(dial.does.endsWith('.')).toBe(true)
    }
  })

  it('lists every group, in a fixed order', () => {
    expect(new Set(DIALS.map((d) => d.group))).toEqual(new Set(GROUP_ORDER))
  })
})

describe('writing a dial', () => {
  it('clamps to the dial rather than trusting the caller', () => {
    const config = fresh()
    const dial = DIALS.find((d) => d.key === 'jumpHeight')!
    expect(writeDial(config, dial, 999)).toBe(dial.max)
    expect(readDial(config, dial)).toBe(dial.max)
    expect(writeDial(config, dial, -5)).toBe(dial.min)
    expect(readDial(config, dial)).toBe(dial.min)
  })

  it('writes in place, so a live reader sees it', () => {
    const config = fresh()
    const branch = config.locomotion
    const dial = DIALS.find((d) => d.key === 'walkSpeed')!
    writeDial(config, dial, 2)
    // The same object the stage is holding, not a copy handed back.
    expect(branch.walkSpeed).toBe(2)
  })
})

describe('what comes back out', () => {
  it('emits only what was moved', () => {
    const config = fresh()
    const baseline = snapshot(config)
    writeDial(config, DIALS.find((d) => d.key === 'jumpHeight')!, 0.8)
    writeDial(
      config,
      DIALS.find((d) => d.key === 'gravity' && d.group === 'shatter')!,
      6,
    )
    expect(asOverride(config, baseline)).toEqual({
      locomotion: { jumpHeight: 0.8 },
      shatter: { gravity: 6 },
    })
  })

  it('emits nothing when nothing moved', () => {
    const config = fresh()
    expect(asOverride(config, snapshot(config))).toEqual({})
  })

  // A range input hands back "0.7000000000000001" often enough that
  // comparing by equality would report a dial as changed that is not.
  it('does not report floating-point noise as a change', () => {
    const config = fresh()
    const baseline = snapshot(config)
    const dial = DIALS.find((d) => d.key === 'holdCap')!
    writeDial(config, dial, readDial(baseline, dial) + 1e-12)
    expect(asOverride(config, baseline)).toEqual({})
  })
})

describe('restoring', () => {
  it('puts every branch back, in place', () => {
    const config = fresh()
    const baseline = snapshot(config)
    const branch = config.ring
    writeDial(config, DIALS.find((d) => d.key === 'tolSemis')!, 2.5)
    restore(config, baseline)
    expect(branch.tolSemis).toBe(baseline.ring.tolSemis)
    expect(asOverride(config, baseline)).toEqual({})
  })
})

describe('remembering across a reload', () => {
  beforeEach(() => {
    useMapStorage()
  })

  it('brings the dragging back', () => {
    const config = fresh()
    const baseline = snapshot(config)
    writeDial(config, DIALS.find((d) => d.key === 'jumpHeight')!, 0.9)
    save(asOverride(config, baseline))

    const next = fresh()
    load(next)
    expect(next.locomotion.jumpHeight).toBe(0.9)
  })

  // The stored file outlives the dial table. A value for a dial that has
  // since narrowed its range, or gone entirely, must not be able to put
  // the game somewhere the panel could not have.
  it('clamps a stored value that no longer fits its dial', () => {
    window.localStorage.setItem(
      'beside-cue:games:dev-dials',
      JSON.stringify({ locomotion: { jumpHeight: 40 } }),
    )
    const config = fresh()
    load(config)
    const dial = DIALS.find((d) => d.key === 'jumpHeight')!
    expect(config.locomotion.jumpHeight).toBe(dial.max)
  })

  it('ignores a key that is not a dial any more', () => {
    window.localStorage.setItem(
      'beside-cue:games:dev-dials',
      JSON.stringify({ locomotion: { swimSpeed: 3 }, nonsense: { x: 1 } }),
    )
    const config = fresh()
    const baseline = snapshot(config)
    load(config)
    expect(asOverride(config, baseline)).toEqual({})
    expect(
      (config.locomotion as unknown as Record<string, unknown>).swimSpeed,
    ).toBeUndefined()
  })

  it.each([['not json at all'], ['null'], ['[]'], ['{"ring":7}']])(
    'survives %s in storage',
    (raw) => {
      window.localStorage.setItem('beside-cue:games:dev-dials', raw)
      const config = fresh()
      const baseline = snapshot(config)
      expect(() => load(config)).not.toThrow()
      expect(asOverride(config, baseline)).toEqual({})
    },
  )

  it('forgets on request', () => {
    save({ locomotion: { jumpHeight: 0.9 } })
    forget()
    const config = fresh()
    const baseline = snapshot(config)
    load(config)
    expect(asOverride(config, baseline)).toEqual({})
  })

  it('does not throw when storage is denied', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      },
    })
    const config = fresh()
    expect(() => load(config)).not.toThrow()
    expect(() => save({ ring: { tolSemis: 1 } })).not.toThrow()
    expect(() => forget()).not.toThrow()
  })
})
