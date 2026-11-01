// ============================================================
// The reveal, on screen: the card, the twin on its beat, Share and Continue
// ============================================================

import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MercView } from '@/components/room-kit/MercView'
import type { RangeResult } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import { settle } from './onboarding-capture.test-fixtures'
import { ONBOARDING_COPY } from './onboarding-copy'
import type { ShareWays } from './reveal-share'
import { revealPayload } from './reveal-share'
import { RevealView } from './RevealView'
import type { RevealController } from './useReveal'
import { preloadTwin, PROUD_MS, TWIN_MS, useReveal } from './useReveal'

/** The light taps in the hand, counted. */
const hand = vi.hoisted(() => ({ taps: 0 }))
vi.mock('@/lib/haptics', () => ({
  haptics: {
    tapLight: () => {
      hand.taps += 1
    },
    success: () => undefined,
    warning: () => undefined,
  },
}))

vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: false,
    setState: () => undefined,
    setVoice: () => undefined,
    setPaused: () => undefined,
    setStill: () => undefined,
    destroy: () => undefined,
  }),
}))

const E2_G4: RangeResult = {
  lowMidi: 40,
  highMidi: 67,
  lowNote: 'E2',
  highNote: 'G4',
  semitones: 27,
  qualifyingMidis: [40, 67],
  voiceHint: 'Baritone',
}

/** A range no voice type overlaps: no type, no twin. */
const UNDER_ALL: RangeResult = {
  lowMidi: 20,
  highMidi: 27,
  lowNote: 'G#0',
  highNote: 'D#1',
  semitones: 7,
  qualifyingMidis: [20, 27],
  voiceHint: null,
}

let view: RenderedShell | null = null
let controller: RevealController | null = null

function show(
  range: RangeResult,
  ways: ShareWays,
  onContinue: () => void = () => undefined,
  still = false,
): void {
  const Harness = (): JSX.Element => {
    const reveal = useReveal({ still: () => still, ways })
    controller = reveal
    reveal.arrive()
    return (
      <RevealView
        controller={reveal}
        range={range}
        onContinue={onContinue}
        merc={
          <MercView
            state={reveal.mercState}
            voice={reveal.mercVoice}
            testId="onboarding-merc"
          />
        }
      />
    )
  }
  view = renderShell(() => <Harness />)
}

const q = (id: string): HTMLElement | null =>
  view?.container.querySelector(`[data-testid="${id}"]`) ?? null

/** What the screen says after a share. */
const note = (): string | null =>
  q('onboarding-share-note')?.textContent ?? null

function ways(sheet: boolean, copy: boolean) {
  return {
    sheet: vi.fn<ShareWays['sheet']>(async () => Promise.resolve(sheet)),
    copy: vi.fn<ShareWays['copy']>(async () => Promise.resolve(copy)),
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  hand.taps = 0
})

/** The twin's card, and whether it has come in. */
const twinCard = (): string | null =>
  q('onboarding-twin-card')?.getAttribute('data-shown') ?? null

afterEach(() => {
  view?.unmount()
  view = null
  controller = null
  vi.useRealTimers()
})

