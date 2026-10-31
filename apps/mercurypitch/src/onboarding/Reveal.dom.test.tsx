// ============================================================
// The reveal, on screen: the card, the twin found, Share and Continue
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
import { PROUD_MS, useReveal } from './useReveal'

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
): void {
  const Harness = (): JSX.Element => {
    const reveal = useReveal({ still: () => false, ways })
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
})

afterEach(() => {
  view?.unmount()
  view = null
  controller = null
  vi.useRealTimers()
})

describe('the reveal', () => {
  it('shows the voice, the range, its type and a twin still to find', () => {
    show(E2_G4, ways(true, true))

    expect(view?.container.querySelector('h2')?.textContent).toBe(
      ONBOARDING_COPY.revealTitle,
    )
    expect(q('onboarding-card-range')?.textContent).toBe('E2\u2013G4')
    expect(q('onboarding-card-type')?.textContent).toBe('Baritone')
    expect(q('onboarding-find-twin')?.textContent).toBe(
      ONBOARDING_COPY.findTwin,
    )
    expect(q('onboarding-twin')).toBeNull()
    expect(q('onboarding-line')?.textContent).toBe(ONBOARDING_COPY.voiceprint)
  })

  it('watches the card arrive, then is proud of it', () => {
    show(E2_G4, ways(true, true))
    expect(controller?.mercState()).toBe('listen')

    vi.advanceTimersByTime(PROUD_MS)

    expect(controller?.mercState()).toBe('celebrate')
  })

  it('finds the twin: its name where the button was, and the focus on it', async () => {
    show(E2_G4, ways(true, true))

    q('onboarding-find-twin')?.click()
    await settle()

    const twin = q('onboarding-twin')
    expect(twin?.textContent).toBe(singerForRange(E2_G4))
    expect(q('onboarding-find-twin')).toBeNull()
    expect(document.activeElement).toBe(twin)
  })

  it('has no type and no twin row for a range no voice type overlaps', () => {
    show(UNDER_ALL, ways(true, true))

    expect(q('onboarding-card-range')?.textContent).toBe('G#0\u2013D#1')
    expect(q('onboarding-card-type')).toBeNull()
    expect(q('onboarding-find-twin')).toBeNull()
  })

  it('shares the twin it finds first, through the share sheet', async () => {
    const w = ways(true, true)
    show(E2_G4, w)

    q('onboarding-share')?.click()
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
