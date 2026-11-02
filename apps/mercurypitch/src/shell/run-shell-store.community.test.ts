// ============================================================
// Community can be pushed only on a build that has it
// ============================================================
//
// The More row and both screens are already behind NATIVE_COMMUNITY, so
// nothing in a store build can reach this; but a pushed screen that renders
// nothing is a Back press that pops something invisible, so the store
// refuses it, as it refuses Leagues.

import { afterEach, describe, expect, it, vi } from 'vitest'

const build = vi.hoisted(() => ({ community: false }))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get NATIVE_COMMUNITY() {
    return build.community
  },
}))

import { moreOpen, openMore, pushed, pushScreen, resetRunShell, } from './run-shell-store'

afterEach(() => {
  resetRunShell()
  build.community = false
})

describe('pushing Community', () => {
  it('is refused on a build without it, the list and a result alike', () => {
    pushScreen('community')
    pushScreen('community-result')
    expect(pushed()).toBeNull()
  })

  it('lands on a build with it, closing More, and a result goes over the list', () => {
    build.community = true
    openMore()
    pushScreen('community')
    expect(pushed()).toBe('community')
    expect(moreOpen()).toBe(false)

    pushScreen('community-result')
    expect(pushed()).toBe('community-result')
  })
})
