// ============================================================
// FirstLight holds the focus it claims (CLAUDE-JOURNEY-018)
// ============================================================
//
// The welcome overlay declares role="dialog" aria-modal="true" — a promise
// to assistive tech that the page behind is gone. It never took focus, so
// the first Tab landed in the obscured app and a screen-reader user
// operated controls they could not see. The house `useFocusTrap` (the same
// one every other modal uses) moves focus in, cycles Tab, and restores on
// close; this pins that FirstLight actually uses it.
//
// The trap also stops every key at the overlay (isolateKeyboard), which holds
// only for keys sent from inside it. A press on content that cannot take focus
// drops focus to the page, and a key sent there reaches the app's window
// shortcuts: a Space plays the tab behind, an M toggles the microphone. So the
// overlay's own root takes focus from such a press (tabindex -1), and what is
// pinned below is that it does, that it is never a Tab stop or where focus
// opens, and that Tab still cycles from it (ruling R68).

import { fireEvent, render, waitFor, within } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FirstLight } from '@/features/onboarding/FirstLight'
import { APP_KEYS, overheard, press, stopOverhearing, } from '@/tests/utils/trap-keys'

// The flow's edges are faked as First Light's own tests fake them
// (FirstLight.fixture.tsx): the mic is allowed, the voice session hears
// nothing, and the star field's canvas, which jsdom cannot draw and which takes
// no key, is left out.
vi.mock('@/lib/jam/media-errors', async () =>
  (
    await import('@/features/onboarding/FirstLight.fixture')
  ).fake.micPermission(),
)
vi.mock('@/lib/voice-session', async () =>
  (
    await import('@/features/onboarding/FirstLight.fixture')
  ).fake.voiceSession(),
)
vi.mock('@/features/onboarding/StarField', async () =>
  (await import('@/features/onboarding/FirstLight.fixture')).fake.starField(),
)

describe('FirstLight focus containment', () => {
  beforeEach(() => {
    // The funnel logs every event it records, and none of them is asserted here.
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    // jsdom ships no matchMedia; the flow and the viewport hook read their
    // queries from it, and none of them matches.
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  afterEach(() => {
    stopOverhearing()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('moves focus into the dialog on open', async () => {
    const { container, unmount } = render(() => <FirstLight />)
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    // aria-modal is a claim; holding focus is what makes it true.
    await waitFor(
      () => {
        expect(dialog!.contains(document.activeElement)).toBe(true)
      },
      { timeout: 4000 },
    )
    unmount()
  })

  it('opens on the welcome itself, not on the close button that skips it', async () => {
    // The close button is the first control in the DOM (top right). Focused
    // on open it wears its focus ring on the very first screen, which
    // points the eye at the way out instead of "Sing one note".
    const { container, unmount } = render(() => <FirstLight />)
    const dialog = container.querySelector('[role="dialog"]')!
    await waitFor(
      () => {
        expect(dialog.contains(document.activeElement)).toBe(true)
      },
      { timeout: 4000 },
    )
    const close = dialog.querySelector('button[aria-label="Skip the intro"]')
    expect(close).not.toBeNull()
    expect(document.activeElement).not.toBe(close)
    const main = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Sing one note',
    )
    expect(main).toBeDefined()
    expect(document.activeElement!.contains(main!)).toBe(true)
    unmount()
  })

  it('wraps Tab inside the dialog instead of letting it reach the app', async () => {
    // A focusable control "behind" the overlay — the app the trap must fence off.
    const behind = document.createElement('button')
    behind.textContent = 'app behind'
    document.body.appendChild(behind)

    const { container, unmount } = render(() => <FirstLight />)
    const dialog = container.querySelector('[role="dialog"]')!
    await waitFor(
      () => {
        expect(dialog.contains(document.activeElement)).toBe(true)
      },
      { timeout: 4000 },
    )

    const focusables = [
      ...dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ]
    expect(focusables.length).toBeGreaterThan(0)
    const last = focusables[focusables.length - 1]!
    last.focus()
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    )
    // Focus stays fenced inside — it never falls through to the page behind.
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(behind)
    unmount()
    behind.remove()
  })

  it('makes its root take focus from a press, never from Tab, and does not open there', async () => {
    const { container, unmount } = render(() => <FirstLight />)
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!
    await waitFor(
      () => {
        expect(dialog.contains(document.activeElement)).toBe(true)
      },
      { timeout: 4000 },
    )

    expect(dialog).toHaveAttribute('tabindex', '-1')
    // Focus still opens inside it, on the welcome, as the case above pins.
    expect(document.activeElement).not.toBe(dialog)
    unmount()
  })

  it('keeps a Space, an M and an Escape sent at its root from the app behind', () => {
    const { container, unmount } = render(() => <FirstLight />)
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!
    const heard = overheard()
    // The control: the app does hear a key that comes from outside the flow.
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' })
    expect(heard).toEqual(['Space'])
    heard.length = 0

    for (const key of APP_KEYS) fireEvent.keyDown(dialog, key)

    expect(heard).toEqual([])
    unmount()
  })

  it('keeps the focus inside when a press lands on the overlay outside its frame, so the keys after it are still stopped', async () => {
    const { container, unmount } = render(() => <FirstLight />)
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!
    await waitFor(
      () => {
        expect(dialog.contains(document.activeElement)).toBe(true)
      },
      { timeout: 4000 },
    )
    // The picture behind the beat: in the overlay, outside the frame, and not
    // a control, so nothing under it can take the focus but the overlay.
    const picture = dialog.querySelector('[data-plate]')!
    const heard = overheard()

    press(picture)

    // Soft, so a miss reports the keys it let through as well.
    expect.soft(dialog).toHaveFocus()
    for (const key of APP_KEYS) {
      fireEvent.keyDown(document.activeElement ?? document.body, key)
    }
    expect(heard).toEqual([])
    unmount()
  })

  it('still cycles Tab from its root, forward to the first control and back to the last', async () => {
    const { container, unmount } = render(() => <FirstLight />)
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!
    await waitFor(
      () => {
        expect(dialog.contains(document.activeElement)).toBe(true)
      },
      { timeout: 4000 },
    )
    const first = within(dialog).getByRole('button', { name: 'Sing one note' })
    const last = within(dialog).getByRole('button', { name: 'Skip the intro' })
    const heard = overheard()

    dialog.focus()
    expect(dialog).toHaveFocus()
    expect(fireEvent.keyDown(dialog, { key: 'Tab', code: 'Tab' })).toBe(false)
    expect(first).toHaveFocus()

    dialog.focus()
    expect(
      fireEvent.keyDown(dialog, { key: 'Tab', code: 'Tab', shiftKey: true }),
    ).toBe(false)
    expect(last).toHaveFocus()
    expect(heard).toEqual([])
    unmount()
  })
})
