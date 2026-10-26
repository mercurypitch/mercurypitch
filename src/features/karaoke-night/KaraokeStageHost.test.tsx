// KaraokeStageHost — standalone-stage ownership regression tests, plus the
// first-value telemetry its score callback sends and what a waiting Merc
// tour hears from it.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoachEventName } from '@/lib/coach-events'
import { onCoachEvent } from '@/lib/coach-events'
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

  it('tells a waiting Merc tour the song is on stage, a note was sung and the score card closed', () => {
    const heard: CoachEventName[] = []
    const names: CoachEventName[] = [
      'song-staged',
      'pitch-detected',
      'score-closed',
    ]
    const offs = names.map((name) => onCoachEvent(name, () => heard.push(name)))

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
    const props = stemMixerSpy.mock.calls[0]?.[0] as {
      onValidMicPitch: () => void
      onScorecardViewed: () => void
      onScorecardClosed: () => void
    }
    props.onValidMicPitch()
    // The card showing is not it: the tour waits for the card to go.
    props.onScorecardViewed()
    expect(heard).toEqual(['song-staged', 'pitch-detected'])
    props.onScorecardClosed()

    expect(heard).toEqual(['song-staged', 'pitch-detected', 'score-closed'])
    for (const off of offs) off()
  })

  it('tells a waiting Merc tour when the song stops with no score card, and when the singer leaves the stage', () => {
    const heard: string[] = []
    const names: CoachEventName[] = ['song-unscored', 'stage-left']
    const offs = names.map((name) => onCoachEvent(name, () => heard.push(name)))
    const onExit = vi.fn(() => heard.push('exit'))

    render(() => (
      <KaraokeStageHost
        song={{
          sessionId: 'song-1',
          title: 'Stage Song',
          stems: { vocal: 'vocal.wav', instrumental: 'backing.wav' },
        }}
        onExit={onExit}
        onSong={vi.fn()}
      />
    ))
    const props = stemMixerSpy.mock.calls[0]?.[0] as {
      onStoppedUnscored: () => void
      onBack: () => void
    }
    props.onStoppedUnscored()
    props.onBack()

    // The tour hears Back before the stage goes.
    expect(heard).toEqual(['song-unscored', 'stage-left', 'exit'])
    for (const off of offs) off()
  })
})
