// Guitar Night amp-control tests protect progressive disclosure and explicit monitoring.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import { GuitarNightAmpControls } from './GuitarNightAmpControls'

afterEach(cleanup)

describe('GuitarNightAmpControls', () => {
  it('keeps preset, bypass, and Drive immediate while deferring tone controls', () => {
    const choosePreset = vi.fn()
    const setEnabled = vi.fn()
    const setParameter = vi.fn()
    const commit = vi.fn()

    render(() => (
      <GuitarNightAmpControls
        parameters={() => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS}
        presetId={() => 'edge'}
        inputProfile={() => 'microphone'}
        canMonitor={() => false}
        monitoringEnabled={() => false}
        monitoringActive={() => false}
        onEnabled={setEnabled}
        onPreset={choosePreset}
        onParameter={setParameter}
        onParameterCommit={commit}
        onCabinet={() => undefined}
        onMonitor={() => undefined}
        onReset={() => undefined}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Bypass guitar amp' }))
    expect(setEnabled).toHaveBeenCalledWith(false)

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Guitar amp preset' }),
      {
        target: { value: 'lead' },
      },
    )
    expect(choosePreset).toHaveBeenCalledWith('lead')
    expect(screen.getByRole('option', { name: 'Custom' })).toBeDisabled()

    const drive = screen.getByRole('slider', { name: 'Guitar amp drive' })
    fireEvent.input(drive, { target: { value: '0.72' } })
    fireEvent.change(drive, { target: { value: '0.72' } })
    expect(setParameter).toHaveBeenCalledWith('drive', 0.72, false)
    expect(commit).toHaveBeenCalledOnce()

    const toneDisclosure = screen
      .getByText('Shape tone & cabinet')
      .closest('details')
    expect(toneDisclosure).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('Shape tone & cabinet'))
    expect(toneDisclosure).toHaveAttribute('open')
    expect(
      screen.getByRole('slider', { name: 'Guitar amp bass' }),
    ).toHaveAttribute('min', '-1')
    expect(
      screen.getByRole('slider', { name: 'Guitar amp output' }),
    ).toHaveAttribute('aria-valuetext', '0 dB')
  })

  it('explains the safe Direct-input monitor and never enables it implicitly', () => {
    const [enabled, setEnabled] = createSignal(false)
    const [profile, setProfile] = createSignal<'microphone' | 'interface'>(
      'microphone',
    )
    const monitor = vi.fn((next: boolean) => setEnabled(next))

    render(() => (
      <GuitarNightAmpControls
        parameters={() => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS}
        presetId={() => 'edge'}
        inputProfile={profile}
        canMonitor={() => profile() === 'interface'}
        monitoringEnabled={enabled}
        monitoringActive={enabled}
        onEnabled={() => undefined}
        onPreset={() => undefined}
        onParameter={() => undefined}
        onParameterCommit={() => undefined}
        onCabinet={() => undefined}
        onMonitor={monitor}
        onReset={() => undefined}
      />
    ))

    expect(
      screen.getByRole('button', { name: /Hear my input/i }),
    ).toBeDisabled()
    expect(
      screen.getByText(
        'Choose Direct input to hear your guitar through this amp.',
      ),
    ).toBeInTheDocument()
    expect(monitor).not.toHaveBeenCalled()

    setProfile('interface')

    const monitorButton = screen.getByRole('button', {
      name: /Hear my input/i,
    })
    expect(monitorButton).toHaveAccessibleDescription(
      'Headphones recommended. Browser latency applies. Saved takes stay dry.',
    )
    fireEvent.click(monitorButton)
    expect(monitor).toHaveBeenCalledWith(true)
    expect(
      screen.getByText(
        'Headphones recommended. Browser latency applies. Saved takes stay dry.',
      ),
    ).toBeInTheDocument()
  })
})
