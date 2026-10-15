// ============================================================
// The pushed screens the shell draws: only the top of the stack
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RoomAsk, RoomBarEnd } from '@/components/room-kit/RoomBar'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'
import { pushScreen, resetRunShell } from './run-shell-store'
import { ShellScreens } from './ShellScreens'

let view: RenderedShell | null = null

function screens(): HTMLElement[] {
  return [
    ...(view?.container.querySelectorAll<HTMLElement>(
      '[data-testid="shell-pushed"]',
    ) ?? []),
  ]
}

function back(): void {
  view?.container
    .querySelector<HTMLButtonElement>('[data-testid="shell-pushed-back"]')
    ?.click()
}

beforeEach(() => {
  setActiveTab(TAB_SINGING)
  resetRunShell()
  view = renderShell(() => <ShellScreens />)
})

afterEach(() => {
  view?.unmount()
  view = null
  resetRunShell()
})

describe('a premium room, full-bleed (D1)', () => {
  it('draws Long note under a see-through bar, and Settings under the opaque one', () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens longNote={() => <div data-testid="room-stub" />} />
    ))

    pushScreen('long-note')
    const room = screens()[0]
    expect(room?.classList.contains('mp-pushed--bleed')).toBe(true)
    expect(room?.dataset.bleed).toBe('on')
    expect(room?.querySelector('[data-testid="room-stub"]')).not.toBeNull()
    // Back stays where it was: the bar floats over the art, it is not gone.
    expect(
      room?.querySelector('[data-testid="shell-pushed-back"]'),
    ).not.toBeNull()
    // The art is a dark stage in either theme, and so is the bar over it:
    // a light theme's dark title would otherwise sit on the dark art.
    expect(
      room
        ?.querySelector('.mp-pushed__bar')
        ?.classList.contains('mp-dark-stage'),
    ).toBe(true)

    pushScreen('settings')
    expect(screens()[0]?.classList.contains('mp-pushed--bleed')).toBe(false)
    expect(screens()[0]?.hasAttribute('data-bleed')).toBe(false)
    expect(
      screens()[0]
        ?.querySelector('.mp-pushed__bar')
        ?.classList.contains('mp-dark-stage'),
    ).toBe(false)
  })
})

describe("the bar's right side", () => {
  it("holds the room's own controls after Back and the room's name", () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens
        echo={() => (
          <RoomBarEnd>
            <RoomAsk
              onAsk={() => undefined}
              label="How it works"
              testId="echo-ask"
            />
          </RoomBarEnd>
        )}
      />
    ))

    pushScreen('echo')

    const bar = screens()[0]?.querySelector('.mp-pushed__bar')
    const order = [
      ...(bar?.querySelectorAll('button, .mp-pushed__title') ?? []),
    ].map((el) => el.getAttribute('data-testid') ?? el.textContent)
    expect(order).toEqual(['shell-pushed-back', 'Echo', 'echo-ask'])
  })

  it('is empty on a screen that puts nothing there', () => {
    pushScreen('settings')

    const end = screens()[0]?.querySelector('[data-testid="shell-pushed-end"]')
    expect(end?.childElementCount).toBe(0)
  })
})

describe('the Echo room', () => {
  it('draws the room passed in, titled Echo, full-bleed', () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens echo={() => <div data-testid="echo-stub" />} />
    ))

    pushScreen('echo')
    const room = screens()[0]
    expect(room?.querySelector('[data-testid="echo-stub"]')).not.toBeNull()
    expect(room?.classList.contains('mp-pushed--bleed')).toBe(true)
    expect(room?.querySelector('.mp-pushed__title')?.textContent).toBe('Echo')
  })

  it('draws nothing in the body on a build without it', () => {
    pushScreen('echo')

    expect(screens()[0]?.querySelector('[data-testid="echo-stub"]')).toBeNull()
    expect(screens()[0]?.querySelector('.mp-pushed__title')?.textContent).toBe(
      'Echo',
    )
  })
})

describe('the Ng slides room', () => {
  it('draws the room passed in, titled Ng slides, full-bleed', () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens ngSlides={() => <div data-testid="ng-stub" />} />
    ))

    pushScreen('ng-slides')
    const room = screens()[0]
    expect(room?.querySelector('[data-testid="ng-stub"]')).not.toBeNull()
    expect(room?.classList.contains('mp-pushed--bleed')).toBe(true)
    expect(room?.querySelector('.mp-pushed__title')?.textContent).toBe(
      'Ng slides',
    )
  })
})

describe('the Lip roll room', () => {
  it('draws the room passed in, titled Lip roll, full-bleed', () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens lipRoll={() => <div data-testid="lip-stub" />} />
    ))

    pushScreen('lip-roll')
    const room = screens()[0]
    expect(room?.querySelector('[data-testid="lip-stub"]')).not.toBeNull()
    expect(room?.classList.contains('mp-pushed--bleed')).toBe(true)
    expect(room?.querySelector('.mp-pushed__title')?.textContent).toBe(
      'Lip roll',
    )
  })
})

describe('the pushed screens', () => {
  it('draws only the screen on top of the stack', () => {
    // Two copies of the same Back would also be two matches for every probe
    // and every screen reader that looks for it.
    pushScreen('settings')

    pushScreen('appearance')

    expect(screens()).toHaveLength(1)
    expect(screens()[0]?.getAttribute('aria-label')).toBe('Appearance')
  })

  it("walks back down the stack with each screen's own Back", () => {
    pushScreen('settings')
    pushScreen('appearance')

    back()
    const under = screens().map((s) => s.getAttribute('aria-label'))
    back()

    expect(under).toEqual(['Settings'])
    expect(screens()).toHaveLength(0)
  })

  it('titles Settings once, in its bar and nowhere in its body (D8)', () => {
    pushScreen('settings')

    const titled = [...(view?.container.querySelectorAll('*') ?? [])].filter(
      (node) =>
        node.children.length === 0 && node.textContent?.trim() === 'Settings',
    )

    expect(titled).toHaveLength(1)
    expect(titled[0]?.classList.contains('mp-pushed__title')).toBe(true)
  })

  it('pushes the native Settings, not the web panel with its links out (D3 to D7)', () => {
    pushScreen('settings')

    const root = view?.container
    const hrefs = [...(root?.querySelectorAll('a[href]') ?? [])].map((a) =>
      a.getAttribute('href'),
    )

    expect(root?.querySelector('[data-testid="settings-screen"]')).not.toBe(
      null,
    )
    expect(root?.querySelector('#settings-panel')).toBe(null)
    expect(hrefs).toEqual([])
  })
})
