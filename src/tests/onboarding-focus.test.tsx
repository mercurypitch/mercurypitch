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

import { render, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FirstLight } from '@/features/onboarding/FirstLight'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'

vi.mock('@/lib/jam/media-errors', () => ({
  micPermissionState: (): Promise<string> => Promise.resolve('granted'),
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession =>
    ({
      open: (): Promise<OpenResult> =>
        Promise.resolve({ ok: true } as OpenResult),
      probe: (): Promise<ProbeResult> => Promise.resolve('ok' as ProbeResult),
      arm: (): void => {},
      record: () => Promise.resolve([]),
      latest: () => null,
      latestSmoothed: () => null,
      level: (): number => 0,
      context: () => null,
      isOpen: (): boolean => false,
      devices: (): Promise<MediaDeviceInfo[]> => Promise.resolve([]),
      useDevice: (): Promise<ProbeResult> =>
        Promise.resolve('ok' as ProbeResult),
      close: (): void => {},
    }) as unknown as VoiceSession,
}))

describe('FirstLight focus containment', () => {
  beforeEach(() => {
    // jsdom ships no matchMedia; the star field asks for reduced-motion.
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
})
