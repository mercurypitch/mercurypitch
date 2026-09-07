// ============================================================
// The play button's load meter has a readable number
// ============================================================
//
// Reported from a phone: loading a UVR song leaves the play button dimmed
// and apparently stuck. The phone bar's button had no meter at all, and on
// the console button the percent was invisible — `.shell .playButton` paints
// every transport button in the near-black room colour and outranks a bare
// `.playButtonLoading`, so the number was drawn #08090b on a #1d232b disc.
// jsdom applies no CSS modules, so the contract is pinned in the source.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  'src/features/drum-night/DrumNightApp.module.css',
  'utf8',
)

/** The declarations of the first rule whose selector list contains `needle`. */
function ruleContaining(needle: string): string {
  const at = css.indexOf(needle)
  expect(at, `a rule selecting ${needle} exists`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

describe('drum play-button load meter', () => {
  it('paints the percent in light ink at the weight the room rule uses', () => {
    // Two classes plus .shell, so it outranks `.shell .playButton`, which
    // would otherwise paint the number in the near-black room colour.
    const rule = ruleContaining('.shell .playButton.playButtonLoading')
    expect(rule).toContain('color: var(--vellum)')
    expect(css).toContain('.shell .mobilePlay.playButtonLoading')
  })

  it('dims the disc behind the arc on both transports', () => {
    expect(ruleContaining('\n.playButtonLoading {')).toContain(
      'background: #1d232b',
    )
    expect(
      ruleContaining('.mobileNav .mobilePlay.playButtonLoading'),
    ).toContain('background: #1d232b')
  })

  it('fills the ring from the reported fraction', () => {
    expect(ruleContaining('\n.playLoadRing {')).toContain(
      'var(--load-fraction, 0)',
    )
  })
})
