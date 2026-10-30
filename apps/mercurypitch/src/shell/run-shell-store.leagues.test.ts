// ============================================================
// Leagues can be pushed only on a build that has them
// ============================================================
//
// The More row and the screen are already behind NATIVE_LEAGUES, so nothing
// in a store build can reach this; but a pushed screen that renders nothing
// is a Back press that pops something invisible, so the store refuses it,
// as it refuses Developer.

import { afterEach, describe, expect, it, vi } from 'vitest'

const build = vi.hoisted(() => ({ leagues: false }))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get NATIVE_LEAGUES() {
    return build.leagues
  },
}))

import { moreOpen, openMore, pushed, pushScreen, resetRunShell, } from './run-shell-store'

afterEach(() => {
  resetRunShell()
  build.leagues = false
})

describe('pushing Leagues', () => {
  it('is refused on a build without them', () => {
    pushScreen('leagues')
    expect(pushed()).toBeNull()
  })

  it('lands on a build with them, and closes More on the way', () => {
    build.leagues = true
    openMore()
    pushScreen('leagues')
    expect(pushed()).toBe('leagues')
    expect(moreOpen()).toBe(false)
  })
})
