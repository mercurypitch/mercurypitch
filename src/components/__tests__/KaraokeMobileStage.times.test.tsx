// ============================================================
// The times under the phone stage's scrubber
// ============================================================
//
// The stage showed the time left (0:15 and -3:05) where the desktop rail and
// the Jam room show the song's length (0:15 and 3:20). One song, one way of
// telling its length, wherever it is played.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { KaraokeMobileStageProps } from '@/components/KaraokeMobileStage'
import { KaraokeMobileStage } from '@/components/KaraokeMobileStage'
import styles from '@/components/KaraokeMobileStage.module.css'

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
    playing: () => true,
    loading: () => false,
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

const times = (): string[] =>
  [...document.querySelectorAll(`.${styles.times} span`)].map(
    (span) => span.textContent ?? '',
  )

describe('the times under the scrubber', () => {
  it("show the time played and the song's length, as the song goes on", () => {
    const [elapsed, setElapsed] = createSignal(15)
    render(() =>
      KaraokeMobileStage(makeProps({ elapsed, duration: () => 200 })),
    )
    const seen = [times()]

    setElapsed(100)
    seen.push(times())

    expect(seen).toEqual([
      ['0:15', '3:20'],
      ['1:40', '3:20'],
    ])
  })
})
