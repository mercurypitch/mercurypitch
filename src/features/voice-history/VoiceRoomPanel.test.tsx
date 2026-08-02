import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FxSettings } from '@/lib/voice-fx-rack'
import { VoiceRoomPanel } from './VoiceRoomPanel'

describe('VoiceRoomPanel', () => {
  afterEach(() => cleanup())

  it('applies presets as one shared playback-room setting', () => {
    const onChange = vi.fn<(settings: FxSettings) => void>()
    render(() => (
      <VoiceRoomPanel
        settings={{ echo: 0, reverb: 0, hall: 0 }}
        onChange={onChange}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Nebula' }))

    expect(onChange).toHaveBeenCalledWith({
      echo: 18,
      reverb: 35,
      hall: 22,
    })
  })

  it('reports slider movement without touching recorded audio', () => {
    const onChange = vi.fn<(settings: FxSettings) => void>()
    render(() => (
      <VoiceRoomPanel
        settings={{ echo: 10, reverb: 25, hall: 0 }}
        onChange={onChange}
      />
    ))

    fireEvent.input(screen.getByTestId('voice-room-hall'), {
      target: { value: '48' },
    })

    expect(onChange).toHaveBeenCalledWith({ echo: 10, reverb: 25, hall: 48 })
    expect(
      screen.getByText(/saved recording stays dry, private, and unchanged/i),
    ).toBeInTheDocument()
  })
})
