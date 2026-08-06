// KaraokeStageHost — standalone-stage ownership regression tests.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KaraokeStageHost } from './KaraokeStageHost'

const { stemMixerSpy } = vi.hoisted(() => ({
  stemMixerSpy: vi.fn(),
}))

vi.mock('@/components/LyricsUploader', () => ({ LyricsUploaderStyles: '' }))
vi.mock('@/components/StemMixer', () => ({
  StemMixer: (props: Record<string, unknown>) => {
    stemMixerSpy(props)
    return <div data-testid="stage-mixer" />
  },
  StemMixerStyles: '',
}))
vi.mock('@/stores/karaoke-playlist-store', () => ({
  isPlaylistActive: () => false,
  stopPlaylist: vi.fn(),
}))

afterEach(() => {
  cleanup()
  stemMixerSpy.mockClear()
})

describe('KaraokeStageHost', () => {
  it('leaves stage controls to the standalone Karaoke Night shell', () => {
    render(() => (
      <KaraokeStageHost
        song={{
          sessionId: 'song-1',
          title: 'Stage Song',
          stems: { vocal: 'vocal.wav', instrumental: 'backing.wav' },
        }}
        onExit={vi.fn()}
        onSong={vi.fn()}
      />
    ))

    expect(stemMixerSpy).toHaveBeenCalledTimes(1)
    expect(stemMixerSpy.mock.calls[0]?.[0]).toMatchObject({
      preset: 'performance',
      showStageSettings: false,
    })
  })
})
