// ============================================================
// KaraokeMobileStage — the download, while it is happening
// ============================================================
//
// On a phone the zen stage is the whole product: the mixer's load card is not
// behind it, so whatever this overlay says is all the user gets. Before this
// it said "Raising the curtain…" and nothing else, which on a slow link is a
// blank two minutes.
//
// What is pinned here is the honesty of the bar rather than its looks. A
// progressbar with no aria-valuenow IS the indeterminate state, so these
// assertions are also the accessibility contract:
//
//   downloading + a known total  ->  a real percentage
//   connecting / decoding        ->  no number, because there isn't one
//   downloading, no Content-Length -> no number, but a climbing byte count

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { KaraokeMobileStageProps } from '@/components/KaraokeMobileStage'
import { KaraokeMobileStage } from '@/components/KaraokeMobileStage'

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(cleanup)

function makeProps(
  over: Partial<KaraokeMobileStageProps> = {},
): KaraokeMobileStageProps {
  return {
    songTitle: 'Test Song',
    playing: () => false,
    loading: () => true,
    loadError: () => '',
    elapsed: () => 0,
    duration: () => 200,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSeekToStart: vi.fn(),
    seekTo: vi.fn(),
    hasPrevItem: () => false,
    hasNextItem: () => false,
    onPrevItem: vi.fn(),
    onNextItem: vi.fn(),
    autoplayEnabled: () => false,
    onToggleAutoplay: vi.fn(),
    vocal: () => ({ muted: false, volume: 0.8 }),
    onToggleVocal: vi.fn(),
    onVocalVolume: vi.fn(),
    parsedLyrics: () => new Map(),
    currentLineIdx: () => -1,
    lyricsLoading: () => false,
    computeActiveWord: () => ({ activeUpTo: -1, charProgress: 0, fraction: 0 }),
    onLineClick: vi.fn(),
    playlistOverlayActive: () => false,
    onPlaylistStart: vi.fn(),
    onPlaylistSkip: vi.fn(),
    ...over,
  }
}

const bar = () => screen.getByRole('progressbar', { name: 'Loading the song' })

describe('KaraokeMobileStage load overlay', () => {
  it('reports a real percentage once bytes are landing against a known total', () => {
    render(() =>
      KaraokeMobileStage(
        makeProps({
          loadProgress: () => 42,
          loadPhase: () => 'downloading',
          loadedBytes: () => 4_200_000,
          totalBytes: () => 10_000_000,
        }),
      ),
    )
    expect(bar().getAttribute('aria-valuenow')).toBe('42')
    expect(screen.getByText('4.0 MB of 9.5 MB')).toBeTruthy()
  })

  it('stays indeterminate while connecting — there is nothing to measure yet', () => {
    render(() =>
      KaraokeMobileStage(
        makeProps({
          loadProgress: () => 0,
          loadPhase: () => 'connecting',
          loadedBytes: () => 0,
          totalBytes: () => null,
        }),
      ),
    )
    expect(bar().getAttribute('aria-valuenow')).toBeNull()
    expect(screen.getByText('Reaching the song library')).toBeTruthy()
  })

  it('counts bytes without a percentage when the server sent no size', () => {
    render(() =>
      KaraokeMobileStage(
        makeProps({
          loadProgress: () => 0,
          loadPhase: () => 'downloading',
          loadedBytes: () => 2_500_000,
          totalBytes: () => null,
        }),
      ),
    )
    expect(bar().getAttribute('aria-valuenow')).toBeNull()
    expect(screen.getByText('2.4 MB')).toBeTruthy()
  })

  it('says decoding rather than parking a finished bar', () => {
    // decodeAudioData reports nothing, and a bar sitting at 100% while the
    // phone chews reads as a hang.
    render(() =>
      KaraokeMobileStage(
        makeProps({
          loadProgress: () => 100,
          loadPhase: () => 'decoding',
          loadedBytes: () => 10_000_000,
          totalBytes: () => 10_000_000,
        }),
      ),
    )
    expect(bar().getAttribute('aria-valuenow')).toBeNull()
    expect(screen.getByText('Almost ready…')).toBeTruthy()
    expect(screen.getByText('Decoding audio')).toBeTruthy()
  })

  it('still shows the overlay for a host that reports no progress at all', () => {
    render(() => KaraokeMobileStage(makeProps()))
    expect(bar().getAttribute('aria-valuenow')).toBeNull()
    expect(screen.getByText('Raising the curtain…')).toBeTruthy()
  })

  it('shows nothing once the load is done', () => {
    render(() => KaraokeMobileStage(makeProps({ loading: () => false })))
    expect(
      screen.queryByRole('progressbar', { name: 'Loading the song' }),
    ).toBeNull()
  })
})
