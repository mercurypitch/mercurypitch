// ============================================================
// What the rest of the app may know about the jam room
// ============================================================
//
// The tour store has to know whether a room is open, and it must not import
// the jam store to find out: that store brings the peer service, the pitch
// detector and the song transfer with it, and the tour store is in every
// page's first paint. So a file with nothing in it asks, and the jam store
// answers when it loads.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRenderEffect, createRoot } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { TAB_JAM } from '@/features/tabs/constants'
import { jamRoomIsOpen } from '@/lib/jam/jam-room-presence'
import { JAM_ROOM_TOUR_STEPS, PAGE_TOURS, pageTourSteps, } from '@/stores/app-store'
import { setJamState } from '@/stores/jam-store'

afterEach(() => {
  setJamState('idle')
})

describe('whether a room is open', () => {
  it('is the jam store’s own state, not a copy of it', () => {
    expect(jamRoomIsOpen()).toBe(false)
    setJamState('connecting')
    expect(jamRoomIsOpen()).toBe(false)
    setJamState('active')
    expect(jamRoomIsOpen()).toBe(true)
    setJamState('idle')
    expect(jamRoomIsOpen()).toBe(false)
  })

  it('moves the Jam tab’s tour with it', () => {
    expect(pageTourSteps(TAB_JAM)).toBe(PAGE_TOURS[TAB_JAM])
    setJamState('active')
    expect(pageTourSteps(TAB_JAM)).toBe(JAM_ROOM_TOUR_STEPS)
  })

  it('is a signal to whoever reads it in a tracking scope', () => {
    // The sidebar asks `hasPageTour` inside a <Show>; a plain boolean there
    // would be read once and never again.
    const seen: boolean[] = []
    const dispose = createRoot((stop) => {
      createRenderEffect(() => {
        seen.push(jamRoomIsOpen())
      })
      return stop
    })
    setJamState('active')
    setJamState('idle')
    dispose()
    expect(seen).toEqual([false, true, false])
  })
})

describe('the file that asks', () => {
  it('imports nothing, so asking costs the first paint nothing', () => {
    const source = readFileSync(
      resolve(__dirname, '../lib/jam/jam-room-presence.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/^import /m)
  })

  it('is how the tour store finds out, never the jam store itself', () => {
    const store = readFileSync(
      resolve(__dirname, '../stores/app-store.ts'),
      'utf8',
    )
    expect(store).toContain("from '@/lib/jam/jam-room-presence'")
    expect(store).not.toMatch(/from '(@\/stores|\.)\/jam-store'/)
  })
})
