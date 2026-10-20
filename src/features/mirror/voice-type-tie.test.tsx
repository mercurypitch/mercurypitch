// ============================================================
// A range that ties Bass and Baritone, on the card and the reveal
// ============================================================
//
// E2 to G4 shares as much with Bass (E2–E4) as with Baritone (G2–G4) and
// sits as near the middle of each, so the Mirror names it Bass-baritone
// (legend-catalog.ts). The range comes from the demo glides through the
// real metrics, and the twin from singerForRange, as MirrorApp wires both.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { voiceTypeHint } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import { renderCard, renderTwinFaceCard } from './card-renderer'
import { buildDemoResult, DEMO_PROFILES } from './demo-data'
import { legendArt } from './LegendCaricature'
import { RevealCard } from './RevealCard'
import { twinPeekLine } from './twin-peek-line'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** The words a card draws: every fillText, in order. */
function recordCardText(): string[] {
  const drawn: string[] = []
  const state: Record<string | symbol, unknown> = {}
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'fillText') {
        return (text: string) => {
          drawn.push(text)
        }
      }
      if (key === 'measureText') {
        return (text: string) => ({ width: text.length * 18 })
      }
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return () => ({ addColorStop: () => undefined })
      }
      return () => undefined
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  })
  // getContext's overloads end in WebGPU's, so a typed spy cannot return a
  // stand-in 2D context (stage.test.ts does the same for GL).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => ctx) as unknown as HTMLCanvasElement['getContext'],
  )
  return drawn
}

function tie(): { result: MirrorResult; legend: string } {
  const { result } = buildDemoResult(DEMO_PROFILES['bass-baritone'])
  const legend = singerForRange(result.range)
  if (legend === null) throw new Error('no twin for the tie')
  return { result, legend }
}

describe('a range that ties Bass and Baritone', () => {
  it('measures E2 to G4 and reads Bass-baritone, with a Bass twin', () => {
    const { result, legend } = tie()
    expect(result.range?.lowNote).toBe('E2')
    expect(result.range?.highNote).toBe('G4')
    expect(result.range?.voiceHint).toBe('Bass-baritone')
    expect(legend).toBe('Paul Robeson')
  })

  it('puts Bass-baritone on the voiceprint card, beside its twin', () => {
    const { result, legend } = tie()
    const drawn = recordCardText()
    renderCard({ result, glides: [], legend }, 'square')
    expect(drawn).toContain('Bass-baritone')
    expect(drawn).toContain(`like ${legend}`)
  })

  it('names the range under the twin on the twin card', () => {
    const { result, legend } = tie()
    const drawn = recordCardText()
    const card = {
      legend,
      epithet: legendArt(legend).epithet,
      voiceType: result.range?.voiceHint ?? null,
      legendImage: document.createElement('canvas'),
    }
    renderTwinFaceCard(card)
    expect(drawn).toContain('BASS-BARITONE   R A N G E')
    renderTwinFaceCard({ ...card, showData: true, result })
    expect(drawn).toContain('Bass-baritone')
  })

  it('reveals the twin and says Bass-baritone', () => {
    const { result, legend } = tie()
    const { container } = render(() => (
      <RevealCard
        legend={legend}
        voiceType={result.range?.voiceHint ?? null}
        mode="flip"
        revealed
        onToggle={() => undefined}
        mountFront={() => undefined}
      />
    ))
    expect(container.querySelector('.mirror-legend-name')?.textContent).toBe(
      legend,
    )
    expect(
      container.querySelector('.mirror-legend-type')?.textContent?.trim(),
    ).toBe('Bass-baritone range')
    expect(
      container.querySelector('.mirror-voicechip')?.textContent?.trim(),
    ).toBe(`Bass-baritone · like ${legend}`)
  })

  it('calls the twin a famous bass-baritone on the twin screen', () => {
    const { result, legend } = tie()
    const line = twinPeekLine(legend, result.range?.voiceHint ?? null)
    expect(line).toBe(
      'Paul Robeson: a famous bass-baritone, the voice type your range overlaps most. A broad guide, not a verdict.',
    )
    expect(
      validateGuidedDynamicClaim({ surface: 'finding', text: line }).violations,
    ).toEqual([])
  })

  it('finds every tie its twin in Paul Robeson or Barry White', () => {
    // A tie's ends add up to 107, so its twin's seed is odd: the Bass
    // roster's second or fourth singer.
    const twins = new Set<string | null>()
    for (let low = 30; low <= 53; low += 1) {
      const high = 107 - low
      const voiceHint = voiceTypeHint(low, high)
      expect(voiceHint).toBe('Bass-baritone')
      twins.add(singerForRange({ voiceHint, lowMidi: low, highMidi: high }))
    }
    expect([...twins].sort()).toEqual(['Barry White', 'Paul Robeson'])
  })
})
