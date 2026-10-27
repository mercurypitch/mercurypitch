// ============================================================
// SettingsPage — "Your plan" in General, on the web only
// ============================================================
//
// The page hands SettingsPanel the plan's section, which the panel draws in
// General after App Mode, and the native build hands it none: the constant
// picks a stand-in that draws nothing before `lazy()` is written. That fold
// is read from source in src/features/plan/settings-plan-mount.test.ts; these
// cases run it, with the constant forced each way. What the section offers is
// PlanSettings.test.tsx's.
//
// `IS_NATIVE_BUILD` is a build constant, so each case resets the module
// registry and imports the page afresh, as SettingsNativeVoice.test.tsx does.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** Mounts the Settings page with the native constant forced, on General. */
async function renderPage(isNative: boolean): Promise<void> {
  vi.resetModules()
  vi.doMock('@/lib/native-build', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    IS_NATIVE_BUILD: isNative,
    CAN_TAKE_PAYMENT: !isNative,
  }))
  // Nothing reaches the network from a test process.
  vi.doMock('@/db/services/auth-service', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    accountHeld: () => false,
    fetchMe: vi.fn().mockResolvedValue(null),
    restoreAuth: vi.fn().mockResolvedValue(false),
  }))
  // The section's module is loaded first, so a section the fold let through
  // would arrive at once, well inside the window the native case waits.
  await import('@/features/plan/load-plan-settings').then(async (m) =>
    m.loadPlanSettings(),
  )
  const { SettingsPage } = await import('./SettingsPage')
  render(() => <SettingsPage />)
}

/** The budget is for re-importing the Settings panel's graph, as in SettingsNativeVoice.test.tsx. */
const IMPORT_BUDGET_MS = 30_000

/** How long the native case waits for a section that must not come: the web's comes well inside it. */
const NONE_COMES_MS = 3000

/** A section of General, found by its title. */
const sectionTitled = (title: string): Element =>
  screen.getByRole('heading', { level: 3, name: title }).parentElement!

afterEach(() => {
  cleanup()
  vi.doUnmock('@/lib/native-build')
  vi.doUnmock('@/db/services/auth-service')
  vi.resetModules()
})

describe('Your plan in Settings', () => {
  it(
    'is drawn in General on the web, after App Mode and before the Guided Path',
    { timeout: IMPORT_BUDGET_MS },
    async () => {
      await renderPage(false)

      const plan = await screen.findByTestId(
        'settings-plan',
        {},
        { timeout: IMPORT_BUDGET_MS },
      )

      expect(sectionTitled('App Mode').compareDocumentPosition(plan)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(plan.compareDocumentPosition(sectionTitled('Guided Path'))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    },
  )

  it(
    'is not drawn in the native build',
    { timeout: IMPORT_BUDGET_MS },
    async () => {
      await renderPage(true)

      // General is drawn, and in the time the web's section takes many times
      // over to arrive, none does.
      expect(sectionTitled('App Mode')).toBeInTheDocument()
      await expect(
        screen.findByTestId('settings-plan', {}, { timeout: NONE_COMES_MS }),
      ).rejects.toThrow()
      expect(
        screen.queryByRole('heading', { level: 3, name: 'Your plan' }),
      ).toBeNull()
    },
  )
})
