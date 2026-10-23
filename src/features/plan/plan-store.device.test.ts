// ============================================================
// Plan store — the stops opened and the layer
// ============================================================
//
// What the store keeps apart from the record. The stops the person opened
// are remembered once each, on this device, under an `mp.` key the settings
// sync does not read, and a stored value that is not a list of names is read
// as no stops. The layer's mode is a signal that is not stored at all, so a
// reload opens nothing. The record is in plan-store.test.ts and
// plan-store.guards.test.ts.
//
// Each case builds a fresh store, because the store reads storage once, as
// the module loads.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAN_OPENED_KEY } from './plan-keys'
import type * as PlanStore from './plan-store'

async function freshStore(): Promise<typeof PlanStore> {
  vi.resetModules()
  return import('./plan-store')
}

beforeEach(() => {
  localStorage.clear()
})

describe('the stops opened', () => {
  it('remembers which stops were opened', async () => {
    const store = await freshStore()
    expect(store.stopOpened('lesson1')).toBe(false)

    store.markStopOpened('lesson1')

    expect(store.stopOpened('lesson1')).toBe(true)
    expect(store.stopOpened('lesson2')).toBe(false)
    expect((await freshStore()).stopOpened('lesson1')).toBe(true)
  })

  it('keeps them on this device, under a key the settings sync does not read', async () => {
    const store = await freshStore()

    store.markStopOpened('jam')

    expect(PLAN_OPENED_KEY.startsWith('mp.')).toBe(true)
    expect(JSON.parse(localStorage.getItem(PLAN_OPENED_KEY) ?? '[]')).toEqual([
      'jam',
    ])
    // Storage is walked whole, by length and key(): the device key is the
    // only one written, so no synced `pitchperfect_` key holds the stops.
    const keys = Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.key(i),
    )
    expect(keys).toEqual([PLAN_OPENED_KEY])
  })

  it('counts a stop once, however often it is opened', async () => {
    const store = await freshStore()

    store.markStopOpened('hearYourself')
    store.markStopOpened('hearYourself')
    store.markStopOpened('lesson2')

    expect(JSON.parse(localStorage.getItem(PLAN_OPENED_KEY) ?? '[]')).toEqual([
      'hearYourself',
      'lesson2',
    ])
  })

  it.each([
    ['an object', '{"lesson1":true}'],
    ['a list with something that is not a stop', '["lesson1", 7]'],
    ['a number', '3'],
  ])('reads %s in storage as no stops', async (_, value) => {
    localStorage.setItem(PLAN_OPENED_KEY, value)

    const store = await freshStore()

    expect(store.stopOpened('lesson1')).toBe(false)
  })

  it('tells a reader when a stop is opened', async () => {
    const { createRoot, createMemo } = await import('solid-js')
    const store = await freshStore()

    createRoot((dispose) => {
      const opened = createMemo(() => store.stopOpened('piano'))
      expect(opened()).toBe(false)
      store.markStopOpened('piano')
      expect(opened()).toBe(true)
      dispose()
    })
  })
})

describe('the layer', () => {
  it('is closed until it is opened, and closes again', async () => {
    const store = await freshStore()
    expect(store.planLayerMode()).toBeNull()

    store.openPlanLayer('existing')
    expect(store.planLayerMode()).toBe('existing')

    store.closePlanLayer()
    expect(store.planLayerMode()).toBeNull()
  })

  it('opens in the mode it is asked for, replacing the last', async () => {
    const store = await freshStore()

    store.openPlanLayer('skipper')
    store.openPlanLayer('review')

    expect(store.planLayerMode()).toBe('review')
  })

  it('tells a reader when it opens and closes', async () => {
    const { createRoot, createMemo } = await import('solid-js')
    const store = await freshStore()

    createRoot((dispose) => {
      const mode = createMemo(() => store.planLayerMode())
      store.openPlanLayer('review')
      expect(mode()).toBe('review')
      store.closePlanLayer()
      expect(mode()).toBeNull()
      dispose()
    })
  })

  it('is not stored, so a reload opens nothing', async () => {
    const store = await freshStore()

    store.openPlanLayer('existing')
    expect(localStorage.length).toBe(0)
    store.closePlanLayer()
    expect(localStorage.length).toBe(0)

    store.openPlanLayer('review')
    expect((await freshStore()).planLayerMode()).toBeNull()
  })
})
