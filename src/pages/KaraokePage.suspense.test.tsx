// ============================================================
// The Karaoke tab does not blank itself while it refreshes
// ============================================================
//
// KaraokePage wraps the whole panel in one Suspense boundary whose fallback
// is a full-tab skeleton. Anything under it that re-enters a pending state
// therefore replaces the entire tab — read as "the app crashed and reloaded"
// in the original report, because the mixer, the rail and the header all
// vanish together and come back.
//
// The device-stem query was one such source and became a plain effect. The
// credit pill is the other: its resource is keyed on `balanceVersion`, which
// bumps on every finished job, checkout return and balance poll. A refresh
// must keep showing the balance it already has rather than suspending the
// room around it.
//
// The panel is mounted under a boundary of this test's own, rather than
// through KaraokePage, only so the assertion is about the resource and not
// about the lazy import KaraokePage also wraps.

import { render, screen, waitFor } from '@solidjs/testing-library'
import { Suspense } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const billing = vi.hoisted(() => ({
  fetchBillingMe: vi.fn(),
  fetchPricing: vi.fn(),
}))

vi.mock('@/db/services/billing-service', () => ({
  fetchBillingMe: billing.fetchBillingMe,
  fetchPricing: billing.fetchPricing,
}))

// Server mode is what renders the credit pill at all.
vi.mock('@/stores/app-store', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    isSessionStoreReady: () => true,
    getUvrProcessingMode: () => 'server',
    uvrProcessingMode: () => 'server',
    getAllUvrSessions: () => [],
    getAllUvrSessionsReactive: () => [],
  }
})

import { UvrPanel } from '@/components/UvrPanel'
import { refreshBalance } from '@/stores/billing-store'

beforeEach(() => {
  billing.fetchBillingMe.mockResolvedValue({ creditBalance: 12 })
  billing.fetchPricing.mockResolvedValue({ uvrModelCredits: { roformer: 3 } })
})

describe('Karaoke tab suspense boundary', () => {
  it('keeps the room on screen while the credit balance refreshes', async () => {
    render(() => (
      <Suspense fallback={<div data-testid="tab-fallback" />}>
        <UvrPanel
          initialView="upload"
          onPracticeStart={vi.fn()}
          onExport={vi.fn()}
          onClose={vi.fn()}
        />
      </Suspense>
    ))

    await waitFor(() =>
      expect(screen.getByTestId('uvr-server-cost-hint')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('uvr-server-cost-hint').textContent).toContain(
      '12 credits',
    )

    // A finished job bumps the balance; hold the refetch open so a
    // re-suspend would be visible rather than racing past.
    let release!: (value: unknown) => void
    billing.fetchBillingMe.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve
      }),
    )
    refreshBalance()
    await Promise.resolve()
    await Promise.resolve()

    expect(
      screen.queryByTestId('tab-fallback'),
      'the whole Karaoke tab fell back to its skeleton on a balance refresh',
    ).toBeNull()
    expect(screen.getByTestId('uvr-server-cost-hint')).toBeInTheDocument()

    release({ creditBalance: 15 })
    await waitFor(() =>
      expect(screen.getByTestId('uvr-server-cost-hint').textContent).toContain(
        '15 credits',
      ),
    )
  })
})
