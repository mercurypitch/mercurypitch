// ============================================================
// The pushed screens the shell draws: only the top of the stack
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
