// ============================================================
// The phone stage's mic, as Karaoke Night's Merc tour names it
// ============================================================
//
// The tour's "Sing along" stop rings the mic the screen draws: the desktop
// mixer's keeps the hook the legacy mixer tour names (mixer.mic), and this
// stage's has its own, karaoke.mic (karaoke-tour.ts, R20). Without the hook
// the stop's ring would have nothing to find on a phone.

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

describe("KaraokeMobileStage and Merc's tour", () => {
  it('names its mic for the Sing along stop', () => {
    render(() =>
      KaraokeMobileStage(
        makeProps({ micActive: () => false, onToggleMic: vi.fn() }),
      ),
    )

    expect(
      screen.getByRole('button', { name: 'Toggle your microphone' }),
    ).toHaveAttribute('data-tour', 'karaoke.mic')
    // The desktop mixer's legacy hook is not borrowed for it.
    expect(document.querySelector('[data-tour="mixer.mic"]')).toBeNull()
  })
})
