// PlayAlongSelect — async role-discovery regression tests.

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { Suspense } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlayAlongSelect } from '../PlayAlongSelect'

const { listStemTypes } = vi.hoisted(() => ({
  listStemTypes: vi.fn(),
}))

vi.mock('@/db/services/uvr-service', () => ({ listStemTypes }))

afterEach(() => {
  cleanup()
  listStemTypes.mockReset()
})

describe('PlayAlongSelect', () => {
  it('keeps its host visible while stored roles are discovered', () => {
    listStemTypes.mockReturnValue(new Promise<string[]>(() => {}))

    render(() => (
      <Suspense fallback={<p>Replacing the mixer…</p>}>
        <p>Current mixer stays mounted</p>
        <PlayAlongSelect
          sessionId="slow-full-band-song"
          availableStems={['vocal', 'instrumental']}
          discoverStoredStems
          onSelect={vi.fn()}
        />
      </Suspense>
    ))

    expect(screen.getByText('Current mixer stays mounted')).toBeVisible()
    expect(screen.queryByText('Replacing the mixer…')).toBeNull()
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('waits for stored parts before exposing the final role menu', async () => {
    let finishDiscovery: ((stems: string[]) => void) | undefined
    listStemTypes.mockReturnValue(
      new Promise<string[]>((resolve) => {
        finishDiscovery = resolve
      }),
    )

    render(() => (
      <PlayAlongSelect
        sessionId="full-band-song"
        availableStems={['vocal', 'instrumental']}
        discoverStoredStems
        onSelect={vi.fn()}
      />
    ))

    const picker = screen.getByRole('combobox', {
      name: 'Choose a play-along role',
    })
    expect(picker).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Finding roles…' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'I play' })).toBeNull()

    finishDiscovery?.(['drums', 'bass', 'guitar', 'piano', 'other'])

    await waitFor(() => expect(picker).toBeEnabled())
    expect(screen.getByRole('option', { name: 'I play guitar' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'I play' })).toBeNull()
  })
})
