// Studio panel tests — modal focus, Escape ordering and desktop focus without trapping.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudioNumberField } from './StudioNumberField'
import { StudioPanel } from './StudioPanel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function viewport(overlay: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches: overlay && media === '(max-width: 1100px)',
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('Studio panel', () => {
  it('focuses the modal, traps Tab, cancels the field before closing, and returns to the opener', async () => {
    viewport(true)
    const close = vi.fn()
    const commit = vi.fn(() => true)
    render(() => {
      const [open, setOpen] = createSignal(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Open details</button>
          <Show when={open()}>
            <StudioPanel
              title="Clip details"
              footer={<button>Play song</button>}
              onClose={() => {
                close()
                setOpen(false)
              }}
            >
              <StudioNumberField
                label="Start"
                value={2}
                min={0}
                max={10}
                onCommit={commit}
              />
            </StudioPanel>
          </Show>
        </>
      )
    })
    const opener = screen.getByRole('button', { name: 'Open details' })
    opener.focus()
    fireEvent.click(opener)
    const panel = screen.getByRole('dialog', { name: 'Clip details' })
    await waitFor(() => expect(panel).toHaveFocus())
    expect(panel).toHaveAttribute('aria-modal', 'true')
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true })
    const field = screen.getByRole('spinbutton', { name: 'Start' })
    const play = screen.getByRole('button', { name: 'Play song' })
    expect(play).toHaveFocus()
    expect(panel).toContainElement(play)
    fireEvent.keyDown(play, { key: 'Tab' })
    expect(
      screen.getByRole('button', { name: 'Close Clip details' }),
    ).toHaveFocus()
    field.focus()
    fireEvent.input(field, { target: { value: '3' } })
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(field).toHaveValue(2)
    expect(close).not.toHaveBeenCalled()
    expect(commit).not.toHaveBeenCalled()
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('focuses the desktop region without trapping outside focus and closes on Escape', async () => {
    viewport(false)
    const close = vi.fn()
    render(() => (
      <>
        <button>Transport</button>
        <StudioPanel title="Track" onClose={close}>
          <button>Track action</button>
        </StudioPanel>
      </>
    ))
    const panel = screen.getByRole('region', { name: 'Track' })
    await waitFor(() => expect(panel).toHaveFocus())
    expect(panel).not.toHaveAttribute('aria-modal')
    const outside = screen.getByRole('button', { name: 'Transport' })
    outside.focus()
    await Promise.resolve()
    expect(outside).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Track action' }), {
      key: 'Escape',
    })
    expect(close).toHaveBeenCalledTimes(1)
  })
})
