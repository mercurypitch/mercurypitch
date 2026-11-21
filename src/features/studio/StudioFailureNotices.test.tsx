// Studio failure notices — a failure is said once as the app's notice on playback's channel, a newer one in its place; a refused edit is said in a dialog with one OK, which dismisses it.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifications, resetNotifications } from '@/stores/notifications-store'
import { STUDIO_EDIT_REFUSED_TITLE, STUDIO_PLAYBACK_NOTICE, StudioEditRefusalDialog, useStudioFailureNotice, } from './StudioFailureNotices'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  resetNotifications()
})

describe('a Studio failure', () => {
  it('is said once as the app’s error notice on playback’s channel, and a newer one takes its place', () => {
    // Arrange
    const [error, setError] = createSignal<string | null>(null)
    createRoot((dispose) => {
      cleanups.push(dispose)
      useStudioFailureNotice(error)
    })

    // Act
    setError('Audio was interrupted. Press Play to continue.')
    const first = notifications().map((each) => each.message)
    setError(null)
    setError('Add an audible take before playing.')

    // Assert
    expect(first).toEqual(['Audio was interrupted. Press Play to continue.'])
    expect(notifications()).toMatchObject([
      {
        message: 'Add an audible take before playing.',
        type: 'error',
        channel: STUDIO_PLAYBACK_NOTICE,
      },
    ])
  })
})

describe('a refused edit', () => {
  it('is said in a dialog with its title, its words and one OK, which dismisses it', () => {
    // Arrange
    const onDismiss = vi.fn()
    render(() => (
      <StudioEditRefusalDialog
        refusal="Your song is as it was before it."
        onDismiss={onDismiss}
      />
    ))
    const dialog = screen.getByRole('alertdialog')

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    // Assert
    expect(dialog).toHaveTextContent(STUDIO_EDIT_REFUSED_TITLE)
    expect(dialog).toHaveTextContent('Your song is as it was before it.')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('shows no dialog while nothing was refused', () => {
    // Act
    render(() => <StudioEditRefusalDialog refusal={null} onDismiss={vi.fn()} />)

    // Assert
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
