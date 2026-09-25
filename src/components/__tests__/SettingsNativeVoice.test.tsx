// ============================================================
// SettingsPanel — no voice-control section in the native app
// ============================================================
//
// The Voice Control section tells the reader to "turn on the mic pill
// (bottom-left, or press V)", and offers its command list, a tour of the pill
// and the engine behind it. The native app has none of that yet: no pill, V
// does nothing there, and nothing starts a recognizer by itself. So the
// section is not in the native build at all, and the web keeps it whole.
//
// `IS_NATIVE_BUILD` is a build constant, so each case resets the module
// registry and imports the panel afresh, as SettingsNativeBilling.test.tsx
// does.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** Mount Settings with the native constant forced, on its Practice tab. */
async function renderPracticeTab(isNative: boolean): Promise<void> {
  vi.resetModules()
  vi.doMock('@/lib/native-build', () => ({
    IS_NATIVE_BUILD: isNative,
    CAN_TAKE_PAYMENT: !isNative,
  }))
  // Nothing reaches the network from a test process.
  vi.doMock('@/db/services/billing-service', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
      ...actual,
      fetchPricing: vi.fn().mockResolvedValue(null),
      fetchBillingMe: vi.fn().mockResolvedValue(null),
      startCheckout: vi.fn(),
    }
  })
  vi.doMock('@/db/services/auth-service', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
      ...actual,
      accountHeld: () => false,
      fetchMe: vi.fn().mockResolvedValue(null),
      restoreAuth: vi.fn().mockResolvedValue(false),
    }
  })

  const { SettingsPanel } = await import('@/components/SettingsPanel')
  render(() => <SettingsPanel />)
  fireEvent.click(screen.getByTestId('settings-tab-singing'))
}

/** The budget is for re-importing SettingsPanel's graph, as in the billing test. */
const IMPORT_BUDGET_MS = 30_000

const section = (): Element | null =>
  document.querySelector('[data-settings-anchor="voice-control"]')

afterEach(() => {
  cleanup()
  vi.doUnmock('@/lib/native-build')
  vi.doUnmock('@/db/services/billing-service')
  vi.doUnmock('@/db/services/auth-service')
  vi.resetModules()
})

describe('the voice-control section of Settings', () => {
  it(
    'is not in the native app, nor any word of the pill or the V keys',
    async () => {
      await renderPracticeTab(true)

      // The tab it lived on is still there; only the section is gone.
      expect(screen.getByTestId('settings-tab-singing')).toBeInTheDocument()
      expect(section()).toBeNull()
      expect(screen.queryByText('Voice Control')).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('settings-voice-commands'),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('settings-voice-tour'),
      ).not.toBeInTheDocument()
      expect(document.getElementById('voice-engine-select')).toBeNull()
      expect(document.body.textContent).not.toMatch(
        /mic pill|press V|Shift\+V/u,
      )
    },
    IMPORT_BUDGET_MS,
  )

  it(
    'is on the web as it was, with its instructions',
    async () => {
      await renderPracticeTab(false)

      expect(section()).not.toBeNull()
      expect(section()?.textContent).toContain('turn on the mic pill')
      expect(section()?.textContent).toContain('press V')
      expect(screen.getByTestId('settings-voice-commands')).toBeInTheDocument()
      expect(screen.getByTestId('settings-voice-tour')).toBeInTheDocument()
      expect(document.getElementById('voice-engine-select')).not.toBeNull()
    },
    IMPORT_BUDGET_MS,
  )
})
