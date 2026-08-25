// Guitar Night input picker tests protect explicit, honest route selection.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightInputPicker } from './GuitarNightInputPicker'

afterEach(() => cleanup())

describe('GuitarNightInputPicker', () => {
  it('refreshes audio inputs and exposes the three explicit routes', () => {
    const chooseProfile = vi.fn()
    const refreshAudio = vi.fn()

    render(() => (
      <GuitarNightInputPicker
        profile={() => 'microphone'}
        profileLabel={() => 'Room mic'}
        audioInputs={() => [{ id: 'usb-1', label: 'USB interface' }]}
        selectedAudioInputId={() => null}
        midiInputs={() => []}
        selectedMidiInputId={() => null}
        midiStatus={() => 'idle'}
        evidenceExportEnabled={() => false}
        canExportEvidence={() => false}
        switching={() => false}
        onProfile={chooseProfile}
        onAudioInput={() => undefined}
        onMidiInput={() => undefined}
        onRefreshAudio={refreshAudio}
        onRefreshMidi={() => undefined}
        onExportEvidence={() => undefined}
      />
    ))

    expect(refreshAudio).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Room mic' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Direct input' }))
    expect(chooseProfile).toHaveBeenCalledWith('interface')
    expect(
      screen.getByRole('button', { name: 'Direct input' }),
    ).toHaveAttribute('title', 'Guitar connected through an audio interface')
    const routeGroup = screen.getByRole('group', { name: 'Input route' })
    const description = screen.getByText(
      'Listen through this device’s microphone',
    )
    expect(routeGroup).toHaveAttribute('aria-describedby', description.id)
    expect(
      screen.getByRole('combobox', { name: 'Audio input device' }),
    ).toHaveValue('')
  })

  it('announces an unavailable MIDI device and keeps retry one action away', () => {
    const refreshMidi = vi.fn()

    render(() => (
      <GuitarNightInputPicker
        profile={() => 'midi'}
        profileLabel={() => 'MIDI'}
        audioInputs={() => []}
        selectedAudioInputId={() => null}
        midiInputs={() => []}
        selectedMidiInputId={() => null}
        midiStatus={() => 'unavailable'}
        evidenceExportEnabled={() => false}
        canExportEvidence={() => false}
        switching={() => false}
        onProfile={() => undefined}
        onAudioInput={() => undefined}
        onMidiInput={() => undefined}
        onRefreshAudio={() => undefined}
        onRefreshMidi={refreshMidi}
        onExportEvidence={() => undefined}
      />
    ))

    expect(screen.getByRole('status')).toHaveTextContent(
      'No selected MIDI device is connected.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Find MIDI device' }))
    expect(refreshMidi).toHaveBeenCalledOnce()
  })

  it('keeps evidence export behind its explicit development flag', () => {
    const exportEvidence = vi.fn()

    render(() => (
      <GuitarNightInputPicker
        profile={() => 'interface'}
        profileLabel={() => 'Direct input'}
        audioInputs={() => []}
        selectedAudioInputId={() => null}
        midiInputs={() => []}
        selectedMidiInputId={() => null}
        midiStatus={() => 'idle'}
        evidenceExportEnabled={() => true}
        canExportEvidence={() => true}
        switching={() => false}
        onProfile={() => undefined}
        onAudioInput={() => undefined}
        onMidiInput={() => undefined}
        onRefreshAudio={() => undefined}
        onRefreshMidi={() => undefined}
        onExportEvidence={exportEvidence}
      />
    ))

    const button = screen.getByRole('button', {
      name: 'Export input evidence',
    })
    fireEvent.click(button)
    expect(exportEvidence).toHaveBeenCalledOnce()
    expect(screen.getByText(/No audio or event timeline/i)).toBeInTheDocument()
  })
})
