// Shared microphone consent traps focus and never chooses an audible-mix policy implicitly.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightRoomMicConsent } from './GuitarNightRoomMicConsent'

afterEach(cleanup)

describe('GuitarNightRoomMicConsent', () => {
  it('stays silent until a deliberate choice and keeps keyboard focus in its portal', async () => {
    const continueMix = vi.fn(),
      mute = vi.fn(),
      cancel = vi.fn()
    const [open, setOpen] = createSignal(false)
    render(() => (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Practice
        </button>
        <GuitarNightRoomMicConsent
          open={open()}
          onContinue={continueMix}
          onMute={mute}
          onCancel={() => {
            cancel()
            setOpen(false)
          }}
        />
      </>
    ))
    const trigger = screen.getByRole('button', { name: 'Practice' })
    trigger.focus()
    fireEvent.click(trigger)
    const first = screen.getByRole('button', { name: 'Continue with this mix' })
    await waitFor(() => expect(first).toHaveFocus())
    expect(continueMix).not.toHaveBeenCalled()
    expect(mute).not.toHaveBeenCalled()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Not now' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(cancel).toHaveBeenCalledOnce()
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it.each(['Continue with this mix', 'Mute room audio & score'])(
    'dispatches only the %s policy',
    async (name) => {
      const continueMix = vi.fn(),
        mute = vi.fn(),
        cancel = vi.fn()
      render(() => (
        <GuitarNightRoomMicConsent
          open
          onContinue={continueMix}
          onMute={mute}
          onCancel={cancel}
        />
      ))
      fireEvent.click(screen.getByRole('button', { name }))
      expect(continueMix).toHaveBeenCalledTimes(
        name.startsWith('Continue') ? 1 : 0,
      )
      expect(mute).toHaveBeenCalledTimes(name.startsWith('Mute') ? 1 : 0)
      expect(cancel).not.toHaveBeenCalled()
    },
  )
})
