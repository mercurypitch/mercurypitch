// ============================================================
// The corner chip, and the column it opens upward
// ============================================================

import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CornerTabs } from './CornerTabs'
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

function mount(options: { visible?: boolean; dot?: boolean } = {}) {
  const [open, setOpen] = createSignal(false)
  const onPick = vi.fn()
  const rendered = renderShell(() => (
    <CornerTabs
      visible={() => options.visible ?? true}
      open={open}
      locked={() => false}
      dot={() => options.dot ?? false}
      current={() => 'stage'}
      stage={() => 'sing'}
      items={() => railItems('all')}
      onToggle={() => setOpen((on) => !on)}
      onPick={onPick}
    />
  ))
  unmount = rendered.unmount
  const chip = () =>
    rendered.container.querySelector<HTMLButtonElement>(
      '[data-testid="shell-chip"]',
    )
  return { ...rendered, chip, open, onPick }
}

describe('CornerTabs', () => {
  it('is off the screen until the transport has the band', () => {
    const { container } = mount({ visible: false })

    expect(
      container
        .querySelector('[data-testid="shell-corner"]')
        ?.classList.contains('is-on'),
    ).toBe(false)
  })

  it('opens the other four tabs, never the one already showing', () => {
    const { container, chip } = mount()

    chip()?.click()

    const items = container.querySelectorAll('[data-column-item]')
    expect(items).toHaveLength(4)
    expect(
      Array.from(items).map((item) => item.getAttribute('data-column-item')),
    ).toEqual(['rooms', 'ear', 'progress', 'more'])
  })

  it('says whether it is open, and moves focus into the column', () => {
    const { container, chip } = mount()

    expect(chip()?.getAttribute('aria-expanded')).toBe('false')

    chip()?.click()

    expect(chip()?.getAttribute('aria-expanded')).toBe('true')
    expect(chip()?.getAttribute('aria-controls')).toBe('shell-tab-column')
    expect(document.activeElement).toBe(
      container.querySelector('[data-column-item="rooms"]'),
    )
  })

  it('hands a chosen tab back — the caller is what parks the run', () => {
    const { container, chip, onPick } = mount()
    chip()?.click()

    container
      .querySelector<HTMLButtonElement>('[data-column-item="progress"]')
      ?.click()

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0]?.[0]).toMatchObject({ id: 'progress' })
  })

  it('carries the dot for a session parked somewhere else', () => {
    const { container } = mount({ dot: true })

    expect(container.querySelector('.mp-chip__dot')).not.toBeNull()
  })
})
