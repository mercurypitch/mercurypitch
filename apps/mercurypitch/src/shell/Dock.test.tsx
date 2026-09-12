// ============================================================
// The dock: one band, two layers, and the pill above them
// ============================================================
//
// The pill's visibility is the thing worth asserting here. Every run store in
// this app is a module-level global, so a pill rendered without asking whose
// run it is lights up in the room the run is already in.
//
// Its WORDS are the other thing, and they are asserted against each other
// rather than only against a string: the pill says "<room> · paused", and its
// accessible name has to contain that verbatim (WCAG 2.5.3). This app ships
// voice control, so a name that paraphrases the button is a button nobody can
// ask for out loud.

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

/** What a room registers, not what its tab is called (device round 1, P4). */
const ROOM = 'Retro Analog Studio'

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
          <SessionPill label={() => ROOM} onReturn={onReturn} />
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
    // The room, and the state, in the kit's grammar for this control.
    expect(pill?.textContent?.trim()).toBe(`${ROOM} · paused`)
    expect(pill?.getAttribute('aria-label')).toBe(
      `${ROOM} · paused. Parked and silent. Return to it`,
    )

    pill?.click()
    expect(onReturn).toHaveBeenCalledTimes(1)
  })

  it('keeps the room name and the state word as separate elements', () => {
    // R2: they were one string in one span, so the ellipsis that keeps a long
    // room name inside the pill ate "paused" with it. Only the name may
    // shrink; the state word and the return control are fixed.
    const { container } = mount({ parked: true })

    const name = container.querySelector(
      '[data-testid="shell-session-pill-name"]',
    )
    const state = container.querySelector(
      '[data-testid="shell-session-pill-state"]',
    )
    expect(name?.textContent).toBe(ROOM)
    expect(state?.textContent).toBe(' · paused')
    // …and the name is the room's alone. A song name here is what would push
    // the state and the control off the end of the pill again.
    expect(name?.textContent).not.toContain('·')
  })

  it('names itself with the words it shows', () => {
    // The invariant rather than the string: whatever the pill comes to say,
    // its accessible name has to contain the visible text verbatim, or voice
    // control cannot reach it (WCAG 2.5.3).
    const { container } = mount({ parked: true })

    const pill = container.querySelector<HTMLButtonElement>(
      '[data-testid="shell-session-pill"]',
    )
    const visible = pill?.textContent?.trim() ?? ''
    expect(visible).not.toBe('')
    expect(pill?.getAttribute('aria-label')).toContain(visible)
  })
})
