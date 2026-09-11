// Practice recovery stays passive until a route is chosen and keeps cancellation reachable.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import { GuitarPracticeInputPrompt } from './GuitarPracticeInputPrompt'

afterEach(cleanup)

function setup(
  options: { open?: boolean; pending?: boolean; error?: string | null } = {},
) {
  const [open, setOpen] = createSignal(options.open ?? true)
  const [pending, setPending] = createSignal(options.pending ?? false)
  const [error, setError] = createSignal(options.error ?? null)
  const [profile, setProfile] =
    createSignal<GuitarInputProfileKind>('interface')
  const enable = vi.fn(),
    replay = vi.fn(),
    settings = vi.fn(),
    close = vi.fn()
  render(() => (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Practice Play
      </button>
      <GuitarPracticeInputPrompt
        open={open()}
        pending={pending()}
        profile={profile()}
        error={error()}
        onEnable={enable}
        onReplay={replay}
        onSettings={settings}
        onClose={() => {
          close()
          setOpen(false)
        }}
      />
    </>
  ))
  return { enable, replay, settings, close, setPending, setError, setProfile }
}

describe('GuitarPracticeInputPrompt', () => {
  it('opens passively, focuses the current route, and restores focus when dismissed', async () => {
    const actions = setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Practice Play' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(
      screen.getByRole('dialog', { name: 'Enable Listening to practice' }),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Direct input' }),
      ).toHaveFocus(),
    )
    expect(actions.enable).not.toHaveBeenCalled()
    expect(actions.replay).not.toHaveBeenCalled()
    expect(actions.settings).not.toHaveBeenCalled()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(actions.close).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it.each([
    ['Direct input', 'interface'],
    ['Room mic', 'microphone'],
    ['MIDI', 'midi'],
  ] as const)('explicitly enables only %s', (label, kind) => {
    const actions = setup()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(actions.enable).toHaveBeenCalledExactlyOnceWith(kind)
    expect(actions.replay).not.toHaveBeenCalled()
    expect(actions.settings).not.toHaveBeenCalled()
    expect(actions.close).not.toHaveBeenCalled()
  })

  it('offers replay and input settings without enabling a route', () => {
    const actions = setup()
    fireEvent.click(
      screen.getByRole('button', { name: 'Replay without scoring' }),
    )
    expect(actions.replay).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Input settings' }))
    expect(actions.settings).toHaveBeenCalledOnce()
    expect(actions.enable).not.toHaveBeenCalled()
  })

  it('disables repeated requests while pending but always allows cancellation', async () => {
    const actions = setup({ pending: true })
    expect(screen.getByRole('status')).toHaveTextContent('Opening Direct input')
    for (const name of [
      'Direct input',
      'Room mic',
      'MIDI',
      'Replay without scoring',
      'Input settings',
    ]) {
      const button = screen.getByRole('button', { name })
      expect(button).toBeDisabled()
      fireEvent.click(button)
    }
    expect(actions.enable).not.toHaveBeenCalled()
    expect(actions.replay).not.toHaveBeenCalled()
    expect(actions.settings).not.toHaveBeenCalled()
    const close = screen.getByRole('button', { name: 'Close practice input' })
    await waitFor(() => expect(close).toHaveFocus())
    expect(close).toBeEnabled()
    fireEvent.click(close)
    expect(actions.close).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('announces the current input error and permits a fresh route request', () => {
    const actions = setup({ pending: true })
    actions.setError(
      'Microphone access was denied. Allow access in browser settings.',
    )
    actions.setPending(false)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Microphone access was denied',
    )
    fireEvent.click(screen.getByRole('button', { name: 'MIDI' }))
    expect(actions.enable).toHaveBeenCalledExactlyOnceWith('midi')
    actions.setError(null)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
