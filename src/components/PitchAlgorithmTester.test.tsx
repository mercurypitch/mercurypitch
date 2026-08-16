// ============================================================
// PitchAlgorithmTester — component lifecycle coverage
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  benchmarkAlgorithmAsync: vi.fn(),
}))

vi.mock('@/lib/pitch-algorithm-tester', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/pitch-algorithm-tester')>()),
  benchmarkAlgorithmAsync: mocks.benchmarkAlgorithmAsync,
}))

import { PitchAlgorithmTester } from './PitchAlgorithmTester'

afterEach(() => {
  cleanup()
  mocks.benchmarkAlgorithmAsync.mockReset()
})

describe('PitchAlgorithmTester lifecycle', () => {
  it('does not start another run after the active benchmark is unmounted', async () => {
    let resolveFirst: ((value: never) => void) | undefined
    mocks.benchmarkAlgorithmAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )

    const { unmount } = render(() => <PitchAlgorithmTester />)
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }))
    await waitFor(() =>
      expect(mocks.benchmarkAlgorithmAsync).toHaveBeenCalledTimes(1),
    )

    unmount()
    resolveFirst?.({} as never)
    await Promise.resolve()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(mocks.benchmarkAlgorithmAsync).toHaveBeenCalledTimes(1)
  })
})
