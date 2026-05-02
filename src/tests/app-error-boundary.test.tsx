import { cleanup, render } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { appError } from '@/stores'

const ThrowError: Component = () => {
  throw new Error('Test crash')
  return <div>Not rendered</div>
}

describe('AppErrorBoundary', () => {
  afterEach(cleanup)

  it('catches render errors and displays CrashModal', async () => {
    // Silence expected React/Solid error logs for cleaner test output
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { findByText } = render(() => (
      <AppErrorBoundary>
        <ThrowError />
      </AppErrorBoundary>
    ))

    // Wait for the modal to be displayed
    const title = await findByText('Application Error')
    expect(title).toBeDefined()

    // Check if the specific error message from the thrown error is displayed
    const message = await findByText('Test crash')
    expect(message).toBeDefined()

    // Check that the global appError signal was properly populated
    expect(appError()).not.toBeNull()
    expect(appError()?.error.message).toBe('Test crash')

    errSpy.mockRestore()
  })
})
