// KaraokeStageHost — standalone-stage ownership regression tests, plus the
// first-value telemetry its score callback sends.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFirstValueForTests } from '@/lib/first-value'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'
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

beforeEach(() => {
  localStorage.clear()
  resetFirstValueForTests()
})

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

  it('sends first_value_karaoke with the first score', () => {
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
    const sent = (): string[] =>
      (
        JSON.parse(localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]') as {
          event: string
        }[]
      ).map((e) => e.event)
    const props = stemMixerSpy.mock.calls[0]?.[0] as {
      onScoreCreated: () => void
    }

    expect(sent()).toEqual([])
    props.onScoreCreated()
    props.onScoreCreated()

    expect(sent()).toEqual(['first_value_karaoke'])
  })
})
