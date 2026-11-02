// ============================================================
// The More sheet's Community row, on a build with Community
// ============================================================
//
// Community has a switch of its own (NATIVE_COMMUNITY). Here it is on and
// the Leagues switch off, so the Together group stands for Community alone:
// either switch draws the group, and each row keeps its own.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const held = vi.hoisted(() => ({
  counts: null as { melodies: number; results: number } | null,
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  NATIVE_LEAGUES: false,
  NATIVE_COMMUNITY: true,
}))

vi.mock('./community/community-store', () => ({
  communityCounts: () => held.counts,
}))

vi.mock('./settings/account-state', () => ({
  accountSignedIn: () => true,
  accountCard: () => null,
  accountProviderLine: () => 'Signed in with Apple',
}))

import { MoreSheet } from './MoreSheet'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

let view: RenderedShell | null = null

function openSheet(onPushCommunity = vi.fn(), onClose = vi.fn()): void {
  view = renderShell(() => (
    <MoreSheet
      open={() => true}
      onClose={onClose}
      onPushSettings={vi.fn()}
      onPushAccount={vi.fn()}
      onPushDeveloper={vi.fn()}
      onPushLeagues={vi.fn()}
      onPushLegend={vi.fn()}
      onPushCommunity={onPushCommunity}
    />
  ))
}

const line = (): string | null | undefined =>
  document.querySelector('[data-more-item="community"] .mp-more-row__state')
    ?.textContent

beforeEach(() => {
  held.counts = null
})

afterEach(() => {
  view?.unmount()
  view = null
})

describe('the Community row', () => {
  it('stands alone in the Together group when Leagues are off', () => {
    openSheet()
    const together = document.querySelector('.mp-more-group--together')
    expect(
      [...(together?.querySelectorAll('[data-more-item]') ?? [])].map((row) =>
        row.getAttribute('data-more-item'),
      ),
    ).toEqual(['community'])
    expect(together?.querySelector('.mp-more-row__name')?.textContent).toBe(
      'Community',
    )
  })

  it('says what Community is for before the screen has loaded anything', () => {
    openSheet()
    expect(line()).toBe('What other singers shared')
  })

  it('counts what the screen found when it last loaded', () => {
    held.counts = { melodies: 3, results: 1 }
    openSheet()
    expect(line()).toBe('3 melodies, 1 result')
  })

  it('pushes Community, closing the sheet on the way', () => {
    const onPushCommunity = vi.fn()
    const onClose = vi.fn()
    openSheet(onPushCommunity, onClose)
    document
      .querySelector<HTMLButtonElement>('[data-more-item="community"]')
      ?.click()
    expect(onPushCommunity).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
