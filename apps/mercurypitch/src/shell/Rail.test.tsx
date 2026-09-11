// ============================================================
// The rail: five items, a mark that is not colour alone, one haptic
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Rail } from './Rail'
import { renderShell } from './render-for-test'
import { railItems } from './shell-navigation'

const platform = vi.hoisted(() => ({
  hapticTap: vi.fn(async () => undefined),
  hapticSuccess: vi.fn(async () => undefined),
  hapticWarning: vi.fn(async () => undefined),
}))
vi.mock('@irchiinnuss/mobile-runtime/platform', () => platform)

let unmount: (() => void) | null = null

afterEach(() => {
  unmount?.()
  unmount = null
  vi.clearAllMocks()
})

function mount(selected: 'rooms' | 'stage' | 'ear' | 'progress' | 'more') {
  const onPick = vi.fn()
  const rendered = renderShell(() => (
    <Rail
      items={() => railItems('all')}
      selected={() => selected}
      stage={() => 'sing'}
      onPick={onPick}
    />
  ))
  unmount = rendered.unmount
  return { ...rendered, onPick }
}

describe('Rail', () => {
  it('draws five destinations', () => {
    const { container } = mount('rooms')

    const items = container.querySelectorAll('[data-rail-item]')
    expect(items).toHaveLength(5)
    expect(
      Array.from(items).map((item) => item.getAttribute('data-rail-item')),
    ).toEqual(['rooms', 'stage', 'ear', 'progress', 'more'])
  })

  it('marks the current one with aria-current and a filled symbol', () => {
    const { container } = mount('progress')

    const current = container.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]?.getAttribute('data-rail-item')).toBe('progress')
    // Filled, not merely tinted: the mark survives a monochrome reading.
    expect(current[0]?.querySelector('[fill="currentColor"]')).not.toBeNull()
  })

  it('hands the picked item back, and answers the press', () => {
    const { container, onPick } = mount('rooms')

    container
      .querySelector<HTMLButtonElement>('[data-rail-item="ear"]')
      ?.click()

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0]?.[0]).toMatchObject({ id: 'ear' })
    // The platform haptic, not src/lib/haptics — navigator.vibrate is dead
    // on iOS and this is an iOS-first surface.
    expect(platform.hapticTap).toHaveBeenCalledTimes(1)
  })

  it('gives More a name a screen reader can use', () => {
    const { container } = mount('rooms')

    const more = container.querySelector('[data-rail-item="more"]')
    expect(more?.getAttribute('aria-label')).toBe('More')
    expect(more?.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('folds to the current item when the scroller says so', () => {
    const onPick = vi.fn()
    const rendered = renderShell(() => (
      <Rail
        items={() => railItems('all')}
        selected={() => 'stage'}
        stage={() => 'sing'}
        minimised={() => true}
        onPick={onPick}
      />
    ))
    unmount = rendered.unmount

    expect(
      rendered.container
        .querySelector('.mp-rail-row')
        ?.classList.contains('is-min'),
    ).toBe(true)
  })
})
