// Voice command center focus stays inside the modal and returns to its opener.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerVoiceCommands } from './voice-command-registry'
import { VoiceCommandsOverlay } from './VoiceCommandsOverlay'

describe('VoiceCommandsOverlay', () => {
  afterEach(cleanup)

  it('focuses search, traps Tab, closes on Escape, and restores its opener', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Voice help'
    document.body.append(opener)
    opener.focus()
    const close = vi.fn()
    const view = render(() => <VoiceCommandsOverlay close={close} />)

    const search = screen.getByRole('searchbox', { name: 'Filter commands' })
    const closeButton = screen.getByRole('button', { name: 'Close' })
    await waitFor(() => expect(search).toHaveFocus())

    fireEvent.keyDown(search, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
    expect(search).toHaveFocus()

    fireEvent.keyDown(search, { key: 'Escape', code: 'Escape' })
    expect(close).toHaveBeenCalledOnce()

    view.unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('finds a numeric-slot phrase by the same words shown on screen', () => {
    const unregister = registerVoiceCommands(() => [
      {
        id: 'seek.forwardMinutes',
        label: 'Skip forward',
        phrases: ['forward <n> minutes'],
        run: () => undefined,
      },
    ])
    render(() => <VoiceCommandsOverlay close={vi.fn()} />)

    fireEvent.input(
      screen.getByRole('searchbox', { name: 'Filter commands' }),
      { target: { value: 'forward N minutes' } },
    )

    expect(screen.getByText('forward N minutes')).toBeVisible()
    unregister()
  })

  it('matches punctuation, diacritics, and a spoken numeric slot together', () => {
    const unregister = registerVoiceCommands(() => [
      {
        id: 'seek.forwardSeconds',
        label: 'Avánce',
        phrases: ['avánce <n> secondes'],
        run: () => undefined,
      },
    ])
    render(() => <VoiceCommandsOverlay close={vi.fn()} />)

    fireEvent.input(
      screen.getByRole('searchbox', { name: 'Filter commands' }),
      { target: { value: 'AVANCE, 15 secondes!' } },
    )

    expect(screen.getByText('avánce N secondes')).toBeVisible()
    unregister()
  })
})
