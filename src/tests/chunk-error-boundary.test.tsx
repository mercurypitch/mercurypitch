// ============================================================
// ChunkErrorBoundary — a failed lazy chunk is a sentence, not a spinner
// ============================================================

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'
import { STALE_RELOAD_STAMP_KEY } from '@/components/StaleBuildRecovery'
import { reloadToLatest } from '@/lib/pwa-service-worker'

vi.mock('@/lib/pwa-service-worker', () => ({
  reloadToLatest: vi.fn(async () => Promise.resolve()),
  requestUpdateCheck: vi.fn(),
}))

const ThrowStaleImport: Component = () => {
  throw new TypeError(
    'Failed to fetch dynamically imported module: https://dev.mercurypitch.com/assets/GuitarNightScoreRoom-BtOPqb-9.js',
  )
}

const ThrowNetworkError: Component = () => {
  throw new TypeError('NetworkError when attempting to fetch resource.')
}

const Fine: Component = () => <p>The room is open.</p>

describe('ChunkErrorBoundary', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.removeItem(STALE_RELOAD_STAMP_KEY)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('renders its children when nothing goes wrong', () => {
    const { getByText } = render(() => (
      <ChunkErrorBoundary label="The rehearsal room">
        <Fine />
      </ChunkErrorBoundary>
    ))
    expect(getByText('The room is open.')).toBeDefined()
  })

  it('treats a stale chunk as an update and hands over to the stale-build recovery', async () => {
    const { findByText, queryByText } = render(() => (
      <ChunkErrorBoundary label="The rehearsal room">
        <ThrowStaleImport />
      </ChunkErrorBoundary>
    ))
    expect(await findByText(/new version/i)).toBeDefined()
    expect(queryByText(/could not be loaded/)).toBeNull()
    expect(reloadToLatest).toHaveBeenCalledTimes(1)
  })

  it('names what failed and offers a reload for any other load error', async () => {
    const reload = vi.fn()
    const { findByRole, getByRole } = render(() => (
      <ChunkErrorBoundary label="The rehearsal room" reload={reload}>
        <ThrowNetworkError />
      </ChunkErrorBoundary>
    ))
    const alert = await findByRole('alert')
    expect(alert.textContent).toContain(
      'The rehearsal room could not be loaded.',
    )
    fireEvent.click(getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(reloadToLatest).not.toHaveBeenCalled()
  })
})
