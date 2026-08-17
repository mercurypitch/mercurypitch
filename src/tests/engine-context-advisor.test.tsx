// ============================================================
// EngineProvider hosts the one signal-quality advisor
// ============================================================
//
// The advisor is app-level on purpose: it lives and dies with the engines,
// so no practice surface has to remember to host it and none can start a
// second one.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const dispose = vi.fn()
  return { dispose, create: vi.fn(() => dispose) }
})

vi.mock('@/features/mic-feedback/signal-quality-advisor', () => ({
  createSignalQualityAdvisor: mocks.create,
}))

import { EngineProvider } from '@/contexts/EngineContext'

describe('EngineProvider', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('starts one advisor and disposes it with the engines', () => {
    const { unmount } = render(() => (
      <EngineProvider>
        <div />
      </EngineProvider>
    ))
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.dispose).not.toHaveBeenCalled()

    unmount()
    expect(mocks.dispose).toHaveBeenCalledTimes(1)
  })
})
