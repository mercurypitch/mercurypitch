// ============================================================
// The dock: one band, two layers, and the pill above them
// ============================================================
//
// The pill's visibility is the thing worth asserting here. Every run store in
// this app is a module-level global, so a pill rendered without asking whose
// run it is lights up in the room the run is already in.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dock } from './Dock'
import { renderShell } from './render-for-test'
import { SessionPill } from './SessionPill'

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

function mount(options: { parked?: boolean; running?: boolean } = {}) {
  const onReturn = vi.fn()
  const rendered = renderShell(() => (
    <Dock
      railIn={() => options.running !== true}
      transportIn={() => options.running === true}
      accessory={
        options.parked === true ? (
          <SessionPill label={() => 'Sing'} onReturn={onReturn} />
        ) : null
      }
      rail={<div data-testid="rail-slot" />}
      transport={<div data-testid="transport-slot" />}
    />
  ))
  unmount = rendered.unmount
  return { ...rendered, onReturn }
}

const layerIn = (container: HTMLElement, id: string): boolean =>
  container
    .querySelector(`[data-testid="${id}"]`)
    ?.classList.contains('is-in') ?? false

describe('Dock', () => {
  it('gives the band to the rail while nothing is running', () => {
    const { container } = mount()

    expect(layerIn(container, 'shell-rail-layer')).toBe(true)
    expect(layerIn(container, 'shell-transport-layer')).toBe(false)
    // Both layers stay in the DOM: the swap is a crossfade in one fixed slot,
    // never a height that animates.
    expect(container.querySelector('[data-testid="rail-slot"]')).not.toBeNull()
    expect(
      container.querySelector('[data-testid="transport-slot"]'),
    ).not.toBeNull()
  })

  it('gives it to the transport while a run is going', () => {
    const { container } = mount({ running: true })

    expect(layerIn(container, 'shell-rail-layer')).toBe(false)
    expect(layerIn(container, 'shell-transport-layer')).toBe(true)
  })

  it('shows no session pill when nothing is parked', () => {
    const { container } = mount()

    expect(
      container.querySelector('[data-testid="shell-session-pill"]'),
    ).toBeNull()
  })

  it('shows one, naming the room, when a run is parked elsewhere', () => {
    const { container, onReturn } = mount({ parked: true })

    const pill = container.querySelector<HTMLButtonElement>(
      '[data-testid="shell-session-pill"]',
    )
    expect(pill).not.toBeNull()
    expect(pill?.textContent).toContain('Sing')
    expect(pill?.getAttribute('aria-label')).toBe(
      'Parked and silent. Return to Sing',
    )

    pill?.click()
    expect(onReturn).toHaveBeenCalledTimes(1)
  })
})
