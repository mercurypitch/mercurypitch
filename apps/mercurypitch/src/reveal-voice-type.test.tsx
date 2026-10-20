// @vitest-environment jsdom
// ============================================================
// The onboarding's reveal for a range that ties Bass and Baritone
// ============================================================
//
// E2 to G4 reads Bass-baritone (legend-catalog.ts), and its twin still comes
// from the Bass roster. The range is built the way the reveal builds a kept
// one (saved-range.ts), so the type and the twin are the real ones. This
// sits outside onboarding/ while another branch reworks that folder; it can
// join Reveal.dom.test.tsx once both have landed.

import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MercView } from '@/components/room-kit/MercView'
import type { RangeResult } from '@/lib/mirror/metrics'
import { settle } from './onboarding/onboarding-capture.test-fixtures'
import { RevealView } from './onboarding/RevealView'
import { rangeFromEnds } from './onboarding/saved-range'
import { useReveal } from './onboarding/useReveal'
import type { RenderedShell } from './shell/render-for-test'
import { renderShell } from './shell/render-for-test'

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

let view: RenderedShell | null = null

function show(range: RangeResult): void {
  const Harness = (): JSX.Element => {
    const reveal = useReveal({
      still: () => false,
      ways: {
        sheet: async () => Promise.resolve(true),
        copy: async () => Promise.resolve(true),
      },
    })
    reveal.arrive()
    return (
      <RevealView
        controller={reveal}
        range={range}
        onContinue={() => undefined}
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.useRealTimers()
})

describe("the onboarding's reveal of a Bass/Baritone tie", () => {
  it('reads Bass-baritone under E2 to G4 and finds its twin', async () => {
    show(rangeFromEnds(40, 67))

    expect(q('onboarding-card-range')?.textContent).toBe('E2 to G4')
    expect(q('onboarding-card-type')?.textContent).toBe('Bass-baritone')

    q('onboarding-find-twin')?.click()
    await settle()

    expect(q('onboarding-twin')?.textContent).toBe('Paul Robeson')
  })

  it('keeps Bass for E2 to E4 and Baritone for G2 to G4', () => {
    show(rangeFromEnds(40, 64))
    expect(q('onboarding-card-type')?.textContent).toBe('Bass')
    view?.unmount()

    show(rangeFromEnds(43, 67))
    expect(q('onboarding-card-type')?.textContent).toBe('Baritone')
  })
})
