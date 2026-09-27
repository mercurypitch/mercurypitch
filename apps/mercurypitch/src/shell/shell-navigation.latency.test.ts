// ============================================================
// Back with the latency sheet up
// ============================================================
//
// The wizard's sheet opens over the Microphone screen (S6 7b). Back closes
// the sheet first, which ends a run in flight, and only then pops the screen
// underneath.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'
import { pushed, pushSettingsScreen, resetRunShell } from './run-shell-store'
import { latencySheetOpen, openLatencySheet, resetLatencySheet, } from './settings/latency-sheet'
import { performBack, resolveBack } from './shell-navigation'

const host = () => ({ canGoBack: true, back: vi.fn(), minimize: vi.fn() })

beforeEach(() => {
  setActiveTab(TAB_SINGING)
  resetRunShell()
  resetLatencySheet()
})

afterEach(() => {
  resetLatencySheet()
  resetRunShell()
})

describe('Back with the latency sheet up', () => {
  it('is for the sheet', () => {
    pushSettingsScreen('microphone')
    openLatencySheet()

    expect(resolveBack(true)).toBe('sheet')
  })

  it('closes the sheet before it pops the screen underneath', () => {
    pushSettingsScreen('microphone')
    openLatencySheet()
    const back = host()

    const first = performBack(back)
    const screenAfterFirst = pushed()
    performBack(back)

    expect(first).toBe('sheet')
    expect(latencySheetOpen()).toBe(false)
    expect(screenAfterFirst).toBe('microphone')
    expect(pushed()).toBe('settings')
  })
})
