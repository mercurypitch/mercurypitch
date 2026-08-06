// ============================================================
// LabPage — server-granted lazy boundary tests
// ============================================================

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchPerksMe: vi.fn(),
  labModuleLoaded: vi.fn(),
  labSurfaceRendered: vi.fn(),
}))

vi.mock('@/lib/defaults', () => ({ IS_DEV: false }))
vi.mock('@/db/services/user-service', () => ({ authVersion: () => 0 }))
vi.mock('@/lib/backgrounds/background-access', () => ({
  fetchPerksMe: mocks.fetchPerksMe,
  hasSupporterFeatureAccess: (
    response: { features?: readonly string[] } | null,
    featureId: string,
  ) => response?.features?.includes(featureId) ?? false,
}))
vi.mock('@/features/lab/LabSurface', () => {
  mocks.labModuleLoaded()
  return {
    LabSurface: () => {
      mocks.labSurfaceRendered()
      return <div>Loaded Lab tools</div>
    },
  }
})

import { LabPage } from '@/pages/LabPage'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LabPage', () => {
  it('shows a compact nonblank status without loading Lab tools while access is pending', () => {
    mocks.fetchPerksMe.mockReturnValue(new Promise(() => undefined))

    render(() => <LabPage initialTab="workbench" />)

    expect(screen.getByText('Checking Lab access')).toBeInTheDocument()
    expect(
      screen.getByText(/Confirming your supporter benefits/i),
    ).toBeInTheDocument()
    expect(mocks.labModuleLoaded).not.toHaveBeenCalled()
    expect(mocks.labSurfaceRendered).not.toHaveBeenCalled()
  })

  it('fails closed with a Credits CTA when the server does not grant Lab', async () => {
    mocks.fetchPerksMe.mockResolvedValue({ features: [], perks: [] })

    render(() => <LabPage initialTab="workbench" />)

    const cta = await screen.findByRole('link', {
      name: 'View supporter benefits',
    })
    expect(cta).toHaveAttribute('href', '#/settings/credits')
    expect(
      screen.getByText(/Core singing and practice tools remain free/i),
    ).toBeInTheDocument()
    expect(mocks.labModuleLoaded).not.toHaveBeenCalled()
    expect(mocks.labSurfaceRendered).not.toHaveBeenCalled()
  })

  it('imports and renders Lab tools only after a catalogued grant', async () => {
    mocks.fetchPerksMe.mockResolvedValue({
      features: ['lab-access'],
      perks: [],
    })

    render(() => <LabPage initialTab="detection" />)

    expect(await screen.findByText('Loaded Lab tools')).toBeInTheDocument()
    await waitFor(() => expect(mocks.labModuleLoaded).toHaveBeenCalledOnce())
    expect(mocks.labSurfaceRendered).toHaveBeenCalledOnce()
  })
})