describe('the reveal', () => {
  it('heads the card with the voice type, the range in words under it', () => {
    show(E2_G4, ways(true, true))

    expect(view?.container.querySelector('h2')?.textContent).toBe(
      "You're a baritone",
    )
    expect(q('onboarding-card-type')?.textContent).toBe("You're a baritone")
    expect(q('onboarding-card-range')?.textContent).toBe(
      'E2 to G4 \u00b7 about two octaves',
    )
    expect(q('onboarding-line')?.textContent).toBe(ONBOARDING_COPY.voiceprint)
  })

  it('brings the twin in as its own card as the print finishes, with Merc and a tap in the hand', () => {
    show(E2_G4, ways(true, true))
    // Its place is kept, its name already text, but it has not come in.
    expect(twinCard()).toBe('off')
    expect(q('onboarding-twin')?.textContent).toBe(singerForRange(E2_G4))
    expect(controller?.mercState()).toBe('listen')
    expect(hand.taps).toBe(0)

    vi.advanceTimersByTime(TWIN_MS - 1)
    expect(twinCard()).toBe('off')
    vi.advanceTimersByTime(1)

    expect(twinCard()).toBe('on')
    expect(controller?.mercState()).toBe('celebrate')
    expect(hand.taps).toBe(1)
    expect(
      q('onboarding-twin-card')?.textContent?.includes(
        `You share a range with ${singerForRange(E2_G4) ?? ''}.`,
      ),
    ).toBe(true)
    // No button to find it, and no blank figure standing in for it.
    expect(q('onboarding-find-twin')).toBeNull()
  })

  it('shows it all at once under reduced motion', () => {
    show(E2_G4, ways(true, true), () => undefined, true)

    expect(twinCard()).toBe('on')
    // His cheer without the jumping: the lock's smile (merc-moves.ts).
    expect(controller?.mercState()).toBe('lock')
    expect(hand.taps).toBe(1)
  })

  it('watches the card arrive, then is proud of it', () => {
    show(E2_G4, ways(true, true))
    expect(controller?.mercState()).toBe('listen')

    vi.advanceTimersByTime(PROUD_MS)

    expect(controller?.mercState()).toBe('celebrate')
  })

  it('has no type and no twin card for a range no voice type overlaps', () => {
    show(UNDER_ALL, ways(true, true))

    expect(q('onboarding-card-type')?.textContent).toBe(
      ONBOARDING_COPY.revealTitle,
    )
    expect(q('onboarding-card-range')?.textContent).toBe(
      'G#0 to D#1 \u00b7 under an octave',
    )
    expect(q('onboarding-twin-card')).toBeNull()
    expect(q('onboarding-twin')).toBeNull()
  })

  it('shares the twin the card shows, bringing it in first, through the share sheet', async () => {
    const w = ways(true, true)
    show(E2_G4, w)

    q('onboarding-share')?.click()
    // What the sheet names is on screen before it opens.
    expect(twinCard()).toBe('on')
    await vi.waitFor(() => expect(w.sheet).toHaveBeenCalledTimes(1))

    expect(q('onboarding-twin')?.textContent).toBe(singerForRange(E2_G4))
    expect(w.sheet).toHaveBeenCalledWith(
      revealPayload(E2_G4, singerForRange(E2_G4)),
    )
  })

  it('copies the link where there is no share sheet, and says so', async () => {
    show(E2_G4, ways(false, true))

    q('onboarding-share')?.click()

    await vi.waitFor(() => expect(note()).toBe(ONBOARDING_COPY.linkCopied))
  })

  it('says the share sheet would not open when nothing takes the link', async () => {
    show(E2_G4, ways(false, false))

    q('onboarding-share')?.click()

    await vi.waitFor(() => expect(note()).toBe(ONBOARDING_COPY.shareFailed))
  })

  it('clears what an earlier share said once the share sheet is shown', async () => {
    let sheet = false
    const w: ShareWays = {
      sheet: async () => Promise.resolve(sheet),
      copy: async () => Promise.resolve(false),
    }
    show(E2_G4, w)
    q('onboarding-share')?.click()
    await vi.waitFor(() => expect(note()).toBe(ONBOARDING_COPY.shareFailed))
    sheet = true

    q('onboarding-share')?.click()

    await vi.waitFor(() => expect(note()).toBe(''))
  })

  it('asks the share sheet once for two quick taps', async () => {
    const w = ways(true, true)
    show(E2_G4, w)

    q('onboarding-share')?.click()
    q('onboarding-share')?.click()
    await settle()

    expect(w.sheet).toHaveBeenCalledTimes(1)
  })

  it('ends the reveal on Continue', () => {
    const onContinue = vi.fn()
    show(E2_G4, ways(true, true), onContinue)

    q('onboarding-continue')?.click()

    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})

describe("the twin's portrait", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is fetched ahead, at the size its face draws it, and not for a range with no twin', () => {
    const fetched: string[] = []
    vi.stubGlobal(
      'Image',
      class {
        decoding = ''
        set src(url: string) {
          fetched.push(url)
        }
      },
    )

    preloadTwin(E2_G4)
    preloadTwin(UNDER_ALL)

    expect(fetched).toHaveLength(1)
    expect(fetched[0]).toMatch(/^\/legends\/mid\/.+\.webp$/u)
  })
})
