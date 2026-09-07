// Quick Listening controls keep capture, accompaniment and live monitoring independent.
import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightListeningCycle } from './GuitarNightListeningCycle'
import { GuitarNightListeningQuickControls } from './GuitarNightListeningQuickControls'
import type { GuitarListeningStatus } from './useGuitarListeningController'

afterEach(cleanup)

function setup() {
  const [status, setStatus] = createSignal<GuitarListeningStatus>('off')
  const [backing, setBacking] = createSignal(true)
  const [monitoring, setMonitoring] = createSignal(false)
  const [disabled, setDisabled] = createSignal(false)
  const [canMonitor, setCanMonitor] = createSignal(false)
  const onListening = vi.fn(() =>
    setStatus((previous) => (previous === 'off' ? 'requesting' : 'off')),
  )
  const onBacking = vi.fn((enabled: boolean) => setBacking(enabled))
  const onMonitor = vi.fn((enabled: boolean) => setMonitoring(enabled))
  const onSelect = vi.fn()
  render(() => (
    <GuitarNightListeningCycle
      status={status}
      profile={() => 'interface'}
      disabled={disabled}
      onSelect={onSelect}
      quickControls={() => (
        <GuitarNightListeningQuickControls
          status={status()}
          listening={status() !== 'off'}
          backingEnabled={backing()}
          hasBacking
          disabled={disabled()}
          canMonitor={canMonitor()}
          monitoringEnabled={monitoring()}
          monitoringActive={monitoring()}
          onListening={onListening}
          onBacking={onBacking}
          onMonitor={onMonitor}
        />
      )}
    />
  ))
  const trigger = screen.getByRole('button')
  const open = () => fireEvent.contextMenu(trigger)
  return {
    open,
    trigger,
    setStatus,
    setDisabled,
    setCanMonitor,
    onListening,
    onBacking,
    onMonitor,
    onSelect,
  }
}

describe('Direct input quick controls', () => {
  it('opens passively, places toggles outside the route menu and restores focus on Escape', () => {
    const h = setup()
    h.open()
    const group = screen.getByRole('group', {
      name: 'Direct input quick controls',
    })
    expect(
      screen.getByRole('menu', { name: 'Listening route' }),
    ).not.toContainElement(group)
    expect(
      within(group).getByRole('button', { name: 'Turn on Me monitoring' }),
    ).toBeDisabled()
    expect(h.onListening).not.toHaveBeenCalled()
    expect(h.onMonitor).not.toHaveBeenCalled()
    expect(h.onBacking).not.toHaveBeenCalled()
    fireEvent.keyDown(group, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(h.trigger).toHaveFocus()
  })

  it('lets an opening request be cancelled after reopening the picker without changing route', () => {
    const h = setup()
    h.open()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on Listening' }))
    expect(
      screen.getByRole('button', { name: 'Cancel opening input' }),
    ).toBeEnabled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    h.setDisabled(true)
    h.open()
    expect(
      screen
        .getAllByRole('menuitemradio')
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel opening input' }),
    )
    expect(h.onListening).toHaveBeenCalledTimes(2)
    expect(h.onMonitor).not.toHaveBeenCalled()
    expect(h.onSelect).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Turn on Listening' }),
    ).toBeDisabled()
  })

  it('requires a separate Me action after input becomes available and keeps Backing independent', () => {
    const h = setup()
    h.open()
    h.setStatus('listening')
    h.setCanMonitor(true)
    const me = screen.getByRole('button', { name: 'Turn on Me monitoring' })
    expect(me).toHaveAttribute('aria-pressed', 'false')
    expect(h.onMonitor).not.toHaveBeenCalled()
    fireEvent.click(me)
    expect(
      screen.getByRole('button', { name: 'Mute Me monitoring' }),
    ).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Mute backing' }))
    expect(h.onBacking).toHaveBeenCalledExactlyOnceWith(false)
    expect(h.onMonitor).toHaveBeenCalledExactlyOnceWith(true)
    expect(
      screen.getByRole('button', { name: 'Mute Me monitoring' }),
    ).toHaveTextContent('Live')
    h.setDisabled(true)
    expect(
      screen.getByRole('button', { name: 'Mute Me monitoring' }),
    ).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Mute Me monitoring' }))
    expect(h.onMonitor).toHaveBeenLastCalledWith(false)
    expect(
      screen.getByRole('button', { name: 'Unmute backing' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(h.onListening).not.toHaveBeenCalled()
  })
})
