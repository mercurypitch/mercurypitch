// ============================================================
// Back with the singer sheet up
// ============================================================
//
// The singer sheet (Report or Block) opens over a board: the Leagues screen,
// the Legend room, or the web Leaderboard under Progress. Back closes it,
// whatever pane it is on, and only the next Back leaves the board.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_PROGRESS } from '@/features/tabs/constants'
import { closeSingerSheet, openSingerSheet, singerSheetOpen, } from '@/stores/singer-sheet-store'
import { setActiveTab } from '@/stores/ui-store'
import { pushed, pushScreen, resetRunShell } from './run-shell-store'
import { performBack } from './shell-navigation'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  NATIVE_LEAGUES: true,
}))

const host = () => ({ canGoBack: true, back: vi.fn(), minimize: vi.fn() })

beforeEach(() => {
  setActiveTab(TAB_PROGRESS)
  resetRunShell()
  closeSingerSheet()
})

afterEach(() => {
  closeSingerSheet()
  resetRunShell()
})

describe('Back with the singer sheet up', () => {
  it('closes the sheet before it leaves the board under it', () => {
    pushScreen('leagues')
    openSingerSheet({ userId: 'ada', displayName: 'Ada' })
    const back = host()

    const first = performBack(back)
    const sheetAfterFirst = singerSheetOpen()
    const screenAfterFirst = pushed()
    performBack(back)

    expect(first).toBe('sheet')
    expect(sheetAfterFirst).toBe(false)
    expect(screenAfterFirst).toBe('leagues')
    expect(pushed()).toBeNull()
  })

  it('closes the sheet over a tab, and does not go back through history', () => {
    openSingerSheet({ userId: 'ada', displayName: 'Ada' })
    const back = host()

    expect(performBack(back)).toBe('sheet')
    expect(singerSheetOpen()).toBe(false)
    expect(back.back).not.toHaveBeenCalled()
  })
})
