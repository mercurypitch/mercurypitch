// ============================================================
// The phone stage on its side, on the web
// ============================================================
//
// The room lays its stage out in two columns on a phone held sideways: the
// song and the transport on the left, the lyrics the full height on the
// right. The web's phone stage kept its portrait column on its side, which
// left the lyrics a 200 px strip at 844x390 and put "Paste lyrics" below
// the window. It takes the room's two columns whenever it shows on a short
// touch screen held sideways (isShortTouchLandscape, the match that routes
// such a phone to the stage). Upright nothing changes, and the room keeps
// its own CSS.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type { KaraokeMobileStageProps, KaraokeStageHosting, } from '@/components/KaraokeMobileStage'
import { KaraokeMobileStage } from '@/components/KaraokeMobileStage'
import styles from '@/components/KaraokeMobileStage.module.css'

const viewport = vi.hoisted(() => ({
  turn: (_sideways: boolean): void => {},
}))

vi.mock('@/lib/use-viewport', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const { createSignal } = await import('solid-js')
  const [sideways, setSideways] = createSignal(false)
  viewport.turn = (next) => {
    setSideways(next)
  }
  return {
    ...actual,
    isNarrow: () => false,
    isShortTouchLandscape: sideways,
  }
})

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

beforeEach(() => viewport.turn(false))
afterEach(cleanup)

function makeProps(
  over: Partial<KaraokeMobileStageProps> = {},
): KaraokeMobileStageProps {
  return {
    songTitle: 'Goodbye to Spring',
    playing: () => false,
    loading: () => false,
    loadError: () => '',
    elapsed: () => 0,
    duration: () => 246,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSeekToStart: vi.fn(),
    seekTo: vi.fn(),
    hasPrevItem: () => false,
    hasNextItem: () => true,
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
    onBack: vi.fn(),
    ...over,
  }
}

const hosting = (): KaraokeStageHosting => ({
  byline: () => null,
  onOpenLibrary: vi.fn(),
  lyricsSize: () => 'current',
  noteGlyphs: () => false,
})

const twoColumns = (): boolean =>
  screen
    .getByTestId('karaoke-mobile-stage')
    .classList.contains(styles.sideways!)

describe('the phone stage on its side', () => {
  it('takes the two columns as the phone turns, and gives them back upright', () => {
    render(() => KaraokeMobileStage(makeProps()))
    const seen = [twoColumns()]

    viewport.turn(true)
    seen.push(twoColumns())
    viewport.turn(false)
    seen.push(twoColumns())

    expect(seen).toEqual([false, true, false])
  })

  it("leaves the room's stage to the room's own layout", () => {
    viewport.turn(true)
    render(() => (
      <div>
        <KaraokeMobileStage {...makeProps({ hosted: hosting() })} />
      </div>
    ))

    expect([
      twoColumns(),
      screen.getByTestId('karaoke-mobile-stage').hasAttribute('data-hosted'),
    ]).toEqual([false, true])
  })
})
