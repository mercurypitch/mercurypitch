// ============================================================
// Shared mixer controls — native faders, explicit masks and modal focus
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightLevelFader, GuitarNightMixerDialog, GuitarNightMixToggle, } from './GuitarNightMixControls'

describe('Guitar Night shared mix controls', () => {
  afterEach(cleanup)

  it('keeps a live fader mounted and focused while its owner updates the value', () => {
    const [level, setLevel] = createSignal(0)
    const onInput = vi.fn((value: number) => setLevel(value))
    render(() => (
      <GuitarNightLevelFader
        label="Drums level"
        value={level()}
        min={-36}
        max={6}
        step={0.5}
        valueText={`${level()} dB`}
        onInput={onInput}
        testId="drums-level"
        trackId="drums"
      />
    ))
    const fader = screen.getByRole('slider', { name: 'Drums level' })
    fader.focus()
    fireEvent.input(fader, { target: { value: '4.5' } })
    expect(onInput).toHaveBeenCalledWith(4.5)
    expect(screen.getByRole('slider')).toBe(fader)
    expect(fader).toHaveFocus()
    expect(fader).toHaveValue('4.5')
    expect(fader).toHaveAttribute('aria-valuetext', '4.5 dB')
    expect(fader).toHaveAttribute('data-track-id', 'drums')
  })

  it('represents a silent level at the fader floor without losing the output label', () => {
    render(() => (
      <GuitarNightLevelFader
        label="Bass level"
        value={-Infinity}
        min={-36}
        max={6}
        step={0.5}
        valueText="−∞ dB"
        onInput={vi.fn()}
        masked={true}
      />
    ))
    expect(screen.getByRole('slider')).toHaveValue('-36')
    expect(screen.getByRole('slider')).toHaveAttribute(
      'aria-valuetext',
      '−∞ dB',
    )
    expect(screen.getByRole('slider')).toBeEnabled()
  })

  it('does not make a Solo-masked track look explicitly muted', () => {
    const [muted, setMuted] = createSignal(false)
    render(() => (
      <GuitarNightMixToggle
        kind="mute"
        pressed={muted()}
        masked={true}
        label={muted() ? 'Unmute Bass' : 'Mute Bass'}
        title="Bass is quiet while Drums is soloed"
        onToggle={() => setMuted((value) => !value)}
      />
    ))
    const button = screen.getByRole('button', { name: 'Mute Bass' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Unmute Bass' })).toBe(button)
  })

  it('retains a supplied disabled reason without invoking the controller', () => {
    const onToggle = vi.fn()
    render(() => (
      <GuitarNightMixToggle
        kind="solo"
        pressed={false}
        label="Solo Lead guitar"
        title="Lead guitar is the scored part"
        disabled={true}
        onToggle={onToggle}
      />
    ))
    const button = screen.getByRole('button', { name: 'Solo Lead guitar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Lead guitar is the scored part')
    fireEvent.click(button)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('traps focus, ignores disabled controls and restores the opener on Escape', async () => {
    const [isOpen, setIsOpen] = createSignal(false)
    render(() => (
      <>
        <button type="button" onClick={() => setIsOpen(true)}>
          Open mix
        </button>
        <GuitarNightMixerDialog
          isOpen={isOpen()}
          label="Song mix"
          kicker="Track mixer · song"
          title="Velvet study"
          closeLabel="Close mix"
          onClose={() => setIsOpen(false)}
          scrimTestId="song-scrim"
        >
          <button type="button">Reset levels</button>
          <button type="button" disabled={true}>
            Unavailable
          </button>
        </GuitarNightMixerDialog>
      </>
    ))
    const opener = screen.getByRole('button', { name: 'Open mix' })
    opener.focus()
    fireEvent.click(opener)
    await Promise.resolve()
    const close = screen.getByRole('button', { name: 'Close mix' })
    const reset = screen.getByRole('button', { name: 'Reset levels' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(reset).toHaveFocus()
    fireEvent.keyDown(reset, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(close, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
