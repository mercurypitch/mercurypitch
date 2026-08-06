// ============================================================
// LabPage — server-granted lazy boundary tests
// ============================================================

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import type * as SolidJs from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchPerksMe: vi.fn(),
  labModuleLoaded: vi.fn(),
  labSurfaceRendered: vi.fn(),
  setAuthVersion: (_version: number) => undefined,
}))

vi.mock('@/db/services/user-service', async () => {
  const { createSignal } = await vi.importActual<typeof SolidJs>('solid-js')
  const [authVersion, setAuthVersion] = createSignal(0)
  mocks.setAuthVersion = setAuthVersion
  return { authVersion }
})
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
  mocks.setAuthVersion(0)
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
    expect(mocks.fetchPerksMe).toHaveBeenCalledOnce()
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

  it('unmounts a previous grant while a changed identity is rechecked', async () => {
    mocks.fetchPerksMe
      .mockResolvedValueOnce({ features: ['lab-access'], perks: [] })
      .mockReturnValueOnce(new Promise(() => undefined))

    render(() => <LabPage initialTab="workbench" />)
    expect(await screen.findByText('Loaded Lab tools')).toBeInTheDocument()

    mocks.setAuthVersion(1)

    expect(await screen.findByText('Checking Lab access')).toBeInTheDocument()
    expect(screen.queryByText('Loaded Lab tools')).not.toBeInTheDocument()
    expect(mocks.fetchPerksMe).toHaveBeenCalledTimes(2)
  })
})
