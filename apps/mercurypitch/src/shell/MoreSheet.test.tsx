// ============================================================
// The More sheet's You group: Account and Settings
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { MoreSheet } from './MoreSheet'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

let view: RenderedShell | null = null

function tile(id: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`[data-more-item="${id}"]`)
}

afterEach(() => {
  view?.unmount()
  view = null
})

describe('the More sheet', () => {
  it('sends the Account tile to Account, and closes on the way', () => {
    const onClose = vi.fn()
    const onPushAccount = vi.fn()
    const onPushSettings = vi.fn()
    view = renderShell(() => (
      <MoreSheet
        open={() => true}
        onClose={onClose}
        onPushSettings={onPushSettings}
        onPushAccount={onPushAccount}
        onPushDeveloper={vi.fn()}
      />
    ))

    tile('account')?.click()

    expect(onPushAccount).toHaveBeenCalledTimes(1)
    expect(onPushSettings).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sends the Settings tile to Settings', () => {
    const onPushSettings = vi.fn()
    view = renderShell(() => (
      <MoreSheet
        open={() => true}
        onClose={vi.fn()}
        onPushSettings={onPushSettings}
        onPushAccount={vi.fn()}
        onPushDeveloper={vi.fn()}
      />
    ))

    tile('settings')?.click()

    expect(onPushSettings).toHaveBeenCalledTimes(1)
  })
})
