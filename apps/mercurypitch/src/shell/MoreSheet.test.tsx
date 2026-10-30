// ============================================================
// The More sheet: its groups, its rows, and where each row goes
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

function openSheet(): void {
  view = renderShell(() => (
    <MoreSheet
      open={() => true}
      onClose={vi.fn()}
      onPushSettings={vi.fn()}
      onPushAccount={vi.fn()}
      onPushDeveloper={vi.fn()}
      onPushLeagues={vi.fn()}
    />
  ))
}

describe('the More sheet', () => {
  it('lists Rooms, then You, with Settings last', () => {
    openSheet()

    const groups = [...document.querySelectorAll('.mp-more-group__title')]
    expect(groups.map((title) => title.textContent)).toEqual(['Rooms', 'You'])
    const rows = [...document.querySelectorAll('[data-more-item]')]
    expect(rows.map((row) => row.getAttribute('data-more-item'))).toEqual([
      'karaoke',
      'piano',
      'guitar',
      'account',
      'developer',
      'settings',
    ])
  })

  // Together's rows each wait on a build switch that does not exist yet
  // (docs/plans/native-more-and-community.md), and an empty group is no group.
  it('draws no Together group while none of its switches is on', () => {
    openSheet()

    expect(document.querySelector('.mp-more-group--together')).toBeNull()
  })

  it('gives every row a name, one line of state and a chevron', () => {
    openSheet()

    for (const row of document.querySelectorAll('[data-more-item]')) {
      expect(row.querySelector('.mp-more-row__name')?.textContent).not.toBe('')
      expect(row.querySelector('.mp-more-row__state')?.textContent).not.toBe('')
      expect(row.querySelector('.mp-more-row__chev')).not.toBeNull()
    }
  })

  it('asks a phone with no account to sign in, on the Account row', () => {
    openSheet()

    expect(
      tile('account')?.querySelector('.mp-more-row__state')?.textContent,
    ).toBe('Sign in to keep your runs')
  })

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
        onPushLeagues={vi.fn()}
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
        onPushLeagues={vi.fn()}
      />
    ))

    tile('settings')?.click()

    expect(onPushSettings).toHaveBeenCalledTimes(1)
  })

  // The suite runs as a test build (vitest.config.ts turns the console on).
  // A store build compiles the tile out altogether, which only a built
  // bundle can show.
  it('offers a test build the Developer tile, which pushes the Developer screen', () => {
    const onClose = vi.fn()
    const onPushDeveloper = vi.fn()
    view = renderShell(() => (
      <MoreSheet
        open={() => true}
        onClose={onClose}
        onPushSettings={vi.fn()}
        onPushAccount={vi.fn()}
        onPushDeveloper={onPushDeveloper}
        onPushLeagues={vi.fn()}
      />
    ))

    tile('developer')?.click()

    expect(onPushDeveloper).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
