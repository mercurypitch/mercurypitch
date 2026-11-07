// ============================================================
// Voice Constellation can be pushed only on a build with the native Progress
// ============================================================
//
// Only the native Progress page opens it, and that page is behind
// NATIVE_PROGRESS; but a pushed screen that renders nothing is a Back press
// that pops something invisible, so the store refuses it, as it refuses
// Leagues on a build without them.

import { afterEach, describe, expect, it, vi } from 'vitest'

const build = vi.hoisted(() => ({ progress: false }))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get NATIVE_PROGRESS() {
    return build.progress
  },
}))

import { moreOpen, openMore, pushed, pushScreen, resetRunShell, } from './run-shell-store'

afterEach(() => {
  resetRunShell()
  build.progress = false
})

describe('pushing Voice Constellation', () => {
  it('is refused on a build without the native Progress page', () => {
    pushScreen('voice-constellation')
    expect(pushed()).toBeNull()
  })

  it('lands on a build with it, and closes More on the way', () => {
    build.progress = true
    openMore()
    pushScreen('voice-constellation')
    expect(pushed()).toBe('voice-constellation')
    expect(moreOpen()).toBe(false)
  })
})
