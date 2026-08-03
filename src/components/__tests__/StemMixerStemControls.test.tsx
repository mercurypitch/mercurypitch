// ============================================================
// StemMixerStemControls tests — stable asynchronous add-stem controls
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StemMixerStemControls } from '../StemMixerStemControls'

afterEach(cleanup)

const emptyTrack = () => ({
  label: '',
  url: '',
  color: '#ffffff',
  buffer: null,
  gainNode: null,
  analyserNode: null,
  sourceNode: null,
  muted: false,
  soloed: false,
  volume: 1,
})

describe('StemMixerStemControls add-stem state', () => {
  it('keeps every pill mounted and disabled while one stem loads', () => {
    render(() => (
      <StemMixerStemControls
        vocal={emptyTrack}
        midi={emptyTrack}
        instrumental={emptyTrack}
        extras={() => []}
        anySoloed={() => false}
        toggleSolo={vi.fn()}
        toggleMute={vi.fn()}
        setTrackVolume={vi.fn()}
        handleDownload={vi.fn()}
        addableStems={() => [
          { key: 'drums', label: 'Drums', color: '#5eead4' },
          { key: 'guitar', label: 'Guitar', color: '#c084fc' },
        ]}
        addingStem={() => 'drums'}
      />
    ))

    const adding = screen.getByRole('button', { name: 'Adding…' })
    const waiting = screen.getByRole('button', { name: '+ Guitar' })
    expect(adding).toBeDisabled()
    expect(adding).toHaveAttribute('aria-busy', 'true')
    expect(waiting).toBeDisabled()
    expect(waiting).toHaveAttribute('aria-busy', 'false')
  })
})
